/**
 * CivicConnect — Complaints Handler (Supabase edition)
 *
 * All data writes/reads use Supabase PostgreSQL via functions/db.js.
 * Firebase Authentication identifies the user via req.user (set by authMiddleware).
 * No Firestore. No mock data. No Math.random() for fake confidence.
 */

'use strict';

const { randomUUID, createHash } = require('crypto');
const {
  createComplaint,
  getComplaintById,
  getComplaintsByCitizenId,
  getAllComplaints,
  getPublicMapComplaints,
  updateComplaintStatus,
  addComplaintMedia,
  createAIResult,
  createSLARecord,
  recordAuditEvent,
  createNotification,
  findNearbyComplaints,
  getUserById,
  getUserByFirebaseUid,
  upsertUser,
  getDepartment
} = require('./db');
const { classifyComplaintText } = require('./ai');
const { evaluatePriority } = require('./priority');
const { determineRoutingDecision, resolveCanonicalDepartment } = require('./departmentRoutingService');
const { WORKFLOW_STATES } = require('./workflow');

/**
 * Generate a human-readable reference ID using crypto (no Math.random).
 */
function generateReferenceId() {
  const year = new Date().getFullYear();
  const hex = randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  return `CC-${year}-${hex}`;
}

/**
 * POST /api/complaints
 * Citizen submits a new complaint.
 * 
 * ARCHITECTURE (Fast-path + Background AI):
 * 1. Validate inputs
 * 2. Deterministic priority pre-check (instant safety hazard escalation)
 * 3. Persist complaint in Supabase with status SUBMITTED (<100ms)
 * 4. Record COMPLAINT_CREATED audit event
 * 5. Return HTTP 201 immediately with reference ID
 * 6. Background async queue: Gemini AI triage -> auto-routing -> SLA record -> update status
 */
