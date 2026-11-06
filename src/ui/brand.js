import { esc } from "../lib/dom.js";

export function brandMark(size = 42, { animated = false } = {}) {
  return `
    <svg viewBox="0 0 48 48" width="${size}" height="${size}" fill="none" role="img" aria-label="ACADEMIA">
      <defs>
        <linearGradient id="brandGrad" x1="4" y1="2" x2="44" y2="46" gradientUnits="userSpaceOnUse">
          <stop stop-color="#a9c2ff"/>
          <stop offset="0.55" stop-color="#7fa2ff"/>
          <stop offset="1" stop-color="#c3a3ff"/>
        </linearGradient>
      </defs>
      <path d="M24 5.5 41 43h-9.6L24 21.8 16.6 43H7Z" fill="url(#brandGrad)" fill-opacity="0.16"
            stroke="url(#brandGrad)" stroke-width="2" stroke-linejoin="round" ${animated ? 'class="brand-path"' : ""}/>
      <path d="M17.4 33.4h13.2" stroke="#46e0d0" stroke-width="2" stroke-linecap="round"/>
      <circle cx="24" cy="24" r="20.5" stroke="rgba(255,255,255,0.14)" stroke-width="0.8" stroke-dasharray="2 7"/>
    </svg>`;
}

export function brandBlock({ tagline = "Student Workspace", size = 42 } = {}) {
  return `
    <div class="brand">
      <div class="brand__mark">${brandMark(size)}</div>
      <div class="brand__word">
        <span class="brand__name">${esc("ACADEMIA")}</span>
        <span class="brand__tag">${esc(tagline)}</span>
      </div>
    </div>`;
}

/** Orbit illustration used on the authentication stage. */
export function orbitArt() {
  return `
  <svg class="orbit" viewBox="0 0 400 400" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="orbitGrad" x1="30" y1="20" x2="370" y2="390" gradientUnits="userSpaceOnUse">
        <stop stop-color="#8fb0ff"/>
        <stop offset="0.5" stop-color="#c3a3ff"/>
        <stop offset="1" stop-color="#46e0d0"/>
      </linearGradient>
    </defs>
    <circle cx="200" cy="200" r="172" stroke-dasharray="1 9"/>
    <circle cx="200" cy="200" r="132"/>
    <ellipse cx="200" cy="200" rx="132" ry="52" transform="rotate(-24 200 200)"/>
    <ellipse cx="200" cy="200" rx="132" ry="52" transform="rotate(58 200 200)"/>
    <path class="orbit__accent" d="M200 28a172 172 0 0 1 121 50" stroke-linecap="round"/>
    <path class="orbit__accent" d="M200 372a172 172 0 0 1-121-50" stroke-linecap="round"/>
    <path class="orbit__accent" d="M352 268a172 172 0 0 1-61 74" stroke-linecap="round"/>
    <circle class="orbit__dot" cx="321" cy="78" r="3.4"/>
    <circle class="orbit__dot" cx="79" cy="322" r="2.6"/>
    <circle class="orbit__dot" cx="200" cy="28" r="2.2"/>
  </svg>`;
}
