/**
 * Shared view primitives: chart theming, progress rings, empty states.
 */
import Chart from "chart.js/auto";
import { icon } from "../lib/icons.js";
import { esc } from "../lib/dom.js";
import { gsap, prefersReduced, countTo } from "../lib/motion.js";

let themed = false;

export function themeCharts() {
  if (themed) return;
  themed = true;

  Chart.defaults.color = "rgba(43,55,82,0.78)";
  Chart.defaults.font.family = "'Inter', 'Sora', system-ui, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.font.weight = "400";
  Chart.defaults.borderColor = "rgba(15,23,42,0.08)";
  Chart.defaults.animation = { duration: prefersReduced() ? 0 : 900, easing: "easeOutQuart" };
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = "rgba(255,255,255,0.98)";
  Chart.defaults.plugins.tooltip.borderColor = "rgba(15,23,42,0.12)";
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.titleFont = { family: "'Sora', sans-serif", size: 11, weight: "500" };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'Inter', sans-serif", size: 11 };
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.displayColors = false;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.elements.point.radius = 0;
  Chart.defaults.elements.point.hoverRadius = 5;
  Chart.defaults.elements.point.hitRadius = 14;
}

/** Create a chart and register it for cleanup. */
export function makeChart(canvas, config, registry = []) {
  themeCharts();
  if (!canvas) return null;
  const chart = new Chart(canvas, config);
  registry.push(chart);
  return chart;
}

export function destroyCharts(registry = []) {
  registry.forEach((chart) => {
    try {
      chart.destroy();
    } catch {
      /* ignore */
    }
  });
  registry.length = 0;
}

export const gridScale = {
  x: { grid: { display: false }, border: { display: false }, ticks: { padding: 6 } },
  y: {
    beginAtZero: true,
    grid: { color: "rgba(15,23,42,0.06)" },
    border: { display: false },
    ticks: { padding: 8, maxTicksLimit: 4, precision: 0 },
  },
};

/** Vertical gradient fill for line charts. */
export function verticalGradient(context, from, to) {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return from;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  return gradient;
}

/* ---------------------------------------------------------------- rings */
const RING_RADIUS = 54;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

export function ringMarkup({ value = 0, label = "", id = "", size = 128 } = {}) {
  return `
    <div class="ring" style="max-width:${size}px">
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle class="ring__track" cx="64" cy="64" r="${RING_RADIUS}"/>
        <circle class="ring__fill" cx="64" cy="64" r="${RING_RADIUS}"
                stroke-dasharray="${RING_CIRC.toFixed(1)}"
                stroke-dashoffset="${RING_CIRC.toFixed(1)}"
                ${id ? `data-ring="${id}"` : ""}/>
      </svg>
      <div class="ring__center">
        <span class="ring__value" ${id ? `data-ring-value="${id}"` : ""}>0%</span>
        ${label ? `<span class="ring__label">${esc(label)}</span>` : ""}
      </div>
    </div>`;
}

export function animateRing(container, percent, { duration = 1.4, delay = 0.2 } = {}) {
  const circle = container.querySelector(".ring__fill");
  const label = container.querySelector(".ring__value");
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = RING_CIRC - (clamped / 100) * RING_CIRC;

  if (label) countTo(label, Math.round(clamped), { duration, suffix: "%" });

  if (!circle) return;
  if (prefersReduced()) {
    circle.style.strokeDashoffset = String(offset);
    return;
  }
  gsap.fromTo(
    circle,
    { strokeDashoffset: RING_CIRC },
    { strokeDashoffset: offset, duration, delay, ease: "power2.out" },
  );
}

/* ---------------------------------------------------------------- pieces */
export function emptyState({ iconName = "Sparkles", title = "", text = "", action = "" } = {}) {
  return `
    <div class="empty">
      <span class="empty__icon">${icon(iconName, { size: 22 })}</span>
      <h3 class="empty__title">${esc(title)}</h3>
      <p class="empty__text">${esc(text)}</p>
      ${action}
    </div>`;
}

export function loadingBlock(rows = 2) {
  return `
    <div class="view-loading">
      <div class="row">${'<div class="skeleton"></div>'.repeat(3)}</div>
      ${'<div class="skeleton" style="height:180px"></div>'.repeat(rows)}
    </div>`;
}

export function pageHead({ eyebrow = "", title = "", subtitle = "", actions = "" } = {}) {
  return `
    <header class="page-head">
      <div>
        ${eyebrow ? `<span class="eyebrow">${esc(eyebrow)}</span>` : ""}
        <h2 class="page-head__title">${title}</h2>
        ${subtitle ? `<p class="page-head__sub">${esc(subtitle)}</p>` : ""}
      </div>
      ${actions ? `<div class="page-head__actions">${actions}</div>` : ""}
    </header>`;
}

export function panel({ title = "", iconName = "", hint = "", body = "", flush = false, actions = "" } = {}) {
  return `
    <section class="panel">
      <header class="panel__head">
        <h3 class="panel__title">
          ${iconName ? icon(iconName, { size: 15 }) : ""}
          ${esc(title)}
        </h3>
        ${hint ? `<span class="panel__hint">${esc(hint)}</span>` : ""}
        ${actions}
      </header>
      <div class="panel__body ${flush ? "panel__body--flush" : ""}">${body}</div>
    </section>`;
}

export const CHART_COLORS = {
  blue: "#3861e8",
  blueSoft: "rgba(56,97,232,0.9)",
  violet: "#7a3ff0",
  cyan: "#0f766e",
  amber: "#b45309",
  rose: "#c22f72",
  mint: "#0b7a5a",
};

export function barGradient(context, color = "143,176,255") {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return `rgba(${color},0.85)`;
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, `rgba(${color},0.95)`);
  gradient.addColorStop(1, `rgba(${color},0.16)`);
  return gradient;
}
