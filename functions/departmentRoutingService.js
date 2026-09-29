/**
 * CivicConnect — Canonical Department Routing Service
 *
 * Single source of truth for:
 * 1. Canonical department definitions and database mapping
 * 2. Category -> Department server-side routing configuration
 * 3. Structured AI response validation
 * 4. Configurable confidence policy thresholds
 * 5. Automatic routing decision engine
 *
 * No mock data. No Math.random(). No silent fallback to "roads".
 */

'use strict';

const { WORKFLOW_STATES } = require('./workflow');

// Canonical Departments Definition
const CANONICAL_DEPARTMENTS = Object.freeze({
  roads: {
    id: 'roads',
    code: 'ROADS',
    name: 'Roads & Infrastructure',
    description: 'Road maintenance, potholes, footpaths, asphalt repair, speed breakers',
    categories: [
      'Road Damage',
      'Pothole',
      'Damaged Footpath',
      'Broken Speed Breaker',
      'Road Cave-in',
      'Asphalt Peeling',
      'Sunken Trench'
    ]
  },
  water: {
    id: 'water',
    code: 'WATER',
    name: 'Water Supply',
    description: 'Water leakage, supply issues, contaminated water, pipeline damage',
    categories: [
      'Water Leakage',
      'Pipe Burst',
      'Pipe Damage',
      'No Water Supply',
      'Contaminated Water',
      'Low Water Pressure',
      'Water Supply Disruption'
    ]
  },
  electricity: {
    id: 'electricity',
    code: 'ELECTRICAL',
    name: 'Electricity & Lighting',
    description: 'Power outages, streetlights, transformers, electrical pole damage',
    categories: [
      'Street Light Failure',
      'Streetlight Outage',
      'Power Outage',
      'Exposed Wiring',
      'Transformer Sparking',
      'Damaged Electric Pole',
      'Low Voltage'
    ]
  },
  garbage: {
    id: 'garbage',
    code: 'SANITATION',
    name: 'Sanitation & Waste',
    description: 'Waste collection, garbage dumping, cleanliness, overflowing bins',
    categories: [
      'Garbage Overflow',
      'Illegal Dumping',
      'Dead Animal Removal',
      'Unswept Street',
      'Missing Dustbin',
      'Waste Collection Delay'
    ]
  },
  drainage: {
    id: 'drainage',
    code: 'DRAINAGE',
    name: 'Drainage & Sewage',
    description: 'Blocked drains, sewage overflow, stormwater flooding, open manhole',
    categories: [
      'Drainage Blockage',
      'Sewage Overflow',
      'Open Manhole',
      'Stormwater Flooding',
      'Stagnant Drain Water',
      'Missing Storm Cover'
    ]
  },
  health: {
    id: 'health',
    code: 'PUBLIC_HEALTH',
    name: 'Public Health',
    description: 'Hygiene, mosquito breeding, food safety, health hazards',
    categories: [
      'Mosquito Breeding',
      'Dengue Risk Area',
      'Unhygienic Food Stall',
      'Public Health Hazard',
      'Medical Waste Dumping',
      'Pest Infestation'
    ]
  },
  transport: {
    id: 'transport',
    code: 'TRANSPORT',
    name: 'Transport & Traffic',
    description: 'Traffic signals, bus stops, road signs, traffic congestion',
    categories: [
      'Traffic Signal Broken',
      'Damaged Bus Shelter',
      'Missing Road Sign',
      'Faded Zebra Crossing',
      'Traffic Signage Damaged',
      'Bus Stop Encroachment'
    ]
  },
  public_safety: {
    id: 'public_safety',
    code: 'PUBLIC_SAFETY',
    name: 'Public Safety',
    description: 'Encroachments, hazardous structures, public safety risks',
    categories: [
      'Hazardous Structure',
      'Footpath Encroachment',
      'Unsafe Building Demolition',
      'Fire Safety Hazard',
      'Fallen Tree Branch',
      'Open Excavation Risk'
    ]
  }
});

// Configurable confidence thresholds (server-side single source of truth)
const ROUTING_CONFIG = {
  highConfidenceThreshold: 0.85,  // >= 0.85: Automatic routing after validation
  adminReviewThreshold:    0.70,  // 0.70 - 0.84: Additional validation required
  autoRoutingEnabled:      true
};

/**
 * Normalizes any department code, ID, or alias to a canonical department object.
 * Returns null if not found (never silently falls back to "roads").
 */
