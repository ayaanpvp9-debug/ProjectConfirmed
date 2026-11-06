/**
 * NCERT Library — class-wise official textbook access.
 * Every URL is an official ncert.nic.in link managed in the `ncert_books` table.
 */
import { supabase, unwrap } from "../lib/supabase.js";
import { icon } from "../lib/icons.js";
import { esc, debounce, subjectTone } from "../lib/dom.js";
import { gsap, prefersReduced, magnetic, scrollReveal, killScrollTriggers } from "../lib/motion.js";
import { pageHead, emptyState } from "./_shared.js";

export async function render(root, ctx) {
  let classes = [];
  let books = [];
  let selected = ctx.profile.class_level ?? 10;
  let query = "";
  let subjectFilter = "all";

  root.innerHTML = `
    ${pageHead({
      eyebrow: "Library",
      title: "NCERT Books",
      subtitle: "Every class, every official textbook — opened straight from ncert.nic.in.",
      actions: `<span class="badge">${icon("ShieldCheck", { size: 11 })} official source</span>`,
    })}
    <div class="class-rail" data-class-rail aria-label="Select a class"></div>
    <div class="panel" style="margin-top:1rem">
      <div class="panel__body">
        <div class="library-head">
          <div>
            <h3 class="library-head__class" data-class-title>Class 10</h3>
            <p class="library-head__tag" data-class-tag>Loading the library…</p>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
            <label class="search-shell" style="min-width:200px">
              ${icon("Search", { size: 14 })}
              <input type="search" placeholder="Search textbooks…" data-search aria-label="Search textbooks" />
            </label>
            <a class="btn btn--sm" href="https://ncert.nic.in/textbook.php" target="_blank" rel="noopener noreferrer">
              ${icon("ExternalLink", { size: 14 })}<span class="btn__label">ncert.nic.in</span>
            </a>
          </div>
        </div>
        <div class="toolbar" data-subject-bar></div>
        <div class="book-grid" data-books></div>
        <p class="verify-note">
          ${icon("CheckCheck", { size: 12 })}
          Textbook links point directly to NCERT's official textbook pages · managed in the ncert_books table
        </p>
      </div>
    </div>
  `;

  const rail = root.querySelector("[data-class-rail]");
  const booksHost = root.querySelector("[data-books]");
  const titleEl = root.querySelector("[data-class-title]");
  const tagEl = root.querySelector("[data-class-tag]");
  const subjectBar = root.querySelector("[data-subject-bar]");

  /* ---------------------------------------------------------------- load */
  const [classesRes, booksRes] = await Promise.all([
    supabase.from("ncert_classes").select("id, class_number, display_name, tagline, accent").order("class_number"),
    supabase
      .from("ncert_books")
      .select("id, class_id, title, subject, language, book_code, official_url, download_url, display_order")
      .order("display_order"),
  ]);

  classes = unwrap(classesRes) ?? [];
  books = unwrap(booksRes) ?? [];

  if (!classes.length) {
    booksHost.innerHTML = emptyState({
      iconName: "BookOpen",
      title: "Library unavailable",
      text: "The NCERT catalogue could not be loaded. Run supabase/seed.sql to populate it.",
    });
    return () => {};
  }

  if (!classes.some((c) => c.class_number === selected)) selected = classes[0].class_number;

  /* --------------------------------------------------------------- rail */
  function renderRail() {
    rail.innerHTML = classes
      .map((klass) => {
        const count = books.filter((b) => b.class_id === klass.id).length;
        return `
        <button class="class-tile" data-accent="${esc(klass.accent)}" data-class="${klass.class_number}"
                aria-pressed="${klass.class_number === selected}" aria-label="${esc(klass.display_name)} — ${count} books">
          <span class="class-tile__num">${klass.class_number}</span>
          <span class="class-tile__label">Class</span>
          <span class="class-tile__count">${count} books</span>
        </button>`;
      })
      .join("");

    rail.querySelectorAll("[data-class]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = Number(button.dataset.class);
        if (next === selected) return;
        selected = next;
        subjectFilter = "all";
        renderRail();
        renderLibrary();
      });
    });
  }

  function classBooks() {
    const klass = classes.find((c) => c.class_number === selected);
    return books.filter((b) => b.class_id === klass?.id);
  }

  /* ------------------------------------------------------------ library */
  function renderSubjectBar() {
    const subjects = [...new Set(classBooks().map((b) => b.subject))].sort();
    if (!subjects.length) {
      subjectBar.innerHTML = "";
      return;
    }
    subjectBar.innerHTML = `
      <div class="segmented" role="group" aria-label="Filter by subject">
        <button data-subject="all" aria-pressed="${subjectFilter === "all"}">All<span class="segmented__count">${classBooks().length}</span></button>
        ${subjects
          .map(
            (subject) => `
          <button data-subject="${esc(subject)}" aria-pressed="${subjectFilter === subject}">
            ${esc(subject)}<span class="segmented__count">${classBooks().filter((b) => b.subject === subject).length}</span>
          </button>`,
          )
          .join("")}
      </div>`;

    subjectBar.querySelectorAll("[data-subject]").forEach((button) => {
      button.addEventListener("click", () => {
        subjectFilter = button.dataset.subject;
        renderSubjectBar();
        renderBooks();
      });
    });
  }

  function renderBooks() {
    const klass = classes.find((c) => c.class_number === selected);
    const all = classBooks();
    const q = query.trim().toLowerCase();

    let list = all;
    if (subjectFilter !== "all") list = list.filter((b) => b.subject === subjectFilter);
    if (q) list = list.filter((b) => `${b.title} ${b.subject}`.toLowerCase().includes(q));

    booksHost.innerHTML = list.length
      ? list
          .map(
            (book) => `
        <article class="book-card" data-book="${book.id}">
          <span class="book-card__spine"></span>
          <h4 class="book-card__title">${esc(book.title)}</h4>
          <div class="book-card__meta">
            <span class="subject-chip" data-tone="${subjectTone(book.subject)}">${esc(book.subject)}</span>
            <span class="badge">${esc(book.language)}</span>
          </div>
          <div class="book-card__actions">
            <a class="btn btn--sm" href="${esc(book.official_url)}" target="_blank" rel="noopener noreferrer">
              ${icon("BookOpen", { size: 14 })}<span class="btn__label">Open</span>
            </a>
            ${
              book.download_url
                ? `<a class="btn btn--sm" href="${esc(book.download_url)}" target="_blank" rel="noopener noreferrer"
                      aria-label="Download ${esc(book.title)}">
                    ${icon("Download", { size: 14 })}<span class="btn__label">Download</span>
                  </a>`
                : ""
            }
          </div>
        </article>`,
          )
          .join("")
      : emptyState({
          iconName: "Search",
          title: "No textbooks match",
          text: "Try another subject or clear the search field.",
        });

    booksHost.querySelectorAll(".book-card").forEach((card) => {
      card.addEventListener("pointerenter", () => {
        if (prefersReduced()) return;
        gsap.to(card.querySelector(".book-card__spine"), { scaleY: 1, duration: 0.4, ease: "power3.out" });
      });
    });

    if (!prefersReduced()) {
      gsap.fromTo(
        booksHost.children,
        { opacity: 0, y: 18, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.65, stagger: 0.035, ease: "expo.out" },
      );
    }
  }

  function renderLibrary() {
    renderLibraryHeader();
    renderSubjectBar();
    renderBooks();
  }

  function renderLibraryHeader() {
    const klass = classes.find((c) => c.class_number === selected);
    titleEl.textContent = klass.display_name;
    tagEl.textContent = `${klass.tagline} · ${classBooks().length} official textbooks`;
  }

  /* ------------------------------------------------------------- wiring */
  const search = root.querySelector("[data-search]");
  search.addEventListener(
    "input",
    debounce((event) => {
      query = event.target.value;
      renderBooks();
    }, 200),
  );

  root.querySelectorAll("[data-magnetic]").forEach((el) => magnetic(el));

  renderRail();
  renderLibrary();
  scrollReveal(root.querySelectorAll(".panel"), { y: 16 });

  // animate the rail in
  if (!prefersReduced()) {
    gsap.fromTo(
      rail.children,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.025, ease: "power3.out" },
    );
  }

  return () => {
    killScrollTriggers();
  };
}
