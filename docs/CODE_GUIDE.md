# Ayaan Academia — Code Guide

A complete walkthrough of every file in the project: what it does, how it works, and how it
connects to the rest. Written so you can **read it once, then present from it**.

---

## 0. How to use this document

| If you have… | Read |
| --- | --- |
| 2 minutes before presenting | **§1 The 60-second version** + **§9 Viva Q&A** |
| 20 minutes | §1, §2, §3 (the two journeys), then skim §4 |
| A question about a specific file | Ctrl-F the file name — every file has its own entry in §4 |
| "Where would you change X?" | **§8 cheat sheet** |
| "How is it secure?" | **§6 Security model** |

---

## 1. The 60-second version

> "Ayaan Academia is a student productivity web app. It's a **single-page application** built
> with vanilla JavaScript and Vite — no React, no framework. It has three screens: a public
> **landing page**, an **auth screen**, and the **workspace** with seven tools: Overview,
> Homework, Study Planner, NCERT Books, Mock Tests, Performance and Settings.
>
> All data lives in **Supabase** (Postgres + Auth). The browser talks to the database directly
> through Supabase's REST API, and **Row Level Security** in the database guarantees a student
> can only ever read or write their own rows. Anything privileged — creating accounts, looking
> up a username at login, and grading mock exams — happens in **three server-side Edge
> Functions** that hold the service-role key. The browser never sees an answer key.
>
> The front end is organised as: `main.js` controls which of the three screens is on, `shell.js`
> is the app chrome plus the router, and each of the seven views is a lazily-loaded module that
> exports one `render(root, ctx)` function."

That's the whole project in six sentences. Everything below is detail.

---

## 2. Architecture at a glance

```
┌──────────────────────────────────────────── BROWSER ────────────────────────────────────────────┐
│                                                                                                  │
│  index.html                                                                                      │
│    └─ src/main.js          ← screen state machine: landing → auth → app                          │
│         ├─ landing/landingView.js   public page (carousel, features, photos)                     │
│         ├─ auth/authView.js         login + registration                                         │
│         └─ app/shell.js             sidebar, topbar, router, notifications                       │
│              └─ views/*.js          7 screens, each exports render(root, ctx)                    │
│                                                                                                  │
│  shared plumbing:                                                                                │
│    lib/config.js     constants + API keys (public anon key only)                                 │
│    lib/supabase.js   the Supabase client + session handling                                      │
│    lib/api.js        wrapper around the 3 Edge Functions                                         │
│    lib/store.js      tiny observable state + event bus                                           │
│    lib/dom.js        escaping, date formatting, localStorage helpers                             │
│    lib/icons.js      Lucide icons → inline SVG strings                                           │
│    lib/motion.js     every GSAP animation, with reduced-motion everywhere                        │
│    ui/brand.js       logo + wordmark                                                             │
│    ui/toast.js       toast notifications                                                         │
│    ui/modal.js       modal + confirm dialogs                                                     │
│    styles/*.css      5 stylesheets: base, auth, shell, views, landing                            │
│                                                                                                  │
└───────────────┬──────────────────────────────────────────────┬──────────────────────────────────┘
                │ anon key + user JWT                          │ anon key + user JWT
                ▼                                              ▼
   ┌────────────────────────────┐              ┌─────────────────────────────────────┐
   │  Supabase REST (PostgREST) │              │  Supabase Edge Functions (Deno)     │
   │  RLS enforces ownership    │              │  username-login  (public)           │
   │                            │              │  register-student (public)          │
   │  profiles, homework,       │              │  mock-test       (needs user JWT)   │
   │  study_sessions,           │              │  ↑ these hold the SERVICE_ROLE key  │
   │  ncert_*, mock_*,          │              └──────────────┬──────────────────────┘
   │  test_attempts/answers,    │                             │
   │  activity_events, view     │◄────────────────────────────┘
   └────────────────────────────┘
```

### The three layers, and why

| Layer | Tech | Responsibility | Key rule |
| --- | --- | --- | --- |
| **Client** | Vanilla JS + Vite + GSAP + Chart.js | Render, validate, animate, route | Holds only the **public anon key** |
| **Database** | Postgres + RLS | Store rows, enforce ownership, generate activity feed | Every table is locked to `auth.uid()` |
| **Server functions** | Deno Edge Functions | Register, username login, exam grading | Only place the **service_role** key exists |

**Why no backend of our own?** Supabase already provides Postgres, authentication and a REST API;
writing a Node/Express server would duplicate all of that. The three Edge Functions exist only for
operations that *must not* be trusted to the browser.

---

## 3. Two journeys, end to end

This is the best way to explain the project: follow one click at a time.

### A. First visit → register → login → workspace

| # | What the student does | Code that runs | What happens |
| --- | --- | --- | --- |
| 1 | Opens the site | `index.html` → `src/main.js` → `boot()` | SVG gradient defs injected, motion preference applied, background orbs start moving |
| 2 | Landing page appears | `main.js: showLanding()` → `renderLanding()` | `supabase.auth.getSession()` decides whether the nav says "Sign in" or "signed in"; the page renders with GSAP reveals |
| 3 | Clicks **Get Started** | `main.js: handleGetStarted()` | If a session exists → straight to the workspace. Otherwise → auth screen |
| 4 | Switches to **Create account** | `authView.js: setMode("register")` | The tabs animate, the register form slides in |
| 5 | Types a username | `authView.js: checkAvailability()` (debounced) | Calls the SQL function `check_signup_availability` — returns **booleans only**, never rows — and paints "available / taken" under each field |
| 6 | Submits the form | `authView.js` submit handler → `api.register()` → Edge Function `register-student` | The function validates every field, re-checks duplicates, `createUser()` in Supabase Auth, inserts the `profiles` row, and if the profile insert fails it deletes the auth user (no orphans). Success screen with an animated ring |
| 7 | Logs in | `authView.js` → `api.login()` → Edge Function `username-login` | The function maps `username → email` **server-side**, then does a real password grant. The email never leaves the server. Wrong username and wrong password give the *same* message and the same delay (no account enumeration) |
| 8 | Session is stored | `supabase.auth.setSession(...)` | The JWT is saved in `localStorage` under `academia.auth`; every later request carries it |
| 9 | `onAuthed` fires | `main.js: startApp(user)` | Loads the profile row, seeds `store` (`setSession`, `setProfile`), then `mountWorkspace()` |
| 10 | Workspace mounts | `app/shell.js` | Builds the sidebar/topbar, reads `location.hash` (or defaults to Overview), dynamically imports `views/overview.js` and calls `render()` |
| 11 | Navigates around | `shell.js: navigate(id)` | Fades the old view out, runs its cleanup, imports the new module, `enterView()` animates it in, `history.pushState("#/homework")` |

### B. Taking a mock test (the security showcase)

