/**
 * CivicConnect — Supabase Client (Frontend)
 *
 * Uses ONLY the publishable/anon key (VITE_SUPABASE_PUBLISHABLE_KEY).
 * The service-role key is NEVER used in browser code.
 *
 * Firebase Authentication is the identity provider.
 * Supabase PostgreSQL is the application database.
 * Row Level Security is enforced via backend API calls — the frontend client
 * is used only for read operations that are safe under RLS.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  console.error(
    '[SUPABASE] VITE_SUPABASE_URL is not set. ' +
    'Add it to your .env file. Application data will not load.'
  );
}

if (!supabaseKey) {
  console.error(
    '[SUPABASE] VITE_SUPABASE_PUBLISHABLE_KEY is not set. ' +
    'Add it to your .env file. Application data will not load.'
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

/**
 * The Supabase client for frontend use.
 * Uses the anon/publishable key — safe to expose in the browser.
 * All sensitive writes go through the backend API, which uses the service-role key.
 */
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      // Do NOT use Supabase Auth — Firebase Auth is the authentication provider.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

export default supabase;
