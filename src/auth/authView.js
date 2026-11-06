/**
 * ACADEMIA · authentication stage
 * Login (username + password only) and registration (email, phone, username,
 * password) with live availability checks, inline validation and a
 * server-side account creation flow.
 */
import { api } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import { brandBlock, orbitArt } from "../ui/brand.js";
import { toast } from "../ui/toast.js";
import { debounce, esc } from "../lib/dom.js";
import {
  gsap,
  dur,
  prefersReduced,
  revealChars,
  revealLines,
  magnetic,
  ambientBackground,
  drawStrokes,
} from "../lib/motion.js";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const PHONE_RE = /^\+?[0-9]{10,15}$/;

const strengthLabels = ["Too short", "Weak", "Fair", "Strong", "Excellent"];

function passwordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return Math.min(4, Math.max(value.length >= 8 ? 1 : 0, score - 1));
}

const template = () => `
  <div class="auth-stage">
    <div class="auth-story">
      ${brandBlock({ size: 44 })}
      <div class="auth-story__hero">
        <span class="eyebrow">Student workspace · 2026</span>
        <h1 class="auth-story__title" data-split>Everything you study.<br><em>One calm place.</em></h1>
        <p class="auth-story__lede">
          Homework that actually gets organised. Class-wise NCERT textbooks. Mock exams
          graded on the server — all inside one precise, distraction-free workspace.
        </p>
        <div class="auth-stats">
          <div class="auth-stat">
            <span class="auth-stat__value">12</span>
            <span class="auth-stat__label">Classes</span>
          </div>
          <div class="auth-stat">
            <span class="auth-stat__value" data-count="72">72</span>
            <span class="auth-stat__label">NCERT books</span>
          </div>
          <div class="auth-stat">
            <span class="auth-stat__value">05</span>
            <span class="auth-stat__label">Exam subjects</span>
          </div>
        </div>
      </div>
      ${orbitArt()}
    </div>

    <div class="auth-panel">
      <div class="auth-card glass">
        <div class="auth-card__head">
          <h2 class="auth-card__title" data-auth-title>Welcome back</h2>
          <p class="auth-card__sub" data-auth-sub>Sign in with the username you registered with.</p>
        </div>

        <div class="auth-tabs" role="tablist" aria-label="Authentication mode">
          <span class="auth-tabs__pill" aria-hidden="true"></span>
          <button class="auth-tab" role="tab" id="tab-login" aria-selected="true" aria-controls="form-login" data-tab="login">Sign in</button>
          <button class="auth-tab" role="tab" id="tab-register" aria-selected="false" aria-controls="form-register" data-tab="register">Create account</button>
        </div>

        <!-- ------------------------------------------------------- login -->
        <form class="auth-form" id="form-login" role="tabpanel" aria-labelledby="tab-login" novalidate>
          <div class="auth-alert" data-alert hidden role="alert">
            ${icon("AlertTriangle", { size: 15 })}<span data-alert-text></span>
          </div>

          <div class="field" data-name="username">
            <label class="field__label" for="login-username">Username</label>
            <div class="input-shell">
              ${icon("UserRound", { size: 17 })}
              <input class="input input--with-icon" id="login-username" name="username" type="text"
                     autocomplete="username" placeholder="your_username" spellcheck="false" required />
            </div>
            <span class="field__error" data-error></span>
          </div>

          <div class="field" data-name="password">
            <label class="field__label" for="login-password">Password</label>
            <div class="input-shell">
              ${icon("Lock", { size: 17 })}
              <input class="input input--with-icon" id="login-password" name="password" type="password"
                     autocomplete="current-password" placeholder="••••••••" required />
              <span class="input-affix">
                <button type="button" data-toggle-password aria-label="Show password">
                  ${icon("Eye", { size: 16 })}
                </button>
              </span>
            </div>
            <span class="field__error" data-error></span>
          </div>

          <button class="btn btn--primary auth-submit" type="submit" data-magnetic>
            <span class="btn__spinner"></span>
            <span class="btn__label">Enter workspace</span>
            ${icon("ArrowRight", { size: 16 })}
          </button>

          <div class="auth-foot">
            ${icon("ShieldCheck", { size: 12 })}
            <span>Authenticated with Supabase · session persisted</span>
          </div>
        </form>

        <!-- ---------------------------------------------------- register -->
        <form class="auth-form" id="form-register" role="tabpanel" aria-labelledby="tab-register" novalidate hidden>
          <div class="auth-alert" data-alert hidden role="alert">
            ${icon("AlertTriangle", { size: 15 })}<span data-alert-text></span>
          </div>

          <div class="field" data-name="username">
            <label class="field__label" for="reg-username">
              Username
              <span class="avail" data-avail="username" hidden></span>
            </label>
            <div class="input-shell">
              ${icon("AtSign", { size: 17 })}
              <input class="input input--with-icon" id="reg-username" name="username" type="text"
                     autocomplete="username" placeholder="ayaan_sharma" spellcheck="false" required />
            </div>
            <span class="field__hint" data-hint>3–20 characters · letters, numbers, underscore</span>
            <span class="field__error" data-error></span>
          </div>

          <div class="field" data-name="email">
            <label class="field__label" for="reg-email">
              Email
              <span class="avail" data-avail="email" hidden></span>
            </label>
            <div class="input-shell">
              ${icon("Mail", { size: 17 })}
              <input class="input input--with-icon" id="reg-email" name="email" type="email"
                     autocomplete="email" placeholder="you@school.com" spellcheck="false" required />
            </div>
            <span class="field__hint" data-hint>Used for account recovery — never shown publicly.</span>
            <span class="field__error" data-error></span>
          </div>

          <div class="field" data-name="phone">
            <label class="field__label" for="reg-phone">
              Phone
              <span class="avail" data-avail="phone" hidden></span>
            </label>
            <div class="input-shell">
              ${icon("Smartphone", { size: 17 })}
              <input class="input input--with-icon" id="reg-phone" name="phone" type="tel"
                     autocomplete="tel" placeholder="98765 43210" inputmode="tel" required />
            </div>
            <span class="field__hint" data-hint>Stored on your profile · no SMS verification needed.</span>
            <span class="field__error" data-error></span>
          </div>

          <div class="field" data-name="password">
            <label class="field__label" for="reg-password">Password</label>
            <div class="input-shell">
              ${icon("Lock", { size: 17 })}
              <input class="input input--with-icon" id="reg-password" name="password" type="password"
                     autocomplete="new-password" placeholder="At least 8 characters" required />
              <span class="input-affix">
                <button type="button" data-toggle-password aria-label="Show password">
                  ${icon("Eye", { size: 16 })}
                </button>
              </span>
            </div>
            <div class="strength" data-strength data-level="0">
              <div class="strength__bars">
                <span class="strength__bar"><span></span></span>
                <span class="strength__bar"><span></span></span>
                <span class="strength__bar"><span></span></span>
                <span class="strength__bar"><span></span></span>
              </div>
              <div class="strength__meta">
                <span data-strength-label>Password strength</span>
                <span>8+ chars, letters &amp; numbers</span>
              </div>
            </div>
            <span class="field__error" data-error></span>
          </div>

          <button class="btn btn--primary auth-submit" type="submit" data-magnetic>
            <span class="btn__spinner"></span>
            <span class="btn__label">Create account</span>
            ${icon("ArrowRight", { size: 16 })}
          </button>

          <div class="auth-foot">
            ${icon("Lock", { size: 12 })}
            <span>Your details stay private · Row Level Security</span>
          </div>
        </form>

        <!-- ----------------------------------------------------- success -->
        <div class="auth-success" data-success hidden>
          <div class="success-ring">
            <svg viewBox="0 0 104 104" aria-hidden="true">
              <defs>
                <linearGradient id="successGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop stop-color="#7bf1c5"/>
                  <stop offset="1" stop-color="#8fb0ff"/>
                </linearGradient>
              </defs>
              <circle class="ring-bg" cx="52" cy="52" r="46"/>
              <circle class="ring-fg" cx="52" cy="52" r="46"/>
            </svg>
            <svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M4.5 12.5 9.5 17.5 19.5 7"/>
            </svg>
          </div>
          <h3 class="auth-success__title">Account created</h3>
          <p class="auth-success__text">
            Your workspace is ready. Sign in with your username and password to enter ACADEMIA.
          </p>
          <div class="auth-success__meta">
            ${icon("UserCheck", { size: 13 })}
            <span data-success-username>@student</span>
          </div>
          <button class="btn btn--primary btn--block auth-submit" type="button" data-back-to-login data-magnetic>
            <span class="btn__label">Back to login</span>
            ${icon("ArrowRight", { size: 16 })}
          </button>
          <div class="auth-foot">
            ${icon("Sparkles", { size: 12 })}
            <span>Your session is not stored until you sign in</span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

export function renderAuth(root, { onAuthed } = {}) {
  root.innerHTML = template();

  const stage = root.querySelector(".auth-stage");
  const card = root.querySelector(".auth-card");
  const tabs = root.querySelector(".auth-tabs");
  const pill = root.querySelector(".auth-tabs__pill");
  const titleEl = root.querySelector("[data-auth-title]");
  const subEl = root.querySelector("[data-auth-sub]");
  const loginForm = root.querySelector("#form-login");
  const registerForm = root.querySelector("#form-register");
  const successPanel = root.querySelector("[data-success]");
  const successName = root.querySelector("[data-success-username]");

  let mode = "login";
  let availability = { username: null, email: null, phone: null };

  /* ------------------------------------------------------------- fields */
  function fieldsOf(form) {
    const map = {};
    form.querySelectorAll(".field[data-name]").forEach((field) => {
      map[field.dataset.name] = {
        root: field,
        input: field.querySelector("input"),
        error: field.querySelector("[data-error]"),
        hint: field.querySelector("[data-hint]"),
        avail: field.querySelector("[data-avail]"),
        originalHint: field.querySelector("[data-hint]")?.textContent ?? "",
      };
    });
    return map;
  }

  const loginFields = fieldsOf(loginForm);
  const registerFields = fieldsOf(registerForm);

  function setError(field, message) {
    if (!field) return;
    field.root.classList.add("is-invalid");
    field.root.classList.remove("is-valid");
    field.input.setAttribute("aria-invalid", "true");
    if (field.error) field.error.textContent = message;
    if (!prefersReduced()) {
      gsap.fromTo(
        field.root,
        { x: -5 },
        { x: 0, duration: 0.45, ease: "elastic.out(1, 0.35)" },
      );
    }
  }

  function clearError(field, { valid = false } = {}) {
    if (!field) return;
    field.root.classList.remove("is-invalid");
    field.input.removeAttribute("aria-invalid");
    if (field.error) field.error.textContent = "";
    if (valid) field.root.classList.add("is-valid");
    else field.root.classList.remove("is-valid");
  }

  function setAlert(form, message) {
    const box = form.querySelector("[data-alert]");
    const text = form.querySelector("[data-alert-text]");
    if (!box) return;
    if (!message) {
      box.hidden = true;
      text.textContent = "";
      return;
    }
    text.textContent = message;
    box.hidden = false;
    if (!prefersReduced()) {
      gsap.fromTo(box, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" });
    }
  }

  function setBusy(form, busy, label) {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.setAttribute("aria-busy", busy ? "true" : "false");
    button.disabled = busy;
    const labelEl = button.querySelector(".btn__label");
    if (labelEl && label) {
      if (busy) {
        labelEl.dataset.idle = labelEl.textContent;
        labelEl.textContent = label;
      } else if (labelEl.dataset.idle) {
        labelEl.textContent = labelEl.dataset.idle;
      }
    }
  }

  /* --------------------------------------------------------- validation */
  function validateUsername(value) {
    if (!value) return "Enter a username.";
    if (!USERNAME_RE.test(value)) return "Use 3–20 letters, numbers or underscores.";
    return "";
  }

  function validateEmail(value) {
    if (!value) return "Enter your email address.";
    if (!EMAIL_RE.test(value)) return "That email doesn’t look right.";
    return "";
  }

  function validatePhone(value) {
    const clean = value.replace(/[\s()-]/g, "");
    if (!clean) return "Enter your phone number.";
    if (!PHONE_RE.test(clean)) return "Enter 10–15 digits (with country code if needed).";
    return "";
  }

  function validatePassword(value, { strict = true } = {}) {
    if (!value) return "Enter a password.";
    if (value.length < 8) return "Use at least 8 characters.";
    if (strict && (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value))) {
      return "Mix letters and numbers.";
    }
    return "";
  }

  /* ------------------------------------------------------- password UI */
  root.querySelectorAll("[data-toggle-password]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".input-shell").querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.innerHTML = icon(show ? "EyeOff" : "Eye", { size: 16 });
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      input.focus({ preventScroll: true });
    });
  });

  const strengthEl = registerForm.querySelector("[data-strength]");
  const strengthLabel = registerForm.querySelector("[data-strength-label]");
  registerFields.password?.input.addEventListener("input", (event) => {
    const value = event.target.value;
    const score = passwordScore(value);
    strengthEl.dataset.level = String(value ? score : 0);
    strengthLabel.textContent = value ? strengthLabels[score] : "Password strength";
    if (value && validatePassword(value)) {
      clearError(registerFields.password);
    } else if (value) {
      clearError(registerFields.password, { valid: true });
    }
  });

  /* --------------------------------------------------- availability check */
  function setAvail(field, state, text) {
    if (!field?.avail) return;
    field.avail.hidden = false;
    field.avail.dataset.state = state;
    field.avail.innerHTML = `${icon(
      state === "free" ? "Check" : state === "taken" ? "X" : "Loader2",
      { size: 12, class: state === "checking" ? "spin" : undefined },
    )}<span>${esc(text)}</span>`;
  }

  async function checkAvailability() {
    const username = registerFields.username.input.value.trim();
    const email = registerFields.email.input.value.trim();
    const phone = registerFields.phone.input.value.replace(/[\s()-]/g, "");

    if (validateUsername(username) || validateEmail(email) || validatePhone(phone)) return;

    setAvail(registerFields.username, "checking", "checking");
    setAvail(registerFields.email, "checking", "checking");
    setAvail(registerFields.phone, "checking", "checking");

    const { data, error } = await supabase.rpc("check_signup_availability", {
      p_username: username,
      p_email: email,
      p_phone: phone,
    });

    if (error) {
      setAvail(registerFields.username, "idle", "");
      setAvail(registerFields.email, "idle", "");
      setAvail(registerFields.phone, "idle", "");
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    availability = {
      username: row?.username_available ?? null,
      email: row?.email_available ?? null,
      phone: row?.phone_available ?? null,
    };

    setAvail(registerFields.username, availability.username ? "free" : "taken", availability.username ? "available" : "taken");
    setAvail(registerFields.email, availability.email ? "free" : "taken", availability.email ? "available" : "taken");
    setAvail(registerFields.phone, availability.phone ? "free" : "taken", availability.phone ? "available" : "taken");

    if (!availability.username) setError(registerFields.username, "That username is already taken.");
    if (!availability.email) setError(registerFields.email, "That email is already registered.");
    if (!availability.phone) setError(registerFields.phone, "That phone number is already registered.");
  }

  const debouncedAvailability = debounce(checkAvailability, 480);
  ["username", "email", "phone"].forEach((name) => {
    registerFields[name]?.input.addEventListener("input", () => {
      clearError(registerFields[name]);
      debouncedAvailability();
    });
    registerFields[name]?.input.addEventListener("blur", () => {
      const field = registerFields[name];
      const value = field.input.value.trim();
      if (!value) return;
      const message =
        name === "username" ? validateUsername(value) : name === "email" ? validateEmail(value) : validatePhone(value);
      if (message) setError(field, message);
    });
  });

  /* -------------------------------------------------------------- tabs */
  function setMode(next, { focus = true } = {}) {
    if (next === mode) return;
    const previous = mode;
    mode = next;

    const isRegister = next === "register";
    root.querySelectorAll(".auth-tab").forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.dataset.tab === next));
    });

    if (!prefersReduced()) {
      gsap.to(pill, {
        x: isRegister ? "calc(100% + 0.2rem)" : "0%",
        duration: 0.55,
        ease: "expo.out",
      });
    } else {
      pill.style.transform = isRegister ? "translateX(calc(100% + 0.2rem))" : "translateX(0)";
    }

    titleEl.textContent = isRegister ? "Create your workspace" : "Welcome back";
    subEl.textContent = isRegister
      ? "Four details and your study workspace is alive."
      : "Sign in with the username you registered with.";

    const incoming = isRegister ? registerForm : loginForm;
    const outgoing = previous === "register" ? registerForm : loginForm;

    setAlert(outgoing, "");

    if (prefersReduced()) {
      outgoing.hidden = true;
      incoming.hidden = false;
      if (focus) incoming.querySelector("input")?.focus({ preventScroll: true });
      return;
    }

    gsap.to(outgoing, {
      opacity: 0,
      y: -8,
      duration: 0.2,
      ease: "power2.in",
      onComplete: () => {
        outgoing.hidden = true;
        incoming.hidden = false;
        gsap.fromTo(
          incoming,
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" },
        );
        gsap.fromTo(
          incoming.querySelectorAll(".field, .auth-submit"),
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.045, ease: "power3.out" },
        );
        if (focus) incoming.querySelector("input")?.focus({ preventScroll: true });
      },
    });
  }

  root.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.tab));
  });

  /* ------------------------------------------------------------- login */
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAlert(loginForm, "");

    const username = loginFields.username.input.value.trim();
    const password = loginFields.password.input.value;

    let invalid = false;
    if (!username) {
      setError(loginFields.username, "Enter your username.");
      invalid = true;
    } else clearError(loginFields.username, { valid: true });

    if (!password) {
      setError(loginFields.password, "Enter your password.");
      invalid = true;
    } else clearError(loginFields.password);

    if (invalid) return;

    setBusy(loginForm, true, "Authenticating…");

    try {
      const result = await api.login({ username, password });
      const { error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (error) throw error;

      const label = loginForm.querySelector(".btn__label");
      if (label) label.textContent = "Welcome back";

      if (prefersReduced()) {
        onAuthed?.(result.user);
        return;
      }

      gsap.to(card, {
        opacity: 0,
        scale: 0.97,
        filter: "blur(6px)",
        duration: 0.5,
        ease: "power2.inOut",
        onComplete: () => onAuthed?.(result.user),
      });
      gsap.to(stage.querySelectorAll(".auth-story > *"), {
        opacity: 0,
        y: -18,
        duration: 0.5,
        stagger: 0.05,
        ease: "power2.inOut",
      });
    } catch (error) {
      setAlert(loginForm, error.message || "Sign in failed. Try again.");
      setError(loginFields.password, "Check your password and try again.");
      loginFields.password.input.select?.();
      setBusy(loginForm, false);
    }
  });

  /* ---------------------------------------------------------- register */
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setAlert(registerForm, "");

    const username = registerFields.username.input.value.trim();
    const email = registerFields.email.input.value.trim().toLowerCase();
    const phone = registerFields.phone.input.value.replace(/[\s()-]/g, "");
    const password = registerFields.password.input.value;

    const checks = [
      [registerFields.username, validateUsername(username)],
      [registerFields.email, validateEmail(email)],
      [registerFields.phone, validatePhone(phone)],
      [registerFields.password, validatePassword(password)],
    ];

    let invalid = false;
    checks.forEach(([field, message]) => {
      if (message) {
        setError(field, message);
        invalid = true;
      } else {
        clearError(field, { valid: true });
      }
    });

    if (invalid) {
      const firstInvalid = registerForm.querySelector(".field.is-invalid input");
      firstInvalid?.focus();
      return;
    }

    if (availability.username === false || availability.email === false || availability.phone === false) {
      setAlert(registerForm, "Some of those details are already registered.");
      return;
    }

    setBusy(registerForm, true, "Creating account…");

    try {
      const result = await api.register({ username, email, phone, password });
      showSuccess(result.username || username);
    } catch (error) {
      const fields = error.fields ?? {};
      if (fields.username) setError(registerFields.username, fields.username);
      if (fields.email) setError(registerFields.email, fields.email);
      if (fields.phone) setError(registerFields.phone, fields.phone);
      if (fields.password) setError(registerFields.password, fields.password);
      setAlert(registerForm, error.message || "Registration failed. Try again.");
      toast.error("Registration failed", error.message);
    } finally {
      setBusy(registerForm, false);
    }
  });

  /* ------------------------------------------------------------ success */
  function showSuccess(username) {
    successName.textContent = `@${username}`;
    const outgoing = mode === "register" ? registerForm : loginForm;

    const reveal = () => {
      outgoing.hidden = true;
      tabs.hidden = true;
      successPanel.hidden = false;

      const ring = successPanel.querySelector(".ring-fg");
      const check = successPanel.querySelector(".check path");

      if (prefersReduced()) {
        ring.style.strokeDashoffset = "0";
        check.style.strokeDashoffset = "0";
        return;
      }

      gsap.fromTo(successPanel, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" });
      gsap.fromTo(
        ring,
        { strokeDashoffset: 289 },
        { strokeDashoffset: 0, duration: 1.15, ease: "power2.inOut", delay: 0.15 },
      );
      gsap.fromTo(
        check,
        { strokeDashoffset: 40 },
        { strokeDashoffset: 0, duration: 0.5, ease: "power2.out", delay: 0.95 },
      );
      gsap.fromTo(
        successPanel.querySelector(".success-ring"),
        { scale: 0.85, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.6)" },
      );
      gsap.fromTo(
        successPanel.querySelectorAll(".auth-success__title, .auth-success__text, .auth-success__meta, [data-back-to-login]"),
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, delay: 0.5, ease: "power3.out" },
      );
    };

    if (prefersReduced()) {
      reveal();
      return;
    }

    gsap.to(outgoing, {
      opacity: 0,
      y: -10,
      duration: 0.25,
      ease: "power2.in",
      onComplete: reveal,
    });
    titleEl.textContent = "You’re in";
    subEl.textContent = "One last step — sign in to open your workspace.";
  }

  root.querySelector("[data-back-to-login]").addEventListener("click", () => {
    const username = registerFields.username.input.value.trim();
    successPanel.hidden = true;
    tabs.hidden = false;
    mode = "register";
    setMode("login", { focus: false });
    loginForm.reset();
    if (username) loginFields.username.input.value = username;
    loginFields.password.input.focus({ preventScroll: true });

    if (!prefersReduced()) {
      gsap.fromTo(
        card,
        { filter: "blur(4px)", opacity: 0.6 },
        { filter: "blur(0px)", opacity: 1, duration: 0.6, ease: "power2.out" },
      );
    }
  });

  /* --------------------------------------------------------- intro show */
  function playIntro() {
    const storyChildren = stage.querySelectorAll(".auth-story > *");
    const title = stage.querySelector("[data-split]");

    if (prefersReduced()) {
      gsap.set([storyChildren, card], { opacity: 1, y: 0 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(card, { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 1 });
    tl.fromTo(storyChildren, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.1);

    const chars = revealChars(title, { delay: 0.25, stagger: 0.014, duration: 0.9 });
    void chars;

    tl.fromTo(
      card.querySelectorAll(".field, .auth-submit, .auth-tabs, .auth-card__head > *"),
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.035 },
      0.35,
    );

    const orbitPaths = stage.querySelectorAll(".orbit .orbit__accent");
    drawStrokes(orbitPaths, { duration: 1.8, stagger: 0.2 });

    const dots = stage.querySelectorAll(".orbit__dot");
    gsap.fromTo(
      dots,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.8, stagger: 0.15, delay: 0.7, ease: "elastic.out(1, 0.5)" },
    );
    if (dots.length) {
      gsap.to(dots, {
        scale: 1.35,
        opacity: 0.6,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        stagger: 0.4,
        ease: "sine.inOut",
      });
    }

    // subtle parallax on the orbit
    const orbit = stage.querySelector(".orbit");
    if (orbit && window.matchMedia("(pointer: fine)").matches) {
      const xTo = gsap.quickTo(orbit, "x", { duration: 1.2, ease: "power3.out" });
      const yTo = gsap.quickTo(orbit, "y", { duration: 1.2, ease: "power3.out" });
      stage.addEventListener("pointermove", (event) => {
        const { innerWidth, innerHeight } = window;
        xTo((event.clientX / innerWidth - 0.5) * 26);
        yTo((event.clientY / innerHeight - 0.5) * 22);
      });
    }

    gsap.to(pill, { opacity: 1, duration: dur(0.4) });
  }

  ambientBackground();
  playIntro();
  card.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));

  // tab pill starts on "Sign in"
  gsap.set(pill, { x: 0 });
  setTimeout(() => loginFields.username.input.focus({ preventScroll: true }), 700);

  if (prefersReduced()) {
    gsap.set(card, { opacity: 1 });
  }

  return {
    destroy() {
      gsap.killTweensOf(stage.querySelectorAll("*"));
    },
  };
}
