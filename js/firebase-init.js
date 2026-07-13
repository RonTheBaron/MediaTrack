/**
 * firebase-init.js
 * ---------------------------------------------------------------------------
 * Boots the Firebase app once and exports shared `auth` / `db` singletons
 * for every other module to import. Uses the Firebase v10 modular SDK
 * loaded directly from Google's CDN as ES modules — no build step required.
 * ---------------------------------------------------------------------------
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Persistent login: keeps the user signed in across browser restarts,
// as opposed to session-only persistence.
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence:", err);
});
