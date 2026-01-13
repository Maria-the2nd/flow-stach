---
name: warm-serene-luxury
description: Design system for warm, approachable luxury interfaces with bold sans-serif typography and minimal color palettes. Use when creating boutique hotel sites, interior design studios, wellness/spa brands, high-end lifestyle products, photography studios, creative retreats, SaaS products, or any "quiet luxury" aesthetic. Triggers on requests for warm minimalist design, serene luxury, Scandinavian-meets-Mediterranean aesthetic, bold uppercase headlines, hospitality sites, or premium service landing pages. Characterized by Antonio headlines, Onest body text, numbered items (01), (02), vivid gradients for imagery placeholders.
---

# Warm Serene Luxury

Premium aesthetic for hospitality, lifestyle, creative service brands, and modern SaaS. Warmth comes from vivid gradient imagery or carefully selected photography — the base palette is intentionally minimal (#FAFAFA / #1A1A1A) so visuals become the color story.

## Quick Start

1. Copy `assets/template.html` as starting point
2. Replace brand name, services, content
3. Swap placeholder gradients for warm, natural-light photography OR keep vivid gradients for a modern tech feel
4. Adjust sections based on context

## Core Aesthetic

- **Near-white background**: #FAFAFA creates calm canvas
- **Typography contrast**: Antonio (display, bold sans) + Onest (body)
- **Numbered items**: (01), (02), (03) adds sophistication
- **Vivid gradients OR imagery-driven warmth**: Purple, pink, teal, coral gradients for placeholders
- **Generous whitespace**: 88px section gaps
- **Pill buttons**: Full border-radius CTAs

## Signature Patterns

| Pattern | Example | Usage |
|---------|---------|-------|
| Numbered items | `(01)` | Room cards, tabs, navigation |
| Section labels | Sans uppercase above headline | Every section header |
| Stats row | Large number + small label | Social proof, metrics |
| Spec grids | Value + label pairs | Room/product details |
| Link counts | `Features (16)` | Navigation sophistication |
| Tab selector | Room/Space picker in hero | Service selection |

## Section Selection

| Section | Use When |
|---------|----------|
| Hero + Tabs | Always — establishes brand + offerings |
| Product Cards | Highlighting primary offering |
| Info Cards Row | Hours, location, booking info |
| About + Stats | Building credibility |
| Full-Width Image | Breaking up text, showing space |
| Item Cards | Multiple rooms/services/products |
| CTA Banner | Driving conversions mid-page |
| Features Grid | Listing amenities/services |
| Gallery | Showcasing environment/work |
| Testimonials | Social proof |
| Pricing | Always for SaaS/products |
| FAQ | Common questions |
| Contact | Always — clear next step |
| Footer | Always — navigation + info |

## Critical Rules

### Typography Hierarchy
```css
.display { /* Headlines */
  font-family: "Antonio", sans-serif;
  font-size: 96px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: -0.02em;
  line-height: 0.95;
}

.section-label { /* Labels ABOVE headlines */
  font-family: "Antonio", sans-serif;
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

body { /* Everything else */
  font-family: "Onest", sans-serif;
  font-size: 18px;
  font-weight: 400;
}
```

### Google Fonts Import
```html
<link href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;500;600;700&family=Onest:wght@300;400;500&display=swap" rel="stylesheet">
```

### Numbered Pattern
```html
<span class="room-number">(01)</span>
<span class="tab-number">(02)</span>
<!-- Always parentheses, always zero-padded -->
```

### Pill Buttons
```css
.btn {
  border-radius: 9999px; /* Full pill, always */
  padding: 14px 28px;
  font-family: "Onest", sans-serif;
  font-size: 16px;
  font-weight: 500;
}

.btn-primary {
  background: #1A1A1A;
  color: #FAFAFA;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(26, 26, 26, 0.2);
}
```

### Vivid Gradient Palette
```css
/* Use these for card backgrounds, avatars, image placeholders */
--gradient-purple: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
--gradient-pink: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
--gradient-cyan: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
--gradient-green: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
--gradient-coral: linear-gradient(135deg, #ff531f 0%, #f093fb 100%);
```

## Responsive Navigation

The nav MUST work across all breakpoints with a hamburger menu:

```css
/* Desktop (≥992px): full nav links visible */
/* Tablet/Mobile (≤991px): hamburger menu, hide nav links and CTA */

.nav-toggle {
  display: none; /* Hidden on desktop */
  flex-direction: column;
  gap: 5px;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
}

.nav-toggle span {
  display: block;
  width: 100%;
  height: 2px;
  background: #1A1A1A;
  transition: all 0.3s ease;
}

@media screen and (max-width: 991px) {
  .nav-links { display: none; }
  .nav-toggle { display: flex; }
  .nav-cta { display: none; }
}

/* Mobile menu */
.nav-mobile {
  display: none;
  position: fixed;
  top: 65px;
  left: 0;
  right: 0;
  background: #FAFAFA;
  border-bottom: 1px solid rgba(26, 26, 26, 0.1);
  padding: 24px;
  flex-direction: column;
  gap: 16px;
  z-index: 99;
}

.nav-mobile.active {
  display: flex;
}
```

### JavaScript for Mobile Menu
```javascript
const navToggle = document.getElementById('navToggle');
const navMobile = document.getElementById('navMobile');

navToggle.addEventListener('click', () => {
  navToggle.classList.toggle('active');
  navMobile.classList.toggle('active');
});

// Close on link click
navMobile.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    navToggle.classList.remove('active');
    navMobile.classList.remove('active');
  });
});
```

## Micro-Interactions

The template includes JS for:
- Mobile nav hamburger toggle
- Scroll-triggered fade-in animations
- Staggered children reveal (80ms delay)
- Counter animation for stats
- Image scale on hover (1.05×)
- Nav background solidifies on scroll
- Button lift + shadow on hover
- FAQ accordion
- Tab selector
- `prefers-reduced-motion` respected

## Design Tokens

See `references/design-tokens.md` for complete values.

Key tokens:
- Light: `#FAFAFA`
- Dark: `#1A1A1A`
- Opacity variants: 75%, 65%, 40%, 10%, 5%, 3%
- Section padding: `88px`
- Grid gap: `40px`
- Container max: `1456px`

## Component Patterns

See `references/component-patterns.md` for HTML structures of all components.

## Output Checklist

Every Warm Serene Luxury design should have:
- [ ] #FAFAFA background with #1A1A1A text
- [ ] Antonio for headlines/labels (font-weight: 500-600)
- [ ] Onest for body text
- [ ] Numbered items pattern (01), (02)
- [ ] Section labels above headlines
- [ ] Pill-shaped buttons (border-radius: 9999px)
- [ ] Stats row with large numbers
- [ ] Spec grids for details
- [ ] Vivid gradients OR warm imagery
- [ ] 88px section gaps
- [ ] Working mobile hamburger nav (≤991px breakpoint)
- [ ] Responsive breakpoints (1199px, 991px, 767px, 479px)
- [ ] FAQ accordion with numbered items
- [ ] Footer with 4-column grid
