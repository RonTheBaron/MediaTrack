/**
 * library.js — controller for library.html
 * ---------------------------------------------------------------------------
 * Loads the signed-in user's full library once, then does all searching,
 * filtering, and sorting client-side (fast, and simple for a personal-scale
 * dataset). Rendering is paginated with an IntersectionObserver "infinite
 * scroll" sentinel so large libraries don't all paint at once.
 * ---------------------------------------------------------------------------
 */
import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import {
  getAllMediaItems,
  addMediaItem,
  updateUserFields,
  serializeLibraryForExport,
  importLibraryFromJSON,
  defaultUserFields,
} from "./firestore.js";
import { searchTitles, getFullDetails, tmdbImage } from "./tmdb.js";
import { showToast } from "./toast.js";
import {
  debounce,
  escapeHtml,
  lazyLoadImages,
  heartIcon,
  starIcon,
  yearFrom,
  formatRuntime,
  WATCH_STATUS_LABELS,
  allGenres,
} from "./utils.js";

const PAGE_SIZE = 24;

const state = {
  uid: null,
  allItems: [],
  filtered: [],
  visibleCount: PAGE_SIZE,
  timeBudgetMinutes: null, // null = filter inactive
};

const els = {
  loading: document.getElementById("library-loading"),
  grid: document.getElementById("library-grid"),
  empty: document.getElementById("library-empty"),
  subtitle: document.getElementById("library-subtitle"),
  resultsCount: document.getElementById("results-count"),
  sentinel: document.getElementById("load-more-sentinel"),
  search: document.getElementById("search-input"),
  filterType: document.getElementById("filter-type"),
  filterGenre: document.getElementById("filter-genre"),
  filterStatus: document.getElementById("filter-status"),
  sortSelect: document.getElementById("sort-select"),
  filterFav: document.getElementById("filter-favorites"),
  timeFinderBtn: document.getElementById("time-finder-btn"),
  timeFinderLabel: document.getElementById("time-finder-label"),
};

let observer = null;

async function init() {
  const user = await requireAuth();
  state.uid = user.uid;
  renderNav("library", user);
  await loadLibrary();
  bindToolbar();
  bindAddModal();
  bindImportExport();
  bindTimeFinder();
}

async function loadLibrary() {
  els.loading.style.display = "flex";
  els.grid.style.display = "none";
  els.empty.style.display = "none";
  try {
    state.allItems = await getAllMediaItems(state.uid);
    populateGenreOptions();
    applyFiltersAndSort();
  } catch (err) {
    console.error(err);
    showToast("Couldn't load your library. Please refresh.", "error");
  } finally {
    els.loading.style.display = "none";
  }
}

function populateGenreOptions() {
  const genres = new Set();
  state.allItems.forEach((item) => allGenres(item).forEach((g) => genres.add(g)));
  const select = els.filterGenre;
  const current = select.value;
  select.innerHTML = `<option value="all">All Genres</option>`;
  [...genres].sort().forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.textContent = g;
    select.appendChild(opt);
  });
  select.value = current || "all";
}

function bindToolbar() {
  els.search.addEventListener("input", debounce(applyFiltersAndSort, 200));
  els.filterType.addEventListener("change", applyFiltersAndSort);
  els.filterGenre.addEventListener("change", applyFiltersAndSort);
  els.filterStatus.addEventListener("change", applyFiltersAndSort);
  els.sortSelect.addEventListener("change", applyFiltersAndSort);
  els.filterFav.addEventListener("click", () => {
    els.filterFav.classList.toggle("is-active");
    applyFiltersAndSort();
  });
}

