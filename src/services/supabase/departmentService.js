/**
 * CivicConnect — Department Service (Supabase Architecture)
 * 
 * Provides access to department-level complaint management, real engineer assignment,
 * and resolution verification.
 */

import { departmentApi } from '../api/departmentApi.js';
import { supabase, isSupabaseConfigured } from '../../lib/supabase.js';

export const departmentService = {
  /**
   * List all canonical departments. Can query Supabase public table directly
   * or fall back to backend API.
   */
  async listDepartments() {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('*')
          .eq('is_active', true);
        if (!error && data && data.length > 0) return data;
      } catch (e) {
        // fall back to API
      }
    }
    return departmentApi.listDepartments();
  },

  getDepartmentComplaints: (deptId) => departmentApi.getDepartmentComplaints(deptId),
  getDepartmentEngineers: (deptId) => departmentApi.getDepartmentEngineers(deptId),
  assignEngineer: (complaintId, engineerId, deptId) => departmentApi.assignEngineer(complaintId, engineerId, deptId),
  verifyResolution: (complaintId, payload) => departmentApi.verifyResolution(complaintId, payload),
};

export default departmentService;
