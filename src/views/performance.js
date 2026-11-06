/**
 * Performance — charts and history built from the student's graded records.
 */
import { supabase, unwrap } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import { esc, fmtDate, pct, subjectTone } from "../lib/dom.js";
import {
  gsap,
  prefersReduced,
  countTo,
  scrollReveal,
  killScrollTriggers,
} from "../lib/motion.js";
import {
  pageHead,
  panel,
  makeChart,
  destroyCharts,
  gridScale,
  verticalGradient,
  CHART_COLORS,
  emptyState,
} from "./_shared.js";

const dayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export async function render(root, ctx) {
  const charts = [];
  const profileId = ctx.profile.id;

  root.innerHTML = `
    ${pageHead({
      eyebrow: "Insights",
      title: "Performance",
      subtitle: "Every number below is computed from your own graded attempts and completed work.",
      actions: `<span class="badge">${icon("Database", { size: 11 })} live records</span>`,
    })}
    <div id="perf-body">
      <div class="kpi-grid">${'<div class="skeleton" style="height:122px;border-radius:22px"></div>'.repeat(4)}</div>
      <div class="skeleton" style="height:320px;border-radius:22px;margin-top:1rem"></div>
    </div>
  `;

  const body = root.querySelector("#perf-body");

  const [historyRes, homeworkRes, sessionsRes, activityRes] = await Promise.all([
    supabase.from("student_test_history").select("*").eq("user_id", profileId).order("completed_at", { ascending: true }),
    supabase.from("homework").select("id, subject, status, deadline, completed_at, created_at").eq("user_id", profileId),
    supabase.from("study_sessions").select("id, subject, scheduled_at, duration, completed").eq("user_id", profileId),
    supabase
      .from("activity_events")
      .select("id, kind, created_at")
      .eq("user_id", profileId)
      .gte("created_at", new Date(Date.now() - 70 * 86400000).toISOString()),
  ]);

  const history = unwrap(historyRes) ?? [];
  const homework = unwrap(homeworkRes) ?? [];
  const sessions = unwrap(sessionsRes) ?? [];
  const activity = unwrap(activityRes) ?? [];

  /* -------------------------------------------------------------- stats */
  const attempts = history.length;
  const average = attempts
    ? Math.round(history.reduce((sum, row) => sum + Number(row.percentage ?? 0), 0) / attempts)
    : 0;
  const best = attempts ? Math.round(Math.max(...history.map((row) => Number(row.percentage ?? 0)))) : 0;
  const completedHomework = homework.filter((h) => h.status === "completed").length;
  const homeworkRate = pct(completedHomework, homework.length);
  const studyMinutes = sessions.filter((s) => s.completed).reduce((sum, s) => sum + s.duration, 0);

  const bySubject = Object.values(
    history.reduce((acc, row) => {
      const name = row.subject_name ?? "Other";
      acc[name] = acc[name] || { name, sum: 0, count: 0 };
      acc[name].sum += Number(row.percentage ?? 0);
      acc[name].count += 1;
      return acc;
    }, {}),
  ).map((row) => ({ name: row.name, value: Math.round(row.sum / row.count), count: row.count }));

  const trend = history.slice(-12);

  // eight-week homework completion trend
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - (7 - index) * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const count = homework.filter((h) => {
      if (!h.completed_at) return false;
      const t = new Date(h.completed_at).getTime();
      return t >= start.getTime() && t <= end.getTime();
    }).length;
    return {
      label: new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(start),
      count,
    };
  });

  // 10-week activity heatmap (70 days)
  const heatDays = Array.from({ length: 70 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (69 - index));
    const count = activity.filter((event) => dayKey(event.created_at) === dayKey(date)).length;
    return { date, count };
  });
  const maxHeat = Math.max(1, ...heatDays.map((d) => d.count));

  body.innerHTML = `
    <div class="kpi-grid">
      <article class="kpi">
        <span class="kpi__label">${icon("Target", { size: 13 })}Average score</span>
        <span class="kpi__value"><span data-count="${average}">0</span><small>%</small></span>
        <span class="kpi__foot">${attempts ? `${attempts} graded attempt${attempts > 1 ? "s" : ""}` : "No attempts yet"}</span>
      </article>
      <article class="kpi kpi--violet">
        <span class="kpi__label">${icon("Trophy", { size: 13 })}Best score</span>
        <span class="kpi__value"><span data-count="${best}">0</span><small>%</small></span>
        <span class="kpi__foot">${best >= 80 ? "Excellent ceiling" : best ? "Room to climb" : "Take a test to begin"}</span>
      </article>
      <article class="kpi kpi--mint">
        <span class="kpi__label">${icon("ClipboardCheck", { size: 13 })}Homework rate</span>
        <span class="kpi__value"><span data-count="${homeworkRate}">0</span><small>%</small></span>
        <span class="kpi__foot">${completedHomework} of ${homework.length} completed</span>
      </article>
      <article class="kpi kpi--amber">
        <span class="kpi__label">${icon("Clock", { size: 13 })}Study logged</span>
        <span class="kpi__value"><span data-count="${Math.round(studyMinutes / 60)}">0</span><small>hours</small></span>
        <span class="kpi__foot">${sessions.filter((s) => s.completed).length} sessions completed</span>
      </article>
    </div>

    <div class="dash-row" style="margin-top:1rem">
      ${panel({
        title: "Score trend",
        iconName: "ChartLine",
        hint: trend.length ? `last ${trend.length} attempts` : "no attempts",
        body: trend.length
          ? `<div class="chart-wrap"><canvas id="trend-chart"></canvas></div>`
          : emptyState({
              iconName: "Target",
              title: "No graded attempts yet",
              text: "Finish a mock test and your score trend appears here.",
            }),
      })}

      ${panel({
        title: "Subject averages",
        iconName: "BarChart3",
        hint: `${bySubject.length} subjects`,
        body: bySubject.length
          ? `<div class="chart-wrap"><canvas id="subject-chart"></canvas></div>`
          : emptyState({
              iconName: "Brain",
              title: "Subject data pending",
              text: "Attempt tests in more than one subject to compare strengths.",
            }),
      })}
    </div>

    <div class="dash-row" style="margin-top:1rem">
      ${panel({
        title: "Homework momentum",
        iconName: "ClipboardList",
        hint: "8 weeks",
        body: `<div class="chart-wrap chart-wrap--sm"><canvas id="hw-trend"></canvas></div>`,
      })}

      ${panel({
        title: "Learning activity",
        iconName: "Activity",
        hint: "10 weeks",
        body: `
          <div class="heatmap">
            ${heatDays
              .map((day) => {
                const level = day.count === 0 ? 0 : Math.min(4, Math.ceil((day.count / maxHeat) * 4));
                return `<span class="heat-cell" data-level="${level}"
                  title="${esc(fmtDate(day.date))}: ${day.count} action${day.count === 1 ? "" : "s"}"></span>`;
              })
              .join("")}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:0.7rem" class="mono">
            <span style="font-size:8.5px;letter-spacing:0.1em;color:var(--muted-dim)">10 weeks ago</span>
            <span style="font-size:8.5px;letter-spacing:0.1em;color:var(--muted-dim)">today</span>
          </div>
        `,
      })}
    </div>

    ${panel({
      title: "Attempt history",
      iconName: "History",
      hint: `${attempts} total`,
      flush: true,
      body: history.length
        ? `<div style="overflow-x:auto">
            <table class="data-table">
              <thead>
                <tr><th>Test</th><th>Subject</th><th>Date</th><th>Correct</th><th>Score</th></tr>
              </thead>
              <tbody>
                ${[...history]
                  .reverse()
                  .map((row) => {
                    const score = Math.round(Number(row.percentage ?? 0));
                    const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
                    return `
                    <tr>
                      <td style="color:#fff">${esc(row.test_title)}</td>
                      <td><span class="subject-chip" data-tone="${subjectTone(row.subject_name ?? "")}">${esc(row.subject_name ?? "")}</span></td>
                      <td class="mono" style="font-size:11px;color:var(--muted)">${esc(fmtDate(row.completed_at))}</td>
                      <td class="mono" style="font-size:11.5px">${row.correct_count}/${row.total_questions}</td>
                      <td><span class="score-pill" data-tier="${tier}">${score}%</span></td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>`
        : emptyState({
            iconName: "Inbox",
            title: "No attempts recorded",
            text: "Your graded mock tests will be listed here.",
          }),
    })}
  `;

  /* -------------------------------------------------------------- charts */
  if (trend.length) {
    makeChart(
      body.querySelector("#trend-chart"),
      {
        type: "line",
        data: {
          labels: trend.map((row) => fmtDate(row.completed_at)),
          datasets: [
            {
              data: trend.map((row) => Math.round(Number(row.percentage ?? 0))),
              borderColor: CHART_COLORS.blueSoft,
              borderWidth: 2,
              tension: 0.38,
              fill: true,
              backgroundColor: (context) =>
                verticalGradient(context, "rgba(91,140,255,0.32)", "rgba(91,140,255,0)"),
              pointBackgroundColor: "#05070e",
              pointBorderColor: CHART_COLORS.blueSoft,
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          scales: {
            x: gridScale.x,
            y: { ...gridScale.y, min: 0, max: 100, ticks: { callback: (value) => `${value}%`, padding: 8 } },
          },
          plugins: {
            tooltip: { callbacks: { label: (item) => `${item.parsed.y}%` } },
          },
        },
      },
      charts,
    );
  }

  if (bySubject.length) {
    makeChart(
      body.querySelector("#subject-chart"),
      {
        type: "bar",
        data: {
          labels: bySubject.map((row) => row.name),
          datasets: [
            {
              data: bySubject.map((row) => row.value),
              backgroundColor: bySubject.map((_, index) => {
                const palette = ["rgba(91,140,255,0.85)", "rgba(160,107,255,0.85)", "rgba(70,224,208,0.8)", "rgba(255,192,106,0.8)", "rgba(255,122,184,0.8)"];
                return palette[index % palette.length];
              }),
              borderRadius: 8,
              maxBarThickness: 26,
            },
          ],
        },
        options: {
          responsive: true,
          indexAxis: "y",
          scales: {
            x: { beginAtZero: true, max: 100, grid: { color: "rgba(255,255,255,0.05)" }, border: { display: false }, ticks: { callback: (v) => `${v}%` } },
            y: { grid: { display: false }, border: { display: false } },
          },
          plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.x}% average` } } },
        },
      },
      charts,
    );
  }

  makeChart(
    body.querySelector("#hw-trend"),
    {
      type: "bar",
      data: {
        labels: weeks.map((week) => week.label),
        datasets: [
          {
            data: weeks.map((week) => week.count),
            backgroundColor: "rgba(123,241,197,0.6)",
            hoverBackgroundColor: "rgba(123,241,197,0.9)",
            borderRadius: 6,
            maxBarThickness: 20,
          },
        ],
      },
      options: {
        responsive: true,
        scales: gridScale,
        plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} completed` } } },
      },
    },
    charts,
  );

  /* ---------------------------------------------------------- animation */
  body.querySelectorAll("[data-count]").forEach((el, index) =>
    countTo(el, Number(el.dataset.count), { duration: 1 + index * 0.05 }),
  );

  if (!prefersReduced()) {
    gsap.fromTo(
      body.querySelectorAll(".heat-cell"),
      { opacity: 0, scale: 0.6 },
      { opacity: 1, scale: 1, duration: 0.4, stagger: { each: 0.004, from: "start" }, ease: "power2.out" },
    );
  }

  scrollReveal(body.querySelectorAll(".dash-row > .panel, .panel"), { y: 20 });

  return () => {
    destroyCharts(charts);
    killScrollTriggers();
  };
}
