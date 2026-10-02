import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import { engineerApi } from "../../services/api/engineerApi.js";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";
import { WORKFLOW_STATES, STATUS_META, PRIORITY_LEVELS, ROLES } from "../../constants/workflow.js";
import { getDepartmentInfo } from "../../constants/departments.js";
import { calculateDistanceMeters, formatDistance, getDeviceLocation, getDirectionsUrl } from "../../utils/geo.js";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import OpsLayout from "../../components/layout/OpsLayout.jsx";
import EngineerTaskDetailModal from "../../components/engineer/EngineerTaskDetailModal.jsx";
import EngineerReportForm from "../../components/engineer/EngineerReportForm.jsx";
import { useRealtimeComplaints } from "../../services/realtime/useRealtimeComplaints.js";
import toast, { Toaster } from "react-hot-toast";
import {
  Wrench,
  Navigation,
  MapPin,
  Play,
  UploadCloud,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  AlertCircle,
  Eye,
  X,
  ExternalLink,
  Zap,
  Calendar,
  Building2,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  Compass,
  CheckSquare,
  Send
} from "lucide-react";

const PRIORITY_STYLES = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/30",
  HIGH: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW: "bg-slate-700 text-slate-300 border-slate-600",
};

export default function EngineerDashboard() {
  const { user } = useAuth();

  // ── Navigation & View State ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("dashboard");

  // ── Data State ───────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Live Device Location State ───────────────────────────────────────────
  const [deviceGps, setDeviceGps] = useState(null);

  // ── Search & Filter State ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [sortBy, setSortBy] = useState("PRIORITY");

  // ── Modals & Drawers ──────────────────────────────────────────────────────
  const [selectedTask, setSelectedTask] = useState(null);
  const [reportComplaintId, setReportComplaintId] = useState(null);

  const engineerName = user?.name || "Field Engineer";
  const userDept = user?.departmentId || user?.department_id || user?.department || "roads";
  const deptInfo = useMemo(() => getDepartmentInfo(userDept), [userDept]);

  // ── Retrieve device GPS on mount ─────────────────────────────────────────
  useEffect(() => {
    getDeviceLocation()
      .then(loc => setDeviceGps(loc))
      .catch(() => { }); // Non-blocking optional enhancement
  }, []);

  // ── Load tasks from Supabase ─────────────────────────────────────────────
  const loadTasks = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const list = await engineerApi.listTasks();
      const normalized = (list || []).map(t => normalizeComplaintDoc(t));
      setTasks(normalized);
    } catch (err) {
      console.error("Failed to fetch engineer tasks:", err.message);
      setError("Unable to load assigned tasks. Please check your network connection.");
      toast.error("Failed to load assigned tasks.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const engIdentifiers = useMemo(() => {
    return [user?.supabaseId, user?.id, user?.uid, user?.email].filter(Boolean);
  }, [user]);

  const isAssignedToMe = useCallback((task) => {
    if (!task) return false;
    const taskEngIds = [
      task.assignedEngineerId,
      task.assigned_engineer_id,
      task.assignedTo,
      task.assignment?.engineerId,
      task.engineer_id,
      task.engineerId,
      task.assignedEngineerEmail,
      task.assigned_engineer_email
    ].filter(Boolean).map(s => String(s).toLowerCase());

    return engIdentifiers.some(id => taskEngIds.includes(String(id).toLowerCase()));
  }, [engIdentifiers]);

  // ── Real-Time Supabase Synchronization ────────────────────────────────────
  const handleRealtimeInsert = useCallback((newTask) => {
    const norm = normalizeComplaintDoc(newTask);
    if (!isAssignedToMe(norm)) return;

    setTasks((prev) => {
      const exists = prev.some((t) => t.id === norm.id || (t.refId && t.refId === norm.refId));
      if (exists) {
        return prev.map((t) => (t.id === norm.id || t.refId === norm.refId ? { ...t, ...norm } : t));
      }
      return [norm, ...prev];
    });

    toast(`📋 New Task Assigned: ${norm.referenceId || norm.title || norm.category || 'Complaint'}`, {
      icon: "⚡",
      duration: 6000,
      style: { background: "#0c1220", color: "#2dd4bf", border: "1px solid rgba(45,212,191,0.3)" }
    });
  }, [isAssignedToMe]);

  const handleRealtimeUpdate = useCallback((updatedTask) => {
    const norm = normalizeComplaintDoc(updatedTask);
    const isStillAssignedToMe = isAssignedToMe(norm);

    if (isStillAssignedToMe) {
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === norm.id);
        if (!exists) return [norm, ...prev];
        return prev.map((t) => (t.id === norm.id ? { ...t, ...norm } : t));
      });
      setSelectedTask((curr) => (curr && curr.id === norm.id ? { ...curr, ...norm } : curr));

      if (norm.status === WORKFLOW_STATES.CLOSED || norm.status === WORKFLOW_STATES.CITIZEN_VERIFICATION) {
        toast(`✅ Work Approved: Task ${norm.referenceId || norm.trackingNumber || ''} verified by department!`, {
          icon: "🎉",
          duration: 6000,
          style: { background: "#0c1220", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }
        });
      }
    } else {
      // Reassigned to another engineer — remove from local task list
      setTasks((prev) => prev.filter((t) => t.id !== norm.id));
      setSelectedTask((curr) => (curr && curr.id === norm.id ? null : curr));
      toast(`ℹ️ Task ${norm.referenceId || norm.trackingNumber || ''} was reassigned.`, {
        icon: "🔄",
        duration: 4000,
        style: { background: "#0c1220", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.2)" }
      });
    }
  }, [isAssignedToMe]);

  const handleRealtimeDelete = useCallback((deletedTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== deletedTask.id));
    setSelectedTask((curr) => (curr && curr.id === deletedTask.id ? null : curr));
  }, []);

  const { connectionStatus, reconnect, isLive } = useRealtimeComplaints({
    role: "engineer",
    engineerIds: engIdentifiers,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete,
    onSync: () => loadTasks(true)
  });

  // ── KPI Summary Stats (Real Data) ─────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const assigned = tasks.filter(t => t.status === WORKFLOW_STATES.ASSIGNED).length;
    const accepted = tasks.filter(t => [WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, WORKFLOW_STATES.EN_ROUTE, WORKFLOW_STATES.ON_SITE].includes(t.status)).length;
    const inProgress = tasks.filter(t => t.status === WORKFLOW_STATES.IN_PROGRESS).length;
    const urgent = tasks.filter(t =>
      ["CRITICAL", "HIGH"].includes((t.priority || "").toUpperCase()) && t.status !== WORKFLOW_STATES.CLOSED
    ).length;
    const completed = tasks.filter(t =>
      [WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.DEPARTMENT_REVIEW, WORKFLOW_STATES.CITIZEN_VERIFICATION, WORKFLOW_STATES.CLOSED].includes(t.status)
    ).length;

    return { total, assigned, accepted, inProgress, urgent, completed };
  }, [tasks]);

  // ── Urgent Tasks (Top Priority Cards) ─────────────────────────────────────
  const urgentTasks = useMemo(() => {
    return tasks.filter(t =>
      ["CRITICAL", "HIGH"].includes((t.priority || "").toUpperCase()) &&
      ![WORKFLOW_STATES.CLOSED, WORKFLOW_STATES.REJECTED].includes(t.status)
    ).slice(0, 4);
  }, [tasks]);

  // ── Tab-Filtered & Sorted Work Queue ──────────────────────────────────────
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Tab filter
      if (activeTab === "active") {
        if (![WORKFLOW_STATES.ASSIGNED, WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, WORKFLOW_STATES.EN_ROUTE, WORKFLOW_STATES.ON_SITE, WORKFLOW_STATES.IN_PROGRESS].includes(t.status)) {
          return false;
        }
      } else if (activeTab === "completed") {
        if (![WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.DEPARTMENT_REVIEW, WORKFLOW_STATES.CITIZEN_VERIFICATION, WORKFLOW_STATES.CLOSED].includes(t.status)) {
          return false;
        }
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ref = (t.referenceId || t.reference_id || "").toLowerCase();
        const title = (t.title || "").toLowerCase();
        const desc = (t.description || "").toLowerCase();
        const loc = (t.address || "").toLowerCase();
        if (!ref.includes(q) && !title.includes(q) && !desc.includes(q) && !loc.includes(q)) {
          return false;
        }
      }

      // Priority
      if (filterPriority !== "ALL" && (t.priority || "MEDIUM").toUpperCase() !== filterPriority) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "PRIORITY") {
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (order[(b.priority || "MEDIUM").toUpperCase()] || 0) - (order[(a.priority || "MEDIUM").toUpperCase()] || 0);
      }
      if (sortBy === "DATE_DESC") {
        return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
      }
      if (sortBy === "DATE_ASC") {
        return new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at);
      }
      return 0;
    });
  }, [tasks, activeTab, searchQuery, filterPriority, sortBy]);

  // ── Workflow State Transitions ────────────────────────────────────────────
  async function handleStatusTransition(taskId, nextStatus) {
    setActionLoading(true);
    try {
      await engineerApi.updateStatus(taskId, nextStatus);
      toast.success(`Task status updated to ${STATUS_META[nextStatus]?.label || nextStatus}.`);
      await loadTasks(true);

      // Update current selected task modal if open
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask(prev => ({ ...prev, status: nextStatus }));
      }
    } catch (err) {
      console.error("Status update error:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to update task status.");
    } finally {
      setActionLoading(false);
    }
  }

  // ── Confirm Arrival at Target Site ─────────────────────────────────────────
  async function handleConfirmArrival(taskId, loc, dist) {
    try {
      await engineerApi.confirmArrival(taskId, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        timestamp: loc.timestamp,
        distanceMeters: dist
      });
      toast.success("Site arrival confirmed via GPS!");
    } catch (err) {
      console.warn("Could not log GPS arrival to backend:", err.message);
    }
  }

  // ── Submit Field Report ────────────────────────────────────────────────────
  async function handleSubmitReport(complaintId, reportPayload) {
    setActionLoading(true);
    try {
      const res = await engineerApi.submitReport(complaintId, reportPayload);
      toast.success(
        reportPayload.workStatus === WORKFLOW_STATES.VERIFICATION_PENDING
          ? "Completion report submitted! Awaiting department verification."
          : "Work report updated successfully."
      );
      setSelectedTask(null);
      setActiveTab("dashboard");
      await loadTasks(true);
    } catch (err) {
      console.error("Report submit error:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to submit work report.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <OpsLayout
      role={ROLES.ENGINEER}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      departmentName={deptInfo.name}
      onRefresh={() => loadTasks(true)}
      refreshing={refreshing}
      notificationCount={stats.urgent}
      liveStatus={connectionStatus}
      onReconnect={reconnect}
    >
      <Toaster position="top-right" toastOptions={{ style: { background: "#0c1220", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" } }} />

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-tight">
              Good morning, {engineerName}
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              On Duty
            </span>
            <span className={`hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${deptInfo.badgeClass}`}>
              {deptInfo.shortName} Division
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {deptInfo.tagline}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0c1322] border border-white/10 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isLive ? 'bg-teal-400' : 'bg-amber-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLive ? 'bg-teal-500' : 'bg-amber-500'}`}></span>
            </span>
            <span className="text-slate-300 font-medium">
              {isLive ? "Live Realtime" : connectionStatus === "CONNECTING" ? "Connecting..." : "Live Synced"}
            </span>
          </div>

          <button
            onClick={() => setActiveTab("report")}
            className="px-4 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black text-xs font-bold flex items-center gap-1.5 shadow-[0_0_15px_-3px_rgba(45,212,191,0.4)] transition"
          >
            <FileText size={14} />
            <span>Update Complaint</span>
          </button>

          <button
            onClick={() => loadTasks(true)}
            disabled={refreshing}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-teal-400" : ""} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* ── ERROR ALERT ──────────────────────────────────────────────────── */}
      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} />
            <span className="text-xs font-medium">{error}</span>
          </div>
          <button
            onClick={() => loadTasks(false)}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-bold text-red-200 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── SUMMARY KPI CARDS (Real Database Values) ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 mb-8">
        {/* Assigned */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-white/5 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Assigned</span>
            <FileText size={15} className="text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{loading ? "—" : stats.assigned}</span>
            <span className="text-[10px] text-slate-400">New Tickets</span>
          </div>
        </div>

        {/* Accepted */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-cyan-500/20 bg-cyan-500/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between text-cyan-300 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Accepted</span>
            <CheckCircle2 size={15} className="text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-300">{loading ? "—" : stats.accepted}</span>
            <span className="text-[10px] text-cyan-400/70">En Route / Site</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-amber-500/20 bg-amber-500/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between text-amber-300 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
            <Wrench size={15} className="text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300">{loading ? "—" : stats.inProgress}</span>
            <span className="text-[10px] text-amber-400/70">Working</span>
          </div>
        </div>

        {/* Due Today / Urgent */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-red-500/20 bg-red-500/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between text-red-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Due Today</span>
            <Zap size={15} className="text-red-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-400">{loading ? "—" : stats.urgent}</span>
            <span className="text-[10px] text-red-400/70">Urgent SLA</span>
          </div>
        </div>

        {/* Completed */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-emerald-500/20 bg-emerald-500/[0.02] backdrop-blur-md col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-emerald-300 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Completed</span>
            <CheckCircle2 size={15} className="text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-300">{loading ? "—" : stats.completed}</span>
            <span className="text-[10px] text-emerald-400/70">Submitted</span>
          </div>
        </div>
      </div>

      {/* ── TAB: REPORT UPDATE (DEDICATED FORM) ───────────────────────────── */}
      {activeTab === "report" && (
        <EngineerReportForm
          assignedTasks={tasks}
          selectedComplaintId={reportComplaintId}
          onComplaintSelect={setReportComplaintId}
          onSubmitReport={handleSubmitReport}
          loading={actionLoading}
          userId={user?.uid || user?.id}
        />
      )}

      {/* ── TAB: DASHBOARD (OVERVIEW) & MY COMPLAINTS WORK QUEUE ──────────── */}
      {(activeTab === "dashboard" || activeTab === "tasks" || activeTab === "active" || activeTab === "completed") && (
        <div className="space-y-8">
          {/* URGENT / PRIORITY WORK SECTION */}
          {activeTab === "dashboard" && urgentTasks.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    Urgent & High Priority Operations ({urgentTasks.length})
                  </h3>
                </div>
                <span className="text-xs text-amber-400 font-semibold">Fast Response Required</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {urgentTasks.map((t) => {
                  const p = (t.priority || "MEDIUM").toUpperCase();
                  const targetSla = p === "CRITICAL" ? "4 Hours" : "24 Hours";
                  const dist = (deviceGps && t.latitude && t.longitude)
                    ? calculateDistanceMeters(deviceGps.latitude, deviceGps.longitude, t.latitude, t.longitude)
                    : null;
                  const directionsUrl = getDirectionsUrl(t.latitude, t.longitude, t.address);

                  return (
                    <div
                      key={t.id}
                      className="p-5 rounded-3xl bg-[#0c1222] border border-red-500/30 hover:border-red-500/50 transition shadow-xl space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {t.referenceId || t.reference_id || `#${t.id?.substring(0, 8)}`}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${PRIORITY_STYLES[p] || PRIORITY_STYLES.MEDIUM}`}>
                            {p}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                            {t.category || "General"}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-0.5 line-clamp-1">
                            {t.title || t.description}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin size={13} className="text-teal-400 shrink-0" />
                            <span className="truncate">{t.address || "GPS Location"}</span>
                          </div>
                          {dist !== null && (
                            <span className="text-[11px] font-bold text-teal-300 shrink-0 bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                              {formatDistance(dist)} away
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                          <span>Target SLA: <strong className="text-white">{targetSla}</strong></span>
                          <StatusBadge status={t.status} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Navigation size={13} className="text-teal-400" />
                          <span>Navigate</span>
                        </a>

                        <button
                          onClick={() => setSelectedTask(t)}
                          className="py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <Wrench size={13} />
                          <span>Open Task</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MY ASSIGNED COMPLAINTS QUEUE (CARDS) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  {activeTab === "active" ? "Active Field Assignments" : activeTab === "completed" ? "Completed Work History" : "My Assigned Complaints"}
                </h3>
                <p className="text-xs text-slate-400">
                  {filteredTasks.length} complaint(s) ready for field execution
                </p>
              </div>

              {/* Filters Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search complaints..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                  />
                </div>

                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-400"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-teal-400"
                >
                  <option value="PRIORITY">Highest Priority</option>
                  <option value="DATE_DESC">Newest First</option>
                  <option value="DATE_ASC">Oldest First</option>
                </select>
              </div>
            </div>

            {/* Task Grid Cards */}
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={24} className="mx-auto text-teal-400 animate-spin" />
                <p className="text-xs text-slate-400">Loading assigned complaints from database...</p>
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="py-16 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                <CheckCircle2 size={32} className="mx-auto text-teal-400/60 mb-2" />
                <p className="text-sm font-semibold text-slate-200">No complaints found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {searchQuery || filterPriority !== "ALL"
                    ? "Try adjusting your search query or filters."
                    : "No complaints assigned to you in this view."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasks.map((t) => {
                  const p = (t.priority || "MEDIUM").toUpperCase();
                  const targetDeadline = p === "CRITICAL" ? "4 Hours" : p === "HIGH" ? "24 Hours" : "72 Hours";
                  const dist = (deviceGps && t.latitude && t.longitude)
                    ? calculateDistanceMeters(deviceGps.latitude, deviceGps.longitude, t.latitude, t.longitude)
                    : null;
                  const directionsUrl = getDirectionsUrl(t.latitude, t.longitude, t.address);

                  return (
                    <div
                      key={t.id}
                      className="p-5 rounded-3xl bg-[#0a0f1d] border border-white/10 hover:border-teal-500/40 transition shadow-xl flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {t.referenceId || t.reference_id || `#${t.id?.substring(0, 8)}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${PRIORITY_STYLES[p] || PRIORITY_STYLES.MEDIUM}`}>
                            {p}
                          </span>
                        </div>

                        <div>
                          <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                            {t.category || "General"}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-0.5 line-clamp-1">
                            {t.title || t.description}
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                          <div className="flex items-center gap-1.5 truncate">
                            <MapPin size={13} className="text-teal-400 shrink-0" />
                            <span className="truncate">{t.address || "GPS Location"}</span>
                          </div>
                          {dist !== null && (
                            <span className="text-[10px] font-bold text-teal-300 shrink-0 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                              {formatDistance(dist)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                          <span>SLA: <strong className="text-slate-200">{targetDeadline}</strong></span>
                          <StatusBadge status={t.status} />
                        </div>
                      </div>

                      {/* 3 Quick Action Buttons: [View] [Navigate] [Update] */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => setSelectedTask(t)}
                          className="py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1 transition"
                          title="View Complaint Detail"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>

                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1 transition"
                          title="Open Google Maps Directions"
                        >
                          <Navigation size={13} />
                          <span>Navigate</span>
                        </a>

                        <button
                          onClick={() => {
                            setReportComplaintId(t.id);
                            setActiveTab("report");
                          }}
                          className="py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black text-xs font-bold flex items-center justify-center gap-1 transition shadow-md"
                          title="Update Status / Submit Report"
                        >
                          <Wrench size={13} />
                          <span>Update</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: PROFILE / NOTIFICATIONS / SETTINGS ────────────────────────── */}
      {activeTab === "profile" && (
        <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 max-w-xl space-y-4">
          <h3 className="text-base font-bold text-white">Field Engineer Profile</h3>
          <div className="space-y-3 text-xs text-slate-300">
            <p><strong>Name:</strong> {engineerName}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Role:</strong> FIELD OPERATIONS ENGINEER</p>
            <p><strong>Department:</strong> {user?.departmentId || user?.department_id || "Civic Operations"}</p>
            <p><strong>GPS Status:</strong> {deviceGps ? `Active (±${deviceGps.accuracy}m)` : "Location permission not granted"}</p>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 max-w-2xl space-y-4">
          <h3 className="text-base font-bold text-white">Field Operations Notifications</h3>
          <div className="space-y-2">
            {stats.urgent > 0 ? (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                You have <strong>{stats.urgent}</strong> critical / high-priority task(s) assigned.
              </div>
            ) : (
              <p className="text-xs text-slate-400">No new urgent alerts.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 max-w-xl space-y-4">
          <h3 className="text-base font-bold text-white">Field Operations Settings</h3>
          <p className="text-xs text-slate-400">GPS location accuracy, offline cache settings, and dispatch alerts.</p>
        </div>
      )}

      {/* ── FULL COMPLAINT DETAIL MODAL (SECTIONS A-G) ─────────────────────── */}
      <EngineerTaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onStatusTransition={handleStatusTransition}
        onSubmitEvidence={handleSubmitReport}
        onConfirmArrival={handleConfirmArrival}
        onOpenReportForm={(complaintId) => {
          setSelectedTask(null);
          setReportComplaintId(complaintId);
          setActiveTab("report");
        }}
        actionLoading={actionLoading}
        userId={user?.uid || user?.id}
      />
    </OpsLayout>
  );
}
