/**
 * details.js — controller for details.html
 * ---------------------------------------------------------------------------
 */
import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { getMediaItem, updateUserFields, deleteMediaItem } from "./firestore.js";
import { tmdbImage } from "./tmdb.js";
import { showToast } from "./toast.js";
import {
  escapeHtml,
  formatRuntime,
  formatDate,
  yearFrom,
  ratingRingStyle,
} from "./utils.js";

const params = new URLSearchParams(window.location.search);
const docId = params.get("id");

let uid = null;
let item = null;
let tags = [];

async function init() {
  if (!docId) {
    showToast("No title specified.", "error");
    window.location.href = "library.html";
    return;
  }

  const user = await requireAuth();
  uid = user.uid;
  renderNav("library", user);

  try {
    item = await getMediaItem(uid, docId);
  } catch (err) {
    console.error(err);
  }

  if (!item) {
    showToast("That title couldn't be found in your library.", "error");
    window.location.href = "library.html";
    return;
  }

  tags = [...(item.user.tags || [])];
  renderPage();
  bindForm();

  document.getElementById("page-loading").style.display = "none";
  document.getElementById("details-root").style.display = "block";
}

function renderPage() {
  const t = item.tmdb;
  const u = item.user;
  const isMovie = t.mediaType === "movie";

  // Hero
  const backdrop = tmdbImage(t.backdropPath, "w1280") || tmdbImage(t.posterPath, "w500");
  document.getElementById("hero-backdrop").style.backgroundImage = backdrop ? `url('${backdrop}')` : "none";
  document.getElementById("hero-backdrop").style.backgroundColor = "var(--surface-2)";

  const posterEl = document.getElementById("hero-poster");
  const poster = tmdbImage(t.posterPath, "w500");
  if (poster) posterEl.src = poster;
  posterEl.alt = `${t.title} poster`;
  posterEl.style.display = poster ? "block" : "none";

  document.getElementById("hero-title").textContent = t.title;
  const originalEl = document.getElementById("hero-original");
  if (t.originalTitle && t.originalTitle !== t.title) {
    originalEl.textContent = `Original title: ${t.originalTitle}`;
    originalEl.style.display = "block";
  }

  document.getElementById("hero-type").textContent = isMovie ? "Movie" : "TV Show";
  document.getElementById("hero-year").textContent = yearFrom(t.releaseDate);
  document.getElementById("hero-runtime").textContent = isMovie
    ? formatRuntime(t.runtime)
    : t.numberOfSeasons
    ? `${t.numberOfSeasons} season${t.numberOfSeasons === 1 ? "" : "s"}`
    : "—";
  document.getElementById("hero-status").textContent = t.status || "—";
  document.getElementById("hero-rating").textContent = t.voteAverage ? `★ ${t.voteAverage.toFixed(1)} TMDb` : "No TMDb rating";

  document.getElementById("hero-genres").innerHTML = (t.genres || [])
    .map((g) => `<span class="badge badge-genre">${escapeHtml(g)}</span>`)
    .join("");

  // Overview
  document.getElementById("overview-text").textContent = t.overview || "No description available.";

  // Cast
  const castSection = document.getElementById("cast-section");
  if (t.cast && t.cast.length > 0) {
    document.getElementById("cast-scroll").innerHTML = t.cast
      .map((c) => {
        const img = tmdbImage(c.profilePath, "w185");
        return `
        <div class="cast-card">
          ${
            img
              ? `<img src="${img}" alt="${escapeHtml(c.name)}" loading="lazy" />`
              : `<div style="width:96px;height:96px;border-radius:50%;background:var(--surface-2);margin-bottom:8px;"></div>`
          }
          <div class="cast-card__name">${escapeHtml(c.name)}</div>
          <div class="cast-card__role">${escapeHtml(c.character || "")}</div>
        </div>`;
      })
      .join("");
  } else {
    castSection.style.display = "none";
  }

  // Seasons (TV only)
  if (!isMovie && t.seasons && t.seasons.length > 0) {
    document.getElementById("seasons-section").style.display = "block";
    document.getElementById("season-list").innerHTML = t.seasons
      .map(
        (s) => `
        <div class="season-row">
          <span class="season-row__name">${escapeHtml(s.name)}</span>
          <span class="season-row__meta">${s.episodeCount || 0} episodes${s.airDate ? ` · ${yearFrom(s.airDate)}` : ""}</span>
        </div>`
      )
      .join("");
  }

  // Production
  document.getElementById("production-companies").textContent =
    (t.productionCompanies || []).join(", ") || "Not listed.";

  // Info card
  document.getElementById("info-release").textContent = formatDate(t.releaseDate);
  document.getElementById("info-runtime").textContent = isMovie
    ? formatRuntime(t.runtime)
    : t.episodeRunTime
    ? `${t.episodeRunTime}m / episode`
    : "—";
  document.getElementById("info-seasons").textContent = isMovie ? "—" : t.numberOfSeasons ?? "—";
  document.getElementById("info-episodes").textContent = isMovie ? "—" : t.numberOfEpisodes ?? "—";
  document.getElementById("info-status").textContent = t.status || "—";
  document.getElementById("info-language").textContent = (t.language || "—").toUpperCase();
  document.getElementById("info-tmdb-rating").textContent = t.voteAverage
    ? `${t.voteAverage.toFixed(1)} / 10 (${t.voteCount || 0} votes)`
    : "—";
  document.getElementById("info-date-added").textContent = formatDate(
    item.dateAdded?.toDate ? item.dateAdded.toDate().toISOString() : item.dateAdded
  );

  // Your tracking form
  document.getElementById("my-rating").value = u.myRating || 0;
  updateRatingRing(u.myRating || 0);
  document.getElementById("watch-status").value = u.watchStatus || "plan_to_watch";
  document.getElementById("date-watched").value = u.dateWatched || "";
  document.getElementById("rewatch-count").value = u.rewatchCount || 0;
  document.getElementById("favorite-toggle").checked = !!u.favorite;
  document.getElementById("notes").value = u.notes || "";
  renderTags();
}