| # | Action | Code | Note |
| --- | --- | --- | --- |
| 1 | Opens Mock Tests | `views/mocks.js: render()` → `api.mockList()` | Edge Function returns tests **with only a question count** — no questions, no answers |
| 2 | Picks a subject, clicks Start | `showInstructions()` → `openExam()` → `api.mockStart(test.id)` | Function creates or resumes an attempt, returns `remaining_seconds` and the questions **without `correct_option`** |
| 3 | Chooses an option | `selectOption(key)` → `persist()` → `api.mockAnswer()` | Saved to `test_answers` on every click, so a refresh loses nothing. A "saved / saving / not saved" indicator is honest about it |
| 4 | Timer hits zero, or clicks Submit | `submitAttempt()` → `api.mockSubmit()` | Function compares answers to `correct_option`, writes counts, sets `status='completed'`, logs an `activity_events` row |
| 5 | Reviews the paper | `api.mockReview()` | Only here does the server hand back `correct_option` + `explanation`, and only because the attempt is `completed` |
| 6 | Charts update | Overview / Performance read the `student_test_history` view | Percentages are computed from stored counts, never from browser state |

**One line to remember:** *the answer key never travels to the browser until the paper is graded.*

---

## 4. File-by-file

Ordered the way the app runs: build → entry → libraries → UI parts → screens → styles → backend.

---

### 4.1 Project root and build

#### `package.json`
**Role:** project manifest — name, version, scripts, dependencies.

- `"type": "module"` → all `.js` files are ES modules (`import` / `export`).
- Scripts: `dev` = `vite --host 0.0.0.0 --port 5173`, `build` = `vite build`, `preview`.
- Runtime dependencies: `@supabase/supabase-js` (database + auth client), `chart.js/auto`
  (charts), `gsap` (+ ScrollTrigger, Flip, TextPlugin — animation), `lucide` (icon shapes).
- `lenis` is present but **not imported anywhere** — a leftover; safe to remove.

> **If asked:** "Vite is the build tool and dev server. It bundles and minifies everything into
> `dist/`, splits each lazily-imported view into its own chunk, and gives instant reloads in dev."

#### `vite.config.js`
**Role:** dev-server and build configuration.

- `server.host 0.0.0.0`, `port 5173`, `strictPort` — so it's reachable from the sandbox/host preview.
- `allowedHosts: true` — accepts requests proxied through the hosted preview domain.
- `hmr: false` — the preview is proxied over HTTPS through another host, so the default HMR
  socket can't attach reliably; turning it off keeps the console clean.
- `build.target: es2020`, `sourcemap: false`.

> **If asked:** "Nothing here affects the app's logic — it's environment configuration."

#### `index.html`
**Role:** the only HTML page. Everything else is rendered by JavaScript.

- `<meta name="theme-color" content="#f6f7fb">` and the inline SVG favicon (brand gradient on a
  light tile).
- Google Fonts: **Sora** (display), **Inter** (body), **JetBrains Mono** (numbers/labels).
- `#app` — the root element every screen renders into.
- `#modal-root` and `#toast-root` — so modals/toasts can float above everything without fighting
  the page's stacking contexts.
- `.app-bg` — permanent atmosphere layers: three `.aurora` blobs, a faint grid, a noise texture
  and a vignette. They sit behind the content at `z-index: 0`.
- `<noscript>` explains that JS is required.

> **If asked:** "Single-page app: one HTML file, and JavaScript swaps the contents of `#app`."

#### `render.yaml`
**Role:** Render "Blueprint" — infrastructure as code for deployment.

- `type: web`, `runtime: static`, `buildCommand: npm ci && npm run build`,
  `staticPublishPath: ./dist`.
- `previews.generation: automatic` — every pull request gets its own preview URL.
- Env vars: `NODE_VERSION=22.22.0`, plus `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` marked
  `sync: false`, so Render asks for them once instead of storing secrets in the file. Because Vite
  bakes `VITE_*` values **at build time**, changing one needs a new deploy.
- An SPA rewrite `/* → /index.html` so direct hits and refreshes on any path work (Render serves a
  real file first, so hashed assets are never rewritten).
- Cache headers: `/assets/*` immutable for a year (Vite fingerprints the filenames),
  `index.html` always revalidated, plus `X-Content-Type-Options`, `Referrer-Policy` and
  `Permissions-Policy`.
- The service is deliberately still called `academia` so the existing URL keeps working.

#### `.node-version`
Pins Node `22.22.0` for local and Render builds (Render reads it before anything else).

#### `README.md`
Human documentation: features, tech stack, setup, database setup, deployment, demo account.
Not used by the code.

---

### 4.2 Entry point

#### `src/main.js` — *the screen state machine*
**Role:** boots the app and decides which of three screens is visible. It is the only file that
knows the order **landing → auth → workspace**.

**State:** a single `let mode` (`"boot" | "landing" | "auth" | "app"`) plus handles to the two
long-lived screens (`workspaceHandle`, `landingHandle`). The handle from `mountWorkspace` and
`renderLanding` is a **cleanup function**, so switching screens never leaks timers or listeners.

**Functions**

| Function | What it does |
| --- | --- |
| `injectSvgDefs()` | Appends one hidden `<svg>` with shared gradients (`ringGrad`, `mintGrad`, `amberGrad`, `barGrad`) so every ring/progress bar can reference them by id |
| `boot()` | `applyMotionDataset()` → `ambientBackground()` → `showLanding()`; if the landing throws, it falls back to the auth screen |
| `showLanding()` | Tears down the workspace, asks Supabase whether a session exists, then `renderLanding(app, { signedIn, onGetStarted, onSignIn, onCreateAccount })` |
| `handleGetStarted()` | The "Get Started" decision: session → `startApp()` (skip auth); otherwise `showAuth()` |
| `showAuth({ initial })` | Renders the auth card; on success calls `startApp(user)` |
| `startApp(user)` | `fetchProfile()` → if the profile row is missing, sign out with a toast → else `setSession` + `setProfile` in the store, then `mountWorkspace(app, { profile, onSignOut })` and a quick fade-in |

**Also in this file**
- `supabase.auth.onAuthStateChange` — if the user is signed out *while in the workspace*, the
  shell is destroyed and the auth screen comes back.
- `window.addEventListener("error")` and `"unhandledrejection"` — log unexpected failures to the
  console with a consistent prefix.

> **If asked why the landing always shows first:** "A signed-in student should not be dropped into a
> dashboard they didn't ask for. The landing page is the product's front door; Get Started skips
> auth only when a session already exists."

---

### 4.3 The library — `src/lib/`

#### `config.js` — *constants*
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `FUNCTIONS_URL` — read from Vite env vars
  (`import.meta.env.VITE_*`) with a working fallback so a fresh clone runs with no `.env`.
- `APP` = `{ name: "Ayaan Academia", tagline, storagePrefix: "academia." }` — the single source of
  the product name (wordmark, dialog titles, etc.).
- `SUBJECTS`, `PRIORITIES` — option lists reused by the homework and planner forms.

