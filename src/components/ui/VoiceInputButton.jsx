import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { startSpeechRecognition, isSpeechRecognitionSupported } from "../../i18n/voiceService.js";
import { useLanguage } from "../../i18n/LanguageContext.jsx";
import toast from "react-hot-toast";

export default function VoiceInputButton({ onTranscript, className = "" }) {
  const { language, currentLanguageConfig, t } = useLanguage();
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleListening = () => {
    if (!supported) {
      toast.error(t("voice.unsupported") || "Speech recognition is not supported in this browser.", {
        style: {
          background: "#1e293b",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.1)",
        },
      });
      return;
    }

    if (listening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setListening(false);
      return;
    }

    const controller = startSpeechRecognition(language, {
      onStart: () => {
        setListening(true);
        toast(t("voice.listening") || `Listening in ${currentLanguageConfig.nativeName}...`, {
          icon: "🎙️",
          style: {
            background: "#101826",
            color: "#22d3ee",
            border: "1px solid rgba(34,211,238,0.3)",
          },
        });
      },
      onResult: (transcript) => {
        if (transcript && onTranscript) {
          onTranscript(transcript);
        }
      },
      onError: (err) => {
        console.warn("Speech recognition error:", err);
        setListening(false);
      },
      onEnd: () => {
        setListening(false);
      },
    });

    recognitionRef.current = controller;
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      title={
        listening
          ? t("voice.stop")
          : `${t("voice.start")} (${currentLanguageConfig.nativeName})`
      }
      aria-label="Voice input"
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all cursor-pointer ${
        listening
          ? "bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse"
          : "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 border border-white/10"
      } ${className}`}
    >
      {listening ? (
        <Mic className="animate-bounce" size={16} />
      ) : (
        <Mic size={16} />
      )}
      {listening && (
        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      )}
    </button>
  );
}
