import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Calendar,
  AlertCircle,
  Star,
  MessageSquare,
  CheckCircle,
  FileText,
  RotateCcw,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import Sidebar from "../components/dashboard/Sidebar.jsx";
import Button from "../components/ui/Button.jsx";
import StatusBadge from "../components/ui/StatusBadge.jsx";
import ComplaintTimeline from "../components/report/ComplaintTimeline.jsx";
import { complaintApi } from "../services/api/complaintApi.js";
import { WORKFLOW_STATES } from "../constants/workflow.js";
import toast, { Toaster } from "react-hot-toast";

export default function TrackComplaintPage() {
  const [referenceId, setReferenceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState(null);

  // Verification & Feedback State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function handleSearch(e) {
    if (e) e.preventDefault();
    const cleanId = referenceId.trim().toUpperCase();
    if (!cleanId) return;

    setError("");
    setLoading(true);
    setIssue(null);
    setShowReopenInput(false);

    try {
      const fetched = await complaintApi.getComplaint(cleanId);
      setIssue(fetched);
    } catch (err) {
      console.warn("Tracking lookup error:", err.message);
      setError("No complaint found matching this reference ID. Please check and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Citizen approves repair resolution -> moves to CLOSED (Requirement 6)
  async function handleApprove() {
    if (!issue) return;
    setActionLoading(true);
    try {
      await complaintApi.approveResolution(issue.referenceId, {
        rating,
        comment: comment.trim()
      });
      toast.success("Resolution approved! Complaint closed with citizen satisfaction.");
      handleSearch();
    } catch (err) {
      toast.error(err.message || "Failed to approve resolution.");
    } finally {
      setActionLoading(false);
    }
  }

  // Citizen rejects resolution and reopens complaint -> moves to REOPENED (Requirement 6)
  async function handleReopen() {
    if (!issue) return;
    if (!reopenReason.trim() || reopenReason.trim().length < 5) {
      toast.error("Please explain why the repair is unsatisfactory before reopening.");
      return;
    }

    setActionLoading(true);
    try {
      await complaintApi.reopenComplaint(issue.referenceId, reopenReason.trim());
      toast.success("Complaint reopened and forwarded to Department Review.");
      setShowReopenInput(false);
      handleSearch();
    } catch (err) {
      toast.error(err.message || "Failed to reopen complaint.");
    } finally {
      setActionLoading(false);
    }
  }

  const currentStatus = issue?.workflow?.status || issue?.status;
  const isAwaitingCitizen = currentStatus === WORKFLOW_STATES.CITIZEN_VERIFICATION;
  const isClosed = currentStatus === WORKFLOW_STATES.CLOSED;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-h-screen"
    >
      <Toaster position="top-right" />
      <Sidebar active="Track" />

      <main className="flex-1 px-6 sm:px-10 py-10 max-w-[1400px]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl tracking-tight text-white">
              Track Your Complaint
            </h1>
            <p className="text-slate-400 mt-1.5 text-sm">
              Enter your tracking reference ID to view real-time state machine progression and audit timeline.
            </p>
          </div>

          <Button to="/report" icon={FileText} className="text-xs">
            Report New Issue
          </Button>
        </div>

        {/* Search Card */}
        <div className="glass rounded-2xl p-6 mb-8 max-w-3xl border border-slate-800">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. CC-2026-XXXXXX"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
              />
            </div>
            <Button type="submit" disabled={loading} className="px-7 justify-center text-xs">
              {loading ? "Searching..." : "Track Status"}
            </Button>
          </form>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-xl px-4 py-3 mt-4"
            >
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {issue && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-strong rounded-3xl p-7 sm:p-9 border border-slate-800"
            >
              {/* Header Details */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
                <div>
                  <p className="text-xs font-mono text-cyan-400 font-semibold mb-1">{issue.referenceId}</p>
                  <h2 className="font-display font-semibold text-2xl text-white">{issue.issue?.title || issue.title}</h2>
                  <div className="flex items-center gap-4 text-sm text-slate-400 mt-2">
                    <span className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-cyan-400" /> {issue.issue?.category || issue.category}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono text-xs">
                      <Calendar size={14} className="text-slate-500" />
                      {new Date(issue.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                <StatusBadge status={currentStatus} />
              </div>

              <p className="text-sm text-slate-300 leading-relaxed mb-6">{issue.issue?.description || issue.description}</p>

              {/* Before and After Photographs (if present) */}
              {(issue.media?.before?.length > 0 || issue.media?.after?.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  {issue.media?.before?.[0]?.url && (
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                      <span className="text-xs font-semibold text-slate-400 block mb-2">Initial Citizen Photo</span>
                      <img
                        src={issue.media.before[0].url}
                        alt="Before"
                        className="w-full h-48 object-cover rounded-xl border border-slate-800"
                      />
                    </div>
                  )}

                  {issue.media?.after?.[0]?.url && (
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                      <span className="text-xs font-semibold text-cyan-400 block mb-2">Field Repair Photo</span>
                      <img
                        src={issue.media.after[0].url}
                        alt="After repair"
                        className="w-full h-48 object-cover rounded-xl border border-slate-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Citizen Verification Section (Requirement 6) */}
              {isAwaitingCitizen && (
                <div className="p-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 mb-8 text-left">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={20} className="text-cyan-400" />
                    <h3 className="text-base font-bold text-white">Action Required: Verify Municipal Resolution</h3>
                  </div>
                  <p className="text-xs text-slate-300 mb-5">
                    Field engineers and the responsible department have marked your issue as repaired. Please inspect the evidence above and confirm satisfaction, or request rework.
                  </p>

                  {!showReopenInput ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-slate-300 block mb-2">Rate resolution quality</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRating(star)}
                              className="focus:outline-none"
                            >
                              <Star
                                size={24}
                                className={star <= rating ? "text-yellow-400 fill-yellow-400" : "text-slate-600"}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Optional feedback or note of thanks..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
                      />

                      <div className="flex items-center gap-3 pt-2">
                        <Button
                          variant="primary"
                          onClick={handleApprove}
                          disabled={actionLoading}
                          icon={CheckCircle2}
                          className="text-xs"
                        >
                          Approve Resolution & Close Complaint
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => setShowReopenInput(true)}
                          disabled={actionLoading}
                          icon={RotateCcw}
                          className="text-xs border-red-500/30 text-red-300 hover:bg-red-500/10"
                        >
                          Unsatisfactory / Reopen Complaint
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 p-4 bg-slate-950 rounded-xl border border-red-500/30">
                      <label className="text-xs font-semibold text-red-300 block">
                        Why is this resolution unsatisfactory? (Mandatory)
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Explain what is still broken, defective, or left unattended..."
                        value={reopenReason}
                        onChange={(e) => setReopenReason(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-400"
                      />
                      <div className="flex items-center gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => setShowReopenInput(false)}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          onClick={handleReopen}
                          disabled={actionLoading || !reopenReason.trim()}
                          className="text-xs bg-red-600 hover:bg-red-700"
                        >
                          Confirm Reopen
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Closed State Banner */}
              {isClosed && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 mb-8 flex items-center gap-3">
                  <CheckCircle size={20} className="text-emerald-400 flex-shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300">Complaint Formally Closed</h4>
                    <p className="text-[11px] text-emerald-200/80">
                      This complaint has been verified and permanently recorded into municipal archives.
                    </p>
                  </div>
                </div>
              )}

              {/* Audit Timeline */}
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-white mb-4">Lifecycle Audit Trail</h3>
                <ComplaintTimeline timeline={issue.timeline} history={issue.history} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </motion.div>
  );
}
