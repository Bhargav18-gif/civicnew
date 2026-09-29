/**
 * CivicConnect — Supabase Database Access Layer (Backend)
 *
 * This module provides a clean, Supabase-based replacement for all Firestore
 * operations previously in firebaseInit.js.
 *
 * All operations use the service-role key (bypasses RLS) because this code
 * runs server-side only. Authorization is handled at the API handler level.
 *
 * Firebase Authentication is NOT replaced — this is purely the database layer.
 */

'use strict';

const { supabaseAdmin } = require('./lib/supabaseAdmin');

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up a user by Firebase UID. Returns null if not found.
 */
async function getUserByFirebaseUid(firebaseUid) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`DB_ERROR: Failed to fetch user by firebase_uid: ${error.message}`);
  }
  return data;
}

/**
 * Look up a user by their internal Supabase UUID.
 */
async function getUserById(userId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`DB_ERROR: Failed to fetch user by id: ${error.message}`);
  }
  return data;
}

/**
 * Create or update a user record linked to a Firebase UID.
 * Called during auth flow to sync Firebase user → Supabase users table.
 */
async function upsertUser({ firebaseUid, name, email, role = 'CITIZEN', phone = null, departmentId = null }) {
  const payload = {
    firebase_uid: firebaseUid,
    name,
    email,
    role: role.toUpperCase(),
    phone,
    department_id: departmentId,
    is_active: true,
    last_login_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(payload, { onConflict: 'firebase_uid', ignoreDuplicates: false })
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to upsert user: ${error.message}`);
  return data;
}

/**
 * Update last_login_at for a user.
 */
async function touchUserLogin(firebaseUid) {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('firebase_uid', firebaseUid);

  if (error) console.warn('[DB] touchUserLogin error:', error.message);
}

/**
 * List active engineers for a department.
 */
async function getDepartmentEngineers(departmentId) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('role', 'ENGINEER')
    .eq('department_id', departmentId)
    .eq('is_active', true);

  if (error) throw new Error(`DB_ERROR: Failed to fetch engineers: ${error.message}`);
  return data || [];
}

/**
 * List all users (admin use).
 */
async function listUsers(opts = {}) {
  let q = supabaseAdmin.from('users').select('*');
  if (opts.role) q = q.eq('role', opts.role.toUpperCase());
  if (opts.department_id) q = q.eq('department_id', opts.department_id);
  q = q.order('created_at', { ascending: false });

  const { data, error } = await q;
  if (error) throw new Error(`DB_ERROR: Failed to list users: ${error.message}`);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLAINTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new complaint record. Returns the created row.
 */
async function createComplaint(payload) {
  const {
    referenceId, citizenId, title, description, category,
    priority = 'MEDIUM', latitude, longitude, address,
    departmentId, slaDeadline
  } = payload;

  const { data, error } = await supabaseAdmin
    .from('complaints')
    .insert({
      reference_id:  referenceId,
      citizen_id:    citizenId,
      title,
      description,
      category,
      priority:      priority.toUpperCase(),
      status:        'SUBMITTED',
      latitude,
      longitude,
      address,
      department_id: departmentId || null,
      routing_method: 'PENDING',
      sla_deadline:  slaDeadline || null,
      sla_breached:  false
    })
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to create complaint: ${error.message}`);
  return data;
}

/**
 * Fetch a single complaint by referenceId or UUID.
 */
async function getComplaintById(id) {
  // Try reference_id first (human-readable), then UUID
  let { data, error } = await supabaseAdmin
    .from('complaints')
    .select('*')
    .eq('reference_id', id)
    .single();

  if (error?.code === 'PGRST116' || !data) {
    const res = await supabaseAdmin
      .from('complaints')
      .select('*')
      .eq('id', id)
      .single();
    data = res.data;
    error = res.error;
  }

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`DB_ERROR: ${error.message}`);
  }
  return data;
}

/**
 * List complaints for a citizen by their Supabase user UUID.
 */
async function getComplaintsByCitizenId(citizenId) {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('*')
    .eq('citizen_id', citizenId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`DB_ERROR: Failed to fetch citizen complaints: ${error.message}`);
  return data || [];
}

/**
 * List complaints routed to a department.
 */
