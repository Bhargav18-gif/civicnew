/**
 * CivicConnect — AI Service (Supabase Architecture)
 * 
 * Provides configuration, model versions, and retraining triggers
 * for the AI classification & routing system.
 */

import { aiApi } from '../api/aiApi.js';

export const aiService = {
  getAiConfig: () => aiApi.getConfig(),
  updateAiConfig: (config) => aiApi.updateConfig(config),
  getModelVersions: () => aiApi.getModelVersions(),
  triggerRetraining: (payload) => aiApi.triggerRetraining(payload),
};

export default aiService;
