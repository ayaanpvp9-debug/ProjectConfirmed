# Ayaan Academia — short file notes

**The whole idea in three lines:** it's a single-page app (one `index.html`, JavaScript swaps the
screen). All data lives in Supabase/Postgres, and Row Level Security means a student can only touch
their own rows. Anything that must not be trusted to the browser — sign-up, username login, exam
grading — runs in three small server functions.

---

## Root files

- **`index.html`** — the only HTML page. Holds `#app` (where every screen renders), `#modal-root` and
  `#toast-root` (so dialogs/toasts float above everything), plus the fixed background layers (orbs,
  grid, noise, vignette).
- **`package.json`** — project manifest and scripts (`dev`, `build`, `preview`). `"type": "module"` makes
  every `.js` file an ES module. Dependencies: Supabase client, GSAP (animation), Chart.js, Lucide icons.
- **`vite.config.js`** — build/dev-server settings only: host `0.0.0.0:5173`, `allowedHosts` so the
  hosted preview works, HMR off because the preview is proxied. No app logic.
- **`render.yaml`** — deployment as code. Builds `dist/`, rewrites every path to `index.html` (so
  refreshes work), caches `/assets` forever, and takes the two public Supabase values as env vars.
  `NODE_VERSION` pins the build.
- **`.node-version`** — just the Node version (`22.22.0`) so local and render builds match.
- **`README.md`** — human documentation: features, setup, database, deployment.

---

## Entry point

- **`src/main.js`** — the screen state machine. Boots the app and decides which of three screens is
  visible: **landing → auth → workspace**. If a session already exists, "Get Started" skips auth and
  opens the workspace; otherwise it shows the login card. It also owns the Supabase session check and
  the sign-out listener, and keeps a cleanup handle for whichever screen is mounted so nothing leaks.

---

## `src/lib/` — plumbing used everywhere

- **`config.js`** — constants: Supabase URL + **anon** key (public by design, falls back so a fresh
  clone runs), the Edge Functions URL, the app name, and the subject/priority option lists.
- **`supabase.js`** — creates the one shared Supabase client (session persisted under `academia.auth`,
  auto refresh), plus `fetchProfile()` and `unwrap()`, which turns a response into data-or-throw.
- **`api.js`** — the only place that calls the Edge Functions. Adds the API key, attaches the user's
  token when the endpoint needs it, and converts failures into an error type that carries per-field
  messages so forms can highlight the exact input.
- **`store.js`** — tiny state holder (`session`, `profile`, `view`) plus a subscribe/emit event bus, so
  saving your profile in Settings updates the sidebar instantly. Also used for cross-screen commands
  ("open the new-assignment form").
- **`dom.js`** — the shared toolbox: `esc()` (escapes user text — this is the XSS defence), `debounce`,
  a safe `localStorage` wrapper, all the date/number formatters ("Tomorrow", "3 days overdue", "1h 15m"),
  initials, and a stable colour per subject via a small hash.
- **`icons.js`** — imports only the ~90 Lucide icons the app actually uses and renders them as inline
  SVG strings. Importing the whole set would add ~600 kB to the bundle.
- **`motion.js`** — every GSAP animation lives here, which is what makes the **reduced-motion** switch
  work globally: each helper checks the preference and, if it's on, jumps straight to the final state
  instead of animating. Also the page-transition helpers, count-up numbers, and the FLIP animation that
  makes filtering/sorting slide cards instead of blinking them.

---

## `src/ui/` — reusable pieces

- **`brand.js`** — the logo as SVG (the "A" monogram with the brand gradient), the wordmark block, and
  the decorative orbit illustration on the auth screen.
- **`toast.js`** — the little notification cards. Never throws; if the toast container is missing it just
  does nothing.
- **`modal.js`** — dialogs: focus trap, Escape to close, focus restore, scroll lock, animations. Also
  `confirmDialog()`, which returns a `Promise<boolean>` used by every delete / reset / sign-out flow.

---

## Screens

- **`src/landing/landingView.js`** — the public page shown before login: nav, hero, a **six-image
  carousel**, why/audience/features, a **three-photo strip**, steps, closing band and footer. Its
  carousel handles autoplay (paused on hover, hidden tab, or off-screen), arrows, dots, arrow keys and
  swipe, and it cleans all of that up when you leave. It also contains the page's copy (features, steps,
  slides, photos) as plain arrays at the top of the file.
- **`src/auth/authView.js`** — login and registration on one animated card. It validates fields
  client-side, checks username/email/phone availability live (a database function that returns only
  true/false, never account rows), then calls the server function to register or log in. Also the
  password strength meter and the success screen.
