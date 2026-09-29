import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, CheckCircle2, TrendingUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { complaintApi } from "../../services/api/complaintApi.js";
import { WORKFLOW_STATES } from "../../constants/workflow.js";

const COLOR_MAP = {
  cyan: "from-cyan-400/20 to-cyan-400/5 text-cyan-300",
  amber: "from-amber-400/20 to-amber-400/5 text-amber-300",
  violet: "from-violet-400/20 to-violet-400/5 text-violet-300",
  blue: "from-blue-400/20 to-blue-400/5 text-blue-300",
};

export default function StatCards() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    inProgress: 0,
    resolved: 0,
    avgResponse: "—"
  });

  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;
    complaintApi.getCitizenComplaints()
      .then(list => {
        if (cancelled) return;
        const total = list.length;
        const inProgress = list.filter(i => {
          const st = (i.status || i.canonicalStatus || "").toUpperCase();
          return ![WORKFLOW_STATES.CLOSED, WORKFLOW_STATES.REJECTED].includes(st);
        }).length;
        const resolved = list.filter(i => {
          const st = (i.status || i.canonicalStatus || "").toUpperCase();
          return [WORKFLOW_STATES.CLOSED, WORKFLOW_STATES.CITIZEN_VERIFICATION].includes(st);
        }).length;
        setStats({ total, inProgress, resolved, avgResponse: total > 0 ? "Under 48h" : "—" });
      })
      .catch(err => {
        if (!cancelled) console.warn("StatCards fetch error:", err.message);
      });

    return () => { cancelled = true; };
  }, [user?.uid]);

  const resolutionRate = stats.total > 0 ? `${Math.round((stats.resolved / stats.total) * 100)}% resolution rate` : "No reports logged";

  const cards = [
    { icon: FileText, label: "Total Reports", value: String(stats.total), trend: "All submitted reports", color: "cyan" },
    { icon: Clock, label: "In Progress", value: String(stats.inProgress), trend: "Active & assigned", color: "amber" },
    { icon: CheckCircle2, label: "Resolved", value: String(stats.resolved), trend: resolutionRate, color: "violet" },
    { icon: TrendingUp, label: "Avg. SLA Response", value: stats.avgResponse, trend: "Target: under 48 hours", color: "blue" },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.08 }}
          className="glass rounded-2xl p-6 border border-slate-800"
        >
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${COLOR_MAP[stat.color]} flex items-center justify-center mb-4`}
          >
            <stat.icon size={18} />
          </div>
          <p className="font-display font-bold text-3xl text-white">{stat.value}</p>
          <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
          <p className="text-xs text-slate-500 mt-2">{stat.trend}</p>
        </motion.div>
      ))}
    </div>
  );
}
