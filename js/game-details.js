/**
 * game-details.js — controller for game-details.html
 * ---------------------------------------------------------------------------
 * Games equivalent of details.js. Tracks story-game-specific fields that
 * don't map to anything on the movies/TV side: endings unlocked, routes
 * completed, whether choices meaningfully changed the story, and where the
 * user actually played it.
 * ---------------------------------------------------------------------------
 */
import { requireAuth } from "./auth.js";
import { renderNav } from "./nav.js";
import { getGameItem, updateGameUserFields, deleteGameItem } from "./firestore.js";
import { rawgImage } from "./rawg.js";
import { showToast } from "./toast.js";
import { escapeHtml, formatDate, yearFrom, ratingRingStyle } from "./utils.js";

const params = new URLSearchParams(window.location.search);
const docId = params.get("id");

let uid = null;
let item = null;
let tags = [];
let customGenres = [];
let routes = [];

async function init() {
  if (!docId) {
    showToast("No game specified.", "error");
    window.location.href = "games.html";
    return;
  }

  const user = await requireAuth();
  uid = user.uid;
  renderNav("games", user);

  try {
    item = await getGameItem(uid, docId);
  } catch (err) {
    console.error(err);
  }

  if (!item) {
    showToast("That game couldn't be found in your library.", "error");
    window.location.href = "games.html";
    return;
  }

  tags = [...(item.user.tags || [])];
  customGenres = [...(item.user.customGenres || [])];
  routes = [...(item.user.routesCompleted || [])];
  renderPage();
  bindForm();

  document.getElementById("page-loading").style.display = "none";
  document.getElementById("details-root").style.display = "block";
}

function renderPage() {
  const r = item.rawg;
  const u = item.user;

  // Hero
  const cover = rawgImage(r.coverUrl);
  document.getElementById("hero-backdrop").style.backgroundImage = cover ? `url('${cover}')` : "none";
  document.getElementById("hero-backdrop").style.backgroundColor = "var(--surface-2)";

  const posterEl = document.getElementById("hero-poster");
  if (cover) posterEl.src = cover;
  posterEl.alt = `${r.title} cover`;
  posterEl.style.display = cover ? "block" : "none";

  document.getElementById("hero-title").textContent = r.title;
  document.getElementById("hero-year").textContent = yearFrom(r.releaseDate);
  document.getElementById("hero-playtime").textContent = r.averagePlaytime
    ? `~${r.averagePlaytime}h avg.`
    : "Playtime unknown";
  document.getElementById("hero-metacritic").textContent = r.metacritic ? `Metacritic ${r.metacritic}` : "";
  document.getElementById("hero-metacritic").style.display = r.metacritic ? "inline-flex" : "none";
  document.getElementById("hero-rating").textContent = r.ratingAverage ? `★ ${r.ratingAverage.toFixed(1)} RAWG` : "No RAWG rating";

  const rawgGenreBadges = (r.genres || []).map((g) => `<span class="badge badge-genre">${escapeHtml(g)}</span>`);
  const customGenreBadges = (u.customGenres || []).map(
    (g) => `<span class="badge badge-genre" style="opacity:0.75;" title="Added by you">${escapeHtml(g)} ✦</span>`
  );
  document.getElementById("hero-genres").innerHTML = [...rawgGenreBadges, ...customGenreBadges].join("");

  // Overview
  document.getElementById("overview-text").textContent = r.description || "No description available.";

  // Platforms
  document.getElementById("platforms-list").textContent = (r.platforms || []).join(", ") || "Not listed.";

  // Dev / Publisher
  const devPub = [
    r.developers?.length ? `Developed by ${r.developers.join(", ")}` : "",
    r.publishers?.length ? `Published by ${r.publishers.join(", ")}` : "",
  ].filter(Boolean);
  document.getElementById("dev-pub-list").textContent = devPub.join(" · ") || "Not listed.";

  // Info card
  document.getElementById("info-release").textContent = formatDate(r.releaseDate);
  document.getElementById("info-playtime").textContent = r.averagePlaytime ? `${r.averagePlaytime}h` : "—";
  document.getElementById("info-esrb").textContent = r.esrbRating || "—";
  document.getElementById("info-metacritic").textContent = r.metacritic || "—";
  document.getElementById("info-rawg-rating").textContent = r.ratingAverage
    ? `${r.ratingAverage.toFixed(1)} / 5 (${r.ratingCount || 0} ratings)`
    : "—";
  document.getElementById("info-date-added").textContent = formatDate(
    item.dateAdded?.toDate ? item.dateAdded.toDate().toISOString() : item.dateAdded
  );

  // Your tracking form
  document.getElementById("my-rating").value = u.myRating || 0;
  updateRatingRing(u.myRating || 0);
  document.getElementById("play-status").value = u.playStatus || "backlog";
  document.getElementById("date-finished").value = u.dateFinished || "";
  document.getElementById("replay-count").value = u.replayCount || 0;
  document.getElementById("endings-unlocked").value = u.endingsUnlocked || 0;
  document.getElementById("platform-played").value = u.platformPlayed || "";
  document.getElementById("choices-mattered").value =
    u.choicesMattered === true ? "true" : u.choicesMattered === false ? "false" : "";
  document.getElementById("favorite-toggle").checked = !!u.favorite;
  document.getElementById("notes").value = u.notes || "";
  renderRoutes();
  renderTags();
  renderCustomGenres();
}

