import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../../components/layout/Navbar.jsx";
import Footer from "../../components/layout/Footer.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { engineerApi } from "../../services/api/engineerApi.js";
import { normalizeComplaintDoc } from "../../utils/complaintSchema.js";
import { WORKFLOW_STATES } from "../../constants/workflow.js";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Button from "../../components/ui/Button.jsx";
import FileUpload from "../../components/report/FileUpload.jsx";
import toast, { Toaster } from "react-hot-toast";
import {
  Wrench,
  Navigation,
  MapPin,
  Play,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText
} from "lucide-react";

export default function EngineerDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [evidenceModal, setEvidenceModal] = useState(null);
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const engineerUid = user?.uid || user?.id;

  // Fetch tasks assigned to this engineer from Supabase via backend API
  // Backend filters at DB level by engineer's Supabase UUID
  useEffect(() => {
    if (!engineerUid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    engineerApi.listTasks()
      .then(list => {
        const sorted = list.map(t => normalizeComplaintDoc(t))
          .sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
        setTasks(sorted);
      })
      .catch(err => {
        console.error("Failed to fetch engineer tasks:", err.message);
        toast.error("Failed to fetch assigned engineer tasks.");
      })
      .finally(() => setLoading(false));
  }, [engineerUid]);

  // Handle explicit status step transition (Requirement 26)
  const handleTransition = async (taskId, targetStatus) => {
    setActionLoading(true);
    try {
      await engineerApi.updateStatus(taskId, targetStatus);
      toast.success(`Task status updated to ${targetStatus}`);
    } catch (err) {
      toast.error(err.message || "Failed to update task status.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle completion evidence submission (Requirement 27)
  const handleSubmitEvidence = async (e) => {
    e.preventDefault();
    if (!evidenceModal) return;

    if (evidenceFiles.length === 0) {
      toast.error("Please upload at least one authentic repair completion photo.");
      return;
    }

    if (!completionNotes.trim() || completionNotes.trim().length < 5) {
      toast.error("Please provide detailed repair notes explaining the work completed.");
      return;
    }

    setSubmittingEvidence(true);
    try {
      let uploadedPhotoUrl = null;
      const fileObj = evidenceFiles[0]?.file;

      if (fileObj) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "ml_default";

        if (cloudName) {
          const formData = new FormData();
          formData.append("file", fileObj);
          formData.append("upload_preset", uploadPreset);

          const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: "POST",
            body: formData
          });

          if (!uploadRes.ok) {
            throw new Error("Evidence upload failed. Cloud storage rejected the file.");
          }
          const uploadData = await uploadRes.json();
          uploadedPhotoUrl = uploadData.secure_url;
        } else {
          // Local blob representation if cloudinary not configured
          uploadedPhotoUrl = URL.createObjectURL(fileObj);
        }
      }

      if (!uploadedPhotoUrl) {
        throw new Error("Evidence upload failed. Please retry.");
      }

      await engineerApi.submitCompletionEvidence(evidenceModal.referenceId, {
        photos: [uploadedPhotoUrl],
        notes: completionNotes.trim()
      });

      toast.success("Evidence submitted! Task moved to Verification Pending.");
      setEvidenceModal(null);
      setEvidenceFiles([]);
      setCompletionNotes("");
    } catch (err) {
      toast.error(err.message || "Evidence upload failed. Please retry.");
    } finally {
      setSubmittingEvidence(false);
    }
  };

  const activeTasks = tasks.filter(
    (t) => ![WORKFLOW_STATES.CLOSED, WORKFLOW_STATES.REJECTED].includes(t.workflow?.status)
  );

  return (
    <>
      <Navbar />
      <Toaster position="top-right" />
      <div className="min-h-screen px-6 pt-28 pb-20 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-teal-500/30 bg-teal-500/10 text-teal-300 mb-2">
                <Wrench size={14} /> Field Engineering Operations
              </div>
              <h1 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight">
                Field Engineer Task Queue
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Welcome, <span className="text-white font-medium">{user?.name || user?.email}</span>. Manage assigned repair orders and upload verification evidence.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl border border-slate-800 bg-slate-900/60 text-right">
                <span className="text-[11px] text-slate-400 block">Assigned Tasks</span>
                <span className="text-lg font-bold text-teal-400">{activeTasks.length}</span>
              </div>
            </div>
          </div>

          {/* Tasks List */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-24 flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-teal-400/30 border-t-teal-400 animate-spin" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-20 text-center rounded-3xl border border-slate-800 bg-slate-900/40 p-12">
                <CheckCircle2 size={40} className="text-teal-400 mx-auto mb-3 opacity-60" />
                <h3 className="text-base font-semibold text-white">No Assigned Tasks</h3>
                <p className="text-slate-400 text-xs mt-1">You currently have no pending civic repair tasks assigned to your UID.</p>
              </div>
            ) : (
              tasks.map((task) => {
                const status = task.workflow?.status || task.status;

                return (
                  <div
                    key={task.referenceId}
                    className="p-6 rounded-3xl border border-slate-800 bg-slate-900/60 backdrop-blur-md hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
                  >
                    {/* Left Details */}
                    <div className="flex items-start gap-4 flex-1">
                      {task.media?.before?.[0]?.url ? (
                        <img
                          src={task.media.before[0].url}
                          alt="Issue photo"
                          className="w-20 h-20 rounded-2xl object-cover border border-slate-800 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 flex-shrink-0">
                          <Wrench size={24} />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold text-cyan-400">{task.referenceId}</span>
                          <StatusBadge status={status} />
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            task.ai?.priority === 'CRITICAL' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                            task.ai?.priority === 'HIGH' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {task.ai?.priority || 'MEDIUM'}
                          </span>
                        </div>

                        <h3 className="text-sm font-semibold text-white">{task.issue?.title || task.title}</h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{task.issue?.description || task.description}</p>

                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-3">
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-slate-500" />
                            {task.location?.address || 'Location on map'}
                          </span>
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Clock size={12} className="text-slate-500" />
                            {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Step Machine Action Buttons (Requirement 26) */}
                    <div className="flex flex-col sm:flex-row items-end gap-2 w-full md:w-auto">
                      {status === WORKFLOW_STATES.ASSIGNED && (
                        <Button
                          variant="primary"
                          onClick={() => handleTransition(task.referenceId, WORKFLOW_STATES.ACCEPTED_BY_ENGINEER)}
                          disabled={actionLoading}
                          icon={CheckCircle2}
                          className="w-full sm:w-auto text-xs"
                        >
                          Accept Assignment
                        </Button>
                      )}

                      {status === WORKFLOW_STATES.ACCEPTED_BY_ENGINEER && (
                        <Button
                          variant="secondary"
                          onClick={() => handleTransition(task.referenceId, WORKFLOW_STATES.EN_ROUTE)}
                          disabled={actionLoading}
                          icon={Navigation}
                          className="w-full sm:w-auto text-xs border-orange-500/30 text-orange-300 hover:bg-orange-500/10"
                        >
                          Start En Route
                        </Button>
                      )}

                      {status === WORKFLOW_STATES.EN_ROUTE && (
                        <Button
                          variant="secondary"
                          onClick={() => handleTransition(task.referenceId, WORKFLOW_STATES.ON_SITE)}
                          disabled={actionLoading}
                          icon={MapPin}
                          className="w-full sm:w-auto text-xs border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10"
                        >
                          Mark Arrived On Site
                        </Button>
                      )}

                      {status === WORKFLOW_STATES.ON_SITE && (
                        <Button
                          variant="primary"
                          onClick={() => handleTransition(task.referenceId, WORKFLOW_STATES.IN_PROGRESS)}
                          disabled={actionLoading}
                          icon={Play}
                          className="w-full sm:w-auto text-xs"
                        >
                          Begin Work
                        </Button>
                      )}

                      {status === WORKFLOW_STATES.IN_PROGRESS && (
                        <Button
                          variant="primary"
                          onClick={() => setEvidenceModal(task)}
                          disabled={actionLoading}
                          icon={UploadCloud}
                          className="w-full sm:w-auto text-xs bg-gradient-to-r from-teal-500 to-cyan-500"
                        >
                          Submit Completion Evidence
                        </Button>
                      )}

                      {status === WORKFLOW_STATES.VERIFICATION_PENDING && (
                        <span className="text-xs text-purple-400 font-medium bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl">
                          Awaiting Department Review
                        </span>
                      )}

                      {status === WORKFLOW_STATES.CITIZEN_VERIFICATION && (
                        <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
                          Awaiting Citizen Approval
                        </span>
                      )}

                      {status === WORKFLOW_STATES.CLOSED && (
                        <span className="text-xs text-emerald-400 font-medium">✓ Closed</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Completion Evidence Submission Modal (Requirement 27) */}
      <AnimatePresence>
        {evidenceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-left"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white">Submit Completion Evidence</h3>
                  <p className="text-xs text-teal-400 font-mono">{evidenceModal.referenceId}</p>
                </div>
                <button
                  onClick={() => setEvidenceModal(null)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitEvidence} className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">
                    Repair Photo (Mandatory)
                  </label>
                  <FileUpload
                    files={evidenceFiles}
                    setFiles={setEvidenceFiles}
                    accept="image/*"
                    maxFiles={2}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Completion Notes (Mandatory)
                  </label>
                  <textarea
                    rows={3}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-teal-400"
                    placeholder="Describe specific repair steps taken, materials used, and final physical condition..."
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => setEvidenceModal(null)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={submittingEvidence || evidenceFiles.length === 0}
                    icon={UploadCloud}
                    className="text-xs"
                  >
                    {submittingEvidence ? "Uploading Evidence..." : "Submit for Verification"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}
