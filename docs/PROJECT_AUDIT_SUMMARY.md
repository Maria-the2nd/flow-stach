# FLOW BRIDGE (flow-stach) - COMPLETE PROJECT AUDIT

**Date**: 2026-01-21
**Working Directory**: `C:\Users\maria\Desktop\pessoal\FLOW_PARTY\flow-stach`
**Git Branch**: `feature/improve-parsing`
**Main Branch**: `master`

---

## Part 1: Project Structure

### Top-Level Folders

| Folder | Purpose |
|--------|---------|
| `app/` | Next.js 16 App Router pages and API routes |
| `components/` | React components (UI, admin, asset views, sidebar) |
| `convex/` | Convex backend (schema, queries, mutations, auth) |
| `docs/` | Documentation, CLI prompts, research PDFs, osmo_mirror HTML examples |
| `lib/` | Core utilities (parsers, converters, clipboard, token extraction) |
| `Flow-Goodies-extension/` | Webflow Designer Extension (in-Designer component library) |
| `flow-bridge-extension/` | Chrome Extension (popup for copying projects to clipboard) |
| `tests/` | TypeScript tests for CSS units, gradients, responsive layouts |
| `.claude/` | Claude AI configuration (plans, skills, settings) |
| `public/` | Static assets (if any) |

### TWO EXTENSIONS (Different Purposes)

1. **`Flow-Goodies-extension/`** - Webflow Designer Extension (runs **inside** Webflow Designer)
2. **`flow-bridge-extension/`** - Chrome Extension (popup, runs **in browser**)

---

## Part 2: Extension Status

### Flow Bridge Extension (Chrome Popup) - WORKING

- ✅ Auth sync with Clerk
- ✅ Project list via `projects.listMine`
- ✅ Artifact copy via offscreen document
- ✅ Vite build system
- ❌ Not published to Chrome Web Store
- ❌ OAuth not supported (email/password only)

### Flow-Goodies Extension (Webflow Designer) - MVP, NOT CONNECTED

- ✅ UI renders in Designer (press E key)
- ✅ Search and category filters
- ✅ Copy to Designer works
- ❌ Uses HARDCODED sample data
- ❌ NOT connected to Convex backend
- ❌ NO auth - users can't see their own projects

---

## Part 3: Convex Backend - Complete

### Schema Tables
- `users` - Clerk sync, role (user/admin)
- `assets` - Component metadata
- `payloads` - Webflow JSON + code
- `favorites` - User bookmarks
- `importProjects` - User's imported projects (has userId)
- `importArtifacts` - Tokens, CSS, HTML, JS per project
- `templates` - Design system templates

### User-Scoped Queries (Ready for Extension)
- `projects.listMine` - List user's projects
- `projects.getWithArtifacts` - Get project + artifacts
- `projects.getArtifactContent` - Get artifact for copy

---

## Part 4: What's Missing

1. **Templates lack userId** - All templates visible to everyone, not user-scoped
2. **Flow-Goodies Backend Connection** - Uses hardcoded data
3. **Flow-Goodies Auth** - No Clerk integration
4. **Production Deployment** - Localhost only, no domain

**Note**: Full Site Copy IS implemented. The "Full Page" asset category within each template contains the entire site as one Webflow JSON payload. The web app's "Copy Full Site" button works correctly.

**Primary Data Model**:
- `templates` — User's imported sites (e.g., "Flowbridge")
- `assets` — Components grouped by category (Design Tokens, Navigation, Hero, Sections, Full Page)
- `payloads` — Webflow JSON and code for each asset

The `importProjects` + `importArtifacts` tables are a separate import pipeline, not the primary user-facing data.

---

## Part 5: Deployment Status

- **Domain**: None (localhost only)
- **Hosting**: Not deployed
- **Convex**: Dev environment
- **Extensions**: Not published

See full audit for complete details.