> **If asked about the key being in the code:** "The *anon* key is public by design — it only
> grants what Row Level Security allows. The **service_role** key, which bypasses RLS, exists only
> inside the Edge Functions."

#### `supabase.js` — *the client*
- `createClient(url, anonKey, { auth: { persistSession, autoRefreshToken, storageKey: "academia.auth", flowType: "pkce" } })`
  → one shared client for the whole app; the session is persisted and auto-refreshed.
- `fetchProfile(userId)` — selects the profile row (`maybeSingle()`), returns `null` if missing.
- `unwrap({ data, error })` — one helper that turns a Supabase response into data-or-throw, used
  by every view so error handling stays consistent.

#### `api.js` — *Edge Function client*
- `class ApiError extends Error` — carries `status` and per-field `fields` so forms can highlight
  the exact input that failed (e.g. `{ username: "That username is already taken." }`).
- `invoke(name, payload, { auth })` — `fetch` to `${FUNCTIONS_URL}/${name}`, always sends `apikey`,
  and when `auth: true` attaches `Authorization: Bearer <access_token>` from the live session.
  Network failure → friendly message; non-2xx or `{ error }` → `ApiError`.
- The `api` object: `register`, `login`, `mockList`, `mockStart`, `mockAnswer`, `mockSubmit`,
  `mockReview`.

> **If asked:** "Every privileged operation goes through one function, so auth headers, error
> shapes and timeouts are defined once."

#### `store.js` — *tiny state + event bus*
- `state = { session, profile, view }`.
- `on(event, handler)` returns an unsubscribe function; `emit(event, payload)` calls every
  listener inside a `try/catch` so one broken listener can't break the others.
- `setProfile` / `setSession` update state and emit `profile:changed` / `session:changed`.
- `displayName()` and `firstName()` — safe fallbacks (`"Student"`) and nice greetings.
- The shell subscribes with `on("profile:changed", …)` so saving in Settings updates the sidebar
  instantly; `on`/`emit` also fire `homework:changed` for the sidebar badge.
- Custom DOM events (`academia:new-homework`, `academia:new-session`) are used for *cross-screen
  actions* — e.g. Overview's "New assignment" button navigates, then tells the Homework view to
  open its form.

#### `dom.js` — *formatting and safety helpers*
- `$ / $$` — query helpers.
- **`esc(value)`** — HTML-escapes `& < > " '`. **Every** user-supplied string goes through it
  before it lands in a template literal. This is the app's XSS defence.
- `debounce(fn, ms)` — used by the search box and the availability check.
- `store` — a `localStorage` wrapper with the `academia.` prefix that never throws (private mode).
- Date helpers: `fmtDate`, `fmtLongDate`, `fmtTime`, `fmtDateTime`, `fmtDeadline` ("Tomorrow",
  "3 days overdue"), `fmtRelative` ("5m ago"), `fmtMinutes` ("1h 15m"), `toLocalInput`/`dateInput`
  for `<input type="datetime-local">`, `startOfDay`, `weekdayShort`.
- Misc: `initials` (avatar letters), `clamp`, `pct`, `subjectTone` (stable colour per subject via a
  small string hash), `greeting` (time-of-day), `isTypingTarget` (so shortcuts ignore inputs),
  `downloadText`.

> **If asked about `subjectTone`:** "It hashes the subject name, so 'Mathematics' is always the same
> colour everywhere in the app without storing a colour per subject in the database."

#### `icons.js` — *icons without the weight*
- Imports ~90 named icons from `lucide` (the whole set is ~600 kB) into a `registry` map.
- `icon("GraduationCap", { size: 18 })` → an inline `<svg>` string with `aria-hidden="true"`,
  the right size and stroke width. Unknown names log a warning and return `""` instead of crashing.
- `attrsToString` / `renderNode` convert the icon's `[tag, attrs, children]` array into markup.

#### `motion.js` — *one place for all animation*
Every animation in the app routes through here, which is what makes the **reduced-motion** switch
work globally.

- `prefersReduced()` — true if the OS says reduce-motion *or* the student toggled it in Settings
  (`store.get("motion")`). `setMotionPreference()` and `applyMotionDataset()` write
  `html[data-motion="reduced|full"]`, which the CSS also honours.
- `splitChars()` / `revealChars()` — splits a headline into word/char spans for the landing hero
  reveal (words are kept intact so lines never break mid-word).
- `revealLines()`, `countTo()` (animated numbers), `animateBar()` (progress bar + counting label).
- `magnetic()` — premium "button follows the cursor a little" effect, desktop pointers only.
- `drawStrokes()` (SVG line drawing), `pulseOnce()`, `ambientBackground()` (slow drifting orbs).
- `scrollReveal(targets)` — reveals panels as they scroll, using `#view-scroll` as the scroll
  container (the workspace scrolls an inner div, not the window).
- `enterView()` / `exitView()` — the per-view entrance/exit choreography used by the router.
- `flipLayout(container, mutate)` — GSAP **Flip**: remembers element positions, runs the mutation,
  then animates from old to new. This is why filtering/sorting homework slides instead of jumping.
- `killScrollTriggers()` — cleans up every ScrollTrigger when a view unmounts.

> **If asked about accessibility:** "Every animation checks `prefersReduced()`; when it's on, the
> code sets the final state immediately instead of animating. Nothing becomes unusable."

---

### 4.4 UI parts — `src/ui/`

#### `brand.js` — the logo
- `brandMark(size, { animated })` — the "A" monogram as SVG, using the `brandGrad` gradient
  (blue → indigo → violet) plus a dashed orbit ring and a teal crossbar.
- `brandBlock({ tagline })` — mark + wordmark (`APP.name`) + tagline, used in the landing footer.
- `orbitArt()` — the large decorative orbit/ellipse illustration on the auth screen.

> The SVG carries `role="img"` and `aria-label` so it is announced as the product name.

#### `toast.js` — notifications
- `showToast({ title, message, type, duration })` appends a `.toast` to `#toast-root`, animates it
  in, runs a shrinking `.toast__bar` as a timer, then fades and removes it.
- Types: `success`, `error` (longer, 5.2 s), `info`, `sync` — each with its own icon.
- `toast.success/error/info` are the convenience wrappers.
- **Never throws**: if the toast root is missing, it just returns.

#### `modal.js` — dialogs
- `openModal({ title, subtitle, body, footer, wide, onMount })` builds the layer, locks body
  scroll, animates in, traps **Tab** focus, closes on **Escape**/scrim/`[data-close]`,
  auto-focuses `[data-autofocus]`, and restores focus to whatever was focused before.
  Returns `{ close, element, layer }`.
- `confirmDialog({ title, message, confirmLabel, danger })` returns a `Promise<boolean>` — used by
  delete/clear/sign-out flows, with a `settled` flag so it can only resolve once.

> **If asked about accessibility:** "Role dialog, `aria-modal`, focus trap, focus restore, Escape to
> close — the standard modal checklist."

