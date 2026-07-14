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
 *
 * 3) RAWG API key (for the Games section): https://rawg.io/apidocs — sign
 *    up is free, the key shows up on your account page immediately.
 * ---------------------------------------------------------------------------
 */

export const firebaseConfig = {
  apiKey: "AIzaSyBMCg-ZY6omqQ-jWAysUD9iXm5XeLv1HGM",
  authDomain: "mediatracker-5f541.firebaseapp.com",
  databaseURL: "https://mediatracker-5f541-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mediatracker-5f541",
  storageBucket: "mediatracker-5f541.firebasestorage.app",
  messagingSenderId: "1007550308490",
  appId: "1:1007550308490:web:68b31cb97b2584a8c54d73"
};

export const TMDB_API_KEY = "854943036f1a0c02399040389bfeeac4";

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

// --- Games section (RAWG) --------------------------------------------------
export const RAWG_API_KEY = "9c6a3866a5c14911a40800e3213b15a8";
export const RAWG_BASE_URL = "https://api.rawg.io/api";
