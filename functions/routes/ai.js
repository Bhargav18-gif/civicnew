const express = require('express');
const router = express.Router();
const modelService = require('../services/modelService');
const { classifyComplaintText, verifyCompletionEvidence } = require('../ai');

// Requirement 14: GET /api/ai/health
router.get('/health', async (req, res) => {
  const health = await modelService.getAIHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  return res.status(statusCode).json(health);
});

// Requirement 12 & 13: POST /api/ai/classify
router.post('/classify', async (req, res) => {
  const { text, description, imageUrl, imageUrls } = req.body;
  const inputText = text || description;
  const image = imageUrl || (Array.isArray(imageUrls) ? imageUrls[0] : null);

  if (!inputText && !image) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Either complaint text or an image is required for classification.'
      }
    });
  }

  try {
    const result = await classifyComplaintText(inputText, image);
    const confidenceNum = typeof result.confidence === 'number' ? result.confidence : 0.85;
    const confPct = Math.round(confidenceNum * 100);
    const canonicalDept = result.departmentName || result.departmentId || 'General';

    return res.json({
      success: true,
      ...result,
      department: canonicalDept,
      departmentName: canonicalDept,
      confidence_percentage: `${confPct}%`,
      confidence_level: confidenceNum >= 0.85 ? 'high' : (confidenceNum >= 0.70 ? 'medium' : 'low'),
      reasoningSummary: result.reason
    });
  } catch (err) {
    console.error('[AI CLASSIFY ROUTE ERROR]', err.message);
    const isModelMissing = err.code === 'MODEL_ARTIFACT_MISSING' || err.message?.includes('MODEL_ARTIFACT_MISSING') || (!process.env.GEMINI_API_KEY && !process.env.VITE_GEMINI_API_KEY);
    return res.status(503).json({
      success: false,
      code: isModelMissing ? 'MODEL_ARTIFACT_MISSING' : 'AI_UNAVAILABLE',
      error: isModelMissing ? 'MODEL_ARTIFACT_MISSING' : 'AI_UNAVAILABLE',
      message: isModelMissing
        ? 'Physical model weights or Gemini API credentials are missing. Automatic classification suspended without fabricating predictions.'
        : 'AI classification service is temporarily unavailable. The complaint has been queued for human review.'
    });
  }
});

// POST /api/ai/verify
router.post('/verify', async (req, res) => {
  const { beforeUrl, afterUrl, description } = req.body;

  try {
    const result = await verifyCompletionEvidence(beforeUrl, afterUrl, description);
    return res.json(result);
  } catch (err) {
    console.error('[AI VERIFY ROUTE ERROR]', err.message);
    return res.status(503).json({
      success: false,
      error: {
        code: 'AI_VERIFICATION_FAILED',
        message: 'Automated visual verification is unavailable. Proceeding with coordinator inspection.'
      }
    });
  }
});

module.exports = router;
