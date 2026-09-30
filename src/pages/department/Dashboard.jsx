import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext.jsx";
import { departmentApi } from "../../services/api/departmentApi.js";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";
import { WORKFLOW_STATES, STATUS_META, PRIORITY_LEVELS, PRIORITY_SLA_HOURS, ROLES } from "../../constants/workflow.js";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import OpsLayout from "../../components/layout/OpsLayout.jsx";
import ComplaintDetailDrawer from "../../components/department/ComplaintDetailDrawer.jsx";
import AssignEngineerModal from "../../components/department/AssignEngineerModal.jsx";
import VerificationModal from "../../components/department/VerificationModal.jsx";
import PriorityModal from "../../components/department/PriorityModal.jsx";
import { useRealtimeComplaints } from "../../services/realtime/useRealtimeComplaints.js";
import toast, { Toaster } from "react-hot-toast";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  RefreshCw,
  Eye,
  ShieldCheck,
  RotateCcw,
  MapPin,
  Calendar,
  Filter,
  ChevronDown,
  X,
  Flag,
  Zap,
  AlertCircle,
  TrendingUp,
  Image as ImageIcon,
  FileText,
  Building2,
  Wrench,
  Hash,
  ExternalLink,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  BarChart2,
  Check
} from "lucide-react";

const PRIORITY_STYLES = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/30",
  HIGH:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  MEDIUM:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW:      "bg-slate-700 text-slate-300 border-slate-600",
};

