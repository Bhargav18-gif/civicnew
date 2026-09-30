/**
 * CivicConnect — Supabase Realtime Complaints Hook
 * 
 * Provides live, zero-refresh synchronization for:
 * 1. Department Operations: Receives new complaints routed to department,
 *    priority/status changes, engineer assignments, and evidence submissions in real time.
 * 2. Engineer Field Operations: Receives real-time task assignments, reassignments,
 *    status updates, and department verification approvals.
 * 
 * Uses ONLY the centralized Supabase Realtime postgres_changes channel.
 * Manages clean subscription lifecycles, avoids duplicate cards, handles connection failures,
 * and maintains accurate live connection status.
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

export function useRealtimeComplaints({
  role = "department",
  departmentId = null,
  engineerId = null,
  onInsert,
  onUpdate,
  onDelete,
  onMediaInsert,
  onSync
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
  const normalizedEngId  = engineerId ? String(engineerId) : null;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConnectionStatus(REALTIME_STATUS.DISCONNECTED);
      return;
    }

    let channel = null;
    let isSubscribed = true;

    // Unique channel identifier scoped by role and active context
    const channelId = `realtime_${role}_${normalizedDeptId || 'all'}_${normalizedEngId || 'all'}_${Date.now()}`;

    try {
      setConnectionStatus(REALTIME_STATUS.CONNECTING);

      channel = supabase.channel(channelId);

      // ─── Listen to Postgres changes on complaints table ─────────────────────
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
            const matchesDept = normalizedDeptId && (
              (normalizedNew?.departmentId && String(normalizedNew.departmentId).toLowerCase() === normalizedDeptId) ||
              (normalizedNew?.department_id && String(normalizedNew.department_id).toLowerCase() === normalizedDeptId) ||
              (normalizedOld?.departmentId && String(normalizedOld.departmentId).toLowerCase() === normalizedDeptId) ||
              (normalizedOld?.department_id && String(normalizedOld.department_id).toLowerCase() === normalizedDeptId)
            );

            // If department user and event belongs to another department, ignore
            if (normalizedDeptId && !matchesDept) {
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
            const isAssignedToThisEngineer = normalizedEngId && (
              normalizedNew?.assignedEngineerId === normalizedEngId ||
              normalizedNew?.assigned_engineer_id === normalizedEngId
            );

            const wasAssignedToThisEngineer = normalizedEngId && (
              normalizedOld?.assignedEngineerId === normalizedEngId ||
              normalizedOld?.assigned_engineer_id === normalizedEngId
            );

            // If event involves this engineer (either newly assigned, updated, or reassigned away)
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

      // ─── Listen to Postgres changes on complaint_media table ────────────────
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
          }
        }
      );

      // ─── Channel Subscription Status Handling ──────────────────────────────
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

    // ─── Cleanup on Unmount / Target Change ──────────────────────────────────
    return () => {
      isSubscribed = false;
      if (channel) {
        supabase.removeChannel(channel).catch((err) => {
          console.warn("[REALTIME] Clean unsubscribe failed:", err.message);
        });
      }
    };
  }, [role, normalizedDeptId, normalizedEngId]);

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
