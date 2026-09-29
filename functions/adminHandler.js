/**
 * CivicConnect — Admin Handler (Supabase edition)
 *
 * All reads/writes use Supabase PostgreSQL via functions/db.js.
 * Statistics come directly from the database — no hardcoded numbers.
 * No Firestore. No fake data.
 */

'use strict';

const {
  getAdminStats,
  getAllComplaints,
  getAllAuditLogs,
  getComplaintById,
  updateComplaintStatus,
  createFeedback,
  recordAuditEvent,
  listUsers,
  listDepartments
} = require('./db');
const { WORKFLOW_STATES } = require('./workflow');
const { classifyComplaintText } = require('./ai');
const { determineRouting } = require('./routing');

/**
 * GET /api/admin/stats
 * Aggregate complaint statistics from Supabase. Real data only.
 */
async function getAdminStatsHandler(req, res) {
  const stats = await getAdminStats();
  return res.json(stats);
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
 * Exception queues: AI_FAILED, PENDING_ADMIN_REVIEW, REOPENED.
 */
async function getExceptions(req, res) {
  const [aiFailed, pendingReview, reopened] = await Promise.all([
    getAllComplaints({ status: WORKFLOW_STATES.AI_FAILED }),
    getAllComplaints({ status: WORKFLOW_STATES.PENDING_ADMIN_REVIEW }),
    getAllComplaints({ status: WORKFLOW_STATES.REOPENED })
  ]);

  return res.json({
    aiFailed,
    pendingReview,
    reopened
  });
}

/**
 * POST /api/admin/issues/:id/override-ai
 * Admin manually routes a complaint, overriding AI decision.
 * Stores correction as feedback for model retraining.
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

  const currentStatus = complaint.status;

  // Store correction as AI feedback for retraining dataset
  try {
    await createFeedback({
      complaintId:   complaint.id,
      modelVersion:  'civicconnect-v2.1-flash',
      aiPrediction:  complaint.category || null,
      aiConfidence:  null,
      humanDecision: { category: category || complaint.category, department, priority },
      humanUserId:   req.user?.supabaseId || null,
      reason
    });
  } catch (feedbackErr) {
    console.warn('[ADMIN] Failed to store AI feedback:', feedbackErr.message);
  }

  // Update complaint — route to department
  await updateComplaintStatus(complaint.id, WORKFLOW_STATES.ROUTED, {
    previousStatus:  currentStatus,
    category:        category || complaint.category,
    department_id:   department,
    priority:        priority ? priority.toUpperCase() : complaint.priority,
    routing_method:  'ADMIN_MANUAL',
    routed_at:       new Date().toISOString()
  });

  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      req.user?.supabaseId || null,
    actorRole:    'admin',
    eventType:    'ADMIN_OVERRIDE',
    oldStatus:    currentStatus,
    newStatus:    WORKFLOW_STATES.ROUTED,
    metadata:     { override: { department, category, priority, reason } }
  });

  return res.json({
    success: true,
    message: 'Complaint routed successfully via admin override.'
  });
}

/**
 * POST /api/admin/issues/:id/retry-ai
 * Retry AI classification on a failed complaint.
 */
async function retryAI(req, res) {
  const complaintId = req.params.id;

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  try {
    const aiResult = await classifyComplaintText(complaint.description);

    const routeDecision = await determineRouting(null, {
      aiConfidence:       aiResult.confidence,
      departmentId:       aiResult.department,
      duplicateCandidate: { isDuplicate: false, duplicateScore: 0 }
    });

    await updateComplaintStatus(complaint.id, routeDecision.status, {
      previousStatus: complaint.status,
      category:       aiResult.category,
      department_id:  aiResult.department,
      priority:       aiResult.priority.toUpperCase(),
      routing_method: routeDecision.routingMethod
    });

    await recordAuditEvent({
      complaintId:  complaint.id,
      actorId:      req.user?.supabaseId || null,
      actorRole:    'admin',
      eventType:    'AI_RETRY_COMPLETED',
      oldStatus:    complaint.status,
      newStatus:    routeDecision.status,
      metadata:     { aiResult }
    });

    return res.json({
      success:   true,
      aiResult,
      newStatus: routeDecision.status
    });
  } catch (err) {
    return res.status(500).json({
      code:    'AI_RETRY_FAILED',
      message: err.message
    });
  }
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
 * List all registered users.
 */
async function getUsers(req, res) {
  const opts = {};
  if (req.query.role) opts.role = req.query.role;
  if (req.query.department_id) opts.department_id = req.query.department_id;

  const users = await listUsers(opts);
  // Strip sensitive fields for response
  return res.json({
    users: users.map(u => ({
      id:           u.id,
      name:         u.name,
      email:        u.email,
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
 * Returns AI routing configuration (from system settings or hardcoded defaults).
 */
async function getAIConfig(req, res) {
  // For now return sensible defaults — can be stored in a system_config table later
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
  // TODO: persist to a system_config table in Supabase
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
  listAllComplaints,
  getExceptions,
  overrideAI,
  retryAI,
  getAuditLogs,
  getUsers,
  getDepartmentsHandler,
  getAIConfig,
  updateAIConfig
};