---

### 4.5 Public landing page

#### `src/landing/landingView.js` (≈720 lines)
**Role:** the marketing/introduction page shown before login.

**Data (plain arrays at the top of the file)**
- `FEATURES` — the four tool cards (title, text, icon, tone, meta).
- `STEPS` — the three "how it starts" steps.
- `SLIDES` — **six** carousel images: `src`, `alt`, `tag`, `title`, `text`, width/height, and an
  `object-position` crop hint.
- `MOMENTS` — the three photo-strip tiles ("Desk notes", "Library table", "Between classes").

**Structure** (all rendered inside `renderLanding(root, { signedIn, onGetStarted, onSignIn, onCreateAccount })`):
`nav → hero → carousel ("A look inside") → why → audience → features → moments → steps → start band → footer`.

**Behaviour**
- Hero headline is revealed character-by-character (`revealChars`), other blocks with
  `scrollReveal` (`data-reveal` attributes).
- The nav CTA text changes with `signedIn` ("Get Started" vs. "Get Started · signed in"), and
  every `[data-get-started]` / `[data-nav-signin]` / `[data-create-account]` button is wired to the
  callbacks `main.js` passed in.
- `leave(action)` guards against double clicks, sets `aria-busy` on the buttons, fades the page out
  with GSAP, then runs the navigation callback. If the callback bails out, the page is restored —
  otherwise you'd be left with an invisible screen.

**`setupCarousel(carousel)`** — the whole carousel in ~120 lines:
- Slides are `<figure data-slide>`, dots are `[data-dot]`, counter is `[data-count]`.
- `goTo(index)` wraps with modulo, sets `.is-active`, `aria-hidden`, `aria-current` on dots and the
  `01 / 06` counter.
- Autoplay every **6.2 s** via `setInterval`, but a `paused` flag stops it on hover/focus, when the
  tab is hidden (`visibilitychange`) and when the carousel scrolls off screen
  (`IntersectionObserver`).
- Controls: previous/next buttons, dot clicks, **ArrowLeft/ArrowRight** when the frame has focus,
  and touch swipe (pointerdown/up with a 40 px threshold).
- CSS does the crossfade + slow Ken Burns zoom; slides 2–6 are `loading="lazy"`.
- Returns a cleanup function (clear interval, remove listeners, disconnect observer) which
  `renderLanding` returns to `main.js`.

> **If asked why the images are in `public/images/`:** "Files in `public/` are copied as-is and
> served by their path, so `/images/study-desk.jpg` just works — no bundler import needed."

---

### 4.6 Authentication screen

#### `src/auth/authView.js` (≈810 lines)
**Role:** login **and** registration on one animated card, plus the success screen.

`renderAuth(root, { onAuthed, initial = "login" })` → returns a cleanup function.

**Layout:** left "story" column (orbit art + headline + bullets), right card with two tabs.

**Validation helpers**
- `validateUsername` (`^[A-Za-z0-9_]{3,20}$`), `validateEmail`, `validatePhone`
  (`^\+?[0-9]{10,15}$` after stripping spaces/dashes), `validatePassword` (≥ 8 chars, letters + a
  number).
- `setError` / `clearError` / `setAlert` / `setBusy` — one consistent way to paint field errors, a
  form-level alert, and the button's busy state (`aria-busy` + spinner label).
- `passwordScore()` + the strength meter (weak → strong) with a labelled bar.

**Live availability** — `checkAvailability()` is debounced and calls
`supabase.rpc("check_signup_availability", { p_username, p_email, p_phone })`. The SQL function
returns **three booleans**, never account rows, so the form can say "available / taken" without
leaking anything.

**Login**
1. Client validation.
2. `api.login({ username, password })` → `username-login` Edge Function.
3. `supabase.auth.setSession({ access_token, refresh_token })` stores the session.
4. Card fades/blurs out, then `onAuthed(result.user)` → `main.js: startApp()`.
5. Errors → a form alert plus "check your password", and the field is selected for retyping.

**Registration**
1. Client validation + availability warning.
2. `api.register({ username, email, phone, password })` → `register-student` Edge Function.
3. Any per-field errors come back in `error.fields` and are painted under the right input.
4. `showSuccess(username)` replaces the form with a success panel: animated check ring, the
   `@username` the student will log in with, and a **Back to login** button.

**Extras:** `setMode(next)` animates between login/register (with a guard so it works even if the
mode is already set); `playIntro()` runs the entrance timeline; a pointer-move parallax on the
stage art; `prefersReduced()` skips all of it.

> **If asked "why username instead of email at login?":** "Students shouldn't have to remember which
> email they used. The server maps username → email in one query, so the convenience costs nothing
> in privacy — the browser never receives the email."

---

### 4.7 Application shell

#### `src/app/shell.js` (≈490 lines) — *chrome + router*
**Role:** the persistent frame around every workspace screen: sidebar, topbar, navigation, the
hash router, notifications and the account menu.

**Constants**
- `NAV` — 7 entries `{ id, label, icon, crumb, title }` (Overview, Homework, Study Planner,
  NCERT Books, Mock Tests, Performance, Settings).
- `MOBILE_NAV` — the 5 destinations in the phone bottom bar.
- `loaders` — `() => import("../views/x.js")` for each screen. **Dynamic imports** are what make
  each view a separate chunk that only downloads when first opened.

**`navigate(id, { replace, fromHash })` — the router**
1. Validate the id (`fallback → overview`), bail if already there or already navigating.
2. Paint the active nav item, move the sliding `.nav-pill` behind it, update title + breadcrumb,
   close the mobile drawer and any popover.
3. Push `#/<id>` into history (or `replaceState` on the first render).
4. `exitView()` the old view → run its **cleanup** function → `killScrollTriggers()` → clear it.
5. `await loaders[id]()` → `module.render(viewEl, ctx)` → store the returned cleanup.
6. `enterView()` animates the new screen in; `emit("view:changed")`.
7. On error: an inline "This section could not load" card with a working **Retry** button.

`onHashChange` keeps back/forward working. `document keydown` gives **Alt + 1…7** quick navigation
and Escape closes popovers/drawer.

**The `ctx` object every view receives**
| Member | Purpose |
| --- | --- |
| `profile` | getter for the signed-in student's row |
| `navigate(id)` | change screen |
| `refreshProfile()` | re-fetch the profile after editing it |
| `signOut()` | shared sign-out (from `main.js`) |
| `toast` | the toast function |
| `onHomeworkChanged()` | ask the shell to refresh the sidebar badge |

**Other pieces**
- `openNotifications()` — popover with the last six `activity_events` (RLS already limits them to
  this student) + an unread dot driven by `checkUnread()`.
- `openAccountMenu()` — name, class badge, *Account settings*, *Sign out* (with a confirm dialog).
- `refreshHomeworkBadge()` — `select id count exact head:true where status='pending'` — a **head
  request**, so it counts rows without downloading them.
