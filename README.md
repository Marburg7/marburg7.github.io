# Syed Shahabuddin — Portfolio Website

Static portfolio website for **Syed Shahabuddin** (Software Engineer & UI/UX Designer), faithfully rebuilt from the live Framer portfolio (`https://syedshahabuddin.framer.website/`) for direct deployment on GitHub Pages.

## Structure

- `index.html` — Homepage (Hero, Metrics, Skill Cards, Projects, Experience, Tools, Thoughts, Contact)
- `projects/index.html` — All Projects
- `experience/index.html` — Complete Work & Internship Experience
- `tools/index.html` — Complete Tools & Technology Stack
- `blog/index.html` — Design & Engineering Thoughts listing
- `blog/<slug>/index.html` — Full blog articles (4 posts)
- `css/style.css` — Design tokens, layout, animations, and responsive breakpoints (`1440px`, `1080px`, `810px`, `390px`)
- `js/script.js` — Scroll-triggered reveals (`IntersectionObserver` with `prefers-reduced-motion` support) and contact form validation/submission
- `assets/images/` & `assets/svg/` — Original portfolio imagery and decorative vector artwork

## Local Preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.
