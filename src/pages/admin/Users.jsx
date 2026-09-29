import { useEffect, useState } from "react";
import Sidebar from "../../components/admin/Sidebar.jsx";
import { motion } from "framer-motion";
import { Search, Activity } from "lucide-react";
import api from "../../utils/api.js";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoadingUsers(true);
    setLoadingComplaints(true);

    // Fetch users from Supabase via backend API
    api.get('/admin/users')
      .then(({ data }) => {
        const fetchedUsers = (data?.users || data || []);
        fetchedUsers.sort((a, b) => new Date(b.created_at || b.lastLoginAt) - new Date(a.created_at || a.lastLoginAt));
        setUsers(fetchedUsers);
        setLoadingUsers(false);
      })
      .catch(err => {
        console.error("Error fetching users:", err.message);
        setLoadingUsers(false);
      });

    // Fetch complaint count stats from Supabase via backend API
    api.get('/admin/issues')
      .then(({ data }) => {
        const fetchedComplaints = (data?.issues || []).map(c => ({ userEmail: c.userEmail || c.citizen?.email || '' }));
        setComplaints(fetchedComplaints);
        setLoadingComplaints(false);
      })
      .catch(err => {
        console.error("Error fetching complaints for user stats:", err.message);
        setLoadingComplaints(false);
      });
  }, []);

  // 1. Map live registered users
  const combinedUsers = users.map(user => {
    const reportsCount = complaints.filter(c => c.userEmail && c.userEmail.toLowerCase() === user.email.toLowerCase()).length;
    return { ...user, reportsCount };
  });

  // 2. Add users derived from live complaints (who might not have formally registered)
  const userEmails = combinedUsers.map(u => u.email.toLowerCase());
  const missingUsers = [];
  complaints.forEach(c => {
    if (c.userEmail && !userEmails.includes(c.userEmail.toLowerCase())) {
      if (!missingUsers.find(mu => mu.email.toLowerCase() === c.userEmail.toLowerCase())) {
        missingUsers.push({
          id: `derived-${c.userEmail}`,
          name: c.userName || "Unknown Citizen",
          email: c.userEmail,
          joinedAt: null,
          lastLoginAt: null
        });
      }
    }
  });

  missingUsers.forEach(mu => {
    mu.reportsCount = complaints.filter(c => c.userEmail && c.userEmail.toLowerCase() === mu.email.toLowerCase()).length;
    combinedUsers.push(mu);
  });

  const filteredUsers = combinedUsers.filter((u) =>
    (u.name && u.name.toLowerCase().includes(search.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(search.toLowerCase()))
  );
  
  // Sort by latest activity
  filteredUsers.sort((a, b) => new Date(b.lastLoginAt || b.joinedAt || 0) - new Date(a.lastLoginAt || a.joinedAt || 0));

  const loading = loadingUsers || loadingComplaints;

  return (
    <div className="min-h-screen flex bg-slate-950">
      <Sidebar />

      <main className="flex-1 p-6 sm:p-10 lg:pl-10 lg:pr-10 lg:py-10 max-w-[1400px] mt-16 lg:mt-0 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold font-display text-white tracking-tight">
                Registered Citizens
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                View and manage users registered on the platform.
              </p>
            </div>
            <div className="glass px-4 py-2 rounded-xl text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 flex items-center gap-2 self-start sm:self-auto select-none">
              <Activity size={16} className="animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider">Live Sync</span>
            </div>
          </div>

          <div className="glass rounded-3xl p-5 mb-8 border border-white/5">
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="glass rounded-3xl p-16 text-center border border-white/5">
              <p className="text-slate-400 text-sm">No users matching your criteria found.</p>
            </div>
          ) : (
            <div className="glass rounded-3xl overflow-hidden border border-white/5 shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
                      <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Email</th>
                      <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reports Submitted</th>
                      <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Joined Date</th>
                      <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider">Last Login</th>
                      <th className="py-4 px-6 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.01] transition-all">
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20 font-bold text-xs">
                              {(u.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-slate-200">{u.name}</span>
                          </div>
                        </td>
                        <td className="py-4.5 px-6 text-xs text-slate-400">
                          {u.email}
                        </td>
                        <td className="py-4.5 px-6 text-xs">
                           <span className="bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-[11px] text-slate-300">
                            {u.reportsCount} Reports
                          </span>
                        </td>
                        <td className="py-4.5 px-6 text-xs text-slate-400 whitespace-nowrap">
                          {u.joinedAt ? new Date(u.joinedAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                          }) : "Unknown"}
                        </td>
                        <td className="py-4.5 px-6 text-xs text-slate-300 whitespace-nowrap">
                          {u.lastLoginAt ? (
                            <div className="flex flex-col">
                              <span>{new Date(u.lastLoginAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                              <span className="text-[10px] text-slate-500">{new Date(u.lastLoginAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          ) : (
                            <span className="text-slate-600">Never</span>
                          )}
                        </td>
                        <td className="py-4.5 px-6 text-right">
                           <button
                            className="px-3.5 py-1.5 rounded-lg bg-white/5 text-slate-400 border border-white/10 text-xs font-semibold hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}