- `syncProfileUI()` — name, initials avatar and class across the whole shell.
- `refreshProfile()` — re-reads the row and re-syncs.
- Returns `{ navigate, refreshProfile, destroy }`; `destroy()` removes listeners and triggers.

> **If asked why not a router library:** "Seven screens, one hash format. `navigate()` is ~40 lines
> and gives us exactly what we need: history support, per-view cleanup, and an error state."

---

### 4.8 The seven views — `src/views/`

Every view exports **one function**: `export async function render(root, ctx)`.
It renders into the element it's given and **returns a cleanup function** (or `undefined`).
That contract is what lets the router swap screens without leaks.

#### `_shared.js` — shared view pieces (imported by all views)
- `pageHead({ eyebrow, title, subtitle, actions })` — the standard page header.
- `panel({ title, iconName, hint, body, flush })` — the standard card shell.
- `emptyState({ iconName, title, text, action })` — the "nothing here yet" block.
- `loadingBlock(rows)` — skeleton placeholders.
- `themeCharts()` — sets Chart.js global defaults once (font, colour, tooltip style, animation
  respecting reduced motion).
- `makeChart(canvas, config, registry)` / `destroyCharts(registry)` — create a chart and always
  destroy it on cleanup (**Chart.js keeps its own canvas context; forgetting this leaks memory**).
- `gridScale` — the shared axis styling (no vertical gridlines, no border, padded ticks).
- `verticalGradient()` / `barGradient()` — pretty fills for line/bar charts.
- `ringMarkup()` + `animateRing()` — the circular progress ring (SVG `stroke-dasharray` maths:
  `circumference = 2πr`, offset = `circumference × (1 − percent)`).
- `CHART_COLORS` — the palette used by every chart.

#### `overview.js` — the dashboard
- Renders immediately with **skeleton placeholders**, then loads four things **in parallel**
  (`Promise.all`): homework, study sessions, graded test history (`student_test_history` view) and
  the last six `activity_events`.
- Computes everything client-side from those rows: totals, completed, pending, overdue,
  completion %, average/best score, today's planned minutes, the next session, and a 7-day
  series of homework completions + sessions.
- Paints: KPI cards (animated counters), a subject progress list (animated width bars), upcoming
  deadlines with priority dots, the ring with the average score, an activity timeline, a 7-day bar
  chart, and quick action buttons.
- Quick actions navigate **and** dispatch `academia:new-homework` / `academia:new-session`, so the
  target view opens its form for you.
- `priorityColor()` and `activityIcon()` are small pure helpers.
- Cleanup: `destroyCharts(charts)` + `killScrollTriggers()`.

#### `homework.js` — full CRUD
State: `tasks` (array), `filter`, `sort`, `query`.
- `load()` — select this student's homework ordered by deadline.
- `counts()` — all / pending / completed / overdue.
- `renderStats()` — the big "Your homework progress" bar: `animateBar()` for the fill,
  `countTo()` for the percentage and the four counters, `aria-valuenow` kept in sync.
- `visibleTasks()` — applies the search query (title/subject/description), the filter chip and the
  four sort modes (deadline, priority via `PRIORITY_RANK`, newest, A→Z).
- `cardMarkup()` / `renderList()` — the card grid, each card wired to toggle / edit / delete.
- **Optimistic updates:** `toggleTask()` flips the status locally, animates immediately
  (`flipLayout`), pulses the card, *then* writes to Supabase — and if the write fails it restores
  the previous object and shows an error toast. `deleteTask()` does the same with `splice` +
  rollback.
- `openForm(task?)` — one modal for create and edit: field validation, per-field error slots,
  `insert` or `update` with `.eq("user_id", ctx.profile.id)` as a second safety net, then a toast.
- `buildWeekChart()` — a 7-day chart of completed vs. created assignments.
- The search box is debounced (220 ms) and every filter/sort change goes through `flipLayout` so
  cards *move* instead of blinking.
- Listens for `academia:new-homework` (from the Overview quick action) and opens the form.
- Cleanup: remove that listener, destroy charts, kill triggers.

#### `planner.js` — study sessions
- State: `sessions`, `selected` (a day).
- `startOfWeek()` + `renderWeek()` — the Mon–Sun strip with per-day load dots; clicking a day
  re-renders the agenda.
- `renderDay()` — that day's sessions with duration, subject colour, completed state, and
  toggle / edit / delete per row.
- `renderUpcoming()` — the next sessions after today.
- `renderChart()` — "Week load": planned minutes per day.
- `toggleSession`, `deleteSession`, `openForm(session?)` — same optimistic + rollback pattern as
  homework, writing to `study_sessions`.
- Listens for `academia:new-session`; cleanup removes listeners and destroys the chart.

#### `ncert.js` — the class-wise library
- Loads `ncert_classes` and `ncert_books` in parallel (public read-only data).
- `renderRail()` — Class 1…12 tiles with book counts; clicking one filters instantly.
- `renderSubjectBar()` — subject chips for that class.
- `renderBooks()` — cover-styled cards using `book_code`, subject, language; **Open** and
  **Download** buttons link to the official `ncert.nic.in` URLs (opened with
  `target="_blank" rel="noopener noreferrer"`).
- A pointer-move tilt effect on the cards (skipped for reduced motion).
- No writes at all — this view is read-only.

#### `mocks.js` — the exam engine (the most complex view)
**List screen:** `load()` → `api.mockList()` (tests + my attempts). `renderSubjects()` groups tests
by `mock_subjects`; `renderTests()` shows each paper with question count, duration, difficulty and
your best/last score; `renderHistory()` lists the last eight completed attempts.

**Instructions:** `showInstructions(test)` — a modal with rules and a **Start** button (or
**Resume** when an `in_progress` attempt exists).

**`openExam(test, { resume })` — the exam overlay**
1. Full-screen `role="dialog"` overlay, body scroll locked.
2. `api.mockStart()` — server creates/resumes the attempt and returns questions **without** answers,
   the saved answers, and `remaining_seconds`. If the server says `expired`, it returns the graded
   result and the UI jumps straight to the result screen.
3. `answers` is a `Map<questionId, { selected, marked }>` mirrored from the server's saved answers.
4. Timer: one `setInterval` per second; the deadline comes from the **server**, so refreshing or
   changing the clock doesn't buy extra time. It goes amber at 2 minutes and red at 30 seconds, and
   auto-submits at zero.
5. `selectOption(key)` — clicking toggles/sets the choice, repaints options and the palette, then
   `persist()` → `api.mockAnswer()`. A `save-indicator` shows *saving → saved*, or **not saved**
   after 8 seconds if the request hangs. (No auto-advance — the student can change their mind.)
6. `toggleMark()` — mark for review.
7. Palette (`renderPalette`) shows answered / unanswered / marked per question and jumps on click.
8. `submitAttempt()` — a confirm dialog summarises answered/unanswered/marked, then
   `api.mockSubmit()`, then repaints the overlay as a **result screen** (score ring, correct /
   incorrect / unanswered, review + done buttons) and refreshes the list.
