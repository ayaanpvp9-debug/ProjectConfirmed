/**
 * Persistent application shell: sidebar, topbar, view router, notifications.
 */
import { supabase } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import { brandMark } from "../ui/brand.js";
import { APP } from "../lib/config.js";
import { showToast } from "../ui/toast.js";
import { confirmDialog } from "../ui/modal.js";
import {
  gsap,
  prefersReduced,
  enterView,
  exitView,
  killScrollTriggers,
  ambientBackground,
  magnetic,
} from "../lib/motion.js";
import {
  esc,
  fmtLongDate,
  fmtRelative,
  initials,
  isTypingTarget,
} from "../lib/dom.js";
import { displayName, on, emit, state } from "../lib/store.js";

const NAV = [
  { id: "overview", label: "Overview", icon: "LayoutDashboard", crumb: "Workspace", title: "Overview" },
  { id: "homework", label: "Homework", icon: "ClipboardList", crumb: "Organise", title: "Homework Manager" },
  { id: "planner", label: "Study Planner", icon: "CalendarClock", crumb: "Organise", title: "Study Planner" },
  { id: "ncert", label: "NCERT Books", icon: "BookOpen", crumb: "Library", title: "NCERT Library" },
  { id: "mocks", label: "Mock Tests", icon: "Target", crumb: "Exams", title: "Mock Tests" },
  { id: "performance", label: "Performance", icon: "ChartLine", crumb: "Insights", title: "Performance" },
  { id: "settings", label: "Settings", icon: "Settings", crumb: "Account", title: "Settings" },
];

const MOBILE_NAV = ["overview", "homework", "planner", "ncert", "mocks"];

const loaders = {
  overview: () => import("../views/overview.js"),
  homework: () => import("../views/homework.js"),
  planner: () => import("../views/planner.js"),
  ncert: () => import("../views/ncert.js"),
  mocks: () => import("../views/mocks.js"),
  performance: () => import("../views/performance.js"),
  settings: () => import("../views/settings.js"),
};

const shellTemplate = () => `
  <div class="workspace" data-sidebar="expanded" data-drawer="closed">
    <button class="sidebar__scrim" data-drawer-close aria-label="Close navigation"></button>

    <aside class="sidebar" aria-label="Primary navigation">
      <div class="sidebar__head">
        <div class="brand">
          <div class="brand__mark">${brandMark(34)}</div>
          <div class="brand__word">
            <span class="brand__name">${esc(APP.name)}</span>
            <span class="brand__tag">Student OS</span>
          </div>
        </div>
        <button class="sidebar__collapse" data-collapse aria-label="Toggle sidebar width">
          ${icon("PanelLeftClose", { size: 15 })}
        </button>
      </div>

      <span class="sidebar__label">Workspace</span>
      <nav class="sidebar__nav">
        <span class="nav-pill" data-pill aria-hidden="true"></span>
        ${NAV.map(
          (item) => `
          <button class="nav-item" data-nav="${item.id}" aria-current="false" title="${item.label}">
            ${icon(item.icon, { size: 17 })}
            <span class="nav-item__text">${item.label}</span>
            ${item.id === "homework" ? '<span class="nav-item__count" data-hw-count hidden></span>' : ""}
          </button>`,
        ).join("")}
      </nav>

      <div class="sidebar__foot">
        <button class="profile-card" data-profile-card>
          <span class="avatar" data-avatar>${initials(displayName())}</span>
          <span class="profile-card__meta">
            <span class="profile-card__name" data-profile-name>${esc(displayName())}</span>
            <span class="profile-card__sub" data-profile-sub>Student</span>
          </span>
        </button>
      </div>
    </aside>

    <div class="workspace__main">
      <header class="topbar">
        <button class="icon-btn topbar__menu" data-drawer-open aria-label="Open navigation">
          ${icon("Menu", { size: 18 })}
        </button>
        <div class="topbar__titles">
          <span class="topbar__crumb" data-crumb>Workspace</span>
          <h1 class="topbar__title" data-title>Overview</h1>
        </div>
        <div class="topbar__spacer"></div>
        <div class="topbar__actions">
          <span class="date-chip">${icon("CalendarDays", { size: 13 })}${esc(fmtLongDate())}</span>
          <div style="position:relative">
            <button class="icon-btn bell" data-notifications aria-label="Notifications" aria-expanded="false">
              ${icon("Bell", { size: 17 })}
              <span class="bell__dot" data-bell-dot hidden></span>
            </button>
          </div>
          <div style="position:relative">
            <button class="avatar avatar--sm" data-avatar-menu aria-label="Account menu" style="cursor:pointer;border:0">
              ${initials(displayName())}
            </button>
          </div>
        </div>
      </header>

      <div class="view-scroll" id="view-scroll">
        <section class="view" id="view" aria-live="polite"></section>
      </div>

      <nav class="mobile-nav" aria-label="Quick navigation">
        ${MOBILE_NAV.map((id) => {
          const item = NAV.find((n) => n.id === id);
          return `<button data-nav="${item.id}" aria-current="false">
              ${icon(item.icon, { size: 18 })}
              <span>${item.label.split(" ")[0]}</span>
            </button>`;
        }).join("")}
      </nav>
    </div>
  </div>
`;