function applyFiltersAndSort() {
  const q = els.search.value.trim().toLowerCase();
  const type = els.filterType.value;
  const genre = els.filterGenre.value;
  const status = els.filterStatus.value;
  const favOnly = els.filterFav.classList.contains("is-active");
  const sortBy = els.sortSelect.value;
  const timeBudget = state.timeBudgetMinutes;

  let items = state.allItems.filter((item) => {
    const t = item.tmdb;
    const u = item.user;
    if (type !== "all" && t.mediaType !== type) return false;
    if (genre !== "all" && !allGenres(item).includes(genre)) return false;
    if (status !== "all" && u.watchStatus !== status) return false;
    if (favOnly && !u.favorite) return false;
    if (timeBudget !== null) {
      const est = estimatedRuntimeMinutes(item);
      if (est === null || est > timeBudget) return false;
    }
    if (q) {
      const hay = `${t.title} ${t.originalTitle || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  items = sortItems(items, sortBy);
  state.filtered = items;
  state.visibleCount = PAGE_SIZE;
  renderGrid(true);
}

function sortItems(items, sortBy) {
  const copy = [...items];
  const dateAddedMs = (i) => i.dateAdded?.toMillis?.() ?? new Date(i.dateAdded || 0).getTime();
  const dateWatchedMs = (i) => (i.user.dateWatched ? new Date(i.user.dateWatched).getTime() : -Infinity);

  switch (sortBy) {
    case "rating":
      return copy.sort((a, b) => (b.user.myRating || -1) - (a.user.myRating || -1));
    case "dateWatched":
      return copy.sort((a, b) => dateWatchedMs(b) - dateWatchedMs(a));
    case "releaseYear":
      return copy.sort((a, b) => (b.tmdb.releaseDate || "").localeCompare(a.tmdb.releaseDate || ""));
    case "alphabetical":
      return copy.sort((a, b) => a.tmdb.title.localeCompare(b.tmdb.title));
    case "dateAdded":
    default:
      return copy.sort((a, b) => dateAddedMs(b) - dateAddedMs(a));
  }
}

function renderGrid(reset) {
  const total = state.filtered.length;
  els.resultsCount.textContent = total === 0 ? "" : `${total} title${total === 1 ? "" : "s"}`;
  els.subtitle.textContent = `${state.allItems.length} title${state.allItems.length === 1 ? "" : "s"} in your library`;

  if (total === 0) {
    els.grid.style.display = "none";
    els.grid.innerHTML = "";
    renderEmptyState();
    els.sentinel.style.display = "none";
    return;
  }

  els.empty.style.display = "none";
  els.grid.style.display = "grid";

  const visible = state.filtered.slice(0, state.visibleCount);
  els.grid.innerHTML = visible.map(cardHtml).join("");

  els.grid.querySelectorAll(".media-card").forEach((cardEl) => {
    const id = cardEl.dataset.id;
    cardEl.addEventListener("click", () => {
      window.location.href = `details.html?id=${encodeURIComponent(id)}`;
    });
    const favBtn = cardEl.querySelector(".media-card__fav");
    favBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(id, favBtn);
    });
  });

  lazyLoadImages(els.grid);
  setupSentinel();
}

function renderEmptyState() {
  const hasLibrary = state.allItems.length > 0;
  els.empty.style.display = "block";
  els.empty.innerHTML = `
    <div class="empty-state">
      <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M3 9h18M8 5v4M16 5v4"></path></svg>
      <h3>${hasLibrary ? "No titles match your filters" : "Your library is empty"}</h3>
      <p>${hasLibrary ? "Try widening your search or clearing a filter." : "Search for a movie or show and add it to start tracking what you watch."}</p>
      ${hasLibrary ? "" : `<button class="btn btn-primary" id="empty-add-btn">+ Add Your First Title</button>`}
    </div>
  `;
  const emptyAddBtn = document.getElementById("empty-add-btn");
  if (emptyAddBtn) emptyAddBtn.addEventListener("click", openAddModal);
}

function cardHtml(item) {
  const t = item.tmdb;
  const u = item.user;
  const poster = tmdbImage(t.posterPath, "w342");
  const typeLabel = t.mediaType === "movie" ? "Movie" : "TV";
  return `
    <article class="media-card ${poster ? "" : "is-loaded"}" data-id="${escapeHtml(item.id)}" tabindex="0">
      <div class="media-card__poster-wrap">
        <div class="media-card__poster-skeleton"></div>
        <span class="media-card__type-badge ${t.mediaType === "tv" ? "tv" : ""}">${typeLabel}</span>
        <button class="media-card__fav ${u.favorite ? "is-fav" : ""}" aria-label="Toggle favorite" aria-pressed="${!!u.favorite}">${heartIcon()}</button>
        ${
          poster
            ? `<img class="media-card__poster" data-src="${poster}" alt="${escapeHtml(t.title)} poster" loading="lazy" />`
            : `<div class="media-card__poster" style="display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.75rem;padding:10px;text-align:center;">No Poster</div>`
        }
        <div class="media-card__status-strip ${u.watchStatus}"></div>
      </div>
      <div class="media-card__body">
        <div class="media-card__title">${escapeHtml(t.title)}</div>
        <div class="media-card__meta">
          <span>${yearFrom(t.releaseDate)}</span>
          ${
            state.timeBudgetMinutes !== null
              ? `<span>${formatRuntime(estimatedRuntimeMinutes(item))}</span>`
              : u.myRating
              ? `<span class="media-card__my-rating">${starIcon()}${u.myRating}</span>`
              : `<span>${WATCH_STATUS_LABELS[u.watchStatus] || ""}</span>`
          }
        </div>
      </div>
    </article>
  `;
}

async function toggleFavorite(docId, btnEl) {
  const item = state.allItems.find((i) => i.id === docId);
  if (!item) return;
  const newVal = !item.user.favorite;
  item.user.favorite = newVal; // optimistic update
  btnEl.classList.toggle("is-fav", newVal);
  btnEl.setAttribute("aria-pressed", String(newVal));
  try {
    await updateUserFields(state.uid, docId, { favorite: newVal });
  } catch (err) {
    console.error(err);
    item.user.favorite = !newVal;
    btnEl.classList.toggle("is-fav", !newVal);
    showToast("Couldn't update favorite. Try again.", "error");
  }
}

function setupSentinel() {
  if (observer) observer.disconnect();
  const hasMore = state.visibleCount < state.filtered.length;
  els.sentinel.style.display = hasMore ? "flex" : "none";
  if (!hasMore) return;

  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      state.visibleCount += PAGE_SIZE;
      renderGrid(false);
    }
  });
  observer.observe(els.sentinel);
}

/* --------------------------------------------------------------- Add modal */
const addOverlay = document.getElementById("add-modal-overlay");
const tmdbSearchInput = document.getElementById("tmdb-search-input");
const tmdbSearchStatus = document.getElementById("tmdb-search-status");
const tmdbSearchResults = document.getElementById("tmdb-search-results");

function bindAddModal() {
  document.getElementById("add-title-btn").addEventListener("click", openAddModal);
  document.getElementById("add-modal-close").addEventListener("click", closeAddModal);
  addOverlay.addEventListener("click", (e) => {
    if (e.target === addOverlay) closeAddModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && addOverlay.classList.contains("is-open")) closeAddModal();
  });
  tmdbSearchInput.addEventListener("input", debounce(runTmdbSearch, 350));
}

function openAddModal() {
  addOverlay.classList.add("is-open");
  tmdbSearchInput.value = "";
  tmdbSearchResults.innerHTML = "";
  tmdbSearchStatus.innerHTML = "";
  setTimeout(() => tmdbSearchInput.focus(), 60);
}

function closeAddModal() {
  addOverlay.classList.remove("is-open");
}

async function runTmdbSearch() {
  const query = tmdbSearchInput.value.trim();
  if (!query) {
    tmdbSearchResults.innerHTML = "";
    tmdbSearchStatus.innerHTML = "";
    return;
  }
  tmdbSearchStatus.innerHTML = `<div class="spinner"></div>`;
  try {
    const results = await searchTitles(query);
    tmdbSearchStatus.innerHTML = "";
    if (results.length === 0) {
      tmdbSearchResults.innerHTML = `<p style="color:var(--text-dim); padding: 10px 4px;">No matches on TMDb for "${escapeHtml(query)}".</p>`;
      return;
    }
    tmdbSearchResults.innerHTML = results.slice(0, 20).map(resultRowHtml).join("");
    tmdbSearchResults.querySelectorAll(".search-result-row").forEach((row) => {
      row.addEventListener("click", () => selectSearchResult(row, results));
    });
  } catch (err) {
    console.error(err);
    tmdbSearchStatus.innerHTML = "";
    tmdbSearchResults.innerHTML = `<p style="color:#f5a3a5; padding: 10px 4px;">Search failed: ${escapeHtml(err.message)}</p>`;
  }
}

function resultRowHtml(r) {
  const poster = tmdbImage(r.posterPath, "w185");
  return `
    <div class="search-result-row" data-tmdb-id="${r.tmdbId}" data-media-type="${r.mediaType}" tabindex="0">
      ${poster ? `<img src="${poster}" alt="" loading="lazy" />` : `<div style="width:44px;height:64px;background:var(--surface-2);border-radius:6px;flex-shrink:0;"></div>`}
      <div class="search-result-row__info">
        <div class="search-result-row__title">${escapeHtml(r.title)}</div>
        <div class="search-result-row__meta">${yearFrom(r.releaseDate)} · ${r.mediaType === "movie" ? "Movie" : "TV Show"}${r.voteAverage ? ` · ★ ${r.voteAverage.toFixed(1)}` : ""}</div>
      </div>
      <span class="badge">${r.mediaType === "movie" ? "Movie" : "TV"}</span>
    </div>
  `;
}

async function selectSearchResult(rowEl, results) {
  const tmdbId = Number(rowEl.dataset.tmdbId);
  const mediaType = rowEl.dataset.mediaType;
  const picked = results.find((r) => r.tmdbId === tmdbId && r.mediaType === mediaType);
  if (!picked) return;

  // Guard against double-adds if the library already has this title.
  const existingId = `${mediaType}_${tmdbId}`;
  if (state.allItems.some((i) => i.id === existingId)) {
    showToast("That title is already in your library.", "info");
    closeAddModal();
    window.location.href = `details.html?id=${encodeURIComponent(existingId)}`;
    return;
  }

  rowEl.style.opacity = "0.5";
  rowEl.style.pointerEvents = "none";
  rowEl.innerHTML += `<div class="spinner" style="position:absolute; right:10px;"></div>`;

  try {
    const fullDetails = await getFullDetails(tmdbId, mediaType);
    const docId = await addMediaItem(state.uid, fullDetails);
    state.allItems.unshift({
      id: docId,
      tmdb: fullDetails,
      user: defaultUserFields(),
      dateAdded: new Date(),
      dateUpdated: new Date(),
    });
    populateGenreOptions();
    applyFiltersAndSort();
    closeAddModal();
    showToast(`Added "${fullDetails.title}" to your library.`, "success");
  } catch (err) {
    console.error(err);
    showToast(`Couldn't add that title: ${err.message}`, "error");
    rowEl.style.opacity = "1";
    rowEl.style.pointerEvents = "auto";
  }
}

/* ------------------------------------------------------------ Import / Export */
function bindImportExport() {
  document.getElementById("export-btn").addEventListener("click", exportLibrary);
  const importBtn = document.getElementById("import-btn");
  const fileInput = document.getElementById("import-file-input");
  importBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importLibraryFromJSON(state.uid, text);
      showToast(`Imported ${count} title${count === 1 ? "" : "s"}.`, "success");
      await loadLibrary();
    } catch (err) {
      console.error(err);
      showToast(`Import failed: ${err.message}`, "error");
    } finally {
      fileInput.value = "";
    }
  });
}

