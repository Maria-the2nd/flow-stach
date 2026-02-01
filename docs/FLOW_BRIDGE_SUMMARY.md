# Flow Bridge - Comprehensive Project Summary

**Last Updated:** January 24, 2026
**Version:** 1.0

---

## Table of Contents

1. [What is Flow Bridge?](#what-is-flow-bridge)
2. [Core Problem & Solution](#core-problem--solution)
3. [Architecture Philosophy](#architecture-philosophy)
4. [Key Functionalities](#key-functionalities)
5. [Technical Stack](#technical-stack)
6. [User Workflows](#user-workflows)
7. [Data Model](#data-model)
8. [Current Implementation Status](#current-implementation-status)
9. [Routing & Navigation](#routing--navigation)
10. [Import Pipeline](#import-pipeline)
11. [The Three-Output System](#the-three-output-system)
12. [Known Limitations](#known-limitations)

---

## What is Flow Bridge?

**Flow Bridge** is a web application that bridges the gap between AI-generated HTML/CSS and Webflow's visual editor. It enables developers to take raw HTML (from AI tools, CodePen, or custom code) and convert it into **editable Webflow projects**.

### Two Core Pillars

1. **Flow Bridge Tool** - HTML to Webflow converter
2. **Flow Stach Library** - Premium templates and components marketplace (future)

---

## Core Problem & Solution

### The Problem

When you paste HTML/CSS into Webflow, you face several challenges:

1. **Webflow HTML Editor Limitations**
   - Some CSS styles aren't compatible with Webflow's style panel
   - Certain HTML structures can't be edited in the visual editor
   - Reserved class names cause conflicts
   - Inline styles are discouraged

2. **No Reusability**
   - Pasted code is static and hard to maintain
   - Design tokens (colors, spacing, etc.) aren't extractable
   - Components can't be reused across pages

3. **AI Output Gap**
   - AI tools generate fast, raw HTML
   - Webflow is built for visual, semantic editing
   - No clear bridge between the two worlds

### The Solution

Flow Bridge converts a **single HTML file** into a Webflow-pasteable payload:

1. **Single Hidden Div Output** → A `<div>` with class `delete-me` (display: none) containing all styles
2. **Paste & Delete** → Copy to Webflow, paste, then delete the hidden wrapper div
3. **CSS/JS Embeds** → Complex CSS/JS that can't be native go to the Embeds tab

**Result:** You can import AI-generated HTML and **edit it in Webflow's UI** as if you built it natively.

---

## Architecture Philosophy

### Simplified Single-Output Model

Flow Bridge converts HTML into a **single Webflow-pasteable payload**:

#### 1. **Main Payload (Hidden Div)**
- **What:** A hidden `<div>` (class: `delete-me`, display: none) containing all styles
- **Why:** Webflow requires a single root node; the hidden wrapper establishes all class styles
- **How:** Copy to Webflow clipboard, paste into canvas, delete the wrapper div
- **When:** Single copy-paste operation

#### 2. **CSS/JS Embeds (Optional)**
- **What:** CSS/JS that can't be native Webflow styles (animations, pseudo-elements, complex selectors)
- **Why:** Webflow has style limitations; this is the escape hatch
- **How:** Copy from Embeds tab, paste into Webflow's Custom Code panel
- **When:** Only if your HTML uses advanced CSS/JS features

### The Workflow

```
1. Copy main payload → Paste into Webflow canvas
2. Delete the "delete-me" wrapper div
3. (Optional) Copy embeds → Paste into Custom Code panel
```

This ensures the imported HTML is **not just static code**, but **editable Webflow structure**.

---

## Key Functionalities

### ✅ Implemented

#### 1. HTML Import Pipeline
- Upload single HTML file (with embedded CSS/JS)
- Parse and clean HTML (remove inline styles, event handlers, iframes)
- Extract CSS, scripts, external libraries
- Generate user-owned import project

#### 2. Webflow Payload Generation
- Converts HTML structure to Webflow nodes
- Converts CSS classes to Webflow styles
- Creates a single hidden `<div>` (class: `delete-me`) as the root container
- All styles are established via this hidden wrapper

#### 3. Custom Code Embeds
- Extract external script URLs (Google Fonts, GSAP, etc.)
- Store inline JavaScript
- Provide CSS embeds for incompatible styles
- Copy-ready format for Webflow's Custom Code panel

#### 4. User Authentication & Ownership
- Clerk-based authentication
- User-scoped projects (`userId` ownership)
- Private workspace for managing imports

#### 5. Clipboard System
- Webflow-compatible JSON copy
- Chrome extension integration (optional)
- Preflight validation & sanitization
- Fallback copy methods

#### 6. BEM Class Renaming
- Automatic namespacing of all classes with project slug
- High-risk generic names neutralized (container, hero, section, etc.)
- Design token classes preserved (never renamed)
- Shared classes (used in 2+ components) namespaced as utilities
- JavaScript class references updated automatically
- Feature flag: `NEXT_PUBLIC_FLOWBRIDGE_BEM_RENAME` (default ON)

### 🚧 Partially Implemented (Mock UI)

#### 1. Marketplace Catalog (`/explore`)
- Browse templates, components, tools
- Currently uses static mock data
- No purchase flow or backend integration

#### 2. User Libraries
- `/workspace/library` (Templates) - mock UI
- `/workspace/components` (Components) - mock UI
- No backend connection to owned marketplace items

### ❌ Not Implemented

1. **Marketplace Purchasing**
   - No payment or checkout flow
   - No license enforcement
   - No delivery of purchased items to user libraries

2. **Multi-File Import**
   - Only single HTML file supported
   - ZIP upload reads as text (no extraction)

3. **Live Webflow Sync**
   - No Webflow API integration
   - No automatic sync or updates

4. **Team Workspaces**
   - No collaborative editing
   - No role-based access control

5. **WYSIWYG Editor**
   - No in-app visual editing of components

---

## Technical Stack

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Runtime:** Bun
- **Styling:** Tailwind CSS 4
- **UI Components:** Custom + Framer Motion
- **Fonts:** Plus Jakarta Sans (body), Antonio (display), Geist Mono (code)

### Backend
- **Database:** Convex (real-time, serverless)
- **Authentication:** Clerk (user management)
- **File Storage:** Convex file storage (thumbnails)

### APIs
- **Semantic Patching:** `/api/flowbridge/semantic` (LLM via OpenRouter)
- **Webflow Conversion:** `/api/webflow/convert` (validation/sanitization)

### Browser
- **Chrome Extension:** Optional (for enhanced clipboard compatibility)

---

## User Workflows

### Workflow 1: First-Time User Import

1. **Browse Marketplace** (optional)
   - Visit `/explore` to see available templates/components
   - Sign up via `/sign-up` if interested

2. **Import HTML**
   - Navigate to `/workspace/import`
   - Upload single HTML file
   - System processes and extracts:
     - Design tokens
     - Components
     - CSS/JS embeds
     - External libraries

3. **Review Project**
   - Navigate to `/workspace/projects/[id]`
   - **Overview Tab:** Token summary, font checklist
   - **Style Guide Tab:** Visual tokens, copy functionality
   - **Site Tab:** Component list, Site Structure Payload
   - **Images Tab:** Extracted images
   - **Embeds Tab:** CSS/JS code, external libraries

4. **Copy to Webflow**
   - **Step 1:** Click "Copy to Webflow" → Paste in Webflow canvas
   - **Step 2:** Delete the hidden `delete-me` wrapper div
   - **Step 3:** (Optional) Copy Embeds (CSS/JS) → Paste in Webflow Custom Code

5. **Edit in Webflow**
   - Structure is now editable in Webflow's UI
   - Styles are reusable across pages
   - Complex features work via Custom Code

### Workflow 2: Returning User

1. Sign in → `/workspace/projects`
2. See list of imported projects with thumbnails
3. Open project → Copy to Webflow → Delete wrapper → (optional) Copy Embeds
4. Paste into Webflow as needed

### Workflow 3: Design System Import

1. Import design system HTML
2. Navigate to Site tab
3. Click "Copy to Webflow"
4. Paste into new Webflow page, delete wrapper
5. Edit styles in Webflow as needed

---

## Data Model

### User Imports

#### `importProjects`
- User-owned HTML imports
- Fields: `name`, `slug`, `userId`, `tokens`, `fonts`, `images`, `createdAt`
- Relationship: One project → Many artifacts

#### `importArtifacts`
- Extracted data from import project
- Fields:
  - `projectId` (foreign key)
  - `tokens_json` (extracted tokens)
  - `tokens_css` (CSS variables)
  - `styles_css` (full CSS)
  - `clean_html` (sanitized HTML)
  - `scripts_js` (inline scripts)
  - `js_hooks` (event handlers)
  - `external_scripts` (library URLs)
  - `component_manifest` (component metadata)

### Marketplace & Library

#### `templates`
- Template groups (either marketplace or import-derived)
- Fields: `name`, `slug`, `userId` (if user-owned), `category`, `createdAt`
- Relationship: One template → Many assets

#### `assets`
- Reusable components/tokens/templates
- Fields: `name`, `slug`, `category`, `templateId`, `userId`, `createdAt`
- Relationship: One asset → Many payloads

#### `payloads`
- Webflow JSON and code payloads
- Fields: `assetId`, `webflowJson`, `codePayload`, `metadata`

### Object Relationships

```
User
  └─ importProjects (many)
      ├─ importArtifacts (many)
      └─ templates (one, matching slug)
          └─ assets (many: components + tokens)
              └─ payloads (many)
```

---

## Current Implementation Status

| Feature Area | Status | Notes |
|--------------|--------|-------|
| HTML Import | ✅ Complete | Single file only |
| Token Extraction | ✅ Complete | CSS variables only |
| Style Guide UI | ✅ Complete | Self-contained styles |
| Style Guide Export | ✅ Complete | Webflow JSON payload |
| Component Extraction | ✅ Complete | Auto-split sections |
| BEM Class Renaming | ✅ Complete | Namespacing + high-risk neutralization |
| Site Structure Payload | ✅ Complete | Base styles only |
| Custom Code Embeds | ✅ Complete | CSS/JS extraction |
| User Authentication | ✅ Complete | Clerk integration |
| Project Management | ✅ Complete | CRUD operations |
| Clipboard System | ✅ Complete | Validation + sanitization |
| Marketplace UI | 🚧 Mock | Static data only |
| User Libraries | 🚧 Mock | No backend |
| Purchasing Flow | ❌ Not Implemented | Future |
| Multi-File Import | ❌ Not Implemented | Future |
| Webflow API Sync | ❌ Not Implemented | Future |

---

## Routing & Navigation

### Public Routes (Guest Access)

- `/` → Redirects to `/explore`
- `/explore` → Marketplace catalog (Templates, Components, Tools)
- `/sign-in` → Clerk login
- `/sign-up` → Clerk registration
- `/extension` → Chrome extension instructions
- `/flow-bridge` → Redirects to `/explore`

### Authenticated Routes (Workspace)

- `/workspace/projects` → User's imported projects list
- `/workspace/projects/[id]` → Project detail (tabs: Overview, Style Guide, Site, Images, Embeds)
- `/workspace/import` → HTML import tool
- `/workspace/library` → Owned templates (mock UI)
- `/workspace/components` → Owned components (mock UI)
- `/account` → Clerk user profile

### Internal/Admin Routes

- `/assets/[slug]` → Asset detail page (requires auth, not in nav)
- `/assets` → Redirects to `/workspace/projects` (legacy)
- `/admin/*` → Admin import/seed tools (internal only)

### Navigation Structure

#### Global Header
- **Workspace** → `/workspace/projects`
- **Import** → `/workspace/import`
- **Explore** → `/explore`

#### Workspace Sidebar
- **Projects** → `/workspace/projects`
- **Templates** → `/workspace/library`
- **Components** → `/workspace/components`

**Note:** Import is accessed via CTA button in Projects page, not sidebar.

---

## Import Pipeline

### Stage 1: Parsing

**Input:** Single HTML file (or ZIP read as text)

**Process:**
1. Extract `<style>` blocks → CSS
2. Extract `<script>` blocks → Inline JavaScript
3. Extract external `<script src="...">` → Library URLs
4. Remove `<head>`, `<html>`, `<body>` wrappers
5. Remove inline styles (`style="..."`)
6. Remove inline event handlers (`onclick="..."`)
7. Remove `<iframe>` elements

**Output:** Clean HTML body content, extracted CSS, scripts

### Stage 2: Extracting

**Process:**
1. Parse CSS into class index
2. Detect CSS custom properties (`--variable-name`)
3. Categorize tokens (colors, typography, spacing, radius, shadows)
4. Extract font families and weights
5. Extract image `src` references
6. Store token metadata

**Output:** Token JSON, CSS index, font metadata, image list

### Stage 3: Componentizing

**Process:**
1. Split HTML into semantic sections (header, nav, main, footer, etc.)
2. Apply deterministic component naming
3. Generate component manifest

**Output:** Component list with HTML chunks

### Stage 3b: BEM Class Renaming

**Process:**
1. Build class usage index across all components
2. Categorize classes:
   - **Component-local** (1 component) → Full BEM rename: `{project}__{element}`
   - **Shared** (2+ components) → Utility namespace: `{project}-u-{name}`
   - **High-risk** (container, hero, etc.) → Forced rename
   - **Design tokens** → Always preserved (never renamed)
3. Update HTML class attributes
4. Update CSS selectors
5. Update JavaScript class references
6. Generate renaming report for UI

**Output:** Renamed HTML/CSS/JS with class mapping and report

**Feature Flag:** `NEXT_PUBLIC_FLOWBRIDGE_BEM_RENAME=0` to disable

### Stage 4: Semantic Patching (Optional LLM)

**Trigger:** Unresolved CSS variables or structural warnings

**Process:**
1. Call `/api/flowbridge/semantic` with HTML/CSS context
2. LLM renames components semantically
3. LLM patches HTML/CSS for Webflow compatibility
4. Fallback to mock response if LLM unavailable

**Output:** Refined HTML/CSS with better naming

### Stage 5: Generating

**Process:**
1. **Literalize CSS:** Resolve CSS variables to actual values
2. **Generate Style Guide Payload:** Webflow JSON for design tokens
3. **Generate Component Payloads:** Webflow JSON per component
4. **Generate Site Structure Payload:** Full layout with base styles only
5. **Create Assets:** Store components as reusable assets
6. **Create Payloads:** Link Webflow JSON to assets

**Output:**
- `importProjects` record
- `importArtifacts` records
- `templates` record (matching project slug)
- `assets` + `payloads` for each component

---

## The Output System

### Main Output: Webflow Payload (Hidden Div)

**What It Contains:**
- A hidden `<div>` with class `delete-me` (display: none)
- All CSS classes converted to Webflow styles
- Full HTML structure as Webflow nodes

**How It Works:**
- Single copy-paste operation
- The hidden wrapper establishes all styles in Webflow
- After pasting, delete the wrapper div to reveal clean structure
- All styles remain in Webflow's style panel

**When to Use:**
- Single-step import of any HTML file
- Styles become editable in Webflow's visual UI

**File Location:**
- `lib/webflow-converter.ts`

### Optional: CSS/JS Embeds

**What It Contains:**
- **CSS Embeds:** Styles that can't be native Webflow
  - Complex selectors (`:nth-child`, `:has()`)
  - Animations (`@keyframes`, `transform`)
  - Pseudo-elements (`:before`, `:after`)
  - CSS variables (`:root`)
- **JavaScript Embeds:** Inline scripts
  - DOM manipulation
  - Event listeners
  - Interactive features
- **External Libraries:** Script URLs
  - Google Fonts
  - GSAP, Three.js, etc.

**How It Works:**
- Copy from the Embeds tab
- Paste into Webflow's Custom Code panel

**When to Use:**
- Only if your HTML uses advanced CSS/JS features
- Most simple HTML imports won't need embeds

**File Location:**
- `components/project/EmbedsTab.tsx`
- `lib/css-embed-router.ts`

---

## Known Limitations

### Import Limitations

1. **Single File Only**
   - No multi-file project structure
   - ZIP uploads read as text (not extracted)

2. **CSS Variable Dependency**
   - Tokens only detected from CSS custom properties
   - Direct values (e.g., `color: #fff;`) not tokenized

3. **No React/TypeScript Support**
   - HTML/CSS only
   - No JSX or component frameworks

### Webflow Limitations

1. **Reserved Classes** ✅ *Mitigated*
   - Generic class names (container, hero, section) can conflict with Webflow
   - **Solution:** BEM Class Renaming automatically namespaces all classes
   - High-risk names are neutralized with project-specific prefixes
   - Classes starting with `w-` (Webflow reserved) are renamed

2. **Style Editor Constraints**
   - Complex CSS selectors not supported
   - Certain properties require Custom Code

3. **No Live Sync**
   - Changes in Webflow don't sync back to Flow Bridge
   - Changes in Flow Bridge don't update Webflow

### Marketplace Limitations

1. **Mock Data Only**
   - No real purchasing
   - No user library fulfillment

2. **No License Management**
   - No purchase history
   - No download tracking

### Chrome Extension

1. **Not Currently Priority**
   - Basic clipboard works without extension
   - Extension enhances compatibility but isn't required

---

## Development Commands

```bash
# Install dependencies
bun install

# Start development server (Convex + Next.js)
bun run dev

# Start Convex only
bun run convex:dev

# Type checking
bun run typecheck

# Build for production
bun run build
```

---

## Key Files & Directories

### Core Import Pipeline
- `lib/project-engine.ts` - Main import orchestrator (5-stage pipeline)
- `lib/token-extractor.ts` - Design token extraction
- `lib/css-parser.ts` - CSS parsing and cleaning
- `lib/componentizer.ts` - HTML → semantic components
- `lib/bem-renamer.ts` - BEM class renaming orchestrator
- `lib/flowbridge-semantic.ts` - BEM utilities + LLM patching
- `lib/webflow-converter.ts` - HTML → Webflow JSON
- `lib/webflow-sanitizer.ts` - Sanitization and validation
- `lib/webflow-safety-gate.ts` - Preflight checks

### Style Guide
- `components/project/style-guide/StyleGuideView.tsx` - UI
- `lib/webflow-style-guide-generator.ts` - Webflow payload generation
- `lib/validation-types.ts` - Token type definitions

### Clipboard
- `lib/clipboard.ts` - Copy helpers
- `lib/preflight-validator.ts` - Pre-copy validation

### Backend (Convex)
- `convex/projects.ts` - Import project queries
- `convex/import.ts` - Import mutations
- `convex/assets.ts` - Asset management
- `convex/templates.ts` - Template queries

### Frontend Routes
- `app/(authenticated)/workspace/projects/page.tsx` - Projects list
- `app/(authenticated)/workspace/projects/[id]/page.tsx` - Project detail
- `app/(authenticated)/workspace/import/page.tsx` - Import wizard
- `app/(public)/explore/page.tsx` - Marketplace

---

## What Makes Flow Bridge Unique

### 1. AI → Webflow Bridge
- Specifically designed for AI-generated HTML
- Handles messy, non-semantic code
- Extracts intent and structure

### 2. Design Token First
- Prioritizes design system extraction
- Creates reusable, maintainable styles
- Visual style guide generation

### 3. Webflow-Native Editing
- Not just code paste
- Generates editable structure
- Respects Webflow's constraints

### 4. Smart Splitting
- Style Guide (tokens) + Site Structure (layout) + Custom Code (edge cases)
- Each output optimized for its purpose
- Clean separation of concerns

### 5. User Ownership
- Private workspace for imports
- No sharing or collaboration (yet)
- User-scoped data model

---

## Future Roadmap

### Phase 1: User-Scoped Templates
- Add `userId` to templates table
- Connect user imports to library
- Enable template reuse

### Phase 2: Chrome Extension Integration
- Connect extension to Convex backend
- Enable "Copy Full Site" from extension
- Improve clipboard workflow

### Phase 3: Marketplace Activation
- Implement purchasing flow
- Payment integration
- License management
- Fulfillment to user libraries

### Phase 4: Multi-File Support
- ZIP extraction
- Project structure preservation
- Asset bundling

### Phase 5: Webflow API Integration
- Live project sync
- Automatic updates
- Two-way editing

---

## Troubleshooting Common Issues

### Import Issues

**Problem:** No tokens detected

**Solution:**
- Ensure CSS uses custom properties (`--variable-name`)
- Variables must be in `:root` selector
- Check for typos in variable names

**Problem:** Components not extracting

**Solution:**
- Verify HTML has semantic sections (header, main, footer)
- Check for valid HTML structure
- Remove inline styles first

### Copy Issues

**Problem:** Clipboard copy fails

**Solution:**
- Check browser clipboard permissions
- Use HTTPS (required for Clipboard API)
- Try Chrome extension for fallback

**Problem:** Webflow paste looks broken

**Solution:**
- Ensure Style Guide was copied first
- Paste into container element
- Check for payload size limits

### Style Guide Issues

**Problem:** Style guide looks different in Webflow

**Solution:**
- This was fixed in latest version
- Style guide now uses self-contained inline styles
- Should render identically in Webflow

### BEM Class Renaming Issues

**Problem:** Classes not being renamed

**Solution:**
- Check if class is a design token (preserved by design)
- Verify class doesn't already start with project slug (skipped)
- Check `NEXT_PUBLIC_FLOWBRIDGE_BEM_RENAME` isn't set to `0`

**Problem:** JavaScript selectors broken after rename

**Solution:**
- Ensure `updateJSReferences: true` in options (default)
- Dynamic class construction can't be statically analyzed
- Check `jsReferencesUpdated` count in report

**Problem:** Unexpected class name collisions

**Solution:**
- Use a more unique project slug
- Review `highRiskDetected` in report for renamed generics
- Check the class renaming report for full mapping

---

## Documentation Index

- **[SYSTEM_MANIFEST.md](../SYSTEM_MANIFEST.md)** - Current system routing and architecture
- **[AUTHORITATIVE_CURRENT_STATE.md](../AUTHORITATIVE_CURRENT_STATE.md)** - Canonical specification
- **[STYLE_GUIDE.md](./features/STYLE_GUIDE.md)** - Design tokens feature guide
- **[bem-class-renaming.md](./bem-class-renaming.md)** - BEM class renaming feature guide
- **[ROADMAP.md](./ROADMAP.md)** - Development roadmap
- **[README.md](../README.md)** - Quick start guide

---

**For Questions or Issues:**
1. Check this summary first
2. Review relevant documentation
3. Check troubleshooting section
4. Submit issue on GitHub

---

**End of Summary**
