/**
 * Admin API Service (Supabase edition)
 *
 * All statistics and data come from the backend API which queries Supabase PostgreSQL.
 * Firestore fallbacks removed — if the backend fails, surface a real error.
 * No hardcoded statistics.
 */

import api from '../../utils/api.js';
import { normalizeComplaintDoc } from '../../utils/complaintSchema.js';

export const adminApi = {
  /**
   * Fetch aggregate admin system metrics from Supabase.
   */
  async getStats() {
    const res = await api.get('/admin/stats');
    return res.data;
  },

  /**
   * Fetch all complaints with optional filtering.
   */
  async getComplaints(params = {}) {
    const res = await api.get('/admin/issues', { params });
    const list = res.data?.issues || res.data || [];
    return list.map(c => normalizeComplaintDoc(c));
  },

  /**
   * Admin exception queues (AI_FAILED, PENDING_ADMIN_REVIEW, REOPENED).
   */
  async getExceptions() {
    const res = await api.get('/admin/exceptions');
    return res.data;
  },

  /**
   * Admin overrides AI classification decision.
   */
  async overrideAI(complaintId, { category, department, priority, reason }) {
    const res = await api.post(`/admin/issues/${complaintId}/override-ai`, {
      category,
      department,
      priority,
      reason
    });
    return res.data;
  },

  /**
   * Admin retries AI triage on a failed or review-pending complaint.
   */
  async retryAITriage(complaintId) {
    const res = await api.post(`/admin/issues/${complaintId}/retry-ai`);
    return res.data;
  },

  /**
   * Get immutable audit log history from Supabase.
   */
  async getAuditLogs(maxCount = 100) {
    const res = await api.get('/admin/audit-logs', { params: { limit: maxCount } });
    return res.data?.logs || res.data || [];
  },

  /**
   * Get system AI routing configuration.
   */
  async getAIConfig() {
    const res = await api.get('/admin/automation-config');
    return res.data;
  },

  /**
   * Update system AI routing thresholds.
   */
  async updateAIConfig(config) {
    const res = await api.post('/admin/automation-config', config);
    return res.data;
  },

  /**
   * Model registry versions from on-disk artifacts.
   */
  async getModelVersions() {
    const res = await api.get('/admin/model/versions');
    return res.data;
  },

  /**
   * Rollback model to previous production version.
   */
  async rollbackModel(versionId) {
    const res = await api.post('/admin/model/rollback', { versionId });
    return res.data;
  },

  /**
   * List users from Supabase.
   */
  async getUsers(params = {}) {
    const res = await api.get('/admin/users', { params });
    return res.data?.users || res.data || [];
  }
};
