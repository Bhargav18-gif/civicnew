import { useState } from "react";
import { motion } from "framer-motion";
import { X, Flag, Zap, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { PRIORITY_LEVELS, PRIORITY_SLA_HOURS } from "../../constants/workflow.js";

const PRIORITY_CONFIG = [
  {
    key: PRIORITY_LEVELS.CRITICAL,
    label: "Critical Priority",
    sla: `${PRIORITY_SLA_HOURS.CRITICAL} Hours SLA`,
    desc: "Immediate danger to public safety or major utility breakdown",
    color: "border-red-500/40 bg-red-500/10 text-red-300",
    icon: Zap
  },
  {
    key: PRIORITY_LEVELS.HIGH,
    label: "High Priority",
    sla: `${PRIORITY_SLA_HOURS.HIGH} Hours SLA`,
    desc: "Urgent civic disruption requiring rapid response",
    color: "border-orange-500/40 bg-orange-500/10 text-orange-300",
    icon: AlertTriangle
  },
  {
    key: PRIORITY_LEVELS.MEDIUM,
    label: "Medium Priority",
    sla: `${PRIORITY_SLA_HOURS.MEDIUM} Hours SLA`,
    desc: "Standard municipal issue addressed within regular schedule",
    color: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    icon: Flag
  },
  {
    key: PRIORITY_LEVELS.LOW,
    label: "Low Priority",
    sla: `${PRIORITY_SLA_HOURS.LOW} Hours SLA`,
    desc: "Minor maintenance or aesthetic enhancement",
    color: "border-slate-600 bg-slate-800 text-slate-300",
    icon: Clock
  }
];

export default function PriorityModal({
  complaint,
  isOpen,
  onClose,
  onSave,
  loading = false
}) {
  const [selectedPriority, setSelectedPriority] = useState(
    (complaint?.priority || "MEDIUM").toUpperCase()
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
        className="relative w-full max-w-lg bg-[#0c1220] border border-white/10 rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#080d1a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Flag size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Adjust Complaint Priority</h3>
              <p className="text-xs text-slate-400">
                Ref: <span className="text-cyan-400 font-mono">{complaint.referenceId || complaint.id}</span>
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

        {/* Priority Options */}
        <div className="p-6 space-y-3">
          {PRIORITY_CONFIG.map((item) => {
            const Icon = item.icon;
            const isSelected = selectedPriority === item.key;
            return (
              <div
                key={item.key}
                onClick={() => setSelectedPriority(item.key)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  isSelected
                    ? `${item.color} shadow-lg ring-1 ring-white/20`
                    : "bg-slate-900/40 border-white/5 hover:bg-white/[0.02]"
                }`}
              >
                <div className={`p-2 rounded-xl shrink-0 ${isSelected ? "bg-white/10" : "bg-black/30"}`}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{item.label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-black/40 border border-white/10">
                      {item.sla}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-white/10 bg-[#080d1a] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onSave?.(complaint.id, selectedPriority)}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-black shadow-lg disabled:opacity-50 transition flex items-center gap-2"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            <span>Update Priority</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
