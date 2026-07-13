/**
 * config.js
 * ---------------------------------------------------------------------------
 * FILL THIS FILE IN BEFORE RUNNING THE APP.
 *
 * 1) Firebase config: Firebase Console → Project Settings → General →
 *    "Your apps" → Web app → SDK setup and configuration → Config object.
 *    Also enable Authentication → Sign-in method → Email/Password, and
 *    create a Firestore database (production mode is fine — see README.md
 *    for the security rules to paste in).
 *
 * 2) TMDb API key: https://www.themoviedb.org/settings/api (the "API Read
 *    Access Token" v4 auth is NOT what's used here — grab the v3 "API Key").
 * ---------------------------------------------------------------------------
 */

export const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
};

export const TMDB_API_KEY = "YOUR_TMDB_V3_API_KEY";

export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";

// Image size presets used throughout the app
export const IMG_SIZES = {
  posterSm: "w185",
  posterMd: "w342",
  posterLg: "w500",
  backdrop: "w1280",
  profile: "w185",
};
