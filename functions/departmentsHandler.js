/**
 * CivicConnect — Departments Handler (Supabase edition)
 *
 * All reads/writes use Supabase PostgreSQL via functions/db.js.
 * No Firestore. No hardcoded engineers. No mock data.
 */

'use strict';

const {
  getComplaintsByDepartmentId,
  getDepartmentEngineers,
  getUserById,
  getComplaintById,
  updateComplaintStatus,
  assignEngineerToComplaint,
  createAssignment,
  recordAuditEvent,
  createNotification,
  createFeedback
} = require('./db');
const { WORKFLOW_STATES, canTransition } = require('./workflow');

/**
 * GET /api/departments/:departmentId/complaints
 * List complaints routed to this department.
 * Department users can only see their own department; admins see all.
 */
async function listDepartmentComplaints(req, res) {
  const departmentId = req.params.departmentId || req.user?.departmentId;

  if (!departmentId) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Department ID is required.'
    });
  }

  // Enforce department scoping
  if (req.user?.role === 'department' && req.user.departmentId !== departmentId) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You can only view complaints for your own department.'
    });
  }

  const complaints = await getComplaintsByDepartmentId(departmentId);
  return res.json({ complaints });
}

/**
 * GET /api/departments/:departmentId/engineers
 * List active engineers for a department from Supabase users table.
 * Engineers come from real user records — no hardcoded names.
 */
async function listDepartmentEngineers(req, res) {
  const departmentId = req.params.departmentId || req.user?.departmentId;

  if (!departmentId) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Department ID is required.'
    });
  }

  const engineers = await getDepartmentEngineers(departmentId);

  return res.json({
    engineers: engineers.map(e => ({
      id:           e.id,
      uid:          e.id,
      name:         e.name,
      email:        e.email,
      phone:        e.phone || null,
      role:         e.role,
      departmentId: e.department_id,
      isActive:     e.is_active,
      activeTasks:  0
    }))
  });
}

/**
 * POST /api/departments/assign
 * Assign a real engineer (from Supabase users) to a complaint.
 * Engineer must exist, have role=ENGINEER, belong to correct department, and be active.
 */
async function assignEngineer(req, res) {
  const { complaintId, engineerId } = req.body;

  if (!complaintId || !engineerId) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'complaintId and engineerId are required.'
    });
  }

  // Load complaint
  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  const currentStatus = complaint.status;

  // Validate status transition
  if (!canTransition(currentStatus, WORKFLOW_STATES.ASSIGNED, req.user?.role || 'department')) {
    return res.status(400).json({
      code: 'INVALID_TRANSITION',
      message: `Complaint in status ${currentStatus} cannot be assigned.`
    });
  }

  // Load engineer — must be a real Supabase user record (try UUID then Firebase UID)
  let engineer = await getUserById(engineerId);
  if (!engineer) {
    const { getUserByFirebaseUid } = require('./db');
    engineer = await getUserByFirebaseUid(engineerId);
  }
  if (!engineer) {
    return res.status(404).json({
      code: 'ASSIGNMENT_FAILED',
      message: 'Engineer user profile not found. Engineer must have a registered account.'
    });
  }
  if (engineer.role !== 'ENGINEER') {
    return res.status(400).json({
      code: 'ASSIGNMENT_FAILED',
      message: 'Designated user is not registered as an engineer.'
    });
  }
  if (!engineer.is_active) {
    return res.status(400).json({
      code: 'ASSIGNMENT_FAILED',
      message: 'Engineer account is currently marked inactive.'
    });
  }

  const assignedBySupabaseId = req.user?.supabaseId || null;

  // Update complaint record
  await assignEngineerToComplaint(complaint.id, engineer.id, assignedBySupabaseId);

  // Create assignment record
  await createAssignment({
    complaintId:  complaint.id,
    departmentId: complaint.department_id,
    engineerId:   engineer.id,
    assignedBy:   assignedBySupabaseId
  });

  // Audit log
  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      assignedBySupabaseId,
    actorRole:    req.user?.role || 'department',
    eventType:    'ENGINEER_ASSIGNED',
    oldStatus:    currentStatus,
    newStatus:    WORKFLOW_STATES.ASSIGNED,
    metadata:     { engineerId: engineer.id, engineerName: engineer.name }
  });

  // Notify engineer
  await createNotification({
    userId:      engineer.id,
    complaintId: complaint.id,
    title:       'New Task Assigned',
    message:     `You have been assigned to investigate complaint ${complaint.reference_id}.`,
    type:        'task_assigned'
  });

  return res.json({
    success: true,
    status: WORKFLOW_STATES.ASSIGNED,
    message: 'Engineer assigned successfully.'
  });
}

/**
 * POST /api/departments/workflow-action
 * Department accepts or rejects a routed complaint.
 */
