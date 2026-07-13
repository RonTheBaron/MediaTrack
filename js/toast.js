/**
 * toast.js
 * ---------------------------------------------------------------------------
 * Minimal toast notification system. Call showToast() from anywhere; it
 * lazily creates its container on first use so pages don't need to
 * remember to add one to their HTML.
 * ---------------------------------------------------------------------------
 */

function getContainer() {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    document.body.appendChild(el);
  }
  return el;
}

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration ms before auto-dismiss
 */
export function showToast(message, type = "info", duration = 3500) {
  const container = getContainer();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");

  const icons = {
    success: "✓",
    error: "!",
    info: "i",
  };

  toast.innerHTML = `
    <span aria-hidden="true" style="font-weight:700;">${icons[type] || icons.info}</span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  const remove = () => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 180);
  };
  const timer = setTimeout(remove, duration);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
