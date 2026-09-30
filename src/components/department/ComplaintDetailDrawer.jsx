import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  ExternalLink,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  User,
  Wrench,
  Building2,
  AlertTriangle,
  Zap,
  Flag,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  HelpCircle,
  TrendingUp,
  Image as ImageIcon
} from "lucide-react";
import StatusBadge, { STATUS_META, WORKFLOW_STATES } from "../ui/StatusBadge.jsx";
import { getPublicImageUrl } from "../../services/storage/complaintImageUpload.js";

const PRIORITY_STYLES = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/30",
  HIGH:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  MEDIUM:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW:      "bg-slate-700 text-slate-300 border-slate-600",
};

const TIMELINE_STEPS = [
  { key: WORKFLOW_STATES.SUBMITTED,            label: "Citizen Submitted" },
  { key: WORKFLOW_STATES.AI_PROCESSING,        label: "AI Classified" },
  { key: WORKFLOW_STATES.ROUTED,               label: "Department Assigned" },
  { key: WORKFLOW_STATES.ASSIGNED,             label: "Engineer Assigned" },
  { key: WORKFLOW_STATES.ACCEPTED_BY_ENGINEER, label: "Engineer Accepted" },
  { key: WORKFLOW_STATES.IN_PROGRESS,          label: "Work In Progress" },
  { key: WORKFLOW_STATES.VERIFICATION_PENDING, label: "Completion Submitted" },
  { key: WORKFLOW_STATES.CLOSED,               label: "Verified & Resolved" },
];

