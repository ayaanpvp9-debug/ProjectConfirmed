/**
 * Overview — personalised dashboard, 100% driven by the student's real rows.
 */
import { supabase, unwrap } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import {
  esc,
  fmtDeadline,
  fmtLongDate,
  fmtMinutes,
  fmtTime,
  fmtRelative,
  pct,
  greeting,
  initials,
} from "../lib/dom.js";
import { displayName, firstName } from "../lib/store.js";
import {
  gsap,
  prefersReduced,
  countTo,
  animateBar,
  scrollReveal,
  magnetic,
  revealChars,
  killScrollTriggers,
} from "../lib/motion.js";
import {
  pageHead,
  panel,
  ringMarkup,
  animateRing,
  emptyState,
  makeChart,
  destroyCharts,
  gridScale,
  barGradient,
  CHART_COLORS,
} from "./_shared.js";

const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export async function render(root, ctx) {
  root.innerHTML = `
    ${pageHead({
      eyebrow: "Dashboard",
      title: `<span data-greeting>${esc(greeting())}</span>, ${esc(firstName())}<span class="gradient-text">.</span>`,
      subtitle: `${fmtLongDate()} — here is exactly where your week stands.`,
      actions: `
        <button class="btn btn--sm" data-quick-planner>${icon("CalendarClock", { size: 15 })}<span class="btn__label">Plan a session</span></button>
        <button class="btn btn--primary btn--sm" data-quick-homework data-magnetic>${icon("Plus", { size: 15 })}<span class="btn__label">New assignment</span></button>
      `,
    })}
    <div id="overview-body">
      <div class="kpi-grid">
        ${'<div class="skeleton" style="height:122px;border-radius:22px"></div>'.repeat(4)}
      </div>
      <div class="dash-row" style="margin-top:1rem">
        <div class="skeleton" style="height:300px;border-radius:22px"></div>
        <div class="skeleton" style="height:300px;border-radius:22px"></div>
      </div>
    </div>
  `;

  const body = root.querySelector("#overview-body");
  const charts = [];
  const profileId = ctx.profile.id;

  const [homeworkRes, sessionsRes, historyRes, activityRes] = await Promise.all([
    supabase
      .from("homework")
      .select("id, title, subject, deadline, priority, status, completed_at")
      .eq("user_id", profileId)
      .order("deadline", { ascending: true }),
    supabase
      .from("study_sessions")
      .select("id, title, subject, scheduled_at, duration, completed")
      .eq("user_id", profileId)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("student_test_history")
      .select("*")
      .eq("user_id", profileId)
      .order("completed_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("id, kind, title, detail, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const homework = unwrap(homeworkRes) ?? [];
  const sessions = unwrap(sessionsRes) ?? [];
  const history = unwrap(historyRes) ?? [];
  const activity = unwrap(activityRes) ?? [];

  /* ------------------------------------------------------------ compute */
  const now = Date.now();
  const total = homework.length;
  const completed = homework.filter((h) => h.status === "completed").length;
  const pending = total - completed;
  const overdue = homework.filter(
    (h) => h.status !== "completed" && new Date(h.deadline).getTime() < now,
  );
  const completionPct = pct(completed, total);

  const upcoming = homework.filter((h) => h.status !== "completed").slice(0, 5);

  const attempted = history.length;
  const average = attempted
    ? Math.round(history.reduce((sum, row) => sum + Number(row.percentage ?? 0), 0) / attempted)
    : 0;
  const best = attempted ? Math.max(...history.map((row) => Number(row.percentage ?? 0))) : 0;

  const today = new Date();
  const todaySessions = sessions.filter((s) => dayKey(s.scheduled_at) === dayKey(today));
  const minutesToday = todaySessions.reduce((sum, s) => sum + s.duration, 0);
  const doneToday = todaySessions.filter((s) => s.completed).length;
  const nextSession = sessions.find(
    (s) => !s.completed && new Date(s.scheduled_at).getTime() > now - 15 * 60000,
  );

  // last 7 days of study activity: homework completions + sessions completed + tests
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return date;
  });
  const dayLabels = days.map((d) => new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d));
  const completionSeries = days.map(
    (d) => homework.filter((h) => h.completed_at && dayKey(h.completed_at) === dayKey(d)).length,
  );
  const sessionSeries = days.map(
    (d) => sessions.filter((s) => s.completed && dayKey(s.scheduled_at) === dayKey(d)).length,
  );

  const subjectAccuracy = Object.values(
    history.reduce((acc, row) => {
      const key = row.subject_name ?? "Other";
      acc[key] = acc[key] || { name: key, total: 0, pct: 0, count: 0 };
      acc[key].total += Number(row.percentage ?? 0);
      acc[key].count += 1;
      acc[key].pct = Math.round(acc[key].total / acc[key].count);
      return acc;
    }, {}),
  ).sort((a, b) => b.pct - a.pct);

  const name = displayName();

  body.innerHTML = `
    <div class="kpi-grid">
      <article class="kpi" data-kpi>
        <span class="kpi__label">${icon("ChartLine", { size: 13 })}Homework completion</span>
        <span class="kpi__value"><span data-count="${completionPct}">0</span><small>%</small></span>
        <span class="kpi__foot">${completed} of ${total || 0} assignments complete</span>
      </article>

      <article class="kpi kpi--amber" data-kpi>
        <span class="kpi__label">${icon("ClipboardList", { size: 13 })}Pending work</span>
        <span class="kpi__value"><span data-count="${pending}">0</span><small>left</small></span>
        <span class="kpi__foot">${overdue.length ? `<span class="warn">${overdue.length} overdue</span>` : "Nothing overdue"}</span>
      </article>

      <article class="kpi kpi--violet" data-kpi>
        <span class="kpi__label">${icon("Target", { size: 13 })}Mock test average</span>
        <span class="kpi__value"><span data-count="${average}">0</span><small>%</small></span>
        <span class="kpi__foot">${attempted ? `${attempted} attempt${attempted > 1 ? "s" : ""} · best ${best}%` : "No attempts yet"}</span>
      </article>

      <article class="kpi kpi--mint" data-kpi>
        <span class="kpi__label">${icon("Clock", { size: 13 })}Study time today</span>
        <span class="kpi__value"><span data-count="${minutesToday}">0</span><small>min</small></span>
        <span class="kpi__foot">${
          todaySessions.length
            ? `${doneToday}/${todaySessions.length} sessions done`
            : nextSession
              ? `Next: ${esc(fmtTime(nextSession.scheduled_at))}`
              : "No sessions planned"
        }</span>
      </article>
    </div>

    <div class="dash-row" style="margin-top:1rem">
      ${panel({
        title: "Up next",
        iconName: "Hourglass",
        hint: upcoming.length ? `${upcoming.length} open` : "clear",
        flush: true,
        body: upcoming.length
          ? `<div class="row-list">
              ${upcoming
                .map((item) => {
                  const isOverdue = new Date(item.deadline).getTime() < now;
                  return `
                  <div class="row-item" data-upcoming>
                    <span class="row-item__dot" style="background:${isOverdue ? "#ff7ab8" : priorityColor(item.priority)}"></span>
                    <span class="row-item__main">
                      <span class="row-item__title">${esc(item.title)}</span>
                      <span class="row-item__meta">${esc(item.subject)}${isOverdue ? " · overdue" : ""}</span>
                    </span>
                    <span class="row-item__aside">${esc(fmtDeadline(item.deadline))}</span>
                  </div>`;
                })
                .join("")}
            </div>`
          : emptyState({
              iconName: "CheckCheck",
              title: "Nothing pending",
              text: "Every assignment is complete. Add the next one when you are ready.",
            }),
      })}

      ${panel({
        title: "Weekly momentum",
        iconName: "Activity",
        hint: "last 7 days",
        body: `
          <div class="chart-legend">
            <span><i style="background:${CHART_COLORS.blue}"></i>Homework done</span>
            <span><i style="background:${CHART_COLORS.violet}"></i>Study sessions</span>
          </div>
          <div class="chart-wrap chart-wrap--sm"><canvas id="momentum-chart"></canvas></div>
        `,
      })}
    </div>

    <div class="dash-row" style="margin-top:1rem">
      ${panel({
        title: "Subject strength",
        iconName: "Brain",
        hint: attempted ? `${attempted} graded attempts` : "no data",
        body:
          attempted && subjectAccuracy.length
            ? `<div class="section-grid">
                ${subjectAccuracy
                  .map(
                    (s) => `
                  <div data-subject-row>
                    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:0.3rem">
                      <span style="font-size:12.5px;color:var(--text-soft)">${esc(s.name)}</span>
                      <span class="mono" style="font-size:11px;color:var(--muted)">${s.pct}%</span>
                    </div>
                    <div style="height:6px;border-radius:99px;background:rgba(255,255,255,0.06);overflow:hidden">
                      <div data-subject-bar="${s.pct}" style="height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,#5b8cff,#c48cff)"></div>
                    </div>
                  </div>`,
                  )
                  .join("")}
                <div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.9rem;padding-top:0.9rem;border-top:1px solid var(--line)">
                  ${ringMarkup({ value: average, label: "average", id: "overview-ring", size: 96 })}
                  <div>
                    <div style="font-family:var(--font-display);font-size:20px;letter-spacing:-0.03em;color:#fff">${average}%</div>
                    <div class="mono" style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted-dim)">
                      across ${attempted} test${attempted > 1 ? "s" : ""} · best ${best}%
                    </div>
                  </div>
                </div>
              </div>`
            : emptyState({
                iconName: "Target",
                title: "No mock tests yet",
                text: "Attempt one mock test and your subject strength will appear here.",
                action: `<button class="btn btn--sm" data-quick-mocks>${icon("Play", { size: 14 })}<span class="btn__label">Browse tests</span></button>`,
              }),
      })}

      ${panel({
        title: "Recent activity",
        iconName: "Sparkles",
        flush: true,
        body: activity.length
          ? `<div class="timeline">
              ${activity
                .map(
                  (item) => `
                <div class="timeline__item">
                  <span class="timeline__marker">${icon(activityIcon(item.kind), { size: 13 })}</span>
                  <span class="timeline__body">
                    <span class="timeline__title">${esc(item.title)}</span>
                    <span class="timeline__meta">${esc(fmtRelative(item.created_at))}${item.detail ? ` · ${esc(item.detail)}` : ""}</span>
                  </span>
                </div>`,
                )
                .join("")}
            </div>`
          : emptyState({
              iconName: "Inbox",
              title: "Quiet in here",
              text: "Create an assignment or book a study session and your activity will show up here.",
            }),
      })}
    </div>

    <div class="card" style="margin-top:1rem;padding:1.1rem 1.2rem;display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:0.8rem">
        <span class="avatar">${esc(initials(name))}</span>
        <div>
          <div style="font-family:var(--font-display);font-size:13.5px;color:#fff">Your workspace is live</div>
          <div class="mono" style="font-size:9.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted-dim)">
            ${esc(ctx.profile.username)} · joined ${esc(new Date(ctx.profile.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" }))}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
        <button class="btn btn--sm" data-quick-ncert>${icon("BookOpen", { size: 14 })}<span class="btn__label">Open NCERT library</span></button>
        <button class="btn btn--sm" data-quick-performance>${icon("ChartLine", { size: 14 })}<span class="btn__label">Performance</span></button>
      </div>
    </div>
  `;

  /* ------------------------------------------------------------- charts */
  const momentumCanvas = body.querySelector("#momentum-chart");
  const momentum = makeChart(
    momentumCanvas,
    {
      type: "bar",
      data: {
        labels: dayLabels,
        datasets: [
          {
            label: "Homework",
            data: completionSeries,
            backgroundColor: (context) => barGradient(context, "143,176,255"),
            borderRadius: 6,
            maxBarThickness: 16,
            categoryPercentage: 0.62,
            barPercentage: 0.9,
          },
          {
            label: "Sessions",
            data: sessionSeries,
            backgroundColor: (context) => barGradient(context, "160,107,255"),
            borderRadius: 6,
            maxBarThickness: 16,
            categoryPercentage: 0.62,
            barPercentage: 0.9,
          },
        ],
      },
      options: {
        responsive: true,
        scales: gridScale,
        interaction: { mode: "index", intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label ?? "",
              label: (item) => `${item.dataset.label}: ${item.parsed.y}`,
            },
          },
        },
      },
    },
    charts,
  );
  void momentum;

  /* --------------------------------------------------------- animation */
  root.querySelectorAll("[data-count]").forEach((el, index) => {
    countTo(el, Number(el.dataset.count), { duration: 1.1 + index * 0.05 });
  });

  root.querySelectorAll("[data-subject-bar]").forEach((bar, index) => {
    const value = Number(bar.dataset.subjectBar);
    if (prefersReduced()) {
      bar.style.width = `${value}%`;
      return;
    }
    gsap.to(bar, { width: `${value}%`, duration: 1.1, delay: 0.15 + index * 0.07, ease: "power3.out" });
  });

  const ringHost = root.querySelector("#overview-ring")?.closest(".ring");
  if (ringHost) animateRing(ringHost, average, { delay: 0.35 });

  scrollReveal(root.querySelectorAll(".dash-row > .panel, .card"), { y: 20 });

  /* ----------------------------------------------------------- actions */
  root.querySelector("[data-quick-homework]")?.addEventListener("click", async () => {
    await ctx.navigate("homework");
    document.dispatchEvent(new CustomEvent("academia:new-homework"));
  });
  root.querySelector("[data-quick-planner]")?.addEventListener("click", async () => {
    await ctx.navigate("planner");
    document.dispatchEvent(new CustomEvent("academia:new-session"));
  });
  root.querySelector("[data-quick-mocks]")?.addEventListener("click", () => ctx.navigate("mocks"));
  root.querySelector("[data-quick-ncert]")?.addEventListener("click", () => ctx.navigate("ncert"));
  root.querySelector("[data-quick-performance]")?.addEventListener("click", () => ctx.navigate("performance"));

  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));

  return () => {
    destroyCharts(charts);
    killScrollTriggers();
  };
}

function priorityColor(priority) {
  if (priority === "high") return "#ff7ab8";
  if (priority === "low") return "#46e0d0";
  return "#8fb0ff";
}

function activityIcon(kind) {
  return (
    {
      homework: "ClipboardList",
      homework_done: "CheckCircle2",
      session: "CalendarClock",
      session_done: "CheckCheck",
      test: "Target",
      account: "Sparkles",
      study: "BookOpen",
    }[kind] ?? "Activity"
  );
}
