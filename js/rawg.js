/**
 * rawg.js
 * ---------------------------------------------------------------------------
 * All communication with the RAWG Video Games Database API lives here.
 * Mirrors the shape of tmdb.js so the rest of the app (search modal, add
 * flow, details page) feels the same for games as it does for movies/TV:
 *   1. searchGames()      — live, as-you-type search
 *   2. getGameDetails()   — pulls every metadata field the app stores once
 *                            a user picks a specific search result
 * ---------------------------------------------------------------------------
 */

import { RAWG_API_KEY, RAWG_BASE_URL } from "./config.js";

/** RAWG image URLs are already full URLs (no size-suffix building needed). */
export function rawgImage(url) {
  return url || null;
}

async function rawgFetch(path, params = {}) {
  const url = new URL(`${RAWG_BASE_URL}${path}`);
  url.searchParams.set("key", RAWG_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("RAWG rejected the API key. Double-check config.js.");
    }
    throw new Error(`RAWG request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Live search across RAWG's game catalog. Returns a flat, normalized array
 * of lightweight result objects (used to render the picker list).
 */
export async function searchGames(query) {
  if (!query || !query.trim()) return [];
  const data = await rawgFetch("/games", {
    search: query.trim(),
    page_size: "20",
  });

  return (data.results || []).map((g) => ({
    rawgId: g.id,
    title: g.name,
    releaseDate: g.released || "",
    coverUrl: g.background_image || null,
    ratingAverage: g.rating || null, // RAWG's own 0-5 community rating
    platforms: (g.platforms || []).map((p) => p.platform.name),
  }));
}

/**
 * Fetches the complete metadata set for a chosen result. This is exactly
 * what gets persisted to Firestore under the `rawg` field.
 */
export async function getGameDetails(rawgId) {
  const data = await rawgFetch(`/games/${rawgId}`);

  return {
    rawgId: data.id,
    title: data.name,
    description: stripHtml(data.description_raw || data.description || ""),
    coverUrl: data.background_image || null,
    releaseDate: data.released || "",
    genres: (data.genres || []).map((g) => g.name),
    platforms: (data.platforms || []).map((p) => p.platform.name),
    developers: (data.developers || []).map((d) => d.name),
    publishers: (data.publishers || []).map((p) => p.name),
    ratingAverage: data.rating || null, // RAWG community rating, 0-5
    ratingCount: data.ratings_count || null,
    metacritic: data.metacritic || null,
    averagePlaytime: data.playtime || null, // hours, RAWG's community estimate
    website: data.website || "",
    esrbRating: data.esrb_rating?.name || "",
    stores: (data.stores || []).map((s) => s.store?.name).filter(Boolean),
  };
}

function stripHtml(str) {
  const div = document.createElement("div");
  div.innerHTML = str;
  return div.textContent || div.innerText || "";
}
