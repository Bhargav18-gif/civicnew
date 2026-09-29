import { motion } from "framer-motion";
import { CheckCircle2, Clock, User, ShieldCheck } from "lucide-react";
import StatusBadge from "../ui/StatusBadge.jsx";

export default function ComplaintTimeline({ timeline = [], history = [] }) {
  // Support both canonical timeline and legacy history
  const events = (timeline && timeline.length > 0) ? timeline : history;

  if (!events || events.length === 0) {
    return (
      <div className="py-8 text-center text-slate-400 text-sm border border-slate-800 rounded-2xl bg-slate-950/40">
        No tracking history recorded yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 py-4">
      <div className="absolute left-8 top-6 bottom-6 w-px bg-slate-800" />
      
      {events.map((event, i) => {
        const actionText = event.action || event.stage || "Workflow Event";
        const actorName = event.actor || event.officer || event.department || "System";
        const eventTime = event.timestamp || event.date || new Date().toISOString();
        const eventStatus = event.status;

        return (
          <motion.div
            key={event.id || i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="relative flex gap-5"
          >
            <div className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 border-2 border-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)] mt-1">
              <CheckCircle2 size={12} className="text-cyan-400" />
            </div>
            
            <div className="flex-1 rounded-2xl p-4 sm:p-5 border border-slate-800 bg-slate-900/60 backdrop-blur-md">
              <div className="flex flex-wrap gap-2 items-center justify-between mb-2">
                <h4 className="font-medium text-white text-base">{actionText}</h4>
                <div className="flex items-center gap-2">
                  {eventStatus && <StatusBadge status={eventStatus} />}
                  <span className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-full border border-slate-800 font-mono">
                    <Clock size={12} className="text-slate-500" />
                    {new Date(eventTime).toLocaleString()}
                  </span>
                </div>
              </div>
              
              {event.remarks && (
                <p className="text-xs text-slate-300 mt-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  {event.remarks}
                </p>
              )}
              
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <User size={13} className="text-cyan-400" />
                  {actorName}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <ShieldCheck size={13} className="text-slate-600" />
                  Audited
                </span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
