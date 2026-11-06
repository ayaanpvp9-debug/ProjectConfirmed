/**
 * Homework Manager — CRUD, filtering, and the animated completion bar.
 */
import { supabase, unwrap } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import { SUBJECTS, PRIORITIES } from "../lib/config.js";
import {
  esc,
  fmtDeadline,
  fmtDateTime,
  pct,
  subjectTone,
  toLocalInput,
  debounce,
  cls,
} from "../lib/dom.js";
import { showToast } from "../ui/toast.js";
import { openModal, confirmDialog } from "../ui/modal.js";
import {
  gsap,
  prefersReduced,
  countTo,
  animateBar,
  flipLayout,
  magnetic,
  pulseOnce,
  scrollReveal,
  killScrollTriggers,
} from "../lib/motion.js";
import { pageHead, makeChart, destroyCharts, gridScale, barGradient, emptyState } from "./_shared.js";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export async function render(root, ctx) {
  const charts = [];
  let tasks = [];
  let filter = "all";
  let sort = "deadline";
  let query = "";

  root.innerHTML = `
    ${pageHead({
      eyebrow: "Organise",
      title: "Homework Manager",
      subtitle: "Every assignment, deadline and priority in one calm, animated ledger.",
      actions: `
        <button class="btn btn--primary btn--sm" data-new data-magnetic>
          ${icon("Plus", { size: 15 })}<span class="btn__label">New assignment</span>
        </button>
      `,
    })}

    <section class="hw-progress">
      <div class="hw-progress__top">
        <div>
          <span class="hw-progress__label">Your homework progress</span>
          <div class="hw-progress__headline">
            <span class="hw-progress__pct"><span data-progress-value>0</span><small>%</small></span>
            <span class="hw-progress__caption" data-progress-caption>Loading your assignments…</span>
          </div>
        </div>
        <div class="hw-counts">
          <div class="hw-count">
            <span class="hw-count__value" data-count-total>0</span>
            <span class="hw-count__label">Total</span>
          </div>
          <div class="hw-count hw-count--done">
            <span class="hw-count__value" data-count-done>0</span>
            <span class="hw-count__label">Completed</span>
          </div>
          <div class="hw-count hw-count--left">
            <span class="hw-count__value" data-count-left>0</span>
            <span class="hw-count__label">Remaining</span>
          </div>
          <div class="hw-count">
            <span class="hw-count__value" data-count-overdue>0</span>
            <span class="hw-count__label">Overdue</span>
          </div>
        </div>
      </div>

      <div class="hw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-bar-host>
        <div class="hw-bar__fill" data-bar></div>
      </div>
      <div class="hw-bar__ticks">
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
      </div>
    </section>

    <div class="dash-row" style="margin-bottom:1rem">
      <div class="panel">
        <header class="panel__head">
          <h3 class="panel__title">${icon("Layers", { size: 15 })}Assignments</h3>
          <div class="segmented" data-filter role="group" aria-label="Filter assignments">
            <button data-filter-value="all" aria-pressed="true">All<span class="segmented__count" data-count="all">0</span></button>
            <button data-filter-value="pending" aria-pressed="false">Pending<span class="segmented__count" data-count="pending">0</span></button>
            <button data-filter-value="completed" aria-pressed="false">Completed<span class="segmented__count" data-count="completed">0</span></button>
            <button data-filter-value="overdue" aria-pressed="false">Overdue<span class="segmented__count" data-count="overdue">0</span></button>
          </div>
        </header>
        <div class="panel__body">
          <div class="toolbar">
            <label class="search-shell">
              ${icon("Search", { size: 14 })}
              <input type="search" placeholder="Search title, subject, description…" data-search aria-label="Search assignments" />
            </label>
            <label class="search-shell" style="max-width:190px;flex:0 0 auto">
              ${icon("ArrowUpDown", { size: 14 })}
              <select class="input" data-sort style="padding:0;border:0;background:transparent;font-size:12.5px" aria-label="Sort assignments">
                <option value="deadline">Deadline first</option>
                <option value="priority">Priority</option>
                <option value="created">Newest</option>
                <option value="title">A → Z</option>
              </select>
            </label>
          </div>
          <div class="hw-grid" data-grid></div>
        </div>
      </div>

      <div class="dash-stack">
        <div class="panel">
          <header class="panel__head">
            <h3 class="panel__title">${icon("ChartLine", { size: 15 })}Weekly completion</h3>
            <span class="panel__hint">last 7 days</span>
          </header>
          <div class="panel__body">
            <div class="chart-wrap chart-wrap--sm"><canvas id="hw-week"></canvas></div>
          </div>
        </div>
        <div class="panel">
          <header class="panel__head">
            <h3 class="panel__title">${icon("Flame", { size: 15 })}Focus queue</h3>
          </header>
          <div class="panel__body" data-focus-queue></div>
        </div>
      </div>
    </div>
  `;

  const grid = root.querySelector("[data-grid]");
  const bar = root.querySelector("[data-bar]");
  const barHost = root.querySelector("[data-bar-host]");
  const progressValue = root.querySelector("[data-progress-value]");
  const caption = root.querySelector("[data-progress-caption]");

  /* ---------------------------------------------------------------- load */
  async function load() {
    const rows = unwrap(
      await supabase
        .from("homework")
        .select("id, title, description, subject, deadline, priority, status, completed_at, created_at")
        .eq("user_id", ctx.profile.id)
        .order("deadline", { ascending: true }),
    );
    tasks = rows ?? [];
  }

  function counts() {
    const now = Date.now();
    return {
      all: tasks.length,
      pending: tasks.filter((t) => t.status !== "completed").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter((t) => t.status !== "completed" && new Date(t.deadline).getTime() < now).length,
    };
  }

  /* ------------------------------------------------------------- stats */
  function renderStats({ animate = true } = {}) {
    const c = counts();
    const done = c.completed;
    const total = c.all;
    const percent = pct(done, total);
    const remaining = total - done;

    barHost.setAttribute("aria-valuenow", String(percent));

    const from = Number.parseFloat(bar.style.width) || 0;
    if (animate) {
      animateBar(bar, percent, { from, duration: 1.1 });
      countTo(progressValue, percent, { duration: 1.1 });
    } else {
      bar.style.width = `${percent}%`;
      progressValue.textContent = String(percent);
    }

    countTo(root.querySelector("[data-count-total]"), total, { duration: 0.8 });
    countTo(root.querySelector("[data-count-done]"), done, { duration: 0.8 });
    countTo(root.querySelector("[data-count-left]"), remaining, { duration: 0.8 });
    countTo(root.querySelector("[data-count-overdue]"), c.overdue, { duration: 0.8 });

    caption.textContent = total
      ? `${done} of ${total} complete · ${remaining} to go${c.overdue ? ` · ${c.overdue} overdue` : ""}`
      : "No assignments yet — add your first one.";

    root.querySelectorAll("[data-count]").forEach((el) => {
      el.textContent = String(c[el.dataset.count] ?? 0);
    });

    renderFocusQueue();
  }

  function renderFocusQueue() {
    const host = root.querySelector("[data-focus-queue]");
    if (!host) return;
    const next = tasks
      .filter((t) => t.status !== "completed")
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
      .slice(0, 3);

    host.innerHTML = next.length
      ? `<div class="row-list" style="margin:-1.05rem -1.1rem">
          ${next
            .map((task) => {
              const overdue = new Date(task.deadline).getTime() < Date.now();
              return `
              <div class="row-item">
                <span class="row-item__dot" style="background:${overdue ? "#ff7ab8" : "#8fb0ff"}"></span>
                <span class="row-item__main">
                  <span class="row-item__title">${esc(task.title)}</span>
                  <span class="row-item__meta">${esc(task.subject)} · ${esc(task.priority)}</span>
                </span>
                <span class="row-item__aside" style="color:${overdue ? "#ff9dc0" : "var(--muted)"}">${esc(fmtDeadline(task.deadline))}</span>
              </div>`;
            })
            .join("")}
        </div>`
      : `<p class="muted" style="font-size:12.5px">Nothing waiting. Add an assignment to build your queue.</p>`;
  }

  /* -------------------------------------------------------------- cards */
  function visibleTasks() {
    const now = Date.now();
    let list = [...tasks];

    if (filter === "pending") list = list.filter((t) => t.status !== "completed");
    if (filter === "completed") list = list.filter((t) => t.status === "completed");
    if (filter === "overdue") {
      list = list.filter((t) => t.status !== "completed" && new Date(t.deadline).getTime() < now);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) =>
        `${t.title} ${t.subject} ${t.description ?? ""}`.toLowerCase().includes(q),
      );
    }

    const sorters = {
      deadline: (a, b) => new Date(a.deadline) - new Date(b.deadline),
      priority: (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        new Date(a.deadline) - new Date(b.deadline),
      created: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return list.sort(sorters[sort] ?? sorters.deadline);
  }

  function cardMarkup(task) {
    const isDone = task.status === "completed";
    const deadline = new Date(task.deadline).getTime();
    const overdue = !isDone && deadline < Date.now();
    const soon = !isDone && deadline >= Date.now() && deadline - Date.now() < 36 * 3600 * 1000;
    const tone = subjectTone(task.subject);

    return `
      <article class="hw-card" data-id="${task.id}" data-status="${isDone ? "completed" : "pending"}"
               data-priority="${task.priority}">
        <div class="hw-card__top">
          <span class="subject-chip" data-tone="${tone}">${esc(task.subject)}</span>
          <span class="badge ${isDone ? "badge--done" : `badge--${task.priority}`}">
            ${icon(isDone ? "Check" : task.priority === "high" ? "Flame" : "Flag", { size: 11 })}
            ${isDone ? "done" : task.priority}
          </span>
        </div>

        <h4 class="hw-card__title">${esc(task.title)}</h4>
        ${task.description ? `<p class="hw-card__desc">${esc(task.description)}</p>` : ""}

        <div class="hw-card__foot">
          <span class="hw-card__due ${overdue ? "is-overdue" : soon ? "is-soon" : ""}">
            ${icon(overdue ? "AlertTriangle" : "CalendarDays", { size: 12 })}
            ${esc(fmtDeadline(task.deadline))} · ${esc(fmtDateTime(task.deadline).split("·")[1] ?? "")}
          </span>
          <span class="hw-card__actions">
            <button class="hw-check" data-toggle data-done="${isDone}" aria-label="${isDone ? "Reopen" : "Mark complete"}: ${esc(task.title)}">
              ${icon(isDone ? "RotateCcw" : "Check", { size: 12 })}
              <span>${isDone ? "Reopen" : "Done"}</span>
            </button>
            <button class="mini-btn" data-edit aria-label="Edit ${esc(task.title)}">${icon("Pencil", { size: 14 })}</button>
            <button class="mini-btn mini-btn--danger" data-delete aria-label="Delete ${esc(task.title)}">${icon("Trash2", { size: 14 })}</button>
          </span>
        </div>
      </article>`;
  }

  function renderList() {
    const list = visibleTasks();
    grid.innerHTML = list.length
      ? list.map(cardMarkup).join("")
      : emptyState({
          iconName: filter === "completed" ? "CheckCheck" : "ClipboardList",
          title:
            filter === "completed"
              ? "No completed assignments yet"
              : filter === "overdue"
                ? "Nothing overdue — nice"
                : query
                  ? "No matches"
                  : "Your ledger is empty",
          text:
            filter === "completed"
              ? "Finish an assignment and it will land here with a strike-through."
              : filter === "overdue"
                ? "Every open assignment is still on schedule."
                : query
                  ? "Try a different search term."
                  : "Add your first assignment to start tracking real progress.",
          action: query
            ? ""
            : `<button class="btn btn--primary btn--sm" data-new>${icon("Plus", { size: 14 })}<span class="btn__label">New assignment</span></button>`,
        });

    grid.querySelectorAll("[data-new]").forEach((btn) => btn.addEventListener("click", openForm));
    grid.querySelectorAll(".hw-card").forEach((card) => {
      const task = tasks.find((t) => t.id === card.dataset.id);
      if (!task) return;
      card.querySelector("[data-toggle]").addEventListener("click", () => toggleTask(task, card));
      card.querySelector("[data-edit]").addEventListener("click", () => openForm(task));
      card.querySelector("[data-delete]").addEventListener("click", () => deleteTask(task, card));
    });
  }

  /* ------------------------------------------------------------ mutations */
  async function toggleTask(task, card) {
    const nextStatus = task.status === "completed" ? "pending" : "completed";
    const button = card.querySelector("[data-toggle]");
    button.disabled = true;

    // optimistic update keeps the animation instant
    const previous = { ...task };
    task.status = nextStatus;
    task.completed_at = nextStatus === "completed" ? new Date().toISOString() : null;

    flipLayout(grid, renderList);
    renderStats({ animate: true });
    if (nextStatus === "completed") pulseOnce(card);

    const { error } = await supabase
      .from("homework")
      .update({
        status: nextStatus,
        completed_at: task.completed_at,
      })
      .eq("id", task.id)
      .eq("user_id", ctx.profile.id);

    if (error) {
      Object.assign(task, previous);
      flipLayout(grid, renderList);
      renderStats({ animate: true });
      showToast({ type: "error", title: "Couldn’t update", message: error.message });
      return;
    }

    if (nextStatus === "completed") {
      showToast({ type: "success", title: "Assignment complete", message: task.title });
    } else {
      showToast({ type: "info", title: "Assignment reopened", message: task.title });
    }
    ctx.onHomeworkChanged?.();
  }

  async function deleteTask(task, card) {
    const confirmed = await confirmDialog({
      title: "Delete this assignment?",
      message: `“${task.title}” will be removed from your ledger. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    const index = tasks.findIndex((t) => t.id === task.id);
    const [removed] = tasks.splice(index, 1);
    flipLayout(grid, renderList);
    renderStats({ animate: true });

    const { error } = await supabase.from("homework").delete().eq("id", task.id).eq("user_id", ctx.profile.id);
    if (error) {
      tasks.splice(index, 0, removed);
      flipLayout(grid, renderList);
      renderStats({ animate: false });
      showToast({ type: "error", title: "Couldn’t delete", message: error.message });
      return;
    }
    showToast({ type: "info", title: "Assignment deleted", message: removed.title });
    ctx.onHomeworkChanged?.();
  }

  /* ----------------------------------------------------------------- form */
  function openForm(task = null) {
    const isEdit = Boolean(task);
    const defaultDeadline = toLocalInput(new Date(Date.now() + 24 * 3600 * 1000));

    const handle = openModal({
      title: isEdit ? "Edit assignment" : "New assignment",
      subtitle: isEdit ? "Update the details and save." : "Give it a title, a subject and a deadline.",
      body: `
        <form class="form-grid" data-form novalidate>
          <div class="field span-2" data-name="title">
            <label class="field__label" for="hw-title">Title</label>
            <div class="input-shell">
              ${icon("ClipboardList", { size: 17 })}
              <input class="input input--with-icon" id="hw-title" name="title" maxlength="140"
                     data-autofocus placeholder="Quadratic equations — Exercise 4.3"
                     value="${esc(task?.title ?? "")}" required />
            </div>
            <span class="field__error" data-error></span>
          </div>

          <div class="field" data-name="subject">
            <label class="field__label" for="hw-subject">Subject</label>
            <div class="input-shell">
              ${icon("BookMarked", { size: 17 })}
              <select class="input input--with-icon" id="hw-subject" name="subject">
                ${SUBJECTS.map(
                  (subject) =>
                    `<option value="${esc(subject)}" ${task?.subject === subject ? "selected" : ""}>${esc(subject)}</option>`,
                ).join("")}
              </select>
            </div>
          </div>

          <div class="field" data-name="priority">
            <label class="field__label" for="hw-priority">Priority</label>
            <div class="input-shell">
              ${icon("Flag", { size: 17 })}
              <select class="input input--with-icon" id="hw-priority" name="priority">
                ${PRIORITIES.map(
                  (p) =>
                    `<option value="${p.value}" ${task?.priority === p.value ? "selected" : ""}>${p.label}</option>`,
                ).join("")}
              </select>
            </div>
          </div>

          <div class="field span-2" data-name="deadline">
            <label class="field__label" for="hw-deadline">Deadline</label>
            <div class="input-shell">
              ${icon("CalendarClock", { size: 17 })}
              <input class="input input--with-icon" id="hw-deadline" name="deadline" type="datetime-local"
                     value="${task ? toLocalInput(task.deadline) : defaultDeadline}" required />
            </div>
            <span class="field__error" data-error></span>
          </div>

          <div class="field span-2" data-name="description">
            <label class="field__label" for="hw-desc">Description <span class="dim">optional</span></label>
            <div class="input-shell" style="align-items:flex-start">
              <textarea class="input" id="hw-desc" name="description" rows="3" maxlength="1200"
                        placeholder="What exactly needs to be done?">${esc(task?.description ?? "")}</textarea>
            </div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn--ghost" data-cancel>Cancel</button>
        <button class="btn btn--primary" data-save data-magnetic>
          <span class="btn__spinner"></span>
          <span class="btn__label">${isEdit ? "Save changes" : "Create assignment"}</span>
        </button>
      `,
      wide: true,
      onMount: ({ modal, close }) => {
        const form = modal.querySelector("[data-form]");
        const saveButton = modal.querySelector("[data-save]");

        modal.querySelector("[data-cancel]").addEventListener("click", close);

        form.addEventListener("submit", (event) => {
          event.preventDefault();
          saveButton.click();
        });

        saveButton.addEventListener("click", async () => {
          // `form.title` is the form's title attribute, not the input — query explicitly.
          const title = form.querySelector('[name="title"]').value.trim();
          const deadline = form.querySelector('[name="deadline"]').value;
          const subject = form.querySelector('[name="subject"]').value;
          const priority = form.querySelector('[name="priority"]').value;
          const description = form.querySelector('[name="description"]').value.trim();

          const errors = {};
          if (!title) errors.title = "Give this assignment a title.";
          if (!deadline) errors.deadline = "Pick a deadline.";
          if (!subject) errors.subject = "Choose a subject.";

          Object.entries(errors).forEach(([key, message]) => {
            const field = form.querySelector(`.field[data-name="${key}"]`);
            field?.classList.add("is-invalid");
            const slot = field?.querySelector("[data-error]");
            if (slot) slot.textContent = message;
          });
          if (Object.keys(errors).length) return;

          saveButton.setAttribute("aria-busy", "true");
          saveButton.disabled = true;

          const payload = {
            title,
            description: description || null,
            subject,
            deadline: new Date(deadline).toISOString(),
            priority,
          };

          const response = isEdit
            ? await supabase.from("homework").update(payload).eq("id", task.id).eq("user_id", ctx.profile.id).select().single()
            : await supabase.from("homework").insert({ ...payload, user_id: ctx.profile.id }).select().single();

          saveButton.removeAttribute("aria-busy");
          saveButton.disabled = false;

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
            const index = tasks.findIndex((t) => t.id === saved.id);
            if (index >= 0) tasks[index] = { ...tasks[index], ...saved };
          } else {
            tasks.push(saved);
          }

          close();
          flipLayout(grid, renderList);
          renderStats({ animate: true });
          refreshChart();
          ctx.onHomeworkChanged?.();
          showToast({
            type: "success",
            title: isEdit ? "Assignment updated" : "Assignment created",
            message: saved.title,
          });
        });
      },
    });

    void handle;
  }

  /* ---------------------------------------------------------------- chart */
  let weekChart = null;

  function buildWeekChart() {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const labels = days.map((d) => new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(d));
    const data = days.map(
      (d) => tasks.filter((t) => t.completed_at && dayKey(t.completed_at) === dayKey(d)).length,
    );

    const canvas = root.querySelector("#hw-week");
    if (!canvas) return;

    if (!weekChart) {
      weekChart = makeChart(
        canvas,
        {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                data,
                backgroundColor: (context) => barGradient(context, "123,241,197"),
                borderRadius: 6,
                maxBarThickness: 22,
                categoryPercentage: 0.62,
              },
            ],
          },
          options: {
            responsive: true,
            scales: gridScale,
            plugins: {
              tooltip: {
                callbacks: { label: (item) => `${item.parsed.y} completed` },
              },
            },
          },
        },
        charts,
      );
    } else {
      weekChart.data.labels = labels;
      weekChart.data.datasets[0].data = data;
      weekChart.update();
    }
  }

  function refreshChart() {
    buildWeekChart();
  }

  /* ---------------------------------------------------------------- wiring */
  const search = root.querySelector("[data-search]");
  search.addEventListener(
    "input",
    debounce((event) => {
      query = event.target.value;
      flipLayout(grid, renderList);
    }, 220),
  );

  root.querySelector("[data-sort]").addEventListener("change", (event) => {
    sort = event.target.value;
    flipLayout(grid, renderList);
  });

  root.querySelectorAll("[data-filter-value]").forEach((button) => {
    button.addEventListener("click", () => {
      filter = button.dataset.filterValue;
      root.querySelectorAll("[data-filter-value]").forEach((other) => {
        other.setAttribute("aria-pressed", String(other === button));
      });
      flipLayout(grid, renderList);
    });
  });

  root.querySelector("[data-new]").addEventListener("click", () => openForm());
  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));

  const onNewRequest = () => openForm();
  document.addEventListener("academia:new-homework", onNewRequest);

  /* ---------------------------------------------------------------- init */
  await load();
  renderStats({ animate: false });
  renderList();
  buildWeekChart();
  scrollReveal(root.querySelectorAll(".panel"), { y: 18 });

  if (!prefersReduced()) {
    const from = 0;
    gsap.delayedCall(0.25, () => {
      const target = pct(counts().completed, counts().all);
      animateBar(bar, target, { from, duration: 1.3 });
      countTo(progressValue, target, { duration: 1.3 });
    });
  }

  return () => {
    document.removeEventListener("academia:new-homework", onNewRequest);
    destroyCharts(charts);
    killScrollTriggers();
    weekChart = null;
  };
}

void cls;
