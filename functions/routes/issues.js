/**
 * Issues Routes (Supabase edition)
 * Feedback and stats from Supabase. No Firestore.
 */

'use strict';

const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getComplaintById: dbGetComplaintById,
  updateComplaintStatus,
  createFeedback,
  recordAuditEvent
} = require('../db');
const { getComplaintById } = require('../complaintsHandler');
const { WORKFLOW_STATES } = require('../workflow');

// GET /api/issues/stats — aggregated from Supabase
router.get('/stats', async (req, res) => {
  try {
    const stats = await getAdminStats();
    return res.json({
      success: true,
      stats: {
        total:               stats.total,
        open:                stats.pending,
        inProgress:          stats.inProgress,
        verificationPending: 0, // included in inProgress
        closed:              stats.resolved,
        reopened:            stats.stats?.reopened || 0
      },
      byDepartment: []  // TODO: add per-department breakdown
    });
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// GET /api/issues/department-stats
router.get('/department-stats', async (req, res) => {
  try {
    const stats = await getAdminStats();
    return res.json({ success: true, departments: [], stats });
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// GET /api/issues/:id — single complaint
router.get('/:id', getComplaintById);

// POST /api/issues/:id/feedback — citizen feedback on resolution
router.post('/:id/feedback', async (req, res) => {
  const id = req.params.id;
  const { rating, comment, resolutionStatus } = req.body;

  const complaint = await dbGetComplaintById(id);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  const currentStatus = complaint.status;
  const isReopened = resolutionStatus === 'Not Resolved';
  const nextStatus = isReopened ? WORKFLOW_STATES.REOPENED : WORKFLOW_STATES.CLOSED;

  await updateComplaintStatus(complaint.id, nextStatus, {
    previousStatus:                   currentStatus,
    citizen_verification_decision:    isReopened ? 'REOPENED' : 'APPROVED',
    citizen_verification_feedback:    comment || null,
    citizen_verified_at:              new Date().toISOString()
  });

  try {
    await createFeedback({
      complaintId:   complaint.id,
      modelVersion:  null,
      aiPrediction:  null,
      aiConfidence:  null,
      humanDecision: { rating: rating || null, resolutionStatus },
      humanUserId:   req.user?.supabaseId || null,
      reason:        comment || null
    });
  } catch (feedbackErr) {
    console.warn('[ISSUES] Feedback record creation failed:', feedbackErr.message);
  }

  await recordAuditEvent({
    complaintId:  complaint.id,
    actorId:      req.user?.supabaseId || null,
    actorRole:    'citizen',
    eventType:    isReopened ? 'CITIZEN_REOPENED' : 'CITIZEN_APPROVED',
    oldStatus:    currentStatus,
    newStatus:    nextStatus,
    metadata:     { rating, comment, resolutionStatus }
  });

  return res.json({ success: true, status: nextStatus });
});

module.exports = router;
