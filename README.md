# ACADEMIA — Student Workspace

A full-stack study platform for school students: a public introduction page, secure
authentication, homework management, a study planner, a class-wise NCERT library,
server-graded mock tests and a performance dashboard. Built with **HTML5, CSS3 and vanilla JavaScript** — no React, Vue or Angular.

Everything the dashboard shows is queried from Supabase in real time. There are no hard-coded
scores, no fake statistics and no placeholder buttons.

---

## 1. Feature map

| Area | What it does |
| --- | --- |
| **Landing page** | Public introduction — no account needed. Explains what ACADEMIA is, why it exists, who it serves (school students, Class 1–12) and the four tools inside, with a prominent **Get Started** button. If the visitor already has a session, Get Started opens their workspace directly; otherwise it opens the auth screen. |
| **Authentication** | Registration Registration (email + phone + username + password) validates format, checks duplicates through a `SECURITY DEFINER` RPC, creates the Supabase Auth user through an Edge Function and stores the extra fields. Animated success screen with a prominent *Back to login*. Login accepts **username + password only**. |
| **Overview** | Greeting with the student's name, live date, homework completion percentage, completed/pending/overdue totals, upcoming deadlines, mock tests attempted, average score and a recent activity timeline — all from Supabase rows. |
| **Homework Manager** | Full CRUD (subject, deadline, priority, status), search, status/subject filters, five sort modes, overdue highlighting, optimistic toggles, animated *YOUR HOMEWORK PROGRESS* bar with counting percentage, and a 7-day completion chart. |
| **Study Planner** | Session CRUD (subject, date-time, duration, notes, completed), a week strip, a day agenda and an upcoming queue, plus a weekly load chart. |
| **NCERT Library** | Organised **class-wise (Class 1 – 12)**, with a subject filter, cover-styled cards and official `ncert.nic.in` *Open* / *Download* links. Only verified URLs are stored. |
| **Mock Tests** | Exactly five subjects (DB-driven). Subject → test list → instructions → timed exam with palette navigation, mark-for-review, live server-side answer saving (refresh-safe), submit confirmation, server-side auto-grading and a solution review. |
| **Performance** | Score trend, subject averages, homework momentum, a 10-week activity heatmap and full attempt history — each chart animated once, from real records. |
| **Settings** | Profile editing (display name, class, username, phone), password change with strength meter, reduced-motion switch, demonstration-data loader, workspace reset and sign out. |

### Interface details

* Public landing page first, then auth, then the workspace — the landing uses the same palette, type and GSAP motion.
* Collapsible sidebar with icon-only mode, unread notifications popover and account menu.
* Hash-based routing (`#/overview`, `#/homework`, …) with animated view transitions — **no full page reloads**.
* Keyboard: `Alt+1…7` switches views, `1–4` selects an option in an exam, `←/→` moves between questions, `M` marks for review.
* Responsive from desktop to 480 px; respects `prefers-reduced-motion` and persists the in-app choice.
* GSAP core, ScrollTrigger, Flip and TextPlugin are used with distinct motion per section (no single fade-in everywhere).

---

## 2. Tech stack

