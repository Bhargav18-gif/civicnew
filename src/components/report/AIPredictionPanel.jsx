import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";

/**
 * Shows a simulated AI classification result once the user has uploaded
 * media. Swap the static result for a real model response when a
 * classification endpoint is connected on the backend.
 */
export default function AIPredictionPanel({ analyzing, prediction }) {
  return (
    <AnimatePresence>
      {(analyzing || prediction) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="gradient-border glass rounded-2xl p-5 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-violet-400" />
              <span className="text-sm font-semibold">AI Analysis</span>
            </div>

            {analyzing ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                Analyzing uploaded media...
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Detected category</span>
                  <span className="font-medium text-cyan-300">{prediction.category}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Confidence</span>
                  <span className="font-medium text-white">{prediction.confidence}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Suggested department</span>
                  <span className="font-medium text-violet-300">{prediction.department}</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
