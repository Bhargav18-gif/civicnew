/**
 * Configurable Routing Engine
 * Evaluates AI confidence against configurable thresholds.
 *
 * The db parameter is kept for backward-compatibility but is no longer used.
 * Configuration comes from defaults (can be extended to store in Supabase later).
 */

'use strict';

const { WORKFLOW_STATES } = require('./workflow');

const DEFAULT_CONFIG = {
  autoRoutingEnabled: true,
  highConfidenceThreshold: 0.85,
  adminReviewThreshold: 0.70,
  duplicateThreshold: 0.80
};

async function getSystemAIConfig(_db) {
  // db parameter kept for backward-compatibility — not used (Firestore removed).
  // Configuration can be moved to Supabase system_config table in a future migration.
  return DEFAULT_CONFIG;
}

async function determineRouting(_db, { aiConfidence, departmentId, duplicateCandidate = null }) {
  const config = await getSystemAIConfig(null);

  // If a strong duplicate candidate exists, flag for admin review
  if (duplicateCandidate && duplicateCandidate.isDuplicate) {
    return {
      status: WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
      routingMethod: 'ADMIN_MANUAL',
      reason: `Flagged as potential duplicate: ${duplicateCandidate.reason}`
    };
  }

  // If automatic routing is disabled globally
  if (!config.autoRoutingEnabled) {
    return {
      status: WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
      routingMethod: 'ADMIN_MANUAL',
      reason: 'Automated routing is disabled by policy.'
    };
  }

  // High confidence path -> ROUTED to department
  if (aiConfidence >= config.highConfidenceThreshold && departmentId) {
    return {
      status: WORKFLOW_STATES.ROUTED,
      routingMethod: 'AI_AUTO',
      reason: `High confidence match (${Math.round(aiConfidence * 100)}% >= ${Math.round(config.highConfidenceThreshold * 100)}%) successfully routed to ${departmentId}.`
    };
  }

  // Moderate/Low confidence path -> PENDING_ADMIN_REVIEW
  return {
    status: WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
    routingMethod: 'ADMIN_MANUAL',
    reason: `Confidence (${Math.round(aiConfidence * 100)}%) is below automatic routing threshold (${Math.round(config.highConfidenceThreshold * 100)}%). Requires human verification.`
  };
}

module.exports = {
  determineRouting,
  getSystemAIConfig,
  DEFAULT_CONFIG
};