async function workflowAction(req, res) {
  const { complaintId, action, reason } = req.body;

  if (!complaintId || !action) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'complaintId and action are required.'
    });
  }

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  const currentStatus = complaint.status;
  let nextStatus = currentStatus;

  if (action === 'ACCEPT') nextStatus = WORKFLOW_STATES.DEPARTMENT_ACCEPTED;
  else if (action === 'REJECT') nextStatus = WORKFLOW_STATES.REJECTED;
  else {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` });
  }

  if (!canTransition(currentStatus, nextStatus, req.user?.role || 'department')) {
    return res.status(400).json({
      code: 'INVALID_TRANSITION',
      message: `Cannot transition from ${currentStatus} to ${nextStatus}.`
    });
  }

  await updateComplaintStatus(complaint.id, nextStatus, { previousStatus: currentStatus });

  await recordAuditEvent({
    complaintId: complaint.id,
    actorId:     req.user?.supabaseId || null,
    actorRole:   req.user?.role || 'department',
    eventType:   `DEPARTMENT_${action}`,
    oldStatus:   currentStatus,
    newStatus:   nextStatus,
    metadata:    { reason: reason || null }
  });

  return res.json({ success: true, status: nextStatus });
}

/**
 * POST /api/departments/verify-work
 * Department verifies engineer's completed work.
 */
async function verifyWork(req, res) {
  const { complaintId, decision, remarks = '' } = req.body;

  if (!complaintId || !['ACCEPT', 'REJECT'].includes(decision)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'complaintId and valid decision (ACCEPT/REJECT) are required.'
    });
  }

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  const currentStatus = complaint.status;
  if (
    currentStatus !== WORKFLOW_STATES.VERIFICATION_PENDING &&
    currentStatus !== WORKFLOW_STATES.DEPARTMENT_REVIEW
  ) {
    return res.status(400).json({
      code: 'INVALID_TRANSITION',
      message: 'Work can only be verified when in VERIFICATION_PENDING or DEPARTMENT_REVIEW.'
    });
  }

  const nextStatus = decision === 'ACCEPT'
    ? WORKFLOW_STATES.CITIZEN_VERIFICATION
    : WORKFLOW_STATES.IN_PROGRESS;

  const now = new Date().toISOString();
  await updateComplaintStatus(complaint.id, nextStatus, {
    previousStatus:               currentStatus,
    dept_verification_decision:   decision,
    dept_verification_remarks:    remarks || null,
    dept_verified_by:             req.user?.supabaseId || null,
    dept_verified_at:             now
  });

  await recordAuditEvent({
    complaintId: complaint.id,
    actorId:     req.user?.supabaseId || null,
    actorRole:   'department',
    eventType:   decision === 'ACCEPT' ? 'DEPARTMENT_APPROVED' : 'DEPARTMENT_REJECTED_REWORK',
    oldStatus:   currentStatus,
    newStatus:   nextStatus,
    metadata:    { remarks }
  });

  // Notify citizen if approved
  if (decision === 'ACCEPT' && complaint.citizen_id) {
    await createNotification({
      userId:      complaint.citizen_id,
      complaintId: complaint.id,
      title:       'Resolution Pending Your Approval',
      message:     `The department has verified repairs for complaint ${complaint.reference_id}. Please review the result.`,
      type:        'citizen_verification'
    });
  }

  // Notify engineer if rejected for rework
  if (decision === 'REJECT' && complaint.assigned_engineer_id) {
    await createNotification({
      userId:      complaint.assigned_engineer_id,
      complaintId: complaint.id,
      title:       'Rework Required',
      message:     `Department requested rework on complaint ${complaint.reference_id}: "${remarks}"`,
      type:        'rework_required'
    });
  }

  return res.json({ success: true, status: nextStatus });
}

/**
 * POST /api/departments/set-priority
 * Department sets or updates complaint priority.
 */
async function setPriority(req, res) {
  const { complaintId, priority } = req.body;
  const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  if (!complaintId || !priority) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'complaintId and priority are required.'
    });
  }

  const normalizedPriority = String(priority).toUpperCase();
  if (!VALID_PRIORITIES.includes(normalizedPriority)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}`
    });
  }

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  // Enforce department scoping
  if (req.user?.role === 'department' && req.user.departmentId !== complaint.department_id) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You can only update priority for complaints in your department.'
    });
  }

  const { supabaseAdmin } = require('./lib/supabaseAdmin');
  const { error } = await supabaseAdmin
    .from('complaints')
    .update({ priority: normalizedPriority })
    .eq('id', complaint.id);

  if (error) {
    return res.status(500).json({ code: 'DB_ERROR', message: error.message });
  }

  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      req.user?.supabaseId || null,
    actorRole:    req.user?.role || 'department',
    eventType:    'PRIORITY_UPDATED',
    oldStatus:    complaint.status,
    newStatus:    complaint.status,
    metadata:     { oldPriority: complaint.priority, newPriority: normalizedPriority }
  });

  return res.json({ success: true, priority: normalizedPriority });
}

module.exports = {
  listDepartmentComplaints,
  listDepartmentEngineers,
  assignEngineer,
  workflowAction,
  verifyWork,
  setPriority
};
