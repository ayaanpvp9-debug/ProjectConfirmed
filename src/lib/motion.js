/**
 * ACADEMIA motion engine.
 * Every animated moment in the app routes through here so that the
 * "reduce motion" preference can switch everything off in one place.
 */
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { TextPlugin } from "gsap/TextPlugin";
import { store } from "./dom.js";

gsap.registerPlugin(ScrollTrigger, Flip, TextPlugin);

const systemReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
let userPreference = store.get("motion", null); // "reduce" | "full" | null

export function prefersReduced() {
  if (userPreference === "reduce") return true;
  if (userPreference === "full") return false;
  return systemReduced.matches;
}

export function setMotionPreference(value) {
  userPreference = value;
  store.set("motion", value);
  applyMotionDataset();
}

export function applyMotionDataset() {
  document.documentElement.dataset.motion = prefersReduced() ? "reduced" : "full";
  gsap.defaults({ ease: "power3.out" });
  gsap.ticker.lagSmoothing(320, 33);
}

applyMotionDataset();

/** Scale a duration to 0 when reduced motion is requested. */
export const dur = (value) => (prefersReduced() ? 0.001 : value);

export { gsap, ScrollTrigger, Flip };

/* ---------------------------------------------------------------- splitting */
/**
 * Split an element's text into per-character spans (keeps word grouping so
 * lines never break mid-word). Returns the character elements.
 */
export function splitChars(element, { words = true } = {}) {
  if (!element) return [];
  const text = element.textContent ?? "";
  element.textContent = "";
  const chars = [];
  const chunks = text.split(/(\s+)/);

  chunks.forEach((chunk) => {
    if (!chunk) return;
    if (!chunk.trim()) {
      element.appendChild(document.createTextNode(" "));
      return;
    }
    const host = document.createElement("span");
    host.className = words ? "word" : "char";
    if (!words) {
      host.textContent = chunk;
      element.appendChild(host);
      chars.push(host);
      return;
    }
    Array.from(chunk).forEach((character) => {
      const span = document.createElement("span");
      span.className = "char";
      span.textContent = character;
      host.appendChild(span);
      chars.push(span);
    });
    element.appendChild(host);
  });

  return chars;
}

/** Character-by-character reveal. */
export function revealChars(element, { delay = 0, stagger = 0.018, duration = 0.85, y = 26 } = {}) {
  const chars = splitChars(element);
  if (!chars.length) return gsap.timeline();
  if (prefersReduced()) {
    gsap.set(chars, { opacity: 1, y: 0 });
    return gsap.timeline();
  }
  return gsap.fromTo(
    chars,
    { yPercent: 118, opacity: 0, rotate: 3 },
    {
      yPercent: 0,
      opacity: 1,
      rotate: 0,
      duration,
      delay,
      stagger,
      ease: "expo.out",
    },
  );
}

export function revealLines(elements, { stagger = 0.09, y = 22, delay = 0, duration = 0.8 } = {}) {
  const list = Array.isArray(elements) ? elements : [elements];
  if (!list.length) return gsap.timeline();
  if (prefersReduced()) {
    gsap.set(list, { opacity: 1, y: 0 });
    return gsap.timeline();
  }
  return gsap.fromTo(
    list,
    { opacity: 0, y },
    { opacity: 1, y: 0, duration, delay, stagger, ease: "expo.out" },
  );
}

/* ---------------------------------------------------------------- numbers */
export function countTo(element, value, { duration = 1.1, decimals = 0, suffix = "", prefix = "" } = {}) {
  if (!element) return;
  const target = Number(value) || 0;
  const formatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (prefersReduced()) {
    element.textContent = `${prefix}${formatter.format(target)}${suffix}`;
    return;
  }

  const state = { value: 0 };
  gsap.to(state, {
    value: target,
    duration,
    ease: "power2.out",
    onUpdate: () => {
      element.textContent = `${prefix}${formatter.format(state.value)}${suffix}`;
    },
    onComplete: () => {
      element.textContent = `${prefix}${formatter.format(target)}${suffix}`;
    },
  });
}

/** Animate a horizontal progress bar (width %) plus an optional label. */
export function animateBar(fillEl, percent, { duration = 1.2, labelEl = null, from = 0 } = {}) {
  if (!fillEl) return gsap.timeline();
  const to = Math.max(0, Math.min(100, percent));
  const tl = gsap.timeline();

  if (prefersReduced()) {
    gsap.set(fillEl, { width: `${to}%` });
    if (labelEl) labelEl.textContent = `${Math.round(to)}%`;
    return tl;
  }

  tl.fromTo(
    fillEl,
    { width: `${from}%` },
    {
      width: `${to}%`,
      duration,
      ease: "power3.out",
      onUpdate: () => {
        if (labelEl) {
          const current = Number.parseFloat(fillEl.style.width) || 0;
          labelEl.textContent = `${Math.round(current)}%`;
        }
      },
    },
  );

  tl.fromTo(
    fillEl,
    { boxShadow: "0 0 0 rgba(120,150,255,0)" },
    { boxShadow: "0 0 30px rgba(120,150,255,0.55)", duration: 0.4, yoyo: true, repeat: 1 },
    0,
  );

  return tl;
}

