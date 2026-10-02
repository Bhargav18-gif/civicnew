/**
 * Database & Backend Verification Helper
 * Verifies backend database records directly to ensure real persistence.
 */

import { supabaseAdmin } from '../../functions/lib/supabaseAdmin.js';

/**
 * Fetches complaint record directly from database by UUID or reference ID.
 */
export async function fetchDbComplaint(idOrRef) {
  if (!supabaseAdmin) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrRef);
  
  const query = supabaseAdmin.from('complaints').select('*');
  if (isUuid) {
    query.eq('id', idOrRef);
  } else {
    query.eq('reference_id', idOrRef);
  }
  
  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[DB HELPER] Error fetching complaint:', error.message);
    return null;
  }
  return data;
}

/**
 * Verifies complaint fields and schema integrity in database.
 */
export function verifyComplaintIntegrity(complaint) {
  const issues = [];
  if (!complaint.id) issues.push('Missing id');
  if (!complaint.reference_id && !complaint.referenceId) issues.push('Missing reference_id');
  if (!complaint.description && !complaint.issue?.description) issues.push('Missing description');
  if (!complaint.status && !complaint.workflow?.status) issues.push('Missing status');
  if (!complaint.created_at && !complaint.createdAt) issues.push('Missing created_at');
  
  return {
    valid: issues.length === 0,
    issues
  };
}
