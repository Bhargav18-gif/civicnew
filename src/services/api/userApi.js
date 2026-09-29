/**
 * User API Service (Supabase edition)
 *
 * All user data stored in Supabase PostgreSQL users table.
 * Reads go through the backend API.
 * Firestore removed.
 */

import api from '../../utils/api.js';

export const userApi = {
  /**
   * Fetch user profile by Firebase UID.
   * Backend: Supabase → users WHERE firebase_uid = uid
   */
  async getProfile(uid) {
    const res = await api.get(`/users/${uid}`);
    return res.data?.user || res.data;
  },

  /**
   * Admin: List users with optional role filter.
   * Backend: Supabase → users table
   */
  async listUsers(role = null) {
    const res = await api.get('/admin/users', { params: role ? { role } : {} });
    return res.data?.users || res.data || [];
  },

  /**
   * Admin: Update user role / department assignment.
   * Role changes must go through the backend — never trust frontend role claims.
   */
  async updateUserRole(uid, { role, departmentId }) {
    const res = await api.post(`/admin/users/${uid}/role`, { role, departmentId });
    return res.data;
  }
};
