import api from '../../utils/api.js';

export const aiApi = {
  /**
   * Secure backend classification gateway.
   * Browser NEVER calls Gemini or classifier directly with secret keys.
   */
  async classify(text, imageUrl = null) {
    if (!text || text.trim().length === 0) {
      throw new Error("Complaint text is required for AI classification.");
    }
    const res = await api.post('/ai/classify', {
      text: text.trim(),
      imageUrl
    });
    return res.data;
  },

  /**
   * Secure AI verification recommendation.
   * Compares before and after evidence server-side.
   */
  async verifyWork(complaintId, beforeUrl, afterUrl) {
    const res = await api.post('/ai/verify', {
      complaintId,
      beforeUrl,
      afterUrl
    });
    return res.data;
  },

  /**
   * Asynchronous retraining pipeline trigger.
   * Returns { jobId, status: 'QUEUED' }
   */
  async triggerRetraining(config = {}) {
    const res = await api.post('/admin/ai/retrain', config);
    return res.data;
  },

  /**
   * Retraining job progress check.
   */
  async getRetrainingStatus(jobId) {
    const res = await api.get(`/admin/ai/training-status`, {
      params: jobId ? { jobId } : {}
    });
    return res.data;
  }
};
