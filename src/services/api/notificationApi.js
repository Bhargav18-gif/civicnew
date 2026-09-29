/**
 * Notification API Service (Supabase edition)
 *
 * All notifications are stored in Supabase PostgreSQL.
 * Reads and writes go through the backend API.
 * Firestore removed.
 */

import api from '../../utils/api.js';

export const notificationApi = {
  /**
   * Fetch notifications for the authenticated user.
   * Backend: Supabase → notifications WHERE user_id = currentUser.supabaseId
   */
  async getMyNotifications() {
    const res = await api.get('/user/notifications');
    return res.data?.notifications || res.data || [];
  },

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId) {
    const res = await api.post(`/notifications/${notificationId}/read`);
    return res.data;
  }
};
