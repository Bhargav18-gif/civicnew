import { useEffect, useState } from "react";
import Sidebar from "../../components/admin/Sidebar.jsx";
import Header from "../../components/admin/Header.jsx";
import api from "../../utils/api.js";
import { motion } from "framer-motion";
import { Activity, PlayCircle, Settings, RefreshCw, AlertCircle, Database, CheckCircle2 } from "lucide-react";

export default function AIModelConfig() {
  const [trainingStatus, setTrainingStatus] = useState(null);
  const [modelVersions, setModelVersions] = useState([]);
  const [automationConfig, setAutomationConfig] = useState(null);
  const [trainingRuns, setTrainingRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusRes, versionsRes, configRes, runsRes] = await Promise.all([
        api.get("/admin/ai/training-status"),
        api.get("/admin/model/versions"),
        api.get("/admin/automation-config"),
        api.get("/admin/ai/training/runs")
      ]);
      setTrainingStatus(statusRes.data);
      setModelVersions(versionsRes.data.versions || []);
      setAutomationConfig(configRes.data);
      setTrainingRuns(runsRes.data.runs || []);
    } catch (err) {
      console.error("Failed to load AI Config data", err);
      setError("Failed to load configuration. Please ensure the Python AI backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const triggerRetraining = async () => {
    if (!window.confirm("Are you sure you want to trigger a new AI model training run?")) return;

    setActionLoading(true);
    try {
      await api.post("/admin/ai/training/run", {
        trigger: "manual",
        includeFeedback: true
      });
      alert("Training run initiated successfully. The model will be retrained in the background.");
      fetchDashboardData(); // Refresh status
    } catch (err) {
      console.error("Retraining failed", err);
      alert("Failed to start retraining. " + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const updateAutomationConfig = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.post("/admin/automation-config", automationConfig);
      alert("Automation configuration updated successfully.");
    } catch (err) {
      console.error("Config update failed", err);
      alert("Failed to update config. " + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-300">
      <Sidebar />
      <main className="flex-1 p-6 sm:p-10 lg:pl-10 lg:pr-10 lg:py-10 max-w-[1400px] mt-16 lg:mt-0 overflow-y-auto">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Header
            title="AI Retraining & Automation"
            description="Manage civic task classification models, retraining pipelines, and feedback loops."
          />

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl flex items-center gap-3 mb-8">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Training Status & Trigger */}
              <div className="glass rounded-3xl p-6 border border-white/5 bg-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <Activity className="text-cyan-400" />
                  Pipeline Status
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5">
                    <p className="text-sm text-slate-400 mb-1 font-semibold uppercase tracking-wider">Current State</p>
                    <div className="flex items-center gap-3">
                      {trainingStatus?.status === "running" ? (
                        <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
                          <RefreshCw className="animate-spin" size={20} />
                          Training in Progress...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-lg">
                          <CheckCircle2 size={20} />
                          Idle / Ready
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Last run: {trainingStatus?.last_run || "Never"}</p>
                  </div>

                  <div className="flex items-center justify-center md:justify-end">
                    <button
                      onClick={triggerRetraining}
                      disabled={actionLoading || trainingStatus?.status === "running"}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 transition-all"
                    >
                      {actionLoading ? <RefreshCw className="animate-spin" size={20} /> : <PlayCircle size={24} />}
                      Trigger Model Retraining
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* Automation Config */}
                <div className="glass rounded-3xl p-6 border border-white/5 bg-white/5">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                    <Settings className="text-violet-400" />
                    Automation Policy
                  </h3>
                  {automationConfig && (
                    <form onSubmit={updateAutomationConfig} className="space-y-5">
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2">High Confidence Threshold (%)</label>
                        <input
                          type="number"
                          value={automationConfig.high_confidence_threshold}
                          onChange={e => setAutomationConfig({ ...automationConfig, high_confidence_threshold: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-cyan-400/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-slate-400 mb-2">Auto-Assign Enabled</label>
                        <select
                          value={automationConfig.auto_assign_enabled.toString()}
                          onChange={e => setAutomationConfig({ ...automationConfig, auto_assign_enabled: e.target.value === "true" })}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-cyan-400/50 cursor-pointer"
                        >
                          <option value="true">Enabled (Auto-route high confidence)</option>
                          <option value="false">Disabled (Require Admin Review)</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-4 rounded-xl transition-colors border border-white/5"
                      >
                        {actionLoading ? "Saving..." : "Save Configuration"}
                      </button>
                    </form>
                  )}
                </div>

                {/* Model Versions */}
                <div className="glass rounded-3xl p-6 border border-white/5 bg-white/5 flex flex-col">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                    <Database className="text-emerald-400" />
                    Deployed Models
                  </h3>
                  <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 space-y-3">
                    {modelVersions.length === 0 ? (
                      <p className="text-slate-500 text-sm">No models found.</p>
                    ) : (
                      modelVersions.map((version, i) => (
                        <div key={i} className="bg-slate-900/50 border border-white/5 rounded-xl p-4 flex justify-between items-center">
                          <div>
                            <p className="text-white font-semibold text-sm">{version.id}</p>
                            <p className="text-xs text-slate-500 mt-1">Deployed: {new Date(version.deployed_at).toLocaleString()}</p>
                          </div>
                          {version.active && (
                            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full border border-emerald-500/20 font-bold uppercase tracking-wider">
                              Active
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Training History */}
              <div className="glass rounded-3xl p-6 border border-white/5 bg-white/5">
                <h3 className="text-lg font-bold text-white mb-6">Training History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                      <tr>
                        <th className="px-4 py-3 rounded-tl-xl">Run ID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Duration</th>
                        <th className="px-4 py-3">Metrics</th>
                        <th className="px-4 py-3 rounded-tr-xl text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {trainingRuns.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="px-4 py-8 text-center text-slate-500">No training history available.</td>
                        </tr>
                      ) : (
                        trainingRuns.map((run, i) => (
                          <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-mono text-cyan-400">{run.id}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${run.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                                  run.status === "failed" ? "bg-rose-500/20 text-rose-400" :
                                    "bg-amber-500/20 text-amber-400"
                                }`}>
                                {run.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{run.duration}</td>
                            <td className="px-4 py-3 text-xs">
                              {run.metrics ? `F1: ${run.metrics.f1 || 'N/A'}` : 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              {new Date(run.created_at).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
