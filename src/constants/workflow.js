/**
 * CivicConnect Canonical Workflow State Machine & State Constants
 * Single source of truth for all workflow transitions, permissions, and roles.
 */

export const WORKFLOW_STATES = Object.freeze({
  SUBMITTED: 'SUBMITTED',
  AI_PROCESSING: 'AI_PROCESSING',
  AI_FAILED: 'AI_FAILED',
  PENDING_ADMIN_REVIEW: 'PENDING_ADMIN_REVIEW',
  ROUTED: 'ROUTED',
  DEPARTMENT_ACCEPTED: 'DEPARTMENT_ACCEPTED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED_BY_ENGINEER: 'ACCEPTED_BY_ENGINEER',
  EN_ROUTE: 'EN_ROUTE',
  ON_SITE: 'ON_SITE',
  IN_PROGRESS: 'IN_PROGRESS',
  VERIFICATION_PENDING: 'VERIFICATION_PENDING',
  DEPARTMENT_REVIEW: 'DEPARTMENT_REVIEW',
  CITIZEN_VERIFICATION: 'CITIZEN_VERIFICATION',
  REOPENED: 'REOPENED',
  CLOSED: 'CLOSED',
  REJECTED: 'REJECTED'
});

export const ROLES = Object.freeze({
  CITIZEN: 'citizen',
  ENGINEER: 'engineer',
  DEPARTMENT: 'department',
  ADMIN: 'admin'
});

export const PRIORITY_LEVELS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
});

/**
 * Valid state transitions and role enforcement
 */
