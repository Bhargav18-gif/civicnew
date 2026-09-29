import { LANGUAGE_MAP } from "./languages.js";

/**
 * Check if the browser supports Speech Recognition
 */
export function isSpeechRecognitionSupported() {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

/**
 * Check if the browser supports Text-to-Speech
 */
export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Start speech recognition in the specified language
 * @param {string} langCode - Language code ('en', 'te', 'hi', etc.)
 * @param {Object} options - { onResult, onError, onStart, onEnd }
 * @returns {Object|null} Controller with .stop() or null if unsupported
 */
export function startSpeechRecognition(langCode, { onResult, onError, onStart, onEnd }) {
  if (!isSpeechRecognitionSupported()) {
    if (onError) onError(new Error("Speech recognition is not supported in this browser."));
    return null;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  const langConfig = LANGUAGE_MAP[langCode] || LANGUAGE_MAP.en;
  recognition.lang = langConfig.speechCode || "en-IN";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    if (onStart) onStart();
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript || "";
    if (onResult) onResult(transcript);
  };

  recognition.onerror = (event) => {
    if (onError) onError(event);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  try {
    recognition.start();
    return {
      stop: () => {
        try {
          recognition.stop();
        } catch (e) {
          // ignore
        }
      },
      abort: () => {
        try {
          recognition.abort();
        } catch (e) {
          // ignore
        }
      },
    };
  } catch (err) {
    if (onError) onError(err);
    return null;
  }
}

/**
 * Text-to-speech output in selected language
 */
export function speakText(text, langCode) {
  if (!isSpeechSynthesisSupported() || !text) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langConfig = LANGUAGE_MAP[langCode] || LANGUAGE_MAP.en;
    utterance.lang = langConfig.speechCode || "en-IN";

    // Attempt to pick a matching regional voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find(
      (v) => v.lang.startsWith(langConfig.speechCode) || v.lang.startsWith(langCode)
    );
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn("Speech synthesis error:", err);
  }
}
