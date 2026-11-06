/**
 * Mock Tests — five subjects, server-graded exams, review with explanations.
 * Answer keys never reach the browser before submission (enforced by RLS +
 * the `mock-test` Edge Function).
 */
import { api } from "../lib/api.js";
import { icon } from "../lib/icons.js";
import { esc, fmtDate, fmtMinutes, fmtRelative } from "../lib/dom.js";
import { showToast } from "../ui/toast.js";
import { openModal, confirmDialog } from "../ui/modal.js";
import { gsap, prefersReduced, magnetic, scrollReveal, killScrollTriggers } from "../lib/motion.js";
import { pageHead, ringMarkup, animateRing, emptyState } from "./_shared.js";

const SUBJECT_ICONS = {
  mathematics: "Sigma",
  science: "FlaskConical",
  english: "BookText",
  "social-science": "Landmark",
  "computer-science": "Cpu",
};

const OPTION_KEYS = ["A", "B", "C", "D"];

export async function render(root, ctx) {
  let tests = [];
  let attempts = [];
  let activeSubject = null;
  let examOpen = false;
  let closeActiveExam = null;

  root.innerHTML = `
    ${pageHead({
      eyebrow: "Exams",
      title: "Mock Tests",
      subtitle: "Five subjects. Real questions. Graded on the server, answers revealed only after you submit.",
      actions: `<span class="badge">${icon("ShieldCheck", { size: 11 })} server-graded</span>`,
    })}
    <div class="subject-grid" data-subjects></div>
    <div class="panel">
      <header class="panel__head">
        <h3 class="panel__title">${icon("FileText", { size: 15 })}<span data-tests-title>Available tests</span></h3>
        <span class="panel__hint" data-tests-hint></span>
      </header>
      <div class="panel__body">
        <div class="test-list" data-tests></div>
      </div>
    </div>
    <div class="panel" style="margin-top:1rem">
      <header class="panel__head">
        <h3 class="panel__title">${icon("History", { size: 15 })}Attempt history</h3>
      </header>
      <div class="panel__body panel__body--flush" data-history></div>
    </div>
  `;

  const subjectHost = root.querySelector("[data-subjects]");
  const testsHost = root.querySelector("[data-tests]");
  const historyHost = root.querySelector("[data-history]");
  const testsTitle = root.querySelector("[data-tests-title]");
  const testsHint = root.querySelector("[data-tests-hint]");

  /* ---------------------------------------------------------------- load */
  async function load() {
    const data = await api.mockList();
    tests = data.tests ?? [];
    attempts = data.attempts ?? [];
  }

  const subjects = () => {
    const map = new Map();
    tests.forEach((test) => {
      const subject = test.mock_subjects;
      if (!subject) return;
      if (!map.has(subject.slug)) {
        map.set(subject.slug, {
          slug: subject.slug,
          name: subject.name,
          accent: subject.accent,
          tests: [],
        });
      }
      map.get(subject.slug).tests.push(test);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  };

  const completedFor = (testId) =>
    attempts
      .filter((a) => a.test_id === testId && a.status === "completed")
      .sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

  const openAttemptFor = (testId) => attempts.find((a) => a.test_id === testId && a.status === "in_progress");

  /* ------------------------------------------------------------ subjects */
  function renderSubjects() {
    const list = subjects();
    if (!list.length) {
      subjectHost.innerHTML = emptyState({
        iconName: "Target",
        title: "No mock tests configured",
        text: "Seed the mock_subjects and mock_tests tables to publish exams.",
      });
      return;
    }

    if (!activeSubject) activeSubject = list[0].slug;

    subjectHost.innerHTML = list
      .map((subject) => {
        const exams = completedFor2(subject.tests);
        const best = exams.length ? Math.max(...exams.map((a) => Math.round((a.score / (a.total_questions || 1)) * 100))) : null;
        const count = subject.tests.length;
        const questionCount = subject.tests.reduce((sum, test) => sum + (test.mock_questions?.[0]?.count ?? 0), 0);
        return `
        <button class="subject-card" data-subject="${subject.slug}" aria-pressed="${subject.slug === activeSubject}">
          <span class="subject-card__icon">${icon(SUBJECT_ICONS[subject.slug] ?? "BookOpen", { size: 16 })}</span>
          <span class="subject-card__name">${esc(subject.name)}</span>
          <span class="subject-card__desc">${questionCount} questions · ${count} timed test${count === 1 ? "" : "s"}</span>
          <span class="subject-card__foot">
            <span>${count} test${count === 1 ? "" : "s"}</span>
            <span>${best === null ? "not attempted" : `best ${best}%`}</span>
          </span>
        </button>`;
      })
      .join("");

    subjectHost.querySelectorAll("[data-subject]").forEach((button) => {
      button.addEventListener("click", () => {
        activeSubject = button.dataset.subject;
        renderSubjects();
        renderTests(true);
      });
    });
  }

  function completedFor2(list) {
    const ids = new Set(list.map((t) => t.id));
    return attempts.filter((a) => ids.has(a.test_id) && a.status === "completed");
  }

  /* --------------------------------------------------------------- tests */
  function renderTests(animate = false) {
    const subject = subjects().find((s) => s.slug === activeSubject);
    if (!subject) return;

    testsTitle.textContent = `${subject.name} tests`;
    testsHint.textContent = `${subject.tests.length} available`;

    testsHost.innerHTML = subject.tests
      .map((test) => {
        const count = test.mock_questions?.[0]?.count ?? 0;
        const completed = completedFor(test.id);
        const best = completed.length
          ? Math.max(...completed.map((a) => Math.round((a.score / (a.total_questions || 1)) * 100)))
          : null;
        const inProgress = openAttemptFor(test.id);
        const lastCompleted = completed[0];

        return `
        <div class="test-row" data-test="${test.id}">
          <span class="subject-card__icon">${icon(SUBJECT_ICONS[subject.slug] ?? "FileText", { size: 16 })}</span>
          <span class="test-row__body">
            <span class="test-row__title">${esc(test.title)}</span>
            <span class="test-row__desc">${esc(test.description ?? "")}</span>
            <span class="test-row__meta">
              <span>${icon("Clock", { size: 11 })}${test.duration_minutes} min</span>
              <span>${icon("ListChecks", { size: 11 })}${count} questions</span>
              <span>${icon("Signal", { size: 11 })}${esc(test.difficulty)}</span>
              ${lastCompleted ? `<span>${icon("History", { size: 11 })}${esc(fmtRelative(lastCompleted.completed_at ?? lastCompleted.started_at))}</span>` : ""}
            </span>
          </span>
          ${
            best !== null
              ? `<span class="test-row__score"><strong>${best}%</strong><span>best</span></span>`
              : ""
          }
          <button class="btn btn--sm ${inProgress ? "btn--danger" : "btn--primary"}" data-start data-magnetic>
            ${icon(inProgress ? "Play" : "Play", { size: 14 })}
            <span class="btn__label">${inProgress ? "Resume" : "Start"}</span>
          </button>
        </div>`;
      })
      .join("");

    testsHost.querySelectorAll("[data-test]").forEach((row) => {
      const test = tests.find((t) => t.id === row.dataset.test);
      if (!test) return;
      row.querySelector("[data-start]").addEventListener("click", () => showInstructions(test));
    });

    if (animate && !prefersReduced()) {
      gsap.fromTo(
        testsHost.children,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power3.out" },
      );
    }
  }

  /* ---------------------------------------------------------- history */
  function renderHistory() {
    const completed = attempts
      .filter((a) => a.status === "completed")
      .sort((a, b) => new Date(b.completed_at ?? b.started_at) - new Date(a.completed_at ?? a.started_at))
      .slice(0, 8);

    if (!completed.length) {
      historyHost.innerHTML = emptyState({
        iconName: "History",
        title: "No attempts yet",
        text: "Your submitted mock tests will be listed here with scores and dates.",
      });
      return;
    }

    historyHost.innerHTML = `
      <div class="row-list">
        ${completed
          .map((attempt) => {
            const test = tests.find((t) => t.id === attempt.test_id);
            const percentage = Math.round((attempt.score / (attempt.total_questions || 1)) * 100);
            const tier = percentage >= 70 ? "high" : percentage >= 40 ? "mid" : "low";
            return `
            <div class="row-item">
              <span class="row-item__dot" style="background:${percentage >= 70 ? "#7bf1c5" : percentage >= 40 ? "#ffc06a" : "#ff7ab8"}"></span>
              <span class="row-item__main">
                <span class="row-item__title">${esc(test?.title ?? "Mock test")}</span>
                <span class="row-item__meta">${esc(test?.mock_subjects?.name ?? "")} · ${esc(fmtDate(attempt.completed_at ?? attempt.started_at))}</span>
              </span>
              <span class="score-pill" data-tier="${tier}">${attempt.score}/${attempt.total_questions} · ${percentage}%</span>
            </div>`;
          })
          .join("")}
      </div>`;
  }

  /* ------------------------------------------------------ instructions */
  function showInstructions(test) {
    const count = test.mock_questions?.[0]?.count ?? 0;
    const inProgress = openAttemptFor(test.id);

    openModal({
      title: test.title,
      subtitle: `${test.mock_subjects?.name ?? ""} · ${test.duration_minutes} minutes · ${count} questions`,
      wide: true,
      body: `
        <p style="font-size:13px;line-height:1.65;color:var(--muted)">${esc(test.description ?? "")}</p>
        <div class="section-grid" style="margin-top:0.4rem">
          ${[
            ["Clock", "Timed attempt", `The clock starts immediately. ${test.duration_minutes} minutes for ${count} questions.`],
            ["Save", "Auto-saved progress", "Every answer is stored server-side — refreshing keeps your answers."],
            ["Flag", "Mark for review", "Flag tricky questions and jump back from the palette."],
            ["ShieldCheck", "Answers stay hidden", "Solutions unlock only after you submit, and grading happens on the server."],
          ]
            .map(
              ([iconName, title, text]) => `
            <div style="display:flex;gap:0.7rem;align-items:flex-start">
              <span class="timeline__marker" style="flex:none">${icon(iconName, { size: 13 })}</span>
              <span>
                <strong style="display:block;font-family:var(--font-display);font-size:12.5px;color:#fff;font-weight:500">${title}</strong>
                <span style="font-size:11.5px;color:var(--muted)">${text}</span>
              </span>
            </div>`,
            )
            .join("")}
        </div>
      `,
      footer: `
        <button class="btn btn--ghost" data-close>Not now</button>
        <button class="btn btn--primary" data-begin data-magnetic>
          ${icon("Play", { size: 15 })}
          <span class="btn__label">${inProgress ? "Resume exam" : "Start exam"}</span>
        </button>
      `,
      onMount: ({ modal, close }) => {
        modal.querySelector("[data-close]").addEventListener("click", close);
        modal.querySelector("[data-begin]").addEventListener("click", () => {
          close();
          openExam(test, { resume: Boolean(inProgress) });
        });
      },
    });
  }

  /* ------------------------------------------------------------- exam */
  async function openExam(test, { resume = false } = {}) {
    if (examOpen) return;
    examOpen = true;

    const overlay = document.createElement("div");
    overlay.className = "exam";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", test.title);
    overlay.innerHTML = `
      <div class="exam__head">
        <button class="icon-btn" data-exit aria-label="Leave exam">${icon("ArrowLeft", { size: 18 })}</button>
        <div class="exam__title">
          <strong>${esc(test.title)}</strong>
          <span>${esc(test.mock_subjects?.name ?? "")} · ${test.duration_minutes} min</span>
        </div>
        <div class="topbar__spacer"></div>
        <span class="save-indicator" data-save-state>${icon("Cloud", { size: 12 })}<span>ready</span></span>
        <span class="timer" data-timer>${icon("Timer", { size: 14 })}<span data-timer-text>--:--</span></span>
      </div>
      <div class="exam__body">
        <div class="exam__question" data-question>
          <div class="empty">
            <span class="empty__icon">${icon("Loader2", { size: 20, class: "spin" })}</span>
            <p class="empty__text">Preparing your attempt…</p>
          </div>
        </div>
        <aside class="exam__palette" data-palette></aside>
      </div>
      <div class="exam__foot">
        <span class="mono" style="font-size:10.5px;letter-spacing:0.08em;color:var(--muted-dim)" data-progress-label></span>
        <div class="exam__nav">
          <button class="btn btn--sm" data-prev>${icon("ArrowLeft", { size: 14 })}<span class="btn__label">Previous</span></button>
          <button class="btn btn--sm" data-next>${icon("ArrowRight", { size: 14 })}<span class="btn__label">Next</span></button>
          <button class="btn btn--sm btn--primary" data-submit>${icon("CheckCheck", { size: 14 })}<span class="btn__label">Submit</span></button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("is-locked");

    const questionHost = overlay.querySelector("[data-question]");
    const paletteHost = overlay.querySelector("[data-palette]");
    const timerEl = overlay.querySelector("[data-timer]");
    const timerText = overlay.querySelector("[data-timer-text]");
    const saveState = overlay.querySelector("[data-save-state]");
    const progressLabel = overlay.querySelector("[data-progress-label]");

    let data = null;
    let questions = [];
    let attempt = null;
    let index = 0;
    let remaining = 0;
    let ticker = null;
    let submitted = false;
    const answers = new Map(); // questionId → { selected, marked }
    closeActiveExam = closeExam;

    /* ------------------------------------------------------------ setup */
    try {
      data = await api.mockStart(test.id);
    } catch (error) {
      showToast({ type: "error", title: "Could not start the test", message: error.message });
      closeExam();
      return;
    }

    if (data.expired) {
      // the countdown finished while the tab was closed — the server graded it
      submitted = true;
      showResult(data.attempt);
      return;
    }

    questions = data.questions ?? [];
    attempt = data.attempt;
    remaining = data.remaining_seconds;
    (data.answers ?? []).forEach((row) => {
      answers.set(row.question_id, {
        selected: row.selected_option,
        marked: Boolean(row.is_marked_for_review),
      });
    });

    if (resume && (data.answers ?? []).length) {
      showToast({ type: "info", title: "Attempt resumed", message: "Your saved answers were restored." });
    }

    /* ------------------------------------------------------------- timer */
    function paintTimer() {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      timerText.textContent = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      timerEl.classList.toggle("is-warning", remaining <= 120 && remaining > 30);
      timerEl.classList.toggle("is-critical", remaining <= 30);
    }

    function startTimer() {
      paintTimer();
      ticker = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          remaining = 0;
          paintTimer();
          clearInterval(ticker);
          ticker = null;
          showToast({ type: "info", title: "Time is up", message: "Submitting your answers…" });
          submitAttempt({ auto: true });
          return;
        }
        paintTimer();
      }, 1000);
    }

    /* ----------------------------------------------------------- saving */
    let saveTimer = null;
    function markSaving() {
      saveState.dataset.state = "saving";
      saveState.innerHTML = `${icon("Loader2", { size: 12, class: "spin" })}<span>saving</span>`;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (saveState.dataset.state === "saving") {
          saveState.dataset.state = "failed";
          saveState.innerHTML = `${icon("AlertTriangle", { size: 12 })}<span>not saved</span>`;
        }
      }, 8000);
    }

    function markSaved() {
      clearTimeout(saveTimer);
      saveState.dataset.state = "saved";
      saveState.innerHTML = `${icon("Cloud", { size: 12 })}<span>saved</span>`;
    }

    async function persist(questionId) {
      const entry = answers.get(questionId);
      markSaving();
      try {
        await api.mockAnswer({
          attemptId: attempt.id,
          questionId,
          selectedOption: entry?.selected ?? null,
          marked: entry?.marked ?? false,
        });
        markSaved();
      } catch (error) {
        saveState.dataset.state = "failed";
        saveState.innerHTML = `${icon("AlertTriangle", { size: 12 })}<span>not saved</span>`;
        showToast({ type: "error", title: "Answer not saved", message: error.message });
      }
    }

    /* ---------------------------------------------------------- rendering */
    function answeredCount() {
      let count = 0;
      answers.forEach((entry) => {
        if (entry.selected) count += 1;
      });
      return count;
    }

    function renderQuestion(direction = 0) {
      const question = questions[index];
      const entry = answers.get(question.id) ?? { selected: null, marked: false };

      questionHost.innerHTML = `
        <div class="q-head">
          <span class="q-index">Question <strong>${index + 1}</strong> / ${questions.length}</span>
          <button class="hw-check" data-mark data-done="${entry.marked}" aria-pressed="${entry.marked}">
            ${icon("Flag", { size: 12 })}
            <span>${entry.marked ? "Marked" : "Mark for review"}</span>
          </button>
        </div>
        <h2 class="q-text">${esc(question.question_text)}</h2>
        <div class="q-options" role="group" aria-label="Answer options">
          ${OPTION_KEYS.map(
            (key) => `
            <button class="q-option" data-option="${key}" aria-pressed="${entry.selected === key}">
              <span class="q-option__key">${key}</span>
              <span>${esc(question.options[key])}</span>
            </button>`,
          ).join("")}
        </div>
      `;

      questionHost.querySelectorAll("[data-option]").forEach((button) => {
        button.addEventListener("click", () => selectOption(button.dataset.option));
      });
      questionHost.querySelector("[data-mark]").addEventListener("click", toggleMark);

      if (!prefersReduced()) {
        gsap.fromTo(
          questionHost.children,
          { opacity: 0, x: direction === 0 ? 0 : direction * 26, y: 10 },
          { opacity: 1, x: 0, y: 0, duration: 0.5, stagger: 0.05, ease: "expo.out" },
        );
      }

      renderPalette();
      paintProgress();
      paintNavButtons();
    }

    function renderPalette() {
      paletteHost.innerHTML = `
        <div class="palette__head">
          <span>Question map</span>
          <span>${answeredCount()}/${questions.length}</span>
        </div>
        <div class="palette__grid">
          ${questions
            .map((question, position) => {
              const entry = answers.get(question.id);
              const state = entry?.selected ? "answered" : entry?.marked ? "marked" : "empty";
              return `<button class="palette__btn" data-jump="${position}"
                        data-state="${state}" aria-current="${position === index}"
                        aria-label="Question ${position + 1}${entry?.selected ? ", answered" : ""}${entry?.marked ? ", marked" : ""}">${position + 1}</button>`;
            })
            .join("")}
        </div>
        <div class="palette__legend">
          <div><i class="legend-answered"></i>Answered</div>
          <div><i class="legend-marked"></i>Marked for review</div>
          <div><i class="legend-empty"></i>Not answered</div>
        </div>
      `;

      paletteHost.querySelectorAll("[data-jump]").forEach((button) => {
        button.addEventListener("click", () => {
          const next = Number(button.dataset.jump);
          const direction = next > index ? 1 : -1;
          index = next;
          renderQuestion(direction);
        });
      });
    }

    function paintProgress() {
      const answered = answeredCount();
      const marked = Array.from(answers.values()).filter((entry) => entry.marked && !entry.selected).length;
      progressLabel.textContent = `${answered} answered · ${questions.length - answered} left${marked ? ` · ${marked} marked` : ""}`;
    }

    function paintNavButtons() {
      overlay.querySelector("[data-prev]").disabled = index === 0;
      const nextBtn = overlay.querySelector("[data-next]");
      nextBtn.disabled = index === questions.length - 1;
      nextBtn.querySelector(".btn__label").textContent =
        index === questions.length - 1 ? "Last" : "Next";
    }

    /* ---------------------------------------------------------- actions */
    function selectOption(key) {
      const question = questions[index];
      const entry = answers.get(question.id) ?? { selected: null, marked: false };
      entry.selected = entry.selected === key ? null : key;
      answers.set(question.id, entry);

      questionHost.querySelectorAll("[data-option]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.option === entry.selected));
      });

      const selectedButton = questionHost.querySelector(`[data-option="${key}"]`);
      if (selectedButton && !prefersReduced()) {
        gsap.fromTo(selectedButton, { scale: 0.985 }, { scale: 1, duration: 0.35, ease: "elastic.out(1, 0.5)" });
      }

      renderPalette();
      paintProgress();
      persist(question.id);

      // Deliberately no auto-advance: students can re-read the question and
      // change their mind before moving on.
    }

    function toggleMark() {
      const question = questions[index];
      const entry = answers.get(question.id) ?? { selected: null, marked: false };
      entry.marked = !entry.marked;
      answers.set(question.id, entry);
      persist(question.id);
      renderQuestion(0);
    }

    function go(direction) {
      const next = index + direction;
      if (next < 0 || next >= questions.length) return;
      index = next;
      renderQuestion(direction);
    }

    /* ----------------------------------------------------------- submit */
    async function submitAttempt({ auto = false } = {}) {
      if (submitted) return;
      if (!auto) {
        const answered = answeredCount();
        const unanswered = questions.length - answered;
        const marked = Array.from(answers.values()).filter((entry) => entry.marked).length;
        const confirmed = await confirmDialog({
          title: "Submit this attempt?",
          message: `${answered} answered · ${unanswered} unanswered${marked ? ` · ${marked} marked for review` : ""}. Once submitted you cannot change your answers.`,
          confirmLabel: "Submit & grade",
        });
        if (!confirmed) return;
      }

      submitted = true;
      if (ticker) clearInterval(ticker);
      ticker = null;

      const submitBtn = overlay.querySelector("[data-submit]");
      submitBtn.setAttribute("aria-busy", "true");
      submitBtn.disabled = true;

      try {
        const result = await api.mockSubmit(attempt.id);
        showResult(result.attempt);
        await load();
        renderSubjects();
        renderTests();
        renderHistory();
      } catch (error) {
        submitted = false;
        submitBtn.removeAttribute("aria-busy");
        submitBtn.disabled = false;
        showToast({ type: "error", title: "Could not submit", message: error.message });
      }
    }

    /* ----------------------------------------------------------- result */
    async function showResult(attemptResult) {
      if (ticker) clearInterval(ticker);
      ticker = null;

      const total = attemptResult.total_questions || questions.length;
      const correct = attemptResult.correct_count ?? 0;
      const incorrect = attemptResult.incorrect_count ?? 0;
      const unanswered = attemptResult.unanswered_count ?? 0;
      const percent = attemptResult.percentage ?? Math.round((correct / total) * 100);
      const headline =
        percent >= 85 ? "Outstanding" : percent >= 70 ? "Strong work" : percent >= 50 ? "Getting there" : "Keep building";

      overlay.querySelector(".exam__head").innerHTML = `
        <button class="icon-btn" data-exit aria-label="Close results">${icon("X", { size: 18 })}</button>
        <div class="exam__title">
          <strong>${headline}</strong>
          <span>${esc(test.title)} · submitted</span>
        </div>
        <div class="topbar__spacer"></div>
        <span class="badge badge--done">${icon("CheckCheck", { size: 11 })} graded on server</span>
      `;
      overlay.querySelector("[data-exit]").addEventListener("click", closeExam);

      overlay.querySelector(".exam__body").style.display = "block";
      overlay.querySelector(".exam__body").style.gridTemplateColumns = "1fr";
      overlay.querySelector(".exam__foot").innerHTML = `
        <span class="mono" style="font-size:10.5px;letter-spacing:0.06em;color:var(--muted-dim)">
          ${esc(fmtDate(attemptResult.completed_at))} · ${attemptResult.duration_seconds ? fmtMinutes(attemptResult.duration_seconds / 60) : "—"}
        </span>
        <div class="exam__nav">
          <button class="btn btn--sm" data-review>${icon("BookOpen", { size: 14 })}<span class="btn__label">Review answers</span></button>
          <button class="btn btn--sm btn--primary" data-done>${icon("Check", { size: 14 })}<span class="btn__label">Back to tests</span></button>
        </div>
      `;

      const body = overlay.querySelector(".exam__body");
      body.innerHTML = `
        <div class="result">
          <div class="result__score">
            ${ringMarkup({ value: percent, label: "score", id: "result-ring", size: 186 })}
            <div style="text-align:center">
              <div style="font-family:var(--font-display);font-size:15px;color:#fff">${headline}</div>
              <div class="mono" style="font-size:9.5px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted-dim);margin-top:0.2rem">
                ${correct} of ${total} correct
              </div>
            </div>
            <div class="result__breakdown">
              <div class="breakdown-pill breakdown-pill--correct"><strong>${correct}</strong><span>Correct</span></div>
              <div class="breakdown-pill breakdown-pill--wrong"><strong>${incorrect}</strong><span>Incorrect</span></div>
              <div class="breakdown-pill"><strong>${unanswered}</strong><span>Unanswered</span></div>
            </div>
          </div>
          <div>
            <div class="section-title">${icon("BookOpen", { size: 13 })}Solutions <span class="section-title__line"></span></div>
            <div class="review-list" data-review-list>
              <div class="skeleton" style="height:120px;border-radius:16px"></div>
              <div class="skeleton" style="height:120px;border-radius:16px"></div>
            </div>
          </div>
        </div>
      `;

      const ringHost = body.querySelector('[data-ring="result-ring"]')?.closest(".ring");
      if (ringHost) animateRing(ringHost, percent, { duration: 1.6, delay: 0.3 });

      if (!prefersReduced()) {
        gsap.fromTo(
          body.querySelectorAll(".result__score, .review-list"),
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.7, stagger: 0.1, ease: "expo.out" },
        );
      }

      overlay.querySelector("[data-done]").addEventListener("click", closeExam);
      overlay.querySelector("[data-review]").addEventListener("click", () => {
        body.scrollTo({ top: body.scrollHeight, behavior: prefersReduced() ? "auto" : "smooth" });
      });

      try {
        const review = await api.mockReview(attemptResult.id);
        const list = body.querySelector("[data-review-list]");
        list.innerHTML = review.questions
          .map((question, position) => {
            const picked = question.selected_option;
            return `
            <article class="review-item">
              <div class="rev-number mono" style="font-size:9.5px;letter-spacing:0.14em;color:var(--muted-dim);margin-bottom:0.35rem">
                Q${position + 1} · ${question.is_correct ? "correct" : picked ? "incorrect" : "unanswered"}
              </div>
              <p class="review-item__q">${esc(question.question_text)}</p>
              <div class="review-item__options">
                ${OPTION_KEYS.map(
                  (key) => `
                  <div class="review-opt" data-correct="${key === question.correct_option}"
                       data-picked="${key === picked}">
                    <span class="review-opt__key">${key}</span>
                    <span>${esc(question.options[key])}</span>
                    ${key === question.correct_option ? icon("Check", { size: 12 }) : ""}
                    ${key === picked && key !== question.correct_option ? icon("X", { size: 12 }) : ""}
                  </div>`,
                ).join("")}
              </div>
              ${
                question.explanation
                  ? `<div class="review-item__explain">${icon("Lightbulb", { size: 13 })}<span>${esc(question.explanation)}</span></div>`
                  : ""
              }
            </article>`;
          })
          .join("");
      } catch (error) {
        const list = body.querySelector("[data-review-list]");
        if (list) list.innerHTML = `<p class="muted" style="font-size:12.5px">Solutions unavailable: ${esc(error.message)}</p>`;
      }
    }

    /* ------------------------------------------------------------- exit */
    function closeExam() {
      if (ticker) clearInterval(ticker);
      ticker = null;
      clearTimeout(saveTimer);
      document.removeEventListener("keydown", onKeydown);
      document.body.classList.remove("is-locked");
      if (overlay.isConnected) overlay.remove();
      examOpen = false;
      closeActiveExam = null;
    }

    overlay.querySelector("[data-exit]").addEventListener("click", async () => {
      if (submitted) {
        closeExam();
        return;
      }
      const confirmed = await confirmDialog({
        title: "Leave the exam?",
        message: "Your answers are saved. You can resume this attempt from the Mock Tests page — the timer keeps running.",
        confirmLabel: "Leave exam",
        danger: true,
      });
      if (confirmed) closeExam();
    });

    overlay.querySelector("[data-prev]").addEventListener("click", () => go(-1));
    overlay.querySelector("[data-next]").addEventListener("click", () => go(1));
    overlay.querySelector("[data-submit]").addEventListener("click", () => submitAttempt());

    function onKeydown(event) {
      if (examOpen === false) return;
      const tag = event.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        selectOption(OPTION_KEYS[Number(event.key) - 1]);
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMark();
      }
    }
    document.addEventListener("keydown", onKeydown);

    /* ------------------------------------------------------------- init */
    index = 0;
    renderQuestion(0);
    startTimer();

    if (!prefersReduced()) {
      gsap.fromTo(
        overlay.querySelectorAll(".exam__head, .exam__foot, .exam__palette"),
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "expo.out" },
      );
    }
  }

  /* ------------------------------------------------------------- wiring */
  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));

  try {
    await load();
  } catch (error) {
    subjectHost.innerHTML = emptyState({
      iconName: "AlertTriangle",
      title: "Could not load tests",
      text: error.message,
    });
    return () => {};
  }

  renderSubjects();
  renderTests();
  renderHistory();
  scrollReveal(root.querySelectorAll(".panel"), { y: 18 });

  if (!prefersReduced()) {
    gsap.fromTo(
      subjectHost.children,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: "expo.out" },
    );
  }

  return () => {
    closeActiveExam?.();
    killScrollTriggers();
  };
}
