/**
 * games.js — controller for games.html
 * ---------------------------------------------------------------------------
 * The Games library, kept as a separate vertical from movies/TV: separate
 * Firestore collection, separate search API (RAWG), separate stats. Mirrors
 * the structure of library.js so the two stay easy to maintain side by side.
 * ---------------------------------------------------------------------------
 */
import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import {
  getAllGameItems,
  addGameItem,
  updateGameUserFields,
  serializeGamesForExport,
  importGamesFromJSON,
  defaultGameUserFields,
} from "./firestore.js";
import { searchGames, getGameDetails, rawgImage } from "./rawg.js";
import { showToast } from "./toast.js";
import {
  debounce,
  escapeHtml,
  lazyLoadImages,
  heartIcon,
  starIcon,
  yearFrom,
  PLAY_STATUS_LABELS,
  allGameGenres,
} from "./utils.js";

const PAGE_SIZE = 24;

const state = {
  uid: null,
  allItems: [],
  filtered: [],
  visibleCount: PAGE_SIZE,
};

const els = {
  loading: document.getElementById("games-loading"),
  grid: document.getElementById("games-grid"),
  empty: document.getElementById("games-empty"),
  subtitle: document.getElementById("games-subtitle"),
  resultsCount: document.getElementById("results-count"),
  sentinel: document.getElementById("load-more-sentinel"),
  search: document.getElementById("search-input"),
  filterPlatform: document.getElementById("filter-platform"),
  filterGenre: document.getElementById("filter-genre"),
  filterStatus: document.getElementById("filter-status"),
  sortSelect: document.getElementById("sort-select"),
  filterFav: document.getElementById("filter-favorites"),
};

let observer = null;

async function init() {
  const user = await requireAuth();
  state.uid = user.uid;
  renderNav("games", user);
  await loadLibrary();
  bindToolbar();
  bindAddModal();
  bindImportExport();
}

async function loadLibrary() {
  els.loading.style.display = "flex";
  els.grid.style.display = "none";
  els.empty.style.display = "none";
  try {
    state.allItems = await getAllGameItems(state.uid);
    populateFilterOptions();
    applyFiltersAndSort();
  } catch (err) {
    console.error(err);
    showToast("Couldn't load your games. Please refresh.", "error");
  } finally {
    els.loading.style.display = "none";
  }
}

function populateFilterOptions() {
  const genres = new Set();
  const platforms = new Set();
  state.allItems.forEach((item) => {
    allGameGenres(item).forEach((g) => genres.add(g));
    (item.rawg.platforms || []).forEach((p) => platforms.add(p));
  });

  fillSelect(els.filterGenre, genres, "All Genres");
  fillSelect(els.filterPlatform, platforms, "All Platforms");
}

function fillSelect(select, valuesSet, allLabel) {
  const current = select.value;
  select.innerHTML = `<option value="all">${allLabel}</option>`;
  [...valuesSet].sort().forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    select.appendChild(opt);
  });
  select.value = current || "all";
}

