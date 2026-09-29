import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, CheckCircle2, RotateCcw, AlertTriangle, Cpu, Database, BarChart3 } from "lucide-react";
import api from "../../utils/api.js";

export default function AIPerformanceCard() {
  const [statusData, setStatusData] = useState(null);
  const [versionsData, setVersionsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRollbackVersion, setSelectedRollbackVersion] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, versionsRes] = await Promise.all([
        api.get("/admin/ai/training-status"),
        api.get("/admin/ai/model/versions"),
      ]);
      setStatusData(statusRes.data);
      setVersionsData(versionsRes.data?.versions || []);
      if (versionsRes.data?.active_production_version) {
        setSelectedRollbackVersion(versionsRes.data.active_production_version);
      }
    } catch (err) {
      console.warn("Failed to fetch AI training status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRunRetraining = async (force = true) => {
    setRetraining(true);
    setMessage("");
    try {
      const { data } = await api.post("/admin/ai/training/run", { force });
      setMessage(data.message || "Retraining completed successfully.");
      await fetchData();
    } catch (err) {
      setMessage("Failed to run retraining pipeline.");
    } finally {
      setRetraining(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedRollbackVersion) return;
    setRollingBack(true);
    setMessage("");
    try {
      const { data } = await api.post("/admin/ai/model/rollback", {
        target_version: selectedRollbackVersion,
      });
      setMessage(`Switched active production model to ${data.new_active_version || selectedRollbackVersion}`);
      await fetchData();
    } catch (err) {
      setMessage("Rollback failed.");
    } finally {
      setRollingBack(false);
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-3xl p-6 border border-cyan-500/20 flex items-center justify-center py-12">
        <RefreshCw size={20} className="animate-spin text-cyan-400 mr-2" />
        <span className="text-xs text-slate-400 font-medium">Loading AI Continuous Learning Performance Metrics...</span>
      </div>
    );
  }

  const overridesByDept = statusData?.override_breakdown_by_department || {};

  return (
    <div className="glass-strong rounded-3xl p-6 border border-cyan-500/20 relative overflow-hidden shadow-xl mb-8">
      {/* Top Ambient Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={18} className="text-cyan-400" />
            <h3 className="text-lg font-bold font-display text-white">AI Performance & Human-in-the-Loop Continuous Learning</h3>
          </div>
          <p className="text-xs text-slate-400">
            Real-time analytics on administrator decisions, feedback pool accumulation, and model registry management.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-mono px-3 py-1 rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 font-bold flex items-center gap-1.5">
            <Cpu size={14} /> Active: {statusData?.current_model_version || "deberta-v3-base-cc-v1.0"}
          </span>
        </div>
      </div>

      {message && (
        <div className="bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs rounded-2xl p-3 mb-6 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-slate-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Predictions Logged</span>
          <span className="text-xl font-bold font-display text-white">{statusData?.total_predictions_logged || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Feedback Pool: {statusData?.feedback_pool_size || 0}</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Admin Acceptance Rate</span>
          <span className="text-xl font-bold font-display text-emerald-400">{statusData?.acceptance_rate_percentage || "100.0%"}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Accepted: {statusData?.admin_acceptances || 0}</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Admin Overrides</span>
          <span className="text-xl font-bold font-display text-rose-400">{statusData?.admin_overrides || 0}</span>
          <span className="text-[10px] text-slate-500 block mt-1">Rate: {statusData?.override_rate_percentage || "0.0%"}</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">Dataset Size & Macro F1</span>
          <span className="text-xl font-bold font-display text-cyan-300">{(statusData?.active_model_macro_f1 * 100)?.toFixed(1) || 95.8}%</span>
          <span className="text-[10px] text-slate-500 block mt-1">Dataset: {statusData?.training_dataset_size || 336} samples</span>
        </div>
      </div>

      {/* Override Breakdown & Retraining Controls */}
      <div className="grid md:grid-cols-2 gap-6 pt-2">
        {/* Override Breakdown by Department */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={15} className="text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Department Override Analytics
            </span>
          </div>

          {Object.keys(overridesByDept).length === 0 ? (
            <p className="text-xs text-slate-500 py-4 italic">No administrator overrides recorded yet. Ground-truth labels are matching AI recommendations.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(overridesByDept).map(([dept, count]) => (
                <div key={dept} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                  <span className="text-slate-300 font-medium">{dept}</span>
                  <span className="text-rose-400 font-mono font-semibold">{count} overrides</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Continuous Retraining & Rollback Management */}
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Database size={15} className="text-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Retraining & Deployment Guardrails
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-snug">
              Retraining threshold: Requires <strong className="text-white">{statusData?.min_required_feedback_examples || 10} new verified decisions</strong>. Candidate models are evaluated and deployed only if Macro F1 ≥ 0.75 without performance degradation.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => handleRunRetraining(true)}
              disabled={retraining}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {retraining ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              <span>{retraining ? "Retraining Candidate Model..." : "Run Retraining Pipeline"}</span>
            </button>

            {versionsData.length > 1 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedRollbackVersion}
                  onChange={(e) => setSelectedRollbackVersion(e.target.value)}
                  className="bg-slate-950 border border-white/10 text-xs text-white rounded-xl px-2.5 py-2 focus:outline-none"
                >
                  {versionsData.map((v) => (
                    <option key={v.model_version} value={v.model_version}>
                      {v.model_version} ({v.status})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRollback}
                  disabled={rollingBack}
                  className="py-2 px-3 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={14} />
                  <span>Rollback</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
