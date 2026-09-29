const { GoogleGenAI, Type } = require('@google/genai');
const axios = require('axios');

// Secure server-side Gemini client
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
let aiClient = null;
if (apiKey && apiKey !== 'YOUR_API_KEY_HERE') {
  aiClient = new GoogleGenAI({ apiKey });
}

const CANONICAL_DEPARTMENTS = [
  'roads',
  'water',
  'electricity',
  'garbage',
  'drainage',
  'health',
  'transport',
  'public_safety'
];

/**
 * Classifies an incoming civic complaint using server-side Gemini AI.
 * Returns validated structured JSON or throws error. Never fakes success.
 */
async function classifyComplaintText(text, imageUrl = null) {
  if (!text || text.trim().length === 0) {
    throw new Error("Complaint text is required for AI classification.");
  }

  if (!aiClient) {
    const err = new Error("MODEL_ARTIFACT_MISSING: AI model weights and Gemini API credentials are not configured.");
    err.code = "MODEL_ARTIFACT_MISSING";
    throw err;
  }

  const prompt = `You are the CivicConnect Autonomous AI Triage Classifier.
Analyze this civic issue report and categorize it into the single best municipal department.
Available departments: ${CANONICAL_DEPARTMENTS.join(', ')}.

Input Report: "${text}"

You must return a JSON object adhering to:
- category: A concise category name (e.g., Road Damage, Streetlight Outage, Water Leakage).
- department: Exactly one of [${CANONICAL_DEPARTMENTS.join(', ')}].
- priority: One of ["LOW", "MEDIUM", "HIGH", "CRITICAL"].
- confidence: A decimal float strictly between 0.0 and 1.0 representing classification confidence.
- requiresHumanReview: Boolean, true if ambiguous, low confidence, or unusual.
- reasoningSummary: A concise 1-2 sentence explanation of your decision.`;

  const parts = [{ text: prompt }];

  if (imageUrl) {
    try {
      const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
      const mimeType = imgRes.headers['content-type'] || 'image/jpeg';
      const base64Data = Buffer.from(imgRes.data).toString('base64');
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType
        }
      });
    } catch (imgErr) {
      console.warn("Could not download image for multimodal AI classification:", imgErr.message);
    }
  }

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: parts,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          department: { type: Type.STRING },
          priority: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          requiresHumanReview: { type: Type.BOOLEAN },
          reasoningSummary: { type: Type.STRING }
        },
        required: ['category', 'department', 'priority', 'confidence', 'requiresHumanReview', 'reasoningSummary']
      }
    }
  });

  let rawText = response.text;
  if (!rawText) {
    throw new Error("AI_INVALID_RESPONSE: Model returned empty content.");
  }

  if (rawText.startsWith('```json')) {
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  const parsed = JSON.parse(rawText);

  // Validate department matches canonical
  const deptLower = (parsed.department || '').toLowerCase().replace(/[\s-]/g, '_');
  const matchedDept = CANONICAL_DEPARTMENTS.includes(deptLower) ? deptLower : 'roads';

  const normalizedConfidence = Math.min(1.0, Math.max(0.0, Number(parsed.confidence) || 0.5));

  return {
    category: parsed.category || "General Issue",
    department: matchedDept,
    priority: (parsed.priority || "MEDIUM").toUpperCase(),
    confidence: Number(normalizedConfidence.toFixed(2)),
    requiresHumanReview: Boolean(parsed.requiresHumanReview || normalizedConfidence < 0.70),
    reasoningSummary: parsed.reasoningSummary || "Classified via CivicConnect AI Gateway.",
    modelVersion: "civicconnect-v2.1-flash"
  };
}

/**
 * Compares before and after repair evidence to provide an advisory recommendation.
 * AI never automatically closes complaints.
 */
async function verifyCompletionEvidence(beforeUrl, afterUrl, description = '') {
  if (!beforeUrl || !afterUrl) {
    throw new Error("Both before and after evidence URLs are required for comparison.");
  }

  if (!aiClient) {
    throw new Error("AI_UNAVAILABLE: AI gateway is not configured for image verification.");
  }

  const prompt = `You are a Municipal Quality Assurance AI Inspector.
Compare the initial civic problem photo (before) with the repair completion photo (after).
Original Issue: "${description}"

Determine whether the reported physical damage has been satisfactorily resolved.
Return JSON with:
- resolved: Boolean (true if resolved, false if work appears incomplete or defective)
- confidence: Float (0.0 to 1.0)
- reasoning: Concise 1-2 sentence assessment
- recommendation: "ACCEPT" or "REJECT_FOR_REWORK"`;

  const parts = [{ text: prompt }];

  // Fetch before image
  try {
    const bRes = await axios.get(beforeUrl, { responseType: 'arraybuffer', timeout: 8000 });
    parts.push({
      inlineData: {
        data: Buffer.from(bRes.data).toString('base64'),
        mimeType: bRes.headers['content-type'] || 'image/jpeg'
      }
    });
  } catch (e) {
    console.warn("Failed to load before image for verification:", e.message);
  }

  // Fetch after image
  try {
    const aRes = await axios.get(afterUrl, { responseType: 'arraybuffer', timeout: 8000 });
    parts.push({
      inlineData: {
        data: Buffer.from(aRes.data).toString('base64'),
        mimeType: aRes.headers['content-type'] || 'image/jpeg'
      }
    });
  } catch (e) {
    console.warn("Failed to load after image for verification:", e.message);
  }

  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: parts,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          resolved: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING },
          recommendation: { type: Type.STRING }
        },
        required: ['resolved', 'confidence', 'reasoning', 'recommendation']
      }
    }
  });

  let rawText = response.text;
  if (rawText.startsWith('```json')) {
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  return JSON.parse(rawText);
}

module.exports = {
  classifyComplaintText,
  verifyCompletionEvidence,
  CANONICAL_DEPARTMENTS
};
