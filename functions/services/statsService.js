const { WORKFLOW_STATES } = require('../workflow');

const CANONICAL_DEPARTMENTS = [
  { id: 'roads', name: 'Roads & Infrastructure' },
  { id: 'water', name: 'Water Supply' },
  { id: 'electricity', name: 'Electricity & Lighting' },
  { id: 'garbage', name: 'Sanitation & Waste' },
  { id: 'drainage', name: 'Drainage & Sewage' },
  { id: 'health', name: 'Public Health' },
  { id: 'transport', name: 'Transport & Traffic' },
  { id: 'public_safety', name: 'Public Safety' }
];

/**
 * Aggregates all complaints directly from Cloud Firestore single source of truth.
 */
async function aggregateAllComplaints(db) {
  const snap = await db.collection('complaints').get();
  const complaints = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const now = new Date();

  const counts = {
    totalComplaints: complaints.length,
    submitted: 0,
    aiProcessing: 0,
    aiFailed: 0,
    pendingReview: 0,
    routed: 0,
    departmentAccepted: 0,
    assigned: 0,
    acceptedByEngineer: 0,
    enRoute: 0,
    onSite: 0,
    inProgress: 0,
    verificationPending: 0,
    departmentReview: 0,
    citizenVerification: 0,
    closed: 0,
    reopened: 0,
    rejected: 0,
    slaBreached: 0
  };

  // Department-specific tracking map
  const deptMap = {};
  for (const dept of CANONICAL_DEPARTMENTS) {
    deptMap[dept.id] = {
      departmentId: dept.id,
      name: dept.name,
      total: 0,
      assigned: 0,
      inProgress: 0,
      resolved: 0,
      slaBreached: 0
    };
  }

  for (const c of complaints) {
    const status = c.workflow?.status || c.status || WORKFLOW_STATES.SUBMITTED;
    const deptId = (c.routing?.departmentId || c.category || c.department || 'roads').toLowerCase();

    // Map to normalized department key
    let targetDeptKey = 'roads';
    for (const [key, d] of Object.entries(deptMap)) {
      if (deptId === key || deptId.includes(key) || deptId.includes(d.name.toLowerCase())) {
        targetDeptKey = key;
        break;
      }
    }

    if (deptMap[targetDeptKey]) {
      deptMap[targetDeptKey].total++;
    }

    // Workflow status categorizations
    switch (status) {
      case WORKFLOW_STATES.SUBMITTED:
        counts.submitted++;
        break;
      case WORKFLOW_STATES.AI_PROCESSING:
        counts.aiProcessing++;
        break;
      case WORKFLOW_STATES.AI_FAILED:
        counts.aiFailed++;
        counts.pendingReview++;
        break;
      case WORKFLOW_STATES.PENDING_ADMIN_REVIEW:
        counts.pendingReview++;
        break;
      case WORKFLOW_STATES.ROUTED:
        counts.routed++;
        break;
      case WORKFLOW_STATES.DEPARTMENT_ACCEPTED:
        counts.departmentAccepted++;
        break;
      case WORKFLOW_STATES.ASSIGNED:
        counts.assigned++;
        if (deptMap[targetDeptKey]) deptMap[targetDeptKey].assigned++;
        break;
      case WORKFLOW_STATES.ACCEPTED_BY_ENGINEER:
        counts.acceptedByEngineer++;
        if (deptMap[targetDeptKey]) deptMap[targetDeptKey].inProgress++;
        break;
      case WORKFLOW_STATES.EN_ROUTE:
      case WORKFLOW_STATES.ON_SITE:
      case WORKFLOW_STATES.IN_PROGRESS:
        counts.inProgress++;
        if (deptMap[targetDeptKey]) deptMap[targetDeptKey].inProgress++;
        break;
      case WORKFLOW_STATES.VERIFICATION_PENDING:
        counts.verificationPending++;
        if (deptMap[targetDeptKey]) deptMap[targetDeptKey].inProgress++;
        break;
      case WORKFLOW_STATES.DEPARTMENT_REVIEW:
      case WORKFLOW_STATES.CITIZEN_VERIFICATION:
        counts.citizenVerification++;
        if (deptMap[targetDeptKey]) deptMap[targetDeptKey].resolved++;
        break;
      case WORKFLOW_STATES.CLOSED:
        counts.closed++;
        if (deptMap[targetDeptKey]) deptMap[targetDeptKey].resolved++;
        break;
      case WORKFLOW_STATES.REOPENED:
        counts.reopened++;
        if (deptMap[targetDeptKey]) deptMap[targetDeptKey].inProgress++;
        break;
      case WORKFLOW_STATES.REJECTED:
        counts.rejected++;
        break;
      default:
        counts.submitted++;
    }

    // SLA verification
    const slaDeadline = c.sla?.deadline ? new Date(c.sla.deadline) : null;
    if (slaDeadline && slaDeadline < now && status !== WORKFLOW_STATES.CLOSED && status !== WORKFLOW_STATES.REJECTED) {
      counts.slaBreached++;
      if (deptMap[targetDeptKey]) deptMap[targetDeptKey].slaBreached++;
    }
  }

  return { counts, complaints, deptMap };
}

/**
 * Requirement 5: GET /api/admin/stats
 */
async function getAdminStats(db) {
  const { counts } = await aggregateAllComplaints(db);

  // Active users count
  let totalUsers = 0;
  try {
    const userSnap = await db.collection('users').get();
    totalUsers = userSnap.size;
  } catch (err) {
    console.warn('[STATS SERVICE] Failed to count users:', err.message);
  }

  return {
    success: true,
    stats: {
      totalComplaints: counts.totalComplaints,
      submitted: counts.submitted,
      aiProcessing: counts.aiProcessing,
      pendingReview: counts.pendingReview,
      assigned: counts.assigned,
      inProgress: counts.inProgress,
      verificationPending: counts.verificationPending,
      closed: counts.closed,
      reopened: counts.reopened,
      slaBreached: counts.slaBreached,
      rejected: counts.rejected
    },
    // Backward compatibility for dashboard cards expecting top-level summary metrics
    total: counts.totalComplaints,
    pending: counts.submitted + counts.aiProcessing + counts.pendingReview + counts.routed,
    inProgress: counts.assigned + counts.inProgress + counts.verificationPending,
    resolved: counts.closed + counts.citizenVerification,
    rejected: counts.rejected,
    slaBreached: counts.slaBreached,
    totalUsers
  };
}

/**
 * Requirement 6: GET /api/departments/stats and GET /api/issues/department-stats
 */
async function getDepartmentStats(db) {
  const { deptMap } = await aggregateAllComplaints(db);
  const departments = Object.values(deptMap);

  return {
    success: true,
    departments,
    stats: departments
  };
}

/**
 * Requirement 7: GET /api/issues/stats
 */
async function getIssueStats(db) {
  const { counts, deptMap } = await aggregateAllComplaints(db);

  return {
    success: true,
    stats: {
      total: counts.totalComplaints,
      open: counts.submitted + counts.aiProcessing + counts.pendingReview + counts.routed,
      inProgress: counts.assigned + counts.inProgress,
      verificationPending: counts.verificationPending,
      closed: counts.closed,
      reopened: counts.reopened
    },
    byDepartment: Object.values(deptMap)
  };
}

module.exports = {
  getAdminStats,
  getDepartmentStats,
  getIssueStats,
  CANONICAL_DEPARTMENTS
};