export default function ComplaintDetailDrawer({
  complaint,
  isOpen,
  onClose,
  onAssignClick,
  onPriorityClick,
  onVerifyClick,
  engineers = []
}) {
  const [lightboxImage, setLightboxImage] = useState(null);

  if (!complaint || !isOpen) return null;

  // Derive citizen photo
  const citizenPhoto = complaint.imageUrl || complaint.image_url || getPublicImageUrl(complaint.imagePath || complaint.image_path) || null;
  const rawStatus = complaint.status || WORKFLOW_STATES.SUBMITTED;
  const priority = (complaint.priority || "MEDIUM").toUpperCase();

  // Find assigned engineer object if available
  const assignedEng = engineers.find(e => e.id === complaint.assignedEngineerId || e.id === complaint.assigned_engineer_id);
  const engineerName = assignedEng?.name || complaint.assignedEngineerName || (complaint.assignedEngineerId ? "Assigned Engineer" : "Unassigned");

  // Step index for timeline
  const currentStepIdx = TIMELINE_STEPS.findIndex(s => s.key === rawStatus);
  const effectiveIdx = currentStepIdx === -1 ? 2 : currentStepIdx;

  // Directions link
  const hasCoords = complaint.latitude && complaint.longitude;
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${complaint.latitude},${complaint.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(complaint.address || "City Operations")}`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full max-w-2xl bg-[#0a0f1d] border-l border-white/10 shadow-2xl h-full flex flex-col z-10 overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#080d1a]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
              ID
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {complaint.referenceId || complaint.reference_id || `#${complaint.id?.substring(0, 8)}`}
                </h2>
                <StatusBadge status={rawStatus} />
              </div>
              <p className="text-xs text-slate-400">
                Created on {new Date(complaint.createdAt || complaint.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Action Quick Bar */}
          <div className="flex items-center gap-2.5 flex-wrap p-3 rounded-2xl bg-white/[0.02] border border-white/5">
            <button
              onClick={() => onAssignClick?.(complaint)}
              className="flex-1 min-w-[140px] px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
            >
              <User size={14} />
              <span>{complaint.assignedEngineerId ? "Reassign Engineer" : "Assign Engineer"}</span>
            </button>

            <button
              onClick={() => onPriorityClick?.(complaint)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-semibold flex items-center gap-2 transition"
            >
              <Flag size={14} className="text-amber-400" />
              <span>Priority: {priority}</span>
            </button>

            {(rawStatus === WORKFLOW_STATES.VERIFICATION_PENDING || rawStatus === WORKFLOW_STATES.DEPARTMENT_REVIEW) && (
              <button
                onClick={() => onVerifyClick?.(complaint)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 transition"
              >
                <ShieldCheck size={14} />
                <span>Verify Completion</span>
              </button>
            )}
          </div>

          {/* Section 1: Citizen Evidence Image Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={13} className="text-cyan-400" />
                <span>Citizen Photo Evidence</span>
              </label>
              {citizenPhoto && (
                <button
                  onClick={() => setLightboxImage(citizenPhoto)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  <Eye size={12} />
                  <span>Enlarge Preview</span>
                </button>
              )}
            </div>

            {citizenPhoto ? (
              <div
                onClick={() => setLightboxImage(citizenPhoto)}
                className="relative h-56 rounded-2xl overflow-hidden border border-white/10 group cursor-pointer bg-black/40"
              >
                <img
                  src={citizenPhoto}
                  alt="Citizen complaint evidence"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <span className="text-xs text-white font-medium flex items-center gap-1.5">
                    <Eye size={14} /> Click to zoom in
                  </span>
                </div>
              </div>
            ) : (
              <div className="h-32 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-400 gap-1.5 bg-white/[0.01]">
                <ImageIcon size={22} className="opacity-40" />
                <span className="text-xs">No citizen photo attached to this complaint</span>
              </div>
            )}
          </div>

          {/* Section 2: Issue Description & Category */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                  {complaint.category || "General Civic Issue"}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {complaint.title || complaint.description?.substring(0, 50) || "Civic Complaint"}
                </h3>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.MEDIUM}`}>
                {priority}
              </span>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {complaint.description || "No description provided."}
            </p>
          </div>

          {/* Section 3: Location Details & Directions */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin size={13} className="text-cyan-400" />
                <span>Location & Coordinates</span>
              </label>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium hover:underline"
              >
                <span>Open Directions</span>
                <ExternalLink size={12} />
              </a>
            </div>

            <p className="text-sm text-slate-200">
              {complaint.address || "Location specified via GPS coordinates."}
            </p>

            {hasCoords && (
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400 bg-black/30 p-2.5 rounded-xl border border-white/5">
                <span>Lat: {complaint.latitude?.toFixed(5)}</span>
                <span>•</span>
                <span>Lng: {complaint.longitude?.toFixed(5)}</span>
              </div>
            )}
          </div>

          {/* Section 4: AI Classification & Analysis */}
          <div className="p-4 rounded-2xl bg-cyan-500/[0.03] border border-cyan-500/15 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={13} className="text-cyan-400" />
                <span>AI Automated Assessment</span>
              </label>
              <span className="text-[11px] font-mono text-cyan-400/80">Gemini 2.5 Flash</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Detected Category</span>
                <p className="text-xs font-bold text-white mt-0.5">{complaint.category || "General"}</p>
              </div>
              <div className="p-3 rounded-xl bg-black/30 border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">AI Confidence</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex-1 bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-cyan-400 h-full rounded-full"
                      style={{ width: `${Math.round((complaint.confidence || complaint.aiConfidence || 0.88) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-cyan-300">
                    {Math.round((complaint.confidence || complaint.aiConfidence || 0.88) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {complaint.aiReasoning && (
              <div className="text-xs text-slate-300 bg-black/20 p-2.5 rounded-xl border border-white/5 leading-relaxed">
                <span className="text-slate-400 font-semibold block mb-1">AI Reasoning:</span>
                {complaint.aiReasoning}
              </div>
            )}
          </div>

          {/* Section 5: Assigned Engineer Info */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench size={13} className="text-cyan-400" />
                <span>Field Engineer Assignment</span>
              </label>
              <button
                onClick={() => onAssignClick?.(complaint)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
              >
                {complaint.assignedEngineerId ? "Change" : "Assign Now"}
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center font-bold text-white text-xs">
                {engineerName[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{engineerName}</p>
                <p className="text-[11px] text-slate-400">
                  {complaint.assignedEngineerId ? "Designated Field Staff" : "Awaiting assignment from department"}
                </p>
              </div>
              {complaint.assignedEngineerId ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  Assigned
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Unassigned
                </span>
              )}
            </div>
          </div>

          {/* Section 6: Workflow Timeline */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} className="text-cyan-400" />
              <span>Workflow Progress Timeline</span>
            </label>

            <div className="space-y-2 pt-1">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPassed = idx <= effectiveIdx;
                const isCurrent = idx === effectiveIdx;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCurrent
                        ? "bg-cyan-400 text-black shadow-[0_0_10px_rgba(34,211,238,0.5)]"
                        : isPassed
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        : "bg-slate-800 text-slate-500"
                    }`}>
                      {isPassed ? "✓" : idx + 1}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? "text-cyan-300 font-bold" : isPassed ? "text-slate-200" : "text-slate-500"}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightboxImage(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] bg-[#0c1220] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Evidence Viewer — {complaint.referenceId || complaint.id}
                </span>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
                <img
                  src={lightboxImage}
                  alt="Citizen Photo Full View"
                  className="max-w-full max-h-[70vh] rounded-2xl object-contain shadow-lg"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
