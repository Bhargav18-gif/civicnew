import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../../components/layout/Navbar.jsx";
import Footer from "../../components/layout/Footer.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { departmentApi } from "../../services/api/departmentApi.js";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";
import { WORKFLOW_STATES } from "../../constants/workflow.js";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Button from "../../components/ui/Button.jsx";
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
  RotateCcw
} from "lucide-react";

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEngineers, setSelectedEngineers] = useState({});
  const [verificationModal, setVerificationModal] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const userDept = user?.department_id || user?.departmentId || user?.department || "";

  // 1. Fetch dynamic engineers for this department
  const loadEngineers = async () => {
    if (!userDept) return;
    try {
      const engList = await departmentApi.getDepartmentEngineers(userDept);
      setEngineers(engList);
    } catch (err) {
      console.warn("Could not load engineers:", err.message);
    }
  };

  useEffect(() => {
    loadEngineers();
  }, [userDept]);

  // 2. Fetch department complaints from Supabase via backend API
  useEffect(() => {
    if (!userDept) {
      setLoading(false);
      return;
    }
    setLoading(true);

    departmentApi.getDepartmentComplaints(userDept)
      .then(list => {
        const sorted = list.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
        setComplaints(sorted);
      })
      .catch(err => {
        console.error("Failed to load department complaints:", err.message);
        toast.error("Failed to load department complaints.");
      })
      .finally(() => setLoading(false));
  }, [userDept]);

  // Handle engineer assignment using engineer ID
  const handleAssignEngineer = async (complaint) => {
    const engineerId = selectedEngineers[complaint.referenceId];
    if (!engineerId) {
      toast.error("Please select an available engineer from the dropdown.");
      return;
    }

    setActionLoading(true);
    try {
      await departmentApi.assignEngineer(complaint.referenceId, engineerId);
      const assignedEng = engineers.find((e) => (e.id || e.uid) === engineerId);
      toast.success(`Assigned to ${assignedEng?.name || "Engineer"} successfully!`);
      loadEngineers();
    } catch (err) {
      toast.error(err.message || "Assignment failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle department verification decision (Accept / Rework)
  const handleVerificationDecision = async (decision) => {
    if (!verificationModal) return;

    setActionLoading(true);
    try {
      await departmentApi.verifyWork(
        verificationModal.referenceId,
        decision,
        verificationNotes
      );
      toast.success(
        decision === "ACCEPT"
          ? "Work approved! Routed to Citizen for final verification."
          : "Work rejected. Sent back to engineer for rework."
      );
      setVerificationModal(null);
      setVerificationNotes("");
    } catch (err) {
      toast.error(err.message || "Failed to submit verification.");
    } finally {
      setActionLoading(false);
    }
  };

  // Aggregate department metrics
  const total = complaints.length;
  const pendingAssignment = complaints.filter(
    (c) => c.workflow?.status === WORKFLOW_STATES.ROUTED || c.workflow?.status === WORKFLOW_STATES.DEPARTMENT_ACCEPTED
  ).length;
  const inProgress = complaints.filter(
    (c) => [WORKFLOW_STATES.ASSIGNED, WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, WORKFLOW_STATES.EN_ROUTE, WORKFLOW_STATES.ON_SITE, WORKFLOW_STATES.IN_PROGRESS].includes(c.workflow?.status)
  ).length;
  const pendingVerification = complaints.filter(
    (c) => c.workflow?.status === WORKFLOW_STATES.VERIFICATION_PENDING || c.workflow?.status === WORKFLOW_STATES.DEPARTMENT_REVIEW
  ).length;

  return (
    <>
      <Navbar />
      <Toaster position="top-right" />
      <div className="min-h-screen px-6 pt-28 pb-20 max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 mb-2">
                <ShieldCheck size={14} /> Department Operations Portal
              </div>
              <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight capitalize">
                {userDept} Department
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Triage complaints, assign certified field engineers, and verify completion evidence.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={loadEngineers}
              icon={RefreshCw}
              className="text-xs self-start md:self-auto"
            >
              Refresh Workload
            </Button>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md">
              <span className="text-xs font-medium text-slate-400">Total Department Tasks</span>
              <p className="text-2xl font-bold text-white mt-1">{total}</p>
            </div>
            <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 backdrop-blur-md">
              <span className="text-xs font-medium text-amber-400">Awaiting Assignment</span>
              <p className="text-2xl font-bold text-amber-300 mt-1">{pendingAssignment}</p>
            </div>
            <div className="p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 backdrop-blur-md">
              <span className="text-xs font-medium text-cyan-400">Active in Field</span>
              <p className="text-2xl font-bold text-cyan-300 mt-1">{inProgress}</p>
            </div>
            <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-md">
              <span className="text-xs font-medium text-purple-400">Needs Verification</span>
              <p className="text-2xl font-bold text-purple-300 mt-1">{pendingVerification}</p>
            </div>
          </div>

          {/* Available Engineers Workload Bar */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Users size={16} className="text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Active Field Engineers ({engineers.length})</h2>
            </div>
            {engineers.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No field engineers registered for {userDept} department yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {engineers.map((eng) => (
                  <div key={eng.uid} className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white">{eng.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">Tasks: {eng.activeTasks}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${eng.activeTasks >= 5 ? 'border-amber-500/30 text-amber-400 bg-amber-500/10' : 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'}`}>
                      {eng.activeTasks >= 5 ? 'Busy' : 'Available'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Complaints Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Department Complaints Queue</h2>
              <span className="text-xs text-slate-400">{complaints.length} records</span>
            </div>

            {loading ? (
              <div className="py-20 flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
              </div>
            ) : complaints.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                No active complaints currently routed to {userDept}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950/60 text-slate-400 text-xs font-semibold border-b border-slate-800 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Ref ID</th>
                      <th className="py-3 px-4">Issue Description</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Assigned Engineer</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {complaints.map((c) => {
                      const status = c.workflow?.status || c.status;
                      const isNeedsVerification = status === WORKFLOW_STATES.VERIFICATION_PENDING || status === WORKFLOW_STATES.DEPARTMENT_REVIEW;
                      const isAssignable = [WORKFLOW_STATES.ROUTED, WORKFLOW_STATES.DEPARTMENT_ACCEPTED].includes(status);

                      return (
                        <tr key={c.referenceId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3.5 px-4 font-mono text-xs text-cyan-400 font-medium">
                            {c.referenceId}
                          </td>
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="text-white font-medium text-xs line-clamp-1">{c.issue?.title || c.title}</p>
                            <p className="text-slate-400 text-xs line-clamp-1 mt-0.5">{c.issue?.description || c.description}</p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                              c.ai?.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                              c.ai?.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {c.ai?.priority || c.priority || 'MEDIUM'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={status} />
                          </td>
                          <td className="py-3.5 px-4">
                            {c.assignment?.engineerId ? (
                              <span className="text-xs text-slate-300 flex items-center gap-1.5 font-medium">
                                <UserCheck size={14} className="text-cyan-400" />
                                {engineers.find(e => (e.id || e.uid) === c.assignment.engineerId)?.name || c.assignment.engineerId}
                              </span>
                            ) : (
                              <select
                                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
                                value={selectedEngineers[c.referenceId] || ""}
                                onChange={(e) =>
                                  setSelectedEngineers({
                                    ...selectedEngineers,
                                    [c.referenceId]: e.target.value,
                                  })
                                }
                                disabled={!isAssignable}
                              >
                                <option value="">Select Field Engineer</option>
                                {engineers.map((eng) => {
                                  const engId = eng.id || eng.uid;
                                  return (
                                    <option key={engId} value={engId}>
                                      {eng.name} ({eng.activeTasks || 0} tasks)
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isNeedsVerification ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => setVerificationModal(c)}
                                icon={Eye}
                                className="text-xs"
                              >
                                Verify Work
                              </Button>
                            ) : !c.assignment?.engineerId ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleAssignEngineer(c)}
                                disabled={actionLoading || !selectedEngineers[c.referenceId]}
                                className="text-xs"
                              >
                                Assign
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-500">In Progress</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Department Verification Modal (Requirement 6) */}
      <AnimatePresence>
        {verificationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">Department Verification Review</h3>
                  <p className="text-xs text-cyan-400 font-mono">{verificationModal.referenceId}</p>
                </div>
                <button
                  onClick={() => setVerificationModal(null)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              {/* Before and After Photographs */}
              <div className="grid grid-cols-2 gap-4 my-5">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 block mb-2">Initial Citizen Photo</span>
                  {verificationModal.media?.before?.[0]?.url ? (
                    <img
                      src={verificationModal.media.before[0].url}
                      alt="Before repair"
                      className="w-full h-44 object-cover rounded-xl border border-slate-800"
                    />
                  ) : (
                    <div className="w-full h-44 rounded-xl bg-slate-900 flex items-center justify-center text-xs text-slate-500">
                      No initial photo available
                    </div>
                  )}
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <span className="text-xs font-semibold text-cyan-400 block mb-2">Repair Evidence Photo</span>
                  {verificationModal.media?.after?.[0]?.url ? (
                    <img
                      src={verificationModal.media.after[0].url}
                      alt="After repair"
                      className="w-full h-44 object-cover rounded-xl border border-slate-800"
                    />
                  ) : (
                    <div className="w-full h-44 rounded-xl bg-slate-900 flex items-center justify-center text-xs text-slate-500">
                      No repair photo uploaded
                    </div>
                  )}
                </div>
              </div>

              {/* Engineer Notes */}
              {verificationModal.engineerNotes && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 mb-4 text-xs">
                  <span className="text-slate-400 font-medium block mb-1">Engineer Completion Notes:</span>
                  <p className="text-slate-200">{verificationModal.engineerNotes}</p>
                </div>
              )}

              {/* Advisory AI Recommendation */}
              {verificationModal.verification?.aiResult && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 mb-4 text-xs flex items-start gap-2">
                  <ShieldCheck size={16} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-purple-300">
                      AI Advisory Recommendation: {verificationModal.verification.aiResult.recommendation} ({Math.round((verificationModal.verification.aiResult.confidence || 0) * 100)}% confidence)
                    </span>
                    <p className="text-purple-200/80 mt-0.5">{verificationModal.verification.aiResult.reasoning}</p>
                  </div>
                </div>
              )}

              {/* Department Verification Remarks Input */}
              <div className="mb-6">
                <label className="text-xs font-medium text-slate-300 block mb-1">Department Verification Notes</label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                  placeholder="Enter remarks or rework instructions..."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  variant="secondary"
                  onClick={() => handleVerificationDecision("REJECT")}
                  disabled={actionLoading}
                  icon={RotateCcw}
                  className="text-xs border-red-500/30 text-red-300 hover:bg-red-500/10"
                >
                  Request Rework
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleVerificationDecision("ACCEPT")}
                  disabled={actionLoading}
                  icon={CheckCircle2}
                  className="text-xs"
                >
                  Approve Resolution
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}
