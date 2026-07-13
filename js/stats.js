/**
 * stats.js — controller for stats.html
 * ---------------------------------------------------------------------------
 * All numbers here are derived purely from the library the user already has
 * in Firestore — nothing is fetched from TMDb again. Watch-time is a clearly
 * labeled estimate: movies use their TMDb runtime, TV shows use average
 * episode runtime × episode count, each multiplied by (1 + rewatch count)
 * for anything the user has actually started watching.
 * ---------------------------------------------------------------------------
 */
import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { getAllMediaItems } from "./firestore.js";
import { showToast } from "./toast.js";
import { escapeHtml, formatWatchTime, allGenres } from "./utils.js";

const DEFAULT_TV_EPISODE_RUNTIME = 42;

async function init() {
  const user = await requireAuth();
  renderNav("stats", user);

  let items = [];
  try {
    items = await getAllMediaItems(user.uid);
  } catch (err) {
    console.error(err);
    showToast("Couldn't load statistics.", "error");
  }

  document.getElementById("stats-loading").style.display = "none";

  if (items.length === 0) {
    document.getElementById("stats-empty").style.display = "block";
    document.getElementById("stats-empty").innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18"></path><path d="M7 15l4-5 3 3 5-7"></path></svg>
        <h3>Nothing to show yet</h3>
        <p>Add some titles to your library and your stats will show up here.</p>
        <a class="btn btn-primary" href="library.html">Go to Library</a>
      </div>`;
    return;
  }

  document.getElementById("stats-root").style.display = "block";
  renderTopCards(items);
  renderRatingDistribution(items);
  renderGenreDistribution(items);
  renderYearDistribution(items);
  renderBreakdown(items);
}

function renderTopCards(items) {
  const movies = items.filter((i) => i.tmdb.mediaType === "movie");
  const tv = items.filter((i) => i.tmdb.mediaType === "tv");
  const rated = items.filter((i) => i.user.myRating);
  const avgRating = rated.length
    ? (rated.reduce((sum, i) => sum + i.user.myRating, 0) / rated.length).toFixed(1)
    : "—";
  const totalMinutes = estimateTotalWatchMinutes(items);

  const cards = [
    { label: "Movies Watched", value: movies.length },
    { label: "TV Shows Tracked", value: tv.length },
    { label: "Total Items", value: items.length },
    { label: "Average Rating", value: avgRating === "—" ? "—" : `${avgRating} / 10` },
    { label: "Total Watch Time (est.)", value: formatWatchTime(totalMinutes) },
    { label: "Favorites", value: items.filter((i) => i.user.favorite).length },
  ];

  document.getElementById("stats-grid").innerHTML = cards
    .map(
      (c) => `
      <div class="stat-card">
        <div class="stat-card__value">${escapeHtml(String(c.value))}</div>
        <div class="stat-card__label">${escapeHtml(c.label)}</div>
      </div>`
    )
    .join("");
}

function estimateTotalWatchMinutes(items) {
  return items.reduce((total, item) => {
    const t = item.tmdb;
    const u = item.user;
    if (u.watchStatus === "plan_to_watch") return total; // not started
    const timesWatched = 1 + (u.rewatchCount || 0);

    let minutes = 0;
    if (t.mediaType === "movie") {
      minutes = t.runtime || 0;
    } else {
      const perEpisode = t.episodeRunTime || DEFAULT_TV_EPISODE_RUNTIME;
      const episodes = t.numberOfEpisodes || 0;
      minutes = perEpisode * episodes;
    }
    return total + minutes * timesWatched;
  }, 0);
}

function renderRatingDistribution(items) {
  const buckets = Array.from({ length: 10 }, () => 0); // 1..10
  let rated = 0;
  items.forEach((i) => {
    const r = i.user.myRating;
    if (!r) return;
    const bucket = Math.min(10, Math.max(1, Math.round(r))) - 1;
    buckets[bucket]++;
    rated++;
  });

  const max = Math.max(1, ...buckets);
  const container = document.getElementById("rating-distribution");

  if (rated === 0) {
    container.innerHTML = `<p style="color:var(--text-dim);">Rate a few titles to see this chart.</p>`;
    return;
  }

  container.innerHTML = buckets
    .map((count, idx) => {
      const label = idx + 1;
      const pct = (count / max) * 100;
      return `
      <div class="bar-row">
        <span class="bar-row__label">${label} / 10</span>
        <span class="bar-row__track"><span class="bar-row__fill" style="width:${pct}%;"></span></span>
        <span class="bar-row__value">${count}</span>
      </div>`;
    })
    .reverse()
    .join("");
}

function renderGenreDistribution(items) {
  const tally = new Map();
  items.forEach((i) => {
    allGenres(i).forEach((g) => tally.set(g, (tally.get(g) || 0) + 1));
  });

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const container = document.getElementById("genre-distribution");

  if (sorted.length === 0) {
    container.innerHTML = `<p style="color:var(--text-dim);">No genre data yet.</p>`;
    return;
  }

  const max = sorted[0][1];
  container.innerHTML = sorted
    .map(
      ([genre, count]) => `
      <div class="bar-row">
        <span class="bar-row__label">${escapeHtml(genre)}</span>
        <span class="bar-row__track"><span class="bar-row__fill" style="width:${(count / max) * 100}%;"></span></span>
        <span class="bar-row__value">${count}</span>
      </div>`
    )
    .join("");
}

function renderYearDistribution(items) {
  const tally = new Map();
  items.forEach((i) => {
    const d = i.user.dateWatched;
    if (!d) return;
    const year = String(d).slice(0, 4);
    if (!/^\d{4}$/.test(year)) return;
    tally.set(year, (tally.get(year) || 0) + 1);
  });

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const container = document.getElementById("year-distribution");

  if (sorted.length === 0) {
    container.innerHTML = `<p style="color:var(--text-dim);">Log a "date watched" on a few titles to see this.</p>`;
    return;
  }

  const max = sorted[0][1];
  container.innerHTML = sorted
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(
      ([year, count]) => `
      <div class="bar-row">
        <span class="bar-row__label">${year}</span>
        <span class="bar-row__track"><span class="bar-row__fill" style="width:${(count / max) * 100}%;"></span></span>
        <span class="bar-row__value">${count}</span>
      </div>`
    )
    .join("");
}

function renderBreakdown(items) {
  document.getElementById("stat-movies-count").textContent = items.filter((i) => i.tmdb.mediaType === "movie").length;
  document.getElementById("stat-tv-count").textContent = items.filter((i) => i.tmdb.mediaType === "tv").length;
  document.getElementById("stat-completed-count").textContent = items.filter((i) => i.user.watchStatus === "completed").length;
  document.getElementById("stat-watching-count").textContent = items.filter((i) => i.user.watchStatus === "watching").length;
  document.getElementById("stat-fav-count").textContent = items.filter((i) => i.user.favorite).length;
}

init();
