/**
 * CivicConnect — Audit Service (Supabase Architecture)
 * 
 * Provides access to immutable workflow audit logs from the Supabase audit_logs table.
 */

import { adminApi } from '../api/adminApi.js';

export const auditService = {
  getAuditLogs: (filter) => adminApi.getAuditLogs(filter),
  getComplaintTimeline: async (complaintId) => {
    const logs = await adminApi.getAuditLogs({ complaintId });
    return logs;
  },
};

export default auditService;
