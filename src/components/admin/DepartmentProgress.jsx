import { useEffect, useState } from "react";
import api from "../../utils/api";

export default function DepartmentProgress() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      setLoading(true);
      try {
        const { data } = await api.get("/departments/stats");
        if (!mounted) return;
        const list = Array.isArray(data) ? data : (data.departments || data.stats || []);
        setDepartments(
          list.map((d) => ({
            name: d.name,
            total: d.total || 0,
            resolved: d.resolved || 0
          }))
        );
      } catch (err) {
        console.warn("[DEPARTMENT PROGRESS] Could not load department stats:", err?.message || err);
        if (mounted) setDepartments([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchStats();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="mt-10">
      <h2 className="text-2xl font-semibold text-white mb-4">Department Progress</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loading && <div className="text-sm text-slate-400">Loading department stats...</div>}

        {!loading && departments.map((d) => {
          const total = d.total || 0;
          const resolved = d.resolved || 0;
          const percent = total > 0 ? Math.round((resolved / total) * 100) : 0;

          return (
            <div key={d.name} className="bg-slate-800 rounded-xl p-4 text-white shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">{d.name}</p>
                  <p className="text-xs text-slate-300 mt-1">{resolved.toLocaleString()} resolved of {total.toLocaleString()}</p>
                </div>
                <div className="text-sm font-bold">{percent}%</div>
              </div>

              <div className="mt-3 bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 bg-gradient-to-r from-cyan-400 to-violet-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
