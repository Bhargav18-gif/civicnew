/**
 * Department API Service (Supabase edition)
 *
 * All data comes from the backend API which uses Supabase PostgreSQL.
 * Engineers come from real Supabase users — no hardcoded names.
 * Firestore fallbacks removed.
 */

import api from '../../utils/api.js';
import { normalizeComplaintDoc } from '../../utils/complaintSchema.js';

export const departmentApi = {
  /**
   * Fetch complaints assigned to the specified department.
   * Backend: Supabase → complaints WHERE department_id = departmentId
   */
  async getDepartmentComplaints(departmentId) {
    const res = await api.get(`/departments/${departmentId}/complaints`);
    return (res.data?.complaints || res.data || []).map(c => normalizeComplaintDoc(c));
  },

  /**
   * Fetch active engineers for a department.
   * Backend: Supabase → users WHERE role='ENGINEER' AND department_id=X AND is_active=true
   * No hardcoded engineers — real users only.
   */
  async getDepartmentEngineers(departmentId) {
    const res = await api.get(`/departments/${departmentId}/engineers`);
    return res.data?.engineers || res.data || [];
  },

  /**
   * List all departments (from Supabase departments table).
   */
  async listDepartments() {
    const res = await api.get('/departments');
    return res.data?.departments || res.data || [];
  },

  /**
   * Assign an engineer to a complaint via secure backend transaction.
   * engineerId must be a Supabase UUID of a registered engineer user.
   */
  async assignEngineer(complaintId, engineerId) {
    const res = await api.post('/departments/assign', { complaintId, engineerId });
    return res.data;
  },

  /**
   * Department accepts incoming routed complaint.
   */
  async acceptComplaint(complaintId) {
    const res = await api.post('/departments/workflow-action', {
      complaintId,
      action: 'ACCEPT'
    });
    return res.data;
  },

  /**
   * Department rejects complaint.
   */
  async rejectComplaint(complaintId, reason) {
    const res = await api.post('/departments/workflow-action', {
      complaintId,
      action: 'REJECT',
      reason
    });
    return res.data;
  },

  /**
   * Department verifies engineer's completed work.
   * ACCEPT → CITIZEN_VERIFICATION
   * REJECT → IN_PROGRESS (rework)
   */
  async verifyWork(complaintId, decision, remarks = '') {
    const res = await api.post('/departments/verify-work', {
      complaintId,
      decision,
      remarks
    });
    return res.data;
  }
};
