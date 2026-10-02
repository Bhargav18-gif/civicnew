/**
 * Authentication and Token Helper for CivicConnect Tests
 * Handles Firebase REST sign-in, token retrieval, user sync, and browser session injection.
 */

import axios from 'axios';
import { TEST_USERS } from './test-data.js';

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDJAJ1lLBAiSlP5T2XbLxe7Hjjje5U7nkw';
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:5177/api';

/**
 * Retrieves a valid Firebase ID Token via REST API without browser automation.
 */
export async function getFirebaseAuthToken(email, password) {
  try {
    const signInRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true },
      { timeout: 10000 }
    );
    return {
      idToken: signInRes.data.idToken,
      refreshToken: signInRes.data.refreshToken,
      localId: signInRes.data.localId,
      email: signInRes.data.email,
      expiresIn: signInRes.data.expiresIn
    };
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    throw new Error(`Firebase Auth REST failed for ${email}: ${msg}`);
  }
}

/**
 * Synchronizes user with backend Supabase database and returns profile.
 */
export async function syncUserWithBackend(idToken, name, email) {
  const res = await axios.post(
    `${API_BASE_URL}/auth/sync`,
    { name, email },
    { headers: { Authorization: `Bearer ${idToken}` }, timeout: 10000 }
  );
  return res.data.user || res.data;
}

/**
 * Performs complete programmatic login for a given role/credentials.
 */
export async function authenticateRole(userCredentials) {
  const auth = await getFirebaseAuthToken(userCredentials.email, userCredentials.password);
  const profile = await syncUserWithBackend(auth.idToken, userCredentials.name, userCredentials.email);
  return {
    ...auth,
    profile
  };
}

/**
 * Injects logged-in authentication state directly into Playwright browser context / page
 * using localStorage / indexedDB / session, or performs standard UI login.
 */
export async function performUILogin(page, email, password, expectedRedirectPath = null) {
  await page.context().clearCookies();
  await page.goto('/');
  await page.evaluate(async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (window.indexedDB && window.indexedDB.databases) {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        }
      }
    } catch (_) {}
  });

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  const submitButton = page.locator('button[type="submit"]').first();

  await emailInput.waitFor({ state: 'visible', timeout: 15000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitButton.click();

  if (expectedRedirectPath) {
    await page.waitForURL(new RegExp(expectedRedirectPath), { timeout: 15000 });
  } else {
    await page.waitForTimeout(1500);
  }
}
