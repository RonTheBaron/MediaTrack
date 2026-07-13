/**
 * auth.js
 * ---------------------------------------------------------------------------
 * Thin wrapper around Firebase Authentication (email/password).
 * Every protected page calls `requireAuth()` on load; it redirects to
 * index.html if nobody is signed in, and otherwise hands back the user.
 * ---------------------------------------------------------------------------
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { auth } from "./firebase-init.js";

/** Creates a new account. Throws on failure (caller shows the message). */
export async function signUp(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(cred.user, { displayName });
  }
  return cred.user;
}

/** Signs an existing user in. Throws on failure. */
export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Signs the current user out and sends them back to the login page. */
export async function logOut() {
  await signOut(auth);
  window.location.href = "index.html";
}

/**
 * Guards a page that requires authentication. Resolves with the signed-in
 * user, or redirects to index.html and never resolves if nobody is signed
 * in. Use once per page, near the top of the page's controller module.
 */
export function requireAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        window.location.href = "index.html";
      }
    });
  });
}

/**
 * For the login page itself: if someone is already signed in, skip the
 * form and go straight to the library.
 */
export function redirectIfAuthed() {
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "library.html";
  });
}

/** Translates common Firebase Auth error codes into friendly copy. */
export function friendlyAuthError(err) {
  const code = err?.code || "";
  const map = {
    "auth/email-already-in-use": "That email is already registered — try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error — check your connection.",
  };
  return map[code] || err?.message || "Something went wrong. Please try again.";
}
