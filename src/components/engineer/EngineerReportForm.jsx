import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Wrench,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Camera,
  Compass,
  UploadCloud,
  RefreshCw,
  Send,
  Building2,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import EvidenceUploader from "../common/EvidenceUploader.jsx";
import { WORKFLOW_STATES, STATUS_META } from "../../constants/workflow.js";
import { calculateDistanceMeters, formatDistance, getDeviceLocation } from "../../utils/geo.js";
import toast from "react-hot-toast";

export default function EngineerReportForm({
  assignedTasks = [],
  selectedComplaintId = null,
  onComplaintSelect,
  onSubmitReport,
  loading = false,
  userId
}) {
  // Active complaint object
  const [activeComplaint, setActiveComplaint] = useState(null);

  // Form State
  const [workStatus, setWorkStatus] = useState("IN_PROGRESS");
  const [workDescription, setWorkDescription] = useState("");
  const [findings, setFindings] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Photos
  const [beforePhotos, setBeforePhotos] = useState([]);
  const [afterPhotos, setAfterPhotos] = useState([]);

  // GPS confirmation
  const [gpsLocation, setGpsLocation] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsDistance, setGpsDistance] = useState(null);
  const [formError, setFormError] = useState("");

  // Auto-select initial complaint
  useEffect(() => {
    if (selectedComplaintId) {
      const found = assignedTasks.find(t => t.id === selectedComplaintId);
      if (found) setActiveComplaint(found);
    } else if (assignedTasks.length > 0 && !activeComplaint) {
      setActiveComplaint(assignedTasks[0]);
    }
  }, [selectedComplaintId, assignedTasks, activeComplaint]);

  // Handle complaint selection change
  function handleComplaintChange(complaintId) {
    const found = assignedTasks.find(t => t.id === complaintId);
    if (found) {
      setActiveComplaint(found);
      onComplaintSelect?.(complaintId);
      // Reset form
      setWorkDescription("");
      setFindings("");
      setActionTaken("");
      setMaterialsUsed("");
      setAdditionalNotes("");
      setBeforePhotos([]);
      setAfterPhotos([]);
      setFormError("");
    }
  }

  // Handle GPS capture
  async function handleCaptureGps() {
    setGpsLoading(true);
    setFormError("");
    try {
      const loc = await getDeviceLocation();
      setGpsLocation(loc);

      if (activeComplaint?.latitude && activeComplaint?.longitude) {
        const dist = calculateDistanceMeters(
          loc.latitude,
          loc.longitude,
          activeComplaint.latitude,
          activeComplaint.longitude
        );
        setGpsDistance(dist);
        toast.success(`GPS confirmed! Distance: ${formatDistance(dist)}`);
      } else {
        toast.success("GPS position recorded.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to retrieve device location.");
    } finally {
      setGpsLoading(false);
    }
  }

  // Form Submit
  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!activeComplaint) {
      setFormError("Please select an assigned complaint first.");
      return;
    }

    if (!workDescription.trim()) {
      setFormError("Work Description is required.");
      return;
    }

    if (workStatus === "COMPLETED" && afterPhotos.length === 0) {
      setFormError("At least one 'After Work' photo is required when submitting completion.");
      return;
    }

    const payload = {
      workStatus: workStatus === "COMPLETED" ? WORKFLOW_STATES.VERIFICATION_PENDING : WORKFLOW_STATES.IN_PROGRESS,
      workDescription: workDescription.trim(),
      findings: findings.trim(),
      actionTaken: actionTaken.trim(),
      materialsUsed: materialsUsed.trim() ? materialsUsed.split(",").map(s => s.trim()) : [],
      additionalNotes: additionalNotes.trim(),
      beforeMedia: beforePhotos.map(p => typeof p === "string" ? p : p.url),
      afterMedia: afterPhotos.map(p => typeof p === "string" ? p : p.url),
      gpsConfirmation: gpsLocation ? {
        ...gpsLocation,
        distanceMeters: gpsDistance
      } : null
    };

    onSubmitReport?.(activeComplaint.id, payload);
  }

  if (assignedTasks.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl border border-dashed border-white/10 bg-[#0a0f1d]">
        <Wrench size={32} className="mx-auto text-slate-500 mb-3 opacity-40" />
        <h3 className="text-base font-bold text-white">No Assigned Complaints Available</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          You currently do not have any complaints assigned to update. Once municipal dispatch assigns tasks to you, they will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
      {/* Header Card with Auto-filled Complaint Selector */}
      <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/10 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <FileText size={18} className="text-teal-400" />
              <span>Update Complaint & Field Work Report</span>
            </h2>
            <p className="text-xs text-slate-400">
              Record findings, actions taken, materials, and proof of work
            </p>
          </div>

          {/* Select active complaint */}
          <div className="min-w-[240px]">
            <select
              value={activeComplaint?.id || ""}
              onChange={(e) => handleComplaintChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-teal-500/40 text-teal-300 rounded-xl text-xs font-bold focus:outline-none focus:border-teal-400"
            >
              {assignedTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.referenceId || t.id.substring(0, 8)} — {t.category || "General"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Auto-filled details card */}
        {activeComplaint && (
          <div className="p-4 rounded-2xl bg-black/40 border border-white/5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Complaint Reference</span>
              <p className="font-mono font-bold text-cyan-400 text-sm mt-0.5">
                {activeComplaint.referenceId || activeComplaint.reference_id || activeComplaint.id}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Category & Priority</span>
              <p className="font-bold text-white mt-0.5">
                {activeComplaint.category || "General"} • <span className="text-amber-400 uppercase">{activeComplaint.priority || "MEDIUM"}</span>
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Reported Location</span>
              <p className="text-slate-300 truncate mt-0.5">
                {activeComplaint.address || "GPS Coordinates only"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Form Fields Card */}
      <div className="p-6 rounded-3xl bg-[#0a0f1d] border border-white/10 shadow-2xl space-y-6">
        {/* 1. Work Status Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            1. Current Work Status
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setWorkStatus("IN_PROGRESS")}
              className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                workStatus === "IN_PROGRESS"
                  ? "bg-amber-500/15 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30"
                  : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-white/5"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 font-bold">
                ⚡
              </div>
              <div>
                <span className="text-xs font-bold block text-white">In Progress</span>
                <span className="text-[11px] text-slate-400">Work is ongoing; more actions needed</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setWorkStatus("COMPLETED")}
              className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                workStatus === "COMPLETED"
                  ? "bg-teal-500/15 border-teal-500/50 text-teal-300 ring-1 ring-teal-500/30"
                  : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-white/5"
              }`}
            >
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400 font-bold">
                ✓
              </div>
              <div>
                <span className="text-xs font-bold block text-white">Completed & Ready for Verification</span>
                <span className="text-[11px] text-slate-400">Physical repair done; submit to department</span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Work Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
            2. Work Description <span className="text-red-400">*</span>
          </label>
          <textarea
            value={workDescription}
            onChange={(e) => setWorkDescription(e.target.value)}
            placeholder="Describe the work performed in detail..."
            rows={3}
            className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 custom-scrollbar resize-none"
            required
          />
        </div>

        {/* 3. Findings & 4. Action Taken */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              3. Site Findings
            </label>
            <textarea
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              placeholder="Describe what was observed upon arrival at the site..."
              rows={3}
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 custom-scrollbar resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              4. Action Taken
            </label>
            <textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Describe specific engineering techniques or steps executed..."
              rows={3}
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400 custom-scrollbar resize-none"
            />
          </div>
        </div>

        {/* 5. Materials Used & 6. Additional Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              5. Materials / Parts Used (Optional)
            </label>
            <input
              type="text"
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
              placeholder="e.g. Cold-mix asphalt 50kg, PVC Coupler 2-inch"
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
              6. Additional Notes (Optional)
            </label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. Barricades left for 2 hours while curing"
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
            />
          </div>
        </div>

        {/* 7 & 8. Before and After Photos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-white/5">
          <EvidenceUploader
            label="7. Before Work Photo"
            description="Photo of problem before starting repair"
            mediaType="BEFORE"
            userId={userId}
            complaintId={activeComplaint?.id}
            uploadedUrls={beforePhotos}
            onUploadSuccess={(photo) => setBeforePhotos([...beforePhotos, photo])}
            onRemovePhoto={(idx) => setBeforePhotos(beforePhotos.filter((_, i) => i !== idx))}
            maxPhotos={2}
          />

          <EvidenceUploader
            label="8. After Work Photo (Required for Completion)"
            description="Clear photo proving resolution"
            mediaType="AFTER"
            userId={userId}
            complaintId={activeComplaint?.id}
            uploadedUrls={afterPhotos}
            onUploadSuccess={(photo) => setAfterPhotos([...afterPhotos, photo])}
            onRemovePhoto={(idx) => setAfterPhotos(afterPhotos.filter((_, i) => i !== idx))}
            maxPhotos={3}
          />
        </div>

        {/* 9. Location Confirmation via GPS */}
        <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3 pt-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Compass size={14} className="text-teal-400" />
              <span>9. GPS Location Confirmation</span>
            </label>

            <button
              type="button"
              onClick={handleCaptureGps}
              disabled={gpsLoading}
              className="px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <RefreshCw size={13} className={gpsLoading ? "animate-spin text-teal-400" : ""} />
              <span>{gpsLocation ? "Update GPS Position" : "Use Current Location"}</span>
            </button>
          </div>

          {gpsLocation ? (
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>
                  GPS Confirmed: {gpsLocation.latitude.toFixed(5)}, {gpsLocation.longitude.toFixed(5)} (±{gpsLocation.accuracy}m)
                </span>
              </div>
              {gpsDistance !== null && (
                <span className="font-bold text-white">
                  Distance: {formatDistance(gpsDistance)}
                </span>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">
              Click 'Use Current Location' to attach your device's GPS coordinates to this report.
            </p>
          )}
        </div>

        {/* Form Error */}
        {formError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 border-t border-white/5 flex items-center justify-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-teal-400 hover:bg-teal-300 text-black font-bold text-xs shadow-[0_0_20px_-3px_rgba(45,212,191,0.5)] disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={15} />
            )}
            <span>{workStatus === "COMPLETED" ? "Submit Completion Report" : "Save Work Progress Update"}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
