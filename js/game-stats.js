/**
 * game-stats.js — controller for game-stats.html
 * ---------------------------------------------------------------------------
 * Deliberately different metrics from stats.js: there's no "watch time" for
 * story games, so instead this surfaces endings unlocked, replay counts,
 * platform breakdown, and how often choices actually mattered — things that
 * only make sense for played (not watched) media.
 * ---------------------------------------------------------------------------
 */
import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { getAllGameItems } from "./firestore.js";
import { showToast } from "./toast.js";
import { escapeHtml, allGameGenres } from "./utils.js";

async function init() {
  const user = await requireAuth();
  renderNav("game-stats", user);

  let items = [];
  try {
    items = await getAllGameItems(user.uid);
  } catch (err) {
    console.error(err);
    showToast("Couldn't load game statistics.", "error");
  }

  document.getElementById("stats-loading").style.display = "none";

  if (items.length === 0) {
    document.getElementById("stats-empty").style.display = "block";
    document.getElementById("stats-empty").innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="12" rx="4"></rect><circle cx="8" cy="13" r="1.2"></circle><path d="M15 11v4M17 13h-4"></path></svg>
        <h3>Nothing to show yet</h3>
        <p>Add some games to your library and your stats will show up here.</p>
        <a class="btn btn-primary" href="games.html">Go to Games</a>
      </div>`;
    return;
  }

  document.getElementById("stats-root").style.display = "block";
  renderTopCards(items);
  renderRatingDistribution(items);
  renderPlatformDistribution(items);
  renderGenreDistribution(items);
  renderBreakdown(items);
}

function renderTopCards(items) {
  const rated = items.filter((i) => i.user.myRating);
  const avgRating = rated.length
    ? (rated.reduce((sum, i) => sum + i.user.myRating, 0) / rated.length).toFixed(1)
    : "—";
  const totalEndings = items.reduce((sum, i) => sum + (i.user.endingsUnlocked || 0), 0);
  const totalReplays = items.reduce((sum, i) => sum + (i.user.replayCount || 0), 0);
  const completed = items.filter((i) => i.user.playStatus === "completed").length;

  const cards = [
    { label: "Games Tracked", value: items.length },
    { label: "Completed", value: completed },
    { label: "Average Rating", value: avgRating === "—" ? "—" : `${avgRating} / 10` },
    { label: "Endings Unlocked", value: totalEndings },
    { label: "Total Replays", value: totalReplays },
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
    container.innerHTML = `<p style="color:var(--text-dim);">Rate a few games to see this chart.</p>`;
    return;
  }

  container.innerHTML = buckets
    .map((count, idx) => {
      const label = idx + 1;
      const pct = (count / max) * 100;
      return `
      <div class="bar-row">
        <span class="bar-row__label">${label} / 10</span>
        <span class="bar-row__track"><span class="bar-row__fill" style="width:${pct}%; background:var(--violet);"></span></span>
        <span class="bar-row__value">${count}</span>
      </div>`;
    })
    .reverse()
    .join("");
}

function renderPlatformDistribution(items) {
  const tally = new Map();
  items.forEach((i) => {
    const played = i.user.platformPlayed?.trim();
    const platforms = played ? [played] : i.rawg.platforms || [];
    platforms.forEach((p) => tally.set(p, (tally.get(p) || 0) + 1));
  });

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const container = document.getElementById("platform-distribution");

  if (sorted.length === 0) {
    container.innerHTML = `<p style="color:var(--text-dim);">No platform data yet.</p>`;
    return;
  }

  const max = sorted[0][1];
  container.innerHTML = sorted
    .map(
      ([platform, count]) => `
      <div class="bar-row">
        <span class="bar-row__label">${escapeHtml(platform)}</span>
        <span class="bar-row__track"><span class="bar-row__fill" style="width:${(count / max) * 100}%; background:var(--violet);"></span></span>
        <span class="bar-row__value">${count}</span>
      </div>`
    )
    .join("");
}

function renderGenreDistribution(items) {
  const tally = new Map();
  items.forEach((i) => {
    allGameGenres(i).forEach((g) => tally.set(g, (tally.get(g) || 0) + 1));
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
        <span class="bar-row__track"><span class="bar-row__fill" style="width:${(count / max) * 100}%; background:var(--violet);"></span></span>
        <span class="bar-row__value">${count}</span>
      </div>`
    )
    .join("");
}

function renderBreakdown(items) {
  document.getElementById("stat-total-count").textContent = items.length;
  document.getElementById("stat-completed-count").textContent = items.filter((i) => i.user.playStatus === "completed").length;
  document.getElementById("stat-playing-count").textContent = items.filter((i) => i.user.playStatus === "playing").length;
  document.getElementById("stat-backlog-count").textContent = items.filter((i) => i.user.playStatus === "backlog").length;
  document.getElementById("stat-fav-count").textContent = items.filter((i) => i.user.favorite).length;
  document.getElementById("stat-endings-count").textContent = items.reduce((sum, i) => sum + (i.user.endingsUnlocked || 0), 0);
  document.getElementById("stat-replays-count").textContent = items.reduce((sum, i) => sum + (i.user.replayCount || 0), 0);
  document.getElementById("stat-choices-mattered-count").textContent = items.filter((i) => i.user.choicesMattered === true).length;
}

init();