function updateRatingRing(value) {
  const track = document.getElementById("rating-ring-track");
  const valueEl = document.getElementById("rating-ring-value");
  track.setAttribute("style", ratingRingStyle(value));
  valueEl.innerHTML = value > 0 ? `${value}<small>/ 10</small>` : `<small>Unrated</small>`;
}

function renderRoutes() {
  const wrap = document.getElementById("route-input-wrap");
  const input = document.getElementById("route-input");
  wrap.querySelectorAll(".tag-chip").forEach((el) => el.remove());
  routes.forEach((route, idx) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.innerHTML = `${escapeHtml(route)} <button type="button" aria-label="Remove route">&times;</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      routes.splice(idx, 1);
      renderRoutes();
    });
    wrap.insertBefore(chip, input);
  });
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

function renderCustomGenres() {
  const wrap = document.getElementById("genre-input-wrap");
  const input = document.getElementById("genre-input");
  wrap.querySelectorAll(".tag-chip").forEach((el) => el.remove());
  customGenres.forEach((genre, idx) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.innerHTML = `${escapeHtml(genre)} <button type="button" aria-label="Remove genre">&times;</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      customGenres.splice(idx, 1);
      renderCustomGenres();
    });
    wrap.insertBefore(chip, input);
  });
}

function bindForm() {
  const ratingInput = document.getElementById("my-rating");
  ratingInput.addEventListener("input", () => updateRatingRing(Number(ratingInput.value)));

  const routeInput = document.getElementById("route-input");
  routeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = routeInput.value.trim();
      if (val && !routes.includes(val)) {
        routes.push(val);
        renderRoutes();
      }
      routeInput.value = "";
    }
  });

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

  const genreInput = document.getElementById("genre-input");
  genreInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = genreInput.value.trim();
      if (val && !customGenres.some((g) => g.toLowerCase() === val.toLowerCase())) {
        customGenres.push(val);
        renderCustomGenres();
      }
      genreInput.value = "";
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
  const choicesVal = document.getElementById("choices-mattered").value;
  const patch = {
    myRating: rawRating > 0 ? rawRating : null,
    playStatus: document.getElementById("play-status").value,
    dateFinished: document.getElementById("date-finished").value || null,
    replayCount: Math.max(0, parseInt(document.getElementById("replay-count").value, 10) || 0),
    endingsUnlocked: Math.max(0, parseInt(document.getElementById("endings-unlocked").value, 10) || 0),
    platformPlayed: document.getElementById("platform-played").value.trim(),
    choicesMattered: choicesVal === "true" ? true : choicesVal === "false" ? false : null,
    favorite: document.getElementById("favorite-toggle").checked,
    notes: document.getElementById("notes").value.trim(),
    routesCompleted: routes,
    tags,
    customGenres,
  };

  saveBtn.disabled = true;
  const original = saveBtn.textContent;
  saveBtn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span>`;

  try {
    await updateGameUserFields(uid, docId, patch);
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
  const confirmed = window.confirm(`Remove "${item.rawg.title}" from your library? This can't be undone.`);
  if (!confirmed) return;

  const btn = document.getElementById("delete-btn");
  btn.disabled = true;
  try {
    await deleteGameItem(uid, docId);
    showToast("Removed from library.", "success");
    window.location.href = "games.html";
  } catch (err) {
    console.error(err);
    showToast("Couldn't remove game. Try again.", "error");
    btn.disabled = false;
  }
}

init();
