import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Calendar, AlertCircle, Star, MessageSquare, CheckCircle } from "lucide-react";
import Button from "../ui/Button.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import ComplaintTimeline from "../report/ComplaintTimeline.jsx";
import api from "../../utils/api.js";
import { useLanguage } from "../../i18n/LanguageContext";

export default function UserTrack() {
  const { t, getCategoryLabel, formatDate } = useLanguage();
  const [referenceId, setReferenceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [issue, setIssue] = useState(null);

  // Feedback State
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  async function handleSearch(e) {
    e.preventDefault();
    if (!referenceId.trim()) return;
    setError("");
    setLoading(true);
    setIssue(null);
    setRating(0);
    setComment("");
    setFeedbackError("");
    try {
      const { data } = await api.get(`/issues/${referenceId.trim()}`);
      setIssue(data.issue);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? t("track.notFound", "No report found with that reference number.")
          : t("track.generalError", "Something went wrong. Try again.")
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitFeedback(e) {
    e.preventDefault();
    if (rating === 0) {
      setFeedbackError(t("track.feedback.selectRating", "Please select a rating."));
      return;
    }
    setFeedbackError("");
    setFeedbackLoading(true);
    try {
      const { data } = await api.post(`/issues/${issue.referenceId}/feedback`, {
        rating,
        comment,
      });
      setIssue(data.issue);
    } catch (err) {
      setFeedbackError(t("track.feedback.submitFailed", "Failed to submit feedback. Try again."));
    } finally {
      setFeedbackLoading(false);
    }
  }

  return (
    <div className="glass rounded-3xl p-6 md:p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold font-display text-white mb-2">
          {t("track.title", "Track your complaint")}
        </h2>
        <p className="text-slate-400 text-sm">
          {t("track.subtitle", "Enter your reference number to see live status.")}
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 mb-10 max-w-2xl">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={t("track.placeholder", "e.g. CC-10234")}
            value={referenceId}
            onChange={(e) => setReferenceId(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-full py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 transition-colors"
          />
        </div>
        <Button type="submit" disabled={loading} className="px-7 rounded-full">
          {loading ? t("common.searching", "Searching...") : t("track.trackButton", "Track")}
        </Button>
      </form>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-6"
        >
          <AlertCircle size={16} />
          {error}
        </motion.div>
      )}

      <AnimatePresence>
        {issue && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
              <div>
                <p className="text-xs font-mono text-slate-500 mb-1">{issue.referenceId}</p>
                <h2 className="font-display font-semibold text-2xl">{issue.title}</h2>
                <div className="flex items-center gap-4 text-sm text-slate-400 mt-2">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} /> {getCategoryLabel(issue.category)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />{" "}
                    {formatDate(issue.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <StatusBadge status={issue.status} />
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-8">{issue.description}</p>

            <div className="mt-8">
              <ComplaintTimeline 
                history={issue.history || [
                  { stage: "Submitted", timestamp: issue.createdAt, remarks: "Citizen reported the issue.", department: "AI Triage System" },
                  ...(issue.status !== "pending" ? [{ stage: "Assigned", timestamp: new Date(new Date(issue.createdAt).getTime() + 86400000).toISOString(), remarks: "Assigned to field engineer.", department: issue.category, officer: "Eng. Smith" }] : []),
                  ...(issue.status === "resolved" ? [{ stage: "Resolved", timestamp: issue.updatedAt || new Date().toISOString(), remarks: "Issue fixed and verified.", department: issue.category, officer: "Eng. Smith" }] : [])
                ]} 
              />
            </div>

            {/* Feedback Section */}
            {issue.status === "resolved" && (
              <div className="mt-10 pt-8 border-t border-white/10">
                <h3 className="text-xl font-bold font-display mb-4 flex items-center gap-2">
                  <MessageSquare size={20} className="text-cyan-400" />
                  {t("track.feedback.title", "Feedback")}
                </h3>
                {issue.feedback ? (
                  <div className="bg-white/5 border border-white/10 p-5 rounded-2xl">
                    <p className="text-sm text-slate-400 mb-2">{t("track.feedback.ratedResolution", "You rated this resolution:")}</p>
                    <div className="flex gap-1 mb-4">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={20}
                          className={star <= issue.feedback.rating ? "text-yellow-400 fill-yellow-400" : "text-slate-600"}
                        />
                      ))}
                    </div>
                    {issue.feedback.comment && (
                      <div className="bg-black/20 p-4 rounded-xl text-sm text-slate-300">
                        "{issue.feedback.comment}"
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                      <CheckCircle size={12} /> {t("track.feedback.submittedSuccess", "Feedback submitted successfully")}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 p-6 rounded-2xl">
                    <p className="text-sm text-slate-300 mb-4">
                      {t("track.feedback.requestRate", "We're glad this issue is resolved! Please rate the service provided.")}
                    </p>
                    
                    {feedbackError && (
                      <div className="bg-red-500/10 text-red-300 border border-red-500/20 px-3 py-2 rounded-lg text-xs mb-4">
                        {feedbackError}
                      </div>
                    )}
                    
                    <div className="flex gap-2 mb-6">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="transition-transform hover:scale-110 focus:outline-none"
                        >
                          <Star
                            size={28}
                            className={
                              star <= (hoverRating || rating)
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-slate-600 hover:text-slate-500"
                            }
                          />
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={t("track.feedback.commentPlaceholder", "Leave a comment (optional)...")}
                      className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50 transition-colors mb-4 resize-none h-24"
                    />

                    <Button onClick={submitFeedback} disabled={feedbackLoading} className="w-full justify-center">
                      {feedbackLoading ? t("common.submitting", "Submitting...") : t("track.feedback.submitButton", "Submit Feedback")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
