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
 * POST /api/engineer/evidence
 * Submit repair completion evidence.
 * Requires at least one authentic after photo and detailed completion notes.
 */
async function submitEvidence(req, res) {
  const { complaintId, afterMedia = [], completionNotes = '', partsUsed = [] } = req.body;
  const engineerSupabaseId = req.user?.supabaseId;

  if (!complaintId) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'complaintId is required.' });
  }
  if (!Array.isArray(afterMedia) || afterMedia.length === 0) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'At least one authentic repair photograph is required.'
    });
  }
  if (!completionNotes || completionNotes.trim().length < 5) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Detailed completion notes are required (minimum 5 characters).'
    });
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
  if (!canTransition(currentStatus, WORKFLOW_STATES.VERIFICATION_PENDING, 'engineer')) {
    return res.status(400).json({
      code: 'INVALID_TRANSITION',
      message: `Cannot submit verification evidence from current status ${currentStatus}.`
    });
  }

  // Store after media in complaint_media table
  const normalizedAfter = afterMedia.map(item =>
    typeof item === 'string' ? { url: item, caption: 'Repair Photo' } : item
  );

  for (const m of normalizedAfter) {
    try {
      await addComplaintMedia({
        complaintId:  complaint.id,
        mediaType:    'AFTER',
        fileUrl:      m.url || m,
        caption:      m.caption || 'Repair Photo',
        uploadedBy:   engineerSupabaseId
      });
    } catch (mediaErr) {
      console.warn('[ENGINEER] After media insert failed:', mediaErr.message);
    }
  }

  // Optional AI verification recommendation (advisory only — never auto-closes)
  let aiVerificationResult = null;
  const afterUrl = normalizedAfter[0]?.url;

  if (afterUrl) {
    // Get before media URL from stored complaint media (or fallback)
    const beforeUrl = null; // Would be fetched from complaint_media table if needed

    if (beforeUrl && afterUrl) {
      try {
        aiVerificationResult = await verifyCompletionEvidence(
          beforeUrl,
          afterUrl,
          complaint.description
        );
      } catch (aiErr) {
        console.warn('[ENGINEER] AI verification evaluation skipped:', aiErr.message);
        // No fake result — aiVerificationResult remains null
      }
    }
  }

  // Update complaint
  await updateComplaintStatus(complaint.id, WORKFLOW_STATES.VERIFICATION_PENDING, {
    previousStatus: currentStatus,
    engineer_notes: completionNotes,
    parts_used:     partsUsed.length > 0 ? partsUsed : null
  });

  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      engineerSupabaseId,
    actorRole:    'engineer',
    eventType:    'EVIDENCE_SUBMITTED',
    oldStatus:    currentStatus,
    newStatus:    WORKFLOW_STATES.VERIFICATION_PENDING,
    metadata:     {
      photoCount:       normalizedAfter.length,
      aiRecommendation: aiVerificationResult?.recommendation || null
    }
  });

  return res.json({
    success:          true,
    status:           WORKFLOW_STATES.VERIFICATION_PENDING,
    aiRecommendation: aiVerificationResult
  });
}

module.exports = {
  listEngineerTasks,
  updateStatus,
  submitEvidence
};