/* ---------------------------------------------------------------- magnetic */
/** Magnetic pointer-follow for premium buttons (desktop pointers only). */
export function magnetic(element, { strength = 0.32, scale = 1.02 } = {}) {
  if (!element) return () => {};
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  if (prefersReduced() || !fine.matches) return () => {};

  const label = element.querySelector(".btn__label") ?? element;
  const xTo = gsap.quickTo(element, "x", { duration: 0.5, ease: "power3.out" });
  const yTo = gsap.quickTo(element, "y", { duration: 0.5, ease: "power3.out" });
  const lxTo = gsap.quickTo(label, "x", { duration: 0.7, ease: "power3.out" });
  const lyTo = gsap.quickTo(label, "y", { duration: 0.7, ease: "power3.out" });

  const onMove = (event) => {
    const rect = element.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    xTo(dx * strength);
    yTo(dy * strength);
    lxTo(dx * strength * 0.35);
    lyTo(dy * strength * 0.35);
  };

  const onEnter = () => gsap.to(element, { scale, duration: 0.35, ease: "power3.out" });
  const onLeave = () => {
    xTo(0);
    yTo(0);
    lxTo(0);
    lyTo(0);
    gsap.to(element, { scale: 1, duration: 0.5, ease: "elastic.out(1, 0.6)" });
  };

  element.addEventListener("pointermove", onMove);
  element.addEventListener("pointerenter", onEnter);
  element.addEventListener("pointerleave", onLeave);

  return () => {
    element.removeEventListener("pointermove", onMove);
    element.removeEventListener("pointerenter", onEnter);
    element.removeEventListener("pointerleave", onLeave);
  };
}

export function magnetiseAll(root = document) {
  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));
}

/* ---------------------------------------------------------------- svg */
/** Draw SVG strokes in sequence (brand marks, rings, charts). */
export function drawStrokes(targets, { duration = 1.4, stagger = 0.12, delay = 0.1 } = {}) {
  const list = Array.from(targets ?? []);
  if (!list.length) return gsap.timeline();
  if (prefersReduced()) return gsap.timeline();
  return gsap.fromTo(
    list,
    { strokeDasharray: 400, strokeDashoffset: 400, opacity: 0 },
    {
      strokeDashoffset: 0,
      opacity: 1,
      duration,
      delay,
      stagger,
      ease: "power2.inOut",
    },
  );
}

export function pulseOnce(element, { color = "rgba(123,241,197,0.35)" } = {}) {
  if (!element || prefersReduced()) return;
  gsap.fromTo(
    element,
    { boxShadow: `0 0 0 0 ${color}` },
    { boxShadow: "0 0 0 16px rgba(123,241,197,0)", duration: 0.9, ease: "power2.out" },
  );
}

/* ---------------------------------------------------------------- ambient */
export function ambientBackground() {
  if (prefersReduced()) return;
  const blobs = document.querySelectorAll(".aurora");
  blobs.forEach((blob, index) => {
    gsap.to(blob, {
      x: `random(-90, 90)`,
      y: `random(-70, 70)`,
      scale: `random(0.9, 1.15)`,
      duration: 22 + index * 5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
      delay: index * 1.5,
    });
  });
}

/* ---------------------------------------------------------------- scroll */
export function killScrollTriggers() {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
}

/**
 * Reveal panels as they scroll into the workspace viewport.
 * Uses the inner scroll container so ScrollTrigger stays in sync.
 */
export function scrollReveal(targets, { y = 26, stagger = 0.07, start = "top 92%" } = {}) {
  const list = Array.from(targets ?? []);
  if (!list.length) return;

  if (prefersReduced()) {
    gsap.set(list, { opacity: 1, y: 0 });
    return;
  }

  const scroller = document.querySelector("#view-scroll");
  list.forEach((element) => {
    gsap.set(element, { opacity: 0, y });
    ScrollTrigger.create({
      trigger: element,
      scroller: scroller || undefined,
      start,
      once: true,
      onEnter: () =>
        gsap.to(element, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          delay: (list.indexOf(element) % 4) * stagger,
          ease: "expo.out",
          overwrite: "auto",
        }),
    });
  });
  ScrollTrigger.refresh();
}

/* ---------------------------------------------------------------- transitions */
/** Entrance choreography used whenever a workspace view mounts. */
export function enterView(root) {
  if (!root) return gsap.timeline();
  const head = root.querySelectorAll(".page-head, .hw-progress, .panel, .kpi, .subject-card, .book-card, .session, .test-row");
  if (prefersReduced()) {
    gsap.set(head, { opacity: 1, y: 0 });
    return gsap.timeline();
  }

  const tl = gsap.timeline();
  tl.fromTo(
    root,
    { opacity: 0 },
    { opacity: 1, duration: 0.35, ease: "power2.out" },
  ).fromTo(
    head,
    { opacity: 0, y: 24, scale: 0.995 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.8,
      stagger: { each: 0.045, from: "start" },
      ease: "expo.out",
      clearProps: "transform",
    },
    "-=0.15",
  );

  return tl;
}

/** Fade a container out; returns a promise so routing can await it. */
export function exitView(element) {
  if (!element) return Promise.resolve();
  if (prefersReduced()) return Promise.resolve();
  return new Promise((resolve) => {
    gsap.to(element, {
      opacity: 0,
      y: -14,
      duration: 0.24,
      ease: "power2.in",
      onComplete: resolve,
    });
  });
}

/** FLIP a layout change (e.g. filtering assignment cards). */
export function flipLayout(container, mutate) {
  if (!container || prefersReduced()) {
    mutate();
    return;
  }
  const state = Flip.getState(container.children);
  mutate();
  Flip.from(state, {
    duration: 0.55,
    ease: "power3.out",
    stagger: 0.015,
    absolute: true,
    scale: true,
    onEnter: (els) =>
      gsap.fromTo(els, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.45 }),
    onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.94, duration: 0.25 }),
  });
}
