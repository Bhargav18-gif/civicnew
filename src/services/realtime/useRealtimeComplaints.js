/**
 * CivicConnect — Supabase Realtime Complaints Hook
 * 
 * Provides live, zero-refresh synchronization for:
 * 1. Department Operations: Receives new complaints routed to department,
 *    priority/status changes, engineer assignments, and evidence submissions in real time.
 * 2. Engineer Field Operations: Receives real-time task assignments, reassignments,
 *    status updates, and department verification approvals.
 * 
 * Uses Supabase Realtime postgres_changes channels with fallback polling & visibility sync.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../../lib/supabase.js";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";

export const REALTIME_STATUS = Object.freeze({
  CONNECTED: "CONNECTED",
  CONNECTING: "CONNECTING",
  DISCONNECTED: "DISCONNECTED",
  ERROR: "ERROR"
});

function matchesDepartment(row, targetDept) {
  if (!targetDept || targetDept === "all") return true;
  if (!row) return false;

  const target = String(targetDept).toLowerCase().trim();
  const candidates = [
    row.department_id,
    row.departmentId,
    row.department,
    row.routing?.departmentId,
    row.assignedDepartment,
    row.category,
    row.issue?.category
  ].filter(Boolean).map(s => String(s).toLowerCase().trim());

  return candidates.some(c => c === target || c.includes(target) || target.includes(c));
}

function matchesEngineer(row, engIdentifiers) {
  if (!engIdentifiers || engIdentifiers.length === 0) return true;
  if (!row) return false;

  const idList = engIdentifiers.map(id => String(id).toLowerCase().trim());
  const rowEngIds = [
    row.assigned_engineer_id,
    row.assignedEngineerId,
    row.assignedTo,
    row.assignment?.engineerId,
    row.engineer_id,
    row.engineerId,
    row.assignedEngineerEmail,
    row.assigned_engineer_email
  ].filter(Boolean).map(s => String(s).toLowerCase().trim());

  return rowEngIds.some(eid => idList.includes(eid));
}

export function useRealtimeComplaints({
  role = "department",
  departmentId = null,
  engineerId = null,
  engineerIds = [],
  onInsert,
  onUpdate,
  onDelete,
  onMediaInsert,
  onSync,
  autoSyncIntervalMs = 20000 // 20s background sync safeguard
}) {
  const [connectionStatus, setConnectionStatus] = useState(
    isSupabaseConfigured ? REALTIME_STATUS.CONNECTING : REALTIME_STATUS.DISCONNECTED
  );
  const [lastEventAt, setLastEventAt] = useState(null);

  // Store latest callbacks in refs to avoid re-subscribing on every parent render
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onMediaInsert, onSync });
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete, onMediaInsert, onSync };
  });

  const normalizedDeptId = departmentId ? String(departmentId).toLowerCase() : null;
  const engIdList = [
    engineerId,
    ...(Array.isArray(engineerIds) ? engineerIds : [engineerIds])
  ].filter(Boolean);

  const engIdKey = engIdList.map(String).sort().join("_");

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConnectionStatus(REALTIME_STATUS.DISCONNECTED);
      return;
    }

    let channel = null;
    let isSubscribed = true;

    // Unique channel identifier scoped by role and active context
    const channelId = `realtime_${role}_${normalizedDeptId || 'all'}_${engIdKey || 'all'}_${Date.now()}`;

    try {
      setConnectionStatus(REALTIME_STATUS.CONNECTING);
      channel = supabase.channel(channelId);

      // ─── 1. Listen to Postgres changes on complaints table ─────────────────
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "complaints"
        },
        (payload) => {
          if (!isSubscribed) return;
          const { eventType, new: newRow, old: oldRow } = payload;
          setLastEventAt(new Date());

          const normalizedNew = newRow ? normalizeComplaintDoc(newRow) : null;
          const normalizedOld = oldRow ? normalizeComplaintDoc(oldRow) : null;

          // ─── Department Role Scoping ───
          if (role === "department") {
            const matchesNew = matchesDepartment(normalizedNew || newRow, normalizedDeptId);
            const matchesOld = matchesDepartment(normalizedOld || oldRow, normalizedDeptId);

            if (!matchesNew && !matchesOld) {
              return;
            }

            if (eventType === "INSERT" && normalizedNew) {
              callbacksRef.current.onInsert?.(normalizedNew);
            } else if (eventType === "UPDATE" && normalizedNew) {
              callbacksRef.current.onUpdate?.(normalizedNew, normalizedOld);
            } else if (eventType === "DELETE" && normalizedOld) {
              callbacksRef.current.onDelete?.(normalizedOld);
            }
          }

          // ─── Engineer Role Scoping ───
          else if (role === "engineer") {
            const isAssignedToThisEngineer = matchesEngineer(normalizedNew || newRow, engIdList);
            const wasAssignedToThisEngineer = matchesEngineer(normalizedOld || oldRow, engIdList);

            if (isAssignedToThisEngineer || wasAssignedToThisEngineer) {
              if (eventType === "INSERT" && normalizedNew) {
                callbacksRef.current.onInsert?.(normalizedNew);
              } else if (eventType === "UPDATE" && normalizedNew) {
                callbacksRef.current.onUpdate?.(normalizedNew, normalizedOld);
              } else if (eventType === "DELETE" && normalizedOld) {
                callbacksRef.current.onDelete?.(normalizedOld);
              }
            }
          }

          // ─── Admin / Global Role Scoping ───
          else {
            if (eventType === "INSERT" && normalizedNew) {
              callbacksRef.current.onInsert?.(normalizedNew);
            } else if (eventType === "UPDATE" && normalizedNew) {
              callbacksRef.current.onUpdate?.(normalizedNew, normalizedOld);
            } else if (eventType === "DELETE" && normalizedOld) {
              callbacksRef.current.onDelete?.(normalizedOld);
            }
          }
        }
      );

      // ─── 2. Listen to Postgres changes on complaint_media table ────────────
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "complaint_media"
        },
        (payload) => {
          if (!isSubscribed) return;
          setLastEventAt(new Date());
          if (payload.new) {
            callbacksRef.current.onMediaInsert?.(payload.new);
            // Trigger auto sync to refresh full media and complaint state
            callbacksRef.current.onSync?.();
          }
        }
      );

      // ─── 3. Channel Subscription Status Handling ──────────────────────────
      channel.subscribe((status, err) => {
        if (!isSubscribed) return;

        if (status === "SUBSCRIBED") {
          setConnectionStatus(REALTIME_STATUS.CONNECTED);
        } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
          setConnectionStatus(REALTIME_STATUS.ERROR);
          console.warn(`[REALTIME] Subscription status '${status}':`, err?.message || "Reconnecting...");
        } else if (status === "CLOSED") {
          setConnectionStatus(REALTIME_STATUS.DISCONNECTED);
        }
      });
    } catch (subErr) {
      console.error("[REALTIME] Error initializing subscription:", subErr);
      setConnectionStatus(REALTIME_STATUS.ERROR);
    }

    // ─── 4. Periodic Sync Safeguard & Window Focus Sync ─────────────────────
    let syncTimer = null;
    if (autoSyncIntervalMs > 0) {
      syncTimer = setInterval(() => {
        if (isSubscribed) {
          callbacksRef.current.onSync?.();
        }
      }, autoSyncIntervalMs);
    }

    const handleFocus = () => {
      if (isSubscribed) {
        callbacksRef.current.onSync?.();
      }
    };
    window.addEventListener("focus", handleFocus);

    // ─── Cleanup on Unmount / Target Change ──────────────────────────────────
    return () => {
      isSubscribed = false;
      if (syncTimer) clearInterval(syncTimer);
      window.removeEventListener("focus", handleFocus);
      if (channel) {
        supabase.removeChannel(channel).catch((err) => {
          console.warn("[REALTIME] Clean unsubscribe failed:", err.message);
        });
      }
    };
  }, [role, normalizedDeptId, engIdKey, autoSyncIntervalMs]);

  const reconnect = useCallback(() => {
    setConnectionStatus(REALTIME_STATUS.CONNECTING);
    callbacksRef.current.onSync?.();
  }, []);

  return {
    connectionStatus,
    isLive: connectionStatus === REALTIME_STATUS.CONNECTED,
    lastEventAt,
    reconnect
  };
}

export default useRealtimeComplaints;
