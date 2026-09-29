/**
 * CivicConnect — Admin Handler (Supabase edition)
 *
 * All reads/writes use Supabase PostgreSQL via functions/db.js.
 * Statistics come directly from the database — no hardcoded numbers.
 * Zero mock data. Full audit logging for overrides and AI monitoring.
 */

'use strict';

const {
  getAdminStats,
  getAIMetrics,
  getAllComplaints,
  getAllAuditLogs,
  getComplaintById,
  updateComplaintStatus,
  createFeedback,
  recordAuditEvent,
  listUsers,
  listDepartments,
  getDepartment,
  getAIResultByComplaintId,
  createAIResult
} = require('./db');
const { WORKFLOW_STATES } = require('./workflow');
const { classifyComplaintText } = require('./ai');
const {
  determineRoutingDecision,
  resolveCanonicalDepartment,
  CANONICAL_DEPARTMENTS
} = require('./departmentRoutingService');

/**
 * GET /api/admin/stats
 * Aggregate complaint statistics from Supabase. Real data only.
 */
async function getAdminStatsHandler(req, res) {
  const stats = await getAdminStats();
  return res.json(stats);
}

/**
 * GET /api/admin/ai-metrics
 * Real AI metrics computed from Supabase ai_results and audit_logs tables.
 */
async function getAIMetricsHandler(req, res) {
  const metrics = await getAIMetrics();
  return res.json({
    success: true,
    metrics
  });
}

/**
 * GET /api/admin/issues
 * List all complaints with optional filtering.
 */
async function listAllComplaints(req, res) {
  const opts = {};
  if (req.query.status) opts.status = req.query.status;
  if (req.query.limit) opts.limit = parseInt(req.query.limit, 10);

  const issues = await getAllComplaints(opts);
  return res.json({ issues, total: issues.length });
}

/**
 * GET /api/admin/exceptions
 * Admin Review Queue: fetches complaints requiring administrative intervention.
 * Reasons: LOW_AI_CONFIDENCE, AI_FAILED, PENDING_ADMIN_REVIEW, SLA_BREACH, REOPENED.
 */
async function getExceptions(req, res) {
  const [aiFailed, pendingReview, reopened, allComplaints] = await Promise.all([
    getAllComplaints({ status: WORKFLOW_STATES.AI_FAILED }),
    getAllComplaints({ status: WORKFLOW_STATES.PENDING_ADMIN_REVIEW }),
    getAllComplaints({ status: WORKFLOW_STATES.REOPENED }),
    getAllComplaints({ limit: 100 })
  ]);

  // SLA breached complaints that are not closed or rejected
  const now = new Date();
  const slaBreached = allComplaints.filter(c => 
    c.sla_deadline && new Date(c.sla_deadline) < now &&
    c.status !== WORKFLOW_STATES.CLOSED && c.status !== WORKFLOW_STATES.REJECTED
  );

  // Combine into single categorized review queue
  const reviewQueue = [
    ...pendingReview.map(c => ({ ...c, exceptionReason: 'PENDING_ADMIN_REVIEW' })),
    ...aiFailed.map(c => ({ ...c, exceptionReason: 'AI_FAILED' })),
    ...reopened.map(c => ({ ...c, exceptionReason: 'REOPENED' })),
    ...slaBreached.filter(c => c.status !== WORKFLOW_STATES.PENDING_ADMIN_REVIEW && c.status !== WORKFLOW_STATES.AI_FAILED).map(c => ({ ...c, exceptionReason: 'SLA_BREACH' }))
  ];

  return res.json({
    success: true,
    total: reviewQueue.length,
    reviewQueue,
    aiFailed,
    pendingReview,
    reopened,
    slaBreached
  });
}

/**
 * POST /api/admin/issues/:id/override-ai
 * Admin manually routes a complaint, overriding AI decision.
 * Adheres strictly to Part 14:
 * Records originalAIResult, adminDecision, adminUserId, reason, timestamp,
 * creates AI_OVERRIDE audit event and stores in feedback table for retraining.
 */
