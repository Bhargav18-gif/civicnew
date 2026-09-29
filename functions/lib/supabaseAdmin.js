/**
 * CivicConnect — Supabase Admin Client (Backend/Server Only)
 *
 * SECURITY: This module uses the service-role key.
 * NEVER import this from any frontend file.
 * NEVER expose SUPABASE_SERVICE_ROLE_KEY via VITE_* environment variables.
 *
 * This is used exclusively in:
 *   - functions/ (Firebase Cloud Functions / Node.js backend)
 *   - server/ (local dev Express server)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Auto-load .env or .env.local if supported and present
if (typeof process.loadEnvFile === 'function') {
  for (const envRel of ['.env', '.env.local', '../.env']) {
    const fullPath = path.resolve(__dirname, '..', '..', envRel);
    if (fs.existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath);
      } catch (e) {
        // ignore malformed lines
      }
    }
  }
}

// Resolve Supabase URL
let supabaseUrl = '';
for (const [k, v] of Object.entries(process.env)) {
  const normKey = k.trim().toUpperCase();
  if (normKey.includes('SUPABASE') && (normKey.includes('URL') || normKey.includes('HOST')) && typeof v === 'string' && v.includes('supabase.co')) {
    supabaseUrl = v.trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}
if (!supabaseUrl) {
  supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://deewawxqogoejogtqmmi.supabase.co').trim().replace(/^['"]|['"]$/g, '');
}

// Resolve Supabase Service Role Key
let serviceRoleKey = '';

// Check known key names and fuzzy match
for (const [k, v] of Object.entries(process.env)) {
  const normKey = k.trim().toUpperCase();
  if (
    normKey === 'SUPABASE_SERVICE_ROLE_KEY' ||
    normKey === 'SUPABASE_SERVICE_KEY' ||
    normKey === 'SUPABASE_SECRET_KEY' ||
    normKey === 'SUPABASE_KEY' ||
    (normKey.includes('SUPABASE') && (normKey.includes('SERVICE') || normKey.includes('ROLE') || normKey.includes('SECRET')))
  ) {
    if (typeof v === 'string' && v.trim().length > 20) {
      serviceRoleKey = v.trim().replace(/^['"]|['"]$/g, '');
      console.log(`[SUPABASE ADMIN] Detected key from env var "${k}" (len=${serviceRoleKey.length})`);
      break;
    }
  }
}

// If still not found, inspect any env variable containing a service_role JWT
if (!serviceRoleKey) {
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === 'string' && v.startsWith('eyJ') && v.includes('.')) {
      try {
        const payload = JSON.parse(Buffer.from(v.split('.')[1], 'base64').toString());
        if (payload.role === 'service_role') {
          serviceRoleKey = v.trim().replace(/^['"]|['"]$/g, '');
          console.log(`[SUPABASE ADMIN] Auto-detected service_role JWT from env var "${k}"`);
          break;
        }
      } catch (_) {}
    }
  }
}

const isConfigured = Boolean(supabaseUrl && serviceRoleKey);

console.log(`[SUPABASE ADMIN] Init: isConfigured=${isConfigured}, url=${supabaseUrl}, keyPresent=${Boolean(serviceRoleKey)}, keyLen=${serviceRoleKey ? serviceRoleKey.length : 0}`);

if (!serviceRoleKey) {
  console.warn(
    '[SUPABASE ADMIN] SUPABASE_SERVICE_ROLE_KEY environment variable is not set. ' +
    'Database operations will fail until configured in Render Environment settings.'
  );
}

/**
 * Service-role client bypasses RLS for backend operations.
 * Only instantiated server-side where environment variables are available.
 */
const baseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceRoleKey || 'placeholder-service-role-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Wrap client with proxy to provide clear error message if env is unconfigured
const supabaseAdmin = new Proxy(baseClient, {
  get(target, prop) {
    if (prop === 'isConfigured') return isConfigured;
    if (!isConfigured && (prop === 'from' || prop === 'rpc' || prop === 'storage')) {
      return () => {
        throw new Error(
          'SUPABASE_NOT_CONFIGURED: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database operations. ' +
          'Please set these environment variables in your server environment or .env file.'
        );
      };
    }
    return target[prop];
  }
});

module.exports = { supabaseAdmin };
