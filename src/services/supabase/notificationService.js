/**
 * CivicConnect — Notification Service (Supabase Architecture)
 * 
 * Provides access to citizen/staff notifications stored in the Supabase notifications table.
 */

import { notificationApi } from '../api/notificationApi.js';

export const notificationService = {
  getNotifications: () => notificationApi.getNotifications(),
  markAsRead: (id) => notificationApi.markAsRead(id),
  markAllAsRead: () => notificationApi.markAllAsRead(),
};

export default notificationService;
