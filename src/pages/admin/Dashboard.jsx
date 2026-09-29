import { useEffect, useState } from "react";
import Sidebar from "../../components/admin/Sidebar.jsx";
import DashboardCards from "../../components/admin/DashboardCards.jsx";
import DepartmentProgress from "../../components/admin/DepartmentProgress.jsx";
import ComplaintTrends from "../../components/admin/ComplaintTrends.jsx";
import AdminReviewQueue from "../../components/admin/AdminReviewQueue.jsx";
import ComplaintDetailsModal from "../../components/admin/ComplaintDetailsModal.jsx";
import api from "../../utils/api.js";
import { motion, AnimatePresence } from "framer-motion";
import Header from "../../components/admin/Header.jsx";
import { Sparkles, Cpu, CheckCircle2, AlertTriangle, ShieldCheck, Activity } from "lucide-react";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    rejected: 0,
    slaBreached: 0,
    totalUsers: 0
  });
  const [aiMetrics, setAiMetrics] = useState({
    totalPredictions: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    humanReviews: 0,
    aiOverrides: 0,
    aiFailures: 0
  });
  const [exceptions, setExceptions] = useState([]);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, exceptionsRes, aiRes] = await Promise.all([
        api.get("/admin/stats").catch(() => ({ data: {} })),
        api.get("/admin/exceptions").catch(() => ({ data: { reviewQueue: [] } })),
        api.get("/admin/ai-metrics").catch(() => ({ data: { metrics: {} } }))
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (exceptionsRes.data?.reviewQueue) {
        setExceptions(exceptionsRes.data.reviewQueue.map(c => normalizeComplaintDoc(c)));
      }
      if (aiRes.data?.metrics) setAiMetrics(aiRes.data.metrics);
    } catch (err) {
      console.error("Error fetching admin dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-950">
      <Sidebar />

      <main className="flex-1 p-6 sm:p-10 lg:pl-10 lg:pr-10 lg:py-10 max-w-[1400px] mt-16 lg:mt-0 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Header
            title="Admin System Control"
            description="Autonomous routing supervision, exception review queue, and municipal performance metrics."
          />

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* 1. System Overview Metrics */}
              <DashboardCards stats={stats} />

              {/* 2. Real AI Monitoring Metrics (Part 20) */}
              <div className="glass rounded-3xl p-6 border border-cyan-500/20 bg-cyan-950/10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-cyan-400" />
                    <h3 className="text-base font-bold text-white">AI Classification & Autonomous Routing Metrics</h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                    Live Database Metrics
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-3.5">
                    <p className="text-[11px] text-slate-400">Total Triage</p>
                    <p className="text-xl font-bold font-mono text-white mt-1">{aiMetrics.totalPredictions || 0}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-emerald-500/20 rounded-2xl p-3.5">
                    <p className="text-[11px] text-emerald-400">High Confidence (&ge;85%)</p>
                    <p className="text-xl font-bold font-mono text-emerald-300 mt-1">{aiMetrics.highConfidence || 0}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-3.5">
                    <p className="text-[11px] text-amber-400">Medium Confidence</p>
                    <p className="text-xl font-bold font-mono text-amber-300 mt-1">{aiMetrics.mediumConfidence || 0}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-orange-500/20 rounded-2xl p-3.5">
                    <p className="text-[11px] text-orange-400">Low Confidence (&lt;70%)</p>
                    <p className="text-xl font-bold font-mono text-orange-300 mt-1">{aiMetrics.lowConfidence || 0}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-indigo-500/20 rounded-2xl p-3.5">
                    <p className="text-[11px] text-indigo-400">Admin Overrides</p>
                    <p className="text-xl font-bold font-mono text-indigo-300 mt-1">{aiMetrics.aiOverrides || 0}</p>
                  </div>
                  <div className="bg-slate-900/60 border border-rose-500/20 rounded-2xl p-3.5">
                    <p className="text-[11px] text-rose-400">AI Failures</p>
                    <p className="text-xl font-bold font-mono text-rose-300 mt-1">{aiMetrics.aiFailures || 0}</p>
                  </div>
                </div>
              </div>

              {/* 3. Administrative Review Queue (Part 13) */}
              <AdminReviewQueue
                exceptions={exceptions}
                onActionCompleted={fetchDashboardData}
                onSelectIssue={(issue) => setSelectedIssue(issue)}
              />

              {/* 4. Trends and Department Progress */}
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <ComplaintTrends />
                  <DepartmentProgress />
                </div>

                <div className="glass rounded-3xl p-6 flex flex-col border border-white/5">
                  <h3 className="text-lg font-bold font-display text-white mb-2">Administrative Navigation</h3>
                  <p className="text-slate-400 text-xs mb-6">
                    Quickly inspect all complaints, manage registered citizens, or configure AI routing thresholds.
                  </p>

                  <div className="space-y-3 mt-auto">
                    <button
                      onClick={() => window.location.href = "/admin/complaints"}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-cyan-400/30 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-300">All Complaints</span>
                      <span className="text-xs text-cyan-400 font-mono font-bold">&rarr;</span>
                    </button>
                    <button
                      onClick={() => window.location.href = "/admin/users"}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-cyan-400/30 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-300">Registered Citizens & Engineers</span>
                      <span className="text-xs text-cyan-400 font-mono font-bold">&rarr;</span>
                    </button>
                    <button
                      onClick={() => window.location.href = "/admin/ai-config"}
                      className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-cyan-400/30 transition-all cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-slate-300">AI Routing Configuration</span>
                      <span className="text-xs text-cyan-400 font-mono font-bold">&rarr;</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </main>

      {/* Complaint Details Modal */}
      <AnimatePresence>
        {selectedIssue && (
          <ComplaintDetailsModal
            issue={selectedIssue}
            onClose={() => setSelectedIssue(null)}
            onUpdate={() => {
              setSelectedIssue(null);
              fetchDashboardData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}