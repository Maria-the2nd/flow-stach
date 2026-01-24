# SYSTEM MANIFEST — Aligned with AUTHORITATIVE_CURRENT_STATE (2026-01-24)

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
1) **HTML to Webflow Tool** — Imports a single HTML bundle, extracts tokens/components/artifacts, and provides Webflow-copyable payloads.
2) **Marketplace Catalog** — Templates, components, and tools (currently mock/static data in the UI).

---

## 2. Information Architecture (Routing)

### Public Area (Guest)
- `/explore` — Marketplace catalog (Templates, Components, Tools)
- `/sign-in` / `/sign-up` — Authentication

### Workspace (Authenticated User)
- `/workspace/projects` — Imported projects list
  - `/workspace/projects/[id]` — Project detail view with tabs:
    - `Overview` — Token summary and font checklist
    - `Style Guide (Design Tokens)` — Visual tokens + Webflow copy
    - `Site` — Site Structure Payload + Extracted Components
    - `Images` — Extracted images
    - `Embeds` — Extracted CSS/JS and external libraries
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

### Style Guide (Design Tokens)
- Extracted via `lib/token-extractor.ts` → `extractEnhancedTokens()`
- UI in `components/project/style-guide/`
- Webflow payload generator in `lib/webflow-style-guide-generator.ts`

---

## 7. Deprecations (Current)
- “Flow Stach” → **Flow Bridge**
- “Design Tokens” vs “Style Guide” → **Style Guide (Design Tokens)** only
- “Full Site Package” → **Site Structure Payload**
- `/assets` as primary entry → Redirects to `/workspace/projects`
- Multi-file import → Not supported (single-file only)

---

**End of Manifest.**
