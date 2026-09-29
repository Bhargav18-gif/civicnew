/**
 * Complaint API Service (Supabase edition)
 *
 * All data comes from the backend API which uses Supabase PostgreSQL.
 * Firestore fallbacks have been removed — if the backend fails, show a real error.
 */

import api from '../../utils/api.js';
import { normalizeComplaintDoc } from '../../utils/complaintSchema.js';

export const complaintApi = {
  /**
   * Submit a new complaint through the backend.
   * Backend: POST /api/complaints → Supabase complaints table
   */
  async createComplaint(payload) {
    const res = await api.post('/complaints', payload);
    return normalizeComplaintDoc(res.data?.complaint || res.data);
  },

  /**
   * Fetch a single complaint by referenceId or UUID.
   */
  async getComplaint(id) {
    const res = await api.get(`/complaints/${id}`);
    return normalizeComplaintDoc(res.data?.complaint || res.data, id);
  },

  /**
   * Public tracking lookup (sanitized — no PII).
   */
  async trackComplaint(refId) {
    const res = await api.get(`/public/track/${refId}`);
    return res.data;
  },

  /**
   * Fetch complaints for the authenticated citizen.
   * Backend filters by Firebase UID → Supabase user ID → complaints.citizen_id
   */
  async getCitizenComplaints() {
    const res = await api.get('/user/complaints');
    return (res.data?.complaints || res.data || []).map(c => normalizeComplaintDoc(c));
  },

  /**
   * Citizen approves resolution — closes the complaint.
   */
  async approveResolution(id, feedback) {
    const res = await api.post(`/complaints/${id}/citizen-verify`, {
      decision: 'APPROVE',
      feedback
    });
    return res.data;
  },

  /**
   * Citizen reopens an unsatisfactory resolution.
   */
  async reopenComplaint(id, reason) {
    const res = await api.post(`/complaints/${id}/citizen-verify`, {
      decision: 'REOPEN',
      reason
    });
    return res.data;
  }
};