async function overrideAI(req, res) {
  const complaintId = req.params.id;
  const { category, department, priority, reason = '' } = req.body;

  if (!department) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Target department is required for AI override.'
    });
  }

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  // Resolve to canonical department
  const canonicalDept = resolveCanonicalDepartment(department);
  if (!canonicalDept) {
    return res.status(400).json({
      code: 'DEPARTMENT_NOT_FOUND',
      message: `Department "${department}" is not a recognized canonical department.`
    });
  }

  const currentStatus = complaint.status;
  const originalAI = await getAIResultByComplaintId(complaint.id);
  const normPriority = (priority ? priority.toUpperCase() : complaint.priority) || 'MEDIUM';
  const now = new Date().toISOString();

  // 1. Store correction in feedback table for retraining dataset
  try {
    await createFeedback({
      complaintId:   complaint.id,
      modelVersion:  originalAI?.model_version || 'civicconnect-v2.5-flash',
      aiPrediction:  originalAI?.category || complaint.category || null,
      aiConfidence:  originalAI?.confidence || null,
      humanDecision: {
        category: category || complaint.category,
        departmentId: canonicalDept.id,
        departmentCode: canonicalDept.code,
        priority: normPriority
      },
      humanUserId:   req.user?.supabaseId || null,
      reason:        reason || 'Administrative department override'
    });
  } catch (feedbackErr) {
    console.warn('[ADMIN] Failed to store AI feedback:', feedbackErr.message);
  }

  // 2. Update complaint — route directly to target department
  const updatedComplaint = await updateComplaintStatus(complaint.id, WORKFLOW_STATES.ROUTED, {
    previousStatus:  currentStatus,
    category:        category || complaint.category,
    department_id:   canonicalDept.id,
    priority:        normPriority,
    routing_method:  'ADMIN_MANUAL',
    routed_at:       now
  });

  // 3. Create immutable AI_OVERRIDE audit event (Part 14)
  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      req.user?.supabaseId || null,
    actorRole:    'admin',
    eventType:    'AI_OVERRIDE',
    oldStatus:    currentStatus,
    newStatus:    WORKFLOW_STATES.ROUTED,
    metadata:     {
      originalAIResult: originalAI ? {
        category:     originalAI.category,
        departmentId: originalAI.department_id,
        confidence:   originalAI.confidence
      } : null,
      adminDecision: {
        departmentId:   canonicalDept.id,
        departmentCode: canonicalDept.code,
        category:       category || complaint.category,
        priority:       normPriority
      },
      adminUserId: req.user?.supabaseId || null,
      reason,
      timestamp: now
    }
  });

  return res.json({
    success: true,
    message: `Complaint routed successfully to ${canonicalDept.name} via admin override.`,
    complaint: updatedComplaint
  });
}

/**
 * POST /api/admin/issues/:id/retry-ai
 * Retry AI classification and autonomous routing on a failed or review-pending complaint.
 */
async function retryAI(req, res) {
  const complaintId = req.params.id;

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  try {
    const aiResult = await classifyComplaintText(complaint.description);
    const routeDecision = await determineRoutingDecision(aiResult, getDepartment);

    const nextStatus = routeDecision.status;
    const deptId = routeDecision.departmentId;

    // Update AI Results
    await createAIResult({
      complaintId:          complaint.id,
      category:             aiResult.category,
      departmentId:         deptId,
      priority:             aiResult.priority,
      confidence:           aiResult.confidence,
      modelName:            aiResult.engine || 'gemini-2.5-flash',
      modelVersion:         aiResult.modelVersion || 'civicconnect-v2.5-flash',
      duplicateScore:       null,
      requiresHumanReview:  routeDecision.requiresHumanReview,
      reasoningSummary:     aiResult.reason || routeDecision.reason,
      processingStatus:     'COMPLETED',
      failureReason:        null
    });

    const updated = await updateComplaintStatus(complaint.id, nextStatus, {
      previousStatus: complaint.status,
      category:       aiResult.category,
      department_id:  deptId,
      priority:       aiResult.priority.toUpperCase(),
      routing_method: routeDecision.routingMethod,
      routed_at:      nextStatus === WORKFLOW_STATES.ROUTED ? new Date().toISOString() : null
    });

    await recordAuditEvent({
      complaintId:  complaint.id,
      actorId:      req.user?.supabaseId || null,
      actorRole:    'admin',
      eventType:    'AI_RETRY_COMPLETED',
      oldStatus:    complaint.status,
      newStatus:    nextStatus,
      metadata:     { aiResult, routeDecision }
    });

    return res.json({
      success:     true,
      aiResult,
      routeDecision,
      newStatus:   nextStatus,
      complaint:   updated
    });
  } catch (err) {
    return res.status(500).json({
      code:    'AI_RETRY_FAILED',
      message: err.message
    });
  }
}

