# Flow Bridge: HTML to Webflow Conversion Specification

## Overview

This document defines the rules and specifications for converting HTML, CSS, and JavaScript into Webflow-compatible components. The conversion pipeline must handle breakpoint transformation, HTML validation, CSS routing (native vs embed), and JavaScript bundling with library support.

---

## 1. INPUT FORMAT HANDLING

### Supported Input Modes

| Mode | Description |
|------|-------------|
| Combined | Single HTML block with `<style>` and `<script>` tags inline |
| Separated | Three separate inputs: HTML, CSS, JS |

### Parsing Logic

- If combined: extract `<style>` content → CSS, extract `<script>` content → JS, remainder → HTML
- If `<style>` has `src` attribute → fetch external stylesheet
- If `<script>` has `src` attribute → detect library, map to CDN, or fetch if custom
- Handle multiple `<style>` and `<script>` blocks → concatenate in order

---

## 2. BREAKPOINT MAPPING RULES

### Webflow's Breakpoint System

| Breakpoint | Width | Cascade Direction |
|------------|-------|-------------------|
| 1920px | ≥1920px | UP |
| 1440px | ≥1440px | UP |
| 1280px | ≥1280px | UP |
| Desktop (Base) | 992px-1279px | ALL (default) |
| Tablet | ≤991px | DOWN |
| Mobile Landscape | ≤767px | DOWN |
| Mobile Portrait | ≤478px | DOWN |

### Input → Output Mapping

```
@media (min-width: 1920px)     →  1920px breakpoint
@media (min-width: 1440px)     →  1440px breakpoint
@media (min-width: 1280px)     →  1280px breakpoint
@media (min-width: 1200px)     →  1280px breakpoint (round up)
@media (min-width: 1024px)     →  Desktop base
@media (min-width: 992px)      →  Desktop base
@media (max-width: 991px)      →  Tablet
@media (max-width: 768px)      →  Tablet (treat as 991)
@media (max-width: 767px)      →  Mobile Landscape
@media (max-width: 480px)      →  Mobile Portrait (treat as 478)
@media (max-width: 479px)      →  Mobile Portrait
@media (max-width: 320px)      →  Mobile Portrait (minimum)
```

### "Close Enough" Mapping Logic

Webflow breakpoints are fixed. Input CSS will have arbitrary values. Map to nearest:

```
INPUT RANGE              →  WEBFLOW BREAKPOINT
─────────────────────────────────────────────────
min-width: 1800px+       →  1920px
min-width: 1400-1799px   →  1440px
min-width: 1200-1399px   →  1280px
min-width: 992-1199px    →  Desktop (base)
max-width: 900-1024px    →  Tablet (991px)
max-width: 768-899px     →  Tablet (991px)
max-width: 600-767px     →  Mobile Landscape (767px)
max-width: 480-599px     →  Mobile Landscape (767px)
max-width: 0-479px       →  Mobile Portrait (478px)
```

### Edge Cases

