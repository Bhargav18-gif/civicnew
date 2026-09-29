import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_MAP } from "./languages.js";
import { initGoogleTranslate, translatePageTo, getCookie } from "./googleTranslate.js";

import en from "./locales/en.json";
import te from "./locales/te.json";
import hi from "./locales/hi.json";
import ta from "./locales/ta.json";
import kn from "./locales/kn.json";
import ml from "./locales/ml.json";
import mr from "./locales/mr.json";
import bn from "./locales/bn.json";
import or from "./locales/or.json";

// Keep dictionary collection as master + secondary fallbacks
const TRANSLATIONS = {
  en,
  te,
  hi,
  ta,
  kn,
  ml,
  mr,
  bn,
  or,
};

const STORAGE_KEY = "civicconnect_language";

export const LanguageContext = createContext(null);

/**
 * Safely lookup nested property via dot-notation
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr == null || typeof curr !== "object") return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Interpolate parameters into string: replaces {{param}} or {param}
 */
function interpolate(template, params) {
  if (typeof template !== "string" || !params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (match, p1, p2) => {
    const key = p1 || p2;
    return params[key] !== undefined ? params[key] : match;
  });
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      // 1. Check Google Translate cookie first (e.g. /en/hi -> hi)
      const googtrans = getCookie("googtrans");
      if (googtrans) {
        const parts = googtrans.split("/");
        const target = parts[parts.length - 1];
        if (target && (LANGUAGE_MAP[target] || target === "en")) {
          return target;
        }
      }
      // 2. Check localStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (LANGUAGE_MAP[saved] || saved === "en")) {
        return saved;
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_LANGUAGE;
  });

  const [targetLanguage, setTargetLanguage] = useState(language);
  const [isTranslating, setIsTranslating] = useState(false);

  // Initialize Google Translate widget once on mount
  useEffect(() => {
    initGoogleTranslate();

    // If initial language is non-English, Google Translate will auto-translate based on cookie.
    if (language !== DEFAULT_LANGUAGE) {
      setTimeout(() => {
        document.documentElement.classList.remove("translating-initial");
      }, 800);
    } else {
      document.documentElement.classList.remove("translating-initial");
    }
  }, []);

  const setLanguage = useCallback((newLang) => {
    if (newLang === language) return;
    if (!LANGUAGE_MAP[newLang] && newLang !== "en") {
      console.warn(`Unsupported language code: ${newLang}`);
      return;
    }

    const langConfig = LANGUAGE_MAP[newLang] || LANGUAGE_MAP[DEFAULT_LANGUAGE] || {
      name: "English",
      nativeName: "English",
    };

    setIsTranslating(true);
    setTargetLanguage(newLang);
    setLanguageState(newLang);

    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      // ignore
    }

    // Give clear, non-intrusive feedback of what the user selected
    toast.success(`Language selected: ${langConfig.nativeName} (${langConfig.name})`, {
      id: "lang-change-feedback",
      icon: "🌐",
      duration: 2000,
    });

    // Trigger Google Translate in-place directly on the DOM (NO RELOAD = NO FLASH OF ENGLISH!)
    translatePageTo(newLang);

    // Keep active indicator for exactly 2 seconds as requested
    setTimeout(() => {
      setIsTranslating(false);
    }, 2000);
  }, [language]);

  // Update HTML document lang and dir attributes on language switch
  useEffect(() => {
    const langConfig = LANGUAGE_MAP[language] || LANGUAGE_MAP[DEFAULT_LANGUAGE];
    document.documentElement.lang = language;
    document.documentElement.dir = langConfig.dir || "ltr";
  }, [language]);

  /**
   * Translate key: returns English master text for Google Translate to translate in DOM
   */
  const t = useCallback(
    (key, fallbackOrParams, maybeParams) => {
      if (!key) return "";

      let fallback = undefined;
      let params = undefined;

      if (typeof fallbackOrParams === "string" || typeof fallbackOrParams === "number") {
        fallback = fallbackOrParams;
        if (typeof maybeParams === "object" && maybeParams !== null) {
          params = maybeParams;
        }
      } else if (typeof fallbackOrParams === "object" && fallbackOrParams !== null) {
        params = fallbackOrParams;
      }

      // Primary: Look up in master English dictionary
      let val = getNestedValue(TRANSLATIONS[DEFAULT_LANGUAGE], key);

      // Secondary: Look up in current language dictionary if available
      if (val === undefined && TRANSLATIONS[language]) {
        val = getNestedValue(TRANSLATIONS[language], key);
      }

      // Fallback to explicit default value if supplied
      if (val === undefined && fallback !== undefined) {
        val = fallback;
      }

      // Fallback to humanized string if not found anywhere (never show raw dot notation keys like "auth.roles.citizen")
      if (val === undefined) {
        if (typeof key === "string" && key.includes(".")) {
          const lastPart = key.split(".").pop();
          val = lastPart
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s) => s.toUpperCase())
            .trim();
        } else {
          val = key;
        }
      }

      // Interpolate parameters if supplied
      if (typeof val === "string" && params) {
        return interpolate(val, params);
      }

      return val;
    },
    [language]
  );

  /**
   * Localized date formatter
   */
  const formatDate = useCallback(
    (dateInput, options = {}) => {
      if (!dateInput) return "";
      try {
        const dateObj = typeof dateInput === "string" || typeof dateInput === "number" ? new Date(dateInput) : dateInput;
        if (isNaN(dateObj.getTime())) return String(dateInput);
        const langConfig = LANGUAGE_MAP[language] || LANGUAGE_MAP[DEFAULT_LANGUAGE];
        const defaultOptions = {
          day: "numeric",
          month: "short",
          year: "numeric",
          ...options,
        };
        return new Intl.DateTimeFormat(langConfig.dateLocale || "en-IN", defaultOptions).format(dateObj);
      } catch (err) {
        return String(dateInput);
      }
    },
    [language]
  );

  /**
   * Localized number formatter
   */
  const formatNumber = useCallback(
    (numberInput, options = {}) => {
      if (numberInput == null || isNaN(numberInput)) return String(numberInput ?? "");
      try {
        const langConfig = LANGUAGE_MAP[language] || LANGUAGE_MAP[DEFAULT_LANGUAGE];
        return new Intl.NumberFormat(langConfig.dateLocale || "en-IN", options).format(numberInput);
      } catch (err) {
        return String(numberInput);
      }
    },
    [language]
  );

  /**
   * Localize category name safely while preserving stable backend key
   */
  const getCategoryLabel = useCallback(
    (category) => {
      if (!category) return "";
      const standardKeys = ["Roads", "Water", "Electricity", "Garbage", "Drainage", "Health", "Transport", "Public Safety", "General"];
      const matched = standardKeys.find((k) => k.toLowerCase() === category.toLowerCase());
      if (matched) {
        return t(`categories.${matched}`);
      }
      return category;
    },
    [t]
  );

  /**
   * Localize status label safely
   */
  const getStatusLabel = useCallback(
    (status) => {
      if (!status) return "";
      const key = String(status).toLowerCase().replace(/\s+/g, "-");
      const translation = t(`statuses.${key}`);
      return translation !== `statuses.${key}` ? translation : status;
    },
    [t]
  );

  /**
   * Localize priority label safely
   */
  const getPriorityLabel = useCallback(
    (priority) => {
      if (!priority) return "";
      const key = String(priority).toLowerCase();
      const translation = t(`priorities.${key}`);
      return translation !== `priorities.${key}` ? translation : priority;
    },
    [t]
  );

  const contextValue = useMemo(
    () => ({
      language,
      targetLanguage,
      setLanguage,
      isTranslating,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageConfig: LANGUAGE_MAP[language] || LANGUAGE_MAP[DEFAULT_LANGUAGE],
      t,
      formatDate,
      formatNumber,
      getCategoryLabel,
      getStatusLabel,
      getPriorityLabel,
    }),
    [language, targetLanguage, setLanguage, isTranslating, t, formatDate, formatNumber, getCategoryLabel, getStatusLabel, getPriorityLabel]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

export const useTranslation = useLanguage;
