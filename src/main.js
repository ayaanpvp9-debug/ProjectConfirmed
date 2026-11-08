/**
 * Ayaan Academia · application bootstrap
 *
 * Flow: public introduction page → authentication → workspace.
 * Visitors can read the landing page without an account; "Get Started" opens
 * the auth screen, or the workspace directly when a session already exists.
 */
import "./styles/base.css";
import "./styles/auth.css";
import "./styles/shell.css";
import "./styles/views.css";
import "./styles/landing.css";

import { supabase, fetchProfile } from "./lib/supabase.js";
import { renderAuth } from "./auth/authView.js";
import { renderLanding } from "./landing/landingView.js";
import { mountWorkspace } from "./app/shell.js";
import { gsap, prefersReduced, ambientBackground, applyMotionDataset } from "./lib/motion.js";
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
          <stop offset="0" stop-color="#3861e8"/>
          <stop offset="0.55" stop-color="#6b52e8"/>
          <stop offset="1" stop-color="#8a5cf0"/>
        </linearGradient>
        <linearGradient id="mintGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0b7a5a"/>
          <stop offset="1" stop-color="#0f766e"/>
        </linearGradient>
        <linearGradient id="amberGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#d97706"/>
          <stop offset="1" stop-color="#b45309"/>
        </linearGradient>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(56,97,232,0.95)"/>
          <stop offset="1" stop-color="rgba(56,97,232,0.18)"/>
        </linearGradient>
      </defs>
    </svg>`;
  document.body.appendChild(holder);
}

let mode = "boot"; // boot → landing → auth → app
let workspaceHandle = null;
let landingHandle = null;

/* Public introduction page — always the first screen, signed in or not. */
async function showLanding() {
  mode = "landing";
  workspaceHandle?.destroy?.();
  workspaceHandle = null;
  landingHandle?.();
  landingHandle = null;

  app.setAttribute("aria-busy", "false");
  app.innerHTML = "";
  window.scrollTo(0, 0);

  let signedIn = false;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    signedIn = Boolean(session?.user);
  } catch (error) {
    console.warn("[ayaan-academia] session check failed", error);
  }

  landingHandle = renderLanding(app, {
    signedIn,
    onGetStarted: handleGetStarted,
    onSignIn: () => showAuth(),
    onCreateAccount: () => showAuth({ initial: "register" }),
  });
}

/**
 * "Get Started" — a returning, still-signed-in student skips the login form and
 * lands straight in the workspace; everyone else gets the auth screen.
 */
async function handleGetStarted() {
  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session ?? null;
  } catch (error) {
    console.warn("[ayaan-academia] session check failed", error);
  }

  if (session?.user) {
    try {
      await startApp(session.user);
    } catch (error) {
      console.warn("[ayaan-academia] workspace restore failed", error);
      await supabase.auth.signOut().catch(() => {});
      await showAuth();
      return;
    }
    if (mode === "app" || mode === "auth") return;
  }

  await showAuth();
}

async function showAuth({ initial = "login" } = {}) {
  mode = "auth";
  landingHandle?.();
  landingHandle = null;
  workspaceHandle?.destroy?.();
  workspaceHandle = null;
  app.setAttribute("aria-busy", "false");
  app.innerHTML = "";
  window.scrollTo(0, 0);
  renderAuth(app, {
    initial,
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
  landingHandle?.();
  landingHandle = null;

  app.setAttribute("aria-busy", "false");
  window.scrollTo(0, 0);
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

  try {
    // Sessions no longer auto-open the workspace: the introduction page is the
    // first screen for everyone, and "Get Started" decides where to go.
    await showLanding();
  } catch (error) {
    console.error("[ayaan-academia] boot failed", error);
    await showAuth();
  }

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
  console.error("[ayaan-academia] uncaught", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[ayaan-academia] unhandled rejection", event.reason);
});

boot();