export const WORKFLOW_TRANSITIONS = Object.freeze({
  [WORKFLOW_STATES.SUBMITTED]: [
    { to: WORKFLOW_STATES.AI_PROCESSING, roles: [ROLES.ADMIN, 'system'] },
    { to: WORKFLOW_STATES.PENDING_ADMIN_REVIEW, roles: [ROLES.ADMIN, 'system'] },
    { to: WORKFLOW_STATES.ROUTED, roles: [ROLES.ADMIN, 'system'] }
  ],
  [WORKFLOW_STATES.AI_PROCESSING]: [
    { to: WORKFLOW_STATES.ROUTED, roles: [ROLES.ADMIN, 'system'] },
    { to: WORKFLOW_STATES.PENDING_ADMIN_REVIEW, roles: [ROLES.ADMIN, 'system'] },
    { to: WORKFLOW_STATES.AI_FAILED, roles: [ROLES.ADMIN, 'system'] }
  ],
  [WORKFLOW_STATES.AI_FAILED]: [
    { to: WORKFLOW_STATES.AI_PROCESSING, roles: [ROLES.ADMIN] },
    { to: WORKFLOW_STATES.PENDING_ADMIN_REVIEW, roles: [ROLES.ADMIN] },
    { to: WORKFLOW_STATES.ROUTED, roles: [ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.PENDING_ADMIN_REVIEW]: [
    { to: WORKFLOW_STATES.ROUTED, roles: [ROLES.ADMIN] },
    { to: WORKFLOW_STATES.REJECTED, roles: [ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.ROUTED]: [
    { to: WORKFLOW_STATES.DEPARTMENT_ACCEPTED, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.PENDING_ADMIN_REVIEW, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.REJECTED, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.DEPARTMENT_ACCEPTED]: [
    { to: WORKFLOW_STATES.ASSIGNED, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.ROUTED, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.ASSIGNED]: [
    { to: WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, roles: [ROLES.ENGINEER, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.DEPARTMENT_ACCEPTED, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.ACCEPTED_BY_ENGINEER]: [
    { to: WORKFLOW_STATES.EN_ROUTE, roles: [ROLES.ENGINEER] }
  ],
  [WORKFLOW_STATES.EN_ROUTE]: [
    { to: WORKFLOW_STATES.ON_SITE, roles: [ROLES.ENGINEER] }
  ],
  [WORKFLOW_STATES.ON_SITE]: [
    { to: WORKFLOW_STATES.IN_PROGRESS, roles: [ROLES.ENGINEER] }
  ],
  [WORKFLOW_STATES.IN_PROGRESS]: [
    { to: WORKFLOW_STATES.VERIFICATION_PENDING, roles: [ROLES.ENGINEER] }
  ],
  [WORKFLOW_STATES.VERIFICATION_PENDING]: [
    { to: WORKFLOW_STATES.DEPARTMENT_REVIEW, roles: [ROLES.DEPARTMENT, ROLES.ADMIN, 'system'] },
    { to: WORKFLOW_STATES.CITIZEN_VERIFICATION, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.IN_PROGRESS, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.DEPARTMENT_REVIEW]: [
    { to: WORKFLOW_STATES.CITIZEN_VERIFICATION, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.IN_PROGRESS, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.CITIZEN_VERIFICATION]: [
    { to: WORKFLOW_STATES.CLOSED, roles: [ROLES.CITIZEN, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.REOPENED, roles: [ROLES.CITIZEN, ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.REOPENED]: [
    { to: WORKFLOW_STATES.DEPARTMENT_REVIEW, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] },
    { to: WORKFLOW_STATES.IN_PROGRESS, roles: [ROLES.DEPARTMENT, ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.REJECTED]: [
    { to: WORKFLOW_STATES.PENDING_ADMIN_REVIEW, roles: [ROLES.ADMIN] }
  ],
  [WORKFLOW_STATES.CLOSED]: []
});

/**
 * Validate whether a status transition is permitted for a given role
 */
export function canTransition(currentStatus, targetStatus, userRole) {
  if (!currentStatus || !targetStatus) return false;
  const normalizedCurrent = currentStatus.toUpperCase();
  const normalizedTarget = targetStatus.toUpperCase();

  if (normalizedCurrent === normalizedTarget) return true;

  // Admins have override privileges for exceptional circumstances
  if (userRole === ROLES.ADMIN) return true;

  const allowed = WORKFLOW_TRANSITIONS[normalizedCurrent];
  if (!allowed) return false;

  const transition = allowed.find(t => t.to === normalizedTarget);
  if (!transition) return false;

  return transition.roles.includes(userRole?.toLowerCase()) || transition.roles.includes('system');
}

/**
 * Human-readable labels and UI metadata
 */
export const STATUS_META = Object.freeze({
  [WORKFLOW_STATES.SUBMITTED]: { label: 'Submitted', color: 'blue', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  [WORKFLOW_STATES.AI_PROCESSING]: { label: 'AI Processing', color: 'purple', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  [WORKFLOW_STATES.AI_FAILED]: { label: 'AI Failed', color: 'rose', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  [WORKFLOW_STATES.PENDING_ADMIN_REVIEW]: { label: 'Admin Review', color: 'amber', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  [WORKFLOW_STATES.ROUTED]: { label: 'Routed', color: 'indigo', badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  [WORKFLOW_STATES.DEPARTMENT_ACCEPTED]: { label: 'Dept Accepted', color: 'cyan', badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  [WORKFLOW_STATES.ASSIGNED]: { label: 'Assigned', color: 'sky', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
  [WORKFLOW_STATES.ACCEPTED_BY_ENGINEER]: { label: 'Eng Accepted', color: 'teal', badge: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  [WORKFLOW_STATES.EN_ROUTE]: { label: 'En Route', color: 'orange', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  [WORKFLOW_STATES.ON_SITE]: { label: 'On Site', color: 'yellow', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  [WORKFLOW_STATES.IN_PROGRESS]: { label: 'In Progress', color: 'amber', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  [WORKFLOW_STATES.VERIFICATION_PENDING]: { label: 'Verification Pending', color: 'violet', badge: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  [WORKFLOW_STATES.DEPARTMENT_REVIEW]: { label: 'Dept Review', color: 'purple', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  [WORKFLOW_STATES.CITIZEN_VERIFICATION]: { label: 'Citizen Verification', color: 'emerald', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  [WORKFLOW_STATES.REOPENED]: { label: 'Reopened', color: 'rose', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  [WORKFLOW_STATES.CLOSED]: { label: 'Closed', color: 'green', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  [WORKFLOW_STATES.REJECTED]: { label: 'Rejected', color: 'red', badge: 'bg-red-500/10 text-red-400 border-red-500/30' }
});

/**
 * Standard SLA hours based on priority
 */
export const PRIORITY_SLA_HOURS = Object.freeze({
  [PRIORITY_LEVELS.CRITICAL]: 4,
  [PRIORITY_LEVELS.HIGH]: 24,
  [PRIORITY_LEVELS.MEDIUM]: 72,
  [PRIORITY_LEVELS.LOW]: 168
});