* **UI**: semantic HTML + hand-written CSS (design tokens, glass panels, CSS grid), vanilla ES modules.
* **Animation**: [GSAP](https://gsap.com/) 3 — core, ScrollTrigger, Flip, TextPlugin.
* **Data & auth**: [Supabase](https://supabase.com/) (`@supabase/supabase-js`, PKCE sessions).
* **Charts**: [Chart.js](https://www.chartjs.org/) (tree-shaken via `chart.js/auto`).
* **Icons**: [Lucide](https://lucide.dev/) — only the ~70 icons used are imported.
* **Build**: [Vite](https://vitejs.dev/).

---

## 3. Quick start

```bash
# Node 22 (see .node-version)
npm install
cp .env.example .env      # optional: fill in your own project
npm run dev               # http://localhost:5173
```

The app ships with a public **publishable/anon** key fallback so a fresh clone runs against the
deployed project immediately. That key is safe to expose — Row Level Security is the boundary.
The `service_role` key is **never** present in the frontend.

```bash
npm run build             # production bundle in dist/
npm run preview           # serve the built bundle
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | recommended | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | recommended | public anon / publishable key |
| `VITE_FUNCTIONS_URL` | optional | defaults to `${VITE_SUPABASE_URL}/functions/v1` |

`.env.example` lists all three. Never add `SUPABASE_SERVICE_ROLE_KEY` to this app.

---

## 4. Database setup

Two files in `supabase/` build everything:

| File | Contents |
| --- | --- |
| `schema.sql` | Tables, indexes, triggers, RPC, view and **all RLS policies** |
| `seed.sql` | 12 NCERT classes, 72 verified books, 5 mock subjects, 10 tests, 60 questions |
| `demo-data.sql` | Optional clearly-labelled sample homework/sessions/attempts for the `ayaan_demo` account |

Run them **in order** in the Supabase dashboard → **SQL Editor** → *New query* → paste → *Run*.
With a direct connection string you can also use `psql`:

```bash
psql "$DATABASE_URL" -f supabase/schema.sql
psql "$DATABASE_URL" -f supabase/seed.sql
# optional demo rows
psql "$DATABASE_URL" -f supabase/demo-data.sql
```

### Schema overview

* `profiles` — one row per auth user: `username` (unique, lowercase), `email`, `phone` (unique), `display_name`, `class_level`.
* `homework` — `subject`, `priority`, `status`, `deadline`, `completed_at`, `notes`.
* `study_sessions` — `subject`, `scheduled_at`, `duration`, `notes`, `completed`.
* `ncert_classes` / `ncert_books` — class 1–12, subject, official `ncert_url` and `download_url`.
* `mock_subjects` — the five exam subjects; `mock_tests` and `mock_questions` hold the papers.
* `test_attempts` / `test_answers` — one attempt per user/test, answers saved per question.
* `activity_events` — append-only feed used by the notifications popover and the heatmap.
* `student_test_history` — a `security_invoker` view that joins attempts with test and subject names.
* `check_signup_availability(username, email, phone)` — `SECURITY DEFINER` RPC returning availability flags without leaking rows.

### Row Level Security

Every table is protected by policies scoped to `auth.uid()`:

* Students `select/insert/update/delete` only **their own** homework, sessions, attempts and answers.
* `mock_subjects`, `mock_tests` and `ncert_*` are readable by authenticated users (published catalogue).
* **`mock_questions` has RLS enabled and no policies at all** — the browser cannot read a question
  table row, so `correct_option` is unreachable. Only the Edge Function's service-role client can.
* `activity_events` allows inserts and own-row reads; the timeline is append-only.

Attempts are graded server-side, and solution text is returned only by `action: "review"` **after**
`status = 'completed'` — the 403 otherwise.

---

## 5. Edge Functions

Three functions live in `supabase/functions/`:

| Function | JWT | Responsibility |
| --- | --- | --- |
| `username-login` | not verified | Looks the username up with the service role, signs in with the resolved email, returns a normal Supabase session + minimal user object. |
| `register-student` | not verified | Re-validates username/email/phone, creates the auth user, inserts the profile row, reports field-level `409`s on duplicates. |
| `mock-test` | **verified** | `list`, `start`, `answer`, `submit`, `review` — the only path that touches answer keys. |

Deploy:

```bash
supabase login
supabase link --project-ref <project-ref>

supabase functions deploy username-login    --no-verify-jwt
supabase functions deploy register-student  --no-verify-jwt
supabase functions deploy mock-test
```

Secrets are provided automatically (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_ANON_KEY`). To set them explicitly:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> **Security note:** the browser never receives the service-role key. Username lookup happens
> entirely inside `username-login`, so the email → account mapping is not queryable by clients.

### Auth configuration

For a frictionless school demo, email confirmation is disabled (`mailer_autoconfirm`) because
registration already validates the address format and requires a phone number. Enable
"Confirm email" in *Authentication → Providers → Email* for production, then set
*Site URL* to your deployed origin and add it to the redirect allow-list.

---

## 6. Deploying to Render

The repository ships a [`render.yaml`](render.yaml) Blueprint that builds the Vite bundle and
serves it as a **Render Static Site** — no server process, so it fits the free tier.

### One-click (Blueprint)

1. Push this repository to GitHub.
2. In Render, choose **New + → Blueprint**, select the repo, and confirm the branch.
3. Render reads `render.yaml` and creates the `academia` static site.
4. When prompted, paste `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
   (Supabase → *Project Settings → API*).
5. Click **Apply**. The first build runs `npm ci && npm run build` and publishes `dist/`.

The live URL appears at the top of the service page (`https://academia.onrender.com` or your
custom domain), and every pull request gets its own preview deployment.

### Manual static site

| Setting | Value |
| --- | --- |
| Service type | Static Site |
| Build command | `npm ci && npm run build` |
| Publish directory | `dist` |
| Node version | `22.22.0` (pinned in `.node-version`) |
| Rewrite rule | `/*` → `/index.html` |

### What the Blueprint configures

* `runtime: static` with `staticPublishPath: ./dist`
* SPA rewrite `/* → /index.html` (existing files are still served first, so hashed assets are untouched)
* `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`; revalidation for `index.html`
* `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` hardening
* `NODE_VERSION=22.22.0`, automatic pull-request previews, deploy on push

### After the first deploy

* `VITE_*` values are compiled into the bundle — after changing them use
  **Manual Deploy → Clear build cache & deploy**.
* Add the Render URL to Supabase **Authentication → URL Configuration → Site URL** (and the
  redirect allow-list) if you later enable email confirmation.
* No other hosting is required: the browser talks to Supabase and the Edge Functions directly,
  and `VITE_SUPABASE_SERVICE_ROLE_KEY` must never be added to Render.

## 7. Demo account

A seeded student is available for evaluation:

| Field | Value |
| --- | --- |
| Username | `ayaan_demo` |
| Password | `Academia123` |

It contains 12 homework items, 8 study sessions, 3 graded mock attempts and 31 activity events.
`Settings → Demonstration workspace` loads extra clearly-prefixed `[Demo]` rows for any account;
`Clear my workspace` removes homework and sessions (test history stays as an immutable record).

---

## 8. Project structure

```
.
├── index.html                  # single entry, atmosphere layers, boots /src/main.js
├── src/
│   ├── main.js                 # boot, SVG defs, landing → auth → workspace switch
│   ├── landing/landingView.js  # public introduction page + Get Started handoff
│   ├── app/shell.js            # sidebar, top bar, popovers, hash router, view lifecycle
│   ├── auth/authView.js        # login / register / success screens
│   ├── views/
│   │   ├── _shared.js          # chart theming, rings, panels, empty states
│   │   ├── overview.js homework.js planner.js ncert.js
│   │   ├── mocks.js            # instructions → exam engine → result → review
│   │   ├── performance.js      # charts + attempt history
│   │   └── settings.js
│   ├── lib/                    # config, supabase client, api, icons, motion, dom, store
│   ├── ui/                     # toast, modal, brand marks
│   └── styles/                 # base, auth, shell, views, landing
├── supabase/
│   ├── schema.sql seed.sql demo-data.sql
│   └── functions/{username-login,register-student,mock-test}/index.ts
├── render.yaml                 # Render Blueprint (static site + SPA rewrite + headers)
├── .node-version               # Node 22.22.0 for local + Render builds
└── vite.config.js
```

### View contract

Each view module exports `render(root, ctx)` and may return a cleanup function:

```js
export async function render(root, ctx) {
  // ctx = { profile, navigate, refreshProfile, toast, onHomeworkChanged }
  return () => { /* cancel timers, destroy charts & ScrollTriggers */ };
}
```

The shell mounts views into `#view` inside `#view-scroll`, awaits the cleanup before the next
transition, and broadcasts `academia:new-homework` / `academia:new-session` when the Overview
asks to create something.

---

## 9. Design & accessibility notes

* Three typefaces (Sora display, Inter UI, JetBrains Mono numerals), deep-navy atmosphere with
  aurora gradients, a fine grid, noise and a vignette — **no particles or 3D**.
* Motion is purposeful: character reveals, FLIP re-ordering, counters, ring drawing, staggered
  chart entry, magnetic buttons. `prefers-reduced-motion` (or the Settings switch) collapses
  durations and disables scroll effects.
* Focus-visible rings, `aria-pressed` on toggles, `role="dialog"` + `aria-modal` for the exam and
  modals, live regions for toasts, and full keyboard operation of the mock test.
* Layout breakpoints at 1180 / 900 / 700 / 480 px; the sidebar becomes a drawer and the exam
  palette moves below the question on small screens.

---

## 10. Verified content sources

NCERT links were checked against `ncert.nic.in/textbook.php?<code>=0-<n>` before being seeded
(for example `jemh1` — Class 10 Mathematics, `aemh1` — Class 1 Math-Magic, `iesc1` — Class 9
Science). Only codes whose pages resolved are included; no fabricated URLs. If NCERT retires a
code the card still shows the class and title, and the link simply 404s at the source rather than
pointing somewhere invented.

---

## 11. Licence

Built as a school coding-competition entry. Content and NCERT material remain the property of
their respective owners.
