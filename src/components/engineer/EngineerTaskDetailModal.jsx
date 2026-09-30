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
  CheckCircle2,
  AlertTriangle,
  Play,
  Navigation,
  UploadCloud,
  FileText,
  Building2,
  Wrench,
  Camera,
  Eye,
  Check,
  Zap,
  RotateCcw,
  Compass,
  CheckSquare
} from "lucide-react";
import StatusBadge, { STATUS_META, WORKFLOW_STATES } from "../ui/StatusBadge.jsx";
import EvidenceUploader from "../common/EvidenceUploader.jsx";
import ComplaintLocationMap from "./ComplaintLocationMap.jsx";
import { getPublicImageUrl } from "../../services/storage/complaintImageUpload.js";

const PRIORITY_STYLES = {
  CRITICAL: "bg-red-500/20 text-red-300 border-red-500/30",
  HIGH:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  MEDIUM:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
  LOW:      "bg-slate-700 text-slate-300 border-slate-600",
};

const TIMELINE_STEPS = [
  { key: WORKFLOW_STATES.ASSIGNED,              label: "Complaint Assigned" },
  { key: WORKFLOW_STATES.ACCEPTED_BY_ENGINEER,  label: "Assignment Accepted" },
  { key: WORKFLOW_STATES.EN_ROUTE,              label: "En Route" },
  { key: WORKFLOW_STATES.ON_SITE,               label: "Arrived On Site" },
  { key: WORKFLOW_STATES.IN_PROGRESS,           label: "Work Started" },
  { key: WORKFLOW_STATES.VERIFICATION_PENDING,  label: "Completion Submitted" },
  { key: WORKFLOW_STATES.CLOSED,                label: "Verified & Resolved" },
];

