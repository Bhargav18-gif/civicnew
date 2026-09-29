/**
 * Deterministic Priority Engine
 * Auditable rule-based severity escalation ensuring public safety hazards
 * receive deterministic CRITICAL or HIGH priority regardless of raw AI output.
 */

const SEVERITY_RULES = [
  {
    level: 'CRITICAL',
    keywords: [
      'exposed wire', 'live wire', 'open wire', 'high voltage', 'electrocution',
      'gas leak', 'major flood', 'flash flood', 'road collapse', 'sinkhole',
      'bridge collapse', 'building collapse', 'falling pole', 'fire hazard', 'pipeline burst'
    ],
    reason: 'Imminent threat to life and public safety detected.'
  },
  {
    level: 'HIGH',
    keywords: [
      'deep pothole', 'open manhole', 'missing manhole', 'traffic signal failure',
      'sewage overflow', 'sewer overflow', 'contaminated water', 'water supply cut',
      'complete blackout', 'broken streetlight cluster', 'hazardous waste'
    ],
    reason: 'Significant civic disruption or public health hazard.'
  },
  {
    level: 'LOW',
    keywords: [
      'graffiti', 'cosmetic', 'faint paint', 'tree pruning', 'park grass', 'bench paint', 'sign faded'
    ],
    reason: 'Non-urgent cosmetic or routine aesthetic maintenance.'
  }
];

function evaluatePriority(description = '', aiRecommendedPriority = 'MEDIUM') {
  const text = description.toLowerCase();

  // 1. Check deterministic critical rules first
  for (const rule of SEVERITY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return {
          priority: rule.level,
          escalated: rule.level !== aiRecommendedPriority?.toUpperCase(),
          ruleMatched: kw,
          reason: rule.reason
        };
      }
    }
  }

  // 2. Default to normalized AI recommendation or MEDIUM
  const normalizedAI = (aiRecommendedPriority || 'MEDIUM').toUpperCase();
  const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const finalPriority = validLevels.includes(normalizedAI) ? normalizedAI : 'MEDIUM';

  return {
    priority: finalPriority,
    escalated: false,
    ruleMatched: null,
    reason: 'Standard severity based on issue context.'
  };
}

module.exports = {
  evaluatePriority
};
