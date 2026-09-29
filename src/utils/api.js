/**
 * CivicConnect Production HTTP Client
 * Secure Axios instance attached with Firebase ID token authentication.
 * Never silently intercepts failures with fake mock data.
 */

import axios from "axios";
import { auth } from "../firebase.js";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 60000, // 60s accommodates Render free-tier container cold starts
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach current Firebase ID token for authorization
api.interceptors.request.use(
  async (config) => {
    try {
      const currentUser = auth.currentUser;
      if (currentUser && !config.headers.Authorization) {
        const token = await currentUser.getIdToken();
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (tokenErr) {
      console.warn("Failed to attach Firebase ID token to request:", tokenErr.message);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Standardize API error formatting without silent mock fallback
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorDetails = {
      message: error.response?.data?.message || error.message || "An unexpected error occurred.",
      code: error.response?.data?.code || (error.response ? `HTTP_${error.response.status}` : "NETWORK_ERROR"),
      status: error.response?.status || 0,
      details: error.response?.data?.details || null,
      raw: error
    };

    return Promise.reject(errorDetails);
  }
);

export default api;