9. `showResult()` picks the headline by percentage (≥85 Outstanding, ≥70 Strong work, ≥50 Getting
   there, else Keep building).
10. Cleanup: clears the timer, removes the keydown listener, unlocks the body.

**Review:** `api.mockReview()` returns the same questions **plus** `correct_option`, `explanation`
and what you picked — possible only because the attempt is `completed`.

> **If asked "how do you stop cheating?":** "The browser never receives an answer key. The only
> endpoint that reveals answers requires a submitted attempt, and the questions table has **no RLS
> policy at all**, so a logged-in student can't query it directly either."

#### `performance.js` — analytics from real records
- Loads graded history, homework, sessions and 70 days of `activity_events` in parallel.
- Computes: attempts, average, best, homework completion rate, total study minutes, per-subject
  averages, the last-12-attempt trend, an 8-week homework completion trend, and a 70-cell activity
  heatmap (`maxHeat` normalises the colour scale).
- Renders KPI cards, a line chart of your score trend, a per-subject bar chart, the heatmap grid,
  the homework-momentum chart, and the attempt history table (test title, date, score pill).
- `emptyState()` if there's nothing yet; every chart is registered and destroyed on cleanup.

#### `settings.js` — account and preferences
Four panels: **Student profile**, **Security**, **Preferences**, **About**.

- **Profile** — display name, class, username, phone, email (read-only). Validates with the same
  regexes as registration, saves with `update`, and handles Postgres error **`23505`** (unique
  violation) by naming the offending field. Updates the store so the sidebar changes instantly.
- **Security** — new password + confirm with a live strength meter; saves via
  `supabase.auth.updateUser({ password })`.
- **Preferences** — the reduced-motion switch (`setMotionPreference`).
- **Data** — *Load demonstration data* inserts a handful of `[Demo]`-prefixed homework rows and
  sessions (clearly marked, easy to delete); *Reset workspace* deletes this student's homework and
  sessions after a confirmation.
- **Sign out** — confirmation dialog → `ctx.signOut()`.
- **About** — version, stack, a one-line description.

---

### 4.9 Styles — `src/styles/`

Five stylesheets, imported once at the top of `main.js`. They are plain CSS with **design tokens**
(CSS custom properties) — no preprocessor, no utility framework.

#### `base.css` — foundation (≈900 lines)
- `:root` tokens: surfaces (`--ink-1000 … --ink-700`), text (`--text`, `--text-soft`, `--muted`,
  `--muted-dim`), accents (`--blue`, `--violet`, `--cyan`, `--amber`, `--rose`, `--mint`), lines
  (`--line`, `--line-strong`), glass gradients, shadows, radii, easing curves, font stacks,
  `--sidebar-w`.
- Reset, typography, focus rings, `::selection`, scrollbars.
- Atmosphere: `.app-bg`, `.aurora`, `.app-grid`, `.app-noise`, `.app-vignette`.
- Components: `.btn` (+ primary/ghost/danger/sm/icon), fields and inputs, `.badge--*` status pills,
  `.toast`, `.modal`, `.icon-btn`, `.skeleton`, `.divider`, `.gradient-text`.
- `color-scheme: light` so native controls (date pickers, scrollbars) match.

> **If asked "how did you switch the whole site to a light theme?":** "Almost everything reads from
> tokens in `:root`. Converting the theme meant retuning those tokens and the handful of literal
> colours inside components — not rewriting every screen."

#### `auth.css` — the login/registration screen
Story column typography, `.auth-card`, tabs with a sliding pill, field states (valid/invalid),
password strength meter, the success panel, and the orbit art positioning.

#### `shell.css` — the workspace frame
`.workspace` layout grid (sidebar + main), sidebar (expanded/compact/drawer states), nav items with
the sliding `.nav-pill`, topbar, `.date-chip`, popovers, profile card/avatar, mobile bottom nav,
and the responsive breakpoints that turn the sidebar into a drawer under 1000 px.

#### `views.css` — everything inside the screens (≈2360 lines, the biggest file)
Page headers, KPI cards, panels, the homework progress bar, cards/grids, the week strip, class
tiles, book cards, test rows, the **exam overlay** (question, options, palette, timer), charts
wrappers, heatmap, tables, empty states, profile hero.

#### `landing.css` — the public page (≈1400 lines)
Nav, hero (title/copy/art/float chips), carousel (frame, slide transitions, scrim, caption, arrows,
dots), why/audience/features/steps/start-band/footer, the photo strip, and the responsive rules
(3-up → 2-up → 1-up) plus reduced-motion overrides.

**Motion classes** used by GSAP: `.word` / `.char` spans from `splitChars`, `html[data-motion]`
rules, and `[data-reveal]` targets.

---

### 4.10 Backend — `supabase/`

#### `schema.sql` — the whole database in one file
1. **`set_updated_at()`** — trigger function that stamps `updated_at` on every update.
2. **`profiles`** — `id` (FK to `auth.users`), `username` + `username_lower` (unique),
   `email` + `email_lower` (unique), `phone` (unique), `display_name`, `class_level`, `accent`.
   The `*_lower` columns are what make case-insensitive uniqueness trivial.
3. **`activity_events`** — the feed (`kind`, `title`, `detail`, `meta`). Written by triggers and by
   the mock-test function.
4. **`homework`** — title, description, subject, deadline, `priority` enum
   (`high|medium|low`), `status` enum (`pending|completed`), `completed_at`. Indexes on
   `(user_id, deadline)` and `(user_id, status)`.
   Trigger `homework_after_change()` keeps `completed_at` honest (set on complete, cleared on
   reopen) and writes the feed entry.
5. **`study_sessions`** — title, subject, `scheduled_at`, duration (minutes), notes, completed, with
   the same activity trigger.
6. **`ncert_classes` / `ncert_books`** — public catalogue. Classes 1–12; each book keeps its
   official `ncert.nic.in` URL and an optional download URL.
7. **`mock_subjects` / `mock_tests` / `mock_questions`** — five subjects, tests with a duration and
   difficulty, questions with `option_a…d` and `correct_option` (+ `explanation`).
8. **`test_attempts` / `test_answers`** — one attempt row per paper (unique index allows only one
   `in_progress` attempt per student+test), and one answer row per question, unique per attempt.
9. **`check_signup_availability(...)`** — `SECURITY DEFINER` SQL function returning three booleans.
   `revoke all … from public` then `grant execute … to anon, authenticated`, so it's the only
   anonymous read path into `profiles`, and it returns no rows.
10. **`student_test_history`** — a **view** (`security_invoker = true`) joining attempts to tests and
    subjects with a computed `percentage`. This is why the dashboards can ask for one thing instead
    of doing three joins in the browser.

#### `seed.sql`
Reference data: the five `mock_subjects`, the NCERT classes and books (with official URLs), and a
set of mock tests with questions. Run once after `schema.sql`.

