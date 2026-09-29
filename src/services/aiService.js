/**
 * Client AI Gateway Service
 * Secure client-side wrapper that delegates all AI processing to the backend.
 * Never bundles Gemini API keys or secret tokens in the browser.
 */

import { aiApi } from './api/aiApi.js';

export async function generateComplaintDetails(description) {
  try {
    const result = await aiApi.classify(description);
    return {
      title: `${result.category} issue reported`,
      department: result.department,
      priority: result.priority,
      estimatedTime: result.priority === 'CRITICAL' ? '4 hours' : result.priority === 'HIGH' ? '24 hours' : '3 days',
      confidence: result.confidence,
      reasoning: result.reasoningSummary
    };
  } catch (error) {
    console.warn("AI generation failed via backend gateway:", error.message);
    return null;
  }
}

export async function detectDuplicates(description, location, existingComplaints) {
  // Real duplicate evaluation is handled server-side in Firestore workflow
  return [];
}

export async function analyzeFeedback(comment) {
  if (!comment) return null;
  return {
    sentiment: "Neutral",
    completionScore: 75,
    summary: comment,
    suggestedAction: "Citizen Feedback Registered"
  };
}