- Overlapping ranges: use the more specific breakpoint
- Non-standard values (e.g., `max-width: 850px`): round to nearest Webflow breakpoint (991px in this case)
- Container queries: extract to embed (Webflow doesn't support them natively)

### Conflict Resolution

- If input has `max-width: 800px` AND `max-width: 600px`:
  - 800px → Tablet
  - 600px → Mobile Landscape
  - Styles don't merge, each breakpoint is separate

### Non-standard Media Queries

| Input | Action |
|-------|--------|
| `@media (orientation: landscape)` | Extract to embed |
| `@media (prefers-color-scheme: dark)` | Extract to embed |
| `@media (prefers-reduced-motion)` | Extract to embed |
| `@media print` | Extract to embed |
| `@media (hover: hover)` | Extract to embed |
| `@container` | Extract to embed |

---

## 3. HTML VALIDATION RULES

### Required Checks Before Conversion

| Rule | What to Check | Action |
|------|---------------|--------|
| REM units only | Any `px` value in CSS | Convert: `px ÷ 16 = rem` |
| BEM class naming | Pattern: `block__element--modifier` | Flag non-compliant for review |
| Class-only styling | Tag selectors like `div {}`, `p {}`, `h1 {}` | Extract to embed |
| No ID selectors | Any `#id {}` | Convert to class or extract to embed |
| No descendant selectors | `.parent .child {}` | Flatten to single class or extract to embed |
| No child combinators | `.parent > .child {}` | Extract to embed |
| No sibling combinators | `.el + .el {}`, `.el ~ .el {}` | Extract to embed |
| Simple selectors only | Compound like `.class1.class2 {}` | Split or extract to embed |
| No heavy utility classes | Tailwind-style `mt-4`, `flex`, `px-2` | Consolidate into semantic BEM classes |
| No complex pseudo-selectors | `::before`, `::after`, `:nth-child()` | Extract to embed |

### HTML Element Handling

| Element Type | Action |
|--------------|--------|
| Semantic HTML5 (`nav`, `section`, `header`, `footer`, `main`, `article`, `aside`, `figure`, `figcaption`) | Keep as-is |
| Custom elements / web components | Convert to `div` with class |
| Inline styles | Extract to class |
| ID attributes (for styling) | Convert to class |
| ID attributes (for anchors/JS) | Keep |
| `data-*` attributes | Keep only if needed for JS functionality |
| Comments | Strip |
| Nested forms | Reject/flag error |
| Images without `alt` | Flag warning |

---

## 4. CSS: NATIVE vs EMBED

### CSS Webflow Supports Natively

Use these in Webflow styles (not embed):

#### Layout
- `display` (block, flex, grid, inline, inline-block, none)
- `position` (static, relative, absolute, fixed, sticky)
- `top`, `right`, `bottom`, `left`
- `z-index`
- `float`, `clear`
- `overflow`, `overflow-x`, `overflow-y`
- `visibility`

#### Box Model
- `width`, `height`
- `min-width`, `max-width`, `min-height`, `max-height`
- `margin` (all sides)
- `padding` (all sides)
- `box-sizing`

#### Flexbox
- `flex-direction`
- `flex-wrap`
- `justify-content`
- `align-items`
- `align-content`
- `align-self`
- `flex-grow`, `flex-shrink`, `flex-basis`
- `gap`, `row-gap`, `column-gap`
- `order`

#### Grid
- `grid-template-columns`
- `grid-template-rows`
- `grid-column`, `grid-row`
- `grid-gap` / `gap`
- `grid-auto-flow`
- `justify-items`, `align-items`
- `justify-self`, `align-self`

#### Typography
- `font-family`
- `font-size`
- `font-weight`
- `font-style`
- `line-height`
- `letter-spacing`
- `text-align`
- `text-decoration`
- `text-transform`
- `text-indent`
- `white-space`
- `word-break`
- `word-spacing`
- `color`

#### Background
- `background-color`
- `background-image`
- `background-position`
- `background-size`
- `background-repeat`
- `background-attachment`

#### Border
- `border` (all sides, width, style, color)
- `border-radius`
- `outline`

#### Effects
- `box-shadow`
- `opacity`
- `filter` (blur, brightness, contrast, grayscale, hue-rotate, invert, saturate, sepia)
- `mix-blend-mode`

#### Transform
- `transform` (translate, rotate, scale, skew)
- `transform-origin`
- `perspective`
- `perspective-origin`

#### Transition
- `transition` (property, duration, timing-function, delay)

#### Other
- `cursor`
- `pointer-events`
- `user-select`
- `object-fit`
- `object-position`
- `list-style`, `list-style-type`, `list-style-position`
- `vertical-align`
- `table-layout`
- `border-collapse`
- `border-spacing`

### Native State Support

These states MUST be set natively in Webflow, not embed:

| Feature | Webflow Native Support |
|---------|------------------------|
| Hover states | Yes - via pseudo-class selector in style panel |
| Focus states | Yes - via pseudo-class selector |
| Pressed/Active states | Yes - via pseudo-class selector |
| Visited states | Yes - via pseudo-class selector (links) |
| Font sizes | Yes |
| Font weights | Yes |
| Drop shadows / box-shadow | Yes |
| Text shadows | Yes |
| Clipping (overflow: hidden) | Yes |
| Border radius | Yes |
| Opacity | Yes |
| Transforms (translate, rotate, scale, skew) | Yes |
| Transitions | Yes |
| Filters (blur, brightness, etc.) | Yes |
| Gradients (linear, radial) | Yes - as background |

### State Mapping

```
:hover      →  Webflow "Hover" state
:focus      →  Webflow "Focused" state  
:active     →  Webflow "Pressed" state
:visited    →  Webflow "Visited" state (links only)
::placeholder → Webflow "Placeholder" state (inputs only)
```

### CSS That MUST Go to Embed

#### Animations
```css
@keyframes anyAnimation { }
animation: name duration timing;
animation-*
```

#### Pseudo-elements
```css
::before
::after
::placeholder
::selection
::first-letter
::first-line
```

#### Complex Pseudo-classes
```css
:nth-child()
:nth-of-type()
:nth-last-child()
:nth-last-of-type()
:first-of-type
:last-of-type
:only-child
:only-of-type
:not()
:has()
:where()
:is()
:empty
:target
:focus-within
:focus-visible
```

#### Selectors
```css
/* Descendant */
.parent .child { }

/* Child combinator */
.parent > .child { }

/* Adjacent sibling */
.el + .el { }

/* General sibling */
.el ~ .el { }

/* Attribute selectors */
[data-attribute] { }
[data-attribute="value"] { }
input[type="text"] { }

/* Compound selectors */
.class1.class2 { }
```

#### At-rules
```css
@keyframes
@font-face
@supports
@container
```

#### Variables
```css
:root { --custom-property: value; }
var(--custom-property)
```

#### Vendor Prefixes
```css
-webkit-*
-moz-*
-ms-*
```

#### Properties with Limited Support
```css
backdrop-filter
scroll-snap-type
scroll-snap-align
scroll-behavior
writing-mode
text-orientation
clip-path (complex values like polygon)
mask-image
mask-size
counter-reset
counter-increment
content: counter()
aspect-ratio (check - may be native now)
```

---

## 5. SMART CSS ROUTING

### Decision Tree Summary

| Selector Pattern | Destination |
|------------------|-------------|
| `.class` | Native |
| `.class:hover`, `.class:focus`, `.class:active` | Native (state) |
| `.class::before`, `.class::after` | Embed |
| `.class:nth-child()`, `.class:not()` | Embed |
| `.parent .child` | Embed |
| `.parent > .child` | Embed |
| `#id` | Embed |
| `div`, `p`, `h1` (tag selectors) | Embed |
| `.class1.class2` | Embed |
| `[attribute]` | Embed |

---

## 6. DATA ATTRIBUTES & ID PRESERVATION

### Must Preserve for JS Functionality

| Attribute Type | Example | Purpose |
|----------------|---------|---------|
| `id` | `id="hero-canvas"` | JS targeting, anchor links |
| `data-*` | `data-scroll`, `data-speed="0.5"` | Library hooks, custom JS |
| `aria-*` | `aria-label`, `aria-hidden` | Accessibility |
| `role` | `role="button"` | Accessibility |
| `tabindex` | `tabindex="0"` | Keyboard navigation |
| `name` | `name="email"` | Form fields |
| `for` | `for="input-id"` | Label association |

### Detection Logic

1. Scan JS for `getElementById()`, `querySelector()` references
2. Scan JS for `dataset.` property access
3. Scan JS for `getAttribute('data-')` calls
4. Cross-reference with HTML attributes
5. Flag any ID/data-attribute in JS that doesn't exist in HTML (orphan reference warning)

### Webflow Mapping

- `id` → Webflow element settings ID field
- `data-*` → Webflow custom attributes
- Classes referenced in JS → preserve exact class names, don't rename

---

## 7. JAVASCRIPT EMBED RULES

### All JavaScript goes into an embed block.

### Library Detection & CDN Sources

| Library | Detection Pattern | CDN URL |
|---------|-------------------|---------|
| GSAP Core | `gsap.`, `TweenMax`, `TweenLite` | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js` |
| ScrollTrigger | `ScrollTrigger` | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js` |
| ScrollSmoother | `ScrollSmoother` | Club GreenSock (paid - flag warning) |
| SplitText | `SplitText` | Club GreenSock (paid - flag warning) |
| Flip | `Flip` | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js` |
| Draggable | `Draggable` | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Draggable.min.js` |
| MotionPath | `MotionPathPlugin` | `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js` |
| Lenis | `Lenis`, `lenis` | `https://unpkg.com/@studio-freight/lenis@latest/dist/lenis.min.js` |
| Barba.js | `barba.`, `Barba` | `https://unpkg.com/@barba/core` |
| Swiper | `Swiper`, `swiper` | `https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js` |
| Split Type | `SplitType` | `https://unpkg.com/split-type` |
| Matter.js | `Matter.` | `https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js` |
| Three.js | `THREE.` | `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js` |
| Locomotive Scroll | `LocomotiveScroll` | `https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js` |
| Anime.js | `anime(`, `anime.` | `https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js` |
| Intersection Observer Polyfill | `IntersectionObserver` | Usually native, no CDN needed |

### Embed Structure Requirements

- Load dependencies before component code executes
- Wrap component code in DOMContentLoaded or equivalent
- Use IIFE to avoid global scope pollution
- Include CSS for libraries that need it (Swiper, Locomotive, etc.)

### Related CSS CDNs (when JS library needs styles)

| Library | CSS CDN |
|---------|---------|
| Swiper | `https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css` |
| Locomotive Scroll | `https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css` |

---

## 8. EXTERNAL LIBRARY SUPPORT

### Canvas/WebGL Setup

When detecting Three.js, Matter.js, or similar:

| Library | Required Setup |
|---------|----------------|
| Three.js | `<canvas id="...">` with correct ID matching JS, container div for sizing |
| Matter.js | `<canvas>` or container div depending on render mode |
| P5.js | Container div with ID, canvas auto-created |
| Lottie | Container div with ID, JSON animation reference |
| GSAP | No special elements, just correct class/ID references |

### Library Detection & Handling

```
1. Parse <script src="..."> tags
2. Identify library from URL pattern or filename
3. Map to known CDN (see Section 7)
4. If unknown external script:
   - Flag warning: "Unknown external script: {url}"
   - Include as-is in embed
5. If inline script:
   - Scan for library global objects (THREE, Matter, gsap, etc.)
   - Add required CDN dependencies
```

### Canvas Element Handling

```
IF script references canvas by ID:
  → Create HTML embed with <canvas id="...">
  → Set container div with proper sizing classes
  → Canvas cannot be native Webflow element - must be embed

IF script creates canvas dynamically:
  → Create container div with ID
  → JS will append canvas on init
```

---

## 9. ASSET MANAGEMENT

### Image Handling

| Image Source | Action |
|--------------|--------|
| `<img src="https://...">` | Keep URL reference |
| `<img src="data:image/...">` | Convert to file, upload to Webflow assets, replace with asset URL |
| `<img src="./local/path.jpg">` | Flag warning: local path won't work, require user upload |
| `background-image: url(...)` | Same logic as above |
| `<source>` in `<picture>` | Handle each source URL |
| SVG inline | Keep as HTML embed or convert to Webflow SVG element |
| SVG as `<img>` | Keep URL reference |

### Asset Extraction

1. Find all image references in HTML and CSS
2. For each reference:
   - If absolute URL (https://): keep as-is
   - If data URI: decode, generate filename, flag for upload
   - If relative path: flag error, require user action
3. Generate asset manifest for user review

### Font Handling

| Font Source | Action |
|-------------|--------|
| Google Fonts `<link>` | Extract font family, add to Webflow fonts or embed |
| `@font-face` in CSS | Move to embed, preserve full declaration |
| Adobe Fonts / Typekit | Keep embed code as-is |
| Local font files | Flag warning: requires manual upload to Webflow |

---

## 10. UNIT CONVERSION

### PX to REM Conversion

Base: `16px = 1rem`

| Input | Output |
|-------|--------|
| `16px` | `1rem` |
| `32px` | `2rem` |
| `8px` | `0.5rem` |
| `14px` | `0.875rem` |
| `18px` | `1.125rem` |
| `24px` | `1.5rem` |

### Conversion Rules

- Font sizes: always convert to REM
- Padding/margin: convert to REM
- Border-width: keep PX (1px borders are intentional)
- Border-radius: convert to REM
- Box-shadow spread/blur: convert to REM
- Line-height: if unitless, keep; if PX, convert to REM or unitless ratio
- Letter-spacing: convert to EM (relative to font size)
- Width/height: convert to REM unless % or vw/vh

### Do NOT Convert

- `1px` borders (intentional pixel-perfect)
- Media query values (keep as PX)
- Box-shadow offsets when small (1-2px)
- Transform values in animations (keep as-is)

---

## 11. VALIDATION & ERROR HANDLING

### Pre-flight Checks

Before generating output, validate:

1. **Duplicate UUIDs** - Each node must have unique ID
2. **Orphan references** - All ID/class references in JS must exist in HTML
3. **Circular dependencies** - No circular class/style references
4. **CSS syntax** - Valid CSS in all embed blocks
5. **Embed size** - Warn if embed >10k characters

### Error Severity Levels

| Level | Action |
|-------|--------|
| **FATAL** | Block conversion, require fix (nested forms, invalid HTML structure) |
| **ERROR** | Block conversion, show specific issue (orphan JS references) |
| **WARNING** | Allow conversion, flag for review (local image paths, unknown libraries) |
| **INFO** | Log only (unit conversions made, breakpoint mappings) |

### Recovery Strategies

- If CSS parsing fails on one rule: skip rule, log error, continue
- If JS parsing fails: include raw JS in embed, log warning
- If image URL fails: keep reference, flag warning
- If breakpoint mapping ambiguous: use nearest match, log info

---

## 12. CORE FUNCTIONALITY CHECKLIST

### Must Support

- [x] Code Conversion: HTML, CSS, JS → native Webflow elements
- [x] Clipboard Integration: Output copies to clipboard, paste into Webflow
- [x] Multiple Input Formats: Combined (inline style/script) or separated tabs
- [x] Native Styling: Set as much as possible natively (hover, fonts, shadows, clipping)
- [x] Smart CSS Mapping: Route to native or embed based on selector complexity
- [x] Breakpoint Alignment: Map media queries to Webflow breakpoints
- [x] Unit Conversion: PX → REM
- [x] Interaction Preservation: Keep data attributes and IDs for JS
- [x] External Library Support: Detect and include CDN dependencies
- [x] Asset Management: Handle images in HTML and CSS
- [x] AI Class Renaming: Semantic BEM naming with namespace prefix to prevent collisions

---

## 13. AI-ASSISTED CLASS RENAMING

### Problem

| Issue | Example |
|-------|---------|
| AI garbage names | `.div-block-47`, `.text-wrapper-3`, `.flex-container` |
| Generic names | `.container`, `.wrapper`, `.button`, `.header` |
| Webflow collision | You paste `.hero`, Webflow already has `.hero` → styles merge/conflict |

### Solution

During import, Claude Sonnet 4 analyzes the HTML structure and:

1. **Infers component purpose** from context (tag hierarchy, content, attributes)
2. **Generates semantic BEM names** following `block__element--modifier`
3. **Adds namespace prefix** to prevent Webflow collisions

### Renaming Example

**Input:**
```html
<div class="div-block-47">
  <h1 class="heading-large">Welcome</h1>
  <p class="text-wrapper-3">Some description</p>
  <a class="link-block" href="#">Learn More</a>
</div>
```

**Output (with namespace `fb-` for Flow Bridge):**
```html
<div class="fb-hero">
  <h1 class="fb-hero__heading">Welcome</h1>
  <p class="fb-hero__description">Some description</p>
  <a class="fb-hero__cta" href="#">Learn More</a>
</div>
```

### Namespace Strategy

| Option | Format | Example |
|--------|--------|---------|
| Default prefix | `fb-{block}` | `fb-hero`, `fb-navbar` |
| Custom prefix | `{user-prefix}-{block}` | `acme-hero`, `proj-navbar` |
| Hash suffix | `{block}-{hash}` | `hero-x7f2`, `navbar-k9m1` |
| Template name | `{template}-{block}` | `landingv2-hero` |

User should be able to configure this in settings.

### Class Mapping Table

Claude must maintain a mapping during conversion:

```
ORIGINAL           →  RENAMED
─────────────────────────────────
.div-block-47      →  .fb-hero
.heading-large     →  .fb-hero__heading
.text-wrapper-3    →  .fb-hero__description
.link-block        →  .fb-hero__cta
```

This mapping is applied to:
- HTML class attributes
- CSS selectors (native and embed)
- JavaScript class references (querySelector, classList, etc.)

### AI Context Analysis

Claude should infer block names from:

| Signal | Inference |
|--------|-----------|
| `<nav>` element | `navbar`, `nav` |
| `<header>` element | `header`, `site-header` |
| `<footer>` element | `footer`, `site-footer` |
| `<section>` with hero-like content | `hero` |
| `<section>` with testimonials | `testimonials` |
| `<form>` element | `form`, `contact-form` |
| Content keywords (pricing, features, team) | Corresponding block name |
| Existing class hints (`hero-*`, `nav-*`) | Use as block name base |

### Element Naming Convention

| Element Role | BEM Element Name |
|--------------|------------------|
| Main heading (h1, h2) | `__heading`, `__title` |
| Subheading | `__subheading`, `__subtitle` |
| Paragraph text | `__description`, `__text`, `__copy` |
| Primary CTA button | `__cta`, `__button` |
| Secondary button | `__button--secondary` |
| Image | `__image`, `__media` |
| Background image | `__background` |
| Container/wrapper | `__container`, `__wrapper` |
| List | `__list` |
| List item | `__item` |
| Card | `__card` |
| Icon | `__icon` |
| Link | `__link` |
| Input field | `__input`, `__field` |
| Label | `__label` |

### Modifier Detection

Claude should detect state/variant modifiers:

| Pattern | Modifier |
|---------|----------|
| `-dark`, `-light` | `--dark`, `--light` |
| `-large`, `-small`, `-xl` | `--large`, `--small`, `--xl` |
| `-primary`, `-secondary` | `--primary`, `--secondary` |
| `-active`, `-disabled` | `--active`, `--disabled` |
| `-mobile`, `-desktop` | `--mobile`, `--desktop` |
| Color variants | `--blue`, `--red`, etc. |

### JavaScript Reference Updating

Critical: If JS references old class names, they must be updated.

**Scan for:**
```javascript
// querySelector patterns
document.querySelector('.div-block-47')
document.querySelectorAll('.text-wrapper-3')
element.closest('.link-block')

// classList patterns  
element.classList.add('active')
element.classList.remove('heading-large')
element.classList.toggle('visible')
element.classList.contains('div-block-47')

// className patterns
element.className = 'div-block-47'
if (element.className === 'link-block')
```

**Replace with renamed classes using the mapping table.**

### Collision Detection

Before finalizing names, check for potential Webflow collisions.

**High-risk generic names (always namespace):**
- `.container`, `.wrapper`, `.section`
- `.button`, `.btn`, `.link`
- `.header`, `.footer`, `.nav`, `.navbar`
- `.hero`, `.cta`
- `.card`, `.grid`, `.flex`
- `.title`, `.heading`, `.text`
- `.image`, `.img`, `.icon`
- `.form`, `.input`, `.label`
- `.list`, `.item`
- `.active`, `.visible`, `.hidden`
- `.w-*` (Webflow's own prefix - **never use**)

### User Controls

Allow user to configure:

| Setting | Options |
|---------|---------|
| Namespace prefix | Custom string, default `fb-` |
| Enable/disable renaming | Boolean |
| Preserve specific classes | Whitelist array |
| Naming style | `kebab-case`, `camelCase`, `snake_case` |

### Output: Class Mapping Report

After conversion, show user the mapping:

```
CLASS RENAMING REPORT
═══════════════════════════════════════

Component: Hero Section
Namespace: fb-

ORIGINAL              →  RENAMED
──────────────────────────────────────
.div-block-47         →  .fb-hero
.heading-large        →  .fb-hero__heading
.text-wrapper-3       →  .fb-hero__description  
.link-block           →  .fb-hero__cta
.link-block:hover     →  .fb-hero__cta:hover

CSS rules updated: 12
JS references updated: 3
```

---

## Appendix: Quick Reference

### Breakpoint Cheat Sheet

```
1920px+     → 1920 breakpoint (cascade UP)
1440-1919px → 1440 breakpoint (cascade UP)
1280-1439px → 1280 breakpoint (cascade UP)
992-1279px  → Desktop BASE
≤991px      → Tablet (cascade DOWN)
≤767px      → Mobile Landscape (cascade DOWN)
≤478px      → Mobile Portrait (cascade DOWN)
```

### CSS Routing Cheat Sheet

```
.class              → NATIVE
.class:hover        → NATIVE (state)
.class::before      → EMBED
.parent .child      → EMBED
#id                 → EMBED
div, p, h1          → EMBED
[data-*]            → EMBED
@keyframes          → EMBED
```

### Unit Conversion Cheat Sheet

```
px ÷ 16 = rem
Keep 1px borders as px
Keep media query values as px
```

### Class Renaming Cheat Sheet

```
AI garbage class    →  Semantic BEM + namespace
.div-block-47       →  .fb-hero
.heading-large      →  .fb-hero__heading
.text-wrapper-3     →  .fb-hero__description

Always namespace high-risk names:
.container, .wrapper, .button, .header, .hero, .card, etc.

Never use .w-* prefix (Webflow reserved)
```
