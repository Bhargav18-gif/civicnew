/**
 * CivicConnect — Engineer Handler (Supabase edition)
 *
 * All reads/writes use Supabase PostgreSQL via functions/db.js.
 * Engineers only see complaints assigned to their Supabase user UUID.
 * No Firestore. No mock data.
 */

'use strict';

const {
  getComplaintsByEngineerId,
  getComplaintById,
  updateComplaintStatus,
  addComplaintMedia,
  recordAuditEvent
} = require('./db');
const { WORKFLOW_STATES, canTransition } = require('./workflow');
const { verifyCompletionEvidence } = require('./ai');

/**
 * GET /api/engineer/tasks
 * Engineer sees only complaints assigned to their Supabase user UUID.
 * Database-level filtering — never loads all complaints and filters in JS.
 */
async function listEngineerTasks(req, res) {
  const engineerSupabaseId = req.user?.supabaseId;

  if (!engineerSupabaseId) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication required. Engineer Supabase profile not found.'
    });
  }

  const tasks = await getComplaintsByEngineerId(engineerSupabaseId);
  return res.json({ tasks });
}

/**
 * POST /api/engineer/status
 * Update complaint workflow status (engineer state machine transitions).
 * ASSIGNED → ACCEPTED_BY_ENGINEER → EN_ROUTE → ON_SITE → IN_PROGRESS
 */
async function updateStatus(req, res) {
  const { complaintId, status: nextStatus, notes = '' } = req.body;
  const engineerSupabaseId = req.user?.supabaseId;

  if (!complaintId || !nextStatus) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'complaintId and target status are required.'
    });
  }

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  // Verify ownership — must be the assigned engineer (or admin)
  if (
    req.user?.role !== 'admin' &&
    complaint.assigned_engineer_id !== engineerSupabaseId
  ) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You are not the designated engineer for this task.'
    });
  }

  const currentStatus = complaint.status;

  if (!canTransition(currentStatus, nextStatus, 'engineer')) {
    return res.status(400).json({
      code: 'INVALID_TRANSITION',
      message: `Invalid transition from ${currentStatus} to ${nextStatus} for role engineer.`
    });
  }

  await updateComplaintStatus(complaint.id, nextStatus, { previousStatus: currentStatus });

  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      engineerSupabaseId,
    actorRole:    'engineer',
    eventType:    `ENGINEER_STATUS_${nextStatus}`,
    oldStatus:    currentStatus,
    newStatus:    nextStatus,
    metadata:     { notes }
  });

  return res.json({ success: true, status: nextStatus });
}

/**
 * POST /api/engineer/evidence or /api/engineer/report
 * Submit repair completion evidence or field work report.
 */
