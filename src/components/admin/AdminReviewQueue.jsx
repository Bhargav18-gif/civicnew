import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  RotateCcw,
  Zap,
  SlidersHorizontal
} from "lucide-react";
import Button from "../ui/Button.jsx";
import toast from "react-hot-toast";
import api from "../../utils/api.js";

const CANONICAL_DEPARTMENTS = [
  { id: "roads", name: "Roads & Infrastructure", code: "ROADS" },
  { id: "water", name: "Water Supply", code: "WATER" },
  { id: "electricity", name: "Electricity & Lighting", code: "ELECTRICAL" },
  { id: "garbage", name: "Sanitation & Waste", code: "SANITATION" },
  { id: "drainage", name: "Drainage & Sewage", code: "DRAINAGE" },
  { id: "health", name: "Public Health", code: "PUBLIC_HEALTH" },
  { id: "transport", name: "Transport & Traffic", code: "TRANSPORT" },
  { id: "public_safety", name: "Public Safety", code: "PUBLIC_SAFETY" }
];

export default function AdminReviewQueue({ exceptions = [], onActionCompleted, onSelectIssue }) {
  const [selectedDepts, setSelectedDepts] = useState({});
  const [loadingIds, setLoadingIds] = useState({});

  const setBusy = (id, isBusy) => {
    setLoadingIds(prev => ({ ...prev, [id]: isBusy }));
  };

  // 1. Approve AI recommendation
  const handleApprove = async (complaint) => {
    const id = complaint.id || complaint.reference_id || complaint.referenceId;
    const targetDept = complaint.department_id || complaint.department || selectedDepts[id] || "roads";

    setBusy(id, true);
    try {
      await api.post(`/admin/issues/${id}/override-ai`, {
        department: targetDept,
        category: complaint.category || "General",
        priority: complaint.priority || "MEDIUM",
        reason: "Approved by administrator from review queue"
      });
      toast.success(`Complaint ${complaint.reference_id || complaint.referenceId} routed to ${targetDept.toUpperCase()}!`);
      if (onActionCompleted) onActionCompleted();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to route complaint.");
    } finally {
      setBusy(id, false);
    }
  };

  // 2. Change department (override)
  const handleOverrideDepartment = async (complaint) => {
    const id = complaint.id || complaint.reference_id || complaint.referenceId;
    const targetDept = selectedDepts[id];

    if (!targetDept) {
      toast.error("Please select a target department from the dropdown.");
      return;
    }

    setBusy(id, true);
    try {
      await api.post(`/admin/issues/${id}/override-ai`, {
        department: targetDept,
        category: complaint.category || "General",
        priority: complaint.priority || "MEDIUM",
        reason: `Manually routed to ${targetDept} by admin override`
      });
      toast.success(`Complaint routed to ${targetDept.toUpperCase()}!`);
      if (onActionCompleted) onActionCompleted();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to override department.");
    } finally {
      setBusy(id, false);
    }
  };

  // 3. Retry AI classification
  const handleRetryAI = async (complaint) => {
    const id = complaint.id || complaint.reference_id || complaint.referenceId;
    setBusy(id, true);
    try {
      const res = await api.post(`/admin/issues/${id}/retry-ai`);
      toast.success(`AI re-triaged complaint ${complaint.reference_id || complaint.referenceId}: status ${res.data?.newStatus}`);
      if (onActionCompleted) onActionCompleted();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "AI retry failed.");
    } finally {
      setBusy(id, false);
    }
  };

  if (!exceptions || exceptions.length === 0) {
    return (
      <div className="glass rounded-3xl p-8 border border-white/5 text-center">
        <CheckCircle2 size={36} className="text-emerald-400 mx-auto mb-3" />
        <h4 className="text-base font-bold text-white mb-1">Admin Review Queue is Clear</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          All complaints have been automatically classified, validated, and routed to municipal departments. No human intervention currently required.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl border border-white/5 overflow-hidden">
      <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={20} className="text-amber-400" />
            <h3 className="text-lg font-bold text-white">Administrative Review Queue</h3>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
              {exceptions.length} Pending
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Complaints flagged due to low AI confidence, classification anomalies, SLA breaches, or reopening requests.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase border-b border-white/5">
            <tr>
              <th className="py-3 px-4">Complaint ID</th>
              <th className="py-3 px-4">Citizen Report</th>
              <th className="py-3 px-4">Exception Reason</th>
              <th className="py-3 px-4">AI Category / Dept</th>
              <th className="py-3 px-4">Target Department</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {exceptions.map((c) => {
              const id = c.id || c.reference_id || c.referenceId;
              const refId = c.reference_id || c.referenceId || id;
              const isBusy = Boolean(loadingIds[id]);
              const reason = c.exceptionReason || c.status;
              const currentDept = c.department_id || c.department || "unassigned";

              return (
                <tr key={id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                    <button
                      onClick={() => onSelectIssue && onSelectIssue(c)}
                      className="hover:underline text-left"
                    >
                      {refId}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 max-w-xs">
                    <p className="font-semibold text-white truncate">{c.title}</p>
                    <p className="text-slate-400 truncate mt-0.5">{c.description}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      reason === 'AI_FAILED' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      reason === 'SLA_BREACH' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                      reason === 'REOPENED' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {reason}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-slate-200">{c.category || "General"}</div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Suggested: <span className="text-cyan-300">{currentDept}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-400"
                      value={selectedDepts[id] || c.department_id || ""}
                      onChange={(e) => setSelectedDepts({ ...selectedDepts, [id]: e.target.value })}
                      disabled={isBusy}
                    >
                      <option value="">Select Department</option>
                      {CANONICAL_DEPARTMENTS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {c.department_id && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleApprove(c)}
                          disabled={isBusy}
                          className="text-[11px] py-1 px-2.5"
                        >
                          Approve
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOverrideDepartment(c)}
                        disabled={isBusy || !selectedDepts[id]}
                        className="text-[11px] py-1 px-2.5"
                      >
                        Route
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRetryAI(c)}
                        disabled={isBusy}
                        icon={RefreshCw}
                        className="text-[11px] py-1 px-2 text-slate-400 hover:text-cyan-400"
                        title="Retry AI Classification"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
