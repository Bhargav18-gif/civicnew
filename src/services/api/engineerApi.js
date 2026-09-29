/**
 * Engineer API Service (Supabase edition)
 *
 * All data comes from the backend API which uses Supabase PostgreSQL.
 * Firestore fallbacks removed.
 */

import api from '../../utils/api.js';

export const engineerApi = {
  /**
   * List tasks assigned to the authenticated engineer.
   * Backend: Supabase → complaints WHERE assigned_engineer_id = engineer.supabase_id
   * Database-level filtering — not client-side.
   */
  async listTasks() {
    const res = await api.get('/engineer/tasks');
    return res.data?.tasks || res.data || [];
  },

  /**
   * Update complaint workflow status (engineer state transitions).
   * ASSIGNED → ACCEPTED_BY_ENGINEER → EN_ROUTE → ON_SITE → IN_PROGRESS
   */
  async updateStatus(complaintId, status, notes = '') {
    const res = await api.post('/engineer/status', { complaintId, status, notes });
    return res.data;
  },

  /**
   * Submit repair completion evidence.
   * Requires at least one after photo and detailed completion notes.
   */
  async submitEvidence(complaintId, afterMedia, completionNotes, partsUsed = []) {
    const res = await api.post('/engineer/evidence', {
      complaintId,
      afterMedia,
      completionNotes,
      partsUsed
    });
    return res.data;
  }
};