function resolveCanonicalDepartment(deptInput) {
  if (!deptInput || typeof deptInput !== 'string') return null;

  const raw = deptInput.trim().toLowerCase().replace(/[\s-]/g, '_');
  const upper = deptInput.trim().toUpperCase().replace(/[\s-]/g, '_');

  // Direct ID match
  if (CANONICAL_DEPARTMENTS[raw]) {
    return CANONICAL_DEPARTMENTS[raw];
  }

  // Code or Name match
  for (const dept of Object.values(CANONICAL_DEPARTMENTS)) {
    if (dept.code === upper || dept.id === raw) {
      return dept;
    }
    const normName = dept.name.toLowerCase().replace(/[\s-&]/g, '_');
    if (normName.includes(raw) || raw.includes(normName)) {
      return dept;
    }
  }

  // Common aliases
  const ALIASES = {
    'sanitation':        'garbage',
    'waste':             'garbage',
    'electrical':        'electricity',
    'power':             'electricity',
    'lighting':          'electricity',
    'street_lighting':   'electricity',
    'streetlighting':    'electricity',
    'traffic':           'transport',
    'public health':     'health',
    'municipal_services':'public_safety',
    'safety':            'public_safety'
  };

  if (ALIASES[raw] && CANONICAL_DEPARTMENTS[ALIASES[raw]]) {
    return CANONICAL_DEPARTMENTS[ALIASES[raw]];
  }

  return null;
}

/**
 * Validates structured AI classification output before routing.
 * Strictly adheres to Part 5 and Part 6 of the specification.
 *
 * Checks:
 * - category exists and non-empty
 * - departmentCode exists
 * - confidence is a valid float between 0.0 and 1.0
 * - priority is a valid enum (LOW, MEDIUM, HIGH, CRITICAL)
 * - department exists in canonical list and is active in database
 */
async function validateAIOutput(aiOutput, dbGetDepartment = null) {
  if (!aiOutput || typeof aiOutput !== 'object') {
    return {
      isValid: false,
      errorCode: 'AI_INVALID_RESPONSE',
      reason: 'AI output is empty or not an object.'
    };
  }

  const { category, departmentCode, departmentId, confidence, priority } = aiOutput;

  if (!category || typeof category !== 'string' || category.trim().length === 0) {
    return {
      isValid: false,
      errorCode: 'AI_INVALID_RESPONSE',
      reason: 'Validation failed: category field is missing or empty.'
    };
  }

  if (!departmentCode && !departmentId) {
    return {
      isValid: false,
      errorCode: 'AI_INVALID_RESPONSE',
      reason: 'Validation failed: departmentCode and departmentId are missing.'
    };
  }

  if (typeof confidence !== 'number' || isNaN(confidence) || confidence < 0.0 || confidence > 1.0) {
    return {
      isValid: false,
      errorCode: 'AI_INVALID_RESPONSE',
      reason: `Validation failed: confidence (${confidence}) must be a number between 0.0 and 1.0.`
    };
  }

  const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const normPriority = (priority || '').toUpperCase();
  if (!validPriorities.includes(normPriority)) {
    return {
      isValid: false,
      errorCode: 'AI_INVALID_RESPONSE',
      reason: `Validation failed: priority "${priority}" is invalid. Must be one of: ${validPriorities.join(', ')}.`
    };
  }

  // Resolve department to canonical entry
  const resolvedDept = resolveCanonicalDepartment(departmentCode || departmentId);
  if (!resolvedDept) {
    return {
      isValid: false,
      errorCode: 'DEPARTMENT_NOT_FOUND',
      reason: `Validation failed: predicted department "${departmentCode || departmentId}" does not exist.`
    };
  }

  // If a database department getter is provided, verify active status in Supabase
  if (typeof dbGetDepartment === 'function') {
    try {
      const dbDept = await dbGetDepartment(resolvedDept.id);
      if (!dbDept) {
        return {
          isValid: false,
          errorCode: 'DEPARTMENT_NOT_FOUND',
          reason: `Database validation failed: department "${resolvedDept.id}" does not exist in Supabase departments table.`
        };
      }
      if (dbDept.is_active === false) {
        return {
          isValid: false,
          errorCode: 'DEPARTMENT_NOT_ACTIVE',
          reason: `Database validation failed: department "${resolvedDept.name}" is currently marked inactive.`
        };
      }
    } catch (dbErr) {
      console.warn('[ROUTING VALIDATION] Department database check error:', dbErr.message);
      // If DB check failed due to transient connection, proceed with canonical definition
    }
  }

  return {
    isValid: true,
    canonicalDepartment: resolvedDept,
    normalizedPriority: normPriority
  };
}

