import { useState, useRef, useEffect } from "react";
import { Globe, Check, ChevronDown, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "../../i18n/LanguageContext.jsx";

export default function LanguageSelector({ variant = "default", className = "" }) {
  const { language, setLanguage, supportedLanguages, currentLanguageConfig, isTranslating } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (code) => {
    setLanguage(code);
    setIsOpen(false);
  };

  if (variant === "compact") {
    return (
      <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass hover:bg-white/10 text-xs font-medium text-slate-300 hover:text-white transition-all border border-white/10 cursor-pointer"
          aria-expanded={isOpen}
          aria-label="Select Language"
        >
          {isTranslating ? (
            <Loader2 size={13} className="text-cyan-400 animate-spin" />
          ) : (
            <Globe size={14} className="text-cyan-400" />
          )}
          <span>{currentLanguageConfig?.nativeName || "English"}</span>
          <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-52 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/15 shadow-2xl py-1.5 z-50 overflow-hidden"
            >
              <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase border-b border-white/10 flex items-center justify-between">
                <span>Languages</span>
                <span className="text-cyan-400 flex items-center gap-1 text-[9px] font-normal normal-case">
                  <Sparkles size={10} /> Google Translate
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto py-0.5">
                {supportedLanguages.map((lang) => {
                  const isActive = lang.code === language;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => handleSelect(lang.code)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                        isActive
                          ? "bg-cyan-500/15 text-cyan-300 font-medium"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex flex-col items-start text-left">
                        <span className="font-medium text-sm leading-tight">{lang.nativeName}</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{lang.name}</span>
                      </div>
                      {isActive && <Check size={14} className="text-cyan-400 ml-2 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl glass hover:bg-white/10 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition-all border border-white/10 cursor-pointer shadow-sm"
        aria-expanded={isOpen}
        aria-label="Select Language"
      >
        {isTranslating ? (
          <Loader2 size={14} className="text-cyan-400 animate-spin" />
        ) : (
          <Globe size={15} className="text-cyan-400" />
        )}
        <span className="font-medium">{currentLanguageConfig?.nativeName || "English"}</span>
        <ChevronDown size={13} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-2 w-60 rounded-2xl bg-slate-900/95 backdrop-blur-2xl border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.6)] py-2 z-50 overflow-hidden"
          >
            <div className="px-4 py-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase border-b border-white/10 flex items-center justify-between">
              <span>Select Language</span>
              <span className="text-cyan-400 font-mono text-[9px] flex items-center gap-1">
                <Sparkles size={11} className="text-cyan-400" />
                GOOGLE TRANSLATE
              </span>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {supportedLanguages.map((lang) => {
                const isActive = lang.code === language;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors cursor-pointer ${
                      isActive
                        ? "bg-cyan-500/15 text-cyan-300 font-semibold"
                        : "text-slate-300 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium leading-snug">{lang.nativeName}</div>
                      <div className="text-[10px] text-slate-400">{lang.name}</div>
                    </div>
                    {isActive && <Check size={16} className="text-cyan-400 ml-2 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-[10px] text-slate-400">
              <span>Automatic dynamic translation</span>
              <span className="text-cyan-400/80 font-mono">{supportedLanguages.length} supported</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
