import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon, ArrowRight } from "lucide-react";

const STATUS_COLORS = {
  Resolved: "#10b981",    // Emerald
  "In Progress": "#06b6d4", // Cyan
  Pending: "#f59e0b",     // Amber
  Rejected: "#f43f5e",    // Rose
  "SLA Breached": "#a855f7" // Purple
};

export default function ComplaintStatusDonut({ stats = null }) {
  const [activeIndex, setActiveIndex] = useState(null);

  const total = stats?.totalComplaints || stats?.total || 0;
  const resolved = stats?.resolved || stats?.stats?.closed || 0;
  const inProgress = stats?.inProgress || 0;
  const pending = stats?.pending || 0;
  const rejected = stats?.rejected || 0;
  const slaBreached = stats?.slaBreached || 0;

  const data = useMemo(() => {
    const items = [];
    if (resolved > 0 || total === 0) {
      items.push({ name: "Resolved", value: resolved || (total === 0 ? 1 : 0), color: STATUS_COLORS.Resolved });
    }
    if (inProgress > 0) {
      items.push({ name: "In Progress", value: inProgress, color: STATUS_COLORS["In Progress"] });
    }
    if (pending > 0) {
      items.push({ name: "Pending", value: pending, color: STATUS_COLORS.Pending });
    }
    if (rejected > 0) {
      items.push({ name: "Rejected", value: rejected, color: STATUS_COLORS.Rejected });
    }
    if (slaBreached > 0) {
      items.push({ name: "SLA Breached", value: slaBreached, color: STATUS_COLORS["SLA Breached"] });
    }

    if (items.length === 0) {
      items.push({ name: "Pending", value: 1, color: STATUS_COLORS.Pending });
    }
    return items;
  }, [total, resolved, inProgress, pending, rejected, slaBreached]);

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <div className="glass rounded-3xl p-6 border border-white/5 bg-slate-900/60 shadow-xl flex flex-col relative overflow-hidden h-full">
      {/* Glow Effect */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
            <PieIcon size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Status Breakdown</h3>
            <p className="text-[11px] text-slate-400">Live database distribution</p>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-cyan-300">
          {resolutionRate}% Resolved
        </span>
      </div>

      {/* Donut Chart with Center Metric */}
      <div className="relative h-[220px] w-full my-1 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0];
                  const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div className="bg-slate-950/95 border border-white/10 rounded-2xl p-3 shadow-2xl backdrop-blur-xl">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload.color }} />
                        <span className="text-xs font-bold text-white">{item.name}</span>
                      </div>
                      <p className="text-xs font-mono font-bold text-slate-200">
                        {item.value} issues ({percent}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={92}
              paddingAngle={4}
              dataKey="value"
              stroke="rgba(15,23,42,0.8)"
              strokeWidth={3}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  className="transition-all duration-300 hover:opacity-80 cursor-pointer"
                  style={{
                    filter: activeIndex === index ? `drop-shadow(0 0 8px ${entry.color})` : "none"
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Total Count Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-black font-mono text-white tracking-tight">{total}</span>
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Issues</span>
        </div>
      </div>

      {/* Legend & Breakdown List */}
      <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-white/5 text-xs">
        {data.map((item) => {
          const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-300 text-[11px] truncate font-medium">{item.name}</span>
              </div>
              <span className="font-mono font-bold text-white text-[11px] ml-1">{item.value}</span>
            </div>
          );
        })}
      </div>

      {/* Direct Nav Button */}
      <button
        onClick={() => window.location.href = "/admin/complaints"}
        className="mt-4 w-full flex items-center justify-between p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 border border-white/10 text-xs font-semibold transition-all cursor-pointer"
      >
        <span>View All in Complaints Table</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
