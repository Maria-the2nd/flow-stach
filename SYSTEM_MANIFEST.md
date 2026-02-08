# SYSTEM MANIFEST — Aligned with AUTHORITATIVE_CURRENT_STATE (2026-02-07)

This manifest is aligned with `AUTHORITATIVE_CURRENT_STATE.md` and reflects the current system behavior. If there is any conflict, defer to `AUTHORITATIVE_CURRENT_STATE.md`.

---

## Active Pages (Current System)

**Public:**
- `/` → redirects to `/explore`
- `/explore` — Marketplace catalog (Templates, Components, Tools)
- `/sign-in`, `/sign-up` — Authentication
- `/extension` — Chrome extension instructions
- `/flow-bridge` → redirects to `/explore`

**Authenticated Workspace:**
- `/workspace/projects` — User imports list
- `/workspace/projects/[id]` — Project detail
- `/workspace/import` — HTML import tool
- `/workspace/library` — Owned templates (mock UI)
- `/workspace/components` — Owned components (mock UI)
- `/account` — Account settings

**Authenticated Internal/Legacy:**
- `/assets/[slug]` — Asset detail (requires auth; not in primary navigation)
- `/assets` → redirects to `/workspace/projects`
- `/admin/*` — Internal tools only (not part of the primary user journey)

---

## 1. Project Vision
Flow Bridge is a web application for people who want access to high-quality templates, components, and tools that accelerate design and development in the age of AI. The system bridges fast AI outputs and precise refinement by providing reusable assets and tools that bring work into Webflow for fine-tuning.

It serves two user-facing purposes:
1) **HTML to Webflow Tool** — Imports a single HTML file and converts it to a Webflow-pasteable payload. The output is a single hidden `<div>` (class: `delete-me`, display: none) containing all styles. After pasting, delete this wrapper div.
2) **Marketplace Catalog** — Templates, components, and tools (currently mock/static data in the UI).

---

## 2. Information Architecture (Routing)

### Public Area (Guest)
- `/explore` — Marketplace catalog (Templates, Components, Tools)
- `/sign-in` / `/sign-up` — Authentication

### Workspace (Authenticated User)
- `/workspace/projects` — Imported projects list
  - `/workspace/projects/[id]` — Project detail view with tabs:
    - `Overview` — Summary and font checklist
    - `Site` — Webflow payload copy (single hidden div with all styles)
    - `Images` — Extracted images
    - `Embeds` — CSS/JS embeds and external libraries
- `/workspace/library` — Owned templates (mock UI)
- `/workspace/components` — Owned components (mock UI)
- `/workspace/import` — HTML import tool

---

## 3. UI Navigation Logic (Header & Sidebar)

### Global Header
- **Workspace** → `/workspace/projects`
- **Import** → `/workspace/import`
- **Explore** → `/explore`

### Workspace Sidebar
- **Projects** → `/workspace/projects`
- **Templates** → `/workspace/library`
- **Components** → `/workspace/components`

*The Import page is not in the sidebar; it is accessed via the Import CTA in Projects.*

---

## 4. Data Model (Convex)

### User Imports
- `importProjects` — User-owned projects (name, slug, tokens, fonts, images, ownership)
- `importArtifacts` — Extracted artifacts (tokens_json, tokens_css, styles_css, clean_html, js_hooks, external_scripts)

### Marketplace Library
- `templates` — Marketplace templates
- `assets` — Marketplace components and tokens
- `payloads` — Webflow JSON, CSS/JS embeds, and metadata for assets

---

## 5. Naming Guardrails (Prevent Confusion)
- **Marketplace Templates/Components** — Public catalog or owned library items.
- **Imported Projects** — User-owned HTML imports.
- **Extracted Components** — Components derived from an import project.
- **Style Guide (Design Tokens)** — Single term for token UI + Webflow copy payload.
- **Site Structure Payload** — Full layout with base layout styles only; excludes Style Guide and Embed styles.

---

## 6. Technical Source of Truth

### Clipboard System (`lib/clipboard.ts`)
- Use `copyToWebflowClipboard` for Webflow JSON.
- Use `copyCodeToClipboard` for raw code.

### Project Ownership
- Every `importProject` has a `userId` matching the Clerk ID.

### Styling System
- **Design Aesthetic**: Premium, modern, glassmorphic
- **Styling**: Tailwind CSS + Framer Motion
- **Typography**: Plus Jakarta Sans (sans), Antonio (display), Geist Mono (mono)

### HTML to Webflow Conversion Pipeline

Orchestrated by `lib/project-engine.ts`. Key pipeline files:

| File | Role |
|------|------|
| `lib/css-embed-router.ts` | Two-phase CSS routing (hard-blockers → full), CSS variable resolution |
| `lib/webflow-normalizer.ts` | HTML/CSS rewriting to class-only selectors, nth-child→BEM, typography injection |
| `lib/webflow-literalizer.ts` | CSS variable resolution, unsupported construct stripping |
| `lib/css-parser.ts` | CSS→ClassIndex parsing, modifier class creation, media query bucketing |
| `lib/webflow-converter.ts` | ClassIndex→Webflow JSON, ancestor class tracking, UUID style IDs |
| `audit/diff/smart-analyzer.ts` | CSS preservation analysis for audit pipeline |

Pipeline flow:
```
extractCleanHtml → routeCSS(hard-blockers) → normalizeHtmlCssForWebflow
→ routeCSS(full) → literalizeCssForWebflow → parseCSS → buildPayloads
```

Key patterns:
- **Two-phase routing**: Hard-blockers (pseudo-elements, @keyframes, vendor prefixes) routed to embed first; full phase routes remaining non-native rules after normalization.
- **Modifier classes**: Descendant selectors like `.hero h1` create `hero-h1` modifier class. Parser creates the class; converter injects it via `ancestorClasses` tracking. Flattenable elements (`h1`–`h6`, `p`, `a`, `ul`, `ol`, `li`, `blockquote`) stay native.
- **nonStandardMediaCss**: Container queries, print media, `>991px` max-width breakpoints, and pseudo-class rules inside min-width media queries are collected and merged into embed output.
- **Inline style conversion**: Inline `style=""` attributes are converted to generated classes (e.g., `inline-1`), not discarded.

Output: Single hidden `<div>` (class: `delete-me`) containing all style classes. User pastes into Webflow, then deletes the wrapper div.

---

## 7. Deprecations (Current)
- "Flow Stach" → **Flow Bridge**
- "Three-Output System" → **Deprecated** (now single hidden div with embed CSS/JS as separate copy actions)
- `/assets` as primary entry → Redirects to `/workspace/projects`
- Multi-file import → Not supported (single-file only)
- Hardcoded app CSS classes for pipeline patterns (`btn-premium`, `premium-hover`, `premium-card-hover`, `btn-primary-cta`) → **Removed** (pipeline handles dynamically for any imported file)

---

**End of Manifest.**
