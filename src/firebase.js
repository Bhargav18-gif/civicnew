/**
 * CivicConnect — Firebase Client Initialization
 *
 * Firebase is used ONLY for Authentication (and Hosting).
 * Application data (complaints, users, departments, etc.) is stored in
 * Supabase PostgreSQL — see src/lib/supabase.js.
 *
 * NOTE: Firebase config values are intentionally not in env vars for this
 * project because they were already public in .env.production. Ideally they
 * should be moved to VITE_FIREBASE_* env vars — see .env.example.
 */

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyDJAJ1lLBAiSlP5T2XbLxe7Hjjje5U7nkw",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN         || "civic-b6108.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID          || "civic-b6108",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET      || "civic-b6108.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "167012503612",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID              || "1:167012503612:web:503bba5a466b477441b339",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID      || "G-XT283NZZ76"
};

const app = initializeApp(firebaseConfig);

// Authentication — the only Firebase product still used for application logic
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// NOTE: 'db' (Firestore) is intentionally NOT exported.
// All application data access uses Supabase via src/lib/supabase.js
// and backend API calls.