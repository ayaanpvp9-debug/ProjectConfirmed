/**
 * Study Planner — week strip, day agenda, upcoming sessions.
 */
import { supabase, unwrap } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import { SUBJECTS } from "../lib/config.js";
import {
  esc,
  fmtTime,
  fmtLongDate,
  fmtDate,
  fmtMinutes,
  startOfDay,
  toLocalInput,
  subjectTone,
} from "../lib/dom.js";
import { showToast } from "../ui/toast.js";
import { openModal, confirmDialog } from "../ui/modal.js";
import {
  gsap,
  prefersReduced,
  countTo,
  magnetic,
  scrollReveal,
  killScrollTriggers,
} from "../lib/motion.js";
import { pageHead, panel, makeChart, destroyCharts, gridScale, barGradient, emptyState } from "./_shared.js";

const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d;
}

export async function render(root, ctx) {
  const charts = [];
  let sessions = [];
  let selected = startOfDay(new Date());

  root.innerHTML = `
    ${pageHead({
      eyebrow: "Organise",
      title: "Study Planner",
      subtitle: "Block out focused time. Your week, minute by minute.",
      actions: `<button class="btn btn--primary btn--sm" data-new data-magnetic>${icon("Plus", { size: 15 })}<span class="btn__label">New session</span></button>`,
    })}

    <div class="week-strip" data-week role="group" aria-label="Select a day"></div>

    <div class="dash-row">
      <div class="panel">
        <header class="panel__head">
          <h3 class="panel__title">${icon("CalendarClock", { size: 15 })}<span data-day-title>Today</span></h3>
          <span class="panel__hint" data-day-hint></span>
        </header>
        <div class="panel__body">
          <div class="day-plan-stats" data-day-stats></div>
          <div class="session-list" data-session-list></div>
        </div>
      </div>

      <div class="dash-stack">
        <div class="panel">
          <header class="panel__head">
            <h3 class="panel__title">${icon("ChartColumn", { size: 15 })}Week load</h3>
            <span class="panel__hint">minutes planned</span>
          </header>
          <div class="panel__body">
            <div class="chart-wrap chart-wrap--sm"><canvas id="planner-week"></canvas></div>
          </div>
        </div>
        <div class="panel">
          <header class="panel__head">
            <h3 class="panel__title">${icon("ArrowUpRight", { size: 15 })}Upcoming</h3>
          </header>
          <div class="panel__body" data-upcoming></div>
        </div>
      </div>
    </div>
  `;

  const weekStrip = root.querySelector("[data-week]");
  const listHost = root.querySelector("[data-session-list]");
  const statsHost = root.querySelector("[data-day-stats]");
  const dayTitle = root.querySelector("[data-day-title]");
  const dayHint = root.querySelector("[data-day-hint]");
  const upcomingHost = root.querySelector("[data-upcoming]");

  async function load() {
    const rows = unwrap(
      await supabase
        .from("study_sessions")
        .select("id, title, subject, scheduled_at, duration, notes, completed, created_at")
        .eq("user_id", ctx.profile.id)
        .order("scheduled_at", { ascending: true }),
    );
    sessions = rows ?? [];
  }

  /* -------------------------------------------------------------- week */
  function renderWeek() {
    const monday = startOfWeek();
    weekStrip.innerHTML = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const has = sessions.some((s) => sameDay(s.scheduled_at, date));
      const isToday = sameDay(date, new Date());
      const isSelected = sameDay(date, selected);
      return `
        <button class="day-cell ${isToday ? "is-today" : ""}" data-day="${date.toISOString()}"
                aria-pressed="${isSelected}" data-has="${has}">
          <span class="day-cell__name">${new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date)}</span>
          <span class="day-cell__num">${date.getDate()}</span>
          <span class="day-cell__dot"></span>
        </button>`;
    }).join("");

    weekStrip.querySelectorAll("[data-day]").forEach((button) => {
      button.addEventListener("click", () => {
        selected = new Date(button.dataset.day);
        renderWeek();
        renderDay(true);
      });
    });
  }

  /* --------------------------------------------------------------- day */
  function renderDay(animate = false) {
    const daySessions = sessions.filter((s) => sameDay(s.scheduled_at, selected));
    const minutes = daySessions.reduce((sum, s) => sum + s.duration, 0);
    const done = daySessions.filter((s) => s.completed).length;
    const isToday = sameDay(selected, new Date());

    dayTitle.textContent = isToday ? "Today" : fmtLongDate(selected);
    dayHint.textContent = `${daySessions.length} session${daySessions.length === 1 ? "" : "s"}`;

    statsHost.innerHTML = `
      <div class="mini-stat">
        <span class="mini-stat__value">${daySessions.length}</span>
        <span class="mini-stat__label">Sessions</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat__value">${fmtMinutes(minutes)}</span>
        <span class="mini-stat__label">Planned</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat__value">${done}/${daySessions.length}</span>
        <span class="mini-stat__label">Completed</span>
      </div>
    `;

    listHost.innerHTML = daySessions.length
      ? daySessions
          .map((session) => {
            const time = new Date(session.scheduled_at);
            return `
            <div class="session" data-id="${session.id}" data-completed="${Boolean(session.completed)}">
              <span class="session__time">
                <strong>${esc(fmtTime(time))}</strong>
                <span>${session.duration}m</span>
              </span>
              <span class="session__body">
                <span class="session__title">${esc(session.title)}</span>
                <span class="session__meta">
                  <span class="subject-chip" data-tone="${subjectTone(session.subject)}">${esc(session.subject)}</span>
                  ${session.notes ? esc(session.notes.slice(0, 58)) : ""}
                </span>
              </span>
              <span class="session__actions">
                <button class="hw-check" data-toggle data-done="${Boolean(session.completed)}">
                  ${icon(session.completed ? "RotateCcw" : "Check", { size: 12 })}
                  <span>${session.completed ? "Undo" : "Done"}</span>
                </button>
                <button class="mini-btn" data-edit aria-label="Edit session">${icon("Pencil", { size: 14 })}</button>
                <button class="mini-btn mini-btn--danger" data-delete aria-label="Delete session">${icon("Trash2", { size: 14 })}</button>
              </span>
            </div>`;
          })
          .join("")
      : emptyState({
          iconName: "CalendarClock",
          title: isToday ? "A clear day" : "Nothing planned",
          text: "Reserve a focused block and it will appear here on your timeline.",
          action: `<button class="btn btn--sm" data-new>${icon("Plus", { size: 14 })}<span class="btn__label">Add session</span></button>`,
        });

    listHost.querySelectorAll(".session").forEach((row) => {
      const session = sessions.find((s) => s.id === row.dataset.id);
      if (!session) return;
      row.querySelector("[data-toggle]").addEventListener("click", () => toggleSession(session));
      row.querySelector("[data-edit]").addEventListener("click", () => openForm(session));
      row.querySelector("[data-delete]").addEventListener("click", () => deleteSession(session));
    });
    listHost.querySelectorAll("[data-new]").forEach((btn) => btn.addEventListener("click", () => openForm()));

    if (animate && !prefersReduced()) {
      gsap.fromTo(listHost.children, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power3.out" });
      gsap.fromTo(statsHost.children, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.05 });
    }
  }

  function renderUpcoming() {
    const now = Date.now();
    const next = sessions
      .filter((s) => !s.completed && new Date(s.scheduled_at).getTime() > now)
      .slice(0, 4);

    upcomingHost.innerHTML = next.length
      ? `<div class="row-list" style="margin:-1.05rem -1.1rem">
          ${next
            .map(
              (session) => `
            <div class="row-item">
              <span class="row-item__dot" style="background:${subjectTone(session.subject) === "violet" ? "#a06bff" : "#8fb0ff"}"></span>
              <span class="row-item__main">
                <span class="row-item__title">${esc(session.title)}</span>
                <span class="row-item__meta">${esc(session.subject)} · ${fmtMinutes(session.duration)}</span>
              </span>
              <span class="row-item__aside">${esc(fmtDate(session.scheduled_at)) } · ${esc(fmtTime(session.scheduled_at))}</span>
            </div>`,
            )
            .join("")}
        </div>`
      : `<p class="muted" style="font-size:12.5px">No upcoming sessions. Book your next study block.</p>`;
  }

  /* -------------------------------------------------------------- chart */
  let chart = null;
  function renderChart() {
    const monday = startOfWeek();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return date;
    });
    const labels = days.map((d) => new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d));
    const data = days.map((day) =>
      sessions.filter((s) => sameDay(s.scheduled_at, day)).reduce((sum, s) => sum + s.duration, 0),
    );

    const canvas = root.querySelector("#planner-week");
    if (!canvas) return;

    if (!chart) {
      chart = makeChart(
        canvas,
        {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                data,
                backgroundColor: (context) => barGradient(context, "160,107,255"),
                borderRadius: 6,
                maxBarThickness: 22,
                categoryPercentage: 0.6,
              },
            ],
          },
          options: {
            responsive: true,
            scales: gridScale,
            plugins: { tooltip: { callbacks: { label: (item) => `${item.parsed.y} minutes planned` } } },
          },
        },
        charts,
      );
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.update();
    }
  }

  /* --------------------------------------------------------- mutations */
  async function toggleSession(session) {
    const next = !session.completed;
    session.completed = next;
    renderDay(true);
    renderUpcoming();
    if (next) {
      showToast({ type: "success", title: "Session complete", message: session.title });
    }
    const { error } = await supabase
      .from("study_sessions")
      .update({ completed: next })
      .eq("id", session.id)
      .eq("user_id", ctx.profile.id);
    if (error) {
      session.completed = !next;
      renderDay(true);
      showToast({ type: "error", title: "Couldn’t update", message: error.message });
    }
  }

  async function deleteSession(session) {
    const confirmed = await confirmDialog({
      title: "Delete this session?",
      message: `“${session.title}” will be removed from your planner.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    const index = sessions.findIndex((s) => s.id === session.id);
    const [removed] = sessions.splice(index, 1);
    renderWeek();
    renderDay(true);
    renderUpcoming();
    renderChart();

    const { error } = await supabase.from("study_sessions").delete().eq("id", session.id).eq("user_id", ctx.profile.id);
    if (error) {
      sessions.splice(index, 0, removed);
      renderWeek();
      renderDay();
      renderChart();
      showToast({ type: "error", title: "Couldn’t delete", message: error.message });
      return;
    }
    showToast({ type: "info", title: "Session deleted", message: removed.title });
  }

  /* -------------------------------------------------------------- form */
  function openForm(session = null) {
    const isEdit = Boolean(session);
    const defaultWhen = (() => {
      const base = new Date(selected);
      const now = new Date();
      if (sameDay(base, now) && now.getHours() >= 15) {
        base.setHours(now.getHours() + 1, 0, 0, 0);
      } else {
        base.setHours(17, 0, 0, 0);
      }
      return toLocalInput(base);
    })();

    openModal({
      title: isEdit ? "Edit study session" : "New study session",
      subtitle: "Short, specific blocks beat long vague ones.",
      wide: true,
      body: `
        <form class="form-grid" data-form novalidate>
          <div class="field span-2" data-name="title">
            <label class="field__label" for="sp-title">What will you study?</label>
            <div class="input-shell">
              ${icon("NotebookPen", { size: 17 })}
              <input class="input input--with-icon" id="sp-title" name="title" data-autofocus maxlength="140"
                     placeholder="Trigonometry identities drill" value="${esc(session?.title ?? "")}" required />
            </div>
            <span class="field__error" data-error></span>
          </div>

          <div class="field" data-name="subject">
            <label class="field__label" for="sp-subject">Subject</label>
            <div class="input-shell">
              ${icon("BookMarked", { size: 17 })}
              <select class="input input--with-icon" id="sp-subject" name="subject">
                ${SUBJECTS.map(
                  (subject) =>
                    `<option value="${esc(subject)}" ${session?.subject === subject ? "selected" : ""}>${esc(subject)}</option>`,
                ).join("")}
              </select>
            </div>
          </div>

          <div class="field" data-name="duration">
            <label class="field__label" for="sp-duration">Duration (minutes)</label>
            <div class="input-shell">
              ${icon("Timer", { size: 17 })}
              <input class="input input--with-icon" id="sp-duration" name="duration" type="number" min="5" max="600" step="5"
                     value="${session?.duration ?? 45}" />
            </div>
          </div>

          <div class="field span-2" data-name="scheduled_at">
            <label class="field__label" for="sp-when">Date &amp; time</label>
            <div class="input-shell">
              ${icon("CalendarClock", { size: 17 })}
              <input class="input input--with-icon" id="sp-when" name="scheduled_at" type="datetime-local"
                     value="${session ? toLocalInput(session.scheduled_at) : defaultWhen}" required />
            </div>
            <span class="field__error" data-error></span>
          </div>

          <div class="field span-2" data-name="notes">
            <label class="field__label" for="sp-notes">Notes <span class="dim">optional</span></label>
            <div class="input-shell" style="align-items:flex-start">
              <textarea class="input" id="sp-notes" name="notes" rows="3" maxlength="1200"
                        placeholder="Chapter 8, focus on Exercise 8.4">${esc(session?.notes ?? "")}</textarea>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--ghost" data-cancel>Cancel</button>
        <button class="btn btn--primary" data-save data-magnetic>
          <span class="btn__spinner"></span>
          <span class="btn__label">${isEdit ? "Save changes" : "Add to planner"}</span>
        </button>
      `,
      onMount: ({ modal, close }) => {
        const form = modal.querySelector("[data-form]");
        const save = modal.querySelector("[data-save]");
        modal.querySelector("[data-cancel]").addEventListener("click", close);
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          save.click();
        });

        save.addEventListener("click", async () => {
          // `form.title` is the form's title attribute, not the input — query explicitly.
          const title = form.querySelector('[name="title"]').value.trim();
          const scheduled_at = form.querySelector('[name="scheduled_at"]').value;
          const duration = Number(form.querySelector('[name="duration"]').value);

          const invalid = [];
          if (!title) invalid.push(["title", "Name this session."]);
          if (!scheduled_at) invalid.push(["scheduled_at", "Pick a date and time."]);
          if (!duration || duration < 5) invalid.push(["duration", "At least 5 minutes."]);

          invalid.forEach(([name, message]) => {
            const field = form.querySelector(`.field[data-name="${name}"]`);
            field?.classList.add("is-invalid");
            const slot = field?.querySelector("[data-error]");
            if (slot) slot.textContent = message;
          });
          if (invalid.length) return;

          save.setAttribute("aria-busy", "true");
          save.disabled = true;

          const payload = {
            title,
            subject: form.querySelector('[name="subject"]').value,
            scheduled_at: new Date(scheduled_at).toISOString(),
            duration: Math.round(duration),
            notes: form.querySelector('[name="notes"]').value.trim() || null,
          };

          const response = isEdit
            ? await supabase
                .from("study_sessions")
                .update(payload)
                .eq("id", session.id)
                .eq("user_id", ctx.profile.id)
                .select()
                .single()
            : await supabase
                .from("study_sessions")
                .insert({ ...payload, user_id: ctx.profile.id })
                .select()
                .single();

          save.removeAttribute("aria-busy");
          save.disabled = false;

          if (response.error) {
            showToast({ type: "error", title: "Couldn’t save", message: response.error.message });
            return;
          }

          // PostgREST returns a single object for `.single()`; stay tolerant of an array.
          const saved = Array.isArray(response.data) ? response.data[0] : response.data;
          if (!saved) {
            showToast({ type: "error", title: "Couldn’t save", message: "The record was not returned. Please retry." });
            return;
          }
          if (isEdit) {
            const index = sessions.findIndex((s) => s.id === saved.id);
            if (index >= 0) sessions[index] = saved;
          } else {
            sessions.push(saved);
          }
          sessions.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

          selected = startOfDay(new Date(saved.scheduled_at));
          close();
          renderWeek();
          renderDay(true);
          renderUpcoming();
          renderChart();
          showToast({
            type: "success",
            title: isEdit ? "Session updated" : "Session planned",
            message: `${saved.title} · ${fmtTime(saved.scheduled_at)}`,
          });
        });
      },
    });
  }

  /* ------------------------------------------------------------- wiring */
  const onNewRequest = () => openForm();
  document.addEventListener("academia:new-session", onNewRequest);
  root.querySelector("[data-new]").addEventListener("click", () => openForm());
  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));

  await load();
  renderWeek();
  renderDay();
  renderUpcoming();
  renderChart();
  scrollReveal(root.querySelectorAll(".panel"), { y: 18 });

  return () => {
    document.removeEventListener("academia:new-session", onNewRequest);
    destroyCharts(charts);
    killScrollTriggers();
    chart = null;
  };
}

void countTo;
