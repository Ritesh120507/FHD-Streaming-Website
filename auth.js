/**
 * NovaStream - Firebase Google Authentication Module
 */

import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initFirebase } from './firebase-config.js';

let currentUser = null;
const authListeners = new Set();

/**
 * Register a callback for auth state changes
 */
export function onUserChanged(callback) {
  authListeners.add(callback);
  if (currentUser !== undefined) {
    callback(currentUser);
  }
  return () => authListeners.delete(callback);
}

function notifyListeners(user) {
  currentUser = user;
  for (const listener of authListeners) {
    try {
      listener(user);
    } catch (err) {
      console.error("Auth listener error:", err);
    }
  }
}

/**
 * Initialize Firebase Auth state listener
 */
export function setupAuth() {
  const { auth } = initFirebase();
  if (!auth) {
    notifyListeners(null);
    return null;
  }

  onAuthStateChanged(auth, (user) => {
    notifyListeners(user);
  });

  return auth;
}

/**
 * Sign in with Google using popup
 */
export async function signInWithGoogle() {
  const { auth } = initFirebase();
  if (!auth) {
    throw new Error("Firebase is not configured yet. Please configure your Firebase project first.");
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Google Sign-In failed:", error);
    // Provide helpful error explanation
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error("Unauthorized domain! Add 'localhost' or your domain to Firebase Console > Authentication > Settings > Authorized Domains.");
    }
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error("Sign-in popup was closed before completing.");
    }
    throw error;
  }
}

/**
 * Sign out current user
 */
export async function logOut() {
  const { auth } = initFirebase();
  if (!auth) return;
  await signOut(auth);
}

/**
 * Get the currently authenticated user
 */
export function getCurrentUser() {
  return currentUser;
}

