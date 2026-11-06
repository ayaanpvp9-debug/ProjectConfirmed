import { gsap, prefersReduced } from "../lib/motion.js";
import { esc } from "../lib/dom.js";
import { icon } from "../lib/icons.js";

const ICONS = {
  success: "CheckCircle2",
  error: "AlertTriangle",
  info: "Info",
  sync: "RefreshCw",
};

/**
 * showToast({ title, message, type, duration })
 * Never throws — the app keeps working even if the toast layer is missing.
 */
export function showToast({ title, message = "", type = "info", duration = 3800 } = {}) {
  const stack = document.getElementById("toast-root");
  if (!stack) return;

  const node = document.createElement("div");
  node.className = `toast toast--${type}`;
  node.innerHTML = `
    <span class="toast__icon">${icon(ICONS[type] ?? ICONS.info, { size: 14 })}</span>
    <div class="toast__body">
      <strong>${esc(title)}</strong>
      ${message ? `<span>${esc(message)}</span>` : ""}
    </div>
    <span class="toast__bar"></span>
  `;
  stack.appendChild(node);

  if (prefersReduced()) {
    setTimeout(() => node.remove(), duration);
    return;
  }

  gsap.fromTo(
    node,
    { opacity: 0, y: 20, scale: 0.97 },
    { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "expo.out" },
  );

  const bar = node.querySelector(".toast__bar");
  gsap.fromTo(
    bar,
    { scaleX: 1 },
    { scaleX: 0, transformOrigin: "left center", duration: duration / 1000, ease: "none" },
  );

  setTimeout(() => {
    gsap.to(node, {
      opacity: 0,
      y: 8,
      scale: 0.98,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => node.remove(),
    });
  }, duration);
}

export const toast = {
  success: (title, message) => showToast({ title, message, type: "success" }),
  error: (title, message) => showToast({ title, message, type: "error", duration: 5200 }),
  info: (title, message) => showToast({ title, message, type: "info" }),
};
