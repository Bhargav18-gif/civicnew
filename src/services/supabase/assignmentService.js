/**
 * CivicConnect — Assignment Service (Supabase Architecture)
 * 
 * Provides field engineer workflows: listing assigned complaints,
 * state machine transitions, and photo evidence submission.
 */

import { engineerApi } from '../api/engineerApi.js';

export const assignmentService = {
  getEngineerTasks: () => engineerApi.listTasks(),
  updateTaskStatus: (complaintId, status, notes) => engineerApi.updateStatus(complaintId, status, notes),
  submitEvidence: (complaintId, evidence) => engineerApi.submitEvidence(complaintId, evidence),
};

export default assignmentService;
