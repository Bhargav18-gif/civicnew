import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Image as ImageIcon,
  FileText,
  Clock,
  Eye,
  Wrench,
  Sparkles
} from "lucide-react";
import { getPublicImageUrl } from "../../services/storage/complaintImageUpload.js";

export default function VerificationModal({
  complaint,
  isOpen,
  onClose,
  onVerify,
  loading = false
}) {
  const [mode, setMode] = useState("review"); // "review" | "reject_reason"
  const [rejectionReason, setRejectionReason] = useState("");
  const [lightboxImage, setLightboxImage] = useState(null);

  if (!complaint || !isOpen) return null;

  // Before photo
  const beforePhoto = complaint.imageUrl || complaint.image_url || getPublicImageUrl(complaint.imagePath || complaint.image_path) || null;

  // After photo (from media or complaint object)
  const afterMediaItems = Array.isArray(complaint.media) ? complaint.media.filter(m => m.mediaType === "AFTER" || m.media_type === "AFTER") : [];
  const afterPhoto = complaint.afterPhotoUrl || complaint.after_photo_url || afterMediaItems[0]?.fileUrl || afterMediaItems[0]?.file_url || null;

  const engineerNotes = complaint.engineerNotes || complaint.engineer_notes || "Repair completed successfully according to municipal guidelines.";
  const partsUsed = complaint.partsUsed || complaint.parts_used || [];

  function handleApprove() {
    onVerify?.(complaint.id, "ACCEPT", "Department verified and approved repair quality.");
  }

  function handleRejectSubmit() {
    if (!rejectionReason.trim()) return;
    onVerify?.(complaint.id, "REJECT", rejectionReason);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-sm"
      />

      {/* Modal Box */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative w-full max-w-4xl bg-[#0c1220] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#080d1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Work Verification Center</h3>
              <p className="text-xs text-slate-400">
                Complaint: <span className="text-cyan-400 font-mono">{complaint.referenceId || complaint.id}</span>
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Side-by-Side Photo Comparison */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-3">
              Before & After Repair Evidence Comparison
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before Photo Card */}
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={13} />
                    <span>Before Work (Citizen)</span>
                  </span>
                  {beforePhoto && (
                    <button
                      onClick={() => setLightboxImage(beforePhoto)}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <Eye size={12} />
                      <span>Zoom</span>
                    </button>
                  )}
                </div>

                {beforePhoto ? (
                  <div
                    onClick={() => setLightboxImage(beforePhoto)}
                    className="h-48 rounded-xl overflow-hidden border border-white/10 cursor-pointer group relative bg-black/40"
                  >
                    <img
                      src={beforePhoto}
                      alt="Before Repair"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-xs text-white font-medium flex items-center gap-1">
                        <Eye size={14} /> Click to Enlarge
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-500 gap-1 bg-white/[0.01]">
                    <ImageIcon size={20} className="opacity-40" />
                    <span className="text-xs">No initial citizen photo</span>
                  </div>
                )}
              </div>

              {/* After Photo Card */}
              <div className="p-4 rounded-2xl bg-black/30 border border-teal-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    <span>After Work (Engineer)</span>
                  </span>
                  {afterPhoto && (
                    <button
                      onClick={() => setLightboxImage(afterPhoto)}
                      className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                    >
                      <Eye size={12} />
                      <span>Zoom</span>
                    </button>
                  )}
                </div>

                {afterPhoto ? (
                  <div
                    onClick={() => setLightboxImage(afterPhoto)}
                    className="h-48 rounded-xl overflow-hidden border border-teal-500/30 cursor-pointer group relative bg-black/40"
                  >
                    <img
                      src={afterPhoto}
                      alt="After Repair"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 bg-teal-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <span className="text-xs text-teal-200 font-medium flex items-center gap-1">
                        <Eye size={14} /> Click to Enlarge
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-48 rounded-xl border border-dashed border-teal-500/20 flex flex-col items-center justify-center text-slate-500 gap-1 bg-white/[0.01]">
                    <ImageIcon size={20} className="opacity-40" />
                    <span className="text-xs text-teal-400/80">Pending repair photo upload</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Engineer Completion Notes */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <FileText size={14} className="text-cyan-400" />
              <span>Engineer Field Notes</span>
            </div>
            <p className="text-xs text-slate-200 bg-black/30 p-3 rounded-xl border border-white/5 leading-relaxed">
              {engineerNotes}
            </p>
          </div>

          {/* Rejection Prompt View */}
          {mode === "reject_reason" && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-red-300 uppercase">
                <AlertTriangle size={14} />
                <span>Specify Rejection Reason (Required for Rework)</span>
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why the repair does not meet quality standards or what additional work is required..."
                className="w-full h-24 p-3 rounded-xl bg-black/50 border border-red-500/30 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-400 custom-scrollbar resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-[#080d1a] flex items-center justify-between gap-3">
          {mode === "reject_reason" ? (
            <>
              <button
                type="button"
                onClick={() => setMode("review")}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                Back to Review
              </button>

              <button
                type="button"
                onClick={handleRejectSubmit}
                disabled={!rejectionReason.trim() || loading}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-400 text-white shadow-lg disabled:opacity-50 transition flex items-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                <span>Confirm Rejection & Send for Rework</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode("reject_reason")}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 transition flex items-center gap-1.5"
              >
                <AlertTriangle size={14} />
                <span>Reject & Request Rework</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_15px_-2px_rgba(16,185,129,0.4)] disabled:opacity-50 transition flex items-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>Approve & Resolve Issue</span>
                </button>
              </div>
            </>
          )}
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
                  Verification Evidence Full View
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
                  alt="Evidence Full View"
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
