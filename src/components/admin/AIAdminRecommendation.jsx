import { useState, useEffect, useCallback } from "react";
import { Sparkles, AlertCircle, CheckCircle2, RefreshCw, ChevronRight, HelpCircle, ArrowRight } from "lucide-react";
import api from "../../utils/api.js";

export default function AIAdminRecommendation({
  issue,
  currentCategory,
  onApplyCategory,
  onRecordDecision,
}) {
  const [recommendation, setRecommendation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decisionState, setDecisionState] = useState(issue?.adminDecision || null);

  const complaintId = issue?.referenceId || issue?.id || "UNKNOWN_ID";
  const complaintText = issue?.description || issue?.issueDescription || issue?.title || "";

  console.log("[AI PAGE] Component mounted");
  console.log(`[AI PAGE] Complaint ID: ${complaintId}`);

  const fetchRecommendation = useCallback(async () => {
    if (!complaintText || complaintText.trim().length === 0) {
      console.log("[AI PAGE] Rendering state: NO_DATA (No complaint text)");
      setRecommendation(null);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    console.log(`[AI PAGE] Request started for Complaint ID: ${complaintId}`);

    try {
      const { data } = await api.post("/admin/ai/classify", {
        complaint: complaintText.trim(),
        text: complaintText.trim(),
        complaint_id: complaintId,
      });

      console.log("[AI PAGE] API response:", data);

      if (data && (data.department || data.departmentName || data.category)) {
        const canonicalDept = data.department || data.departmentName || data.category || "General";
        const canonicalCategory = data.category || canonicalDept;
        const confidenceVal = typeof data.confidence === "number" ? data.confidence : 0.85;

        console.log("[AI PAGE] Classification data:", data);
        console.log(`[AI PAGE] Category: ${canonicalCategory}`);
        console.log(`[AI PAGE] Confidence: ${confidenceVal}`);
        console.log(`[AI PAGE] Department: ${canonicalDept}`);
        console.log("[AI PAGE] Rendering state: SUCCESS");

        setRecommendation(data);
        if (issue?.adminDecision) {
          setDecisionState(issue.adminDecision);
        }
      } else {
        console.warn("[AI PAGE] Malformed classification data:", data);
        setError("AI classification returned an unexpected data structure.");
      }
    } catch (err) {
      console.error("[AI PAGE] API request failed:", err);
      const safeErrorMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "AI classification service is temporarily unavailable.";
      setError(safeErrorMsg);
      console.log(`[AI PAGE] Rendering state: ERROR (${safeErrorMsg})`);
    } finally {
      setLoading(false);
    }
  }, [complaintId, complaintText, issue?.adminDecision]);

  useEffect(() => {
    fetchRecommendation();
  }, [fetchRecommendation]);

  const handleAccept = async (dept) => {
    const targetDept = dept || recommendation?.department || recommendation?.departmentName;
    if (!targetDept) return;

    setDecisionState("accepted");
    if (onApplyCategory) onApplyCategory(targetDept);

    const decisionData = {
      aiPrediction: targetDept,
      aiConfidence: recommendation?.confidence || 0.85,
      aiModelVersion: recommendation?.model_version || recommendation?.modelVersion || "civicconnect-v2",
      adminDecision: targetDept,
      adminOverride: false,
      predictionTimestamp: new Date().toISOString(),
    };

    if (onRecordDecision) {
      onRecordDecision(decisionData);
    }

    api.post("/admin/ai/feedback", {
      complaint_id: complaintId,
      complaint_text: complaintText,
      original_prediction: targetDept,
      original_confidence: recommendation?.confidence || 0.85,
      admin_decision: targetDept,
      is_override: false,
      admin_id: "admin",
      timestamp: new Date().toISOString(),
    }).catch((e) => console.warn("[AI PAGE] AI feedback log failed:", e));
  };

  const handleOverride = (chosenDept) => {
    if (!chosenDept) return;

    setDecisionState("overridden");
    if (onApplyCategory) onApplyCategory(chosenDept);

    const decisionData = {
      aiPrediction: recommendation?.department || recommendation?.departmentName || "General",
      aiConfidence: recommendation?.confidence || 0.85,
      aiModelVersion: recommendation?.model_version || recommendation?.modelVersion || "civicconnect-v2",
      adminDecision: chosenDept,
      adminOverride: true,
      overrideTimestamp: new Date().toISOString(),
    };

    if (onRecordDecision) {
      onRecordDecision(decisionData);
    }

    api.post("/admin/ai/feedback", {
      complaint_id: complaintId,
      complaint_text: complaintText,
      original_prediction: recommendation?.department || recommendation?.departmentName || "General",
      original_confidence: recommendation?.confidence || 0.85,
      admin_decision: chosenDept,
      is_override: true,
      admin_id: "admin",
      timestamp: new Date().toISOString(),
    }).catch((e) => console.warn("[AI PAGE] AI override log failed:", e));
  };

  // Safe field normalizations
  const recommendedDept = recommendation?.department || recommendation?.departmentName || recommendation?.category || "General";
  const confidenceScore = typeof recommendation?.confidence === "number" ? recommendation.confidence : 0;
  const confidencePct = recommendation?.confidence_percentage || `${Math.round(confidenceScore * 100)}%`;
  const confidenceLevel = recommendation?.confidence_level || (confidenceScore >= 0.85 ? "high" : confidenceScore >= 0.70 ? "medium" : "low");
  const modelVer = recommendation?.model_version || recommendation?.modelVersion || "civicconnect-nlp-bayes-v1";
  const recommendedAction = recommendation?.recommended_action || `Assign to ${recommendedDept} for resolution.`;
  const workType = recommendation?.work_type || "GENERAL_TASK";
  const requiresReview = Boolean(recommendation?.requires_admin_review ?? recommendation?.requiresHumanReview ?? (confidenceScore < 0.85));
  const topPredictions = Array.isArray(recommendation?.top_predictions) && recommendation.top_predictions.length > 0
    ? recommendation.top_predictions
    : [{ department: recommendedDept, percentage: confidencePct }];

  return (
    <div className="bg-slate-900/80 border border-cyan-500/20 rounded-2xl p-4 relative overflow-hidden shadow-lg mb-6">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-cyan-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
            AI Triage & Classification
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">
          {modelVer}
        </span>
      </div>

      {/* 1. LOADING STATE */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
          <RefreshCw size={20} className="animate-spin text-cyan-400 mb-1" />
          <p className="text-xs font-semibold text-slate-200">Analyzing complaint...</p>
          <p className="text-[11px] text-slate-500">Evaluating issue description with AI classification models</p>
        </div>
      )}

      {/* 2. NO DATA STATE */}
      {!loading && !error && (!complaintText || complaintText.trim().length === 0) && (
        <div className="py-4 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
          <HelpCircle size={20} className="text-slate-500 mx-auto mb-1.5" />
          <p className="text-xs text-slate-300 font-medium">No description available</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            This complaint does not contain text for autonomous AI triage.
          </p>
        </div>
      )}

      {/* 3. ERROR STATE */}
      {!loading && error && (
        <div className="space-y-3 py-2">
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3 rounded-xl flex items-start gap-2.5">
            <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-rose-300">AI classification failed</p>
              <p className="text-[11px] text-rose-400/90 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchRecommendation}
            className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-400/20 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>Retry AI Triage</span>
          </button>
        </div>
      )}

      {/* 4. SUCCESS STATE */}
      {!loading && !error && recommendation && (
        <div className="space-y-3">
          {/* Main Department Recommendation & Confidence */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Recommended Department
              </span>
              <p className="text-sm font-bold text-white mt-0.5 flex items-center gap-2">
                {recommendedDept}
                {currentCategory?.toLowerCase() === recommendedDept.toLowerCase() && (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                )}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                Confidence
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                <span
                  className={`text-xs font-bold ${
                    confidenceLevel === "high"
                      ? "text-emerald-400"
                      : confidenceLevel === "medium"
                      ? "text-yellow-400"
                      : "text-rose-400"
                  }`}
                >
                  {confidencePct}
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                    confidenceLevel === "high"
                      ? "bg-emerald-400/10 text-emerald-300 border border-emerald-400/20"
                      : confidenceLevel === "medium"
                      ? "bg-yellow-400/10 text-yellow-300 border border-yellow-400/20"
                      : "bg-rose-400/10 text-rose-300 border border-rose-400/20"
                  }`}
                >
                  {confidenceLevel === "high" ? "High Confidence" : "Requires Review"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Guidance */}
          {recommendedAction && (
            <div className="bg-white/5 border border-white/5 rounded-xl p-2.5">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                Action Guidance ({workType})
              </span>
              <p className="text-xs text-slate-300 leading-snug">
                {recommendedAction}
              </p>
            </div>
          )}

          {/* Candidate departments for admin review override */}
          {requiresReview && topPredictions.length > 1 && (
            <div>
              <span className="text-[10px] text-amber-300/80 font-semibold block mb-1.5">
                Suggested department routing:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {topPredictions.map((pred) => (
                  <button
                    key={pred.department}
                    type="button"
                    onClick={() => handleOverride(pred.department)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                      currentCategory?.toLowerCase() === pred.department?.toLowerCase()
                        ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300"
                        : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span>{pred.department}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {pred.percentage || `${Math.round((pred.confidence || 0) * 100)}%`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {!requiresReview ? (
              <button
                type="button"
                onClick={() => handleAccept(recommendedDept)}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  currentCategory?.toLowerCase() === recommendedDept.toLowerCase()
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 cursor-default"
                    : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 shadow-md shadow-cyan-500/20"
                }`}
              >
                <CheckCircle2 size={14} />
                <span>
                  {currentCategory?.toLowerCase() === recommendedDept.toLowerCase()
                    ? "Recommendation Applied"
                    : `Accept (${recommendedDept})`}
                </span>
              </button>
            ) : (
              <div className="w-full flex items-center justify-between text-[11px] text-amber-300/90 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-xl">
                <span>Manual review suggested. Select a department to apply.</span>
              </div>
            )}
          </div>

          {decisionState && (
            <p className="text-[10px] text-slate-500 pt-1 border-t border-white/5 flex items-center justify-between">
              <span>Decision: <span className="text-slate-300 font-medium capitalize">{decisionState}</span></span>
              {recommendation.category && <span className="text-slate-400">Class: {recommendation.category}</span>}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
