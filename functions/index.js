/**
 * CivicConnect — Backend API Entry Point (Supabase edition)
 *
 * Architecture:
 *   Firebase Authentication → identity verification
 *   Supabase PostgreSQL     → all application data
 *
 * The Express app is exported both as:
 * - A Firebase Cloud Function (for Firebase Hosting rewrites)
 * - A standalone app (for server/index.js local dev server)
 */

'use strict';

const express = require('express');
const cors    = require('cors');

// ─── Firebase Admin (Auth only) ──────────────────────────────────────────────
const { authAdmin } = require('./firebaseInit');

// ─── Auth Middleware (Supabase user lookup) ───────────────────────────────────
const {
  setAuthAdmin,
  authenticateUser,
  requireAuth,
  requireRole
} = require('./authMiddleware');

// Wire Firebase Admin into auth middleware
setAuthAdmin(authAdmin);

// ─── Route Handlers ───────────────────────────────────────────────────────────
const {
  submitComplaint,
  getComplaintById,
  trackPublicComplaint,
  listUserComplaints,
  listPublicMapComplaints
} = require('./complaintsHandler');

const {
  listEngineerTasks,
  updateStatus,
  submitEvidence
} = require('./engineerHandler');

const {
  updateComplaintStatus,
  recordAuditEvent
} = require('./db');

const { WORKFLOW_STATES } = require('./workflow');

// ─── Modular Route Modules ────────────────────────────────────────────────────
const adminRouter       = require('./routes/admin');
const departmentsRouter = require('./routes/departments');
const issuesRouter      = require('./routes/issues');
const aiRouter          = require('./routes/ai');

// ─── Express App ──────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Global authentication resolver — attaches req.user from Firebase token + Supabase lookup
app.use(authenticateUser);

// ─── API Router ───────────────────────────────────────────────────────────────
const apiRouter = express.Router();

// Health check
apiRouter.get(['/', '/health'], (req, res) => {
  res.status(200).json({
    status:    'ok',
    service:   'CivicConnect API',
    database:  'Supabase PostgreSQL',
    auth:      'Firebase Authentication',
    timestamp: new Date().toISOString()
  });
});

// ─── Auth Sync Route ──────────────────────────────────────────────────────────
// POST /api/auth/sync
// Called by frontend after Firebase Auth login/register.
// Creates or updates Supabase user record from Firebase UID.
// Returns authoritative role and profile from Supabase.
apiRouter.post('/auth/sync', requireAuth, async (req, res) => {
  try {
    const { upsertUser, touchUserLogin } = require('./db');
    const { name, email } = req.body;
    const firebaseUid = req.user.uid;

    const supabaseUser = await upsertUser({
      firebaseUid,
      name:         name || req.user.name || 'Citizen',
      email:        email || req.user.email || '',
      role:         req.user.role?.toUpperCase() || 'CITIZEN',
      departmentId: req.user.departmentId || null
    });

    await touchUserLogin(firebaseUid);

    return res.json({
      success: true,
      user: {
        id:            supabaseUser.id,
        firebase_uid:  supabaseUser.firebase_uid,
        name:          supabaseUser.name,
        email:         supabaseUser.email,
        role:          supabaseUser.role,
        department_id: supabaseUser.department_id,
        is_active:     supabaseUser.is_active
      }
    });
  } catch (err) {
    console.error('[AUTH SYNC]', err.message);
    return res.status(500).json({ code: 'SYNC_ERROR', message: err.message });
  }
});

// Modular routers
apiRouter.use('/admin',       adminRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/issues',      issuesRouter);
apiRouter.use('/ai',          aiRouter);

// Citizen & Public Complaint Routes
apiRouter.post(['/complaints', '/submit-complaint'], submitComplaint);
apiRouter.get('/complaints/:id', getComplaintById);
apiRouter.get(['/public/track/:refId', '/track/:refId'], trackPublicComplaint);
apiRouter.get('/public/map-complaints', listPublicMapComplaints);
apiRouter.get('/user/complaints', requireAuth, listUserComplaints);

// User notifications — from Supabase notifications table
apiRouter.get('/user/notifications', requireAuth, async (req, res) => {
  try {
    const { getNotificationsForUser } = require('./db');
    if (!req.user?.supabaseId) return res.json({ notifications: [] });
    const notifications = await getNotificationsForUser(req.user.supabaseId);
    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Mark notification as read
apiRouter.post('/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const { markNotificationRead } = require('./db');
    await markNotificationRead(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// User profile by Firebase UID
apiRouter.get('/users/:uid', requireAuth, async (req, res) => {
  try {
    const { getUserByFirebaseUid } = require('./db');
    const user = await getUserByFirebaseUid(req.params.uid);
    if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});


// Citizen verification / resolution
apiRouter.post(['/complaints/:id/citizen-verify', '/verify-completion'], async (req, res) => {
  const id = req.params.id || req.body.complaintId;
  const { decision, reason, feedback } = req.body;

  if (!id) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Complaint ID is required.' });
  }

  try {
    const { getComplaintById: dbGetComplaint } = require('./db');
    const complaint = await dbGetComplaint(id);

    if (!complaint) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
    }

    const currentStatus = complaint.status;
    const isApproved = decision === 'APPROVE' || decision === 'verified' || req.body.status === 'verified';
    const nextStatus = isApproved ? WORKFLOW_STATES.CLOSED : WORKFLOW_STATES.REOPENED;

    await updateComplaintStatus(complaint.id, nextStatus, {
      previousStatus:                 currentStatus,
      citizen_verification_decision:  isApproved ? 'APPROVED' : 'REOPENED',
      citizen_verification_feedback:  feedback || reason || null,
      citizen_verified_at:            new Date().toISOString()
    });

    await recordAuditEvent({
      complaintId:  complaint.id,
      actorId:      req.user?.supabaseId || null,
      actorRole:    'citizen',
      eventType:    isApproved ? 'CITIZEN_APPROVED' : 'CITIZEN_REOPENED',
      oldStatus:    currentStatus,
      newStatus:    nextStatus,
      metadata:     { feedback: feedback || reason || null }
    });

    return res.json({ success: true, status: nextStatus });
  } catch (err) {
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: err.message });
  }
});

// Engineer Workflow Routes
apiRouter.get('/engineer/tasks',    requireRole('engineer', 'admin'), listEngineerTasks);
apiRouter.post('/engineer/status',  requireRole('engineer', 'admin'), updateStatus);
apiRouter.post('/engineer/evidence', requireRole('engineer', 'admin'), submitEvidence);

// Mount under /api (for Hosting rewrites) and / (for direct function URLs)
app.use('/api', apiRouter);
app.use('/',    apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code:    'NOT_FOUND',
      message: `API endpoint '${req.method} ${req.originalUrl || req.url}' was not found.`
    }
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[UNCAUGHT SERVER ERROR]', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    error: {
      code:    err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected internal server error occurred.'
    }
  });
});

// ─── Firebase Cloud Function export ──────────────────────────────────────────
let apiFunction = null;
try {
  const functions = require('firebase-functions');
  apiFunction = functions.https.onRequest(app);
} catch (_) {
  apiFunction = (req, res) => app(req, res);
}

exports.api = apiFunction;
module.exports = { app, api: exports.api };