export async function mountWorkspace(root, { profile, onSignOut }) {
  root.innerHTML = shellTemplate();

  const workspace = root.querySelector(".workspace");
  const viewEl = root.querySelector("#view");
  const scroller = root.querySelector("#view-scroll");
  const navButtons = Array.from(root.querySelectorAll(".nav-item"));
  const mobileButtons = Array.from(root.querySelectorAll(".mobile-nav button"));
  const pill = root.querySelector("[data-pill]");
  const titleEl = root.querySelector("[data-title]");
  const crumbEl = root.querySelector("[data-crumb]");

  let current = null;
  let cleanup = null;
  let navigating = false;
  let popover = null;

  const navMeta = (id) => NAV.find((item) => item.id === id) ?? NAV[0];
  const drawerOpen = () => workspace.dataset.drawer === "open";

  /* --------------------------------------------------------- nav visuals */
  function paintNav() {
    root.querySelectorAll("[data-nav]").forEach((button) => {
      button.setAttribute("aria-current", button.dataset.nav === current ? "page" : "false");
    });
  }

  function movePill() {
    if (current === null) return;
    const active = root.querySelector(`.nav-item[data-nav="${current}"]`);
    if (!active) return;
    const target = { y: active.offsetTop, height: active.offsetHeight };
    if (prefersReduced()) {
      gsap.set(pill, target);
      return;
    }
    gsap.to(pill, { ...target, duration: 0.5, ease: "expo.out" });
  }

  /* ------------------------------------------------------------- popovers */
  function closePopovers() {
    popover?.remove();
    popover = null;
    root.querySelector("[data-notifications]")?.setAttribute("aria-expanded", "false");
  }

  document.addEventListener("click", (event) => {
    if (!popover) return;
    if (popover.contains(event.target)) return;
    if (event.target.closest("[data-notifications],[data-avatar-menu]")) return;
    closePopovers();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopovers();
      if (drawerOpen()) workspace.dataset.drawer = "closed";
    }
    if (isTypingTarget(event.target)) return;
    // quick nav: alt + 1…7
    if (event.altKey && /^[1-7]$/.test(event.key)) {
      event.preventDefault();
      navigate(NAV[Number(event.key) - 1].id);
    }
  });

  async function openNotifications() {
    const trigger = root.querySelector("[data-notifications]");
    const anchor = trigger.parentElement;
    closePopovers();
    trigger.setAttribute("aria-expanded", "true");

    popover = document.createElement("div");
    popover.className = "popover";
    popover.innerHTML = `
      <div class="popover__head">
        <span class="popover__title">Activity</span>
        ${icon("RefreshCw", { size: 13, class: "spin" })}
      </div>
      <div class="popover__list"><div class="skeleton" style="height:42px;margin:4px"></div></div>
    `;
    anchor.appendChild(popover);
    if (!prefersReduced()) {
      gsap.fromTo(popover, { opacity: 0, y: -8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: "expo.out" });
    }

    const { data, error } = await supabase
      .from("activity_events")
      .select("id, kind, title, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(8);

    if (!popover.isConnected) return;
    const list = popover.querySelector(".popover__list");

    if (error || !data?.length) {
      list.innerHTML = `
        <div class="empty" style="padding:1.4rem 0.5rem">
          <span class="empty__icon">${icon("Inbox", { size: 20 })}</span>
          <span class="empty__text">No activity yet. Create your first assignment to get started.</span>
        </div>`;
      return;
    }

    const kindIcon = {
      homework: "ClipboardList",
      homework_done: "CheckCircle2",
      session: "CalendarClock",
      session_done: "CheckCheck",
      test: "Target",
      account: "Sparkles",
      study: "BookOpen",
    };

    list.innerHTML = data
      .map(
        (item) => `
        <div class="popover__item">
          <span class="popover__icon">${icon(kindIcon[item.kind] ?? "Activity", { size: 13 })}</span>
          <span class="popover__text">
            <strong>${esc(item.title)}</strong>
            <span>${esc(fmtRelative(item.created_at))}${item.detail ? ` · ${esc(item.detail)}` : ""}</span>
          </span>
        </div>`,
      )
      .join("");
  }

  function openAccountMenu() {
    const trigger = root.querySelector("[data-avatar-menu]");
    const anchor = trigger.parentElement;
    closePopovers();

    popover = document.createElement("div");
    popover.className = "popover";
    popover.style.width = "220px";
    popover.innerHTML = `
      <div class="popover__head" style="padding-bottom:0.35rem">
        <span class="popover__title">${esc(displayName())}</span>
        <span class="badge">${esc(profile.class_level ? `Class ${profile.class_level}` : "Student")}</span>
      </div>
      <div class="menu" style="border:0;box-shadow:none;background:transparent;padding:0">
        <button data-go-settings>${icon("Settings", { size: 15 })}Account settings</button>
        <button data-sign-out class="is-danger">${icon("LogOut", { size: 15 })}Sign out</button>
      </div>
    `;
    anchor.appendChild(popover);
    if (!prefersReduced()) {
      gsap.fromTo(popover, { opacity: 0, y: -8, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "expo.out" });
    }

    popover.querySelector("[data-go-settings]").addEventListener("click", () => {
      closePopovers();
      navigate("settings");
    });
    popover.querySelector("[data-sign-out]").addEventListener("click", async () => {
      closePopovers();
      const confirmed = await confirmDialog({
        title: `Sign out of ${APP.name}?`,
        message: "Your work is saved to your account. You can sign back in with your username.",
        confirmLabel: "Sign out",
        danger: true,
      });
      if (confirmed) await onSignOut();
    });
  }

  /* ------------------------------------------------------------- router */
  async function navigate(id, { replace = false, fromHash = false } = {}) {
    if (!loaders[id]) id = "overview";
    if (navigating) return;
    if (id === current) {
      workspace.dataset.drawer = "closed";
      return;
    }

    navigating = true;
    const meta = navMeta(id);
    const previous = current;
    current = id;

    paintNav();
    movePill();
    titleEl.textContent = meta.title;
    crumbEl.textContent = meta.crumb;
    workspace.dataset.drawer = "closed";
    closePopovers();

    if (!fromHash) {
      const hash = `#/${id}`;
      if (location.hash !== hash) {
        if (replace) history.replaceState(null, "", hash);
        else history.pushState(null, "", hash);
      }
    }

    try {
      if (previous) {
        await exitView(viewEl);
        cleanup?.();
        cleanup = null;
      }
      killScrollTriggers();
      viewEl.innerHTML = "";
      viewEl.style.opacity = "1";
      viewEl.style.transform = "none";
      scroller.scrollTop = 0;
      state.view = id;

      const module = await loaders[id]();
      cleanup = (await module.render(viewEl, ctx)) ?? null;
      enterView(viewEl);
      emit("view:changed", id);
    } catch (error) {
      console.error("[ayaan-academia] view failed", error);
      viewEl.innerHTML = `
        <div class="empty">
          <span class="empty__icon">${icon("AlertTriangle", { size: 22 })}</span>
          <h3 class="empty__title">This section could not load</h3>
          <p class="empty__text">${esc(error.message ?? "Unexpected error")}</p>
          <button class="btn" data-retry>${icon("RefreshCw", { size: 15 })}<span class="btn__label">Retry</span></button>
        </div>`;
      viewEl.querySelector("[data-retry]")?.addEventListener("click", () => {
        const retryId = current;
        current = null;
        navigate(retryId);
      });
    } finally {
      navigating = false;
    }
  }

  function onHashChange() {
    const id = location.hash.replace(/^#\//, "");
    if (loaders[id] && id !== current) navigate(id, { fromHash: true });
  }
  window.addEventListener("hashchange", onHashChange);

  const ctx = {
    get profile() {
      return profile;
    },
    navigate,
    refreshProfile,
    signOut: onSignOut,
    toast: showToast,
    onHomeworkChanged: () => refreshHomeworkBadge(),
    openModal: null,
  };

  /* --------------------------------------------------------- profile UI */
  async function refreshProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, email, phone, display_name, class_level, accent, created_at")
      .eq("id", profile.id)
      .maybeSingle();
    if (data) {
      Object.assign(profile, data);
      syncProfileUI();
    }
    return data;
  }

  function syncProfileUI() {
    const name = displayName();
    root.querySelectorAll("[data-profile-name]").forEach((el) => (el.textContent = name));
    root.querySelectorAll("[data-avatar], .avatar--sm").forEach((el) => {
      if (el.classList.contains("avatar")) el.textContent = initials(name);
    });
    const sub = root.querySelector("[data-profile-sub]");
    if (sub) sub.textContent = profile.class_level ? `Class ${profile.class_level}` : "Student";
  }

  async function refreshHomeworkBadge() {
    const { count } = await supabase
      .from("homework")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "pending");
    const badge = root.querySelector("[data-hw-count]");
    if (!badge) return;
    if (count) {
      badge.hidden = false;
      badge.textContent = String(count);
    } else {
      badge.hidden = true;
    }
  }

  async function checkUnread() {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count } = await supabase
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    const dot = root.querySelector("[data-bell-dot]");
    if (dot) dot.hidden = !count;
  }

  /* -------------------------------------------------------------- wiring */
  root.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.nav));
  });

  root.querySelector("[data-collapse]").addEventListener("click", () => {
    workspace.dataset.sidebar = workspace.dataset.sidebar === "compact" ? "expanded" : "compact";
    setTimeout(movePill, prefersReduced() ? 0 : 320);
  });
  root.querySelector("[data-drawer-open]").addEventListener("click", () => {
    workspace.dataset.drawer = "open";
  });
  root.querySelector("[data-drawer-close]").addEventListener("click", () => {
    workspace.dataset.drawer = "closed";
  });
  root.querySelector("[data-profile-card]").addEventListener("click", () => navigate("settings"));
  root.querySelector("[data-notifications]").addEventListener("click", () => {
    if (popover && root.querySelector("[data-notifications]").getAttribute("aria-expanded") === "true") {
      closePopovers();
    } else {
      openNotifications();
    }
  });
  root.querySelector("[data-avatar-menu]").addEventListener("click", () => {
    if (popover) closePopovers();
    else openAccountMenu();
  });

  window.addEventListener("resize", movePill);

  const offBadge = on("homework:changed", () => refreshHomeworkBadge());
  const offProfile = on("profile:changed", () => syncProfileUI());

  syncProfileUI();
  refreshHomeworkBadge();
  checkUnread();
  ambientBackground();
  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));

  const hashView = location.hash.replace(/^#\//, "");
  const initial = loaders[hashView] ? hashView : "overview";
  await navigate(initial, { replace: true });

  return {
    navigate,
    refreshProfile,
    destroy() {
      cleanup?.();
      offBadge();
      offProfile();
      killScrollTriggers();
      window.removeEventListener("resize", movePill);
      window.removeEventListener("hashchange", onHashChange);
    },
  };
}
