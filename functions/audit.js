/**
 * CivicConnect — Audit Service (Supabase edition)
 *
 * Thin wrapper that delegates to db.js recordAuditEvent.
 * Maintained for backward-compatibility with existing handler imports.
 */

'use strict';

const { recordAuditEvent: dbRecordAuditEvent } = require('./db');

/**
 * Record an immutable audit event in Supabase audit_logs table.
 * Never throws — audit failures must not crash the main workflow.
 */
async function recordAuditEvent(db, {
  complaintId,
  eventType,
  actorId = 'system',
  actorRole = 'system',
  previousStatus = null,
  newStatus = null,
  metadata = {}
}) {
  // db parameter is kept for backward-compatibility but is no longer used.
  // All writes go directly to Supabase via db.js.
  return dbRecordAuditEvent({
    complaintId:      complaintId || null,
    actorId:          actorId && actorId !== 'system' ? actorId : null,
    actorFirebaseUid: null,
    actorRole,
    eventType,
    oldStatus:        previousStatus,
    newStatus,
    metadata
  });
}

module.exports = { recordAuditEvent };
