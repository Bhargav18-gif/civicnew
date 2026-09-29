/**
 * CivicConnect Canonical Complaint Schema & Normalizer
 * Enforces the Single Source of Truth complaint schema across Citizen, Admin,
 * Department, and Engineer workflows, with legacy backwards-compatibility mapping.
 */

import { WORKFLOW_STATES, PRIORITY_LEVELS, PRIORITY_SLA_HOURS } from '../constants/workflow.js';

export function generateReferenceId() {
  const year = new Date().getFullYear();
  const randomHex = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase()
    : Date.now().toString(16).substring(6).toUpperCase();
  return `CC-${year}-${randomHex}`;
}

export function calculateSlaDeadline(priority, startDate = new Date()) {
  const normPriority = (priority || PRIORITY_LEVELS.MEDIUM).toUpperCase();
  const hours = PRIORITY_SLA_HOURS[normPriority] || 72;
  const deadline = new Date(startDate.getTime() + hours * 3600 * 1000);
  return deadline.toISOString();
}

/**
 * Creates a clean, strictly-validated canonical complaint model for Supabase.
 */
export function createCanonicalComplaint(data = {}) {
  const now = new Date().toISOString();
  const refId = data.referenceId || data.complaintId || generateReferenceId();

  // Normalize citizen info
  const citizen = {
    userId: data.citizen?.userId || data.userId || null,
    name: (data.citizen?.name || data.userName || data.name || "Citizen").trim(),
    email: (data.citizen?.email || data.userEmail || data.email || "").trim()
  };

  // Normalize issue content
  const issue = {
    title: (data.issue?.title || data.title || data.issueTitle || "Civic Complaint").trim(),
    description: (data.issue?.description || data.description || data.issueDescription || "").trim(),
    category: (data.issue?.category || data.category || data.department || "General").trim()
  };

  // Normalize location
  const location = {
    lat: typeof data.location?.lat === "number" ? data.location.lat : (typeof data.lat === "number" ? data.lat : null),
    lng: typeof data.location?.lng === "number" ? data.location.lng : (typeof data.lng === "number" ? data.lng : null),
    address: data.location?.address || data.address || "Location unavailable"
  };

  // Normalize media arrays
  const beforeMedia = Array.isArray(data.media?.before)
    ? data.media.before
    : (data.imageURL ? [{ url: data.imageURL, uploadedAt: now, caption: "Report Photo" }] : (data.citizenPhotos || []));

  const afterMedia = Array.isArray(data.media?.after)
    ? data.media.after
    : (data.engineerPhotos || []);

  const media = {
    before: beforeMedia,
    after: afterMedia
  };

  // Normalize AI metadata
  const priority = (data.ai?.priority || data.priority || PRIORITY_LEVELS.MEDIUM).toUpperCase();
  const ai = {
    category: data.ai?.category || data.aiCategory || issue.category,
    department: data.ai?.department || data.assignedDepartment || issue.category,
    priority: PRIORITY_LEVELS[priority] ? priority : PRIORITY_LEVELS.MEDIUM,
    confidence: typeof data.ai?.confidence === "number" ? data.ai.confidence : (typeof data.aiConfidence === "number" ? data.aiConfidence : 0),
    modelVersion: data.ai?.modelVersion || data.classificationModel || "civicconnect-v2",
    processingStatus: data.ai?.processingStatus || (data.aiAnalysis ? "COMPLETED" : "PENDING"),
    requiresHumanReview: Boolean(data.ai?.requiresHumanReview ?? data.requires_admin_review),
    processedAt: data.ai?.processedAt || now
  };

  // Normalize routing
  const routing = {
    departmentId: data.routing?.departmentId || data.assignedDepartment || issue.category,
    routedAt: data.routing?.routedAt || now,
    routingMethod: data.routing?.routingMethod || "AI_AUTO"
  };

  // Normalize assignment
  const assignment = {
    engineerId: data.assignment?.engineerId || data.assignedEngineerId || null,
    assignedAt: data.assignment?.assignedAt || (data.assignedEngineerId ? now : null),
    assignedBy: data.assignment?.assignedBy || null
  };

  // Normalize workflow state
  const rawStatus = (data.workflow?.status || data.status || WORKFLOW_STATES.SUBMITTED).toUpperCase();
  const canonicalStatus = WORKFLOW_STATES[rawStatus] ? rawStatus : WORKFLOW_STATES.SUBMITTED;

  const workflow = {
    status: canonicalStatus,
    previousStatus: data.workflow?.previousStatus || null,
    updatedAt: now
  };

  // Normalize verification
  const verification = {
    aiResult: data.verification?.aiResult || null,
    departmentResult: data.verification?.departmentResult || null,
    citizenResult: data.verification?.citizenResult || null
  };

  // Normalize SLA
  const deadline = data.sla?.deadline || calculateSlaDeadline(ai.priority, new Date(now));
  const sla = {
    deadline,
    breached: Boolean(data.sla?.breached ?? (new Date(now) > new Date(deadline)))
  };

  // Build the complete canonical document
  return {
    referenceId: refId,
    citizen,
    issue,
    location,
    media,
    ai,
    routing,
    assignment,
    workflow,
    verification,
    sla,
    createdAt: data.createdAt || now,
    updatedAt: now
  };
}

