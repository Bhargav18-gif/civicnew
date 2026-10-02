import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase.js";
import { ROLES } from "../constants/workflow.js";
import api from "../utils/api.js";

const AuthContext = createContext(null);

/**
 * Resolves the user's role and Supabase profile from the backend API.
 *
 * Flow:
 *   Firebase Auth UID → POST /api/auth/sync → Supabase users → role/departmentId
 *
 * Firebase Authentication proves identity.
 * Supabase users table provides the authoritative role and department.
 *
 * NEVER relies on email string matching or client-side localStorage for role.
 * NEVER uses Supabase Auth — Firebase Auth is the authentication provider.
 */
async function resolveUserProfileFromSupabase(firebaseUser) {
  if (!firebaseUser) return { role: ROLES.CITIZEN, departmentId: null };

  try {
    // Sync Firebase user to Supabase and retrieve profile
    let token = await firebaseUser.getIdToken(false);
    let response;
    try {
      response = await api.post('/auth/sync', {
        name:  firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Citizen',
        email: firebaseUser.email || ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (firstErr) {
      // If 401 or token issue, force a token refresh and retry once
      token = await firebaseUser.getIdToken(true);
      response = await api.post('/auth/sync', {
        name:  firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Citizen',
        email: firebaseUser.email || ''
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    const profile = response.data?.user || response.data;
    return {
      role:         profile?.role?.toLowerCase() || ROLES.CITIZEN,
      departmentId: profile?.department_id || null,
      supabaseId:   profile?.id || null,
      name:         profile?.name || firebaseUser.displayName || 'Citizen',
      isActive:     profile?.is_active !== false
    };
  } catch (err) {
    console.warn('[AUTH] Backend profile sync failed, defaulting to citizen role:', err.message);
    // If backend is unreachable or unauthenticated, fall back to citizen role safely
    return { role: ROLES.CITIZEN, departmentId: null, supabaseId: null };
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const mockUser = localStorage.getItem('cc_mock_user');
      if (mockUser) {
        setUser(JSON.parse(mockUser));
        setLoading(false);
        return () => {};
      }
    } catch (_) {}

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await resolveUserProfileFromSupabase(firebaseUser);

        setUser({
          id:           firebaseUser.uid,
          uid:          firebaseUser.uid,
          supabaseId:   profile.supabaseId || null,
          name:         firebaseUser.displayName || profile.name || "Citizen",
          email:        firebaseUser.email,
          photo:        firebaseUser.photoURL,
          role:         profile.role,
          departmentId: profile.departmentId,
          isActive:     profile.isActive !== false
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = useCallback(async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
    const firebaseUser   = userCredential.user;
    const profile        = await resolveUserProfileFromSupabase(firebaseUser);

    const currentUser = {
      id:           firebaseUser.uid,
      uid:          firebaseUser.uid,
      supabaseId:   profile.supabaseId || null,
      name:         firebaseUser.displayName || profile.name || email.split("@")[0],
      email:        firebaseUser.email,
      photo:        firebaseUser.photoURL,
      role:         profile.role,
      departmentId: profile.departmentId,
      isActive:     profile.isActive !== false
    };

    setUser(currentUser);
    return currentUser;
  }, []);

  const register = useCallback(async (payload) => {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      payload.email.trim(),
      payload.password
    );
    const firebaseUser = userCredential.user;

    if (payload.name) {
      await updateProfile(firebaseUser, { displayName: payload.name });
    }

    try {
      await sendEmailVerification(firebaseUser);
    } catch (e) {
      console.warn("sendEmailVerification skipped or failed:", e.message);
    }

    // Sync new user to Supabase (role defaults to CITIZEN)
    const profile = await resolveUserProfileFromSupabase(firebaseUser);

    const currentUser = {
      id:           firebaseUser.uid,
      uid:          firebaseUser.uid,
      supabaseId:   profile.supabaseId || null,
      name:         payload.name || firebaseUser.displayName || payload.email.split('@')[0],
      email:        firebaseUser.email,
      photo:        firebaseUser.photoURL || null,
      role:         ROLES.CITIZEN,
      departmentId: null,
      isActive:     true
    };

    setUser(currentUser);
    return currentUser;
  }, []);

  const forgotPassword = useCallback(async (email) => {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, forgotPassword, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
