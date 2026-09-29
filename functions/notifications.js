/**
 * CivicConnect — Notifications Service (Supabase edition)
 *
 * Delegates to Supabase notifications table via db.js.
 * Maintains backward-compatible signature from old Firestore-based sendNotification.
 */

'use strict';

const { createNotification, getUserByFirebaseUid } = require('./db');

/**
 * Send a notification to a user.
 * userId can be either a Supabase UUID or a Firebase UID.
 * If a Firebase UID is provided and no supabaseUserId is given, we look it up.
 */
async function sendNotification(db, { userId, userEmail, title, message, type, complaintId }) {
  // db parameter kept for backward-compatibility but not used.
  let supabaseUserId = userId;

  // If the userId looks like a Firebase UID (not a UUID), look up the Supabase record
  if (userId && !isUUID(userId)) {
    try {
      const user = await getUserByFirebaseUid(userId);
      supabaseUserId = user?.id || null;
    } catch (e) {
      console.warn('[NOTIFICATIONS] Could not resolve Firebase UID to Supabase ID:', e.message);
      supabaseUserId = null;
    }
  }

  if (!supabaseUserId) {
    console.warn('[NOTIFICATIONS] No valid Supabase user ID — skipping notification.');
    return null;
  }

  return createNotification({
    userId:      supabaseUserId,
    complaintId: complaintId || null,
    title,
    message,
    type
  });
}

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

module.exports = { sendNotification };
