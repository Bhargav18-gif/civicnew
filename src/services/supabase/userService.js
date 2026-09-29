/**
 * CivicConnect — User Service (Supabase Architecture)
 * 
 * Manages user profile and synchronization between Firebase Auth UID
 * and Supabase users table.
 */

import { userApi } from '../api/userApi.js';

export const userService = {
  syncUser: (userData) => userApi.syncUser(userData),
  getProfile: () => userApi.getProfile(),
  updateProfile: (data) => userApi.updateProfile(data),
};

export default userService;
