/**
 * tmdb.js
 * ---------------------------------------------------------------------------
 * All communication with The Movie Database API lives here. Two jobs:
 *   1. searchTitles()   — live, as-you-type search across movies & TV shows
 *   2. getFullDetails() — pulls every metadata field the app stores once a
 *                          user picks a specific search result
 * ---------------------------------------------------------------------------
 */

import { TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE, IMG_SIZES } from "./config.js";

/** Builds a full image URL from a TMDb path, or null if there isn't one. */
export function tmdbImage(path, size = IMG_SIZES.posterMd) {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}${size}${path}`;
}

async function tmdbFetch(path, params = {}) {
  const url = new URL(`${TMDB_BASE_URL}${path}`);
  url.searchParams.set("api_key", TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("TMDb rejected the API key. Double-check config.js.");
    }
    throw new Error(`TMDb request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Live multi-search across movies and TV shows. Returns a flat, normalized
 * array of lightweight result objects (used to render the picker list).
 */
export async function searchTitles(query) {
  if (!query || !query.trim()) return [];
  const data = await tmdbFetch("/search/multi", {
    query: query.trim(),
    include_adult: "false",
  });

  return (data.results || [])
    .filter((r) => r.media_type === "movie" || r.media_type === "tv")
    .map((r) => ({
      tmdbId: r.id,
      mediaType: r.media_type, // 'movie' | 'tv'
      title: r.media_type === "movie" ? r.title : r.name,
      originalTitle: r.media_type === "movie" ? r.original_title : r.original_name,
      releaseDate: r.media_type === "movie" ? r.release_date : r.first_air_date,
      posterPath: r.poster_path,
      voteAverage: r.vote_average,
      overview: r.overview,
    }))
    .sort((a, b) => (b.voteAverage || 0) - (a.voteAverage || 0));
}

/**
 * Fetches the complete metadata set for a chosen result, normalized into
 * one shape regardless of whether it's a movie or TV show. This is exactly
 * what gets persisted to Firestore under the `tmdb` field.
 */
export async function getFullDetails(tmdbId, mediaType) {
  const isMovie = mediaType === "movie";
  const data = await tmdbFetch(`/${isMovie ? "movie" : "tv"}/${tmdbId}`, {
    append_to_response: "credits",
  });

  const cast = (data.credits?.cast || []).slice(0, 12).map((c) => ({
    name: c.name,
    character: c.character,
    profilePath: c.profile_path,
  }));

  const base = {
    tmdbId: data.id,
    mediaType,
    title: isMovie ? data.title : data.name,
    originalTitle: isMovie ? data.original_title : data.original_name,
    overview: data.overview || "",
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    genres: (data.genres || []).map((g) => g.name),
    releaseDate: isMovie ? data.release_date : data.first_air_date,
    voteAverage: data.vote_average ?? null,
    voteCount: data.vote_count ?? null,
    language: data.original_language || "",
    productionCompanies: (data.production_companies || []).map((c) => c.name),
    cast,
    homepage: data.homepage || "",
  };

  if (isMovie) {
    return {
      ...base,
      runtime: data.runtime ?? null, // minutes
      status: data.status || "",
      numberOfSeasons: null,
      numberOfEpisodes: null,
      episodeRunTime: null,
    };
  }

  return {
    ...base,
    runtime: null,
    episodeRunTime: (data.episode_run_time && data.episode_run_time[0]) || null,
    status: data.status || "", // 'Ended' | 'Returning Series' | etc.
    numberOfSeasons: data.number_of_seasons ?? null,
    numberOfEpisodes: data.number_of_episodes ?? null,
    seasons: (data.seasons || [])
      .filter((s) => s.season_number !== 0) // drop "Specials" clutter
      .map((s) => ({
        name: s.name,
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        airDate: s.air_date,
      })),
  };
}