async function getComplaintsByDepartmentId(departmentId) {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('*')
    .eq('department_id', departmentId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`DB_ERROR: Failed to fetch department complaints: ${error.message}`);
  return data || [];
}

/**
 * List complaints assigned to a specific engineer.
 */
async function getComplaintsByEngineerId(engineerId) {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('*')
    .eq('assigned_engineer_id', engineerId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`DB_ERROR: Failed to fetch engineer complaints: ${error.message}`);
  return data || [];
}

/**
 * List ALL complaints (admin).
 */
async function getAllComplaints(opts = {}) {
  let q = supabaseAdmin.from('complaints').select('*');
  if (opts.status) q = q.eq('status', opts.status);
  q = q.order('created_at', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw new Error(`DB_ERROR: Failed to list complaints: ${error.message}`);
  return data || [];
}

/**
 * Update complaint status with workflow transition.
 */
async function updateComplaintStatus(complaintId, nextStatus, extras = {}) {
  const updatePayload = {
    status: nextStatus,
    previous_status: extras.previousStatus || null,
    ...extras
  };

  // Remove helper field not in DB schema
  delete updatePayload.previousStatus;

  const { data, error } = await supabaseAdmin
    .from('complaints')
    .update(updatePayload)
    .eq('id', complaintId)
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to update complaint status: ${error.message}`);
  return data;
}

/**
 * Route complaint to a department (sets department_id, routing_method, status).
 */
async function routeComplaint(complaintId, { departmentId, routingMethod, status }) {
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .update({
      department_id:  departmentId,
      routing_method: routingMethod,
      routed_at:      new Date().toISOString(),
      status:         status || 'ROUTED',
      previous_status: 'SUBMITTED'
    })
    .eq('id', complaintId)
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to route complaint: ${error.message}`);
  return data;
}

/**
 * Assign an engineer to a complaint.
 */
async function assignEngineerToComplaint(complaintId, engineerId, assignedBy) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .update({
      assigned_engineer_id: engineerId,
      assigned_at:          now,
      assigned_by:          assignedBy || null,
      status:               'ASSIGNED',
      previous_status:      'DEPARTMENT_ACCEPTED'
    })
    .eq('id', complaintId)
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to assign engineer: ${error.message}`);
  return data;
}

/**
 * Find near-duplicate complaints for AI deduplication.
 */
async function findNearbyComplaints({ category, latitude, longitude, radiusKm = 0.5 }) {
  if (!latitude || !longitude) return [];

  // Use bounding box approximation (1 degree ≈ 111km)
  const delta = radiusKm / 111;
  const { data, error } = await supabaseAdmin
    .from('complaints')
    .select('id, reference_id, description, category, status, created_at')
    .eq('category', category)
    .gte('latitude', latitude - delta)
    .lte('latitude', latitude + delta)
    .gte('longitude', longitude - delta)
    .lte('longitude', longitude + delta)
    .not('status', 'eq', 'CLOSED')
    .not('status', 'eq', 'REJECTED')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.warn('[DB] findNearbyComplaints error:', error.message);
    return [];
  }
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLAINT MEDIA
// ─────────────────────────────────────────────────────────────────────────────

async function addComplaintMedia({ complaintId, mediaType, fileUrl, fileType, caption, uploadedBy }) {
  const { data, error } = await supabaseAdmin
    .from('complaint_media')
    .insert({
      complaint_id: complaintId,
      media_type:   mediaType.toUpperCase(),  // BEFORE | AFTER
      file_url:     fileUrl,
      file_type:    fileType || null,
      caption:      caption || null,
      uploaded_by:  uploadedBy || null
    })
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to add complaint media: ${error.message}`);
  return data;
}

async function getComplaintMedia(complaintId) {
  const { data, error } = await supabaseAdmin
    .from('complaint_media')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`DB_ERROR: Failed to get complaint media: ${error.message}`);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// AI RESULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store AI classification result. Never called with fake/random data.
 */