#### `demo-data.sql`
Optional: a full demonstration workspace for a given user (homework, sessions, attempts) so the
dashboards have something to show on day one.

#### `functions/username-login/index.ts`
Public (`--no-verify-jwt`). Validates input length → looks up the profile by `username_lower` with
the **service role** → if not found, waits 350 ms and returns the same generic error (no account
enumeration) → otherwise performs a real `signInWithPassword` with the **anon** client → returns
only `{ access_token, refresh_token, … }` and `{ id, username }`. The email never leaves the server.

#### `functions/register-student/index.ts`
Public. Validates every field server-side (same regexes as the client), re-checks duplicates with
the service role (never trusting the client), `admin.auth.admin.createUser({ email_confirm: true })`,
inserts the linked `profiles` row, and — if that insert fails — **deletes the auth user** so no
orphan accounts are left behind. Returns `{ error, fields }` with 422/409 so the form can highlight
exactly what to fix. The first `activity_events` row ("Joined Ayaan Academia") is written here.

#### `functions/mock-test/index.ts` — the exam server
Requires a user JWT (it verifies the token and derives `userId` from it — never from the body).
Five actions:

| Action | What the server does |
| --- | --- |
| `list` | Active tests with subject + question count, plus this student's attempts |
| `start` | Creates/resumes the single `in_progress` attempt, computes `remaining_seconds` from the stored `started_at`, returns questions **without** `correct_option`; if time already ran out it grades and returns `expired` |
| `answer` | Upserts one `test_answers` row (validates ownership + status) |
| `submit` | Grades: compares every answer to the key, writes counts/percentages/`completed_at`, logs an activity event, returns the result |
| `review` | Only for a `completed` attempt: returns questions with `correct_option`, `explanation`, your answer and whether it was right |

`loadAttempt(id)` is the ownership check reused everywhere: it loads the attempt and returns `null`
unless `attempt.user_id === userId`. The JWT is verified with `admin.auth.getUser(token)`, and
`userId` is taken from that — never from the request body, so a student can't act on someone else's
attempt by editing the payload.

> `GRACE_SECONDS = 45` is declared for a "accept a submit a few seconds late" allowance but is not
> enforced yet — see Known limits.

---

## 5. Database at a glance

| Table | Rows per student | Who can read | Who can write |
| --- | --- | --- | --- |
| `profiles` | 1 | own row | own row (insert on signup) |
| `homework` | many | own | own (insert/update/delete) |
| `study_sessions` | many | own | own |
| `activity_events` | many | own | own inserts (feed is mostly written by triggers) |
| `ncert_classes` / `ncert_books` | 0 (shared) | everyone signed in | nobody (seed only) |
| `mock_subjects` / `mock_tests` | 0 (shared) | everyone signed in (active only) | nobody |
| `mock_questions` | 0 (shared) | **nobody** — no policy | only the Edge Function |
| `test_attempts` / `test_answers` | many | own | **only the Edge Function** (read-own for display) |

**Triggers**
- `set_updated_at()` → `updated_at` on profiles, homework, study_sessions.
- `homework_after_change()` → keeps `completed_at` correct + writes `homework` / `homework_done`
  activity rows.
- `study_session_after_change()` → writes `session` / `session_done` activity rows.

**Views / functions**
- `student_test_history` — attempts + test + subject + `percentage` (used by Overview & Performance).
- `check_signup_availability(...)` — anonymous, boolean-only availability check.

---

## 6. Security model (the part to say slowly)

| Threat | Defence |
| --- | --- |
| Reading another student's homework | **RLS**: `using (user_id = auth.uid())` on every personal table |
| Writing to another student's row | `with check (user_id = auth.uid())` on insert/update; the UI also filters by `user_id` |
| Stealing the answer key | `mock_questions` has **no RLS policy**, so the anon/user key can't select it; only the Edge Function (service role) can |
| Peeking at answers mid-exam | `start` returns questions without `correct_option`; `review` requires `status = 'completed'` |
| Faking a score | Grading happens server-side; the client never sends a score |
| Faking exam time | `remaining_seconds` is computed from the server's `started_at`, not a client timer |
| Username enumeration at login | Unknown username and wrong password give the same message **and** a 350 ms sleep |
| Duplicate accounts | Unique indexes on `username_lower`, `email_lower`, `phone`, **plus** server-side re-check before `createUser` |
| XSS through user text | Every interpolation goes through `esc()`; no `innerHTML` of raw user data |
| Orphan accounts | If the profile insert fails, the Edge Function deletes the auth user |
| Session hijack via URL | `detectSessionInUrl: false`; tokens live in `localStorage` and are refreshed automatically |
| Tab focus escaping a modal | Focus trap + focus restore in `ui/modal.js` |

> **The one-liner:** "The browser is untrusted. Anything a student could tamper with — the answer
> key, the score, the clock, account creation — lives behind a server function or an RLS policy."

---

## 7. The design system, briefly

- **Tokens first.** Surfaces, text, accents, lines, shadows, radii and easing curves are CSS
  variables in `base.css`. Components reference them, so the light-theme conversion was mostly a
  token swap plus per-component colour fixes.
- **Light palette:** page `#f6f7fb`, cards `#ffffff`, text `#0e1729` / `#2b3752` / `#5b6780` /
  `#667086`, brand `--blue #3861e8`, `--violet #7a3ff0`, `--cyan #0f766e`, `--mint #0b7a5a`,
  `--rose #c22f72`, `--amber #b45309`. Accents were darkened deliberately so coloured text passes
  contrast on white.
- **Type:** Sora (display), Inter (body), JetBrains Mono (labels, numbers, counters).
- **Motion:** everything in `lib/motion.js`, all behind `prefersReduced()`; the Settings switch
  writes a `data-motion` attribute that CSS also honours.
- **Charts:** Chart.js with a shared theme (`_shared.js`), colours from `CHART_COLORS`.

---

## 8. "Where would I change X?" cheat sheet

| Task | File(s) |
| --- | --- |
| Product name / tagline | `lib/config.js` (`APP`) — used by the wordmark and dialogs |
| Colours, spacing, shadows | `styles/base.css` `:root` tokens |
| Add a workspace screen | New `views/x.js` exporting `render(root, ctx)` → add to `NAV` + `loaders` in `app/shell.js` (+ `MOBILE_NAV` if it belongs on phones) |
| Add a field to homework | `schema.sql` (column) → `views/homework.js` (`openForm` + `cardMarkup` + `select`) |
| Change subjects/priorities | `lib/config.js` (and the enums in `schema.sql` if stored) |
| Change validation rules | `auth/authView.js` + `functions/register-student/index.ts` (**both** — the server is the real gate) |
| Change exam grading | `functions/mock-test/index.ts` → `grade()` |
| Add a landing section | `landing/landingView.js` template + `styles/landing.css` |
| Change carousel timing | `landingView.js` → `AUTOPLAY_MS` (currently 6200) |
| Swap carousel images | `public/images/*.jpg` + the `SLIDES` array |
| Change what the notification bell shows | `app/shell.js` → `openNotifications()` |
| Deployment settings | `render.yaml`, `.node-version` |

