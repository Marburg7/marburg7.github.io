/**
 * Syed Shahabuddin Portfolio — Zero-Dependency Internationalization (i18n) Engine
 * Supports: English (en), German (de), Italian (it), French (fr), Hindi (hi), Arabic (ar · RTL)
 *
 * Features:
 *  - Glassmorphic accessible language switcher mounted beside "Let's Talk" across all pages
 *  - Lazy-loads only the selected language bundle from data/i18n/<lang>.json (zero overhead on default EN)
 *  - Safe DOM-node rendering for rich inline formatting (**bold** and [[ghost]] headings) with zero innerHTML injection
 *  - Dynamic Google Fonts loading for Arabic (Noto Sans Arabic) and Hindi (Noto Sans Devanagari)
 *  - Full RTL layout switching (dir="rtl"), localStorage persistence, and ?lang= URL support
 *  - Live synchronization with kinetic roll buttons, Case Study Drawer, Contact Wizard, and AI Portfolio Agent
 */
(function () {
  "use strict";

  const STORAGE_KEY = "ss_portfolio_lang_v1";
  const LANGUAGES = [
    { code: "en", short: "EN", native: "English", english: "English", dir: "ltr" },
    { code: "de", short: "DE", native: "Deutsch", english: "German", dir: "ltr" },
    { code: "it", short: "IT", native: "Italiano", english: "Italian", dir: "ltr" },
    { code: "fr", short: "FR", native: "Français", english: "French", dir: "ltr" },
    { code: "hi", short: "HI", native: "हिन्दी", english: "Hindi", dir: "ltr" },
    { code: "ar", short: "AR", native: "العربية", english: "Arabic", dir: "rtl" },
  ];
  const LANG_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));
  const EXTRA_FONTS = {
    hi: "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap",
    ar: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700&display=swap",
  };

  const bundleCache = new Map();
  let currentLang = "en";
  let currentDict = null;
  let captured = false;

  // Captured English source snapshots so switching back to English is lossless & instant
  let origTitle = "";
  let origDescription = "";
  const richTargets = [];
  const rollTargets = [];
  const textTargets = [];
  const attrTargets = [];

  function norm(str) {
    return String(str || "").replace(/\s+/g, " ").trim();
  }

  function getRootPrefix() {
    return document.body?.dataset?.root || "./";
  }

  function isValidLang(code) {
    return Boolean(code && Object.prototype.hasOwnProperty.call(LANG_MAP, code));
  }

  function detectInitialLang() {
    try {
      const params = new URLSearchParams(window.location.search);
      const q = (params.get("lang") || "").toLowerCase().trim();
      if (isValidLang(q)) {
        try {
          localStorage.setItem(STORAGE_KEY, q);
        } catch {
          // ignore storage restrictions
        }
        return q;
      }
    } catch {
      // ignore URL parsing errors
    }
    try {
      const saved = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase().trim();
      if (isValidLang(saved)) return saved;
    } catch {
      // ignore storage restrictions
    }
    return "en";
  }

  function ensureScriptFont(lang) {
    const href = EXTRA_FONTS[lang];
    if (!href) return;
    const id = `i18n-font-${lang}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function serializeRich(el) {
    const parts = [];
    el.childNodes.forEach((ch) => {
      if (ch.nodeType === Node.TEXT_NODE) {
        parts.push(ch.nodeValue || "");
      } else if (ch.nodeType === Node.ELEMENT_NODE) {
        const tag = ch.tagName.toLowerCase();
        if (tag === "strong") {
          parts.push(`**${norm(ch.textContent)}**`);
        } else if (tag === "span" && ch.classList.contains("section-title__ghost")) {
          parts.push(`[[${norm(ch.textContent)}]]`);
        } else {
          parts.push(ch.textContent || "");
        }
      }
    });
    return norm(parts.join(""));
  }

  /**
   * Safely builds DOM nodes from a translated string containing optional
   * **bold** and [[ghost]] markers without ever using innerHTML.
   */
  function renderRichSafe(el, text) {
    const frag = document.createDocumentFragment();
    const tokenRe = /(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/g;
    let lastIdx = 0;
    let match;

    while ((match = tokenRe.exec(text)) !== null) {
      if (match.index > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
      }
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        frag.appendChild(strong);
      } else if (token.startsWith("[[") && token.endsWith("]]")) {
        const ghost = document.createElement("span");
        ghost.className = "section-title__ghost";
        ghost.textContent = token.slice(2, -2);
        frag.appendChild(ghost);
      }
      lastIdx = tokenRe.lastIndex;
    }

    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    el.replaceChildren(frag);
  }

  function captureOriginalDom() {
    if (captured) return;
    captured = true;

    origTitle = norm(document.title);
    const metaDesc = document.querySelector('meta[name="description"]');
    origDescription = metaDesc ? norm(metaDesc.getAttribute("content") || "") : "";

    const capturedContainers = new Set();

    // 1. Capture rich inline blocks (**strong**, [[ghost]])
    document
      .querySelectorAll(
        "h1.subpage-hero__title, h2.section-title, p.hero__lead, .timeline-item__bullets li, .article-prose p, .article-prose li"
      )
      .forEach((el) => {
        const key = serializeRich(el);
        if (!key) return;
        richTargets.push({ el, key });
        capturedContainers.add(el);
      });

    // 2. Capture kinetic roll button labels (may already be rolled or still unrolled)
    document.querySelectorAll(".roll-btn__text").forEach((el) => {
      const orig = norm(el.dataset.i18nOrig || el.getAttribute("aria-label") || el.textContent);
      if (!orig) return;
      el.dataset.i18nOrig = orig;
      rollTargets.push({ el, orig });
      capturedContainers.add(el);
    });

    // 3. Capture translatable attributes (placeholder, data-cursor)
    document.querySelectorAll("[placeholder]").forEach((el) => {
      if (el.closest("#assistant-panel")) return;
      const orig = norm(el.getAttribute("placeholder") || "");
      if (orig) attrTargets.push({ el, attr: "placeholder", orig, bucket: "placeholders" });
    });
    document.querySelectorAll("[data-cursor]").forEach((el) => {
      const orig = norm(el.getAttribute("data-cursor") || "");
      if (orig) attrTargets.push({ el, attr: "data-cursor", orig, bucket: "cursors" });
    });

    // 4. Walk remaining leaf TextNodes in document.body
    const SKIP_SELECTOR = [
      "script",
      "style",
      "svg",
      "noscript",
      "#site-preloader",
      "#assistant-panel",
      ".lang-switcher",
      ".mobile-drawer__idx",
      ".browser-url",
      ".bento-metric__num",
      ".brand-monogram",
      ".brand__mark",
      "[data-live-clock]",
      "[data-i18n-skip]",
    ].join(",");

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest(SKIP_SELECTOR)) continue;

      let insideCaptured = false;
      let cur = parent;
      while (cur && cur !== document.body) {
        if (capturedContainers.has(cur)) {
          insideCaptured = true;
          break;
        }
        cur = cur.parentElement;
      }
      if (insideCaptured) continue;

      const raw = node.nodeValue || "";
      const cleaned = norm(raw);
      if (!cleaned) continue;

      textTargets.push({
        node,
        origRaw: raw,
        origNorm: cleaned,
        leadSpace: /^\s/.test(raw),
        trailSpace: /\s$/.test(raw),
      });
    }
  }

  async function loadBundle(lang) {
    if (lang === "en") return null;
    if (bundleCache.has(lang)) return bundleCache.get(lang);
    const url = `${getRootPrefix()}data/i18n/${encodeURIComponent(lang)}.json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load language pack (${lang}): HTTP ${res.status}`);
    }
    const data = await res.json();
    bundleCache.set(lang, data);
    return data;
  }

  function applyTranslations(lang, dict) {
    const meta = LANG_MAP[lang] || LANG_MAP.en;
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;

    ensureScriptFont(lang);

    // Document title & meta description
    if (origTitle) {
      document.title = (dict && dict.titles && dict.titles[origTitle]) || origTitle;
    }
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && origDescription) {
      metaDesc.setAttribute(
        "content",
        (dict && dict.descriptions && dict.descriptions[origDescription]) || origDescription
      );
    }

    // 1. Rich inline blocks
    for (const item of richTargets) {
      const translated = (dict && dict.rich && dict.rich[item.key]) || item.key;
      renderRichSafe(item.el, translated);
    }

    // 2. Kinetic roll buttons (rebuild cleanly; preserve Arabic/Devanagari shaping)
    for (const item of rollTargets) {
      const translated = (dict && dict.plain && dict.plain[item.orig]) || item.orig;
      item.el.dataset.rolled = "false";
      item.el.setAttribute("aria-label", translated);
      item.el.textContent = translated;
      const btn = item.el.closest(".roll-btn");
      if (btn && typeof window.__rebuildRollButton === "function") {
        window.__rebuildRollButton(btn, lang);
      }
    }

    // 3. Leaf text nodes
    for (const item of textTargets) {
      if (!dict) {
        item.node.nodeValue = item.origRaw;
        continue;
      }
      const translated = dict.plain && dict.plain[item.origNorm];
      if (translated) {
        const prefix = item.leadSpace ? " " : "";
        const suffix = item.trailSpace ? " " : "";
        item.node.nodeValue = `${prefix}${translated}${suffix}`;
      } else {
        item.node.nodeValue = item.origRaw;
      }
    }

    // 4. Attributes
    for (const item of attrTargets) {
      const translated = (dict && dict[item.bucket] && dict[item.bucket][item.orig]) || item.orig;
      item.el.setAttribute(item.attr, translated);
    }

    updateSwitcherUI(lang, dict);
    window.dispatchEvent(
      new CustomEvent("portfolio:langchange", {
        detail: { lang, dir: meta.dir, dict },
      })
    );
  }

  /* ------------------------------------------------------------------------
     Accessible Language Switcher Widget (Beside "Let's Talk" in .nav-actions)
     ------------------------------------------------------------------------ */
  function createSwitcherElement() {
    const wrap = document.createElement("div");
    wrap.className = "lang-switcher";
    wrap.setAttribute("data-lang-switcher", "");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lang-switcher__btn";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Choose website language");
    btn.setAttribute("data-lang-trigger", "");

    // Globe SVG (pure DOM creation)
    const globeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    globeSvg.setAttribute("class", "lang-switcher__globe");
    globeSvg.setAttribute("viewBox", "0 0 24 24");
    globeSvg.setAttribute("fill", "none");
    globeSvg.setAttribute("stroke", "currentColor");
    globeSvg.setAttribute("stroke-width", "1.9");
    globeSvg.setAttribute("stroke-linecap", "round");
    globeSvg.setAttribute("stroke-linejoin", "round");
    globeSvg.setAttribute("aria-hidden", "true");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "10");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "2");
    line.setAttribute("y1", "12");
    line.setAttribute("x2", "22");
    line.setAttribute("y2", "12");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
    );
    globeSvg.append(circle, line, path);

    const codeSpan = document.createElement("span");
    codeSpan.className = "lang-switcher__code";
    codeSpan.setAttribute("data-lang-current-code", "");
    codeSpan.textContent = "EN";

    const chevronSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevronSvg.setAttribute("class", "lang-switcher__chevron");
    chevronSvg.setAttribute("viewBox", "0 0 24 24");
    chevronSvg.setAttribute("fill", "none");
    chevronSvg.setAttribute("stroke", "currentColor");
    chevronSvg.setAttribute("stroke-width", "2.2");
    chevronSvg.setAttribute("stroke-linecap", "round");
    chevronSvg.setAttribute("stroke-linejoin", "round");
    chevronSvg.setAttribute("aria-hidden", "true");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute("points", "6 9 12 15 18 9");
    chevronSvg.appendChild(poly);

    btn.append(globeSvg, codeSpan, chevronSvg);

    const menu = document.createElement("ul");
    menu.className = "lang-switcher__menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", "Language selector");
    menu.setAttribute("data-lang-menu", "");

    LANGUAGES.forEach((lang) => {
      const li = document.createElement("li");
      li.setAttribute("role", "none");

      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = `lang-switcher__option${lang.code === "en" ? " is-active" : ""}`;
      opt.setAttribute("role", "option");
      opt.setAttribute("aria-selected", lang.code === "en" ? "true" : "false");
      opt.setAttribute("data-lang-option", lang.code);
      if (lang.dir === "rtl") opt.setAttribute("dir", "rtl");

      const leftWrap = document.createElement("span");
      leftWrap.className = "lang-switcher__names";
      const nativeEl = document.createElement("span");
      nativeEl.className = "lang-switcher__native";
      nativeEl.textContent = lang.native;
      const engEl = document.createElement("span");
      engEl.className = "lang-switcher__english";
      engEl.textContent = lang.english;
      leftWrap.append(nativeEl, engEl);

      const badge = document.createElement("span");
      badge.className = "lang-switcher__badge";
      badge.textContent = lang.short;

      opt.append(leftWrap, badge);
      li.appendChild(opt);
      menu.appendChild(li);
    });

    wrap.append(btn, menu);
    return wrap;
  }

  function mountSwitcher() {
    let existing = document.querySelector("[data-lang-switcher]");
    if (!existing) {
      const navActions = document.querySelector(".nav-actions");
      const fallbackHeader = document.querySelector(".site-header__inner");
      const host = navActions || fallbackHeader;
      if (!host) return;
      existing = createSwitcherElement();
      if (navActions) {
        const menuTrigger = navActions.querySelector("#menu-trigger");
        if (menuTrigger) {
          navActions.insertBefore(existing, menuTrigger);
        } else {
          navActions.appendChild(existing);
        }
      } else {
        host.appendChild(existing);
      }
    }

    wireSwitcher(existing);
  }

  function wireSwitcher(wrap) {
    if (wrap.dataset.wired === "true") return;
    wrap.dataset.wired = "true";

    const trigger = wrap.querySelector("[data-lang-trigger]");
    const menu = wrap.querySelector("[data-lang-menu]");
    const options = Array.from(wrap.querySelectorAll("[data-lang-option]"));
    if (!trigger || !menu) return;

    function setMenuOpen(open, restoreFocus = false) {
      wrap.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      if (open) {
        const active = options.find((o) => o.dataset.langOption === currentLang) || options[0];
        if (active) active.focus();
      } else if (restoreFocus) {
        trigger.focus();
      }
    }

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      setMenuOpen(!wrap.classList.contains("is-open"));
    });

    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setMenuOpen(true);
      }
    });

    options.forEach((opt, idx) => {
      opt.addEventListener("click", () => {
        const code = opt.dataset.langOption;
        setMenuOpen(false, true);
        if (code) setLanguage(code);
      });

      opt.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setMenuOpen(false, true);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          options[(idx + 1) % options.length].focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          options[(idx - 1 + options.length) % options.length].focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          options[0].focus();
        } else if (e.key === "End") {
          e.preventDefault();
          options[options.length - 1].focus();
        } else if (e.key === "Tab") {
          setMenuOpen(false, false);
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (wrap.classList.contains("is-open") && !wrap.contains(e.target)) {
        setMenuOpen(false, false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && wrap.classList.contains("is-open")) {
        setMenuOpen(false, true);
      }
    });
  }

  function updateSwitcherUI(lang, dict) {
    const meta = LANG_MAP[lang] || LANG_MAP.en;
    document.querySelectorAll("[data-lang-switcher]").forEach((wrap) => {
      const codeEl = wrap.querySelector("[data-lang-current-code]");
      const trigger = wrap.querySelector("[data-lang-trigger]");
      const menu = wrap.querySelector("[data-lang-menu]");
      if (codeEl) codeEl.textContent = meta.short;
      if (trigger) {
        trigger.setAttribute(
          "aria-label",
          (dict && dict.ui && dict.ui.langButtonAria) || "Choose website language"
        );
      }
      if (menu) {
        menu.setAttribute(
          "aria-label",
          (dict && dict.ui && dict.ui.langMenuAria) || "Language selector"
        );
      }
      wrap.querySelectorAll("[data-lang-option]").forEach((opt) => {
        const active = opt.dataset.langOption === meta.code;
        opt.classList.toggle("is-active", active);
        opt.setAttribute("aria-selected", String(active));
      });
    });
  }

  async function setLanguage(code) {
    const target = isValidLang(code) ? code : "en";
    captureOriginalDom();

    const trigger = document.querySelector("[data-lang-trigger]");
    if (trigger) trigger.classList.add("is-loading");

    try {
      const dict = await loadBundle(target);
      currentLang = target;
      currentDict = dict;
      try {
        localStorage.setItem(STORAGE_KEY, target);
      } catch {
        // ignore storage restrictions
      }
      applyTranslations(target, dict);
    } catch (err) {
      console.error("[i18n] Language switch error:", err);
    } finally {
      if (trigger) trigger.classList.remove("is-loading");
    }
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return String(template).replace(/\{(\w+)\}/g, (_, k) =>
      Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
    );
  }

  /* ------------------------------------------------------------------------
     Public Global API for js/script.js & js/agent-ui.js
     ------------------------------------------------------------------------ */
  window.PortfolioI18n = {
    languages: LANGUAGES,
    getLang: () => currentLang,
    getDir: () => (LANG_MAP[currentLang] ? LANG_MAP[currentLang].dir : "ltr"),
    isComplexScript: (lang = currentLang) => lang === "ar" || lang === "hi",
    setLang: setLanguage,
    t(englishKey, fallback) {
      const k = norm(englishKey);
      if (currentDict) {
        if (currentDict.plain && currentDict.plain[k]) return currentDict.plain[k];
        if (currentDict.ui && currentDict.ui[k]) return currentDict.ui[k];
      }
      return fallback !== undefined ? fallback : englishKey;
    },
    ui(key, fallback, vars) {
      const raw = (currentDict && currentDict.ui && currentDict.ui[key]) || fallback || key;
      return interpolate(raw, vars);
    },
    agent() {
      return (currentDict && currentDict.agent) || null;
    },
    caseStudy(id) {
      return (currentDict && currentDict.caseStudies && currentDict.caseStudies[id]) || null;
    },
  };

  function bootI18n() {
    mountSwitcher();
    captureOriginalDom();
    const initial = detectInitialLang();
    if (initial !== "en") {
      setLanguage(initial);
    } else {
      updateSwitcherUI("en", null);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootI18n);
  } else {
    bootI18n();
  }
})();