async function createAIResult({
  complaintId, category, departmentId, priority, confidence,
  modelName, modelVersion, duplicateScore, duplicateOfId,
  requiresHumanReview, reasoningSummary, processingStatus, failureReason
}) {
  const { data, error } = await supabaseAdmin
    .from('ai_results')
    .insert({
      complaint_id:          complaintId,
      category:              category || null,
      department_id:         departmentId || null,
      priority:              priority ? priority.toUpperCase() : null,
      confidence:            typeof confidence === 'number' ? confidence : null,
      model_name:            modelName || null,
      model_version:         modelVersion || null,
      duplicate_score:       duplicateScore || null,
      duplicate_of_id:       duplicateOfId || null,
      requires_human_review: Boolean(requiresHumanReview),
      reasoning_summary:     reasoningSummary || null,
      processing_status:     processingStatus || 'PENDING',
      failure_reason:        failureReason || null,
      processed_at:          processingStatus === 'COMPLETED' ? new Date().toISOString() : null
    })
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to create AI result: ${error.message}`);
  return data;
}

async function getAIResultByComplaintId(complaintId) {
  const { data, error } = await supabaseAdmin
    .from('ai_results')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`DB_ERROR: ${error.message}`);
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNMENTS
// ─────────────────────────────────────────────────────────────────────────────

async function createAssignment({ complaintId, departmentId, engineerId, assignedBy }) {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .insert({
      complaint_id:  complaintId,
      department_id: departmentId || null,
      engineer_id:   engineerId,
      assigned_by:   assignedBy || null,
      status:        'PENDING'
    })
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to create assignment: ${error.message}`);
  return data;
}

async function getAssignmentsByEngineerId(engineerId) {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, complaints(*)')
    .eq('engineer_id', engineerId)
    .order('assigned_at', { ascending: false });

  if (error) throw new Error(`DB_ERROR: Failed to fetch assignments: ${error.message}`);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS — IMMUTABLE (no update/delete)
// ─────────────────────────────────────────────────────────────────────────────

async function recordAuditEvent({
  complaintId, actorId, actorFirebaseUid, actorRole = 'system',
  eventType, oldStatus, newStatus, metadata = {}
}) {
  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      complaint_id:      complaintId || null,
      actor_id:          actorId || null,
      actor_firebase_uid: actorFirebaseUid || null,
      actor_role:        actorRole,
      event_type:        eventType,
      old_status:        oldStatus || null,
      new_status:        newStatus || null,
      metadata:          metadata || {}
    })
    .select()
    .single();

  if (error) {
    // Audit log failures must NOT crash the main workflow
    console.error(`[AUDIT] Failed to record event ${eventType}:`, error.message);
    return null;
  }
  console.log(`[AUDIT] [${eventType}] complaint=${complaintId} by ${actorRole}:${actorId || actorFirebaseUid}`);
  return data;
}

async function getAuditLogsByComplaintId(complaintId) {
  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`DB_ERROR: ${error.message}`);
  return data || [];
}

async function getAllAuditLogs(limitCount = 50) {
  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limitCount);

  if (error) throw new Error(`DB_ERROR: ${error.message}`);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

async function createNotification({ userId, complaintId, title, message, type }) {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id:      userId,
      complaint_id: complaintId || null,
      title,
      message,
      type,
      is_read:      false
    })
    .select()
    .single();

  if (error) {
    console.warn('[NOTIFICATIONS] Failed to create notification:', error.message);
    return null;
  }
  return data;
}

async function getNotificationsForUser(userId) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(`DB_ERROR: ${error.message}`);
  return data || [];
}