---

## 9. Viva Q&A

**1. What is this project?**
A study workspace for school students: homework tracking, a study planner, an NCERT textbook
library, server-graded mock tests, and performance analytics — as a single-page web app.

**2. What stack?**
Vanilla JS + Vite on the front end, CSS with custom-property tokens, GSAP for motion, Chart.js for
charts, Supabase (Postgres + Auth + Edge Functions) as the backend, deployed as a static site on
Render.

**3. Why no React?**
The UI is seven independent screens rendered once and updated with targeted DOM code. That keeps the
bundle small and forces us to understand exactly what changes — and it made the design system pure
CSS. React would add a build/runtime layer without removing real complexity here.

**4. How does routing work?**
A hash router in `shell.js`: `#/homework` maps to the id `homework`, which the router dynamically
imports and renders into one container, running the previous view's cleanup first. Back/forward work
via `hashchange`.

**5. How is a view structured?**
Each exports `render(root, ctx)`, builds its markup, wires events, awaits its data, and returns a
cleanup function. The router always calls that cleanup before mounting the next screen.

**6. Where does the data come from?**
Supabase/Postgres through the official client (`supabase.from("homework").select(...)`). The
dashboards read views (`student_test_history`) and aggregate in JS.

**7. Why is the anon key in the front end?**
It's public by design — it only permits what RLS allows. The privileged `service_role` key exists
only inside the Edge Functions.

**8. What is RLS and why does it matter?**
Row Level Security makes the *database* enforce ownership: every select/insert/update/delete on
`homework` carries `user_id = auth.uid()`. Even with a valid token, a tampered request can't touch
another student's rows.

**9. How is login by username done, and why?**
The `username-login` Edge Function maps username → email with the service role and then performs a
normal Supabase password grant. Students don't need to remember an email, and
the email never reaches the browser.

**10. How do you stop someone reading the answer key?**
Three layers: `mock_questions` has no RLS policy (so the client can't query it), the `start` action
strips `correct_option`, and `review` refuses unless the attempt is already submitted.

**11. How is the score computed?**
Server-side only, in the `mock-test` function: it compares each saved answer to `correct_option`,
writes correct/incorrect/unanswered counts and `completed_at`. The client just displays what the
server returns.

**12. What happens if the internet drops mid-exam?**
Every answer is saved individually as it's clicked, and the save indicator turns to "not saved" if
the request hangs. Refreshing resumes the same attempt with the saved answers restored, and the
remaining time comes from the server's `started_at`, so nothing is lost or gained.

**13. How do you handle a student leaving mid-test?**
The attempt stays `in_progress` (only one per test, enforced by a unique index). Reopening offers
**Resume**; if the clock already expired, `start` grades it and returns `expired: true`.

**14. What happens if two devices sign in?**
Each device holds its own session; the database is the single source of truth, so the next load on
either device reflects the other's writes.

**15. How is XSS prevented?**
Every user string is escaped with `esc()` before insertion, and the app never assigns raw user data
to `innerHTML`.

**16. Why edge functions instead of doing registration in the browser?**
Creating an auth user and guaranteeing unique username/email/phone atomically needs the admin key,
which must never ship to the browser. Also, validation must be re-run server-side because client
validation is only a convenience.

**17. How does the app handle slow networks?**
Skeletons while loading, optimistic UI for toggles with rollback on failure, explicit busy states on
buttons (`aria-busy`), and toasts that say what failed — never a silent no-op.

**18. Accessibility?**
Semantic landmarks, `aria-current` on nav, `aria-pressed`/`aria-selected` on toggles and tabs, focus
traps and focus restore in dialogs, `aria-live` toast region, visible focus rings, alt text on every
image, and a reduced-motion mode honoured by both JS and CSS.

**19. What's the biggest technical challenge?**
The mock-test engine: one timer, per-question persistence, resume-after-refresh, auto-submit on
expiry, and grading that stays server-side — plus a UI that reports the saving state honestly.

**20. What would you improve next?**
Remove the unused `lenis` dependency, add automated tests (unit tests for the pure helpers, an
integration test for the exam flow), move the demo-data seeding into a function instead of the
browser, add pagination to attempt history, and add an offline queue for answers saved while
disconnected.

---

## 10. Glossary

| Term | Meaning |
| --- | --- |
| **SPA** | Single-page application — one HTML file; JS swaps the visible screen |
| **Vite** | Build tool + dev server; bundles and code-splits with Rollup under the hood |
| **ES module** | `import` / `export` syntax; each file is its own scope |
| **Dynamic import** | `import("./x.js")` inside a function → loaded on demand, becomes its own chunk |
| **RLS** | Row Level Security — Postgres policies that filter rows per user |
| **JWT** | Signed token proving who is signed in; sent as `Authorization: Bearer …` |
| **anon / service_role key** | Public client key / secret server key that bypasses RLS |
| **Edge Function** | Small serverless function (Deno) deployed next to the database |
| **PostgREST** | The layer that turns PostgREST-style queries into SQL (what `supabase.from()` speaks) |
| **Trigger** | Postgres function that runs automatically on insert/update |
| **View** | Saved query that behaves like a read-only table |
| **Upsert** | Insert, or update if the row already exists |
| **Optimistic UI** | Update the screen immediately, then reconcile with the server |
| **GSAP / ScrollTrigger / Flip** | Animation library / scroll-driven animation / layout-transition helper |
| **Design token** | A named CSS variable (`--text`, `--r-lg`) used instead of a literal value |

---

## 11. Known limits (be first to say these — it sounds confident)

1. **No automated tests yet.** Verification has been manual plus scripted smoke checks (build +
   jsdom render of the landing/auth/workspace paths).
2. **`lenis` is an unused dependency** — safe to delete from `package.json`.
3. **Demo data is inserted from the browser** (`settings.js`) rather than a server function; it's
   clearly prefixed `[Demo]` and is deletable, but a function would be cleaner.
4. **No pagination** on attempt history (it shows the latest 8) or on large homework lists.
5. **The exam deadline is enforced in the UI, not on the server.** `start` computes the remaining
   time and the client auto-submits at zero, and a reopened attempt is graded immediately if time
   expired — but `answer` and `submit` don't check the clock, so a hand-crafted API call could keep
   writing answers after time. The fix is one condition using the existing `GRACE_SECONDS` constant.
6. **The Edge Functions must be redeployed** by hand after changes (`supabase functions deploy …`);
   the deployed `register-student` still writes the old product name in the welcome notification.
7. **Storage keys still use the `academia.*` prefix** on purpose, so existing sessions and
   preferences survive the rename.

---

*Last updated with commit `9ef4824` (rebrand to Ayaan Academia).*