async function submitComplaint(req, res) {
  const reqStart = Date.now();
  const requestId = randomUUID().replace(/-/g, '').substring(0, 8);
  const now = new Date().toISOString();
  const body = req.body || {};

  console.log(`[COMPLAINT ${requestId}] POST /api/complaints received. IP=${req.ip || 'local'}`);

  const description = (body.description || '').trim();
  if (!description) {
    console.warn(`[COMPLAINT ${requestId}] Validation failed: missing description`);
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'A description is required to submit a complaint.'
    });
  }

  // Resolve Citizen Supabase UUID from Firebase Auth UID
  let citizenSupabaseId = req.user?.supabaseId;
  const firebaseUid = req.user?.uid;

  if (!citizenSupabaseId && firebaseUid) {
    try {
      const existingUser = await getUserByFirebaseUid(firebaseUid);
      if (existingUser) {
        citizenSupabaseId = existingUser.id;
      } else {
        const createdUser = await upsertUser({
          firebaseUid,
          name:  req.user.name || body.userName || 'Citizen',
          email: req.user.email || body.email || '',
          role:  'CITIZEN'
        });
        citizenSupabaseId = createdUser?.id;
      }
    } catch (uErr) {
      console.warn(`[COMPLAINT ${requestId}] Auto-resolve citizen record failed:`, uErr.message);
    }
  }

  // Support guest submission when email is provided
  if (!citizenSupabaseId && (body.email || body.citizenEmail)) {
    const rawEmail = (body.email || body.citizenEmail || '').toLowerCase().trim();
    if (rawEmail) {
      try {
        const guestUid = `guest_${createHash('sha256').update(rawEmail).digest('hex').substring(0, 24)}`;
        let guestUser = await getUserByFirebaseUid(guestUid);
        if (!guestUser) {
          guestUser = await upsertUser({
            firebaseUid: guestUid,
            name: body.userName || body.name || 'Citizen',
            email: rawEmail,
            role: 'CITIZEN'
          });
        }
        citizenSupabaseId = guestUser?.id;
        console.log(`[COMPLAINT ${requestId}] Guest citizen resolved: ${citizenSupabaseId} (${rawEmail})`);
      } catch (guestErr) {
        console.warn(`[COMPLAINT ${requestId}] Auto-resolve guest citizen failed:`, guestErr.message);
      }
    }
  }

  // Test mode convenience hook
  if (process.env.NODE_ENV === 'test' && !citizenSupabaseId) {
    citizenSupabaseId = '00000000-0000-0000-0000-000000000001';
  }

  if (!citizenSupabaseId) {
    console.warn(`[COMPLAINT ${requestId}] Rejected: unauthorized (no valid citizen record)`);
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'An email address or signed-in account is required to submit a complaint.'
    });
  }

  const refId = generateReferenceId();
  const latitude  = typeof body.lat === 'number' ? body.lat  : (body.location?.lat  || null);
  const longitude = typeof body.lng === 'number' ? body.lng  : (body.location?.lng  || null);
  const address   = body.address || body.location?.address || null;
  const initialCategory = body.category || 'General';
  // Image references — storagePath from Supabase Storage, imageURL is the public URL
  const imagePath = body.imagePath || null;
  const imageUrl  = body.imageURL || body.media?.before?.[0]?.url || null;

  if (imagePath) {
    console.log(`[COMPLAINT ${requestId}] Image path received: ${imagePath}`);
  }

  // Deterministic Safety Hazard Pre-Check (instant, no external AI latency)
  const priorityEval = evaluatePriority(description, 'MEDIUM');
  const initialPriority = priorityEval.priority;
  const slaDeadline = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

  console.log(`[COMPLAINT ${requestId}] Creating complaint in Supabase. refId=${refId} citizenId=${citizenSupabaseId}`);
  const dbStart = Date.now();

  let complaint;
  try {
    complaint = await createComplaint({
      referenceId:  refId,
      citizenId:    citizenSupabaseId,
      title:        body.title || `${initialCategory} reported at ${address?.split(',')[0] || 'Location'}`,
      description,
      category:     initialCategory,
      priority:     initialPriority,
      latitude,
      longitude,
      address,
      departmentId: null,
      slaDeadline,
      imagePath     // saved as image_path column on the complaint row
    });
  } catch (dbErr) {
    console.error(`[COMPLAINT ${requestId}] DB createComplaint failed (${Date.now() - dbStart}ms):`, dbErr.message);
    return res.status(500).json({
      code: 'DB_ERROR',
      message: dbErr.message || 'Failed to save complaint to database.'
    });
  }

  console.log(`[COMPLAINT ${requestId}] Complaint persisted in ${Date.now() - dbStart}ms. id=${complaint.id}`);

  // Store Media (synchronous, before response)
  // imageUrl: public URL from Supabase Storage (or any other source)
  // imagePath: storage path saved on the complaints row for direct retrieval
  const derivedImageUrl = imageUrl || null;
  const beforeMedia = [];
  if (derivedImageUrl) beforeMedia.push({ url: derivedImageUrl, caption: 'Citizen Report Photo', storagePath: imagePath });
  else if (Array.isArray(body.media?.before)) beforeMedia.push(...body.media.before);

  console.log(`[COMPLAINT ${requestId}] Media to store: ${beforeMedia.length} item(s). image_path=${imagePath || 'none'}`);

  for (const m of beforeMedia) {
    try {
      await addComplaintMedia({
        complaintId: complaint.id,
        mediaType:   'BEFORE',
        fileUrl:     m.url || m,
        caption:     m.caption || null,
        uploadedBy:  citizenSupabaseId
      });
    } catch (mediaErr) {
      console.warn(`[COMPLAINT ${requestId}] Media record insert failed:`, mediaErr.message);
    }
  }

  // Initial Audit Event
  try {
    await recordAuditEvent({
      complaintId:      complaint.id,
      actorId:          citizenSupabaseId,
      actorFirebaseUid: firebaseUid || null,
      actorRole:        'citizen',
      eventType:        'COMPLAINT_CREATED',
      oldStatus:        null,
      newStatus:        WORKFLOW_STATES.SUBMITTED,
      metadata:         {
        referenceId: refId,
        priority:    initialPriority,
        requestId
      }
    });
  } catch (auditErr) {
    console.warn(`[COMPLAINT ${requestId}] Audit log failed:`, auditErr.message);
  }

  // Fast-path HTTP response: Return 201 Created immediately
  const responseTimeMs = Date.now() - reqStart;
  console.log(`[COMPLAINT ${requestId}] Responding 201 Created in ${responseTimeMs}ms. refId=${refId}`);

  res.status(201).json({
    success:     true,
    referenceId: refId,
    complaint:   {
      ...complaint,
      status: WORKFLOW_STATES.SUBMITTED
    }
  });

  // Background Async Processing: AI Classification, Routing, SLA, Notification
  setImmediate(async () => {
    const aiStart = Date.now();
    console.log(`[AI BACKGROUND ${requestId}] Initiating AI triage for complaint ${complaint.id}...`);

    let aiResult = null;
    let aiProcessingStatus = 'PENDING';
    let aiFailureReason = null;
    let category = initialCategory;
    let departmentId = null;
    let priority = initialPriority;
    let routeDecision = null;

    try {
      aiResult = await classifyComplaintText(description, imageUrl || imagePath);
      aiProcessingStatus = 'COMPLETED';
      category = aiResult.category || initialCategory;
      priority = aiResult.priority || initialPriority;
      console.log(`[AI BACKGROUND ${requestId}] AI classification successful in ${Date.now() - aiStart}ms: deptCode=${aiResult.departmentCode} cat=${category} conf=${aiResult.confidence}`);

      routeDecision = await determineRoutingDecision(aiResult, getDepartment);
      departmentId = routeDecision.departmentId;
    } catch (aiErr) {
      console.warn(`[AI BACKGROUND ${requestId}] AI classification failed in ${Date.now() - aiStart}ms:`, aiErr.message);
      aiProcessingStatus = 'FAILED';
      aiFailureReason = aiErr.code || aiErr.message || 'AI_UNAVAILABLE';
      routeDecision = {
        status: WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
        routingMethod: 'ADMIN_MANUAL',
        departmentId: null,
        requiresHumanReview: true,
        reason: `AI processing encountered an exception: ${aiFailureReason}`
      };
    }

    // Refine priority with deterministic rule engine
    const refinedPriorityEval = evaluatePriority(description, priority);
    priority = refinedPriorityEval.priority;

    const status = routeDecision.status;
    const routingMethod = routeDecision.routingMethod;
    departmentId = routeDecision.departmentId;

    // Record AI Result in Supabase
    try {
      await createAIResult({
        complaintId:          complaint.id,
        category:             aiResult?.category || category || null,
        departmentId:         aiResult?.departmentId || departmentId || null,
        priority:             aiResult?.priority || priority || null,
        confidence:           aiResult?.confidence ?? null,
        modelName:            aiResult?.engine || 'gemini-2.5-flash',
        modelVersion:         aiResult?.modelVersion || 'civicconnect-v2.5-flash',
        duplicateScore:       null,
        requiresHumanReview:  routeDecision.requiresHumanReview || (status !== WORKFLOW_STATES.ROUTED),
        reasoningSummary:     aiResult?.reason || routeDecision.reason || aiFailureReason || null,
        processingStatus:     aiProcessingStatus,
        failureReason:        aiFailureReason
      });
    } catch (aiRecordErr) {
      console.error(`[AI BACKGROUND ${requestId}] Failed to record AI result:`, aiRecordErr.message);
    }

    // Record SLA Record in Supabase
    try {
      await createSLARecord({
        complaintId:  complaint.id,
        slaDeadline,
        priority,
        departmentId: departmentId || null
      });
    } catch (slaErr) {
      console.warn(`[AI BACKGROUND ${requestId}] SLA record creation failed:`, slaErr.message);
    }

    // Update complaint with routed department, category & status
    try {
      await updateComplaintStatus(complaint.id, status, {
        previousStatus: WORKFLOW_STATES.SUBMITTED,
        department_id:  departmentId,
        category:       category || initialCategory,
        priority,
        routing_method: routingMethod,
        routed_at:      status === WORKFLOW_STATES.ROUTED ? new Date().toISOString() : null
      });
      console.log(`[AI BACKGROUND ${requestId}] Complaint status updated to ${status} (dept=${departmentId})`);
    } catch (statusErr) {
      console.warn(`[AI BACKGROUND ${requestId}] Status update failed:`, statusErr.message);
    }

    // Audit Event for AI & Routing transition
    try {
      await recordAuditEvent({
        complaintId:      complaint.id,
        actorId:          null,
        actorFirebaseUid: null,
        actorRole:        'system',
        eventType:        status === WORKFLOW_STATES.ROUTED ? 'COMPLAINT_ROUTED' : (aiProcessingStatus === 'COMPLETED' ? 'PENDING_ADMIN_REVIEW' : 'AI_FAILED'),
        oldStatus:        WORKFLOW_STATES.SUBMITTED,
        newStatus:        status,
        metadata:         {
          referenceId:    refId,
          aiStatus:       aiProcessingStatus,
          department:     departmentId,
          departmentCode: routeDecision.departmentCode || null,
          confidence:     aiResult?.confidence ?? null,
          routingMethod,
          reason:         routeDecision.reason,
          durationMs:     Date.now() - aiStart
        }
      });
    } catch (auditErr) {
      console.warn(`[AI BACKGROUND ${requestId}] Routing audit event failed:`, auditErr.message);
    }

    // Notification for citizen
    try {
      await createNotification({
        userId:      citizenSupabaseId,
        complaintId: complaint.id,
        title:       'Complaint Status Update',
        message:     `Your complaint ${refId} has been triaged. Current status: ${status}.`,
        type:        'complaint_triaged'
      });
    } catch (notifErr) {
      console.warn(`[AI BACKGROUND ${requestId}] Citizen notification failed:`, notifErr.message);
    }

    console.log(`[AI BACKGROUND ${requestId}] Background pipeline completed in ${Date.now() - aiStart}ms.`);
  });
}

