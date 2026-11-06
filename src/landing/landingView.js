/**
 * Public landing page.
 *
 * This is the first thing a visitor sees — before authentication. It explains
 * the platform, who it is for and what is inside, then hands over to the
 * existing auth flow (or straight to the workspace if a session already exists).
 */
import { icon } from "../lib/icons.js";
import { esc } from "../lib/dom.js";
import { brandBlock, orbitArt } from "../ui/brand.js";
import {
  gsap,
  prefersReduced,
  magnetic,
  revealChars,
  scrollReveal,
  killScrollTriggers,
} from "../lib/motion.js";

const FEATURES = [
  {
    icon: "Target",
    tone: "blue",
    title: "Subject-wise Mock Tests",
    text: "Five subjects — Mathematics, Science, English, Social Science and Computer Science. Each paper is timed, and every answer is graded on the server.",
    meta: "5 subjects · timed · auto-graded",
  },
  {
    icon: "ListChecks",
    tone: "violet",
    title: "Interactive Quizzes",
    text: "A real question palette, mark-for-review, and answers that save the moment you pick them. Submit to see your score and a worked solution for every question.",
    meta: "auto-save · instant review",
  },
  {
    icon: "NotebookPen",
    tone: "mint",
    title: "Study Materials",
    text: "Homework tracking and a weekly study planner sit beside your books, so assignments, revision sessions and deadlines finally live in one place.",
    meta: "homework · planner",
  },
  {
    icon: "Library",
    tone: "amber",
    title: "Class-wise NCERT Books",
    text: "The NCERT library organised class by class, from 1 to 12, with official open and download links for every listed textbook.",
    meta: "Class 1–12 · official links",
  },
];

const STEPS = [
  {
    title: "Create your account",
    text: "A username, email, phone number and password. The username is all you need to sign back in.",
  },
  {
    title: "Add your schoolwork",
    text: "Log assignments with subjects, priorities and deadlines, then block out study sessions for the week.",
  },
  {
    title: "Practise and see the truth",
    text: "Take a mock test and get a performance picture built only from your own submissions.",
  },
];

const SLIDES = [
  {
    src: "/images/learning-focus.jpg",
    alt: "A student writing in a notebook beside an open textbook and a laptop, lit by cool blue screen light.",
    tag: "01 — Focused practice",
    title: "One subject, one hour, one clear next step.",
    text: "Homework, deadlines and revision sit in the same place, so the evening starts with work instead of decisions.",
    width: 1376,
    height: 768,
    position: "50% 45%",
  },
  {
    src: "/images/learning-digital.jpg",
    alt: "A hand using a stylus on a tablet showing a geometry diagram and charts, next to stacked textbooks.",
    tag: "02 — Practice on screen",
    title: "Draw it, solve it, then check the working.",
    text: "Five subjects of timed mock tests with solutions that unlock only after you submit.",
    width: 1376,
    height: 768,
    position: "50% 50%",
  },
  {
    src: "/images/learning-together.jpg",
    alt: "Three school students discussing a laptop together in a school library at night.",
    tag: "03 — Built around school",
    title: "Textbooks by class, plans by week.",
    text: "A class-wise NCERT library and a study planner that follow the syllabus you actually have.",
    width: 1584,
    height: 672,
    position: "50% 42%",
  },
];

/**
 * Carousel controller: autoplay, arrows, dots, swipe, keyboard.
 * Auto-advance pauses on hover/focus, when the tab is hidden and when the
 * carousel is scrolled out of view; it never runs for reduced-motion visitors.
 */
