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
     2. Kinetic Character-Roll Buttons
     ------------------------------------------------------------------------ */
  function initRollButtons() {
    if (reducedMotion) return;
    document.querySelectorAll(".roll-btn[data-roll]").forEach((btn) => {
      const labelEl = btn.querySelector(".roll-btn__text");
      if (!labelEl || labelEl.dataset.rolled === "true") return;
      const raw = labelEl.textContent.trim();
      labelEl.dataset.rolled = "true";
      labelEl.setAttribute("aria-label", raw);
      labelEl.textContent = "";

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
        ctx.fillStyle = n.warm ? "rgba(249, 115, 22, 0.45)" : "rgba(212, 255, 63, 0.35)";
        ctx.fill();

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const d = Math.hypot(n.x - m.x, n.y - m.y);
          if (d < 135) {
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            const alpha = (1 - d / 135) * 0.11;
            ctx.strokeStyle = `rgba(245, 243, 239, ${alpha.toFixed(3)})`;
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
        header.classList.toggle("is-scrolled", y > 36);
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

    function openCase(id) {
      const data = CASE_STUDIES[id];
      if (!data) return;

      if (catEl) catEl.textContent = data.category;
      if (titleEl) titleEl.textContent = data.title;
      if (imgEl) {
        imgEl.src = `${rootPrefix}${data.image}`;
        imgEl.alt = `${data.title} project preview`;
      }
      if (roleEl) roleEl.textContent = data.role;
      if (timeEl) timeEl.textContent = data.timeline;
      if (descEl) descEl.textContent = data.summary;

      if (listEl) {
        listEl.innerHTML = data.highlights.map((h) => `<li>${h}</li>`).join("");
      }
      if (stackEl) {
        stackEl.innerHTML = data.stack.map((t) => `<span class="chip">${t}</span>`).join("");
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
      backdrop.classList.remove("is-open");
      backdrop.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
    }

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
          const original = btn.textContent;
          btn.textContent = "Copied!";
          btn.classList.add("is-copied");
          window.setTimeout(() => {
            btn.textContent = original;
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
            statusEl.textContent = "Please provide your name and a valid email address so Syed can reply.";
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
            statusEl.textContent = `Thanks, ${name}! Your ${service} brief is ready — launching your email client to send to syedshafaiz76@gmail.com.`;
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
     12. Interactive Tool-Using Portfolio Agent (Works Across All Pages)
     ------------------------------------------------------------------------ */
  function initAssistant() {
    const rootPrefix = document.body.dataset.root || "./";

    // Auto-mount floating agent on subpages that don't have the markup inline
    if (!document.getElementById("assistant-fab")) {
      const fabBtn = document.createElement("button");
      fabBtn.id = "assistant-fab";
      fabBtn.className = "assistant-fab";
      fabBtn.type = "button";
      fabBtn.setAttribute("aria-expanded", "false");
      fabBtn.setAttribute("aria-controls", "assistant-panel");
      fabBtn.setAttribute("aria-label", "Chat with Syed's Portfolio Agent");
      fabBtn.innerHTML = `<span class="status-dot" aria-hidden="true"></span><span class="assistant-fab__label">Ask Syed's Agent</span>`;

      const aside = document.createElement("aside");
      aside.id = "assistant-panel";
      aside.className = "assistant-panel";
      aside.setAttribute("aria-hidden", "true");
      aside.setAttribute("aria-label", "Syed's Portfolio Agent");
      aside.innerHTML = `
        <div class="assistant-panel__head">
          <div class="assistant-panel__title-wrap">
            <div class="assistant-panel__avatar" aria-hidden="true">AI</div>
            <div class="assistant-panel__title">
              <span>Syed's Portfolio Agent</span>
              <span class="assistant-panel__status"><span class="status-dot" style="width:6px;height:6px;" aria-hidden="true"></span>CV Knowledge · Live Tools</span>
            </div>
          </div>
          <div class="assistant-panel__head-actions">
            <button class="assistant-icon-btn" type="button" data-assistant-reset title="Reset conversation" aria-label="Reset conversation">↺</button>
            <button class="assistant-icon-btn" type="button" data-assistant-close title="Close agent" aria-label="Close agent">✕</button>
          </div>
        </div>
        <div class="assistant-panel__messages" role="log" aria-live="polite"></div>
        <div class="assistant-prompts"></div>
        <form class="assistant-form">
          <input type="text" placeholder="Ask a question, test role fit, or say 'open NovaCut'..." aria-label="Ask Syed's agent">
          <button type="submit">Send</button>
        </form>
      `;
      document.body.append(fabBtn, aside);
    }

    const fab = document.getElementById("assistant-fab");
    const panel = document.getElementById("assistant-panel");
    if (!fab || !panel) return;

    const closeBtn = panel.querySelector("[data-assistant-close]");
    const resetBtn = panel.querySelector("[data-assistant-reset]");
    const messagesEl = panel.querySelector(".assistant-panel__messages");
    const promptsEl = panel.querySelector(".assistant-prompts");
    const form = panel.querySelector(".assistant-form");
    const input = form ? form.querySelector("input") : null;

    const STORAGE_KEY = "ss_agent_state_v2";

    /* --- Structured CV Knowledge Base --- */
    const SKILLS_CATALOG = [
      { name: "React.js", cat: "Frontend", aliases: ["react", "reactjs", "react.js", "hooks", "jsx"], detail: "Hooks, scalable component architecture & reusable UI libraries" },
      { name: "TypeScript", cat: "Frontend", aliases: ["typescript", "ts"], detail: "Typed enterprise React UI libraries & multisite platforms" },
      { name: "JavaScript (ES6+)", cat: "Frontend", aliases: ["javascript", "js", "es6", "jquery"], detail: "Modern ES6+, interactive DOM/canvas engineering, and jQuery" },
      { name: "Tailwind CSS", cat: "Frontend", aliases: ["tailwind", "tailwindcss", "css", "css3", "html", "html5", "bootstrap"], detail: "Responsive, cross-browser styling systems with Tailwind, CSS3, HTML5 & Bootstrap" },
      { name: "Storybook", cat: "Frontend", aliases: ["storybook", "design system", "component library"], detail: "Documented enterprise UI primitives across 7+ regional web properties" },
      { name: "Jest & React Testing Library", cat: "Testing", aliases: ["jest", "rtl", "react testing library", "unit test", "testing", "tests"], detail: "Unit and component testing for clean, production-grade front-end libraries" },
      { name: "PHP", cat: "Backend", aliases: ["php"], detail: "Custom WordPress themes/plugins and backend REST integrations" },
      { name: "Node.js", cat: "Backend", aliases: ["node", "nodejs", "node.js", "express", "npm", "yarn"], detail: "Scalable REST APIs, backend services, and modern build tooling" },
      { name: "Python & FastAPI", cat: "Backend & AI", aliases: ["python", "fastapi", "nlp", "ai", "llm", "ollama", "gemini", "openai", "claude"], detail: "Backend automation, FastAPI APIs, local transcription & LLM integrations (NovaCut Studio)" },
      { name: "MySQL & Alembic", cat: "Database", aliases: ["mysql", "sql", "database", "db", "alembic", "workbench", "migrations"], detail: "Relational schema design, MySQL Workbench, and Alembic migrations" },
      { name: "WordPress & WooCommerce", cat: "CMS & eCommerce", aliases: ["wordpress", "wp", "woocommerce", "elementor", "shopify", "hubspot", "ecommerce", "e-commerce", "cms"], detail: "10+ enterprise eCommerce sites, custom themes/plugins, WooCommerce, Shopify & HubSpot CMS" },
      { name: "Docker, Kubernetes & Lando", cat: "DevOps", aliases: ["docker", "kubernetes", "k8s", "lando", "container", "containers", "devops"], detail: "Containerized local, staging, and production infrastructure" },
      { name: "AWS & Azure", cat: "Cloud", aliases: ["aws", "azure", "cloud", "ci/cd", "cicd", "yaml", "github", "git", "pagely", "jira"], detail: "AWS Solutions Architect certified (Oct 2024), Azure, Git/GitHub CI/CD & YAML pipelines" },
      { name: "Marketo, Smartling & Infogram", cat: "MarTech", aliases: ["marketo", "smartling", "infogram", "localization", "translation"], detail: "Third-party enterprise API integrations across regional sites" },
      { name: "Figma, Adobe XD & Framer", cat: "UI/UX Design", aliases: ["figma", "xd", "adobe xd", "framer", "illustrator", "wireframe", "prototype", "ui", "ux", "a/b"], detail: "Wireframing, prototyping, usability analysis, and A/B testing" },
      { name: "Technical SEO & Core Web Vitals", cat: "SEO & Performance", aliases: ["seo", "schema", "sitemap", "gtm", "ga4", "analytics", "semrush", "cwv", "core web vitals", "wcag", "accessibility", "a11y"], detail: "100+ technical SEO fixes, Schema Markup, GA4/GTM, AI-agent SEO, CWV & WCAG accessibility" },
    ];

    const COMPANIES = {
      sovos: {
        name: "Sovos",
        role: "Full Stack Web Developer (Web Developer Specialist)",
        dates: "Aug 2025 – Present",
        summary: "Syed owns Sovos' enterprise multisite platform end-to-end using React.js, TypeScript, and ES6+, managing 10+ eCommerce websites across multiple brands and regions.",
        bullets: [
          "Builds scalable **React.js, TypeScript, Tailwind CSS & Storybook** UI libraries tested with **Jest & React Testing Library**.",
          "Integrates RESTful APIs including **Marketo forms, Smartling translation, and Infogram** visualizations.",
          "Manages dev/staging/prod CI/CD pipelines, **Docker, Kubernetes, Lando, AWS & Azure**, plus Core Web Vitals & WCAG accessibility.",
        ],
        actions: [
          { label: "Inspect Sovos Case Study", type: "open-case", value: "sovos" },
          { label: "Inspect Taxapedia", type: "open-case", value: "taxapedia" },
          { label: "Full Experience Page", type: "navigate", value: `${rootPrefix}experience/` },
        ],
        followups: ["Tell me about Taxapedia", "Does he use Docker and AWS?", "What did he do at Eduleem?"],
      },
      eduleem: {
        name: "Eduleem India Pvt Ltd",
        role: "Software Developer (UI/UX + Web Developer)",
        dates: "Dec 2023 – Aug 2025",
        summary: "Syed led multi-domain web renovations using React.js, Node.js, WordPress, and REST APIs—delivering high-traffic domains sustaining **70,000+ visitors every 15 days**.",
        bullets: [
          "Built & maintained **20+ marketing landing pages** with SEO and HubSpot-style modules plus Amazon-style WooCommerce showcases.",
          "Conducted user research, A/B testing & usability analysis, and resolved **100+ technical SEO issues** via Semrush.",
          "Shipped **Eduleem.com, CubeDecors.com, Royaalmahaadevabuilders.com, Digileem.com, and Eduleem.org**.",
        ],
        actions: [
          { label: "Inspect Eduleem Case Study", type: "open-case", value: "eduleem" },
          { label: "Inspect Royaal Builders", type: "open-case", value: "royaal" },
        ],
        followups: ["What is he doing now at Sovos?", "Tell me about his SEO skills", "Show me his certifications"],
      },
      arm: {
        name: "ARM Infoserve India Pvt Ltd",
        role: "Full Stack Web Developer Intern",
        dates: "Sep 2023 – Nov 2023",
        summary: "Syed designed and built **arminfoserve.com** from scratch using WordPress, WooCommerce, Core Java, HTML, CSS, JavaScript, jQuery, and PHP.",
        bullets: [
          "Delivered responsive, accessible UI components across desktop and mobile devices.",
          "Owned both visual interface design and full-stack web implementation.",
        ],
        actions: [
          { label: "View Full Experience", type: "navigate", value: `${rootPrefix}experience/` },
          { label: "Visit arminfoserve.com ↗", type: "external", value: "https://arminfoserve.com/" },
        ],
        followups: ["What did he do at Eduleem?", "What does he do at Sovos?", "Show his education"],
      },
    };

    let state = {
      history: [],
      lastEntity: null, // { kind: 'project' | 'company', id: string }
      intake: { active: false, step: 0, service: "", timeline: "", brief: "" },
    };

    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.history)) state = parsed;
      }
    } catch {
      // ignore storage errors
    }

    function saveState() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          ...state,
          history: state.history.slice(-24),
        }));
      } catch {
        // ignore storage errors
      }
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function formatInline(text) {
      return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    }

    function executeAction(action) {
      if (!action) return;
      if (action.type === "open-case") {
        if (typeof window.__openCaseStudy === "function") {
          toggle(false);
          window.__openCaseStudy(action.value);
        } else {
          window.location.href = `${rootPrefix}projects/`;
        }
      } else if (action.type === "scroll") {
        const el = document.getElementById(action.value);
        if (el) {
          toggle(false);
          el.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = `${rootPrefix}#${action.value}`;
        }
      } else if (action.type === "filter-projects") {
        const pill = document.querySelector(`[data-filter-group="projects"] [data-filter="${action.value}"]`);
        const section = document.getElementById("projects");
        if (pill) {
          pill.click();
          if (section) section.scrollIntoView({ behavior: "smooth" });
          toggle(false);
        } else {
          window.location.href = `${rootPrefix}projects/`;
        }
      } else if (action.type === "navigate") {
        window.location.href = action.value;
      } else if (action.type === "external") {
        window.open(action.value, "_blank", "noopener,noreferrer");
      } else if (action.type === "copy") {
        navigator.clipboard?.writeText(action.value).catch(() => {});
      } else if (action.type === "prefill-contact") {
        const contactSection = document.getElementById("contact");
        if (contactSection) {
          const msgBox = contactSection.querySelector('textarea[name="Message"]');
          const srvInput = contactSection.querySelector('input[name="Service"]');
          if (srvInput && action.service) srvInput.value = action.service;
          if (msgBox && action.brief) msgBox.value = action.brief;
          const nextBtn = contactSection.querySelector("[data-wizard-next]");
          if (nextBtn) nextBtn.click();
          toggle(false);
          contactSection.scrollIntoView({ behavior: "smooth" });
          const nameField = contactSection.querySelector('input[name="Name"]');
          if (nameField) window.setTimeout(() => nameField.focus(), 450);
        } else {
          const subj = encodeURIComponent(`Portfolio Inquiry — ${action.service || "Collaboration"}`);
          const body = encodeURIComponent(action.brief || "");
          window.location.href = `mailto:syedshafaiz76@gmail.com?subject=${subj}&body=${body}`;
        }
      } else if (action.type === "start-intake") {
        handleUserInput("I want to hire Syed for a project");
      }
    }

    function renderMessage(msg) {
      if (!messagesEl) return;
      const div = document.createElement("div");
      div.className = `chat-bubble chat-bubble--${msg.who}`;

      if (msg.who === "user") {
        div.textContent = msg.text;
      } else {
        let html = "";
        if (msg.trace) {
          html += `<div class="chat-trace">⚡ ${escapeHtml(msg.trace)}</div>`;
        }
        html += `<div class="chat-bubble__body">`;
        if (msg.text) {
          msg.text.split("\n\n").forEach((para) => {
            html += `<p>${formatInline(para)}</p>`;
          });
        }
        if (msg.bullets && msg.bullets.length) {
          html += `<ul class="chat-bubble__list">${msg.bullets
            .map((b) => `<li><span>${formatInline(b)}</span></li>`)
            .join("")}</ul>`;
        }
        html += `</div>`;
        div.innerHTML = html;

        if (msg.actions && msg.actions.length) {
          const bar = document.createElement("div");
          bar.className = "chat-actions";
          msg.actions.forEach((act) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "chat-action-btn";
            btn.textContent = act.label;
            btn.addEventListener("click", () => {
              executeAction(act);
              if (act.type === "copy") {
                const orig = btn.textContent;
                btn.textContent = "Copied ✓";
                window.setTimeout(() => (btn.textContent = orig), 1600);
              }
            });
            bar.appendChild(btn);
          });
          div.appendChild(bar);
        }
      }

      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function renderPrompts(list) {
      if (!promptsEl) return;
      promptsEl.innerHTML = "";
      (list || []).slice(0, 3).forEach((p) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "prompt-chip";
        btn.textContent = p;
        btn.dataset.prompt = p;
        btn.addEventListener("click", () => handleUserInput(p));
        promptsEl.appendChild(btn);
      });
    }

    function showTyping(statusText) {
      const div = document.createElement("div");
      div.className = "chat-bubble chat-bubble--bot";
      div.dataset.typing = "true";
      div.innerHTML = `<span class="chat-typing"><span class="chat-typing__dots"><span></span><span></span><span></span></span><span>${escapeHtml(statusText)}</span></span>`;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    /* --- Natural Language Agent Reasoner --- */
    function generateAgentReply(rawQuery) {
      const q = rawQuery.trim();
      const s = q.toLowerCase();

      // 0. Active interactive project-scoping intake flow
      if (state.intake.active) {
        if (/(cancel|nevermind|stop|back|exit)/.test(s)) {
          state.intake = { active: false, step: 0, service: "", timeline: "", brief: "" };
          return {
            trace: "Intake Cancelled",
            text: "No problem! I've cleared the project brief. What else would you like to know about Syed?",
            followups: ["Tell me about NovaCut Studio", "Check React & TypeScript fit", "Show certifications"],
          };
        }

        if (state.intake.step === 1) {
          state.intake.service = q;
          state.intake.step = 2;
          return {
            trace: "Project Scoping · Step 2/2",
            text: `Got it — **${q}**. What's your ideal timeline and a quick summary of what you want to achieve?`,
            followups: ["Launch within 1 month", "Full-time React.js role", "Cancel"],
          };
        }

        if (state.intake.step === 2) {
          state.intake.brief = `Focus: ${state.intake.service}\nDetails & Timeline: ${q}`;
          const finalBrief = state.intake.brief;
          const finalService = state.intake.service;
          state.intake = { active: false, step: 0, service: "", timeline: "", brief: "" };
          return {
            trace: "Brief Ready · Action Prepared",
            text: `Awesome! I've drafted your brief for Syed (**${finalService}**). Click below to auto-fill the Contact form or copy his email directly:`,
            bullets: [
              `**Email:** syedshafaiz76@gmail.com`,
              `**Phone:** +91 7019487141 (Bengaluru, India)`,
            ],
            actions: [
              { label: "⚡ Prefill Contact Form", type: "prefill-contact", service: finalService, brief: finalBrief },
              { label: "Copy Email", type: "copy", value: "syedshafaiz76@gmail.com" },
            ],
            followups: ["Show Syed's key projects", "Check his AWS certification"],
          };
        }
      }

      // 1. Direct UI commands ("open novacut", "filter ai projects", "go to contact")
      if (/\b(open|show|launch|inspect)\b/.test(s)) {
        const caseMap = [
          { re: /novacut/, id: "novacut" },
          { re: /taxapedia/, id: "taxapedia" },
          { re: /sovos/, id: "sovos" },
          { re: /efile/, id: "efilemyform" },
          { re: /1099/, id: "1099pro" },
          { re: /eduleem/, id: "eduleem" },
          { re: /royaal|mahaadeva|builder/, id: "royaal" },
        ];
        for (const item of caseMap) {
          if (item.re.test(s) && /\b(open|inspect|launch|case study)\b/.test(s)) {
            const c = CASE_STUDIES[item.id];
            state.lastEntity = { kind: "project", id: item.id };
            return {
              trace: `Tool Ready · Case Study (${c.title})`,
              text: `**${c.title}** — ${c.summary}`,
              bullets: c.highlights.slice(0, 2),
              actions: [
                { label: `⚡ Open ${c.title} Drawer`, type: "open-case", value: item.id },
                { label: "Launch Live ↗", type: "external", value: c.url },
              ],
              followups: ["What stack was used?", "Show all projects", "Start a project brief"],
            };
          }
        }
        if (/ai\s+project|open\s+source/.test(s)) {
          return {
            trace: "Tool Ready · Filter Projects (AI)",
            text: "Syed's AI & open-source highlights are **NovaCut Studio** (open-source AI stream-to-shorts clipper with local NLP + Gemini/OpenAI/Claude/Ollama) and **Taxapedia** (AI-agent & SEO optimized compliance hub).",
            actions: [
              { label: "⚡ Filter AI Projects", type: "filter-projects", value: "ai" },
              { label: "Open NovaCut Case Study", type: "open-case", value: "novacut" },
            ],
            followups: ["Tell me about NovaCut Studio", "Does he know Python & FastAPI?"],
          };
        }
      }

      // 2. Greetings & identity
      if (/^(hi|hello|hey|yo|good\s+(morning|afternoon|evening)|hola|namaste|salam)\b/.test(s) && s.length < 36) {
        return {
          trace: "Agent Ready",
          text: "Hey there! I'm **Syed's Portfolio Agent**. I know every detail of Syed's CV, projects, tech stack, and experience—and I can open case studies, check role fit, or draft a project brief for you. What would you like to explore?",
          followups: ["Check fit for a React.js role", "Tell me about NovaCut Studio", "Hire Syed for a project"],
        };
      }

      if (/(who are you|what can you do|help|how do you work)/.test(s)) {
        return {
          trace: "Capabilities Overview",
          text: "I act as Syed's interactive CV & portfolio agent. Try asking me things like:",
          bullets: [
            "**Role & Skill Checks:** \"Does Syed know TypeScript, Jest, Docker, and AWS?\"",
            "**Deep Dives:** \"Tell me about NovaCut Studio\" or \"What did he build at Sovos?\"",
            "**Live Actions:** \"Open NovaCut case study\" or \"I want to hire Syed for an eCommerce site\"",
          ],
          followups: ["Does he know React, TS & AWS?", "Summarize his 3+ yrs experience", "Start a project brief"],
        };
      }

      if (/^(thanks|thank you|thx|awesome|cool|great|nice)\b/.test(s) && s.length < 35) {
        return {
          trace: "Standing By",
          text: "Glad I could help! Let me know if you want to inspect another project, check a specific skill, or connect directly with Syed.",
          actions: [
            { label: "Copy Email", type: "copy", value: "syedshafaiz76@gmail.com" },
            { label: "Jump to Contact", type: "scroll", value: "contact" },
          ],
          followups: ["Start a project brief", "Show Syed's certifications"],
        };
      }

      // 3. Follow-up resolution using conversation memory ("what stack did he use?", "tell me more", "link?")
      if (state.lastEntity && /\b(it|that|there|this project|this role|stack|tech|tools|link|url|github|more|details)\b/.test(s) && !/(sovos|novacut|taxapedia|efile|1099|eduleem|royaal|arm)/.test(s)) {
        if (state.lastEntity.kind === "project") {
          const c = CASE_STUDIES[state.lastEntity.id];
          if (c) {
            return {
              trace: `Context Follow-up · ${c.title}`,
              text: `For **${c.title}** (${c.role}, ${c.timeline}), Syed used **${c.stack.join(", ")}**.`,
              bullets: c.highlights,
              actions: [
                { label: `⚡ Open ${c.title} Drawer`, type: "open-case", value: state.lastEntity.id },
                { label: "Open Live Link ↗", type: "external", value: c.url },
              ],
              followups: ["Show other projects", "What is his full tech stack?", "Start a project brief"],
            };
          }
        }
      }

      // 4. Specific Project Deep-Dives
      const projectMatchers = [
        { id: "novacut", re: /novacut|clip\s*maker|shorts|reels|tiktok|twitch|kick|scrubber|caption/ },
        { id: "taxapedia", re: /taxapedia|elementor|ai\s*agent.*seo|chatgpt.*claude/ },
        { id: "efilemyform", re: /efilemyform|efile|w-2|aca\s*form|print.and.mail/ },
        { id: "1099pro", re: /1099pro|1099/ },
        { id: "royaal", re: /royaal|mahaadeva|real\s*estate|builder/ },
      ];
      for (const pm of projectMatchers) {
        if (pm.re.test(s)) {
          const c = CASE_STUDIES[pm.id];
          state.lastEntity = { kind: "project", id: pm.id };
          return {
            trace: `Project Match · ${c.title}`,
            text: `**${c.title}** (${c.category}) — ${c.summary}`,
            bullets: c.highlights,
            actions: [
              { label: `⚡ Inspect ${c.title}`, type: "open-case", value: pm.id },
              { label: "Visit Project ↗", type: "external", value: c.url },
            ],
            followups: ["What stack did he use there?", "Tell me about Sovos", "How do I hire Syed?"],
          };
        }
      }

      // 5. Specific Company Deep-Dives
      if (/\bsovos\b/.test(s)) {
        const co = COMPANIES.sovos;
        state.lastEntity = { kind: "company", id: "sovos" };
        return {
          trace: `Experience Match · ${co.name}`,
          text: `At **${co.name}** (${co.role}, ${co.dates}), ${co.summary}`,
          bullets: co.bullets,
          actions: co.actions,
          followups: co.followups,
        };
      }
      if (/\b(eduleem|cubedecors|digileem)\b/.test(s)) {
        const co = COMPANIES.eduleem;
        state.lastEntity = { kind: "company", id: "eduleem" };
        return {
          trace: `Experience Match · ${co.name}`,
          text: `At **${co.name}** (${co.role}, ${co.dates}), ${co.summary}`,
          bullets: co.bullets,
          actions: co.actions,
          followups: co.followups,
        };
      }
      if (/\b(arm\s*info|arminfoserve)\b/.test(s)) {
        const co = COMPANIES.arm;
        state.lastEntity = { kind: "company", id: "arm" };
        return {
          trace: `Experience Match · ${co.name}`,
          text: `At **${co.name}** (${co.role}, ${co.dates}), ${co.summary}`,
          bullets: co.bullets,
          actions: co.actions,
          followups: co.followups,
        };
      }

      // 6. Hiring / Project Intake / Contact Intent
      if (/\b(hire|start a project|build a|need a|looking for|freelance|quote|budget|rate|pricing|contact|email|phone|call|reach|collaborat|interview|recruit|resume|cv)\b/.test(s)) {
        if (/\b(build|need|hire|project|website|app|ecommerce|redesign|brief|start)\b/.test(s) && !/\b(email|phone|call|number)\b/.test(s)) {
          state.intake = { active: true, step: 1, service: "", timeline: "", brief: "" };
          return {
            trace: "Project Scoping · Step 1/2",
            text: "I'd love to connect you with Syed! What kind of work or role are you looking for? (e.g., **React.js / Full-Stack**, **Enterprise WordPress / eCommerce**, **UI/UX & Storybook**, or **AI / Python Automation**)",
            actions: [
              { label: "Copy Email", type: "copy", value: "syedshafaiz76@gmail.com" },
              { label: "Jump to Contact Form", type: "scroll", value: "contact" },
            ],
            followups: ["React.js / Full-Stack Web App", "Enterprise WordPress / eCommerce", "Full-Time Software Engineer Role"],
          };
        }
        return {
          trace: "Contact Details",
          text: "Syed is based in **Bengaluru, India** and responds quickly to engineering roles, consulting, and product builds:",
          bullets: [
            "**Email:** syedshafaiz76@gmail.com",
            "**Phone:** +91 7019487141",
            "**Profiles:** LinkedIn & GitHub (`github.com/Marburg7`)",
          ],
          actions: [
            { label: "Copy Email", type: "copy", value: "syedshafaiz76@gmail.com" },
            { label: "Copy Phone", type: "copy", value: "+91 7019487141" },
            { label: "Start Guided Brief", type: "start-intake" },
          ],
          followups: ["Start a project brief", "Why hire Syed?", "Show his key projects"],
        };
      }

      // 7. Dynamic Skill & Role-Fit Matcher (detects any skills mentioned in user's query!)
      const matchedSkills = SKILLS_CATALOG.filter((sk) =>
        sk.aliases.some((al) => {
          const escaped = al.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(s);
        })
      );

      if (matchedSkills.length > 0 && !/\b(all projects|list projects)\b/.test(s)) {
        const names = matchedSkills.map((m) => m.name);
        return {
          trace: `Skill Match · ${matchedSkills.length} Verified from CV`,
          text:
            matchedSkills.length === 1
              ? `Yes! **${matchedSkills[0].name}** is a core part of Syed's production stack (${matchedSkills[0].cat}):`
              : `Strong match — Syed has verified production experience across **${names.join(", ")}**:`,
          bullets: matchedSkills.slice(0, 5).map((m) => `**${m.name}:** ${m.detail}.`),
          actions: [
            { label: "View Full Skills Matrix", type: "navigate", value: `${rootPrefix}tools/` },
            { label: "Inspect Sovos Platform", type: "open-case", value: "sovos" },
          ],
          followups: ["Check his Cloud & DevOps stack", "Tell me about NovaCut Studio", "Start a project brief"],
        };
      }

      // 8. Education & Certifications
      if (/\b(education|degree|college|university|vtu|kns|cgpa|puc|sslc|school|certif|certificate|ethnus|accenture)\b/.test(s)) {
        return {
          trace: "CV Credentials · Education & Certs",
          text: "Here are Syed's academic credentials and verified certifications:",
          bullets: [
            "**B.E. (2023):** Visvesvaraya Technological University — KNS Institute of Technology (**CGPA: 7.5**).",
            "**Certifications:** AWS Solutions Architect Certificate (Eduleem, Oct 2024), Ethnus Full Stack Developer (Aug 2024), Accenture North America Coding & Nordics Developer Simulations (Mar 2024).",
            "**Earlier Education:** PUC at Ramaiah Pre-University College (2019, 60%) & SSLC at Sun Shine English School (2017, 78%).",
          ],
          actions: [
            { label: "Jump to Credentials", type: "scroll", value: "credentials" },
            { label: "Full Experience & CV", type: "navigate", value: `${rootPrefix}experience/` },
          ],
          followups: ["Summarize his work experience", "Show his key projects", "Contact Syed"],
        };
      }

      // 9. Broad Experience / Summary / Why Hire
      if (/\b(experience|career|work|history|background|summary|about|years|why hire|fit|strengths|achievements|impact|metrics)\b/.test(s)) {
        return {
          trace: "CV Executive Summary",
          text: "Syed is a **React.js & Full Stack Web Developer** with **3+ years of experience** shipping enterprise web apps, UI component libraries, and high-traffic eCommerce sites:",
          bullets: [
            "**Sovos (Aug 2025 – Present):** Full Stack Web Developer managing 7+ regional multisites & 10+ eCommerce websites with React.js, TypeScript, Storybook, Jest/RTL, Docker, K8s, AWS & Azure.",
            "**Eduleem India Pvt Ltd (Dec 2023 – Aug 2025):** Shipped 20+ landing pages, fixed 100+ technical SEO issues, and delivered 5 domains each sustaining **70,000+ visitors every 15 days**.",
            "**ARM Infoserve (Sep – Nov 2023):** Built responsive WooCommerce/WordPress/PHP/Java company web platform.",
          ],
          actions: [
            { label: "Full Experience Page", type: "navigate", value: `${rootPrefix}experience/` },
            { label: "Start a Project Brief", type: "start-intake" },
          ],
          followups: ["Tell me about Sovos", "Tell me about NovaCut Studio", "Show his certifications"],
        };
      }

      // 10. Projects Overview
      if (/\b(project|projects|portfolio|built|shipped|work samples|case stud)\b/.test(s)) {
        return {
          trace: "Projects Index · 7 Shipped Builds",
          text: "Syed has **7 key projects** across open-source AI, enterprise TaxTech, EdTech, and real estate:",
          bullets: [
            "**NovaCut Studio:** Open-source AI stream-to-shorts clipper (local transcription, NLP, Gemini/OpenAI/Claude/Ollama).",
            "**Sovos Multisite & Taxapedia:** 7+ regional enterprise sites + AI-agent/SEO optimized compliance hub.",
            "**eFileMyForm & 1099pro.com:** IRS-approved cloud tax e-filing platforms (frontend + backend/API).",
            "**Eduleem.com & Royaal Mahaadeva Builders:** High-traffic EdTech & real estate flagships (70K+ biweekly visitors).",
          ],
          actions: [
            { label: "⚡ Open NovaCut Studio", type: "open-case", value: "novacut" },
            { label: "Explore All Projects", type: "navigate", value: `${rootPrefix}projects/` },
          ],
          followups: ["Tell me about NovaCut Studio", "Tell me about Taxapedia", "Check his tech stack"],
        };
      }

      // 11. General Tech Stack Overview
      if (/\b(stack|tech|skills|tools|languages|frameworks|what does he know)\b/.test(s)) {
        return {
          trace: "Full Technical Stack · 9 Domains",
          text: "Syed works across the full modern web stack:",
          bullets: [
            "**Frontend & Testing:** React.js (hooks), TypeScript, ES6+, Tailwind CSS, Storybook, Jest & React Testing Library.",
            "**Backend & Data:** PHP, Node.js, Python, FastAPI, RESTful APIs, MySQL & Alembic.",
            "**CMS, Cloud & DevOps:** WordPress, WooCommerce, Shopify, HubSpot, Docker, Kubernetes, Lando, AWS, Azure, CI/CD & YAML.",
            "**UX, MarTech & SEO:** Figma, XD, Framer, Marketo, Smartling, Infogram, Technical SEO, GA4, GTM, Core Web Vitals & WCAG.",
          ],
          actions: [
            { label: "Open Technical Skills", type: "navigate", value: `${rootPrefix}tools/` },
            { label: "Test Role Fit", type: "start-intake" },
          ],
          followups: ["Does he know Python & FastAPI?", "Tell me about Sovos", "Show certifications"],
        };
      }

      // 12. Blog / Articles
      if (/\b(blog|article|articles|thoughts|writing|posts|read)\b/.test(s)) {
        return {
          trace: "Editorial Articles · 4 Posts",
          text: "Syed writes about UI/UX for full-stack apps, building his first full-stack web app, transforming dashboards, and preparing for the future of design & AI.",
          actions: [
            { label: "Read Design Thoughts", type: "navigate", value: `${rootPrefix}blog/` },
          ],
          followups: ["Show Syed's key projects", "Summarize his experience"],
        };
      }

      // 13. Smart Conversational Fallback
      return {
        trace: "Smart Assistant · Ready to Help",
        text: `I didn't find an exact CV match for "${q}", but I can answer detailed questions about Syed's **3+ years of React.js & Full-Stack experience**, evaluate fit for specific skills (like TypeScript, FastAPI, Docker, AWS, or WordPress), walk through projects like **NovaCut Studio** or **Taxapedia**, or help you message Syed directly.`,
        actions: [
          { label: "Start a Project Brief", type: "start-intake" },
          { label: "Copy Syed's Email", type: "copy", value: "syedshafaiz76@gmail.com" },
        ],
        followups: ["Does he know React, TypeScript & AWS?", "Tell me about NovaCut Studio", "Summarize his experience"],
      };
    }

    function handleUserInput(text) {
      const cleaned = text.trim();
      if (!cleaned) return;

      const userMsg = { who: "user", text: cleaned };
      state.history.push(userMsg);
      renderMessage(userMsg);
      saveState();

      const typingEl = showTyping("Analyzing CV & portfolio...");
      const delay = reducedMotion ? 60 : 340 + Math.min(260, cleaned.length * 4);

      window.setTimeout(async () => {
        let reply = null;

        // Optional external LLM hook if configured in future (window.SYED_AGENT_ENDPOINT)
        if (typeof window.SYED_AGENT_ENDPOINT === "string" && window.SYED_AGENT_ENDPOINT) {
          try {
            const res = await fetch(window.SYED_AGENT_ENDPOINT, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: cleaned, history: state.history.slice(-8) }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data && data.text) reply = data;
            }
          } catch {
            // gracefully fall back to built-in CV agent engine
          }
        }

        if (!reply) {
          reply = generateAgentReply(cleaned);
        }

        typingEl.remove();

        const botMsg = {
          who: "bot",
          trace: reply.trace,
          text: reply.text,
          bullets: reply.bullets || [],
          actions: reply.actions || [],
        };
        state.history.push(botMsg);
        renderMessage(botMsg);
        renderPrompts(reply.followups || ["Show key projects", "Check React & AWS skills", "Hire Syed"]);
        saveState();
      }, delay);
    }

    function resetConversation() {
      state = {
        history: [],
        lastEntity: null,
        intake: { active: false, step: 0, service: "", timeline: "", brief: "" },
      };
      if (messagesEl) messagesEl.innerHTML = "";
      const welcome = {
        who: "bot",
        trace: "Portfolio Agent Online",
        text: "Hi! I'm **Syed's Portfolio Agent**. Ask me anything about his **3+ years of React.js & Full-Stack experience**, check his fit for specific skills, inspect projects like **NovaCut Studio** or **Taxapedia**, or start a project brief.",
      };
      state.history.push(welcome);
      renderMessage(welcome);
      renderPrompts([
        "Does Syed know React, TypeScript & AWS?",
        "Tell me about NovaCut Studio",
        "I want to hire Syed for a project",
      ]);
      saveState();
    }

    function toggle(force) {
      const open = typeof force === "boolean" ? force : !panel.classList.contains("is-open");
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", String(!open));
      fab.setAttribute("aria-expanded", String(open));
      if (open && input) input.focus();
    }

    // Hydrate existing session history or initialize welcome greeting
    if (state.history.length > 0) {
      if (messagesEl) messagesEl.innerHTML = "";
      state.history.forEach(renderMessage);
      renderPrompts([
        "Tell me about NovaCut Studio",
        "Check Docker, K8s & AWS skills",
        "Start a project brief",
      ]);
    } else {
      resetConversation();
    }

    fab.addEventListener("click", () => toggle());
    if (closeBtn) closeBtn.addEventListener("click", () => toggle(false));
    if (resetBtn) resetBtn.addEventListener("click", resetConversation);

    if (form && input) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = "";
        handleUserInput(text);
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("is-open")) toggle(false);
    });
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
