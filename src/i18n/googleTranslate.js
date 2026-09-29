/**
 * Google Translate Integration Service
 * Dynamically loads and controls Google Translate Element to provide seamless
 * on-the-fly translation without maintaining static JSON files for every language.
 */

const GOOGLE_TRANSLATE_SCRIPT_ID = "google-translate-script";
const COOKIE_NAME = "googtrans";

/**
 * Helper to get cookie value by name
 */
export function getCookie(name) {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
}

/**
 * Thoroughly clear googtrans cookies across all paths and domain variations
 */
export function clearGoogleTranslateCookies() {
  if (typeof document === "undefined") return;
  const hostname = window.location.hostname;
  const domains = [hostname, `.${hostname}`, ""];
  const paths = ["/", window.location.pathname];

  domains.forEach((d) => {
    paths.forEach((p) => {
      const domainAttr = d ? `; domain=${d}` : "";
      document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${p}${domainAttr};`;
    });
  });
}

/**
 * Set the googtrans cookie across root path and hostname
 */
export function setGoogleTranslateCookie(langCode) {
  if (typeof document === "undefined") return;
  const hostname = window.location.hostname;

  if (!langCode || langCode === "en") {
    clearGoogleTranslateCookies();
    return;
  }

  const cookieValue = `/en/${langCode}`;

  // Set on root path
  document.cookie = `${COOKIE_NAME}=${cookieValue}; path=/;`;

  // Set on hostname if not IP
  if (hostname && hostname !== "localhost" && !hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
    document.cookie = `${COOKIE_NAME}=${cookieValue}; path=/; domain=.${hostname};`;
  }
}

/**
 * Initialize Google Translate widget script and callback
 */
let scriptLoaded = false;
let initCallbacks = [];

export function onGoogleTranslateReady(cb) {
  if (typeof window !== "undefined" && window.google && window.google.translate) {
    cb();
  } else {
    initCallbacks.push(cb);
  }
}

export function initGoogleTranslate() {
  if (typeof window === "undefined") return;

  // Define global init callback if not already defined
  if (!window.googleTranslateElementInit) {
    window.googleTranslateElementInit = () => {
      try {
        if (window.google && window.google.translate) {
          /* eslint-disable no-new */
          new window.google.translate.TranslateElement(
            {
              pageLanguage: "en",
              autoDisplay: false,
              layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            },
            "google_translate_element"
          );
          /* eslint-enable no-new */
          scriptLoaded = true;
          initCallbacks.forEach((cb) => {
            try {
              cb();
            } catch (e) {
              console.error(e);
            }
          });
          initCallbacks = [];
        }
      } catch (err) {
        console.warn("Google Translate initialization notice:", err);
      }
    };
  }

  // Inject script tag if not present
  if (!document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = GOOGLE_TRANSLATE_SCRIPT_ID;
    script.type = "text/javascript";
    script.async = true;
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.onerror = (e) => {
      console.warn("Google Translate script failed to load (offline or blocked).", e);
    };
    document.body.appendChild(script);
  }
}

export function translatePageTo(targetLang) {
  return new Promise((resolve) => {
    // 1. Update cookies
    if (targetLang === "en") {
      clearGoogleTranslateCookies();
    } else {
      setGoogleTranslateCookie(targetLang);
    }

    // 2. Automatically reload the page to cleanly apply the new language cookie
    // The FOUC prevention script in index.html will hide the English text 
    // until Google Translate finishes applying the new language.
    window.location.reload();
    resolve(true);
  });
}

