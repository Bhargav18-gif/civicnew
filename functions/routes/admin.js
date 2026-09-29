/**
 * Admin Routes (Supabase edition)
 * All stats and data come from Supabase PostgreSQL via db.js.
 * No Firestore references.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireRole } = require('../authMiddleware');
const modelService = require('../services/modelService');
const {
  getAdminStats,
  listAllComplaints,
  getExceptions,
  overrideAI,
  retryAI,
  getAuditLogs,
  getAIConfig,
  updateAIConfig,
  getUsers,
  getDepartmentsHandler
} = require('../adminHandler');

// All admin routes require ADMIN role
router.use(requireRole('admin'));

// Statistics — from Supabase aggregation
router.get('/stats', async (req, res) => {
  try {
    return await getAdminStats(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// All complaints listing
router.get('/issues', async (req, res) => {
  try {
    return await listAllComplaints(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Exception queues (AI_FAILED, PENDING_ADMIN_REVIEW, REOPENED)
router.get('/exceptions', async (req, res) => {
  try {
    return await getExceptions(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Users list
router.get('/users', async (req, res) => {
  try {
    return await getUsers(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Departments list
router.get('/departments', async (req, res) => {
  try {
    return await getDepartmentsHandler(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Model versions — from on-disk artifacts
router.get('/model/versions', async (req, res) => {
  try {
    const data = await modelService.getModelVersions();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// AI routing configuration
router.get('/automation-config', async (req, res) => {
  try {
    return await getAIConfig(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});
router.post('/automation-config', async (req, res) => {
  try {
    return await updateAIConfig(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Audit logs — from Supabase
router.get('/audit-logs', async (req, res) => {
  try {
    return await getAuditLogs(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Complaint exception triage
router.post('/issues/:id/override-ai', async (req, res) => {
  try {
    return await overrideAI(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});
router.post('/issues/:id/retry-ai', async (req, res) => {
  try {
    return await retryAI(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

module.exports = router;
