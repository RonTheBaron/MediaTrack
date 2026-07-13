/**
 * nav.js
 * ---------------------------------------------------------------------------
 * Renders the shared top navigation bar into #app-nav on every
 * authenticated page, and wires up the logout button.
 * ---------------------------------------------------------------------------
 */
import { logOut } from "./auth.js";

/**
 * @param {'library'|'stats'} activePage
 * @param {import('firebase/auth').User} user
 */
export function renderNav(activePage, user) {
  const mount = document.getElementById("app-nav");
  if (!mount) return;

  mount.innerHTML = `
    <div class="navbar">
      <div class="container navbar__inner">
        <a href="library.html" class="navbar__brand">
          <span class="navbar__brand-mark" aria-hidden="true"></span>
          <span class="navbar__brand-text">Media Track</span>
        </a>
        <nav class="navbar__links">
          <a href="library.html" class="navbar__link ${activePage === "library" ? "is-active" : ""}">Library</a>
          <a href="stats.html" class="navbar__link ${activePage === "stats" ? "is-active" : ""}">Statistics</a>
        </nav>
        <div class="navbar__actions">
          <span class="navbar__email">${escapeHtml(user?.email || "")}</span>
          <button id="nav-logout-btn" class="btn btn-outline btn-sm">Log out</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("nav-logout-btn").addEventListener("click", () => {
    logOut();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