- **`src/app/shell.js`** — the app frame: sidebar, topbar, notifications, account menu, and the
  **router**. Seven screens, one hash per screen (`#/homework`); switching fades the old view out, runs
  its cleanup, lazily imports the new module and animates it in. Also keeps the sidebar badge and
  avatar in sync, and Alt+1…7 jumps between screens.

---

## `src/views/` — the seven tools

Every view exports one function, `render(root, ctx)`: it draws the screen, waits for its data, and
returns a cleanup function. That contract is what lets the router swap screens safely.

- **`_shared.js`** — what the views have in common: the standard page header and panel shell, empty and
  loading states, all Chart.js theming, chart creation/destruction, the circular progress ring, and the
  chart colour palette.
- **`overview.js`** — the dashboard. Loads homework, sessions, graded tests and recent activity in
  parallel, computes the numbers itself (completion %, average score, overdue count, today's minutes),
  then paints KPI cards, the score ring, upcoming deadlines, the 7-day chart and the activity timeline.
  Quick-action buttons also open the target screen's form for you.
- **`homework.js`** — homework CRUD. Search, filters, four sort modes, the big progress bar, and the
  7-day chart. Toggles and deletes update the screen **immediately**, then save; if the save fails it
  rolls back and tells you — that's why it feels instant but stays honest.
- **`planner.js`** — study sessions: a Mon–Sun strip, the selected day's agenda, an upcoming queue and a
  weekly load chart. Same optimistic-save-then-rollback pattern as homework.
- **`ncert.js`** — the textbook library. Loads classes (1–12) and books, filters by class and subject, and
  links each book to its official `ncert.nic.in` page. Read-only: no writes at all.
- **`mocks.js`** — the exam engine (the most complex file). Subject → test list → instructions → a
  full-screen exam with timer, palette, mark-for-review, and every answer saved to the server as you
  click → submit → result and review. The clock comes from the **server**, so refreshing doesn't buy
  time; if you come back after time ran out, the server grades what was saved.
- **`performance.js`** — analytics from real records only: average/best score, homework rate, study
  minutes, score trend, per-subject averages, an 8-week homework trend and a 70-day activity heatmap.
- **`settings.js`** — profile editing (with duplicate handling), password change with strength meter,
  the reduced-motion switch, demo-data loading, workspace reset, sign out, and an About panel.

---

## `src/styles/` — five stylesheets

- **`base.css`** — the design foundation: all the **tokens** (surfaces, text, brand colours, lines,
  shadows, radii, easing), reset/typography, the background atmosphere, and the shared components
  (buttons, inputs, badges, toasts, modals, skeletons, scrollbars). Because almost everything reads
  from tokens, switching the whole site to a light theme was mostly a token swap.
- **`auth.css`** — the login/registration screen: card, tabs, field states, strength meter, success panel.
- **`shell.css`** — the workspace frame: sidebar (expanded / compact / mobile drawer), sliding nav pill,
  topbar, popovers, profile card, mobile bottom nav.
- **`views.css`** — everything inside the screens: KPI cards, panels, tables, the exam overlay, heatmap,
  empty states. The biggest file.
- **`landing.css`** — the public page, including the carousel (fade, Ken Burns zoom, scrim, arrows, dots)
  and its 3-up → 2-up → 1-up responsive behaviour.

---

## `supabase/` — the backend

- **`schema.sql`** — the whole database in one file: the tables (profiles, homework, study sessions,
  activity feed, NCERT catalogue, mock subjects/tests/questions, attempts/answers), the enums, the
  indexes, the triggers that keep `completed_at` correct and write the activity feed, the RLS policies,
  the boolean-only availability function, and the `student_test_history` view the dashboards read.
- **`seed.sql`** — reference content: the five subjects, NCERT classes and books with official links, and
  the mock tests with their questions.
- **`demo-data.sql`** — optional sample homework/sessions/attempts so the dashboards have something to
  show on day one.
- **`functions/username-login`** — server-side: maps username → email (with the service key) then does a
  normal password sign-in. The email never reaches the browser, and a wrong username costs the same
  delay and message as a wrong password.
- **`functions/register-student`** — server-side: re-validates everything, re-checks duplicates, creates
  the auth user and the profile row, and deletes the auth user if the profile insert fails (no orphans).
- **`functions/mock-test`** — server-side exam: creates/resumes the attempt, returns questions **without
  the answer key**, saves each answer, grades on submit, and only then reveals solutions. `mock_questions`
  has no RLS policy at all, so the answer key is unreachable from the browser.

---

**One sentence for the examiner:** the browser is treated as untrusted — anything a student could
tamper with (answer key, score, exam clock, account creation) lives behind either a database policy or
a server function.
