/**
 * ACADEMIA · application bootstrap
 * The very first thing anyone sees is the authentication stage — there is no
 * public landing page.
 */
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/shell.css";
import "./styles/views.css";

import { supabase, fetchProfile } from "./lib/supabase.js";
import { renderAuth } from "./auth/authView.js";
import { mountWorkspace } from "./app/shell.js";
import { gsap, prefersReduced, ambientBackground, applyMotionDataset } from "./lib/motion.js";
import { icon } from "./lib/icons.js";
import { toast } from "./ui/toast.js";
import { setProfile, setSession } from "./lib/store.js";

const app = document.getElementById("app");
if (app) app.setAttribute("aria-busy", "true");

/** Shared SVG gradients referenced by rings, charts and the brand mark. */
function injectSvgDefs() {
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  holder.innerHTML = `
    <svg width="0" height="0" focusable="false">
      <defs>
        <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#5b8cff"/>
          <stop offset="0.55" stop-color="#8f8cff"/>
          <stop offset="1" stop-color="#c48cff"/>
        </linearGradient>
        <linearGradient id="mintGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#7bf1c5"/>
          <stop offset="1" stop-color="#46e0d0"/>
        </linearGradient>
        <linearGradient id="amberGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffd79a"/>
          <stop offset="1" stop-color="#ff9f6a"/>
        </linearGradient>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(143,176,255,0.95)"/>
          <stop offset="1" stop-color="rgba(143,176,255,0.18)"/>
        </linearGradient>
      </defs>
    </svg>`;
  document.body.appendChild(holder);
}

const bootMarkup = () => `
  <div class="boot" id="boot">
    <div class="boot__inner">
      <div class="boot__mark">${icon("GraduationCap", { size: 44, strokeWidth: 1.2 })}</div>
      <span class="boot__label">ACADEMIA</span>
      <span class="boot__bar"><span></span></span>
    </div>
  </div>`;

async function dismissBoot() {
  const boot = document.getElementById("boot");
  if (!boot) return;
  if (prefersReduced()) {
    boot.remove();
    return;
  }
  await new Promise((resolve) => {
    gsap.to(boot, {
      opacity: 0,
      duration: 0.55,
      ease: "power2.inOut",
      onComplete: () => {
        boot.remove();
        resolve();
      },
    });
  });
}

let mode = "boot";
let workspaceHandle = null;

async function showAuth() {
  mode = "auth";
  workspaceHandle?.destroy?.();
  workspaceHandle = null;
  app.setAttribute("aria-busy", "false");
  app.innerHTML = "";
  renderAuth(app, {
    onAuthed: async (user) => {
      try {
        await startApp(user);
      } catch (error) {
        console.error(error);
        toast.error("Could not open your workspace", error.message);
      }
    },
  });
}

async function startApp(user) {
  const profile = await fetchProfile(user.id);
  if (!profile) {
    await supabase.auth.signOut();
    toast.error("Profile missing", "That account has no student profile. Please register again.");
    await showAuth();
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  setSession(session);
  setProfile(profile);
  mode = "app";

  app.setAttribute("aria-busy", "false");
  app.innerHTML = "";
  workspaceHandle = await mountWorkspace(app, {
    profile,
    onSignOut: async () => {
      await supabase.auth.signOut();
      history.replaceState(null, "", location.pathname);
      workspaceHandle?.destroy?.();
      workspaceHandle = null;
      // the SIGNED_OUT listener may already have swapped to the auth screen
      if (mode !== "auth") await showAuth();
      toast.info("Signed out", "Your work is saved to your account.");
    },
  });

  if (!prefersReduced()) {
    gsap.fromTo(
      app.querySelector(".workspace"),
      { opacity: 0 },
      { opacity: 1, duration: 0.6, ease: "power2.out" },
    );
  }
}

async function boot() {
  injectSvgDefs();
  applyMotionDataset();
  ambientBackground();

  const boot = document.createElement("div");
  boot.innerHTML = bootMarkup();
  app.appendChild(boot.firstElementChild);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      try {
        await startApp(session.user);
      } catch (error) {
        console.warn("[academia] session restore failed", error);
        await supabase.auth.signOut();
        await showAuth();
      }
    } else {
      await showAuth();
    }
  } catch (error) {
    console.error("[academia] boot failed", error);
    await showAuth();
  }

  await dismissBoot();
  app.removeAttribute("aria-busy");
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT" && mode === "app") {
    workspaceHandle?.destroy?.();
    workspaceHandle = null;
    showAuth();
  }
});

window.addEventListener("error", (event) => {
  console.error("[academia] uncaught", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[academia] unhandled rejection", event.reason);
});

boot();
