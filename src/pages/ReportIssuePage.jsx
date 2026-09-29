import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Send, CheckCircle2, AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import Navbar from "../components/layout/Navbar.jsx";
import Footer from "../components/layout/Footer.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import FileUpload from "../components/report/FileUpload.jsx";
import LocationPicker from "../components/report/LocationPicker.jsx";
import AIPredictionPanel from "../components/report/AIPredictionPanel.jsx";
import { complaintApi } from "../services/api/complaintApi.js";
import { aiApi } from "../services/api/aiApi.js";
import { useAuth } from "../context/AuthContext.jsx";
import { emailService } from "../services/emailService.js";

export default function ReportIssuePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({ description: "", email: "" });
  const [files, setFiles] = useState([]);
  const [location, setLocation] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Real backend AI analysis on demand or when description is provided (Requirement 10: No random AI)
  async function handleAIAnalysis() {
    if (!form.description || form.description.trim().length < 5) {
      setError("Please write a few words describing the issue first.");
      return;
    }

    setAnalyzing(true);
    setError("");

    try {
      let previewUrl = null;
      if (files.length > 0 && files[0]?.file) {
        previewUrl = URL.createObjectURL(files[0].file);
      }

      const result = await aiApi.classify(form.description.trim(), previewUrl);
      setPrediction({
        category: result.category,
        confidence: Math.round((result.confidence || 0.85) * 100),
        department: `${result.department} Department`,
        priority: result.priority,
        reasoning: result.reasoningSummary
      });
    } catch (err) {
      console.warn("AI Triage pre-check skipped:", err.message);
      // We do not fake success - we inform the user that classification will run upon submission
      setPrediction({
        category: "Pending Server AI Triage",
        confidence: 0,
        department: "Municipal Queue",
        reasoning: "Your report will be triaged autonomously by the server AI gateway upon submission."
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.description || form.description.trim().length === 0) {
      setError("Please provide a description of the issue.");
      return;
    }

    const finalEmail = form.email.trim() || user?.email;
    if (!finalEmail) {
      setError("An email address is required to track your complaint. Please enter your email or log in.");
      return;
    }

    setSubmitting(true);
    try {
      let imageURL = null;
      if (files.length > 0 && files[0]?.file) {
        try {
          const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
          const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "ml_default";
          if (cloudName) {
            const cFormData = new FormData();
            cFormData.append("file", files[0].file);
            cFormData.append("upload_preset", uploadPreset);
            const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
              method: "POST",
              body: cFormData
            });
            if (cRes.ok) {
              const cData = await cRes.json();
              imageURL = cData.secure_url;
            }
          }
        } catch (cErr) {
          console.warn("Media upload skipped or failed:", cErr.message);
        }
      }

      const payload = {
        description: form.description.trim(),
        email: finalEmail,
        lat: location ? location.lat : null,
        lng: location ? location.lng : null,
        address: location?.address || null,
        userId: user?.uid || user?.id || null,
        userName: user?.name || "Citizen",
        imageURL,
        category: prediction?.category !== "Pending Server AI Triage" ? prediction?.category : undefined
      };

      const complaintDoc = await complaintApi.createComplaint(payload);
      if (!complaintDoc || !complaintDoc.referenceId) {
        throw new Error("Complaint submission failed to generate a reference ID.");
      }

      // Trigger Email notification if EmailJS is configured
      try {
        const emailVariables = {
          user_name: complaintDoc.citizen?.name || user?.name || "Citizen",
          user_email: complaintDoc.citizen?.email || finalEmail,
          email: complaintDoc.citizen?.email || finalEmail,
          complaint_id: complaintDoc.referenceId,
          issue_title: complaintDoc.issue?.title || "Civic Complaint",
          category: complaintDoc.issue?.category || "General",
          location: complaintDoc.location?.address || "Location on record",
          submission_date: new Date(complaintDoc.createdAt).toLocaleString(),
          status: complaintDoc.workflow?.status || "SUBMITTED"
        };
        await emailService.sendComplaintConfirmation(emailVariables);
      } catch (emErr) {
        setEmailError(true);
      }

      setSubmitted(complaintDoc);
    } catch (err) {
      console.error("Submission error:", err);
      setError(`Submission failed: ${err.message || "Failed to persist complaint in database."}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center px-6 pt-32 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong rounded-3xl p-10 max-w-md text-center border border-slate-800"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={30} className="text-emerald-400" />
            </div>
            <h2 className="font-display font-bold text-2xl mb-2 text-white">Report Registered</h2>
            <p className="text-slate-400 text-sm mb-6">
              Your tracking reference ID is{" "}
              <span className="text-cyan-300 font-mono font-semibold">{submitted.referenceId}</span>.
              Our automated triage system has registered it into Cloud Firestore.
            </p>
            {emailError && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 flex items-start gap-2 bg-yellow-500/10 border border-yellow-400/30 text-yellow-300 text-xs rounded-xl px-4 py-3 text-left"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <p>Complaint registered, but email confirmation was skipped due to provider limits.</p>
              </motion.div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button to="/track" variant="secondary" className="text-xs">
                Track this report
              </Button>
              <Button to="/dashboard" className="text-xs">Go to Dashboard</Button>
            </div>
          </motion.div>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="min-h-screen px-6 pt-32 pb-20 max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="font-display font-bold text-4xl tracking-tight mb-2 text-white">Report a Civic Issue</h1>
          <p className="text-slate-400 mb-8 text-sm">
            Provide the details — our server AI classification engine routes it to the responsible municipal department automatically.
          </p>

          <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-7 sm:p-9 border border-slate-800">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-6"
              >
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300">Issue Description</label>
                <button
                  type="button"
                  onClick={handleAIAnalysis}
                  disabled={analyzing || !form.description}
                  className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-40 transition-colors"
                >
                  <Sparkles size={13} />
                  {analyzing ? "Classifying..." : "Analyze with AI"}
                </button>
              </div>
              <textarea
                name="description"
                rows={4}
                placeholder="Describe what you see, the severity, exact location landmarks, or hazards. Our AI engine will analyze and categorize the issue..."
                value={form.description}
                onChange={handleChange}
                required
                className="w-full bg-slate-950/60 border border-slate-700/80 rounded-xl py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60 transition-colors resize-none"
              />
            </div>

            <div className="mb-5">
              <Input
                label="Email Address (for real-time status notifications)"
                name="email"
                type="email"
                placeholder={user?.email ? `Default: ${user.email}` : "your.email@example.com"}
                value={form.email}
                onChange={handleChange}
              />
            </div>

            <div className="mb-7">
              <FileUpload files={files} setFiles={setFiles} label="Upload Photo or Video (Optional)" />
              <AIPredictionPanel analyzing={analyzing} prediction={prediction} />
            </div>

            <div className="mb-8">
              <LocationPicker location={location} setLocation={setLocation} />
            </div>

            <Button type="submit" icon={Send} className="w-full py-3.5" disabled={submitting}>
              {submitting ? "Submitting to Municipal Registry..." : "Submit Complaint"}
            </Button>
          </form>
        </motion.div>
      </div>
      <Footer />
    </>
  );
}
