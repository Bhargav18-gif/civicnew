import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, ChevronRight, Inbox } from "lucide-react";
import StatusBadge from "../ui/StatusBadge.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";
import { Link } from "react-router-dom";
import { complaintApi } from "../../services/api/complaintApi.js";

export default function RecentComplaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setComplaints([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    complaintApi.getCitizenComplaints()
      .then(list => {
        if (cancelled) return;
        const recent = list.slice(0, 5).map(raw => {
          const c = normalizeComplaintDoc(raw);
          return {
            id: c.referenceId || c.id,
            title: c.issue?.title || c.title,
            dept: c.issue?.category || c.category,
            location: c.location?.address || "Location on record",
            status: c.workflow?.status || c.status,
            date: new Date(c.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
          };
        });
        setComplaints(recent);
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) {
          console.warn("RecentComplaints fetch error:", err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [user?.uid]);

  return (
    <div className="glass rounded-3xl p-6 sm:p-7 border border-slate-800">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display font-semibold text-lg text-white">Recent Complaints</h2>
          <p className="text-xs text-slate-400 mt-0.5">Your recently reported civic issues</p>
        </div>
        <Link
          to="/track"
          className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition-colors"
        >
          Track complaints <ChevronRight size={13} />
        </Link>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <div className="py-10 text-center text-slate-500">
          <Inbox size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs">No complaints filed yet.</p>
          <Link to="/report" className="text-xs text-cyan-400 hover:underline mt-1 inline-block">
            Report your first issue
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {complaints.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-800/30 px-2 rounded-xl transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[11px] text-cyan-400 font-semibold">{c.id}</span>
                  <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                    {c.dept}
                  </span>
                </div>
                <p className="text-xs font-medium text-white truncate">{c.title}</p>
                <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={11} /> {c.location}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={c.status} />
                <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">{c.date}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