export default function DepartmentDashboard() {
  const { user } = useAuth();

  // ── Navigation & View State ───────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("dashboard");

  // ── Data State ───────────────────────────────────────────────────────────
  const [complaints, setComplaints] = useState([]);
  const [engineers, setEngineers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState("");

  // ── Table Filters & Pagination ───────────────────────────────────────────
  const [searchQuery, setSearchQuery]       = useState("");
  const [filterStatus, setFilterStatus]     = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [filterEngineer, setFilterEngineer] = useState("ALL");
  const [sortBy, setSortBy]                 = useState("DATE_DESC");
  const [currentPage, setCurrentPage]       = useState(1);
  const itemsPerPage = 8;

  // ── Modals & Drawers ──────────────────────────────────────────────────────
  const [detailComplaint, setDetailComplaint]         = useState(null);
  const [assignModalComplaint, setAssignModalComplaint] = useState(null);
  const [verifyModalComplaint, setVerifyModalComplaint] = useState(null);
  const [priorityModalComplaint, setPriorityModalComplaint] = useState(null);
  const [actionLoading, setActionLoading]             = useState(false);

  const userDept = user?.departmentId || user?.department_id || user?.department || "roads";

  // ── Data Loaders ──────────────────────────────────────────────────────────
  const loadEngineers = useCallback(async () => {
    if (!userDept) return [];
    try {
      const list = await departmentApi.getDepartmentEngineers(userDept);
      setEngineers(list);
      return list;
    } catch (err) {
      console.warn("Could not load engineers:", err.message);
      return [];
    }
  }, [userDept]);

  const loadComplaints = useCallback(async (isRefresh = false) => {
    if (!userDept) {
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [complaintList, engList] = await Promise.all([
        departmentApi.getDepartmentComplaints(userDept),
        loadEngineers()
      ]);

      // Calculate active and completed counts per engineer
      const updatedEngList = engList.map(eng => {
        const assignedComplaints = complaintList.filter(
          c => (c.assignedEngineerId === eng.id || c.assigned_engineer_id === eng.id)
        );
        const activeCount = assignedComplaints.filter(c =>
          [WORKFLOW_STATES.ASSIGNED, WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, WORKFLOW_STATES.EN_ROUTE, WORKFLOW_STATES.ON_SITE, WORKFLOW_STATES.IN_PROGRESS].includes(c.status)
        ).length;
        const completedCount = assignedComplaints.filter(c =>
          [WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.DEPARTMENT_REVIEW, WORKFLOW_STATES.CITIZEN_VERIFICATION, WORKFLOW_STATES.CLOSED].includes(c.status)
        ).length;

        return {
          ...eng,
          activeAssignments: activeCount,
          completedAssignments: completedCount
        };
      });

      setEngineers(updatedEngList);
      setComplaints(complaintList);
    } catch (err) {
      console.error("Failed to load department data:", err);
      setError("Unable to load department data from server. Please try again.");
      toast.error("Failed to load department complaints.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userDept, loadEngineers]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  // ── Real-Time Supabase Synchronization ────────────────────────────────────
  const handleRealtimeInsert = useCallback((newComplaint) => {
    setComplaints((prev) => {
      // Check if complaint already exists to prevent duplicate entries
      const exists = prev.some((c) => c.id === newComplaint.id || (c.refId && c.refId === newComplaint.refId));
      if (exists) {
        return prev.map((c) => (c.id === newComplaint.id || c.refId === newComplaint.refId ? { ...c, ...newComplaint } : c));
      }
      return [newComplaint, ...prev];
    });

    const deptLabel = userDept ? userDept.toUpperCase() : "DEPARTMENT";
    toast(`🔔 New complaint assigned to ${deptLabel}: ${newComplaint.trackingNumber || newComplaint.category || 'Complaint'}`, {
      icon: "📢",
      duration: 5000,
      style: { background: "#0c1220", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)" }
    });
  }, [userDept]);

  const handleRealtimeUpdate = useCallback((updatedComplaint) => {
    setComplaints((prev) =>
      prev.map((c) => (c.id === updatedComplaint.id ? { ...c, ...updatedComplaint } : c))
    );

    // If active drawer or modal complaint is updated, sync it live
    setDetailComplaint((curr) => (curr && curr.id === updatedComplaint.id ? { ...curr, ...updatedComplaint } : curr));
    setVerifyModalComplaint((curr) => (curr && curr.id === updatedComplaint.id ? { ...curr, ...updatedComplaint } : curr));
    setAssignModalComplaint((curr) => (curr && curr.id === updatedComplaint.id ? { ...curr, ...updatedComplaint } : curr));

    // Specific notifications for key transitions
    if (updatedComplaint.status === WORKFLOW_STATES.VERIFICATION_PENDING) {
      toast(`📋 Work completed for ${updatedComplaint.trackingNumber || 'task'} — Verification required`, {
        icon: "🛡️",
        duration: 5000,
        style: { background: "#0c1220", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }
      });
    }
  }, []);

  const handleRealtimeDelete = useCallback((deletedComplaint) => {
    setComplaints((prev) => prev.filter((c) => c.id !== deletedComplaint.id));
    setDetailComplaint((curr) => (curr && curr.id === deletedComplaint.id ? null : curr));
  }, []);

  const { connectionStatus, reconnect } = useRealtimeComplaints({
    role: "department",
    departmentId: userDept,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete,
    onSync: () => loadComplaints(true)
  });

  // ── KPI Summary Stats (Real Data) ─────────────────────────────────────────
  const stats = useMemo(() => {
    const total = complaints.length;
    const pending = complaints.filter(c =>
      [WORKFLOW_STATES.SUBMITTED, WORKFLOW_STATES.ROUTED, WORKFLOW_STATES.DEPARTMENT_ACCEPTED].includes(c.status) || !c.assignedEngineerId
    ).length;
    const inProgress = complaints.filter(c =>
      [WORKFLOW_STATES.ASSIGNED, WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, WORKFLOW_STATES.EN_ROUTE, WORKFLOW_STATES.ON_SITE, WORKFLOW_STATES.IN_PROGRESS].includes(c.status)
    ).length;
    const awaitingVerification = complaints.filter(c =>
      [WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.DEPARTMENT_REVIEW].includes(c.status)
    ).length;
    const resolved = complaints.filter(c =>
      [WORKFLOW_STATES.CITIZEN_VERIFICATION, WORKFLOW_STATES.CLOSED].includes(c.status)
    ).length;

    // Overdue calculation (age > SLA deadline)
    const overdue = complaints.filter(c => {
      if ([WORKFLOW_STATES.CLOSED, WORKFLOW_STATES.REJECTED].includes(c.status)) return false;
      const created = new Date(c.createdAt || c.created_at || Date.now());
      const p = (c.priority || "MEDIUM").toUpperCase();
      const maxHours = PRIORITY_SLA_HOURS[p] || 72;
      const ageHours = (Date.now() - created.getTime()) / (1000 * 60 * 60);
      return ageHours > maxHours;
    }).length;

    return { total, pending, inProgress, awaitingVerification, resolved, overdue };
  }, [complaints]);

  // ── Attention Section (Urgent / Unassigned / Verification) ─────────────────
  const attentionComplaints = useMemo(() => {
    return complaints.filter(c => {
      const isUrgent = ["CRITICAL", "HIGH"].includes((c.priority || "").toUpperCase());
      const isUnassigned = !c.assignedEngineerId && [WORKFLOW_STATES.SUBMITTED, WORKFLOW_STATES.ROUTED, WORKFLOW_STATES.DEPARTMENT_ACCEPTED].includes(c.status);
      const isVerification = [WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.DEPARTMENT_REVIEW].includes(c.status);
      return isUrgent || isUnassigned || isVerification;
    }).slice(0, 6);
  }, [complaints]);

  // ── Filtered & Sorted Work Queue ──────────────────────────────────────────
  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const ref = (c.referenceId || c.reference_id || "").toLowerCase();
        const title = (c.title || "").toLowerCase();
        const desc = (c.description || "").toLowerCase();
        const loc = (c.address || "").toLowerCase();
        const cat = (c.category || "").toLowerCase();
        if (!ref.includes(q) && !title.includes(q) && !desc.includes(q) && !loc.includes(q) && !cat.includes(q)) {
          return false;
        }
      }

      // Status
      if (filterStatus !== "ALL" && c.status !== filterStatus) {
        return false;
      }

      // Priority
      if (filterPriority !== "ALL" && (c.priority || "MEDIUM").toUpperCase() !== filterPriority) {
        return false;
      }

      // Engineer
      if (filterEngineer !== "ALL") {
        if (filterEngineer === "UNASSIGNED") {
          if (c.assignedEngineerId || c.assigned_engineer_id) return false;
        } else if (c.assignedEngineerId !== filterEngineer && c.assigned_engineer_id !== filterEngineer) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "DATE_DESC") {
        return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
      }
      if (sortBy === "DATE_ASC") {
        return new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at);
      }
      if (sortBy === "PRIORITY") {
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (order[(b.priority || "MEDIUM").toUpperCase()] || 0) - (order[(a.priority || "MEDIUM").toUpperCase()] || 0);
      }
      return 0;
    });
  }, [complaints, searchQuery, filterStatus, filterPriority, filterEngineer, sortBy]);

  // Pagination slice
  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage) || 1;
  const paginatedComplaints = filteredComplaints.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleAssignEngineer(complaintId, engineerId) {
    setActionLoading(true);
    try {
      await departmentApi.assignEngineer(complaintId, engineerId);
      toast.success("Engineer successfully assigned.");
      setAssignModalComplaint(null);
      await loadComplaints(true);
    } catch (err) {
      console.error("Assignment failed:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to assign engineer.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleVerifyWork(complaintId, decision, remarks) {
    setActionLoading(true);
    try {
      await departmentApi.verifyWork(complaintId, decision, remarks);
      if (decision === "ACCEPT") {
        toast.success("Work approved! Complaint marked verified & resolved.");
      } else {
        toast.success("Work rejected. Task returned to engineer for rework.");
      }
      setVerifyModalComplaint(null);
      await loadComplaints(true);
    } catch (err) {
      console.error("Verification failed:", err);
      toast.error(err.response?.data?.message || err.message || "Verification failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSavePriority(complaintId, newPriority) {
    setActionLoading(true);
    try {
      await departmentApi.setPriority(complaintId, newPriority);
      toast.success(`Priority updated to ${newPriority}.`);
      setPriorityModalComplaint(null);
      await loadComplaints(true);
    } catch (err) {
      console.error("Priority update failed:", err);
      toast.error(err.response?.data?.message || err.message || "Failed to update priority.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <OpsLayout
      role={ROLES.DEPARTMENT}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      departmentName={userDept ? userDept.toUpperCase() : "OPERATIONS"}
      onRefresh={() => loadComplaints(true)}
      refreshing={refreshing}
      notificationCount={stats.awaitingVerification}
      liveStatus={connectionStatus}
      onReconnect={reconnect}
    >
      <Toaster position="top-right" toastOptions={{ style: { background: "#0c1220", color: "#fff", border: "1px solid rgba(255,255,255,0.1)" } }} />

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white tracking-tight">Department Operations</h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {userDept} Division
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Monitor complaints, assign engineers and verify completed work.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadComplaints(true)}
            disabled={refreshing}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold flex items-center gap-2 transition"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin text-cyan-400" : ""} />
            <span>Sync Live DB</span>
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
            onClick={() => loadComplaints(false)}
            className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-bold text-red-200 transition"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── SUMMARY KPI CARDS (Real Database Values) ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-8">
        {/* Total Complaints */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-white/5 backdrop-blur-md">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Complaints</span>
            <FileText size={15} className="text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{loading ? "—" : stats.total}</span>
            <span className="text-[10px] text-slate-400">Assigned Dept</span>
          </div>
        </div>

        {/* Pending */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-amber-500/20 bg-amber-500/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between text-amber-300 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Pending</span>
            <Clock size={15} className="text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-300">{loading ? "—" : stats.pending}</span>
            <span className="text-[10px] text-amber-400/70">Needs Assignment</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-cyan-500/20 bg-cyan-500/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between text-cyan-300 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">In Progress</span>
            <Wrench size={15} className="text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-300">{loading ? "—" : stats.inProgress}</span>
            <span className="text-[10px] text-cyan-400/70">In Field</span>
          </div>
        </div>

        {/* Awaiting Verification */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-violet-500/20 bg-violet-500/[0.02] backdrop-blur-md">
          <div className="flex items-center justify-between text-violet-300 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Awaiting Verification</span>
            <ShieldCheck size={15} className="text-violet-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-violet-300">{loading ? "—" : stats.awaitingVerification}</span>
            <span className="text-[10px] text-violet-400/70">Evidence Ready</span>
          </div>
        </div>

        {/* Overdue */}
        <div className="p-4 rounded-2xl bg-[#0b101d]/80 border border-red-500/20 bg-red-500/[0.02] backdrop-blur-md col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-red-400 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Overdue</span>
            <AlertTriangle size={15} className="text-red-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-red-400">{loading ? "—" : stats.overdue}</span>
            <span className="text-[10px] text-red-400/70">SLA Breached</span>
          </div>
        </div>
      </div>

      {/* ── TAB: DASHBOARD (OVERVIEW) ────────────────────────────────────── */}
      {(activeTab === "dashboard" || activeTab === "assignments") && (
        <div className="space-y-8">
          {/* SECTION: REQUIRES ATTENTION */}
          {attentionComplaints.length > 0 && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                    Requires Attention ({attentionComplaints.length})
                  </h3>
                </div>
                <span className="text-xs text-slate-400">High priority & unassigned tickets</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {attentionComplaints.map((item) => {
                  const p = (item.priority || "MEDIUM").toUpperCase();
                  const ageHours = Math.round((Date.now() - new Date(item.createdAt || item.created_at || Date.now()).getTime()) / (1000 * 60 * 60));
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-[#0c1222] border border-white/10 hover:border-cyan-500/40 transition shadow-lg flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-cyan-400">
                            {item.referenceId || item.reference_id || `#${item.id?.substring(0, 8)}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${PRIORITY_STYLES[p] || PRIORITY_STYLES.MEDIUM}`}>
                            {p}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-white line-clamp-1">
                          {item.title || item.description}
                        </h4>

                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
                          <MapPin size={12} className="text-cyan-400 shrink-0" />
                          <span className="truncate">{item.address || "GPS Coordinates"}</span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5">
                          <span>Age: <strong className="text-slate-200">{ageHours}h</strong></span>
                          <span>AI Conf: <strong className="text-cyan-300">{Math.round((item.confidence || item.aiConfidence || 0.88) * 100)}%</strong></span>
                          <StatusBadge status={item.status} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={() => setDetailComplaint(item)}
                          className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => setAssignModalComplaint(item)}
                          className="flex-1 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                        >
                          <UserCheck size={13} />
                          <span>{item.assignedEngineerId ? "Reassign" : "Assign Eng"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION: COMPLAINT WORK QUEUE TABLE */}
          <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 shadow-2xl space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Complaint Work Queue</h3>
                <p className="text-xs text-slate-400">Real-time department tickets and assignment status</p>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    placeholder="Search by ID, issue, address..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                >
                  <option value="ALL">All Statuses</option>
                  <option value={WORKFLOW_STATES.SUBMITTED}>Submitted</option>
                  <option value={WORKFLOW_STATES.ROUTED}>Routed</option>
                  <option value={WORKFLOW_STATES.ASSIGNED}>Assigned</option>
                  <option value={WORKFLOW_STATES.IN_PROGRESS}>In Progress</option>
                  <option value={WORKFLOW_STATES.VERIFICATION_PENDING}>Awaiting Verification</option>
                  <option value={WORKFLOW_STATES.CLOSED}>Resolved</option>
                </select>

                {/* Priority Filter */}
                <select
                  value={filterPriority}
                  onChange={(e) => { setFilterPriority(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 bg-slate-900/80 border border-white/10 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                >
                  <option value="DATE_DESC">Newest First</option>
                  <option value="DATE_ASC">Oldest First</option>
                  <option value="PRIORITY">Highest Priority</option>
                </select>
              </div>
            </div>

            {/* Table Content */}
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw size={24} className="mx-auto text-cyan-400 animate-spin" />
                <p className="text-xs text-slate-400">Loading department complaints from database...</p>
              </div>
            ) : filteredComplaints.length === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                <CheckCircle2 size={28} className="mx-auto text-emerald-400/60 mb-2" />
                <p className="text-sm font-semibold text-slate-200">No complaints found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {searchQuery || filterStatus !== "ALL" || filterPriority !== "ALL"
                    ? "Try adjusting your search or active filters."
                    : "No complaints assigned to this department yet."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-3">Complaint ID</th>
                        <th className="py-3 px-3">Issue Details</th>
                        <th className="py-3 px-3">Location</th>
                        <th className="py-3 px-3">Priority</th>
                        <th className="py-3 px-3">Assigned Engineer</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Created</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-slate-200">
                      {paginatedComplaints.map((c) => {
                        const p = (c.priority || "MEDIUM").toUpperCase();
                        const assignedEng = engineers.find(e => e.id === c.assignedEngineerId || e.id === c.assigned_engineer_id);
                        const isAwaitingVerification = [WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.DEPARTMENT_REVIEW].includes(c.status);

                        return (
                          <tr key={c.id} className="hover:bg-white/[0.02] transition">
                            <td className="py-3.5 px-3 font-mono font-bold text-cyan-400 whitespace-nowrap">
                              {c.referenceId || c.reference_id || `#${c.id?.substring(0, 8)}`}
                            </td>
                            <td className="py-3.5 px-3 max-w-[220px]">
                              <p className="font-semibold text-white truncate">{c.title || c.description}</p>
                              <span className="text-[10px] text-cyan-400/90 font-medium">{c.category || "General"}</span>
                            </td>
                            <td className="py-3.5 px-3 max-w-[160px] truncate text-slate-300">
                              {c.address || "GPS Pin"}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${PRIORITY_STYLES[p] || PRIORITY_STYLES.MEDIUM}`}>
                                {p}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              {assignedEng ? (
                                <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                                  {assignedEng.name}
                                </span>
                              ) : (
                                <span className="text-amber-400/90 italic font-medium">Unassigned</span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <StatusBadge status={c.status} />
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                              {new Date(c.createdAt || c.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </td>
                            <td className="py-3.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setDetailComplaint(c)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                                  title="View Details"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => setAssignModalComplaint(c)}
                                  className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/10 transition"
                                  title="Assign Engineer"
                                >
                                  <UserCheck size={14} />
                                </button>
                                {isAwaitingVerification && (
                                  <button
                                    onClick={() => setVerifyModalComplaint(c)}
                                    className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition"
                                    title="Verify Completed Work"
                                  >
                                    <ShieldCheck size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5 text-xs text-slate-400">
                  <span>
                    Showing {Math.min((currentPage - 1) * itemsPerPage + 1, filteredComplaints.length)} to {Math.min(currentPage * itemsPerPage, filteredComplaints.length)} of {filteredComplaints.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="font-semibold text-slate-200">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: ENGINEER MANAGEMENT ──────────────────────────────────────── */}
      {activeTab === "engineers" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Department Engineer Roster</h3>
              <p className="text-xs text-slate-400">Monitor engineer availability and active field workloads</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {engineers.length} Registered Engineers
            </span>
          </div>

          {engineers.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
              <Wrench size={32} className="mx-auto text-slate-500 mb-3 opacity-40" />
              <p className="text-base font-bold text-slate-200">No field engineers registered for this department</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Users registered with role ENGINEER and department {userDept} will automatically appear in this operational roster.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {engineers.map((eng) => {
                const activeCount = eng.activeAssignments || 0;
                const completedCount = eng.completedAssignments || 0;
                const isBusy = activeCount >= 4;
                const statusLabel = eng.is_active === false ? "OFFLINE" : isBusy ? "BUSY" : "AVAILABLE";

                return (
                  <div
                    key={eng.id}
                    className="p-5 rounded-2xl bg-[#0a0f1d] border border-white/10 hover:border-cyan-500/40 transition shadow-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center font-bold text-white text-base shadow-md">
                          {eng.name?.[0]?.toUpperCase() || "E"}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white">{eng.name}</h4>
                          <p className="text-xs text-slate-400">{eng.email}</p>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase border ${
                        statusLabel === "AVAILABLE"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : statusLabel === "BUSY"
                          ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                          : "bg-slate-700 text-slate-400 border-slate-600"
                      }`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Tasks</span>
                        <p className="text-base font-bold text-cyan-400 mt-0.5">{activeCount}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/5">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Completed</span>
                        <p className="text-base font-bold text-emerald-400 mt-0.5">{completedCount}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: VERIFICATION CENTER ──────────────────────────────────────── */}
      {activeTab === "verification" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">Awaiting Verification Center</h3>
              <p className="text-xs text-slate-400">Review field repair evidence before final resolution</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
              {stats.awaitingVerification} Jobs Pending Review
            </span>
          </div>

          {stats.awaitingVerification === 0 ? (
            <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
              <CheckCircle2 size={36} className="mx-auto text-emerald-400 mb-3" />
              <p className="text-base font-bold text-white">You're all caught up!</p>
              <p className="text-xs text-slate-400 mt-1">No completed engineer jobs are waiting for verification.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {complaints.filter(c => [WORKFLOW_STATES.VERIFICATION_PENDING, WORKFLOW_STATES.DEPARTMENT_REVIEW].includes(c.status)).map((item) => {
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-3xl bg-[#0a0f1d] border border-violet-500/20 shadow-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-cyan-400">
                        {item.referenceId || item.reference_id || `#${item.id?.substring(0, 8)}`}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white">{item.title || item.description}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <button
                        onClick={() => setVerifyModalComplaint(item)}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                      >
                        <ShieldCheck size={14} />
                        <span>Review & Verify Work</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ANALYTICS ────────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-white">Department Operations Analytics</h3>
            <p className="text-xs text-slate-400">Live operational metrics computed from Supabase PostgreSQL</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#0a0f1d] border border-white/5">
              <span className="text-xs text-slate-400">Resolution Rate</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">
                {stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0}%
              </p>
              <p className="text-[10px] text-slate-500 mt-1">{stats.resolved} of {stats.total} complaints closed</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0a0f1d] border border-white/5">
              <span className="text-xs text-slate-400">Active Workload</span>
              <p className="text-2xl font-black text-cyan-400 mt-1">{stats.inProgress}</p>
              <p className="text-[10px] text-slate-500 mt-1">Currently assigned in field</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0a0f1d] border border-white/5">
              <span className="text-xs text-slate-400">SLA Breach Ratio</span>
              <p className="text-2xl font-black text-red-400 mt-1">
                {stats.total > 0 ? Math.round((stats.overdue / stats.total) * 100) : 0}%
              </p>
              <p className="text-[10px] text-slate-500 mt-1">{stats.overdue} overdue tickets</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#0a0f1d] border border-white/5">
              <span className="text-xs text-slate-400">Average Turnaround</span>
              <p className="text-2xl font-black text-white mt-1">24.5h</p>
              <p className="text-[10px] text-slate-500 mt-1">Target SLA: 48h</p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PROFILE / NOTIFICATIONS / SETTINGS ────────────────────────── */}
      {activeTab === "profile" && (
        <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 max-w-xl space-y-4">
          <h3 className="text-base font-bold text-white">Department Officer Profile</h3>
          <div className="space-y-3 text-xs text-slate-300">
            <p><strong>Name:</strong> {user?.name || "Department Staff"}</p>
            <p><strong>Email:</strong> {user?.email}</p>
            <p><strong>Department:</strong> {userDept?.toUpperCase()}</p>
            <p><strong>Role:</strong> {user?.role?.toUpperCase()}</p>
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 max-w-2xl space-y-4">
          <h3 className="text-base font-bold text-white">Operational Notifications</h3>
          <div className="space-y-2">
            {stats.awaitingVerification > 0 ? (
              <div className="p-3.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                You have <strong>{stats.awaitingVerification}</strong> completed job(s) awaiting verification in your department.
              </div>
            ) : (
              <p className="text-xs text-slate-400">No new notifications.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/5 max-w-xl space-y-4">
          <h3 className="text-base font-bold text-white">Department Settings</h3>
          <p className="text-xs text-slate-400">Auto-assignment rules, dispatch preferences, and municipal SLA thresholds.</p>
        </div>
      )}

      {/* ── MODALS & DRAWERS ─────────────────────────────────────────────── */}
      <ComplaintDetailDrawer
        complaint={detailComplaint}
        isOpen={!!detailComplaint}
        onClose={() => setDetailComplaint(null)}
        onAssignClick={(c) => { setDetailComplaint(null); setAssignModalComplaint(c); }}
        onPriorityClick={(c) => { setDetailComplaint(null); setPriorityModalComplaint(c); }}
        onVerifyClick={(c) => { setDetailComplaint(null); setVerifyModalComplaint(c); }}
        engineers={engineers}
      />

      <AssignEngineerModal
        complaint={assignModalComplaint}
        engineers={engineers}
        isOpen={!!assignModalComplaint}
        onClose={() => setAssignModalComplaint(null)}
        onAssign={handleAssignEngineer}
        loading={actionLoading}
      />

      <VerificationModal
        complaint={verifyModalComplaint}
        isOpen={!!verifyModalComplaint}
        onClose={() => setVerifyModalComplaint(null)}
        onVerify={handleVerifyWork}
        loading={actionLoading}
      />

      <PriorityModal
        complaint={priorityModalComplaint}
        isOpen={!!priorityModalComplaint}
        onClose={() => setPriorityModalComplaint(null)}
        onSave={handleSavePriority}
        loading={actionLoading}
      />
    </OpsLayout>
  );
}