function setupCarousel(carousel) {
  if (!carousel) return () => {};
  const slides = Array.from(carousel.querySelectorAll("[data-slide]"));
  const dots = Array.from(carousel.querySelectorAll("[data-dot]"));
  const viewport = carousel.querySelector("[data-viewport]");
  const count = carousel.querySelector("[data-count]");
  const total = slides.length;
  if (!total) return () => {};

  const AUTOPLAY_MS = 6200;
  const pad = (value) => String(value).padStart(2, "0");
  let index = 0;
  let timer = null;
  let paused = false;
  let onScreen = true;

  function paint() {
    slides.forEach((slide, position) => {
      const active = position === index;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, position) => dot.setAttribute("aria-current", String(position === index)));
    if (count) count.textContent = `${pad(index + 1)} / ${pad(total)}`;
  }

  function stopTimer() {
    if (timer) window.clearInterval(timer);
    timer = null;
  }

  function startTimer() {
    stopTimer();
    if (prefersReduced()) return;
    timer = window.setInterval(() => {
      if (paused || !onScreen || document.hidden) return;
      index = (index + 1) % total;
      paint();
    }, AUTOPLAY_MS);
  }

  function show(next) {
    index = ((next % total) + total) % total;
    paint();
    startTimer();
  }

  carousel.querySelector("[data-prev]")?.addEventListener("click", () => show(index - 1));
  carousel.querySelector("[data-next]")?.addEventListener("click", () => show(index + 1));

  const onDot = (event) => show(Number(event.currentTarget.dataset.dot));
  dots.forEach((dot) => dot.addEventListener("click", onDot));

  const pauseForMouse = (event) => {
    if (event.pointerType === "mouse") paused = true;
  };
  const resumeForMouse = (event) => {
    if (event.pointerType === "mouse") paused = false;
  };
  carousel.addEventListener("pointerenter", pauseForMouse);
  carousel.addEventListener("pointerleave", resumeForMouse);
  carousel.addEventListener("focusin", () => {
    paused = true;
  });
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) paused = false;
  });

  viewport?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(index - 1);
    }
  });

  let startX = null;
  viewport?.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    startX = event.clientX;
  });
  const endSwipe = (event) => {
    if (startX === null) return;
    const delta = event.clientX - startX;
    startX = null;
    if (Math.abs(delta) < 42) return;
    show(index + (delta < 0 ? 1 : -1));
  };
  viewport?.addEventListener("pointerup", endSwipe);
  viewport?.addEventListener("pointercancel", () => {
    startX = null;
  });

  const onVisibility = () => {
    if (!document.hidden) paused = false;
  };
  document.addEventListener("visibilitychange", onVisibility);

  let observer = null;
  if (typeof IntersectionObserver === "function" && viewport) {
    observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
      },
      { threshold: 0.15 },
    );
    observer.observe(viewport);
  }

  paint();
  startTimer();

  return () => {
    stopTimer();
    observer?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export function renderLanding(root, { signedIn = false, onGetStarted, onSignIn, onCreateAccount } = {}) {
  const tweens = [];

  root.innerHTML = `
    <div class="landing" data-landing>
      <header class="landing-nav" data-nav>
        <div class="landing-shell landing-nav__inner">
          <a class="landing-brand" href="#top" aria-label="ACADEMIA home">
            ${brandBlock({ tagline: "Student Workspace", size: 38 })}
          </a>
          <nav class="landing-nav__links" aria-label="Landing sections">
            <a href="#why">Why</a>
            <a href="#features">Features</a>
            <a href="#start">Get started</a>
          </nav>
          <div class="landing-nav__actions">
            ${
              signedIn
                ? `<span class="landing-chip">${icon("CheckCircle2", { size: 12 })}signed in</span>`
                : ""
            }
            <button class="btn btn--ghost btn--sm" data-nav-signin>Sign in</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section class="hero landing-shell" aria-labelledby="hero-title">
          <div class="hero__copy">
            <span class="eyebrow">For school students · Class 1–12</span>
            <h1 class="hero__title" id="hero-title">
              <span class="hero__line"><span data-hero-line>A calmer way to run</span></span>
              <span class="hero__line"><span class="gradient-text" data-hero-line>your school year.</span></span>
            </h1>
            <p class="hero__lede" data-hero-fade>
              ACADEMIA is a study workspace for school students. Homework, your study plan,
              NCERT textbooks and five-subject mock tests live in one place — so your evenings
              go into studying, not into finding out what to study.
            </p>
            <div class="hero__actions" data-hero-fade>
              <button class="btn btn--primary btn--lg" data-get-started data-magnetic>
                <span class="btn__spinner"></span>
                <span class="btn__label">Get Started</span>
                ${icon("ArrowRight", { size: 17 })}
              </button>
              <a class="btn btn--ghost btn--lg" href="#features" data-scroll>
                ${icon("Play", { size: 15 })}<span class="btn__label">See what's inside</span>
              </a>
            </div>
            <p class="hero__note" data-hero-fade>
              ${signedIn ? icon("CheckCircle2", { size: 13 }) : icon("ShieldCheck", { size: 13 })}
              <span>
                ${
                  signedIn
                    ? "You're already signed in — Get Started opens your workspace directly."
                    : "Free for students · no download · works on phone, tablet and laptop"
                }
              </span>
            </p>
          </div>

          <div class="hero-art" data-hero-art aria-hidden="true">
            <div class="hero-art__halo"></div>
            ${orbitArt()}

            <div class="float-chip float-chip--a">
              <span class="float-chip__icon">${icon("Target", { size: 14 })}</span>
              <span><strong>5 subjects</strong><em>mock tests</em></span>
            </div>
            <div class="float-chip float-chip--b">
              <span class="float-chip__icon">${icon("Library", { size: 14 })}</span>
              <span><strong>Class 1–12</strong><em>NCERT library</em></span>
            </div>
            <div class="float-chip float-chip--c">
              <span class="float-chip__icon">${icon("ShieldCheck", { size: 14 })}</span>
              <span><strong>Server-graded</strong><em>answers stay hidden</em></span>
            </div>

            <div class="hero-card">
              <div class="hero-card__head">
                <span class="hero-card__dot"></span>
                <span class="hero-card__label">Mathematics · Mock test</span>
                <span class="hero-card__time">${icon("Timer", { size: 12 })}<span>09:41</span></span>
              </div>
              <div class="hero-card__body">
                <span class="hero-card__q">Question 4 of 10</span>
                <span class="hero-card__text">If 2x + 6 = 18, what is x?</span>
                <div class="hero-card__opt"><i>A</i><span>4</span></div>
                <div class="hero-card__opt is-picked"><i>B</i><span>6</span>${icon("Check", { size: 12 })}</div>
                <div class="hero-card__opt"><i>C</i><span>8</span></div>
              </div>
              <div class="hero-card__foot">
                ${Array.from({ length: 10 }, (_, index) => `<span data-state="${index < 3 ? "done" : index === 3 ? "live" : "idle"}"></span>`).join("")}
              </div>
            </div>
          </div>
        </section>

        <section class="landing-section landing-shell showcase" aria-labelledby="showcase-title">
          <div class="showcase__head">
            <div>
              <span class="eyebrow">A look inside</span>
              <h2 class="landing-h2" id="showcase-title" data-reveal>Study sessions, on paper and on screen.</h2>
            </div>
            <p class="landing-p showcase__note" data-reveal>
              Notebooks, tablets and library tables — the settings this workspace was designed around.
            </p>
          </div>

          <div class="carousel" data-carousel>
            <div class="carousel__frame" data-viewport tabindex="0" role="group"
                 aria-roledescription="carousel" aria-label="Photographs of students studying">
              <div class="carousel__track" data-track>
                ${SLIDES.map(
                  (slide, index) => `
                  <figure class="carousel__slide ${index === 0 ? "is-active" : ""}" data-slide
                          aria-roledescription="slide" aria-label="${index + 1} of ${SLIDES.length}"
                          aria-hidden="${index === 0 ? "false" : "true"}">
                    <div class="carousel__media">
                      <img src="${slide.src}" alt="${esc(slide.alt)}"
                           width="${slide.width}" height="${slide.height}"
                           loading="${index === 0 ? "eager" : "lazy"}" decoding="async"
                           style="object-position:${slide.position}" />
                    </div>
                    <figcaption class="carousel__caption">
                      <span class="carousel__tag mono">${esc(slide.tag)}</span>
                      <h3 class="carousel__title">${esc(slide.title)}</h3>
                      <p class="carousel__text">${esc(slide.text)}</p>
                    </figcaption>
                  </figure>`,
                ).join("")}
              </div>
              <span class="carousel__scrim" aria-hidden="true"></span>
              <button class="carousel__arrow carousel__arrow--prev" type="button" data-prev aria-label="Previous image">
                ${icon("ArrowLeft", { size: 18 })}
              </button>
              <button class="carousel__arrow carousel__arrow--next" type="button" data-next aria-label="Next image">
                ${icon("ArrowRight", { size: 18 })}
              </button>
            </div>

            <div class="carousel__controls">
              <span class="carousel__note mono">Illustrative imagery</span>
              <div class="carousel__dots" data-dots role="tablist" aria-label="Choose an image">
                ${SLIDES.map(
                  (slide, index) => `
                  <button class="carousel__dot" type="button" data-dot="${index}" role="tab"
                          aria-label="Image ${index + 1}: ${esc(slide.tag)}"
                          aria-current="${index === 0}"></button>`,
                ).join("")}
              </div>
              <span class="carousel__count mono" data-count aria-hidden="true">01 / ${String(SLIDES.length).padStart(2, "0")}</span>
            </div>
          </div>
        </section>

        <section class="landing-section landing-shell" id="why" aria-labelledby="why-title">
          <div class="why">
            <div class="why__lead">
              <span class="eyebrow">Why we built it</span>
              <h2 class="landing-h2" id="why-title" data-reveal>Schoolwork is hard enough to keep track of.</h2>
              <p class="landing-p" data-reveal>
                Most students run their week across a paper diary, three group chats, a folder of
                PDFs and a camera roll full of homework photos. Nothing talks to anything else.
              </p>
              <p class="landing-p" data-reveal>
                ACADEMIA grew out of a school coding project with one rule: every number on the
                screen must come from the student's own work. No invented streaks, no inflated
                progress. Just your assignments, your plan and your tests — with an honest picture
                of where you actually stand.
              </p>
            </div>

            <ul class="why__points">
              <li data-reveal>
                <span class="why__num mono">01</span>
                <div><strong>Focus over clutter</strong><p>One calm dashboard instead of six open tabs.</p></div>
              </li>
              <li data-reveal>
                <span class="why__num mono">02</span>
                <div><strong>Practice that feels like the exam</strong><p>A real countdown, a question palette, and marking for review.</p></div>
              </li>
              <li data-reveal>
                <span class="why__num mono">03</span>
                <div><strong>A record you can trust</strong><p>Analytics are calculated from what you submit — nothing else.</p></div>
              </li>
              <li data-reveal>
                <span class="why__num mono">04</span>
                <div><strong>Protected by design</strong><p>Answer keys never leave the server until you submit.</p></div>
              </li>
            </ul>
          </div>
        </section>

        <section class="landing-section landing-shell" aria-labelledby="audience-title">
          <div class="audience" data-reveal>
            <div class="audience__icon">${icon("GraduationCap", { size: 26 })}</div>
            <div class="audience__body">
              <span class="eyebrow">Who it's for</span>
              <h2 class="landing-h2" id="audience-title">Built for school students, from Class 1 to Class 12.</h2>
              <p class="landing-p">
                Whether you're keeping up with daily homework, working through NCERT chapters, or
                revising for board exams, the workspace meets you where your syllabus already is.
              </p>
              <div class="audience__chips">
                <span class="badge">${icon("GraduationCap", { size: 11 })}Classes 1–12</span>
                <span class="badge">${icon("BookOpen", { size: 11 })}NCERT-aligned books</span>
                <span class="badge">${icon("Target", { size: 11 })}Five exam subjects</span>
                <span class="badge">${icon("Smartphone", { size: 11 })}Phone · tablet · laptop</span>
              </div>
            </div>
          </div>
        </section>

        <section class="landing-section landing-shell" id="features" aria-labelledby="features-title">
          <div class="landing-head">
            <div>
              <span class="eyebrow">What's inside</span>
              <h2 class="landing-h2" id="features-title" data-reveal>Everything you need for a week of school.</h2>
            </div>
            <p class="landing-p landing-head__note" data-reveal>
              Four tools, one workspace — open them from the sidebar the moment you sign in.
            </p>
          </div>

          <div class="feature-grid">
            ${FEATURES.map(
              (feature, index) => `
              <article class="feature-card" data-tone="${feature.tone}" data-reveal>
                <div class="feature-card__top">
                  <span class="feature-card__icon">${icon(feature.icon, { size: 20 })}</span>
                  <span class="feature-card__index mono">${String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3 class="feature-card__title">${esc(feature.title)}</h3>
                <p class="feature-card__text">${esc(feature.text)}</p>
                <span class="feature-card__meta">${esc(feature.meta)}</span>
              </article>`,
            ).join("")}
          </div>
        </section>

        <section class="landing-section landing-shell" aria-labelledby="steps-title">
          <div class="landing-head">
            <div>
              <span class="eyebrow">How it starts</span>
              <h2 class="landing-h2" id="steps-title" data-reveal>Three steps, then you're studying.</h2>
            </div>
          </div>
          <ol class="steps">
            ${STEPS.map(
              (step, index) => `
              <li class="step" data-reveal>
                <span class="step__num">${index + 1}</span>
                <h3 class="step__title">${esc(step.title)}</h3>
                <p class="step__text">${esc(step.text)}</p>
              </li>`,
            ).join("")}
          </ol>
        </section>

        <section class="landing-section landing-shell" id="start">
          <div class="start-band" data-reveal>
            <div class="start-band__glow" aria-hidden="true"></div>
            <span class="eyebrow">Start tonight</span>
            <h2 class="start-band__title">Your next homework is already waiting.</h2>
            <p class="start-band__text">
              Create a workspace in under a minute, add one assignment, and see the week arrange
              itself. No installation, no card, nothing to uninstall later.
            </p>
            <div class="start-band__actions">
              <button class="btn btn--primary btn--lg" data-get-started data-magnetic>
                <span class="btn__spinner"></span>
                <span class="btn__label">Get Started</span>
                ${icon("ArrowRight", { size: 17 })}
              </button>
              <button class="btn btn--ghost btn--lg" data-create-account>Create an account</button>
            </div>
            <p class="start-band__foot">
              Already registered? <button class="link-btn" data-nav-signin>Sign in with your username</button>
            </p>
          </div>
        </section>
      </main>

      <footer class="landing-footer">
        <div class="landing-shell landing-footer__inner">
          <div class="landing-footer__brand">
            ${brandBlock({ tagline: "Student Workspace", size: 30 })}
          </div>
          <p class="landing-footer__note">
            Built with vanilla JavaScript, Supabase and GSAP · statistics are computed from each
            student's own records.
          </p>
          <div class="landing-footer__links">
            <a href="https://ncert.nic.in/textbook.php" target="_blank" rel="noopener noreferrer">
              NCERT textbooks ${icon("ExternalLink", { size: 12 })}
            </a>
            <button class="link-btn" data-nav-signin>Sign in</button>
          </div>
        </div>
      </footer>
    </div>
  `;

  const page = root.querySelector("[data-landing]");
  const heroLines = page.querySelectorAll("[data-hero-line]");

  /* ------------------------------------------------------------ actions */
  let leaving = false;

  async function leave(action) {
    if (leaving || typeof action !== "function") return;
    leaving = true;
    page.querySelectorAll("[data-get-started]").forEach((button) => button.setAttribute("aria-busy", "true"));
    try {
      if (!prefersReduced()) {
        await new Promise((resolve) => {
          gsap.to(page, { opacity: 0, y: -16, duration: 0.4, ease: "power2.inOut", onComplete: resolve });
        });
      }
      await action();
      // If the handler did not replace the page (e.g. it bailed out), bring the
      // landing back instead of leaving an invisible screen behind.
      if (page.isConnected) gsap.set(page, { opacity: 1, y: 0 });
    } catch (error) {
      console.error("[academia] landing navigation failed", error);
      leaving = false;
      gsap.set(page, { opacity: 1, y: 0 });
      page.querySelectorAll("[data-get-started]").forEach((button) => {
        button.removeAttribute("aria-busy");
      });
    }
  }

  page.querySelectorAll("[data-get-started]").forEach((button) => {
    button.addEventListener("click", () => leave(onGetStarted));
  });
  page.querySelectorAll("[data-create-account]").forEach((button) => {
    button.addEventListener("click", () => leave(onCreateAccount));
  });
  page.querySelectorAll("[data-nav-signin]").forEach((button) => {
    button.addEventListener("click", () => leave(onSignIn));
  });

  // In-page anchors scroll smoothly without hijacking the hash router.
  page.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const target = page.querySelector(anchor.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
    });
  });

  /* ----------------------------------------------------------- animation */
  if (!prefersReduced()) {
    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo("[data-nav]", { y: -18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0);
    tl.fromTo(".hero__copy > .eyebrow", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6 }, 0.1);

    heroLines.forEach((line, index) => {
      revealChars(line, { delay: 0.18 + index * 0.1, stagger: 0.014, duration: 0.95 });
    });

    tl.fromTo(
      page.querySelectorAll("[data-hero-fade]"),
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.1 },
      0.55,
    );
    tl.fromTo(
      ".hero-art",
      { opacity: 0, y: 30, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 1.1 },
      0.35,
    );
    tl.fromTo(
      ".float-chip",
      { opacity: 0, y: 14, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.12, ease: "back.out(1.6)" },
      0.9,
    );

    // Slow drift on the floating chips and the orbit illustration.
    tweens.push(
      gsap.to(".float-chip--a", { y: -10, duration: 3.6, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.6 }),
      gsap.to(".float-chip--b", { y: 8, duration: 4.4, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 1.9 }),
      gsap.to(".float-chip--c", { y: -7, duration: 5.1, repeat: -1, yoyo: true, ease: "sine.inOut", delay: 2.2 }),
      gsap.to(".hero-art .orbit", { rotate: 6, duration: 14, repeat: -1, yoyo: true, ease: "sine.inOut" }),
    );
  } else {
    gsap.set(page.querySelectorAll("[data-nav], [data-hero-fade], .hero-art, .float-chip"), {
      opacity: 1,
      y: 0,
    });
  }

  // Scroll-triggered reveals for the editorial sections.
  scrollReveal(page.querySelectorAll("[data-reveal]"), { y: 24, stagger: 0.08 });

  page.querySelectorAll("[data-magnetic]").forEach((element) => magnetic(element));

  const stopCarousel = setupCarousel(page.querySelector("[data-carousel]"));

  return () => {
    stopCarousel();
    tweens.forEach((tween) => tween.kill());
    killScrollTriggers();
    gsap.killTweensOf(page);
  };
}
