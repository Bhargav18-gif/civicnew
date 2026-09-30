/**
 * Engineer API Service (Supabase edition)
 *
 * All data comes from the backend API which uses Supabase PostgreSQL.
 * Firestore fallbacks removed.
 */

import api from '../../utils/api.js';
import { normalizeComplaintDoc } from '../../utils/complaintSchema.js';

export const engineerApi = {
  /**
   * List tasks assigned to the authenticated engineer.
   * Backend: Supabase → complaints WHERE assigned_engineer_id = engineer.supabase_id
   * Database-level filtering — not client-side.
   */
  async listTasks() {
    const res = await api.get('/engineer/tasks');
    return (res.data?.tasks || res.data || []).map(t => normalizeComplaintDoc(t));
  },

  /**
   * Get single complaint detail with media and full timeline.
   */
  async getComplaintDetail(complaintId) {
    const res = await api.get(`/complaints/${complaintId}`);
    return res.data?.complaint ? normalizeComplaintDoc(res.data.complaint) : null;
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
   * Confirm engineer GPS arrival at target site.
   */
  async confirmArrival(complaintId, gpsData) {
    const res = await api.post('/engineer/arrival', {
      complaintId,
      gps: gpsData
    });
    return res.data;
  },

  /**
   * Submit structured field work report.
   */
  async submitReport(complaintId, reportPayload) {
    const res = await api.post('/engineer/report', {
      complaintId,
      ...reportPayload
    });
    return res.data;
  },

  /**
   * Submit repair completion evidence.
   * afterMedia: array of { url, caption? } or plain URL strings
   */
  async submitEvidence(complaintId, afterMedia, completionNotes, partsUsed = []) {
    const res = await api.post('/engineer/evidence', {
      complaintId,
      afterMedia,
      completionNotes,
      partsUsed
    });
    return res.data;
  },

  /**
   * Backwards compatible completion submit.
   */
  async submitCompletionEvidence(complaintId, { photos, notes, partsUsed = [], beforePhotos = [], gpsConfirmation = null }) {
    return this.submitReport(complaintId, {
      afterMedia: (photos || []).map(url => ({ url: typeof url === 'string' ? url : url.url, caption: 'Repair Photo' })),
      beforeMedia: (beforePhotos || []).map(url => ({ url: typeof url === 'string' ? url : url.url, caption: 'Before Repair Photo' })),
      completionNotes: notes,
      materialsUsed: partsUsed,
      gpsConfirmation
    });
  }
};