/**
 * Normalizes any complaint document (whether created originally as flat legacy doc
 * or canonical structured doc) into an object that provides both canonical structured fields
 * and backward-compatible flat getters for legacy UI components.
 */
export function normalizeComplaintDoc(raw = {}, docId = null) {
  if (!raw) return null;

  const canonical = createCanonicalComplaint(raw);
  const id = docId || raw.id || canonical.referenceId;

  // Map legacy status strings to canonical states if necessary
  let currentStatus = canonical.workflow.status;
  if (raw.status) {
    const s = String(raw.status).toLowerCase();
    if (s === 'pending') currentStatus = WORKFLOW_STATES.SUBMITTED;
    else if (s === 'in-progress' || s === 'in progress') currentStatus = WORKFLOW_STATES.IN_PROGRESS;
    else if (s === 'resolved' || s === 'completed') currentStatus = WORKFLOW_STATES.CITIZEN_VERIFICATION;
    else if (s === 'closed') currentStatus = WORKFLOW_STATES.CLOSED;
    else if (s === 'rejected') currentStatus = WORKFLOW_STATES.REJECTED;
    else if (WORKFLOW_STATES[raw.status.toUpperCase()]) currentStatus = raw.status.toUpperCase();
  }
  canonical.workflow.status = currentStatus;

  return {
    ...raw,
    ...canonical,
    id,
    complaintId: canonical.referenceId,

    // Flat compatibility getters for older UI components
    title: canonical.issue.title,
    issueTitle: canonical.issue.title,
    description: canonical.issue.description,
    issueDescription: canonical.issue.description,
    category: canonical.issue.category,
    department: canonical.routing.departmentId,
    assignedDepartment: canonical.routing.departmentId,
    assignedEngineerId: canonical.assignment.engineerId,
    assignedEngineer: canonical.assignment.engineerId,
    status: canonical.workflow.status.toLowerCase(),
    canonicalStatus: canonical.workflow.status,
    priority: canonical.ai.priority.toLowerCase(),
    canonicalPriority: canonical.ai.priority,
    userId: canonical.citizen.userId,
    userName: canonical.citizen.name,
    userEmail: canonical.citizen.email,
    imageURL: canonical.media.before[0]?.url || raw.imageURL || null,
    citizenPhotos: canonical.media.before,
    engineerPhotos: canonical.media.after,
    address: canonical.location.address,
    aiConfidence: canonical.ai.confidence,
    timeline: raw.timeline || [],
    feedback: raw.feedback || canonical.verification.citizenResult || null
  };
}
