/**
 * Syed Shahabuddin Portfolio — Interactive Motion & Experience Engine
 * Features:
 *  - Session-aware cinematic preloader curtain
 *  - Interactive ambient constellation/node canvas (GPU-friendly, pauses when hidden)
 *  - Dual-layer precision custom cursor with contextual labels & magnetic buttons
 *  - Kinetic character-roll button splitting
 *  - Scroll progress bar, morphing glass nav, scroll-linked timeline rail
 *  - Cursor-tracking spotlight cards & 3D tilt portrait
 *  - Animated metric counters & staggered scroll reveals
 *  - Project & tool category filtering + interactive Case Study slide-over drawer
 *  - Guided 2-step contact concierge wizard + one-click copy email
 *  - Client-side interactive portfolio assistant
 */
(function () {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ------------------------------------------------------------------------
     1. Preloader Curtain (plays smoothly once per session, instant on nav)
     ------------------------------------------------------------------------ */
  function initPreloader() {
    const preloader = document.getElementById("site-preloader");
    if (!preloader) {
      document.body.classList.remove("is-preloading");
      return;
    }

    const alreadySeen = sessionStorage.getItem("ss_intro_seen") === "1";
    const hasHashTarget = Boolean(window.location.hash);
    if (reducedMotion || alreadySeen || hasHashTarget) {
      preloader.classList.add("is-done");
      document.body.classList.remove("is-preloading");
      return;
    }

    const fill = preloader.querySelector(".preloader__bar-fill");
    const counter = preloader.querySelector("[data-preloader-count]");
    const duration = 560;
    const start = performance.now();

    function finish() {
      if (preloader.classList.contains("is-done")) return;
      if (fill) fill.style.width = "100%";
      if (counter) counter.textContent = "100";
      preloader.classList.add("is-done");
      document.body.classList.remove("is-preloading");
      try {
        sessionStorage.setItem("ss_intro_seen", "1");
      } catch {
        // ignore storage restrictions
      }
    }

    function step(now) {
      const ratio = Math.min(1, (now - start) / duration);
      const pct = Math.round(ratio * 100);
      if (fill) fill.style.width = `${pct}%`;
      if (counter) counter.textContent = String(pct).padStart(2, "0");
      if (ratio < 1) {
        window.requestAnimationFrame(step);
      } else {
        window.setTimeout(finish, 90);
      }
    }

    window.requestAnimationFrame(step);
    window.setTimeout(finish, 950);
  }

  /* ------------------------------------------------------------------------
     2. Kinetic Character-Roll Buttons (Script-Aware for Arabic & Devanagari)
     ------------------------------------------------------------------------ */
  function buildRollButton(btn, lang) {
    if (!btn || reducedMotion) return;
    const labelEl = btn.querySelector(".roll-btn__text");
    if (!labelEl) return;

    const raw = (labelEl.getAttribute("aria-label") || labelEl.textContent || "").trim();
    if (!raw) return;

    const activeLang = lang || window.PortfolioI18n?.getLang?.() || document.documentElement.lang || "en";
    const complexScript = activeLang === "ar" || activeLang === "hi" || /[\u0600-\u06FF\u0900-\u097F]/.test(raw);

    labelEl.dataset.rolled = "true";
    labelEl.setAttribute("aria-label", raw);
    labelEl.textContent = "";

    // Keep cursive Arabic & Devanagari ligatures intact by rolling as one cohesive phrase
    if (complexScript) {
      const wrap = document.createElement("span");
      wrap.className = "roll-char";
      wrap.setAttribute("aria-hidden", "true");
      const inner = document.createElement("span");
      inner.className = "roll-char__inner";
      inner.style.setProperty("--char-index", 0);
      const s1 = document.createElement("span");
      const s2 = document.createElement("span");
      s1.textContent = raw;
      s2.textContent = raw;
      inner.append(s1, s2);
      wrap.appendChild(inner);
      labelEl.appendChild(wrap);
      return;
    }

    [...raw].forEach((ch, idx) => {
      const wrap = document.createElement("span");
      wrap.className = "roll-char";
      wrap.setAttribute("aria-hidden", "true");
      const inner = document.createElement("span");
      inner.className = "roll-char__inner";
      inner.style.setProperty("--char-index", idx);

      const s1 = document.createElement("span");
      const s2 = document.createElement("span");
      s1.textContent = ch === " " ? "\u00A0" : ch;
      s2.textContent = ch === " " ? "\u00A0" : ch;
      inner.append(s1, s2);
      wrap.appendChild(inner);
      labelEl.appendChild(wrap);
    });
  }

  window.__rebuildRollButton = buildRollButton;

  function initRollButtons() {
    if (reducedMotion) return;
    document.querySelectorAll(".roll-btn[data-roll]").forEach((btn) => {
      const labelEl = btn.querySelector(".roll-btn__text");
      if (!labelEl || labelEl.dataset.rolled === "true") return;
      buildRollButton(btn);
    });
  }

  /* ------------------------------------------------------------------------
     3. Interactive Ambient Particle / Mesh Canvas
     ------------------------------------------------------------------------ */
  function initAmbientCanvas() {
    if (reducedMotion) return;
    const canvas = document.getElementById("ambient-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    const pointer = { x: width * 0.5, y: height * 0.35, active: false };
    let rafId = null;

    const count = Math.min(54, Math.max(22, Math.floor((width * height) / 28000)));
    const nodes = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.4 + 0.7,
      warm: Math.random() > 0.35,
    }));

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener(
      "pointermove",
      (e) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
      },
      { passive: true }
    );

    function frame() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;

        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;

        if (pointer.active) {
          const dx = n.x - pointer.x;
          const dy = n.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 150 && dist > 1) {
            const push = ((150 - dist) / 150) * 0.32;
            n.x += (dx / dist) * push;
            n.y += (dy / dist) * push;
          }
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = n.warm ? "rgba(196, 73, 0, 0.58)" : "rgba(239, 214, 172, 0.45)";
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < 135) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            const alpha = (1 - d / 135) * 0.13;
            ctx.strokeStyle = `rgba(239, 214, 172, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      rafId = window.requestAnimationFrame(frame);
    }

    document.addEventListener("visibilitychange", () => {
      if (document.hidden && rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!document.hidden && !rafId) {
        rafId = window.requestAnimationFrame(frame);
      }
    });

    rafId = window.requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------------
     4. Precision Custom Cursor & Magnetic Buttons
     ------------------------------------------------------------------------ */
  function initCustomCursor() {
    if (reducedMotion || !isFinePointer || window.innerWidth <= 991) return;

    const ring = document.createElement("div");
    ring.className = "custom-cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    const dot = document.createElement("div");
    dot.className = "custom-cursor-dot";
    dot.setAttribute("aria-hidden", "true");
    document.body.append(ring, dot);

    let mx = -100,
      my = -100,
      rx = -100,
      ry = -100;
    let started = false;

    window.addEventListener(
      "pointermove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        if (!started) {
          rx = mx;
          ry = my;
          started = true;
          document.body.classList.add("has-custom-cursor");
        }
        dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      },
      { passive: true }
    );

    document.addEventListener("pointerleave", () => {
      document.body.classList.remove("has-custom-cursor");
    });

    function tick() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      window.requestAnimationFrame(tick);
    }
    window.requestAnimationFrame(tick);

    // Interactive hover states & contextual labels
    const interactiveSelector = "a, button, input, textarea, select, [data-cursor]";
    document.addEventListener(
      "pointerover",
      (e) => {
        const target = e.target.closest(interactiveSelector);
        if (!target) return;
        const label = target.getAttribute("data-cursor");
        if (label) {
          ring.textContent = label;
          ring.classList.add("is-labeled");
          ring.classList.remove("is-hover");
        } else {
          ring.textContent = "";
          ring.classList.add("is-hover");
          ring.classList.remove("is-labeled");
        }
      },
      { passive: true }
    );

    document.addEventListener(
      "pointerout",
      (e) => {
        if (!e.target.closest(interactiveSelector)) return;
        ring.textContent = "";
        ring.classList.remove("is-hover", "is-labeled");
      },
      { passive: true }
    );

    // Magnetic attraction on buttons
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.22;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.22;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ------------------------------------------------------------------------
     5. Spotlight Hover Glow & 3D Tilt Portrait
     ------------------------------------------------------------------------ */
  function initSpotlightsAndTilt() {
    if (!isFinePointer) return;

    document.querySelectorAll(".spotlight-card, .portrait-card").forEach((card) => {
      card.addEventListener(
        "pointermove",
        (e) => {
          const rect = card.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          card.style.setProperty("--mx", `${x}px`);
          card.style.setProperty("--my", `${y}px`);

          if (card.classList.contains("portrait-card") && !reducedMotion) {
            const rx = ((y / rect.height) - 0.5) * -9;
            const ry = ((x / rect.width) - 0.5) * 9;
            card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
          }
        },
        { passive: true }
      );

      if (card.classList.contains("portrait-card")) {
        card.addEventListener("pointerleave", () => {
          card.style.transform = "";
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     6. Scroll-Aware Header, Scroll Progress, Timeline Rail & Live Clock
     ------------------------------------------------------------------------ */
  function initScrollMechanics() {
    const header = document.querySelector(".site-header");
    const progressBar = document.querySelector(".scroll-progress");
    const timeline = document.querySelector(".timeline");
    const timelineFill = document.querySelector(".timeline__progress");

    function onScroll() {
      const y = window.scrollY;
      if (header) {
        header.classList.toggle("is-scrolled", y > 16);
      }

      if (progressBar) {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const ratio = docHeight > 0 ? Math.min(1, Math.max(0, y / docHeight)) : 0;
        progressBar.style.transform = `scaleX(${ratio})`;
      }

      if (timeline && timelineFill) {
        const rect = timeline.getBoundingClientRect();
        const vh = window.innerHeight;
        const pct = Math.min(100, Math.max(0, ((vh * 0.62 - rect.top) / rect.height) * 100));
        timelineFill.style.height = `${pct}%`;
      }
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Live Bangalore IST clock in Hero telemetry
    const clockEl = document.querySelector("[data-live-clock]");
    if (clockEl) {
      const updateClock = () => {
        try {
          const formatted = new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).format(new Date());
          clockEl.textContent = `${formatted} IST`;
        } catch {
          clockEl.textContent = "IST · UTC+5:30";
        }
      };
      updateClock();
      window.setInterval(updateClock, 30000);
    }
  }

  /* ------------------------------------------------------------------------
     7. Mobile Editorial Menu Drawer
     ------------------------------------------------------------------------ */
  function initMobileMenu() {
    const trigger = document.getElementById("menu-trigger");
    const drawer = document.getElementById("mobile-drawer");
    if (!trigger || !drawer) return;

    function toggle(force) {
      const open = typeof force === "boolean" ? force : !drawer.classList.contains("is-open");
      drawer.classList.toggle("is-open", open);
      drawer.setAttribute("aria-hidden", String(!open));
      trigger.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("nav-open", open);
    }

    trigger.addEventListener("click", () => toggle());
    drawer.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => toggle(false));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) {
        toggle(false);
        trigger.focus();
      }
    });
  }

  /* ------------------------------------------------------------------------
     8. Scroll Reveals & Animated Metric Counters
     ------------------------------------------------------------------------ */
  function initRevealsAndCounters() {
    const revealEls = document.querySelectorAll("[data-reveal]");
    const counterEls = document.querySelectorAll("[data-count-to]");

    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px 90px 0px" }
    );
    revealEls.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight + 60) {
        el.classList.add("is-revealed");
      } else {
        revealObserver.observe(el);
      }
    });

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = parseFloat(el.dataset.countTo || "0");
          const decimals = parseInt(el.dataset.decimals || "0", 10);
          const prefix = el.dataset.prefix || "";
          const suffix = el.dataset.suffix || "";
          const duration = 1100;
          const start = performance.now();

          function step(now) {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = (target * eased).toFixed(decimals);
            el.innerHTML = `${prefix}${val}${suffix ? `<span>${suffix}</span>` : ""}`;
            if (t < 1) {
              window.requestAnimationFrame(step);
            }
          }
          window.requestAnimationFrame(step);
          counterObserver.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    counterEls.forEach((el) => counterObserver.observe(el));
  }

  /* ------------------------------------------------------------------------
     9. Category Filters (Projects & Tools)
     ------------------------------------------------------------------------ */
  function initFilterGroups() {
    document.querySelectorAll("[data-filter-group]").forEach((bar) => {
      const groupName = bar.dataset.filterGroup;
      const items = document.querySelectorAll(`[data-filter-item="${groupName}"]`);
      const pills = bar.querySelectorAll(".filter-pill");

      pills.forEach((pill) => {
        pill.addEventListener("click", () => {
          const filter = pill.dataset.filter;
          pills.forEach((p) => {
            p.classList.toggle("is-active", p === pill);
            p.setAttribute("aria-pressed", String(p === pill));
          });

          items.forEach((item) => {
            const cats = (item.dataset.category || "").split(" ");
            const show = filter === "all" || cats.includes(filter);
            item.classList.toggle("is-hidden", !show);
          });
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     10. Interactive Case Study Slide-Over Drawer
     ------------------------------------------------------------------------ */
  const CASE_STUDIES = {
    sovos_studio: {
      category: "Enterprise SaaS · Interactive Report & Data Visualization Studio",
      title: "Sovos Studio",
      role: "Full Stack Web Developer (Next.js API + React)",
      timeline: "2025 — 2026",
      url: "https://sovos.com/",
      image: "assets/images/project-sovos-studio-editor.jpg",
      gallery: [
        { label: "Canvas & Data Editor", src: "assets/images/project-sovos-studio-editor.jpg" },
        { label: "USA Choropleth Map", src: "assets/images/project-sovos-studio-map.png" },
        { label: "Workspace & Admin", src: "assets/images/project-sovos-studio-dashboard.jpg" },
      ],
      summary:
        "Interactive enterprise data visualization and multi-page report builder connected to a Next.js API backend—combining a drag-and-configure canvas, USA choropleth & marker maps with live state tooltips, a synchronized CSV/XLSX spreadsheet editor, and full workspace governance.",
      highlights: [
        "Built interactive USA Choropleth Maps with regulatory color-grouping, legends, and dynamic hover tooltips per state.",
        "Engineered a live spreadsheet dataset editor supporting CSV/XLSX upload, inline row/column editing, type conversions, and real-time canvas updates.",
        "Delivered complete workspace management including Draft/Published lifecycles, Version History, Export, Admin Panel, User Management, Audit Log, and Integrations.",
      ],
      stack: ["Next.js API", "React.js", "TypeScript", "Choropleth Maps", "Spreadsheet Data Editor", "CSV/XLSX", "RBAC & Audit Log"],
    },
    streamshield: {
      category: "Open Source · Chrome Extension (Manifest V3)",
      title: "StreamShield — Universal Video Ad Interruption Manager",
      role: "Creator & Full-Stack TypeScript Engineer",
      timeline: "Open Source · v1.0.0",
      url: "https://github.com/Marburg7/StreamShield",
      image: "assets/svg/project-streamshield.svg",
      summary:
        "Production-grade, privacy-first Chrome Extension (Manifest V3) built in strict TypeScript that automatically detects video ad interruptions and activates supported player controls—accessible Skip buttons, optional DRM-safe VOD acceleration, or audio mute fallback with guaranteed post-ad volume, mute, and playback-rate restoration.",
      highlights: [
        "Architected a 14-state deterministic finite state machine (AdEngine + PlayerManager) with verified skip accounting, manual-unmute respect, and exact pre-ad state restoration.",
        "Built 9 independent, modular StreamingPlatformAdapter implementations covering YouTube, JioHotstar/JioCinema, Amazon Prime Video, Netflix, Sony LIV, ZEE5, Hulu, Disney+ (Shadow-DOM piercing), and an opt-in Generic adapter.",
        "Enforced strict DRM & live-stream safety: live sports/SSAI breaks stay strictly at 1.0x with mute fallback, Skip Intro/Recap/Credits are excluded, and DRM step-down + cooldown recovery prevent playback errors.",
        "Engineered a dark-mode live dashboard popup, Shadow-DOM status pill, scoped least-privilege host permissions, optional per-origin consent, and zero telemetry / zero external network requests.",
        "Backed by strict TypeScript compilation, dual dev/prod esbuild pipelines, Vitest unit & integration scenario suites, and Playwright real-Chromium MV3 extension tests.",
      ],
      stack: ["Strict TypeScript", "Chrome MV3", "14-State FSM", "Shadow DOM", "esbuild", "Vitest", "Playwright Chromium", "Zero Telemetry"],
    },
    novacut: {
      category: "Open Source · AI Video Automation",
      title: "NovaCut Studio",
      role: "Creator & Full-Stack AI Engineer",
      timeline: "Open Source",
      url: "https://github.com/Marburg7/NovaCut",
      image: "assets/svg/project-novacut.svg",
      summary:
        "Free, open-source AI clip maker that transforms YouTube, Twitch, and Kick streams into captioned 9:16 vertical clips for Shorts, Reels, and TikTok using local transcription and an NLP engine.",
      highlights: [
        "Engineered real-time live clipping, per-creator workspaces, and scheduled multi-platform auto-posting.",
        "Built optional LLM integrations supporting Gemini, OpenAI, Claude, and local Ollama models.",
        "Designed and developed a dark-mode studio dashboard complete with an interactive video scrubber and caption designer.",
      ],
      stack: ["Python", "FastAPI", "React.js", "TypeScript", "Local NLP", "Gemini / Claude / OpenAI / Ollama"],
    },
    sovos: {
      category: "Enterprise Multisite · Global Tax Compliance",
      title: "Sovos Multisite Platform",
      role: "Full Stack Web Developer (Web Developer Specialist)",
      timeline: "Aug 2025 — Present",
      url: "https://sovos.com/",
      image: "assets/images/project-sovos.png",
      summary:
        "End-to-end enterprise multisite architecture spanning 7+ regional webpages and 10+ eCommerce properties across multiple brands and business units—engineered with React.js, TypeScript, Storybook, Tailwind CSS, PHP, and automated CI/CD.",
      highlights: [
        "Built and maintained reusable React.js UI component libraries with hooks, TypeScript, Tailwind CSS, and Storybook, backed by Jest and React Testing Library.",
        "Integrated RESTful APIs and enterprise services including Marketo forms, Smartling translation management, and Infogram data visualizations.",
        "Managed containerized dev/staging/prod workflows using Docker, Kubernetes, Lando, YAML CI/CD pipelines, AWS, and Azure.",
      ],
      stack: ["React.js", "TypeScript", "Storybook", "Tailwind CSS", "Jest & RTL", "PHP", "WordPress", "Docker / AWS / Azure"],
    },
    taxapedia: {
      category: "Enterprise Knowledge Hub · Technical & AI SEO",
      title: "Taxapedia",
      role: "Full Stack Web Developer",
      timeline: "2025 — 2026",
      url: "https://sovos.com/taxapedia",
      image: "assets/svg/project-taxapedia.svg",
      summary:
        "Authoritative tax-compliance reference hub built on WordPress and Elementor, architected with enterprise security practices, structured content hubs, and technical SEO engineered for both search engines and AI agents.",
      highlights: [
        "Structured clean semantic content hubs, canonical tags, schema markup, and metadata to maximize organic search rankings.",
        "Optimized specifically for AI agents such as ChatGPT and Claude with clean hierarchy, named authors, dated updates, and cited primary sources.",
        "Hardened WordPress architecture with performance tuning and Core Web Vitals optimization.",
      ],
      stack: ["WordPress", "Elementor", "Technical SEO", "Schema Markup", "AI-Agent SEO", "Core Web Vitals"],
    },
    efilemyform: {
      category: "FinTech / TaxTech · IRS-Approved Platform",
      title: "eFileMyForm",
      role: "Full-Stack Web Developer & UI/UX Designer",
      timeline: "2024 — 2025",
      url: "https://efilemyforms.com/",
      image: "assets/images/project-efilemyform.png",
      summary:
        "Designed and developed an IRS-approved cloud e-filing platform for 1099, W-2, and ACA forms—owning both frontend experiences and backend/API logic for businesses, SMBs, and CPAs.",
      highlights: [
        "Engineered end-to-end tax filing workflows with real-time IRS compliance validation and clear error resolution.",
        "Handled frontend component architecture alongside backend RESTful API integrations.",
        "Integrated automated print-and-mail fulfillment services for seamless high-volume filing.",
      ],
      stack: ["React.js", "JavaScript (ES6+)", "RESTful APIs", "PHP / Node.js", "UI/UX Design", "Compliance UX"],
    },
    "1099pro": {
      category: "Cloud SaaS · IRS-Approved eFiling",
      title: "1099pro.com",
      role: "Full-Stack Web Developer & UI/UX Designer",
      timeline: "2024 — 2025",
      url: "https://1099pro.com/",
      image: "assets/images/project-1099pro.png",
      summary:
        "IRS-compliant cloud e-filing platform for 1099, W-2, and ACA reporting built across both frontend and backend/API layers to serve high-volume tax professionals and SMBs.",
      highlights: [
        "Built intuitive multi-step compliance workflows paired with real-time IRS validation logic.",
        "Delivered responsive, cross-browser-compatible interfaces tuned for peak tax-season traffic.",
        "Unified visual hierarchy and accessible UI patterns across desktop and mobile viewports.",
      ],
      stack: ["React.js", "JavaScript", "REST APIs", "Figma", "WCAG Accessibility"],
    },
    royaal: {
      category: "Real Estate & Architecture",
      title: "Royaal Mahaadeva Builders",
      role: "Software Developer (UI/UX + Web)",
      timeline: "2024",
      url: "https://royaalmahaadevabuilders.com/",
      image: "assets/images/project-royaal.png",
      summary:
        "Designed and developed a modern real estate developer flagship showcasing residential and commercial property listings, architectural portfolios, and conversion-focused inquiry journeys.",
      highlights: [
        "Delivered as part of a multi-domain portfolio sustaining 70,000+ visitors every 15 days.",
        "Engineered mobile-first property showcases, technical SEO metadata, and fast-loading galleries.",
        "Crafted intuitive lead generation funnels to drive direct buyer consultations.",
      ],
      stack: ["WordPress", "UI/UX Design", "JavaScript", "Technical SEO", "Responsive Web"],
    },
    eduleem: {
      category: "EdTech · High-Traffic Institute Platform",
      title: "Eduleem.com",
      role: "Sole Developer & UI/UX Engineer",
      timeline: "Dec 2023 — Aug 2025",
      url: "https://eduleem.com/",
      image: "assets/images/project-eduleem.png",
      summary:
        "Designed and built Eduleem.com end-to-end as sole developer—from UX research and Figma prototypes to full deployment and technical SEO—for a leading Bangalore institute offering career-focused design, IT, and technology courses.",
      highlights: [
        "Sustained 70,000+ visitors every 15 days across delivered properties (Eduleem.com, CubeDecors.com, Digileem.com, Eduleem.org, Royaalmahaadevabuilders.com).",
        "Built 20+ marketing-centric landing pages with HubSpot-style modules and resolved 100+ technical SEO issues via Semrush and manual audits.",
        "Conducted user research, A/B testing, and usability analysis to drive measurable conversion growth.",
      ],
      stack: ["React.js", "Node.js", "WordPress", "WooCommerce", "Figma", "Semrush / GA4 / GTM"],
    },
  };

  function initCaseStudyDrawer() {
    const backdrop = document.getElementById("case-backdrop");
    if (!backdrop) return;

    const rootPrefix = document.body.dataset.root || "./";
    const closeBtn = backdrop.querySelector(".drawer-close");
    const catEl = backdrop.querySelector("[data-case-cat]");
    const titleEl = backdrop.querySelector("[data-case-title]");
    const imgEl = backdrop.querySelector("[data-case-img]");
    const roleEl = backdrop.querySelector("[data-case-role]");
    const timeEl = backdrop.querySelector("[data-case-time]");
    const descEl = backdrop.querySelector("[data-case-desc]");
    const listEl = backdrop.querySelector("[data-case-highlights]");
    const stackEl = backdrop.querySelector("[data-case-stack]");
    const linkEl = backdrop.querySelector("[data-case-link]");

    let activeCaseId = null;

    function openCase(id) {
      const baseData = CASE_STUDIES[id];
      if (!baseData) return;
      activeCaseId = id;

      const localized = window.PortfolioI18n?.caseStudy?.(id) || null;
      const data = localized
        ? {
          ...baseData,
          category: localized.category || baseData.category,
          title: localized.title || baseData.title,
          role: localized.role || baseData.role,
          timeline: localized.timeline || baseData.timeline,
          summary: localized.summary || baseData.summary,
          highlights: Array.isArray(localized.highlights) && localized.highlights.length ? localized.highlights : baseData.highlights,
        }
        : baseData;

      if (catEl) catEl.textContent = data.category;
      if (titleEl) titleEl.textContent = data.title;
      if (imgEl) {
        imgEl.src = `${rootPrefix}${data.image}`;
        imgEl.alt = window.PortfolioI18n?.ui?.("casePreviewAlt", "{title} project preview", { title: data.title }) || `${data.title} project preview`;
      }
      let galleryEl = backdrop.querySelector("[data-case-gallery]");
      if (!galleryEl && imgEl?.parentElement) {
        galleryEl = document.createElement("div");
        galleryEl.className = "case-drawer__gallery";
        galleryEl.setAttribute("data-case-gallery", "");
        imgEl.parentElement.insertAdjacentElement("afterend", galleryEl);
      }
      if (galleryEl) {
        if (Array.isArray(data.gallery) && data.gallery.length > 1) {
          galleryEl.hidden = false;
          galleryEl.textContent = "";
          data.gallery.forEach((shot, idx) => {
            const label = (localized && Array.isArray(localized.galleryLabels) && localized.galleryLabels[idx]) || shot.label;
            const tab = document.createElement("button");
            tab.type = "button";
            tab.className = `case-gallery-tab${idx === 0 ? " is-active" : ""}`;
            tab.textContent = label;
            tab.addEventListener("click", () => {
              galleryEl.querySelectorAll(".case-gallery-tab").forEach((b) => b.classList.toggle("is-active", b === tab));
              if (imgEl) {
                imgEl.src = `${rootPrefix}${shot.src}`;
                imgEl.alt = `${data.title} — ${label}`;
              }
            });
            galleryEl.appendChild(tab);
          });
        } else {
          galleryEl.hidden = true;
          galleryEl.textContent = "";
        }
      }
      if (roleEl) roleEl.textContent = data.role;
      if (timeEl) timeEl.textContent = data.timeline;
      if (descEl) descEl.textContent = data.summary;

      if (listEl) {
        listEl.textContent = "";
        data.highlights.forEach((h) => {
          const li = document.createElement("li");
          li.textContent = h;
          listEl.appendChild(li);
        });
      }
      if (stackEl) {
        stackEl.textContent = "";
        data.stack.forEach((t) => {
          const span = document.createElement("span");
          span.className = "chip";
          span.textContent = window.PortfolioI18n?.t?.(t, t) || t;
          stackEl.appendChild(span);
        });
      }
      if (linkEl) {
        linkEl.href = data.url;
      }

      backdrop.classList.add("is-open");
      backdrop.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      if (closeBtn) closeBtn.focus();
    }

    function closeCase() {
      activeCaseId = null;
      backdrop.classList.remove("is-open");
      backdrop.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

    window.addEventListener("portfolio:langchange", () => {
      if (activeCaseId && backdrop.classList.contains("is-open")) {
        openCase(activeCaseId);
      }
    });

    window.__openCaseStudy = openCase;

    document.querySelectorAll("[data-open-case]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        openCase(btn.dataset.openCase);
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeCase);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeCase();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && backdrop.classList.contains("is-open")) closeCase();
    });
  }

  /* ------------------------------------------------------------------------
     11. Multi-Step Contact Concierge Wizard & Copy Email
     ------------------------------------------------------------------------ */
  function initContactWizard() {
    // Copy email buttons
    document.querySelectorAll("[data-copy-email]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const email = btn.dataset.copyEmail || "syedshafaiz76@gmail.com";
        try {
          await navigator.clipboard.writeText(email);
          btn.textContent = window.PortfolioI18n?.ui?.("copied", "Copied!") || "Copied!";
          btn.classList.add("is-copied");
          window.setTimeout(() => {
            btn.textContent = window.PortfolioI18n?.ui?.("copy", "Copy") || "Copy";
            btn.classList.remove("is-copied");
          }, 2000);
        } catch {
          window.location.href = `mailto:${email}`;
        }
      });
    });

    document.querySelectorAll(".wizard-form").forEach((form) => {
      const panes = form.querySelectorAll(".wizard-pane");
      const pills = form.querySelectorAll(".wizard-step-pill");
      const statusEl = form.querySelector(".form-status");
      const serviceInput = form.querySelector('input[name="Service"]');
      const timelineInput = form.querySelector('input[name="Timeline"]');
      let currentStep = 0;

      function setStep(idx) {
        currentStep = Math.max(0, Math.min(panes.length - 1, idx));
        panes.forEach((p, i) => p.classList.toggle("is-active", i === currentStep));
        pills.forEach((p, i) => {
          p.classList.toggle("is-active", i === currentStep);
          p.classList.toggle("is-done", i < currentStep);
        });
        if (statusEl) {
          statusEl.className = "form-status";
          statusEl.textContent = "";
        }
      }

      // Single-select choice groups
      form.querySelectorAll("[data-choice-group]").forEach((group) => {
        const targetName = group.dataset.choiceGroup;
        const buttons = group.querySelectorAll(".choice-btn");
        buttons.forEach((btn) => {
          btn.addEventListener("click", () => {
            buttons.forEach((b) => {
              b.classList.toggle("is-selected", b === btn);
              b.setAttribute("aria-pressed", String(b === btn));
            });
            if (targetName === "Service" && serviceInput) serviceInput.value = btn.dataset.value;
            if (targetName === "Timeline" && timelineInput) timelineInput.value = btn.dataset.value;
          });
        });
      });

      form.querySelectorAll("[data-wizard-next]").forEach((btn) => {
        btn.addEventListener("click", () => setStep(currentStep + 1));
      });

      form.querySelectorAll("[data-wizard-prev]").forEach((btn) => {
        btn.addEventListener("click", () => setStep(currentStep - 1));
      });

      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nameInput = form.querySelector('input[name="Name"]');
        const emailInput = form.querySelector('input[name="Email"]');
        const msgInput = form.querySelector('textarea[name="Message"]');
        const submitBtn = form.querySelector('[type="submit"]');

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const service = serviceInput ? serviceInput.value.trim() : "Web Development";
        const timeline = timelineInput ? timelineInput.value.trim() : "Flexible";
        const message = msgInput ? msgInput.value.trim() : "";

        if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          if (statusEl) {
            statusEl.textContent =
              window.PortfolioI18n?.ui?.(
                "wizardError",
                "Please provide your name and a valid email address so Syed can reply."
              ) || "Please provide your name and a valid email address so Syed can reply.";
            statusEl.className = "form-status is-visible form-status--error";
          }
          if (!name && nameInput) nameInput.focus();
          else if (emailInput) emailInput.focus();
          return;
        }

        if (submitBtn) submitBtn.disabled = true;

        const subject = encodeURIComponent(`Project Inquiry — ${service} (${name})`);
        const body = encodeURIComponent(
          [
            `Name: ${name}`,
            `Email: ${email}`,
            `Service: ${service}`,
            `Timeline: ${timeline}`,
            "",
            "Project Brief:",
            message || "(No additional notes provided)",
          ].join("\n")
        );

        window.setTimeout(() => {
          if (submitBtn) submitBtn.disabled = false;
          if (statusEl) {
            statusEl.textContent =
              window.PortfolioI18n?.ui?.(
                "wizardSuccess",
                "Thanks, {name}! Your {service} brief is ready — launching your email client to send to syedshafaiz76@gmail.com.",
                { name, service }
              ) ||
              `Thanks, ${name}! Your ${service} brief is ready — launching your email client to send to syedshafaiz76@gmail.com.`;
            statusEl.className = "form-status is-visible form-status--success";
          }

          const a = document.createElement("a");
          a.href = `mailto:syedshafaiz76@gmail.com?subject=${subject}&body=${body}`;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          form.reset();
        }, 280);
      });
    });
  }

  /* ------------------------------------------------------------------------
     12. Lazy-Loaded AI Portfolio Agent Launcher (Loads js/agent-ui.js on demand)
     ------------------------------------------------------------------------ */
  function initAssistant() {
    const rootPrefix = document.body.dataset.root || "./";

    // Ensure launcher button exists across all pages
    let fab = document.getElementById("assistant-fab");
    if (!fab) {
      const agentStrings = window.PortfolioI18n?.agent?.();
      fab = document.createElement("button");
      fab.id = "assistant-fab";
      fab.className = "assistant-fab";
      fab.type = "button";
      fab.setAttribute("aria-expanded", "false");
      fab.setAttribute("aria-controls", "assistant-panel");
      fab.setAttribute("aria-label", agentStrings?.fabAria || "Open Syed's AI Portfolio Agent");
      const dot = document.createElement("span");
      dot.className = "status-dot";
      dot.setAttribute("aria-hidden", "true");
      const lbl = document.createElement("span");
      lbl.className = "assistant-fab__label";
      lbl.textContent = agentStrings?.fabLabel || "Ask Syed's AI";
      fab.append(dot, lbl);
      document.body.appendChild(fab);
    }

    // Keep FAB label & aria-label synced on language change even before agent-ui.js lazy-loads
    window.addEventListener("portfolio:langchange", () => {
      const ag = window.PortfolioI18n?.agent?.();
      const lblEl = fab.querySelector(".assistant-fab__label");
      if (lblEl) lblEl.textContent = ag?.fabLabel || "Ask Syed's AI";
      fab.setAttribute("aria-label", ag?.fabAria || "Open Syed's AI Portfolio Agent");
    });

    let scriptRequested = false;
    function loadAgentBundle(openImmediately = false) {
      if (window.__syedAgentMounted) return;
      if (openImmediately) window.__syedAgentOpenOnLoad = true;
      if (scriptRequested) return;
      scriptRequested = true;
      const script = document.createElement("script");
      script.src = `${rootPrefix}js/agent-ui.js`;
      script.defer = true;
      document.body.appendChild(script);
    }

    fab.addEventListener("pointerenter", () => loadAgentBundle(false), { once: true });
    fab.addEventListener("focus", () => loadAgentBundle(false), { once: true });
    fab.addEventListener(
      "click",
      () => {
        if (!window.__syedAgentMounted) loadAgentBundle(true);
      },
      { once: true }
    );

    // Also prefetch cleanly during browser idle time so opening feels instant
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => loadAgentBundle(false), { timeout: 2200 });
    } else {
      window.setTimeout(() => loadAgentBundle(false), 1200);
    }
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  document.addEventListener("DOMContentLoaded", () => {
    initPreloader();
    initRollButtons();
    initAmbientCanvas();
    initCustomCursor();
    initSpotlightsAndTilt();
    initScrollMechanics();
    initMobileMenu();
    initRevealsAndCounters();
    initFilterGroups();
    initCaseStudyDrawer();
    initContactWizard();
    initAssistant();
  });
})();