async function submitEvidence(req, res) {
  const {
    complaintId,
    afterMedia = [],
    beforeMedia = [],
    completionNotes = '',
    workDescription = '',
    findings = '',
    actionTaken = '',
    materialsUsed = [],
    additionalNotes = '',
    gpsConfirmation = null,
    workStatus = WORKFLOW_STATES.VERIFICATION_PENDING
  } = req.body;

  const engineerSupabaseId = req.user?.supabaseId;

  if (!complaintId) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'complaintId is required.' });
  }

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  if (
    req.user?.role !== 'admin' &&
    complaint.assigned_engineer_id !== engineerSupabaseId
  ) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You are not assigned to this complaint.'
    });
  }

  const currentStatus = complaint.status;

  // Determine target status
  let nextStatus = workStatus === 'IN_PROGRESS'
    ? WORKFLOW_STATES.IN_PROGRESS
    : WORKFLOW_STATES.VERIFICATION_PENDING;

  if (nextStatus === WORKFLOW_STATES.VERIFICATION_PENDING) {
    if (!canTransition(currentStatus, WORKFLOW_STATES.VERIFICATION_PENDING, 'engineer')) {
      return res.status(400).json({
        code: 'INVALID_TRANSITION',
        message: `Cannot submit verification evidence from current status ${currentStatus}.`
      });
    }
  }

  // Format structured notes
  const noteParts = [];
  if (workDescription) noteParts.push(`[Work Performed]: ${workDescription}`);
  if (findings)        noteParts.push(`[Findings]: ${findings}`);
  if (actionTaken)     noteParts.push(`[Action Taken]: ${actionTaken}`);
  if (materialsUsed && materialsUsed.length > 0) {
    const matStr = Array.isArray(materialsUsed) ? materialsUsed.join(', ') : materialsUsed;
    noteParts.push(`[Materials Used]: ${matStr}`);
  }
  if (additionalNotes) noteParts.push(`[Additional Notes]: ${additionalNotes}`);
  if (completionNotes && !workDescription) noteParts.push(completionNotes);

  const formattedNotes = noteParts.join('\n\n') || completionNotes || 'Field work report submitted.';

  // 1. Store before media in complaint_media table
  const normalizedBefore = (beforeMedia || []).map(item =>
    typeof item === 'string' ? { url: item, caption: 'Before Repair Photo' } : item
  );
  for (const m of normalizedBefore) {
    try {
      await addComplaintMedia({
        complaintId:  complaint.id,
        mediaType:    'BEFORE',
        fileUrl:      m.url || m,
        caption:      m.caption || 'Before Repair Photo',
        uploadedBy:   engineerSupabaseId
      });
    } catch (mediaErr) {
      console.warn('[ENGINEER] Before media insert failed:', mediaErr.message);
    }
  }

  // 2. Store after media in complaint_media table
  const normalizedAfter = (afterMedia || []).map(item =>
    typeof item === 'string' ? { url: item, caption: 'After Repair Photo' } : item
  );
  for (const m of normalizedAfter) {
    try {
      await addComplaintMedia({
        complaintId:  complaint.id,
        mediaType:    'AFTER',
        fileUrl:      m.url || m,
        caption:      m.caption || 'After Repair Photo',
        uploadedBy:   engineerSupabaseId
      });
    } catch (mediaErr) {
      console.warn('[ENGINEER] After media insert failed:', mediaErr.message);
    }
  }

  // Update complaint
  const partsArray = Array.isArray(materialsUsed)
    ? materialsUsed
    : (typeof materialsUsed === 'string' && materialsUsed.trim() ? [materialsUsed] : []);

  await updateComplaintStatus(complaint.id, nextStatus, {
    previousStatus: currentStatus,
    engineer_notes: formattedNotes,
    parts_used:     partsArray.length > 0 ? partsArray : null
  });

  // Record audit event
  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      engineerSupabaseId,
    actorRole:    'engineer',
    eventType:    nextStatus === WORKFLOW_STATES.VERIFICATION_PENDING ? 'EVIDENCE_SUBMITTED' : 'WORK_REPORT_UPDATED',
    oldStatus:    currentStatus,
    newStatus:    nextStatus,
    metadata:     {
      photoCount:       normalizedAfter.length + normalizedBefore.length,
      beforeCount:      normalizedBefore.length,
      afterCount:       normalizedAfter.length,
      gpsConfirmation:  gpsConfirmation || null
    }
  });

  return res.json({
    success: true,
    status:  nextStatus,
    notes:   formattedNotes
  });
}

/**
 * POST /api/engineer/arrival
 * Confirm engineer GPS arrival on site.
 */
async function confirmArrival(req, res) {
  const { complaintId, gps } = req.body;
  const engineerSupabaseId = req.user?.supabaseId;

  if (!complaintId) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'complaintId is required.' });
  }

  const complaint = await getComplaintById(complaintId);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  if (
    req.user?.role !== 'admin' &&
    complaint.assigned_engineer_id !== engineerSupabaseId
  ) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'You are not assigned to this complaint.'
    });
  }

  // Record audit log for GPS arrival
  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      engineerSupabaseId,
    actorRole:    'engineer',
    eventType:    'ENGINEER_ARRIVED_GPS',
    oldStatus:    complaint.status,
    newStatus:    complaint.status,
    metadata:     {
      gps: gps || null,
      confirmedAt: new Date().toISOString()
    }
  });

  return res.json({
    success: true,
    message: 'Arrival location confirmed.',
    gps
  });
}

/**
 * GET /api/engineer/tasks/:id
 * Retrieve detail of a single task assigned to this engineer.
 * Rejects with 403 if assigned_engineer_id !== req.user.supabaseId (unless admin).
 */
async function getEngineerTaskDetail(req, res) {
  const { id } = req.params;
  const engineerSupabaseId = req.user?.supabaseId;

  if (!id) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Task ID is required.' });
  }

  const complaint = await getComplaintById(id);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found.' });
  }

  if (
    req.user?.role !== 'admin' &&
    complaint.assigned_engineer_id !== engineerSupabaseId
  ) {
    return res.status(403).json({
      code: 'FORBIDDEN',
      message: 'Access denied: You are not authorized to view this complaint.'
    });
  }

  return res.json({ complaint });
}

module.exports = {
  listEngineerTasks,
  getEngineerTaskDetail,
  updateStatus,
  submitEvidence,
  confirmArrival
};

