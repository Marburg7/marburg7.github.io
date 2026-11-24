# Syed Shahabuddin — Interactive Portfolio Website

Zero-dependency, high-craft static portfolio for **Syed Shahabuddin** (Software Engineer & UI/UX Designer), built for direct GitHub Pages hosting with an original **"Obsidian Forge & Luminous Amber"** design direction.

## Highlights

- **Atmospheric Immersion**: Interactive `<canvas>` constellation mesh with mouse parallax, floating gradient orbs, subtle fractal film grain, luminous hairline accents, and a session-aware curtain preloader.
- **Kinetic Motion & Micro-Interactions**: Character-rolling CTA buttons, scroll-aware frosted-glass navigation capsule, full-screen mobile editorial drawer, 3D-tilt portrait card, cursor-tracking spotlight cards, scroll-linked experience timeline rail, and dual-layer precision custom cursor on fine-pointer desktops.
- **Interactive Features**:
  - Domain filtering across projects and technical stack categories
  - Slide-over **Case Study Drawer** with role, timeline, highlights, tech chips, and live launch links
  - Two-step **Project Inquiry Concierge** wizard with validation, pre-filled email launch, and one-click copy email
  - Client-side **Portfolio Concierge** floating assistant answering questions about Syed's projects, stack, experience, and availability
- **Accessibility & Performance**: Semantic landmarks, skip links, keyboard `Escape` dismissal, full `prefers-reduced-motion` support, responsive fluid `clamp()` typography, and zero runtime bundle bloat.

## Structure

- `index.html` — Homepage (Hero, Kinetic Marquee, Metrics & Craft Bento, Selected Projects, Career Timeline, Technical Stack, Design Thoughts, Multi-Step Contact Concierge)
- `projects/index.html` — Filterable Projects Archive + Case Study Drawer
- `experience/index.html` — Full 5-role Career Timeline
- `tools/index.html` — Complete 14-tool Filterable Stack Matrix
- `blog/index.html` — Design & Engineering Thoughts Index
- `blog/<slug>/index.html` — 4 Full Editorial Articles with scroll reading progress
- `css/style.css` — Unified design tokens, glass/lighting layers, responsive breakpoints, and reduced-motion rules
- `js/script.js` — Modular vanilla ES6 interaction, canvas, cursor, filter, drawer, wizard, and concierge engine

## Local Preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.