export default function EngineerTaskDetailModal({
  task,
  isOpen,
  onClose,
  onStatusTransition,
  onSubmitEvidence,
  onConfirmArrival,
  onOpenReportForm,
  actionLoading = false,
  userId
}) {
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [currentGps, setCurrentGps] = useState(null);
  const [lightboxImage, setLightboxImage] = useState(null);

  if (!task || !isOpen) return null;

  const rawStatus = task.status || WORKFLOW_STATES.ASSIGNED;
  const priority = (task.priority || "MEDIUM").toUpperCase();
  const citizenPhoto = task.imageUrl || task.image_url || getPublicImageUrl(task.imagePath || task.image_path) || null;

  // Find step index
  const currentStepIdx = TIMELINE_STEPS.findIndex(s => s.key === rawStatus);
  const effectiveIdx = currentStepIdx === -1 ? 0 : currentStepIdx;

  // Evidence submission handler
  function handleEvidenceSubmit() {
    if (afterPhotos.length === 0) return;
    if (!completionNotes.trim()) return;

    const afterUrls = afterPhotos.map(p => typeof p === "string" ? p : p.url);
    const beforeUrls = beforePhotos.map(p => typeof p === "string" ? p : p.url);

    onSubmitEvidence?.(task.id, {
      photos: afterUrls,
      beforePhotos: beforeUrls,
      notes: completionNotes,
      partsUsed: [],
      gpsConfirmation: currentGps
    });
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="relative w-full max-w-4xl bg-[#0a0f1d] border-l border-white/10 shadow-2xl h-full flex flex-col z-10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#080d1a]/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
              <Wrench size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {task.referenceId || task.reference_id || `#${task.id?.substring(0, 8)}`}
                </h2>
                <StatusBadge status={rawStatus} />
              </div>
              <p className="text-xs text-slate-400">
                Assigned on {new Date(task.assignedAt || task.createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenReportForm?.(task.id)}
              className="px-3.5 py-2 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <FileText size={13} />
              <span>Full Work Report</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* WORK ACTION BANNER */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent border border-teal-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Play size={13} />
                <span>Next Operational Action</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-300">
                Current Status: <strong className="text-teal-300">{STATUS_META[rawStatus]?.label || rawStatus}</strong>
              </span>
            </div>

            {/* ASSIGNED STATE */}
            {rawStatus === WORKFLOW_STATES.ASSIGNED && (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  You have been assigned this civic maintenance task. Accept to acknowledge dispatch.
                </p>
                <button
                  type="button"
                  onClick={() => onStatusTransition?.(task.id, WORKFLOW_STATES.ACCEPTED_BY_ENGINEER)}
                  disabled={actionLoading}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-teal-400 hover:bg-teal-300 text-black shadow-[0_0_15px_-2px_rgba(45,212,191,0.4)] transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={15} />
                  <span>Accept Assignment</span>
                </button>
              </div>
            )}

            {/* ACCEPTED STATE */}
            {rawStatus === WORKFLOW_STATES.ACCEPTED_BY_ENGINEER && (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  Task accepted. Update your field travel status as you proceed to the site.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => onStatusTransition?.(task.id, WORKFLOW_STATES.EN_ROUTE)}
                    disabled={actionLoading}
                    className="py-2.5 px-3 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-400 text-black transition flex items-center justify-center gap-1.5"
                  >
                    <Navigation size={14} />
                    <span>Start Travel (En Route)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onStatusTransition?.(task.id, WORKFLOW_STATES.ON_SITE)}
                    disabled={actionLoading}
                    className="py-2.5 px-3 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/10 transition flex items-center justify-center gap-1.5"
                  >
                    <MapPin size={14} className="text-teal-400" />
                    <span>Arrived On Site</span>
                  </button>
                </div>
              </div>
            )}

            {/* EN ROUTE STATE */}
            {rawStatus === WORKFLOW_STATES.EN_ROUTE && (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  You are en route. Mark arrived once you reach the target site.
                </p>
                <button
                  type="button"
                  onClick={() => onStatusTransition?.(task.id, WORKFLOW_STATES.ON_SITE)}
                  disabled={actionLoading}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-teal-400 hover:bg-teal-300 text-black shadow-lg transition flex items-center justify-center gap-2"
                >
                  <MapPin size={15} />
                  <span>Mark Arrived On Site</span>
                </button>
              </div>
            )}

            {/* ON SITE STATE */}
            {rawStatus === WORKFLOW_STATES.ON_SITE && (
              <div className="space-y-2">
                <p className="text-xs text-slate-300">
                  You have arrived on site. Start execution when ready to begin repairs.
                </p>
                <button
                  type="button"
                  onClick={() => onStatusTransition?.(task.id, WORKFLOW_STATES.IN_PROGRESS)}
                  disabled={actionLoading}
                  className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-amber-400 hover:bg-amber-300 text-black shadow-lg transition flex items-center justify-center gap-2"
                >
                  <Play size={15} />
                  <span>Start Work (In Progress)</span>
                </button>
              </div>
            )}

            {/* IN PROGRESS STATE — EVIDENCE SUBMISSION */}
            {rawStatus === WORKFLOW_STATES.IN_PROGRESS && (
              <div className="space-y-4 pt-1">
                <p className="text-xs text-slate-300">
                  Work is in progress. Once complete, upload photos and notes for verification or open the full work report form.
                </p>

                <EvidenceUploader
                  label="Before Work Photo (Optional)"
                  description="JPG, PNG, WebP up to 10MB"
                  mediaType="BEFORE"
                  userId={userId}
                  complaintId={task.id}
                  uploadedUrls={beforePhotos}
                  onUploadSuccess={(photo) => setBeforePhotos([...beforePhotos, photo])}
                  onRemovePhoto={(idx) => setBeforePhotos(beforePhotos.filter((_, i) => i !== idx))}
                  maxPhotos={2}
                />

                <EvidenceUploader
                  label="After Work Photo (Required for Completion)"
                  description="Clear photo proving completion"
                  mediaType="AFTER"
                  userId={userId}
                  complaintId={task.id}
                  uploadedUrls={afterPhotos}
                  onUploadSuccess={(photo) => setAfterPhotos([...afterPhotos, photo])}
                  onRemovePhoto={(idx) => setAfterPhotos(afterPhotos.filter((_, i) => i !== idx))}
                  maxPhotos={3}
                />

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <FileText size={13} className="text-teal-400" />
                    <span>Work Completion Notes (Required)</span>
                  </label>
                  <textarea
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="Describe specific repair work done, parts replaced, and site cleanup details..."
                    className="w-full h-24 p-3 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 custom-scrollbar resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={handleEvidenceSubmit}
                    disabled={actionLoading || afterPhotos.length === 0 || !completionNotes.trim()}
                    className="py-3 px-4 rounded-xl font-bold text-xs bg-teal-400 hover:bg-teal-300 text-black shadow-[0_0_15px_-2px_rgba(45,212,191,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UploadCloud size={16} />
                    )}
                    <span>Quick Submit for Verification</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenReportForm?.(task.id)}
                    className="py-3 px-4 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/10 transition flex items-center justify-center gap-2"
                  >
                    <FileText size={15} />
                    <span>Open Detailed Report Form</span>
                  </button>
                </div>
              </div>
            )}

            {/* VERIFICATION PENDING STATE */}
            {(rawStatus === WORKFLOW_STATES.VERIFICATION_PENDING || rawStatus === WORKFLOW_STATES.DEPARTMENT_REVIEW) && (
              <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs flex items-center gap-3">
                <Clock size={18} className="shrink-0" />
                <div>
                  <p className="font-bold">Awaiting Department Verification</p>
                  <p className="text-[11px] text-violet-400/90 mt-0.5">
                    Your evidence has been received. The department officer will review the before/after photos and approve resolution.
                  </p>
                </div>
              </div>
            )}

            {/* CLOSED / VERIFIED STATE */}
            {rawStatus === WORKFLOW_STATES.CLOSED && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                <CheckCircle2 size={18} className="shrink-0" />
                <div>
                  <p className="font-bold">Work Verified & Resolved</p>
                  <p className="text-[11px] text-emerald-400/90 mt-0.5">
                    This task has been successfully verified by municipal operations.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION A — COMPLAINT INFORMATION */}
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Section A — Citizen Complaint Information
              </label>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.MEDIUM}`}>
                {priority} Priority
              </span>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">
                {task.category || "Civic Issue"}
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                {task.title || task.description?.substring(0, 60) || "Civic Task"}
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed whitespace-pre-wrap">
                {task.description || "No description provided."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-white/5 text-xs text-slate-400">
              <div>
                <span className="text-[10px] block uppercase font-semibold">Created Date</span>
                <span className="text-slate-200">
                  {new Date(task.createdAt || task.created_at || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div>
                <span className="text-[10px] block uppercase font-semibold">Assigned Date</span>
                <span className="text-slate-200">
                  {new Date(task.assignedAt || task.createdAt || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div>
                <span className="text-[10px] block uppercase font-semibold">Target SLA</span>
                <span className="text-amber-400 font-bold">
                  {priority === "CRITICAL" ? "4 Hours" : priority === "HIGH" ? "24 Hours" : "72 Hours"}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION B — CITIZEN EVIDENCE */}
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Camera size={13} className="text-teal-400" />
                <span>Section B — Original Citizen Evidence</span>
              </label>
              {citizenPhoto && (
                <button
                  onClick={() => setLightboxImage(citizenPhoto)}
                  className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium"
                >
                  <Eye size={12} />
                  <span>Enlarge Evidence</span>
                </button>
              )}
            </div>

            {citizenPhoto ? (
              <div
                onClick={() => setLightboxImage(citizenPhoto)}
                className="h-56 rounded-2xl overflow-hidden border border-white/10 cursor-pointer relative group bg-black/40"
              >
                <img
                  src={citizenPhoto}
                  alt="Citizen Evidence"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-xs text-white font-medium flex items-center gap-1.5">
                    <Eye size={16} /> Click to Enlarge & Inspect
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center bg-black/20 text-slate-400 space-y-1">
                <Camera size={22} className="mx-auto text-slate-600 mb-1" />
                <p className="text-xs">No initial citizen photo attached</p>
              </div>
            )}
          </div>

          {/* SECTION C & D — LOCATION / GPS & MAP & CONFIRM ARRIVAL */}
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
            <ComplaintLocationMap
              latitude={task.latitude}
              longitude={task.longitude}
              address={task.address}
              complaintTitle={task.title || task.description}
              referenceId={task.referenceId || task.reference_id}
              currentGps={currentGps}
              setCurrentGps={setCurrentGps}
              onConfirmArrival={(loc, dist) => onConfirmArrival?.(task.id, loc, dist)}
            />
          </div>

          {/* SECTION G — STRUCTURED WORK REPORT (IF NOTES EXIST) */}
          {task.engineerNotes && (
            <div className="p-6 rounded-3xl bg-black/40 border border-teal-500/20 space-y-3">
              <label className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare size={14} className="text-teal-400" />
                <span>Submitted Field Work Report</span>
              </label>

              <div className="p-4 rounded-2xl bg-black/50 border border-white/5 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {task.engineerNotes}
              </div>
            </div>
          )}

          {/* SECTION F — WORK PROGRESSION TIMELINE */}
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={13} className="text-teal-400" />
              <span>Section F — Work Progression Timeline</span>
            </label>

            <div className="space-y-2 pt-1">
              {TIMELINE_STEPS.map((step, idx) => {
                const isPassed = idx <= effectiveIdx;
                const isCurrent = idx === effectiveIdx;
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCurrent
                        ? "bg-teal-400 text-black shadow-[0_0_10px_rgba(45,212,191,0.5)]"
                        : isPassed
                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                        : "bg-slate-800 text-slate-500"
                    }`}>
                      {isPassed ? "✓" : idx + 1}
                    </div>
                    <span className={`text-xs font-medium ${isCurrent ? "text-teal-300 font-bold" : isPassed ? "text-slate-200" : "text-slate-500"}`}>
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
                  Citizen Evidence Photo Viewer
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
                  alt="Citizen Evidence Full View"
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
