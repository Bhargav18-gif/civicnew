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

const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://deewawxqogoejogtqmmi.supabase.co';
const rawKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY;

const supabaseUrl = (rawUrl || '').trim().replace(/^['"]|['"]$/g, '');
const serviceRoleKey = (rawKey || '').trim().replace(/^['"]|['"]$/g, '');

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
