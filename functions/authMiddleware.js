/**
 * CivicConnect — Auth Middleware (Supabase edition)
 *
 * Firebase Authentication proves identity (verifies the JWT).
 * Supabase users table provides the authoritative role and department.
 *
 * Flow:
 *   Request → verifyIdToken (Firebase Admin) → lookup user in Supabase → attach req.user
 *
 * SECURITY NOTES:
 * - Role is NEVER taken from the request body or token user_metadata (user-editable).
 * - Role is ALWAYS read from the Supabase users table (server-controlled).
 * - If the user record doesn't exist in Supabase yet, role defaults to 'citizen' safely.
 */

'use strict';

const { getUserByFirebaseUid, upsertUser } = require('./db');

// Firebase Admin Auth — initialized by the caller (functions/index.js or firebaseInit.js)
let _authAdmin = null;

function setAuthAdmin(authAdmin) {
  _authAdmin = authAdmin;
}

/**
 * Global middleware: resolves Firebase token → Supabase user profile → req.user
 */
async function authenticateUser(req, res, next) {
  // ─── Test mode hook for automated test suites ───
  if (process.env.NODE_ENV === 'test' && req.headers['x-test-role']) {
    req.user = {
      uid:          req.headers['x-test-uid'] || 'test-user-uid',
      supabaseId:   req.headers['x-test-supabase-id'] || null,
      role:         req.headers['x-test-role'].toLowerCase(),
      departmentId: req.headers['x-test-department'] || null,
      name:         'Test Operator',
      email:        'test@civicconnect.com'
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split('Bearer ')[1].trim();

  if (!_authAdmin) {
    console.error('[AUTH] Firebase Admin authAdmin not initialized — cannot verify token.');
    req.user = null;
    return next();
  }

  try {
    // 1. Verify Firebase ID Token — proves identity
    const decodedToken = await _authAdmin.verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    // 2. Look up authoritative role from Supabase users table
    let supabaseUser = await getUserByFirebaseUid(firebaseUid);

    // 3. If no Supabase record, auto-create a citizen record (new user)
    if (!supabaseUser) {
      try {
        supabaseUser = await upsertUser({
          firebaseUid,
          name:  decodedToken.name || decodedToken.email?.split('@')[0] || 'Citizen',
          email: decodedToken.email || '',
          role:  'CITIZEN'
        });
      } catch (upsertErr) {
        console.warn('[AUTH] Could not auto-create Supabase user record:', upsertErr.message);
      }
    }

    // 4. Compose req.user — role always comes from Supabase (authoritative)
    req.user = {
      uid:          firebaseUid,
      supabaseId:   supabaseUser?.id || null,
      role:         (supabaseUser?.role || 'CITIZEN').toLowerCase(),
      departmentId: supabaseUser?.department_id || null,
      name:         supabaseUser?.name || decodedToken.name || '',
      email:        supabaseUser?.email || decodedToken.email || '',
      isActive:     supabaseUser?.is_active !== false
    };

    next();
  } catch (err) {
    // Invalid or expired token — do not expose details to client
    console.warn('[AUTH] Token verification failed:', err.message);
    req.user = null;
    next();
  }
}

/**
 * Require authenticated user. Returns 401 if not authenticated.
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      code: 'UNAUTHORIZED',
      message: 'Authentication is required to access this resource.'
    });
  }
  if (!req.user.isActive) {
    return res.status(403).json({
      code: 'ACCOUNT_INACTIVE',
      message: 'Your account has been deactivated. Contact support.'
    });
  }
  next();
}

/**
 * Require one or more specific roles. Admin always passes.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
    }
    const userRole = (req.user.role || '').toLowerCase();
    const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

    if (userRole === 'admin' || normalizedAllowed.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      code: 'FORBIDDEN',
      message: `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]`
    });
  };
}

/**
 * Require department role — enforces department scoping.
 * Admins bypass department check.
 */
function requireDepartment(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
  }
  const userRole = (req.user.role || '').toLowerCase();
  if (userRole === 'admin') return next();

  if (userRole === 'department') {
    const targetDept = (
      req.params.departmentId ||
      req.body.departmentId ||
      ''
    ).toLowerCase();
    const userDept = (req.user.departmentId || '').toLowerCase();

    if (targetDept && userDept && targetDept !== userDept) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: `Access denied. You belong to department '${userDept}', cannot access '${targetDept}'.`
      });
    }
    return next();
  }

  return res.status(403).json({
    code: 'FORBIDDEN',
    message: 'Department coordinator access required.'
  });
}

module.exports = {
  setAuthAdmin,
  authenticateUser,
  requireAuth,
  requireRole,
  requireDepartment
};
