import { useState, useEffect } from "react";
import { Bell, Check, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { notificationApi } from "../../services/api/notificationApi.js";

export default function UserNotifications({ userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userEmail) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    notificationApi.getMyNotifications()
      .then(data => {
        if (cancelled) return;
        const sorted = [...data].sort(
          (a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt)
        );
        setNotifications(sorted);
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) console.warn("Failed to load notifications:", err.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [userEmail]);

  const markAsRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: true, read: true } : n)
      );
    } catch (error) {
      console.warn("Failed to mark notification as read", error.message);
    }
  };

  const markAllAsRead = () => {
    const unread = notifications.filter(n => !n.is_read && !n.read);
    unread.forEach(n => markAsRead(n.id));
  };

  return (
    <div className="glass rounded-3xl p-8">
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <h2 className="text-3xl font-bold font-display">Notifications</h2>
        {notifications.some(n => !n.is_read && !n.read) && (
          <button
            onClick={markAllAsRead}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Mark all as read
          </button>
        )}
      </div>

      <p className="text-slate-400 mb-8">
        Updates and feedback on your reported issues.
      </p>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 text-slate-500">
            <Bell size={20} />
          </div>
          <p className="text-slate-400 text-sm">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const isRead = notif.is_read || notif.read;
            return (
              <div
                key={notif.id}
                className={`border rounded-2xl p-5 md:p-6 transition-colors ${
                  isRead
                    ? "bg-white/5 border-white/5 hover:bg-white/10"
                    : "bg-cyan-900/10 border-cyan-500/20 hover:bg-cyan-900/20 shadow-[0_0_15px_rgba(34,211,238,0.05)]"
                }`}
              >
                <div className="flex gap-4 items-start">
                  <div className={`p-2 rounded-full shrink-0 mt-1 ${isRead ? "bg-white/10 text-slate-400" : "bg-cyan-400/20 text-cyan-400"}`}>
                    <Bell size={18} />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <h3 className={`text-base font-semibold ${isRead ? "text-slate-300" : "text-white"}`}>
                        {notif.title || notif.issueTitle}
                      </h3>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1 whitespace-nowrap">
                        <Clock size={10} />
                        {new Date(notif.created_at || notif.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                        })}
                      </span>
                    </div>

                    <p className="text-sm text-slate-400 mb-3">{notif.message}</p>

                    <div className="flex items-center gap-3">
                      <Link
                        to="/track"
                        state={{ referenceId: notif.complaint_id || notif.complaintId }}
                        className="text-xs font-semibold text-cyan-400 hover:underline"
                      >
                        View Complaint Details
                      </Link>

                      {!isRead && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="text-xs flex items-center gap-1 text-slate-500 hover:text-white transition-colors cursor-pointer ml-auto"
                        >
                          <Check size={12} /> Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
