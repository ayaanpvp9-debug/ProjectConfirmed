/**
 * Settings — profile, security, preferences and demonstration data controls.
 */
import { supabase } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import { SUBJECTS } from "../lib/config.js";
import { esc, initials, fmtDate } from "../lib/dom.js";
import { showToast } from "../ui/toast.js";
import { confirmDialog } from "../ui/modal.js";
import {
  gsap,
  prefersReduced,
  setMotionPreference,
  scrollReveal,
  killScrollTriggers,
  magnetic,
} from "../lib/motion.js";
import { pageHead, panel } from "./_shared.js";

const DEMO_PREFIX = "[Demo]";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const PHONE_RE = /^\+?[0-9]{10,15}$/;

export async function render(root, ctx) {
  const profile = ctx.profile;

  root.innerHTML = `
    ${pageHead({
      eyebrow: "Account",
      title: "Settings",
      subtitle: "Your profile, security and workspace preferences.",
      actions: `<button class="btn btn--sm btn--danger" data-sign-out>${icon("LogOut", { size: 15 })}<span class="btn__label">Sign out</span></button>`,
    })}

    <div class="settings-grid">
      <section class="panel">
        <header class="panel__head">
          <h3 class="panel__title">${icon("UserRound", { size: 15 })}Student profile</h3>
          <span class="panel__hint">private</span>
        </header>
        <div class="panel__body">
          <div class="profile-hero">
            <span class="avatar" data-hero-avatar>${esc(initials(profile.display_name || profile.username))}</span>
            <div>
              <div class="profile-hero__name" data-hero-name>${esc(profile.display_name || profile.username)}</div>
              <div class="profile-hero__meta">
                @${esc(profile.username)} · ${esc(profile.class_level ? `class ${profile.class_level}` : "class not set")} · joined ${esc(fmtDate(profile.created_at, { year: "numeric" }))}
              </div>
            </div>
          </div>

          <form class="form-grid" data-profile-form novalidate>
            <div class="field" data-name="display_name">
              <label class="field__label" for="st-name">Display name</label>
              <div class="input-shell">
                ${icon("UserRound", { size: 17 })}
                <input class="input input--with-icon" id="st-name" name="display_name" maxlength="60"
                       value="${esc(profile.display_name ?? "")}" placeholder="Your name" />
              </div>
            </div>

            <div class="field" data-name="class_level">
              <label class="field__label" for="st-class">Class</label>
              <div class="input-shell">
                ${icon("GraduationCap", { size: 17 })}
                <select class="input input--with-icon" id="st-class" name="class_level">
                  <option value="">Not set</option>
                  ${Array.from({ length: 12 }, (_, index) => index + 1)
                    .map((level) => `<option value="${level}" ${profile.class_level === level ? "selected" : ""}>Class ${level}</option>`)
                    .join("")}
                </select>
              </div>
            </div>

            <div class="field" data-name="username">
              <label class="field__label" for="st-username">Username</label>
              <div class="input-shell">
                ${icon("AtSign", { size: 17 })}
                <input class="input input--with-icon" id="st-username" name="username" maxlength="20" spellcheck="false"
                       value="${esc(profile.username)}" />
              </div>
              <span class="field__hint">Used to sign in — 3–20 letters, numbers, underscore.</span>
              <span class="field__error" data-error></span>
            </div>

            <div class="field" data-name="phone">
              <label class="field__label" for="st-phone">Phone</label>
              <div class="input-shell">
                ${icon("Smartphone", { size: 17 })}
                <input class="input input--with-icon" id="st-phone" name="phone" inputmode="tel"
                       value="${esc(profile.phone)}" />
              </div>
              <span class="field__hint">Unique · stored only on your profile.</span>
              <span class="field__error" data-error></span>
            </div>

            <div class="field span-2" data-name="email">
              <label class="field__label" for="st-email">Email</label>
              <div class="input-shell">
                ${icon("Mail", { size: 17 })}
                <input class="input input--with-icon" id="st-email" name="email" value="${esc(profile.email)}" disabled />
              </div>
              <span class="field__hint">Email is locked to protect account recovery. Contact support to change it.</span>
            </div>

            <div class="span-2" style="display:flex;justify-content:flex-end;gap:0.5rem">
              <button class="btn btn--primary btn--sm" type="submit" data-magnetic>
                <span class="btn__spinner"></span>
                <span class="btn__label">Save profile</span>
              </button>
            </div>
          </form>
        </div>
      </section>

      <div class="dash-stack">
        <section class="panel">
          <header class="panel__head">
            <h3 class="panel__title">${icon("KeyRound", { size: 15 })}Security</h3>
          </header>
          <div class="panel__body">
            <form data-password-form novalidate style="display:grid;gap:0.8rem">
              <div class="field" data-name="password">
                <label class="field__label" for="st-password">New password</label>
                <div class="input-shell">
                  ${icon("Lock", { size: 17 })}
                  <input class="input input--with-icon" id="st-password" name="password" type="password"
                         autocomplete="new-password" placeholder="At least 8 characters" />
                  <span class="input-affix">
                    <button type="button" data-toggle-password aria-label="Show password">${icon("Eye", { size: 16 })}</button>
                  </span>
                </div>
                <div class="strength" data-strength data-level="0">
                  <div class="strength__bars">
                    <span class="strength__bar"><span></span></span>
                    <span class="strength__bar"><span></span></span>
                    <span class="strength__bar"><span></span></span>
                    <span class="strength__bar"><span></span></span>
                  </div>
                </div>
                <span class="field__error" data-error></span>
              </div>

              <div class="field" data-name="confirm">
                <label class="field__label" for="st-confirm">Confirm password</label>
                <div class="input-shell">
                  ${icon("ShieldCheck", { size: 17 })}
                  <input class="input input--with-icon" id="st-confirm" name="confirm" type="password"
                         autocomplete="new-password" placeholder="Repeat the password" />
                </div>
                <span class="field__error" data-error></span>
              </div>

              <button class="btn btn--sm" type="submit" style="justify-self:start">
                <span class="btn__spinner"></span>
                <span class="btn__label">Update password</span>
              </button>
            </form>
          </div>
        </section>

        <section class="panel">
          <header class="panel__head">
            <h3 class="panel__title">${icon("Sparkles", { size: 15 })}Preferences</h3>
          </header>
          <div class="panel__body">
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Reduced motion</strong>
                <span>Calm transitions, no large movement.</span>
              </div>
              <button class="switch" role="switch" aria-checked="${prefersReduced()}" data-motion-switch
                      aria-label="Toggle reduced motion"></button>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Demonstration workspace</strong>
                <span>Load sample assignments and sessions to explore the app.</span>
              </div>
              <button class="btn btn--sm" data-demo>${icon("Wand2", { size: 14 })}<span class="btn__label">Load</span></button>
            </div>
            <div class="setting-row">
              <div class="setting-row__text">
                <strong>Clear my workspace</strong>
                <span>Removes your homework and study sessions.</span>
              </div>
              <button class="btn btn--sm btn--danger" data-clear>${icon("Trash2", { size: 14 })}<span class="btn__label">Clear</span></button>
            </div>
          </div>
        </section>

        <section class="panel">
          <header class="panel__head">
            <h3 class="panel__title">${icon("Info", { size: 15 })}About</h3>
          </header>
          <div class="panel__body">
            <p class="muted" style="font-size:12.5px;line-height:1.65">
              ACADEMIA · student workspace. Authentication, homework, planner, NCERT library and
              server-graded mock tests are backed by Supabase with Row Level Security.
            </p>
            <div style="display:flex;gap:0.45rem;flex-wrap:wrap;margin-top:0.9rem">
              <span class="badge">v1.0.0</span>
              <span class="badge">GSAP ${esc("3.15")}</span>
              <span class="badge">Supabase</span>
              <span class="badge">Vanilla JS</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  `;

  /* ------------------------------------------------------------- helpers */
  function fieldOf(form, name) {
    return form.querySelector(`.field[data-name="${name}"]`);
  }

  function setFieldError(form, name, message) {
    const field = fieldOf(form, name);
    if (!field) return;
    field.classList.toggle("is-invalid", Boolean(message));
    const slot = field.querySelector("[data-error]");
    if (slot) slot.textContent = message ?? "";
    if (message && !prefersReduced()) {
      gsap.fromTo(field, { x: -4 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.4)" });
    }
  }

  /* ------------------------------------------------------------- profile */
  const profileForm = root.querySelector("[data-profile-form]");

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = profileForm.querySelector('button[type="submit"]');
    const read = (name) => profileForm.querySelector(`[name="${name}"]`).value;
    const display_name = read("display_name").trim();
    const username = read("username").trim();
    const phone = read("phone").replace(/[\s()-]/g, "");
    const classLevel = read("class_level");

    let invalid = false;
    if (!USERNAME_RE.test(username)) {
      setFieldError(profileForm, "username", "Use 3–20 letters, numbers or underscores.");
      invalid = true;
    } else setFieldError(profileForm, "username", "");

    if (!PHONE_RE.test(phone)) {
      setFieldError(profileForm, "phone", "Enter a valid phone number.");
      invalid = true;
    } else setFieldError(profileForm, "phone", "");

    if (invalid) return;

    button.setAttribute("aria-busy", "true");
    button.disabled = true;

    const { data, error } = await supabase
      .from("profiles")
      .update({
        display_name: display_name || username,
        username,
        phone,
        class_level: classLevel ? Number(classLevel) : null,
      })
      .eq("id", profile.id)
      .select()
      .single();

    button.removeAttribute("aria-busy");
    button.disabled = false;

    if (error) {
      if (error.code === "23505") {
        const target = error.message.includes("username") ? "username" : "phone";
        setFieldError(profileForm, target, "That value is already registered.");
        showToast({ type: "error", title: "Already in use", message: `That ${target} belongs to another account.` });
      } else {
        showToast({ type: "error", title: "Could not save", message: error.message });
      }
      return;
    }

    Object.assign(profile, data);
    ctx.refreshProfile?.();
    root.querySelector("[data-hero-name]").textContent = profile.display_name || profile.username;
    root.querySelector("[data-hero-avatar]").textContent = initials(profile.display_name || profile.username);
    showToast({ type: "success", title: "Profile updated", message: "Your details are saved." });
  });

  /* ------------------------------------------------------------ password */
  const passwordForm = root.querySelector("[data-password-form]");
  const strength = passwordForm.querySelector("[data-strength]");
  const newPassword = passwordForm.querySelector('input[name="password"]');
  const confirmPassword = passwordForm.querySelector('input[name="confirm"]');

  newPassword.addEventListener("input", (event) => {
    const value = event.target.value;
    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    strength.dataset.level = String(value ? Math.min(4, Math.max(1, score - 1)) : 0);
    setFieldError(passwordForm, "password", "");
  });

  passwordForm.querySelector("[data-toggle-password]").addEventListener("click", (event) => {
    const show = newPassword.type === "password";
    newPassword.type = show ? "text" : "password";
    event.currentTarget.innerHTML = icon(show ? "EyeOff" : "Eye", { size: 16 });
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = passwordForm.querySelector('button[type="submit"]');
    const password = newPassword.value;
    const confirm = confirmPassword.value;

    let invalid = false;
    if (password.length < 8) {
      setFieldError(passwordForm, "password", "Use at least 8 characters.");
      invalid = true;
    } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setFieldError(passwordForm, "password", "Mix letters and numbers.");
      invalid = true;
    } else setFieldError(passwordForm, "password", "");

    if (confirm !== password) {
      setFieldError(passwordForm, "confirm", "Passwords do not match.");
      invalid = true;
    } else setFieldError(passwordForm, "confirm", "");

    if (invalid) return;

    button.setAttribute("aria-busy", "true");
    button.disabled = true;
    const { error } = await supabase.auth.updateUser({ password });
    button.removeAttribute("aria-busy");
    button.disabled = false;

    if (error) {
      showToast({ type: "error", title: "Could not update password", message: error.message });
      return;
    }
    passwordForm.reset();
    strength.dataset.level = "0";
    showToast({ type: "success", title: "Password updated", message: "Use it the next time you sign in." });
  });

  /* --------------------------------------------------------- preferences */
  const motionSwitch = root.querySelector("[data-motion-switch]");
  motionSwitch.addEventListener("click", () => {
    const reduced = motionSwitch.getAttribute("aria-checked") !== "true";
    motionSwitch.setAttribute("aria-checked", String(reduced));
    setMotionPreference(reduced ? "reduce" : "full");
    showToast({
      type: "info",
      title: reduced ? "Reduced motion on" : "Full motion on",
      message: "The preference applies as you navigate.",
    });
  });

  root.querySelector("[data-demo]").addEventListener("click", async () => {
    const button = root.querySelector("[data-demo]");
    button.setAttribute("aria-busy", "true");

    const now = Date.now();
    const day = 86400000;
    const homeworkRows = [
      { title: `${DEMO_PREFIX} Quadratic equations — Exercise 4.3`, subject: "Mathematics", priority: "high", offset: 1 },
      { title: `${DEMO_PREFIX} Chemical reactions worksheet`, subject: "Science", priority: "high", offset: 2 },
      { title: `${DEMO_PREFIX} First Flight — character sketch`, subject: "English", priority: "medium", offset: 3 },
      { title: `${DEMO_PREFIX} Map work: soil types`, subject: "Social Science", priority: "medium", offset: -1 },
      { title: `${DEMO_PREFIX} Trigonometry practice set`, subject: "Mathematics", priority: "low", offset: 5 },
      { title: `${DEMO_PREFIX} Hindi chapter summary`, subject: "Hindi", priority: "low", offset: 6 },
    ].map((row) => ({
      user_id: profile.id,
      title: row.title,
      description: "Demonstration content — safe to delete from Settings.",
      subject: row.subject,
      priority: row.priority,
      status: "pending",
      deadline: new Date(now + row.offset * day).toISOString(),
    }));

    const completedRows = [
      { title: `${DEMO_PREFIX} Real Numbers — assignment 1`, subject: "Mathematics", daysAgo: 8 },
      { title: `${DEMO_PREFIX} Essay: Digital India`, subject: "English", daysAgo: 5 },
      { title: `${DEMO_PREFIX} Periodic table quiz prep`, subject: "Science", daysAgo: 9 },
      { title: `${DEMO_PREFIX} Civics: Federalism notes`, subject: "Social Science", daysAgo: 11 },
    ].map((row) => ({
      user_id: profile.id,
      title: row.title,
      description: "Demonstration content — safe to delete from Settings.",
      subject: row.subject,
      priority: "medium",
      status: "completed",
      deadline: new Date(now - row.daysAgo * day).toISOString(),
      completed_at: new Date(now - (row.daysAgo - 1) * day).toISOString(),
    }));

    const sessionRows = Array.from({ length: 4 }, (_, index) => ({
      user_id: profile.id,
      title: `${DEMO_PREFIX} Focus block ${index + 1}`,
      subject: SUBJECTS[index % SUBJECTS.length],
      scheduled_at: new Date(now + (index + 1) * 0.4 * day).toISOString(),
      duration: 45,
      notes: "Demonstration session.",
      completed: false,
    }));

    const [hw, done, sessions] = await Promise.all([
      supabase.from("homework").insert(homeworkRows),
      supabase.from("homework").insert(completedRows),
      supabase.from("study_sessions").insert(sessionRows),
    ]);

    button.removeAttribute("aria-busy");
    const error = hw.error || done.error || sessions.error;
    if (error) {
      showToast({ type: "error", title: "Could not load demo", message: error.message });
      return;
    }
    ctx.onHomeworkChanged?.();
    showToast({
      type: "success",
      title: "Demo workspace loaded",
      message: "Open Homework and Overview to see it in action.",
    });
  });

  root.querySelector("[data-clear]").addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Clear your workspace?",
      message:
        "All homework and study sessions are deleted. Mock test history is kept because it is an immutable record.",
      confirmLabel: "Delete everything",
      danger: true,
    });
    if (!confirmed) return;

    const [hw, sessions] = await Promise.all([
      supabase.from("homework").delete().eq("user_id", profile.id),
      supabase.from("study_sessions").delete().eq("user_id", profile.id),
    ]);

    const error = hw.error || sessions.error;
    if (error) {
      showToast({ type: "error", title: "Could not clear", message: error.message });
      return;
    }
    ctx.onHomeworkChanged?.();
    showToast({ type: "info", title: "Workspace cleared", message: "Homework and sessions were removed." });
  });

  root.querySelector("[data-sign-out]").addEventListener("click", async () => {
    const confirmed = await confirmDialog({
      title: "Sign out of ACADEMIA?",
      message: "Your work stays saved to your account.",
      confirmLabel: "Sign out",
      danger: true,
    });
    if (!confirmed) return;
    if (typeof ctx.signOut === "function") {
      await ctx.signOut();
    } else {
      await supabase.auth.signOut();
    }
  });

  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));
  scrollReveal(root.querySelectorAll(".settings-grid > *"), { y: 18 });

  return () => {
    killScrollTriggers();
  };
}