/**
 * Determines the routing outcome and workflow status based on validated AI result and confidence policy.
 *
 * Rules (Part 8 & Part 9):
 * 1. If AI output is invalid -> AI_INVALID_RESPONSE, PENDING_ADMIN_REVIEW
 * 2. If department not found -> DEPARTMENT_NOT_FOUND, PENDING_ADMIN_REVIEW
 * 3. If confidence >= 0.85 -> ROUTED, routingMethod = AI_AUTO
 * 4. If confidence 0.70 - 0.84 -> PENDING_ADMIN_REVIEW (requires human verification)
 * 5. If confidence < 0.70 -> PENDING_ADMIN_REVIEW, AI_LOW_CONFIDENCE
 */
async function determineRoutingDecision(aiOutput, dbGetDepartment = null, customConfig = null) {
  const config = { ...ROUTING_CONFIG, ...(customConfig || {}) };

  // Validate AI output
  const validation = await validateAIOutput(aiOutput, dbGetDepartment);
  if (!validation.isValid) {
    return {
      status:         WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
      routingMethod:  'ADMIN_MANUAL',
      departmentId:   null,
      departmentCode: null,
      departmentName: null,
      errorCode:      validation.errorCode,
      requiresHumanReview: true,
      reason:         validation.reason
    };
  }

  const dept = validation.canonicalDepartment;
  const confidence = aiOutput.confidence;

  // Check if automated routing is enabled globally
  if (!config.autoRoutingEnabled) {
    return {
      status:         WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
      routingMethod:  'ADMIN_MANUAL',
      departmentId:   dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      errorCode:      null,
      requiresHumanReview: true,
      reason:         'Automated routing is temporarily disabled by administrative policy.'
    };
  }

  // Check if AI explicitly flagged requiresHumanReview
  if (aiOutput.requiresHumanReview === true) {
    return {
      status:         WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
      routingMethod:  'ADMIN_MANUAL',
      departmentId:   dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      errorCode:      'AI_HUMAN_REVIEW_FLAGGED',
      requiresHumanReview: true,
      reason:         aiOutput.reason || 'AI model flagged complaint as requiring human inspection.'
    };
  }

  // High confidence path (>= 0.85) -> ROUTED
  if (confidence >= config.highConfidenceThreshold) {
    return {
      status:         WORKFLOW_STATES.ROUTED,
      routingMethod:  'AI_AUTO',
      departmentId:   dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      errorCode:      null,
      requiresHumanReview: false,
      reason:         `High confidence match (${Math.round(confidence * 100)}% >= ${Math.round(config.highConfidenceThreshold * 100)}%) automatically routed to ${dept.name}.`
    };
  }

  // Medium confidence path (0.70 - 0.84) -> PENDING_ADMIN_REVIEW
  if (confidence >= config.adminReviewThreshold) {
    return {
      status:         WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
      routingMethod:  'ADMIN_MANUAL',
      departmentId:   dept.id,
      departmentCode: dept.code,
      departmentName: dept.name,
      errorCode:      'AI_MODERATE_CONFIDENCE',
      requiresHumanReview: true,
      reason:         `Confidence (${Math.round(confidence * 100)}%) is below automatic threshold (${Math.round(config.highConfidenceThreshold * 100)}%). Requires administrative verification.`
    };
  }

  // Low confidence path (< 0.70) -> PENDING_ADMIN_REVIEW
  return {
    status:         WORKFLOW_STATES.PENDING_ADMIN_REVIEW,
    routingMethod:  'ADMIN_MANUAL',
    departmentId:   dept.id,
    departmentCode: dept.code,
    departmentName: dept.name,
    errorCode:      'AI_LOW_CONFIDENCE',
    requiresHumanReview: true,
    reason:         `Confidence (${Math.round(confidence * 100)}%) is too low for safe routing. Flagged for admin review.`
  };
}

module.exports = {
  CANONICAL_DEPARTMENTS,
  ROUTING_CONFIG,
  resolveCanonicalDepartment,
  validateAIOutput,
  determineRoutingDecision
};