function updateRatingRing(value) {
  const track = document.getElementById("rating-ring-track");
  const valueEl = document.getElementById("rating-ring-value");
  track.setAttribute("style", ratingRingStyle(value));
  valueEl.innerHTML = value > 0 ? `${value}<small>/ 10</small>` : `<small>Unrated</small>`;
}

function renderTags() {
  const wrap = document.getElementById("tag-input-wrap");
  const input = document.getElementById("tag-input");
  wrap.querySelectorAll(".tag-chip").forEach((el) => el.remove());
  tags.forEach((tag, idx) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.innerHTML = `${escapeHtml(tag)} <button type="button" aria-label="Remove tag">&times;</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      tags.splice(idx, 1);
      renderTags();
    });
    wrap.insertBefore(chip, input);
  });
}

function bindForm() {
  const ratingInput = document.getElementById("my-rating");
  ratingInput.addEventListener("input", () => updateRatingRing(Number(ratingInput.value)));

  const tagInput = document.getElementById("tag-input");
  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = tagInput.value.trim();
      if (val && !tags.includes(val)) {
        tags.push(val);
        renderTags();
      }
      tagInput.value = "";
    }
  });

  document.getElementById("save-btn").addEventListener("click", saveChanges);
  document.getElementById("delete-btn").addEventListener("click", handleDelete);
}

async function saveChanges() {
  const saveBtn = document.getElementById("save-btn");
  const errorEl = document.getElementById("save-error");
  errorEl.textContent = "";

  const rawRating = Number(document.getElementById("my-rating").value);
  const patch = {
    myRating: rawRating > 0 ? rawRating : null,
    watchStatus: document.getElementById("watch-status").value,
    dateWatched: document.getElementById("date-watched").value || null,
    rewatchCount: Math.max(0, parseInt(document.getElementById("rewatch-count").value, 10) || 0),
    favorite: document.getElementById("favorite-toggle").checked,
    notes: document.getElementById("notes").value.trim(),
    tags,
  };

  saveBtn.disabled = true;
  const original = saveBtn.textContent;
  saveBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>`;

  try {
    await updateUserFields(uid, docId, patch);
    item.user = { ...item.user, ...patch };
    showToast("Saved.", "success");
  } catch (err) {
    console.error(err);
    errorEl.textContent = "Couldn't save changes. Please try again.";
    showToast("Save failed.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = original;
  }
}

async function handleDelete() {
  const confirmed = window.confirm(`Remove "${item.tmdb.title}" from your library? This can't be undone.`);
  if (!confirmed) return;

  const btn = document.getElementById("delete-btn");
  btn.disabled = true;
  try {
    await deleteMediaItem(uid, docId);
    showToast("Removed from library.", "success");
    window.location.href = "library.html";
  } catch (err) {
    console.error(err);
    showToast("Couldn't remove title. Try again.", "error");
    btn.disabled = false;
  }
}

init();
