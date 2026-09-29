import { useEffect, useState } from "react";
import Sidebar from "../../components/admin/Sidebar.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import ComplaintDetailsModal from "../../components/admin/ComplaintDetailsModal.jsx";
import ComplaintTable from "../../components/admin/ComplaintTable.jsx";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import Header from "../../components/admin/Header.jsx";
import api from "../../utils/api.js";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";

const CATEGORIES = ["Roads", "Water", "Electricity", "Garbage", "Drainage", "Health", "Transport", "Public Safety"];

export default function Complaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [evidenceFilter, setEvidenceFilter] = useState("all");
  const [selectedIssue, setSelectedIssue] = useState(null);

  useEffect(() => {
    setLoading(true);

    api.get("/admin/issues")
      .then(({ data }) => {
        if (data && Array.isArray(data.issues)) {
          const sorted = data.issues
            .map(i => normalizeComplaintDoc(i, i.referenceId))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setComplaints(sorted);
        }
      })
      .catch(err => console.error("API issues fetch error:", err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleIssueUpdate = (updatedIssue) => {
    if (selectedIssue && selectedIssue.referenceId === updatedIssue.referenceId) {
      setSelectedIssue(updatedIssue);
    }
  };

  const filteredComplaints = complaints.filter((c) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      c.referenceId.toLowerCase().includes(searchLower) ||
      c.title.toLowerCase().includes(searchLower) ||
      (c.userName && c.userName.toLowerCase().includes(searchLower)) ||
      (c.category && c.category.toLowerCase().includes(searchLower));

    const normFilter = statusFilter.toLowerCase();
    const cStatus = (c.status || "").toLowerCase().replace(/[\s-]/g, '_');
    const cCanon = (c.canonicalStatus || "").toLowerCase().replace(/[\s-]/g, '_');
    const matchesStatus = statusFilter === "all" ||
      cStatus === normFilter ||
      cCanon === normFilter ||
      (normFilter === "resolved" && (cStatus === "closed" || cCanon === "closed" || cStatus === "resolved")) ||
      (normFilter === "pending_admin_review" && (cStatus === "pending_admin_review" || cCanon === "pending_admin_review" || cStatus === "pending_review"));
    const matchesCategory = categoryFilter === "all" || c.category === categoryFilter;
    const matchesPriority = priorityFilter === "all" || c.priority === priorityFilter;
    
    let matchesEvidence = true;
    if (evidenceFilter === "reopened") {
      matchesEvidence = c.history?.some(h => h.action.includes("Reopened")) || false;
    } else if (evidenceFilter === "pending-verification") {
      matchesEvidence = c.status === "resolved" && (!c.citizenVerificationPhotos || c.citizenVerificationPhotos.length === 0);
    } else if (evidenceFilter === "with-verification") {
      matchesEvidence = c.citizenVerificationPhotos && c.citizenVerificationPhotos.length > 0;
    } else if (evidenceFilter === "without-feedback") {
      matchesEvidence = c.status === "resolved" && !c.feedback;
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority && matchesEvidence;
  });

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
            title="Civic Complaints"
            description="Inspect, update, and manage citizen-submitted issues."
          />

          <div className="glass rounded-3xl p-5 mb-8 border border-white/5 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by ID or title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:w-[600px]">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl py-3 px-3 text-xs text-white focus:outline-none focus:border-cyan-400/50 transition-colors [&>option]:bg-[#101826] cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending_admin_review">Pending Admin Review</option>
                  <option value="ai_failed">AI Failed</option>
                  <option value="routed">Routed</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved / Closed</option>
                  <option value="reopened">Reopened</option>
                  <option value="rejected">Rejected</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl py-3 px-3 text-xs text-white focus:outline-none focus:border-cyan-400/50 transition-colors [&>option]:bg-[#101826] cursor-pointer"
                >
                  <option value="all">All Departments</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl py-3 px-3 text-xs text-white focus:outline-none focus:border-cyan-400/50 transition-colors [&>option]:bg-[#101826] cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
                
                <select
                  value={evidenceFilter}
                  onChange={(e) => setEvidenceFilter(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-xl py-3 px-3 text-xs text-white focus:outline-none focus:border-cyan-400/50 transition-colors [&>option]:bg-[#101826] cursor-pointer"
                >
                  <option value="all">Evidence: All</option>
                  <option value="reopened">Reopened</option>
                  <option value="pending-verification">Pending Verification</option>
                  <option value="with-verification">With Verification</option>
                  <option value="without-feedback">Without Feedback</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="glass rounded-3xl p-16 text-center border border-white/5">
              <p className="text-slate-400 text-sm">No complaints matching your criteria found.</p>
            </div>
          ) : (
            <ComplaintTable complaints={filteredComplaints} onSelectIssue={setSelectedIssue} />
          )}

          <AnimatePresence>
            {selectedIssue && (
              <ComplaintDetailsModal
                issue={selectedIssue}
                onClose={() => setSelectedIssue(null)}
                onUpdate={handleIssueUpdate}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}