/**
 * GET /api/complaints/:id
 * Fetch a single complaint by reference ID or UUID.
 */
async function getComplaintByIdHandler(req, res) {
  const id = req.params.id;

  const complaint = await getComplaintById(id);
  if (!complaint) {
    return res.status(404).json({ code: 'NOT_FOUND', message: 'Complaint not found.' });
  }

  // Citizens can only view their own complaints
  if (req.user?.role === 'citizen') {
    if (complaint.citizen_id !== req.user.supabaseId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'You are not authorized to view this complaint.'
      });
    }
  }

  return res.json({ complaint });
}

/**
 * GET /api/public/track/:refId
 * Public-facing sanitized tracking endpoint (no PII).
 */
async function trackPublicComplaint(req, res) {
  const refId = req.params.refId;
  const complaint = await getComplaintById(refId);

  if (!complaint) {
    return res.status(404).json({
      code: 'NOT_FOUND',
      message: 'No complaint found matching this tracking ID.'
    });
  }

  // Return sanitized public data only
  return res.json({
    referenceId: complaint.reference_id,
    category:    complaint.category || 'General',
    status:      complaint.status,
    priority:    complaint.priority,
    address:     complaint.address || null,
    createdAt:   complaint.created_at,
    updatedAt:   complaint.updated_at
  });
}

/**
 * GET /api/user/complaints
 * List complaints for the authenticated citizen.
 */
async function listUserComplaints(req, res) {
  if (!req.user || !req.user.supabaseId) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
  }

  const complaints = await getComplaintsByCitizenId(req.user.supabaseId);
  return res.json({ complaints });
}

/**
 * GET /api/public/map-complaints
 * Returns sanitized non-PII complaint coordinates and statuses for the public map view.
 */
async function listPublicMapComplaints(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const complaints = await getPublicMapComplaints(limit);
    return res.json({ complaints });
  } catch (err) {
    console.warn('[PUBLIC MAP] Failed to fetch complaints:', err.message);
    return res.json({ complaints: [] });
  }
}

module.exports = {
  submitComplaint,
  getComplaintById: getComplaintByIdHandler,
  trackPublicComplaint,
  listUserComplaints,
  listPublicMapComplaints
};
