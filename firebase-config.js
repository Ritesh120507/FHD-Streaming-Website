/**
 * NovaStream - Firebase Configuration & Initialization
 * 
 * Supports:
 * 1. Runtime environment variables injected from .env or GitHub Actions (window.__FIREBASE_ENV__)
 * 2. In-app localStorage configuration
 * 3. Default fallback values
 */

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Default configuration placeholder
// Actual keys are injected via .env locally or GitHub Secrets in deployment
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const STORAGE_KEY = 'novastream_firebase_config';

/**
 * Retrieve active Firebase configuration
 * Priority:
 * 1. Environment variables from .env or GitHub Secrets (window.__FIREBASE_ENV__)
 * 2. User-saved config in localStorage
 * 3. Default fallback
 */
export function getFirebaseConfig() {
  // 1. Check runtime environment variables
  if (typeof window !== 'undefined' && window.__FIREBASE_ENV__ && window.__FIREBASE_ENV__.apiKey) {
    return window.__FIREBASE_ENV__;
  }

  // 2. Check localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse stored Firebase config:", e);
    }
  }

  // 3. Fallback
  return DEFAULT_FIREBASE_CONFIG;
}

/**
 * Check if a valid Firebase configuration is present
 */
export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return Boolean(config && config.apiKey && config.projectId && config.authDomain);
}

/**
 * Save new Firebase configuration to localStorage and reload
 */
export function saveFirebaseConfig(config) {
  if (!config.apiKey || !config.projectId) {
    throw new Error("Invalid configuration: apiKey and projectId are required.");
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config, null, 2));
}

/**
 * Clear stored Firebase configuration
 */
export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

// Global Firebase instances
let app = null;
let auth = null;
let db = null;

export function initFirebase() {
  const config = getFirebaseConfig();
  if (!config.apiKey || !config.projectId) {
    return { app: null, auth: null, db: null };
  }

  try {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    return { app, auth, db };
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return { app: null, auth: null, db: null, error };
  }
}

export { app, auth, db };
