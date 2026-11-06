import { gsap, prefersReduced, magnetic } from "../lib/motion.js";
import { icon } from "../lib/icons.js";
import { esc } from "../lib/dom.js";

/**
 * openModal({ title, subtitle, body, footer, wide, onMount })
 * Returns { close, element }.
 */
export function openModal({ title, subtitle = "", body = "", footer = "", wide = false, onMount } = {}) {
  const root = document.getElementById("modal-root");
  if (!root) return { close: () => {}, element: null };

  const layer = document.createElement("div");
  layer.className = "modal-layer";
  layer.setAttribute("role", "dialog");
  layer.setAttribute("aria-modal", "true");
  layer.setAttribute("aria-label", title ?? "Dialog");
  layer.innerHTML = `
    <div class="modal-scrim" data-close></div>
    <div class="modal ${wide ? "modal--wide" : ""}">
      <div class="modal__head">
        <div>
          <h2 class="modal__title">${esc(title ?? "")}</h2>
          ${subtitle ? `<p class="modal__sub">${esc(subtitle)}</p>` : ""}
        </div>
        <button class="icon-btn" data-close aria-label="Close dialog">${icon("X", { size: 17 })}</button>
      </div>
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__foot">${footer}</div>` : ""}
    </div>
  `;

  root.appendChild(layer);
  document.body.classList.add("is-locked");

  const modal = layer.querySelector(".modal");
  const previouslyFocused = document.activeElement;

  const close = () => {
    if (!layer.isConnected) return;
    const finish = () => {
      layer.remove();
      document.body.classList.remove("is-locked");
      document.removeEventListener("keydown", onKeydown);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
    if (prefersReduced()) {
      finish();
      return;
    }
    gsap.to(modal, { opacity: 0, y: 16, scale: 0.985, duration: 0.22, ease: "power2.in" });
    gsap.to(layer.querySelector(".modal-scrim"), { opacity: 0, duration: 0.24, onComplete: finish });
  };

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
    if (event.key !== "Tab") return;
    const focusable = layer.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  layer.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) close();
  });
  document.addEventListener("keydown", onKeydown);

  if (!prefersReduced()) {
    gsap.fromTo(layer.querySelector(".modal-scrim"), { opacity: 0 }, { opacity: 1, duration: 0.3 });
    gsap.fromTo(
      modal,
      { opacity: 0, y: 26, scale: 0.975 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "expo.out" },
    );
    gsap.fromTo(
      modal.querySelectorAll(".field, .modal__foot .btn"),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.04, delay: 0.08, ease: "power3.out" },
    );
  }

  modal.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));
  onMount?.({ layer, modal, close });

  const autofocus = modal.querySelector("[data-autofocus]");
  if (autofocus) setTimeout(() => autofocus.focus({ preventScroll: true }), 120);

  return { close, element: modal, layer };
}

/** Simple confirm dialog that resolves to a boolean. */
export function confirmDialog({
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm",
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      handle.close();
      resolve(value);
    };

    const handle = openModal({
      title,
      body: `<p style="font-size:13px;line-height:1.6;color:var(--muted)">${esc(message)}</p>`,
      footer: `
        <button class="btn btn--ghost" data-cancel>Cancel</button>
        <button class="btn ${danger ? "btn--danger" : "btn--primary"}" data-confirm>
          <span class="btn__label">${esc(confirmLabel)}</span>
        </button>
      `,
      onMount: ({ modal }) => {
        modal.querySelector("[data-cancel]").addEventListener("click", () => finish(false));
        modal.querySelector("[data-confirm]").addEventListener("click", () => finish(true));
        modal.addEventListener("click", (event) => {
          if (event.target.closest("[data-close]")) finish(false);
        });
      },
    });

    setTimeout(() => {
      if (!settled && !handle.layer?.isConnected) {
        settled = true;
        resolve(false);
      }
    }, 200);
  });
}
