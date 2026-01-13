---
name: creative-studio-warmth
description: Design system for creative agencies and design studios with dark charcoal backgrounds and warm coral accents. Use when creating agency websites, portfolio sites, design studio pages, art director portfolios, brand identity showcases, or premium creative services landing pages. Triggers on requests for warm/dark premium aesthetics, creative agency sites, portfolio templates, or design studio themes. Based on Lovera template aesthetic. Sits between cold corporate SaaS and aggressive Neo-Brutalist—sophisticated but expressive.
---

# Creative Studio Warmth

Premium aesthetic for creative agencies and design studios. Dark, gallery-like backgrounds that make portfolio work pop, warmed by coral accents.

## Quick Start

1. Copy `assets/template.html` as starting point
2. Customize brand name, services, content
3. Replace placeholder images
4. Adjust sections based on context

## Core Aesthetic

- **Dark foundation**: Charcoal hero (#2d2f2e) creates gallery feel
- **Warm coral accent**: #ff531f for CTAs, gradient scale for process bands
- **Full-color imagery**: Unlike brutalist grayscale, work is shown in full color
- **Generous rounding**: 24-48px radius on cards, full pill buttons
- **Sliding sections**: Light content overlaps dark with rounded top corners

## Section Selection

Choose sections based on client context:

| Section | Use When |
|---------|----------|
| Hero + Watermark | Always - establishes brand |
| Client Logo Bar | Has notable clients |
| Intro with Big Number | Emphasizing transformation (0→1) |
| Bento Grid | Multiple proof points to show |
| Services (dark) | Listing service offerings |
| FAQ | Common questions exist |
| Process Bands | Want to explain methodology |
| Stats Section | Have impressive metrics |

## Critical Implementation Rules

### Bento Grid Must Be Perfect Rectangle
```css
/* CORRECT - explicit areas */
grid-template-areas:
    "testimonial stat1     casestudy"
    "testimonial process   casestudy"
    "timeline    timeline  stat2";

/* WRONG - creates holes */
.card { grid-row: span 2; }
```

### Sliding Section Overlap
```css
.content-wrapper {
    margin-top: -80px;
    border-radius: 48px 48px 0 0;
    position: relative;
    z-index: 10;
}
```

### Pill Buttons
```css
.btn-primary {
    border-radius: 9999px; /* Full pill, always */
    background: #ff531f;
}
```

## JavaScript Interactions

The template includes working JS for:
- Navigation scroll effect (background on scroll)
- FAQ accordion (click to expand)
- Process band expansion (click to show steps)
- Smooth scroll for anchor links
- Scroll-triggered animations (IntersectionObserver)

## Design Tokens

See `references/design-tokens.md` for complete color, typography, and spacing values.

Key colors:
- Dark BG: `#2d2f2e`
- Light BG: `#f5f5f5`  
- Primary CTA: `#ff531f`
- Coral gradient: `#fff0eb → #ffc8b8 → #ff9d80 → #ff531f`

## Output Checklist

Every Creative Studio Warmth design should have:
- [ ] Dark charcoal hero with watermark
- [ ] Sliding light section (rounded top corners, negative margin)
- [ ] Coral accent (#ff531f) for CTAs
- [ ] Pill-shaped buttons
- [ ] Working JavaScript interactions
- [ ] Plus Jakarta Sans / Antonio typography
- [ ] Responsive breakpoints (1024px, 768px)
