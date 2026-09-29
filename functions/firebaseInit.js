/**
 * CivicConnect — Firebase Admin Initialization
 *
 * PURPOSE: Firebase Authentication token verification ONLY.
 * Application data now lives in Supabase PostgreSQL (see functions/db.js).
 *
 * SECURITY FIXES from previous version:
 * 1. Removed fake verifyIdToken() that returned { uid: 'anonymous' } — this was a auth bypass.
 * 2. Removed hardcoded admin@civicconnect.com / admin123 credentials.
 * 3. Removed Firestore (getFirestore) — application data is in Supabase.
 * 4. Removed Web SDK bridge — unnecessary complexity now that Supabase is the DB.
 *
 * The db export is REMOVED. All callers must use functions/db.js instead.
 */

'use strict';

const { initializeApp: initAdminApp, getApps: getAdminApps } = require('firebase-admin/app');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');

let authAdmin = null;

try {
  if (getAdminApps().length === 0) {
    initAdminApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'civic-b6108'
    });
  }
  authAdmin = getAdminAuth();
  console.log('[FIREBASE INIT] Firebase Admin SDK initialized for token verification.');
} catch (e) {
  console.error('[FIREBASE INIT] Firebase Admin SDK initialization failed:', e.message);
  console.error('[FIREBASE INIT] Token verification will not work. Set FIREBASE_PROJECT_ID and ensure credentials are available.');

  // Provide a hard-failing stub so callers get a clear error instead of undefined.
  // NEVER silently accept tokens — this would be an authentication bypass.
  authAdmin = {
    async verifyIdToken(token) {
      throw new Error(
        'FIREBASE_ADMIN_UNAVAILABLE: Firebase Admin SDK failed to initialize. ' +
        'Token verification is disabled. Ensure FIREBASE_PROJECT_ID is set and ' +
        'Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS) are configured.'
      );
    }
  };
}

module.exports = {
  authAdmin
  // NOTE: 'db' is intentionally NOT exported from this file.
  // All database operations use functions/db.js (Supabase PostgreSQL).
};