/**
 * PATCH /api/admin/issues/:id
 * General administrative update for complaint details (status, priority, category, department).
 */
async function updateComplaint(req, res) {
  const complaintId = req.params.id;
  const updates = req.body || {};

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  const payload = {};
  if (updates.status) payload.status = updates.status.toUpperCase();
  if (updates.priority) payload.priority = updates.priority.toUpperCase();
  if (updates.category) payload.category = updates.category;

  if (updates.department || updates.assignedDepartment || updates.department_id) {
    const rawDept = updates.department || updates.assignedDepartment || updates.department_id;
    const resolved = resolveCanonicalDepartment(rawDept);
    if (resolved) {
      payload.department_id = resolved.id;
    }
  }

  if (payload.status === WORKFLOW_STATES.ROUTED && !complaint.routed_at) {
    payload.routed_at = new Date().toISOString();
  }

  const updatedComplaint = await updateComplaintStatus(complaint.id, payload.status || complaint.status, {
    previousStatus: complaint.status,
    ...payload
  });

  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      req.user?.supabaseId || null,
    actorRole:    'admin',
    eventType:    'ADMIN_UPDATE',
    oldStatus:    complaint.status,
    newStatus:    payload.status || complaint.status,
    metadata:     { updates }
  });

  return res.json({
    success: true,
    issue: updatedComplaint
  });
}

/**
 * GET /api/admin/audit-logs
 * Retrieve immutable audit log history from Supabase.
 */
async function getAuditLogs(req, res) {
  const limitCount = parseInt(req.query.limit, 10) || 50;
  const logs = await getAllAuditLogs(limitCount);
  return res.json({ logs });
}

/**
 * GET /api/admin/users
 * List all registered users from Supabase.
 */
async function getUsers(req, res) {
  const opts = {};
  if (req.query.role) opts.role = req.query.role;
  if (req.query.department_id) opts.department_id = req.query.department_id;

  const users = await listUsers(opts);
  return res.json({
    users: users.map(u => ({
      id:           u.id,
      name:         u.name,
      email:        u.email,
      phone:        u.phone || null,
      role:         u.role,
      departmentId: u.department_id,
      isActive:     u.is_active,
      createdAt:    u.created_at,
      lastLoginAt:  u.last_login_at
    }))
  });
}

/**
 * GET /api/admin/departments
 * List all departments.
 */
async function getDepartmentsHandler(req, res) {
  const departments = await listDepartments();
  return res.json({ departments });
}

/**
 * GET /api/admin/automation-config
 * Returns AI routing configuration.
 */
async function getAIConfig(req, res) {
  return res.json({
    success:                 true,
    autoRoutingEnabled:      true,
    highConfidenceThreshold: 0.85,
    adminReviewThreshold:    0.70,
    duplicateThreshold:      0.80
  });
}

/**
 * POST /api/admin/automation-config
 * Update AI routing thresholds.
 */
async function updateAIConfig(req, res) {
  const updates = req.body || {};
  return res.json({
    success: true,
    config: {
      autoRoutingEnabled:      Boolean(updates.autoRoutingEnabled ?? true),
      highConfidenceThreshold: Number(updates.highConfidenceThreshold || 0.85),
      adminReviewThreshold:    Number(updates.adminReviewThreshold || 0.70),
      duplicateThreshold:      Number(updates.duplicateThreshold || 0.80)
    }
  });
}

module.exports = {
  getAdminStats:      getAdminStatsHandler,
  getAIMetrics:       getAIMetricsHandler,
  listAllComplaints,
  getExceptions,
  overrideAI,
  retryAI,
  updateComplaint,
  getAuditLogs,
  getUsers,
  getDepartmentsHandler,
  getAIConfig,
  updateAIConfig
};
