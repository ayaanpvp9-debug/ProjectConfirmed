/** Tiny DOM + formatting helpers shared by every view. */

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Escape untrusted text before dropping it into an HTML template. */
export function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function cls(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function debounce(fn, wait = 300) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  wrapped.cancel = () => clearTimeout(timer);
  return wrapped;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(`academia.${key}`);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`academia.${key}`, JSON.stringify(value));
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(`academia.${key}`);
    } catch {
      /* ignore */
    }
  },
};

/* ----------------------------------------------------------------- dates */
const DAY = 86400000;

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function fmtDate(value, opts = {}) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    ...opts,
  }).format(d);
}

export function fmtLongDate(value = new Date()) {
  const d = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export function fmtTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function fmtDateTime(value) {
  return `${fmtDate(value)} · ${fmtTime(value)}`;
}

export function weekdayShort(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(value));
}

/** Human deadline ("in 3 days", "Tomorrow", "2 days overdue"). */
export function fmtDeadline(value) {
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "—";
  const diff = startOfDay(target) - startOfDay();
  const days = Math.round(diff / DAY);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < -1 && days > -14) return `${Math.abs(days)} days overdue`;
  if (days >= 7 && days < 14) return `In ${Math.round(days / 7)} week`;
  return fmtDate(target);
}

export function fmtRelative(value) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(value);
}

/** minutes → "1h 15m" */
export function fmtMinutes(total) {
  const mins = Math.max(0, Math.round(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  if (!m) return `${h}h`;
  return `${h}h ${m}m`;
}

export function toLocalInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export function dateInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/* ----------------------------------------------------------------- misc */
export function initials(name = "?") {
  const parts = String(name).trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function pct(part, total) {
  if (!total) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

/** Stable pastel tone per subject name. */
const TONES = ["blue", "violet", "mint", "amber", "rose"];
export function subjectTone(subject = "") {
  let hash = 0;
  for (let i = 0; i < subject.length; i += 1) hash = (hash * 31 + subject.charCodeAt(i)) % 997;
  return TONES[hash % TONES.length];
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Still awake";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
