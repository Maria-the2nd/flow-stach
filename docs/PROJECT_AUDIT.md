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

### Config Files (Root)

- `package.json` - Main web app dependencies (Next.js, Convex, Clerk, React 19)
- `tsconfig.json` - TypeScript config
- `tailwind.config.ts` - Tailwind CSS v4
- `next.config.js` - Next.js configuration
- `eslint.config.mjs` - ESLint configuration
- `CLAUDE.md` - Project-specific instructions for Claude Code
- `.env.local` - Environment variables (git-ignored)
- `.env.local.example` - Example env vars

### Duplicate/Legacy Folders

**TWO EXTENSION FOLDERS EXIST:**

1. **`Flow-Goodies-extension/`** - Webflow Designer Extension (runs **inside** Webflow Designer)
2. **`flow-bridge-extension/`** - Chrome Extension (popup, runs **in browser**)

These serve **different purposes** and are not duplicates:
- Flow-Goodies = in-Designer component library UI
- flow-bridge = browser extension for auth-synced project copying

---

## Part 2: Extensions Audit

### Extension 1: `flow-bridge-extension/`

**Location**: `C:\Users\maria\Desktop\pessoal\FLOW_PARTY\flow-stach\flow-bridge-extension\`

#### Manifest.json

```json
{
  "manifest_version": 3,
  "name": "Flow Bridge",
  "version": "1.0.0",
  "description": "Copy your Flow Bridge projects directly to Webflow Designer clipboard"
}
```

**Permissions:**
- `storage`, `cookies`, `clipboardWrite`, `offscreen`

**Host Permissions:**
- `*.convex.cloud/*` (Convex API)
- `*.clerk.accounts.dev/*` (Clerk auth)
- `clerk.flowstach.com/*`
- `localhost:3000/*`, `flowstach.com/*`

**Architecture:**
- **Popup**: `popup.html` → React app (`App.tsx`)
- **Background**: Service worker (`background.ts`)
- **Offscreen**: `offscreen.html` (for clipboard writes)

#### Tech Stack

- **Build Tool**: Vite
- **Language**: TypeScript + React
- **Auth**: Clerk (syncs from web app via `syncHost`)
- **Database**: Convex (uses React hooks `useQuery`/`useMutation`)

#### Features Implemented

| Feature | Status | Details |
|---------|--------|---------|
| **Auth Sync** | Working | Shares session with flowstach.com via Clerk `syncHost` |
| **Project List** | Working | Calls `api.projects.listMine` to show user's import projects |
| **Artifact Details** | Working | Shows tokens, CSS, HTML, JS per project |
| **Copy to Clipboard** | Working | Copies Webflow JSON or code via offscreen document |
| **Webflow MIME Type** | Working | Uses `application/json` for Webflow paste compatibility |

#### Build Process

**Commands** (from `package.json`):
```bash
bun run dev    # Vite watch mode
bun run build  # Production build to dist/
```

**Output**: `dist/` folder (load unpacked in Chrome)

#### Current State

**Status**: **Functional**

- Successfully builds with Vite
- Popup UI renders project list
- Auth sync works (tested with Clerk)
- Clipboard writes work via offscreen document API
- **Not yet published** to Chrome Web Store

**Known Limitations** (from README):
- OAuth not supported in popup (use email/password)
- Chrome only (uses Chrome-specific offscreen API)
- Requires web app auth sync

---

### Extension 2: `Flow-Goodies-extension/`

**Location**: `C:\Users\maria\Desktop\pessoal\FLOW_PARTY\flow-stach\Flow-Goodies-extension\`

#### Manifest.json

**NOT FOUND** - This is a **Webflow Designer Extension**, not a Chrome extension.

Uses `webflow.json` instead (Webflow Designer Extension manifest).

#### Tech Stack

- **Build Tool**: Webpack (see `webpack.config.mjs`)
- **Language**: TypeScript + React
- **Framework**: Webflow Designer Extension SDK (`@webflow/designer-extension-typings`)

**Commands** (from `package.json`):
```bash
bun run dev   # Webpack watch + webflow extension serve
bun run build # Webpack production + webflow extension bundle
```

#### Features Implemented

| Feature | Status | Details |
|---------|--------|---------|
| **Component Library UI** | Working | Searchable grid with category filters |
| **Sample Components** | Working | Hero, Feature Card, Navigation (hardcoded) |
| **Copy to Webflow** | Working | Converts HTML/CSS → Webflow JSON, pastes into Designer |
| **Style Deduplication** | Working | Checks existing classes via Webflow API to avoid conflicts |
| **JavaScript Alert** | Partial | Shows alert for JS components (doesn't auto-inject) |

#### Key Files

```
Flow-Goodies-extension/src/
├── components/
│   ├── App.tsx              # Main UI
│   ├── SearchBar.tsx        # Search & filters
│   ├── ComponentGrid.tsx    # Grid layout
│   └── ComponentCard.tsx    # Component cards
├── data/
│   └── sampleComponents.ts  # Hardcoded component library
├── utils/
│   └── webflowCopy.ts       # HTML→Webflow conversion logic
└── types/
    └── component.ts         # TypeScript interfaces
```

#### Current State

**Status**: **MVP Complete**

From `COMPONENT_LIBRARY_README.md`:
- UI renders in Webflow Designer (press `E` key)
- Copy works (tested with Hero Section)
- Style deduplication works
- **Not connected to backend** (uses hardcoded sample data)

**Known Limitations** (from README):
- CSS parsing is basic (regex-based, no pseudo-classes)
- No media queries support
- Doesn't preserve all HTML attributes
- JavaScript components show alert instead of auto-injecting

**Next Steps** (from README):
- Connect to Convex backend
- Add Clerk authentication
- Replace sample data with real component library

---

## Part 3: Web App Features

### Routes Audit

| Route | Component | Purpose | Status |
|-------|-----------|---------|--------|
| `/` | `app/page.tsx` | Redirects to `/assets` | Working |
| `/assets` | `app/assets/page.tsx` | Asset grid with search/category filter | Working |
| `/assets/[slug]` | `app/assets/[slug]/page.tsx` | Asset detail + copy buttons | Working |
| `/admin/seed` | `app/admin/seed/page.tsx` | Seed demo assets | Working |
| `/admin/import` | `app/admin/import/page.tsx` | HTML→Webflow import wizard | Working |
| `/admin/import-react` | `app/admin/import-react/page.tsx` | React→HTML converter | Working |
| `/sign-in`, `/sign-up` | `app/(auth)/` | Clerk auth pages | Working |
| `/extension` | `app/extension/page.tsx` | Extension download/info page | Working |
| `/flow-bridge` | `app/flow-bridge/page.tsx` | Flow Bridge landing page | Working |

### API Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/api/webflow/convert` | LLM-powered HTML→Webflow JSON conversion | Working |
| `/api/flowbridge/*` | (If exists - not confirmed) | Unknown |

### Key Features Detail

#### `/assets` - Component Marketplace

**Features:**
- Grid view of published assets
- Search by title/description/tags
- Category filtering (Navigation, Hero, Card, etc.)
- Favorites toggle
- Template filtering
- Responsive 3-column layout

**State**: Fully Working

#### `/assets/[slug]` - Asset Detail

**Features:**
- Component preview (image/video)
- Copy Webflow JSON button
- Copy code snippet button
- Capability badges (paste reliability: full/partial/none)
- Dependencies list
- Related assets

**State**: Fully Working

#### `/admin/import` - HTML Import Wizard

**Features** (from code inspection):
1. **Step 1: Input**
   - Paste full HTML from AI generator
   - Configure options (strip base styles, merge nav, etc.)
2. **Step 2: Artifacts**
   - Extracts: tokens (JSON + CSS), styles CSS, clean HTML, JS scripts
   - Shows class index, external scripts
3. **Step 3: Components**
   - Componentizes HTML into reusable blocks
   - Generates Webflow JSON per component
   - Validates for paste compatibility
4. **Step 4: Complete**
   - Bulk imports to Convex (creates assets + payloads)
   - Shows import stats (created/updated counts)

**State**: Fully Working

**LLM Integration**:
- Optional LLM semantic naming (via OpenRouter API)
- Falls back to deterministic names if no API key

#### `/admin/import-react` - React Converter

**Features** (from code inspection):
1. **Step 1: Paste Code**
   - Paste React component (.jsx/.tsx)
2. **Step 2: Dependencies**
   - Detects missing imports (local files)
   - User provides component/CSS files
3. **Step 3: Convert**
   - JSX → HTML
   - `className` → `class`
   - Event handlers → vanilla JS `addEventListener`
4. **Step 4: Result**
   - Copy HTML/CSS/JS separately
   - Download as complete `.html` file

**State**: Fully Working

**Supported Conversions**:
- JSX syntax
- CSS imports (combined)
- onClick/onChange
- useRef → `document.querySelector` (with warnings)
- useEffect → `DOMContentLoaded` (with warnings)

**Not Supported** (shows warnings):
- useState (stateful logic)
- useContext (context dependencies)

---

## Part 4: Convex Backend

### Schema (`convex/schema.ts`)

| Table | Fields | Indexes |
|-------|--------|---------|
| **users** | `clerkId` (string), `role` (user\|admin), `createdAt` (number) | `by_clerk_id` |
| **assets** | `slug`, `title`, `category`, `description`, `tags[]`, `templateId`, `previewImageUrl`, `previewVideoUrl`, `isNew`, `status` (draft\|published), `pasteReliability` (full\|partial\|none), `supportsCodeCopy`, `capabilityNotes`, `updatedAt`, `createdAt` | `by_slug`, `by_category`, `by_status`, `by_template` |
| **templates** | `name`, `slug`, `imageUrl`, `createdAt`, `updatedAt` | `by_slug` |
| **payloads** | `assetId`, `webflowJson` (string), `codePayload` (string), `dependencies[]`, `createdAt`, `updatedAt` | `by_asset_id` |
| **favorites** | `userId`, `assetId`, `createdAt` | `by_user`, `by_user_and_asset`, `by_asset` |
| **importProjects** | `name`, `slug`, `status` (draft\|complete), `userId`, `sourceHtml`, `componentCount`, `classCount`, `hasTokens`, `createdAt`, `updatedAt` | `by_slug`, `by_status`, `by_user` |
| **importArtifacts** | `projectId`, `type` (tokens_json\|tokens_css\|styles_css\|class_index\|clean_html\|scripts_js\|js_hooks\|external_scripts\|token_webflow_json\|component_manifest), `content` (string), `createdAt` | `by_project`, `by_project_type` |

### Primary Data Model (User-Facing)

The user-facing data flow uses these tables:

- **`templates`** — User's imported sites (e.g., "Flowbridge")
- **`assets`** — Components grouped by category (Design Tokens, Navigation, Hero, Sections, Full Page)
- **`payloads`** — Webflow JSON and code for each asset

The `importProjects` + `importArtifacts` tables are a **secondary/internal import pipeline**, not the primary user-facing feature. They support the admin import workflow but users interact with `templates` → `assets` → `payloads`.

**Note**: The `templates` table currently lacks a `userId` field, making all templates visible to everyone rather than user-scoped.

### Convex Functions

**Total Functions: 31**
- Queries: 9
- Mutations: 22
- Helper functions: 3 (not exported)

#### admin.ts (Admin-only operations)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `clearAllAssets` | Mutation | Clear all assets, payloads, favorites, and templates from the database for fresh start | **Admin** | `{ deletedAssets, deletedPayloads, deletedFavorites, deletedTemplates }` |
| `clearTemplateData` | Mutation | Delete all assets associated with a specific template, plus their payloads and favorites; optionally delete the template itself | **Admin** | `{ deletedAssets, deletedPayloads, deletedFavorites, deletedTemplates }` |

#### assets.ts (Asset queries and mutations)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `list` | Query | List published assets with optional category and search filters; supports templateId filtering | **User** | Array of asset objects sorted by `updatedAt` descending |
| `categoryCounts` | Query | Get total asset count and breakdown by category for sidebar; supports templateId filtering | **User** | `{ total: number, byCategory: Record<string, number> }` |
| `bySlug` | Query | Fetch a single published asset by its slug | **User** | Asset object or null |
| `count` | Query | Get total asset count (all, published, draft); no auth required for CLI usage | **None** | `{ total, published, draft }` |
| `deleteById` | Mutation | Delete a single asset and its associated payload and favorites | **Admin** | `{ deletedPayload: boolean, deletedFavorites: number }` |

#### auth.ts (Helper functions - not exported as queries/mutations)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `getCurrentUser` | Helper | Retrieve current user from Clerk identity, look up in database | **None** | User object or null |
| `requireAuth` | Helper | Require authentication; throws `ConvexError` if not authenticated | **None** | User object (or throws) |
| `requireAdmin` | Helper | Require admin role; throws `ConvexError` if not admin | **None** | User object (or throws) |

#### favorites.ts (User bookmarks)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `listMine` | Query | List all favorites for the current authenticated user with associated asset data; filters out unpublished assets | **User** | Array of `{ ...favorite, asset }` objects |
| `toggle` | Mutation | Toggle favorite status for an asset; adds if not exists, removes if exists | **User** | `{ favorited: boolean }` |

#### import.ts (Bulk import of components and design systems)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `importSections` | Mutation | Bulk import sections from parsed HTML; creates/updates assets and payloads for a design system; creates tokens asset if manifest provided | **Admin** | `{ assetsCreated, assetsUpdated, payloadsCreated, payloadsUpdated, errors[] }` |
| `deleteDesignSystem` | Mutation | Delete all imported sections for a design system (by slug or tag); removes payloads first, then assets | **Admin** | `{ deleted: number }` |
| `getImportStats` | Mutation | Get import statistics: total assets/payloads, breakdown by category, count of unique design systems | **Admin** | `{ totalAssets, totalPayloads, byCategory: {}, designSystemCount }` |
| `importProject` | Mutation | Create or update import project with extracted artifacts (tokens, CSS, HTML, JS); creates/updates template and component assets | **Admin** | `{ projectId, assetsCreated, assetsUpdated, payloadsCreated, payloadsUpdated, artifactsStored, errors[] }` |
| `getImportProject` | Mutation | Fetch import project with all its artifacts (tokens, CSS, HTML, scripts, etc.) | **Admin** | `{ project, artifacts: Record<string, string> }` or null |
| `listImportProjects` | Mutation | List all import projects (ordered descending) | **Admin** | Array of `{ id, name, slug, status, componentCount, classCount, hasTokens, createdAt, updatedAt }` |
| `deleteImportProject` | Mutation | Delete an import project and all its artifacts | **Admin** | `{ deleted: boolean, artifactsDeleted?: number }` |

#### payloads.ts (Webflow JSON + code payloads)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `byAssetId` | Query | Fetch payload (Webflow JSON + code) for a specific asset | **User** | Payload object or null |

#### projects.ts (User-scoped project access for Chrome extension)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `listMine` | Query | List current authenticated user's import projects; filters by userId (clerkId); ordered descending | **User** | Array of `{ _id, name, slug, status, componentCount, classCount, _creationTime }` |
| `getWithArtifacts` | Query | Fetch specific project with artifact metadata; verifies ownership before returning; returns artifact list (without content) | **User** | `{ project: {...}, artifacts: Array<{_id, type, createdAt}> }` or throws |
| `getArtifactContent` | Query | Get artifact content for clipboard copy; verifies ownership of parent project before returning content | **User** | `{ type, content: string }` or throws |

#### templates.ts (Design system templates)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `list` | Query | List all templates sorted alphabetically by name | **User** | Array of template objects |
| `listWithCounts` | Query | List all templates with asset counts; calculates count of published assets per template | **User** | Array of `{ ...template, assetCount: number }` sorted by name |
| `rename` | Mutation | Rename a template; validates name not empty | **Admin** | `{ success: true }` or throws |
| `deleteTemplate` | Mutation | Delete a template and all its associated assets, payloads, and favorites | **Admin** | `{ success: true, deletedAssets, deletedPayloads }` |

#### users.ts (User management)

| Function | Type | Purpose | Auth | Returns |
|----------|------|---------|------|---------|
| `ensureFromClerk` | Mutation | Sync user from Clerk identity to Convex; creates new user with "user" role if not exists, returns existing user if found | **Clerk Auth** | User object from database |

---

## Part 5: Conversion Pipeline

### HTML Upload → Webflow JSON Flow

#### Entry Point

**Web App**: `/admin/import` page (`app/admin/import/page.tsx`)

User pastes AI-generated HTML (full page from Claude, ChatGPT, etc.)

#### Step 1: HTML Parsing

**File**: `lib/html-parser.ts`

**Function**: `parseFullHtml(html: string, options: ParseOptions): ParseResult`

**What it does:**
- Extracts `<style>` tags → full CSS string
- Extracts `<script>` tags → full JS string
- Detects sections (header, nav, main, footer, section, article, aside, divs with class patterns)
- Generates section HTML + associated CSS per section
- Extracts `:root` CSS variables → token manifest

**Output**:
```typescript
{
  title: string,
  sections: DetectedSection[],
  fullCss: string,
  fullJs: string,
  rootTokens: string,
  errors: string[]
}
```

#### Step 2: Token Extraction

**File**: `lib/token-extractor.ts`

**Function**: `extractTokens(css: string): TokenExtraction`

**What it does:**
- Parses `:root` CSS variables
- Categorizes into: colors, spacing, typography, borders, shadows, effects
- Generates `TokenManifest` (structured token data)
- Converts to Webflow-compatible CSS variables

**Output**:
```typescript
{
  tokens: Map<string, string>,
  manifest: TokenManifest,
  webflowCss: string
}
```

#### Step 3: CSS Parsing

**File**: `lib/css-parser.ts`

**Function**: `parseCSS(css: string): ClassIndex`

**What it does:**
- Parses CSS class rules
- Handles media queries (`@media`)
- Handles pseudo-classes (`:hover`, `:focus`, etc.)
- Generates `ClassIndex` (map of class → styles by breakpoint/variant)

**Output**:
```typescript
ClassIndex = Record<string, ClassIndexEntry>
ClassIndexEntry = {
  base?: CssDeclarations,
  hover?: CssDeclarations,
  focus?: CssDeclarations,
  active?: CssDeclarations,
  breakpoints?: Record<string, CssDeclarations>
}
```

#### Step 4: HTML→Webflow Conversion

**File**: `lib/webflow-converter.ts`

**Function**: `convertSectionToWebflow(section: DetectedSection, classIndex: ClassIndex): WebflowPayload`

**What it does:**
- Parses HTML DOM → Webflow node tree
- Maps HTML tags → Webflow types (div→Block, a→Link, img→Image, h1→Heading, etc.)
- Converts CSS classes → Webflow style objects
- Handles text nodes, attributes, links, images
- Generates `@webflow/XscpData` clipboard format

**Output**:
```typescript
{
  type: "@webflow/XscpData",
  payload: {
    nodes: WebflowNode[],
    styles: WebflowStyle[],
    assets: []
  }
}
```

#### Step 5: LLM Conversion (Optional)

**File**: `app/api/webflow/convert/route.ts` (not confirmed to exist)
**Or**: `lib/flowbridge-semantic.ts` (semantic naming)

**What it does:**
- Sends HTML + CSS to LLM (OpenRouter API)
- LLM generates semantic class names (e.g., `.hero-cta-button`)
- LLM suggests component names
- Falls back to deterministic names if API fails

**API**: OpenRouter (`OPENROUTER_API_KEY` env var)
**Model**: Configurable via `OPENROUTER_MODEL` (default: `openai/gpt-4.1`)

#### Step 6: Storage

**File**: `convex/import.ts`

**Function**: `importProject(args: {...}): ImportResult`

**What it stores:**
1. **importProjects** table - Project metadata
2. **importArtifacts** table - Tokens JSON, tokens CSS, styles CSS, clean HTML, scripts JS, etc.
3. **assets** table - Component assets (one per section)
4. **payloads** table - Webflow JSON + code payload per asset

**Output**:
```typescript
{
  projectId: string,
  assetsCreated: number,
  assetsUpdated: number,
  payloadsCreated: number,
  payloadsUpdated: number,
  artifactsStored: number,
  errors: string[]
}
```

### Known Issues

**From `lib/css-parser.ts:913`:**
```typescript
// TODO: handle pseudo + breakpoint variants if needed
```

**From Flow-Goodies README:**
- CSS parsing doesn't handle nested selectors (`.parent .child`)
- No support for complex pseudo-classes
- Media queries partially supported

---

## Part 6: Copy/Clipboard System

### Core File: `lib/clipboard.ts`

#### Functions

| Function | Purpose | MIME Type | Fallback |
|----------|---------|-----------|----------|
| `copyText(text)` | Copy plain text | `text/plain` | N/A |
| `copyWebflowJson(json)` | Copy Webflow JSON | `application/json` + `text/plain` | Extension → document.execCommand |
| `normalizeWebflowJson(json)` | Strip transitions, add root node if needed | N/A | N/A |
| `copyWithClipboardApi(json)` | Modern Clipboard API (ClipboardItem) | `application/json` | N/A |
| `copyViaExtension(json)` | Via Chrome extension (custom events) | `application/json` | Timeout 5s |
| `copyFallback(json)` | document.execCommand('copy') | `application/json` | None |

#### Clipboard Flow

**Primary Method** (no extension needed):
```typescript
const clipboardItem = new ClipboardItem({
  "application/json": new Blob([json], { type: "application/json" }),
  "text/plain": new Blob([json], { type: "text/plain" })
})
await navigator.clipboard.write([clipboardItem])
```

**Works in**: Chrome, Edge (modern browsers)

**Extension Detection**:
```typescript
document.documentElement.hasAttribute("data-flowstach-extension")
```

If extension installed → uses custom events:
```typescript
window.dispatchEvent(new CustomEvent("flowstach-copy", { detail: { payload: json } }))
// Extension listens and writes to clipboard
```

**Fallback** (last resort):
```typescript
document.addEventListener("copy", (e) => {
  e.clipboardData?.setData("application/json", json)
})
document.execCommand("copy")
```

#### Webflow JSON Normalization

**`normalizeWebflowJson()`** does:
1. Strip `transition` CSS properties (Webflow paste parser chokes on some syntax)
2. If no nodes but styles exist, add a root `Block` node (for token-only payloads)

#### Copy Buttons in UI

| Location | Button | Copies |
|----------|--------|--------|
| `/assets/[slug]` | "Copy to Webflow" | Webflow JSON (via `copyWebflowJson`) |
| `/assets/[slug]` | "Copy Code" | HTML + CSS + JS (via `copyText`) |
| `/admin/import` | "Copy" (per component) | Webflow JSON |
| `/admin/import` | "Copy Code" (per component) | HTML + CSS |
| Chrome extension | "Copy" (per artifact) | Webflow JSON or code |

#### Extension Clipboard Flow

**Flow Bridge Extension** (`flow-bridge-extension/`):

1. User clicks "Copy" in popup
2. Popup calls `api.projects.getArtifactContent(artifactId)` (Convex query)
3. Popup sends message to background service worker:
   ```typescript
   chrome.runtime.sendMessage({ type: "copy", data: json })
   ```
4. Background creates offscreen document (if not exists):
   ```typescript
   chrome.offscreen.createDocument({ url: "offscreen.html", ... })
   ```
5. Offscreen document writes to clipboard:
   ```typescript
   navigator.clipboard.write([new ClipboardItem({ "application/json": blob })])
   ```

**Why offscreen?** Service workers can't access `navigator.clipboard.write()`. Offscreen documents can.

#### Full Site Copy

**IMPLEMENTED** via the `templates` → `assets` → `payloads` data model:

1. User imports HTML → creates a **template** (e.g., "Flowbridge")
2. Template contains **assets** organized by category
3. One category is **"Full Page"** — this IS the full site as one Webflow JSON payload
4. Each asset has a **payload** with Webflow JSON
5. The web app has "Copy Full Site" button that copies the Full Page asset's payload

**Note**: The `importProjects` + `importArtifacts` tables are a separate import pipeline used internally. The user-facing data model is `templates` → `assets` → `payloads`.

---

## Part 7: Auth System

### Clerk Setup

**Provider**: Clerk (`@clerk/nextjs`)

**Configuration**: `convex/auth.config.ts`

**Environment Variables**:
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
```

### Auth Provider Hierarchy

**File**: `app/layout.tsx`

```
ClerkProvider
  └── ThemeProvider (next-themes)
       └── ConvexClientProvider
            └── InitUser (auto-sync)
                 └── App content
```

**`InitUser` component** (`components/auth/InitUser.tsx`):
- Calls `api.users.ensureFromClerk` mutation on mount
- Syncs Clerk user to Convex `users` table
- Sets role to "user" by default

### Protected Routes

**Middleware**: `middleware.ts`

**Protected Routes**:
- `/assets(.*)` (requires authentication)

**Unprotected Routes**:
- `/` (redirects to `/assets`)
- `/sign-in`, `/sign-up`
- `/extension`, `/flow-bridge` (public landing pages)
- `/admin/*` (protected via `requireAdmin()` in Convex functions, not middleware)

### DISABLE_AUTH Flag

**File**: `middleware.ts`

```typescript
const DISABLE_AUTH = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true"

export default DISABLE_AUTH
  ? () => NextResponse.next()
  : clerkMiddleware(...)
```

**When enabled**: All routes accessible without auth.

**Used for**: Local testing, development.

### Admin Access

**Determined by**: `NEXT_PUBLIC_ADMIN_EMAILS` env var (comma-separated)

**Check**: `convex/auth.ts` - `requireAdmin()` function

```typescript
const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",") || []
const user = await getCurrentUser(ctx)
const isAdmin = user && adminEmails.includes(user.clerkId) // (or email?)
if (!isAdmin) throw new ConvexError("Admin access required")
```

### Extension Auth

**Flow Bridge Extension** (`flow-bridge-extension/`):

**Auth Method**: Clerk `syncHost`

```typescript
<ClerkProvider
  publishableKey={VITE_CLERK_PUBLISHABLE_KEY}
  syncHost={VITE_SYNC_HOST} // e.g., "http://localhost:3000"
>
  <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
    <App />
  </ConvexProviderWithClerk>
</ClerkProvider>
```

**How it works:**
1. User signs in on `flowstach.com`
2. Clerk session stored in browser cookies
3. Extension syncs session from `flowstach.com` domain
4. Extension has access to Convex with user context

**Limitation**: OAuth not supported in extension popup (use email/password).

---

## Part 8: Environment & Deployment

### Required Environment Variables

**From `.env.local.example`:**

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Disable auth for testing
# NEXT_PUBLIC_DISABLE_AUTH=true

# Convex Database
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Admin Access
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com

# OpenRouter (LLM conversion - optional)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=openai/gpt-4.1
```

### Current State

**Deployment Status**: **Localhost Only**

- No production domain configured
- No Vercel/Netlify deployment
- Convex backend: Likely dev environment (check `NEXT_PUBLIC_CONVEX_URL`)

### Convex Deployment

**Commands**:
```bash
bun run convex:dev      # Development (local)
bun run convex:deploy   # Production
```

**Check**: Run `convex dev` output to see environment.

### Missing for Production

1. **Domain**: Register and configure (e.g., `flowstach.com`)
2. **Hosting**: Deploy to Vercel/Netlify/etc.
3. **Convex**: Deploy to production (`bun run convex:deploy`)
4. **Clerk**: Configure production instance
5. **Environment Variables**: Add to hosting platform
6. **SSL/HTTPS**: Required for Clerk and Convex
7. **Extension Icons**: Add actual icons (currently placeholders)
8. **Chrome Web Store**: Publish extension (if desired)
9. **OpenRouter API Key**: For LLM features (if using)

---

## Part 9: Known Issues & TODOs

### TODOs Found

| File | Line | Context |
|------|------|---------|
| `Flow-Goodies-extension/src/data/sampleComponents.ts` | 10 | `thumbnail: '', // TODO: Add thumbnail` |
| `lib/css-parser.ts` | 913 | `// TODO: handle pseudo + breakpoint variants if needed` |
| `lib/clipboard.ts` | 104 | `if (!text || text === "TODO") { /* placeholder check */ }` |

**Note**: Very few TODOs found. Codebase is well-maintained.

### Known Limitations

**From Documentation & READMEs:**

#### Flow-Goodies Extension
- CSS parsing is basic (regex-based)
- No support for nested selectors (`.parent .child`)
- No pseudo-class support (`:hover`, `:focus`)
- No media queries
- HTML attributes not fully preserved
- JavaScript components show alert (no auto-inject)

#### Flow Bridge Extension
- OAuth not supported in popup
- Chrome only (uses offscreen API)
- Requires web app auth sync

#### Web App
- No full-site copy feature (yet)
- LLM conversion optional (requires OpenRouter API key)
- No batch asset deletion UI (admin must use Convex dashboard)

#### Conversion Pipeline
- Transition CSS properties stripped (Webflow paste parser issues)
- Token-only payloads need root node added
- Pseudo + breakpoint variant combinations not fully handled

### Errors Array

**From `lib/html-parser.ts`:**
- `ParseResult` includes `errors: string[]` array
- Collects non-fatal parsing issues
- Displayed to user in import wizard

---

## Part 10: Tests

### Test Directory: `tests/`

**Files**:
1. `css-units.test.ts` (12KB) - Tests CSS unit parsing
2. `flowbridge-semantic.test.ts` (2KB) - Tests semantic naming
3. `gradient-transform-decoupler.test.ts` (10KB) - Tests gradient transforms
4. `intent-preservation.test.ts` (6KB) - Tests design intent preservation
5. `repro_issue.ts` (3KB) - Reproduction script for specific issue
6. `repro_typography.ts` (1KB) - Reproduction script for typography issue
7. `responsive-layout.test.ts` (2KB) - Tests responsive layout conversion

### Test Commands

**From `package.json`:**
```json
{
  "scripts": {
    "test:flowbridge": "tsx tests/flowbridge-semantic.test.ts"
  }
}
```

**Note**: No test runner configured (no Jest, Vitest, etc.). Tests run via `tsx` (TypeScript execution).

### What's Tested

| Area | File | Coverage |
|------|------|----------|
| CSS Units | `css-units.test.ts` | Rem, em, px, vh, vw parsing |
| Semantic Naming | `flowbridge-semantic.test.ts` | LLM semantic naming |
| Gradient Transforms | `gradient-transform-decoupler.test.ts` | Linear/radial gradients |
| Intent Preservation | `intent-preservation.test.ts` | Design intent in conversion |
| Responsive Layout | `responsive-layout.test.ts` | Media query handling |

### What's NOT Tested

- Convex backend functions (no integration tests)
- React components (no component tests)
- Auth flow (no auth tests)
- Clipboard operations (no DOM tests)
- Extension functionality (no extension tests)
- API routes (no API tests)

---

## Summary: What's Complete

### Core Features (Fully Working)

1. **User Authentication**
   - Clerk integration with sign-in/sign-up
   - Auto-sync to Convex
   - Admin role-based access
   - Auth sync in Chrome extension

2. **Asset Marketplace**
   - Browse published components
   - Search and category filtering
   - Favorites system
   - Template-based filtering
   - Asset detail pages with copy buttons

3. **Clipboard System**
   - Modern Clipboard API (ClipboardItem)
   - Webflow JSON with `application/json` MIME type
   - Code snippet copying
   - Extension fallback
   - Webflow paste compatibility

4. **HTML Import Wizard**
   - Parse AI-generated HTML
   - Extract tokens, CSS, JS
   - Componentize into reusable blocks
   - Generate Webflow JSON
   - Bulk import to database
   - LLM semantic naming (optional)

5. **React Converter**
   - Parse React components
   - Detect missing dependencies
   - Convert JSX → HTML
   - Convert event handlers → vanilla JS
   - Download as HTML file

6. **Convex Backend**
   - Complete schema (users, assets, payloads, favorites, import projects)
   - 31 queries/mutations
   - Auth helpers
   - Admin functions
   - User-scoped project access

7. **Flow Bridge Chrome Extension**
   - Auth-synced popup
   - Project list view
   - Artifact detail view
   - One-click copy to clipboard
   - Webflow-compatible clipboard writes

8. **Flow-Goodies Webflow Extension**
   - In-Designer component library UI
   - Search and category filters
   - HTML/CSS → Webflow conversion
   - Style deduplication
   - Copy to Designer canvas

### Documentation

- Comprehensive READMEs for both extensions
- CLAUDE.md project instructions
- AGENTS.md hierarchical documentation
- Detailed feature docs in `docs/features/`
- HTML breakdown process documentation
- CLI prompts for audits and workflows

---

## Summary: What's Incomplete

### Partially Built Features

1. **JavaScript Component Support**
   - Flow-Goodies shows alert for JS components
   - No auto-injection into Webflow custom code
   - **Workaround**: Manual copy-paste by user

2. **Media Queries**
   - CSS parser handles `@media` rules
   - Webflow converter may not fully support all breakpoints
   - **Needs testing**: Responsive components in Webflow

3. **Pseudo-Classes**
   - `:hover`, `:focus` partially supported
   - Complex pseudo-classes not handled
   - **Limitation**: May lose hover effects

4. **Nested Selectors**
   - `.parent .child` not supported in Flow-Goodies
   - Web app CSS parser handles some nesting
   - **Inconsistency**: Different parsing capabilities

5. **LLM Conversion**
   - Optional feature (requires API key)
   - Falls back to deterministic naming
   - **Incomplete**: No UI indicator when LLM is used

6. **Templates lack userId**
   - All templates visible to everyone, not user-scoped
   - **Missing**: User-specific template filtering

7. **Test Coverage**
   - Unit tests for core parsers
   - **Missing**: Integration tests, component tests, E2E tests

---

## Summary: What's Broken

**No critical broken features identified.**

All tested features appear to work as documented.

**Minor Issues:**
- CSS parsing edge cases (nested selectors, complex pseudo-classes)
- JavaScript components require manual injection
- Extension OAuth limitation (use email/password)

---

## Summary: What's Missing

### Features Implied by Architecture But Not Implemented

1. **Template Management UI**
   - Backend has `templates.ts` mutations (rename, delete)
   - **Missing**: Frontend UI for managing templates
   - **Workaround**: Use Convex dashboard

2. **Batch Asset Operations**
   - Backend has `admin.clearAllAssets` mutation
   - **Missing**: UI for batch delete, batch update

3. **Component Versioning**
   - Schema supports `updatedAt` timestamps
   - **Missing**: Version history, rollback

4. **Asset Analytics**
   - **Missing**: View counts, popular components, usage tracking

5. **Premium Gating**
   - Flow-Goodies has `isPremium` flag
   - **Missing**: Paywall, subscription logic

6. **Component Preview**
   - Schema has `previewImageUrl`, `previewVideoUrl`
   - **Missing**: Live iframe preview

7. **Drag-and-Drop Upload**
   - **Missing**: HTML file upload UI (currently paste-only)

8. **Export/Import**
   - **Missing**: Export project as ZIP, import from file

9. **Team Collaboration**
   - Schema only has `userId` (single owner)
   - **Missing**: Shared projects, permissions

10. **Backend Connection for Flow-Goodies**
    - Extension uses hardcoded sample components
    - **Missing**: Fetch real components from Convex

11. **Auto-Publish Workflow**
    - Assets have `status: "draft" | "published"`
    - **Missing**: Approval workflow, publish queue

12. **Search Indexing**
    - Basic string matching in `assets.list` query
    - **Missing**: Full-text search, fuzzy matching

---

## Critical Questions & Ambiguities

1. **Which extension is primary?**
   - Flow-Goodies (in-Designer) or Flow Bridge (browser popup)?
   - Are they meant to work together or separately?

2. **Is there a live domain?**
   - `NEXT_PUBLIC_SYNC_HOST` suggests `flowstach.com`
   - **Check**: Is this domain registered/deployed?

3. **Convex environment?**
   - Dev or production?
   - **Check**: `NEXT_PUBLIC_CONVEX_URL` value

4. **OpenRouter API key?**
   - LLM features require it
   - **Check**: Is it configured in production `.env`?

5. **Admin emails?**
   - `NEXT_PUBLIC_ADMIN_EMAILS` must be set
   - **Check**: Who has admin access?

6. **Extension icons?**
   - Both extensions have placeholder icons
   - **Check**: Do actual icon assets exist?

7. **Chrome Web Store?**
   - Is Flow Bridge published?
   - **Check**: Extension ID, installation URL

8. **Webflow Designer Extension App?**
   - Is Flow-Goodies registered with Webflow?
   - **Check**: Client ID, app status

---

## Recommendations

### High Priority

1. **Clarify Extension Strategy**
   - Decide primary extension
   - Document user journey (which extension for what task)
   - Consider merging if redundant

2. **Production Deployment**
   - Deploy web app to Vercel/Netlify
   - Configure domain (`flowstach.com`)
   - Deploy Convex to production
   - Set production env vars

3. **Connect Flow-Goodies to Backend**
   - Replace sample data with Convex queries
   - Add Clerk auth to extension
   - Sync components with web app

4. **Improve Test Coverage**
   - Add integration tests for Convex functions
   - Add component tests (React Testing Library)
   - Add E2E tests (Playwright)

5. **Complete JavaScript Support**
   - Auto-inject scripts into Webflow custom code (if API supports)
   - Or provide clear user instructions

### Medium Priority

6. **Template Management UI**
   - Build admin UI for template CRUD
   - Show template list, rename, delete

7. **Batch Operations**
   - Add bulk delete UI
   - Add bulk status change (draft <-> published)

8. **Enhanced Search**
   - Implement full-text search
   - Add fuzzy matching

9. **Analytics**
   - Track asset views, copies
   - Show popular components

10. **Better Documentation**
    - User guide for non-technical users
    - Video tutorials

### Low Priority

11. **Component Versioning**
    - Track history, allow rollback

12. **Team Features**
    - Shared projects, permissions

13. **Premium Features**
    - Implement paywall, subscriptions

14. **Live Preview**
    - Iframe preview of components

---

**END OF AUDIT**
