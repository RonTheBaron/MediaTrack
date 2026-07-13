/**
 * firestore.js
 * ---------------------------------------------------------------------------
 * Data-access layer for a signed-in user's personal library. Every document
 * lives at:  users/{uid}/media/{docId}
 * where docId = `${mediaType}_${tmdbId}` (e.g. "movie_27205"), which keeps
 * the same title from being added twice and makes look-ups cheap.
 *
 * A document has two top-level sections:
 *   tmdb: { ...everything pulled from TMDb, never edited by the user }
 *   user: { ...the fields the user controls: rating, status, notes, etc. }
 * plus dateAdded / dateUpdated timestamps at the top level.
 * ---------------------------------------------------------------------------
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./firebase-init.js";

function libraryRef(uid) {
  return collection(db, "users", uid, "media");
}

function itemDocId(mediaType, tmdbId) {
  return `${mediaType}_${tmdbId}`;
}

/** Default shape for the user-editable fields on a brand-new library entry. */
export function defaultUserFields() {
  return {
    myRating: null, // 0.5–10 in half-steps
    watchStatus: "plan_to_watch", // watching | completed | dropped | on_hold | plan_to_watch
    dateWatched: null, // ISO date string or null
    favorite: false,
    rewatchCount: 0,
    notes: "",
    tags: [],
    customGenres: [], // genres the user adds manually (e.g. TMDb missed one)
  };
}

/**
 * Adds a new item to the library (or overwrites the TMDb portion of an
 * existing one, e.g. if a user re-adds a title — user fields are preserved
 * on re-add so nothing personal gets clobbered).
 */
export async function addMediaItem(uid, tmdbData, userFieldOverrides = {}) {
  const docId = itemDocId(tmdbData.mediaType, tmdbData.tmdbId);
  const ref = doc(db, "users", uid, "media", docId);
  const existing = await getDoc(ref);

  const userFields = existing.exists()
    ? { ...existing.data().user, ...userFieldOverrides }
    : { ...defaultUserFields(), ...userFieldOverrides };

  await setDoc(ref, {
    tmdb: tmdbData,
    user: userFields,
    dateAdded: existing.exists() ? existing.data().dateAdded : serverTimestamp(),
    dateUpdated: serverTimestamp(),
  });

  return docId;
}

/** Patches only the user-editable fields of an existing entry. */
export async function updateUserFields(uid, docId, patch) {
  const ref = doc(db, "users", uid, "media", docId);
  const flatPatch = {};
  Object.entries(patch).forEach(([k, v]) => {
    flatPatch[`user.${k}`] = v;
  });
  flatPatch.dateUpdated = serverTimestamp();
  await updateDoc(ref, flatPatch);
}

/** Removes an item from the library entirely. */
export async function deleteMediaItem(uid, docId) {
  await deleteDoc(doc(db, "users", uid, "media", docId));
}

/** Fetches a single item by its document id. */
export async function getMediaItem(uid, docId) {
  const snap = await getDoc(doc(db, "users", uid, "media", docId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** Fetches the user's entire library as a plain array. */
export async function getAllMediaItems(uid) {
  const snap = await getDocs(libraryRef(uid));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Serializes the full library to a JSON string suitable for downloading.
 * Firestore Timestamps are converted to ISO strings so the export is
 * plain, portable JSON.
 */
export function serializeLibraryForExport(items) {
  const clean = items.map((item) => ({
    id: item.id,
    tmdb: item.tmdb,
    user: item.user,
    dateAdded: item.dateAdded?.toDate ? item.dateAdded.toDate().toISOString() : item.dateAdded,
    dateUpdated: item.dateUpdated?.toDate ? item.dateUpdated.toDate().toISOString() : item.dateUpdated,
  }));
  return JSON.stringify({ exportedAt: new Date().toISOString(), items: clean }, null, 2);
}

/**
 * Imports a previously-exported JSON library back into Firestore. Existing
 * entries with the same doc id are overwritten. Returns the count imported.
 */
export async function importLibraryFromJSON(uid, jsonText) {
  const parsed = JSON.parse(jsonText);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) throw new Error("That file doesn't look like a library export.");

  let count = 0;
  for (const item of items) {
    if (!item.tmdb || !item.user) continue;
    const docId = item.id || itemDocId(item.tmdb.mediaType, item.tmdb.tmdbId);
    const ref = doc(db, "users", uid, "media", docId);
    await setDoc(ref, {
      tmdb: item.tmdb,
      user: item.user,
      dateAdded: toTimestampOrServer(item.dateAdded),
      dateUpdated: serverTimestamp(),
    });
    count++;
  }
  return count;
}

function toTimestampOrServer(value) {
  if (!value) return serverTimestamp();
  try {
    return Timestamp.fromDate(new Date(value));
  } catch {
    return serverTimestamp();
  }
}