function bindToolbar() {
  els.search.addEventListener("input", debounce(applyFiltersAndSort, 200));
  els.filterPlatform.addEventListener("change", applyFiltersAndSort);
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
  const platform = els.filterPlatform.value;
  const genre = els.filterGenre.value;
  const status = els.filterStatus.value;
  const favOnly = els.filterFav.classList.contains("is-active");
  const sortBy = els.sortSelect.value;

  let items = state.allItems.filter((item) => {
    const r = item.rawg;
    const u = item.user;
    if (platform !== "all" && !(r.platforms || []).includes(platform)) return false;
    if (genre !== "all" && !allGameGenres(item).includes(genre)) return false;
    if (status !== "all" && u.playStatus !== status) return false;
    if (favOnly && !u.favorite) return false;
    if (q) {
      const hay = r.title.toLowerCase();
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
  const dateFinishedMs = (i) => (i.user.dateFinished ? new Date(i.user.dateFinished).getTime() : -Infinity);

  switch (sortBy) {
    case "rating":
      return copy.sort((a, b) => (b.user.myRating || -1) - (a.user.myRating || -1));
    case "dateFinished":
      return copy.sort((a, b) => dateFinishedMs(b) - dateFinishedMs(a));
    case "endingsUnlocked":
      return copy.sort((a, b) => (b.user.endingsUnlocked || 0) - (a.user.endingsUnlocked || 0));
    case "releaseYear":
      return copy.sort((a, b) => (b.rawg.releaseDate || "").localeCompare(a.rawg.releaseDate || ""));
    case "alphabetical":
      return copy.sort((a, b) => a.rawg.title.localeCompare(b.rawg.title));
    case "dateAdded":
    default:
      return copy.sort((a, b) => dateAddedMs(b) - dateAddedMs(a));
  }
}

function renderGrid(reset) {
  const total = state.filtered.length;
  els.resultsCount.textContent = total === 0 ? "" : `${total} game${total === 1 ? "" : "s"}`;
  els.subtitle.textContent = `${state.allItems.length} game${state.allItems.length === 1 ? "" : "s"} in your library`;

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
      window.location.href = `game-details.html?id=${encodeURIComponent(id)}`;
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
      <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="12" rx="4"></rect><circle cx="8" cy="13" r="1.2"></circle><path d="M15 11v4M17 13h-4"></path></svg>
      <h3>${hasLibrary ? "No games match your filters" : "Your games library is empty"}</h3>
      <p>${hasLibrary ? "Try widening your search or clearing a filter." : "Search for a game and add it to start tracking what you play."}</p>
      ${hasLibrary ? "" : `<button class="btn btn-primary" id="empty-add-btn">+ Add Your First Game</button>`}
    </div>
  `;
  const emptyAddBtn = document.getElementById("empty-add-btn");
  if (emptyAddBtn) emptyAddBtn.addEventListener("click", openAddModal);
}

function cardHtml(item) {
  const r = item.rawg;
  const u = item.user;
  const cover = rawgImage(r.coverUrl);
  return `
    <article class="media-card ${cover ? "" : "is-loaded"}" data-id="${escapeHtml(item.id)}" tabindex="0">
      <div class="media-card__poster-wrap">
        <div class="media-card__poster-skeleton"></div>
        <span class="media-card__type-badge game">Game</span>
        <button class="media-card__fav ${u.favorite ? "is-fav" : ""}" aria-label="Toggle favorite" aria-pressed="${!!u.favorite}">${heartIcon()}</button>
        ${
          cover
            ? `<img class="media-card__poster" data-src="${cover}" alt="${escapeHtml(r.title)} cover" loading="lazy" />`
            : `<div class="media-card__poster" style="display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:0.75rem;padding:10px;text-align:center;">No Cover</div>`
        }
        <div class="media-card__status-strip ${u.playStatus}"></div>
      </div>
      <div class="media-card__body">
        <div class="media-card__title">${escapeHtml(r.title)}</div>
        <div class="media-card__meta">
          <span>${yearFrom(r.releaseDate)}</span>
          ${
            u.myRating
              ? `<span class="media-card__my-rating">${starIcon()}${u.myRating}</span>`
              : `<span>${PLAY_STATUS_LABELS[u.playStatus] || ""}</span>`
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
    await updateGameUserFields(state.uid, docId, { favorite: newVal });
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
const rawgSearchInput = document.getElementById("rawg-search-input");
const rawgSearchStatus = document.getElementById("rawg-search-status");
const rawgSearchResults = document.getElementById("rawg-search-results");

function bindAddModal() {
  document.getElementById("add-game-btn").addEventListener("click", openAddModal);
  document.getElementById("add-modal-close").addEventListener("click", closeAddModal);
  addOverlay.addEventListener("click", (e) => {
    if (e.target === addOverlay) closeAddModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && addOverlay.classList.contains("is-open")) closeAddModal();
  });
  rawgSearchInput.addEventListener("input", debounce(runRawgSearch, 350));
}

function openAddModal() {
  addOverlay.classList.add("is-open");
  rawgSearchInput.value = "";
  rawgSearchResults.innerHTML = "";
  rawgSearchStatus.innerHTML = "";
  setTimeout(() => rawgSearchInput.focus(), 60);
}

function closeAddModal() {
  addOverlay.classList.remove("is-open");
}

async function runRawgSearch() {
  const query = rawgSearchInput.value.trim();
  if (!query) {
    rawgSearchResults.innerHTML = "";
    rawgSearchStatus.innerHTML = "";
    return;
  }
  rawgSearchStatus.innerHTML = `<div class="spinner"></div>`;
  try {
    const results = await searchGames(query);
    rawgSearchStatus.innerHTML = "";
    if (results.length === 0) {
      rawgSearchResults.innerHTML = `<p style="color:var(--text-dim); padding: 10px 4px;">No matches on RAWG for "${escapeHtml(query)}".</p>`;
      return;
    }
    rawgSearchResults.innerHTML = results.slice(0, 20).map(resultRowHtml).join("");
    rawgSearchResults.querySelectorAll(".search-result-row").forEach((row) => {
      row.addEventListener("click", () => selectSearchResult(row, results));
    });
  } catch (err) {
    console.error(err);
    rawgSearchStatus.innerHTML = "";
    rawgSearchResults.innerHTML = `<p style="color:#f5a3a5; padding: 10px 4px;">Search failed: ${escapeHtml(err.message)}</p>`;
  }
}

function resultRowHtml(r) {
  const cover = rawgImage(r.coverUrl);
  return `
    <div class="search-result-row" data-rawg-id="${r.rawgId}" tabindex="0">
      ${cover ? `<img src="${cover}" alt="" loading="lazy" />` : `<div style="width:44px;height:64px;background:var(--surface-2);border-radius:6px;flex-shrink:0;"></div>`}
      <div class="search-result-row__info">
        <div class="search-result-row__title">${escapeHtml(r.title)}</div>
        <div class="search-result-row__meta">${yearFrom(r.releaseDate)}${r.ratingAverage ? ` · ★ ${r.ratingAverage.toFixed(1)}` : ""}${r.platforms.length ? ` · ${escapeHtml(r.platforms.slice(0, 2).join(", "))}` : ""}</div>
      </div>
      <span class="badge">Game</span>
    </div>
  `;
}

async function selectSearchResult(rowEl, results) {
  const rawgId = Number(rowEl.dataset.rawgId);
  const picked = results.find((r) => r.rawgId === rawgId);
  if (!picked) return;

  // Guard against double-adds if the library already has this title.
  const existingId = `game_${rawgId}`;
  if (state.allItems.some((i) => i.id === existingId)) {
    showToast("That game is already in your library.", "info");
    closeAddModal();
    window.location.href = `game-details.html?id=${encodeURIComponent(existingId)}`;
    return;
  }

  rowEl.style.opacity = "0.5";
  rowEl.style.pointerEvents = "none";
  rowEl.innerHTML += `<div class="spinner" style="position:absolute; right:10px;"></div>`;

  try {
    const fullDetails = await getGameDetails(rawgId);
    const docId = await addGameItem(state.uid, fullDetails);
    state.allItems.unshift({
      id: docId,
      rawg: fullDetails,
      user: defaultGameUserFields(),
      dateAdded: new Date(),
      dateUpdated: new Date(),
    });
    populateFilterOptions();
    applyFiltersAndSort();
    closeAddModal();
    showToast(`Added "${fullDetails.title}" to your games.`, "success");
  } catch (err) {
    console.error(err);
    showToast(`Couldn't add that game: ${err.message}`, "error");
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
      const count = await importGamesFromJSON(state.uid, text);
      showToast(`Imported ${count} game${count === 1 ? "" : "s"}.`, "success");
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
    showToast("Your games library is empty — nothing to export.", "info");
    return;
  }
  const json = serializeGamesForExport(state.allItems);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mediatrack-games-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Games library exported.", "success");
}

init();