async function markNotificationRead(notificationId) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) throw new Error(`DB_ERROR: ${error.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// FEEDBACK (AI training corrections)
// ─────────────────────────────────────────────────────────────────────────────

async function createFeedback({ complaintId, modelVersion, aiPrediction, aiConfidence, humanDecision, humanUserId, reason }) {
  const { data, error } = await supabaseAdmin
    .from('feedback')
    .insert({
      complaint_id:  complaintId,
      model_version: modelVersion || null,
      ai_prediction: aiPrediction || null,
      ai_confidence: aiConfidence || null,
      human_decision: humanDecision || {},
      human_user_id: humanUserId || null,
      reason:        reason || null
    })
    .select()
    .single();

  if (error) throw new Error(`DB_ERROR: Failed to create feedback: ${error.message}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLA RECORDS
// ─────────────────────────────────────────────────────────────────────────────

async function createSLARecord({ complaintId, slaDeadline, priority, departmentId }) {
  const { data, error } = await supabaseAdmin
    .from('sla_records')
    .insert({
      complaint_id:  complaintId,
      sla_deadline:  slaDeadline,
      priority:      priority || null,
      department_id: departmentId || null,
      is_breached:   false
    })
    .select()
    .single();

  if (error) {
    console.warn('[SLA] Failed to create SLA record:', error.message);
    return null;
  }
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS (Admin Dashboard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregate complaint statistics directly from Supabase.
 * No hardcoded fallbacks — if DB fails, throw a real error.
 */
async function getAdminStats() {
  const { data: complaints, error } = await supabaseAdmin
    .from('complaints')
    .select('status, sla_deadline, sla_breached, department_id, priority, created_at');

  if (error) throw new Error(`DB_ERROR: Failed to aggregate stats: ${error.message}`);

  const { count: totalUsers } = await supabaseAdmin
    .from('users')
    .select('*', { count: 'exact', head: true });

  const now = new Date();
  const stats = {
    totalComplaints: complaints.length,
    submitted: 0,
    aiProcessing: 0,
    pendingReview: 0,
    routed: 0,
    inProgress: 0,
    verificationPending: 0,
    closed: 0,
    reopened: 0,
    rejected: 0,
    slaBreached: 0,
    totalUsers: totalUsers || 0
  };

  for (const c of complaints) {
    switch (c.status) {
      case 'SUBMITTED':             stats.submitted++; break;
      case 'AI_PROCESSING':         stats.aiProcessing++; break;
      case 'AI_FAILED':
      case 'PENDING_ADMIN_REVIEW':  stats.pendingReview++; break;
      case 'ROUTED':                stats.routed++; break;
      case 'DEPARTMENT_ACCEPTED':
      case 'ASSIGNED':
      case 'ACCEPTED_BY_ENGINEER':
      case 'EN_ROUTE':
      case 'ON_SITE':
      case 'IN_PROGRESS':           stats.inProgress++; break;
      case 'VERIFICATION_PENDING':
      case 'DEPARTMENT_REVIEW':
      case 'CITIZEN_VERIFICATION':  stats.verificationPending++; break;
      case 'CLOSED':                stats.closed++; break;
      case 'REOPENED':              stats.reopened++; break;
      case 'REJECTED':              stats.rejected++; break;
    }

    if (c.sla_deadline && new Date(c.sla_deadline) < now &&
        c.status !== 'CLOSED' && c.status !== 'REJECTED') {
      stats.slaBreached++;
    }
  }

  return {
    success: true,
    stats,
    total:      stats.totalComplaints,
    pending:    stats.submitted + stats.aiProcessing + stats.pendingReview + stats.routed,
    inProgress: stats.inProgress + stats.verificationPending,
    resolved:   stats.closed,
    rejected:   stats.rejected,
    slaBreached: stats.slaBreached,
    totalUsers: stats.totalUsers
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENTS
// ─────────────────────────────────────────────────────────────────────────────

async function getDepartment(departmentId) {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('id', departmentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`DB_ERROR: ${error.message}`);
  }
  return data;
}

async function listDepartments() {
  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw new Error(`DB_ERROR: ${error.message}`);
  return data || [];
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Users
  getUserByFirebaseUid,
  getUserById,
  upsertUser,
  touchUserLogin,
  getDepartmentEngineers,
  listUsers,

  // Complaints
  createComplaint,
  getComplaintById,
  getComplaintsByCitizenId,
  getComplaintsByDepartmentId,
  getComplaintsByEngineerId,
  getAllComplaints,
  updateComplaintStatus,
  routeComplaint,
  assignEngineerToComplaint,
  findNearbyComplaints,

  // Complaint Media
  addComplaintMedia,
  getComplaintMedia,

  // AI Results
  createAIResult,
  getAIResultByComplaintId,

  // Assignments
  createAssignment,
  getAssignmentsByEngineerId,

  // Audit Logs
  recordAuditEvent,
  getAuditLogsByComplaintId,
  getAllAuditLogs,

  // Notifications
  createNotification,
  getNotificationsForUser,
  markNotificationRead,

  // Feedback
  createFeedback,

  // SLA
  createSLARecord,

  // Stats
  getAdminStats,

  // Departments
  getDepartment,
  listDepartments
};
