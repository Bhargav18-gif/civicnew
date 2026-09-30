import { useState } from "react";
import { motion } from "framer-motion";
import { X, UserCheck, Wrench, CheckCircle2, AlertCircle, Clock, ShieldAlert } from "lucide-react";

export default function AssignEngineerModal({
  complaint,
  engineers = [],
  isOpen,
  onClose,
  onAssign,
  loading = false
}) {
  const [selectedEngineerId, setSelectedEngineerId] = useState(
    complaint?.assignedEngineerId || complaint?.assigned_engineer_id || ""
  );

  if (!complaint || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
      />

      {/* Modal Box */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        className="relative w-full max-w-xl bg-[#0c1220] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#080d1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Assign Field Engineer</h3>
              <p className="text-xs text-slate-400">
                Complaint Ref: <span className="text-cyan-400 font-mono">{complaint.referenceId || complaint.id}</span>
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

        {/* Complaint Details Card */}
        <div className="p-5 border-b border-white/5 bg-white/[0.01]">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                {complaint.category || "General"}
              </span>
              <span className="text-xs text-slate-400">
                Priority: <strong className="text-amber-400 uppercase">{complaint.priority || "MEDIUM"}</strong>
              </span>
            </div>
            <p className="text-xs text-slate-200 font-medium line-clamp-2">
              {complaint.title || complaint.description}
            </p>
          </div>
        </div>

        {/* Engineer Selection List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2">
            Available Department Engineers ({engineers.length})
          </label>

          {engineers.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
              <Wrench size={24} className="mx-auto text-slate-500 mb-2 opacity-50" />
              <p className="text-sm font-semibold text-slate-300">No active engineers in this department</p>
              <p className="text-xs text-slate-500 mt-1">
                Engineers must be registered and assigned to this department to receive tasks.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {engineers.map((eng) => {
                const isSelected = selectedEngineerId === eng.id;
                const activeCount = eng.activeAssignments || eng.activeCount || 0;
                const completedCount = eng.completedAssignments || eng.completedCount || 0;
                const isBusy = activeCount >= 4;
                const statusLabel = eng.is_active === false ? "OFFLINE" : isBusy ? "BUSY" : "AVAILABLE";

                return (
                  <div
                    key={eng.id}
                    onClick={() => setSelectedEngineerId(eng.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? "bg-cyan-500/15 border-cyan-400/50 shadow-[0_0_15px_-4px_rgba(34,211,238,0.3)]"
                        : "bg-slate-900/40 border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
                        {eng.name?.[0]?.toUpperCase() || "E"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate">{eng.name}</p>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase border ${
                            statusLabel === "AVAILABLE"
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                              : statusLabel === "BUSY"
                              ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                              : "bg-slate-700 text-slate-400 border-slate-600"
                          }`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{eng.email}</p>
                      </div>
                    </div>

                    {/* Workload Stats */}
                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-slate-200">
                        Active: <span className="text-cyan-400 font-bold">{activeCount}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Completed: <span className="text-emerald-400 font-medium">{completedCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-[#080d1a] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onAssign?.(complaint.id, selectedEngineerId)}
            disabled={!selectedEngineerId || loading}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_-2px_rgba(34,211,238,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <UserCheck size={14} />
            )}
            <span>Confirm Assignment</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
