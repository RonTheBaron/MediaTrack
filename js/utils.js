/**
 * utils.js
 * ---------------------------------------------------------------------------
 * Small, dependency-free helpers shared across every page: debouncing,
 * formatting, escaping, and lazy image loading.
 * ---------------------------------------------------------------------------
 */

/** Delays invoking `fn` until `wait` ms have passed without another call. */
export function debounce(fn, wait = 300) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Escapes text for safe insertion into innerHTML. */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  const div = document.createElement("div");
  div.textContent = String(str);
  return div.innerHTML;
}

/** "142" minutes -> "2h 22m". Returns "—" if unknown. */
export function formatRuntime(minutes) {
  if (!minutes && minutes !== 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Formats large minute totals as "128h" or "5d 8h" for stats. */
export function formatWatchTime(totalMinutes) {
  if (!totalMinutes) return "0h";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/** "2016-07-08" -> "2016". Returns "—" if missing/invalid. */
export function yearFrom(dateStr) {
  if (!dateStr) return "—";
  const y = String(dateStr).slice(0, 4);
  return /^\d{4}$/.test(y) ? y : "—";
}

/** "2016-07-08" -> "Jul 8, 2016". Returns "—" if missing/invalid. */
export function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Turns a Firestore Timestamp (or ISO string) into a JS Date. */
export function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Combines TMDb genres with any genres the user has manually added,
 * de-duplicated and case-insensitively. Use this everywhere genres are
 * displayed, filtered, or tallied so custom genres count too.
 */
export function allGenres(item) {
  const tmdbGenres = item.tmdb?.genres || [];
  const customGenres = item.user?.customGenres || [];
  const seen = new Set();
  const combined = [];
  [...tmdbGenres, ...customGenres].forEach((g) => {
    const key = g.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    combined.push(g.trim());
  });
  return combined;
}

export const WATCH_STATUS_LABELS = {
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
  on_hold: "On Hold",
  plan_to_watch: "Plan to Watch",
};

/**
 * Sets up lazy-loading for <img data-src="..."> elements within a
 * container using IntersectionObserver, with a graceful fallback to
 * eager loading if it isn't supported.
 */
export function lazyLoadImages(container = document) {
  const targets = container.querySelectorAll("img[data-src]");
  if (!("IntersectionObserver" in window)) {
    targets.forEach((img) => activate(img));
    return;
  }
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "200px 0px" }
  );
  targets.forEach((img) => observer.observe(img));
}

function activate(img) {
  const src = img.getAttribute("data-src");
  if (!src) {
    img.closest(".media-card")?.classList.add("is-loaded");
    return;
  }
  const loader = new Image();
  loader.onload = () => {
    img.src = src;
    img.classList.add("is-loaded");
    img.closest(".media-card")?.classList.add("is-loaded");
  };
  loader.onerror = () => {
    img.closest(".media-card")?.classList.add("is-loaded");
  };
  loader.src = src;
}

/** Renders an SVG heart used for the favorite toggle. */
export function heartIcon() {
  return `<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>`;
}

/** Renders a small filled star used for rating badges. */
export function starIcon() {
  return `<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>`;
}

/** Builds a conic-gradient ring for a 0–10 rating (film-reel dial motif). */
export function ratingRingStyle(rating) {
  const pct = Math.max(0, Math.min(10, rating || 0)) / 10;
  const deg = Math.round(pct * 360);
  const color = rating >= 7 ? "var(--gold-bright)" : rating >= 4 ? "var(--teal)" : "var(--red)";
  return `background: conic-gradient(${color} ${deg}deg, var(--surface-2) ${deg}deg);`;
}
