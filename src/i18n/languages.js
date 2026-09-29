export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    speechCode: "en-IN",
    dateLocale: "en-IN",
    dir: "ltr",
  },
  {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    speechCode: "te-IN",
    dateLocale: "te-IN",
    dir: "ltr",
  },
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    speechCode: "hi-IN",
    dateLocale: "hi-IN",
    dir: "ltr",
  },
  {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    speechCode: "ta-IN",
    dateLocale: "ta-IN",
    dir: "ltr",
  },
  {
    code: "kn",
    name: "Kannada",
    nativeName: "ಕನ್ನಡ",
    speechCode: "kn-IN",
    dateLocale: "kn-IN",
    dir: "ltr",
  },
  {
    code: "ml",
    name: "Malayalam",
    nativeName: "മലയാളം",
    speechCode: "ml-IN",
    dateLocale: "ml-IN",
    dir: "ltr",
  },
  {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    speechCode: "mr-IN",
    dateLocale: "mr-IN",
    dir: "ltr",
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    speechCode: "bn-IN",
    dateLocale: "bn-IN",
    dir: "ltr",
  },
  {
    code: "or",
    name: "Odia",
    nativeName: "ଓଡ଼ିଆ",
    speechCode: "or-IN",
    dateLocale: "or-IN",
    dir: "ltr",
  },
  {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    speechCode: "gu-IN",
    dateLocale: "gu-IN",
    dir: "ltr",
  },
  {
    code: "pa",
    name: "Punjabi",
    nativeName: "ਪੰਜਾਬੀ",
    speechCode: "pa-IN",
    dateLocale: "pa-IN",
    dir: "ltr",
  },
  {
    code: "ur",
    name: "Urdu",
    nativeName: "اردو",
    speechCode: "ur-IN",
    dateLocale: "ur-IN",
    dir: "rtl",
  },
];

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGE_MAP = SUPPORTED_LANGUAGES.reduce((acc, lang) => {
  acc[lang.code] = lang;
  return acc;
}, {});