function exportLibrary() {
  if (state.allItems.length === 0) {
    showToast("Your library is empty — nothing to export.", "info");
    return;
  }
  const json = serializeLibraryForExport(state.allItems);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mediatrack-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Library exported.", "success");
}

/* ------------------------------------------------------------ Time Filter */
const EPISODE_TRIM_MINUTES = 4;

/**
 * Estimated total watch time for an item, in minutes, or null if unknown.
 * Movies: TMDb runtime as-is.
 * TV shows: numberOfEpisodes * (episodeRunTime - 4), floored at 0 per episode.
 */
function estimatedRuntimeMinutes(item) {
  const t = item.tmdb;
  if (!t) return null;

  if (t.mediaType === "movie") {
    return typeof t.runtime === "number" && t.runtime > 0 ? t.runtime : null;
  }

  // TV show
  const episodes = t.numberOfEpisodes;
  const perEpisode = t.episodeRunTime;
  if (!episodes || !perEpisode) return null;
  const trimmed = Math.max(0, perEpisode - EPISODE_TRIM_MINUTES);
  return episodes * trimmed;
}

function bindTimeFinder() {
  const overlay = document.getElementById("time-modal-overlay");
  const closeBtn = document.getElementById("time-modal-close");
  const applyBtn = document.getElementById("time-apply-btn");
  const clearBtn = document.getElementById("time-clear-btn");
  const hoursInput = document.getElementById("time-hours-input");
  const minutesInput = document.getElementById("time-minutes-input");

  if (!els.timeFinderBtn || !overlay || !closeBtn || !applyBtn || !clearBtn || !hoursInput || !minutesInput) {
    console.error("Time Filter: one or more expected elements are missing from the DOM.");
    return;
  }

  els.timeFinderBtn.addEventListener("click", () => {
    overlay.classList.add("is-open");
    setTimeout(() => hoursInput.focus(), 60);
  });
  closeBtn.addEventListener("click", () => overlay.classList.remove("is-open"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("is-open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) overlay.classList.remove("is-open");
  });

  applyBtn.addEventListener("click", () => {
    const hours = Math.max(0, parseInt(hoursInput.value, 10) || 0);
    const minutes = Math.max(0, parseInt(minutesInput.value, 10) || 0);
    const budget = hours * 60 + minutes;

    if (budget <= 0) {
      showToast("Enter how much time you've got first.", "info");
      return;
    }

    state.timeBudgetMinutes = budget;
    updateTimeFinderButtonState();
    overlay.classList.remove("is-open");
    applyFiltersAndSort();
  });

  clearBtn.addEventListener("click", () => {
    state.timeBudgetMinutes = null;
    hoursInput.value = "";
    minutesInput.value = "";
    updateTimeFinderButtonState();
    overlay.classList.remove("is-open");
    applyFiltersAndSort();
  });
}

function updateTimeFinderButtonState() {
  const budget = state.timeBudgetMinutes;
  if (budget === null) {
    els.timeFinderBtn.classList.remove("is-active");
    els.timeFinderLabel.textContent = "Time Available";
  } else {
    els.timeFinderBtn.classList.add("is-active");
    els.timeFinderLabel.textContent = `≤ ${formatRuntime(budget)}`;
  }
}

init();
