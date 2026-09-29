/**
 * Departments Routes (Supabase edition)
 * All data comes from Supabase PostgreSQL via db.js.
 * No Firestore references.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { requireRole, requireDepartment } = require('../authMiddleware');
const { listDepartments } = require('../db');
const {
  listDepartmentComplaints,
  listDepartmentEngineers,
  assignEngineer,
  workflowAction,
  verifyWork
} = require('../departmentsHandler');

// List all canonical departments from Supabase
router.get('/', async (req, res) => {
  try {
    const departments = await listDepartments();
    return res.json(departments);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Department-specific task and engineer rosters
router.get('/:departmentId/complaints', requireDepartment, async (req, res) => {
  try {
    return await listDepartmentComplaints(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

router.get('/:departmentId/engineers', requireDepartment, async (req, res) => {
  try {
    return await listDepartmentEngineers(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Protected actions
router.post('/assign', requireRole('department', 'admin'), async (req, res) => {
  try {
    return await assignEngineer(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

router.post('/workflow-action', requireRole('department', 'admin'), async (req, res) => {
  try {
    return await workflowAction(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

router.post('/verify-work', requireRole('department', 'admin'), async (req, res) => {
  try {
    return await verifyWork(req, res);
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

module.exports = router;
