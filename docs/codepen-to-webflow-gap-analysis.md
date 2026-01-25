# CodePen → Webflow Import: Gap Analysis & Implementation Plan

**Date:** 2026-01-25
**Status:** Planning (not implemented yet)
**Goal:** Enable CodePen URL → Webflow-ready import, reusing existing pipeline

---

## Sequence Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         CodePen → Webflow Pipeline                              │
└────────────────────────────────────────────────────────────────────────────────┘

                                        ┌───────────────────┐
     User pastes CodePen URL            │   /workspace/     │
              │                         │     import        │
              ▼                         │   (page.tsx)      │
┌─────────────────────────┐             └─────────┬─────────┘
│                         │                       │
│  CodePen URL Input      │───────────────────────┤
│  (e.g. codepen.io/      │                       ▼
│   osmosupply/pen/XXX)   │         ┌─────────────────────────┐
│                         │         │                         │
└─────────────────────────┘         │  CodePen Resolver       │◄───── NEW
                                    │  (lib/codepen-resolver) │
                                    │                         │
                                    │  • Fetch oEmbed/API     │
                                    │  • Extract HTML         │
                                    │  • Extract CSS          │
                                    │  • Extract JS           │
                                    │  • Parse external URLs  │
                                    └───────────┬─────────────┘
                                                │
                                                ▼
                                    ┌─────────────────────────┐
                                    │                         │
                                    │  Multi-file ImportInput │◄───── EXISTING
                                    │  (normalize contract)   │
                                    │                         │
                                    │  {                      │
                                    │    htmlText: string     │
                                    │    cssText: string      │
                                    │    jsText: string       │
                                    │    cssUrls: string[]    │
                                    │    jsUrls: string[]     │
                                    │    provenance: 'codepen'│
                                    │  }                      │
                                    └───────────┬─────────────┘
                                                │
                           ┌────────────────────┴────────────────────┐
                           │                                         │
                           ▼                                         │
              ┌─────────────────────────┐                            │
              │                         │                            │
              │  Validation Layer       │◄───── EXISTING + EXTEND    │
              │                         │                            │
              │  • validateLibraryImports() ◄── extend for conflicts │
              │  • detectExternalResources()                         │
              │  • preflight patterns check ◄── NEW: CodePen-specific│
              └───────────┬─────────────┘                            │
                          │                                          │
                          ▼                                          │
              ┌─────────────────────────┐                            │
              │                         │                            │
              │  processProjectImport() │◄───── EXISTING             │
              │  (lib/project-engine)   │                            │
              │                         │                            │
              │  Stage 1: Parsing       │                            │
              │  Stage 2: Extraction    │                            │
              │  Stage 3: Componentizing│                            │
              │  Stage 3b: BEM Rename   │                            │
              │  Stage 4: Semantic      │                            │
              │  Stage 5: Generating    │                            │
              └───────────┬─────────────┘                            │
                          │                                          │
                          ▼                                          │
              ┌─────────────────────────┐                            │
              │                         │                            │
              │  Safety Gate            │◄───── EXISTING             │
              │  (lib/webflow-safety-   │                            │
              │   gate.ts)              │                            │
              │                         │                            │
              │  • Sanitize HTML        │                            │
              │  • Strip handlers       │                            │
              │  • Size limits          │                            │
              └───────────┬─────────────┘                            │
                          │                                          │
                          ▼                                          │
              ┌─────────────────────────┐                            │
              │                         │                            │
              │  Convex Storage         │◄───── EXISTING             │
              │  (api.import.           │                            │
              │   importProject)        │                            │
              │                         │                            │
              │  → importProjects       │                            │
              │  → importArtifacts      │                            │
              │  → templates            │                            │
              │  → assets               │                            │
              │  → payloads             │                            │
              └───────────┬─────────────┘                            │
                          │                                          │
                          ▼                                          │
              ┌─────────────────────────┐                            │
              │                         │                            │
              │  Project Inspect        │◄───── EXISTING             │
              │  /workspace/projects/   │                            │
              │  [id]                   │                            │
              │                         │                            │
              │  → Overview             │                            │
              │  → Code                 │                            │
              │  → Components           │                            │
              │  → Style Guide          │                            │
              └─────────────────────────┘                            │
                                                                     │
                           ◄─────────────────────────────────────────┘
                            Data flows back if validation fails
```

---

## 1. What Exists Today

### 1.1 Import Pipeline Architecture

| Stage | File | Function | Status |
|-------|------|----------|--------|
| **Entry Point** | `app/(authenticated)/workspace/import/page.tsx` | `ImportForm` | ✅ Has CodePen UI stub (lines 59-135) |
| **Pipeline Orchestration** | `lib/project-engine.ts` | `processProjectImport()` | ✅ Full implementation |
| **Parsing** | `lib/html-parser.ts` | `extractCleanHtml()` | ✅ |
| **Normalization** | `lib/webflow-normalizer.ts` | `normalizeHtmlCssForWebflow()` | ✅ |
| **CSS Parsing** | `lib/css-parser.ts` | `parseCSS()` | ✅ |
| **Token Extraction** | `lib/token-extractor.ts` | `extractTokens()` | ✅ |
| **Componentization** | `lib/componentizer.ts` | `componentizeHtml()` | ✅ |
| **BEM Renaming** | `lib/bem-renamer.ts` | `renameClassesForProject()` | ✅ |
| **Webflow Conversion** | `lib/webflow-converter.ts` | `buildCssTokenPayload()`, `buildComponentPayload()` | ✅ |
| **Safety Gate** | `lib/webflow-safety-gate.ts` | `ensureWebflowPasteSafety()` | ✅ |
| **Sanitization** | `lib/webflow-sanitizer.ts` | `sanitizeWebflowPayload()` | ✅ |
| **Validation** | `lib/preflight-validator.ts` | `runPreflightValidation()` | ✅ |

### 1.2 Current Multi-File Import Contract

The import page already accepts multi-file input (lines 74-78, 450-564):

```typescript
// State in ImportForm
const [htmlText, setHtmlText] = useState("");
const [cssText, setCssText] = useState("");
const [jsText, setJsText] = useState("");
const [cssUrls, setCssUrls] = useState<string[]>([]);
const [jsUrls, setJsUrls] = useState<string[]>([]);
```

The `MultiFileEditor` component supports:
- HTML text (required)
- CSS text (optional)
- JS text (optional)
- External CSS URLs array
- External JS URLs array

### 1.3 External Resource Detection (Existing)

**File:** `lib/external-resource-detector.ts`

Already detects:
- `<link rel="stylesheet" href="...">` tags
- `<script src="...">` tags
- Classifies as relative (ERROR) vs absolute/CDN (WARNING)
- Known CDN domain mapping (50+ domains including jsDelivr, unpkg, Google Fonts, etc.)

### 1.4 Library Validation (Existing but Not Wired)

**File:** `lib/validation/embed-validator.ts`

`validateLibraryImports()` exists but only checks:
- HTTPS enforcement
- Known CDN check

**NOT implemented:**
- Duplicate library detection
- jQuery version conflict detection
- Library compatibility checking

### 1.5 CodePen UI Stub (Existing)

**File:** `app/(authenticated)/workspace/import/page.tsx` (lines 112-135)

Current stub:
- Accepts CodePen URL input
- Has "Fetch" button
- Shows placeholder content after 1.5s timeout
- Populates multi-file editor with stub data

**Missing:**
- Actual CodePen fetch implementation
- Real HTML/CSS/JS extraction
- External library URL parsing

---

## 2. What CodePen Import Needs

### 2.1 CodePen URL Structure

```
Public Pen:      https://codepen.io/{user}/pen/{slug}
Full Page View:  https://codepen.io/{user}/full/{slug}
Debug Mode:      https://codepen.io/{user}/debug/{slug}
```

### 2.2 Data Extraction Methods

#### Option A: oEmbed API (Simple, Limited)
```
GET https://codepen.io/api/oembed?url=https://codepen.io/{user}/pen/{slug}&format=json
```

Returns:
- `html` - iframe embed HTML (not the actual source)
- `title`, `author_name`, `author_url`
- **Limitation:** Does NOT return actual HTML/CSS/JS source

#### Option B: Export Endpoint (Requires Auth)
```
GET https://codepen.io/{user}/pen/{slug}/export.zip
```
- Requires authentication
- Returns ZIP with index.html, style.css, script.js, dist/, README.md
- **Best for full source access**

#### Option C: Page Scraping (Fallback)
```
GET https://codepen.io/{user}/pen/{slug}.js
```
Returns JSONP with:
- `html`, `css`, `js` source
- `css_external`, `js_external` (external resource URLs)
- `head`, `css_pre_processor`, `js_pre_processor`
- `resources` array

**Recommended approach:** Option C (`.js` endpoint) - no auth required, returns structured data.

### 2.3 Normalized Import Input Contract

CodePen resolver should output this structure:

```typescript
interface CodePenResolvedContent {
  // Core content
  htmlText: string;
  cssText: string;
  jsText: string;

  // External resources (from Pen Settings)
  cssUrls: string[];   // External CSS libraries
  jsUrls: string[];    // External JS libraries

  // Metadata
  provenance: 'codepen';
  penUrl: string;
  penSlug: string;
  author: string;
  title: string;

  // Preprocessor info (for warnings)
  cssPreprocessor?: 'scss' | 'sass' | 'less' | 'stylus' | null;
  jsPreprocessor?: 'babel' | 'typescript' | 'coffeescript' | null;

  // Validation hints
  warnings: string[];
}
```

### 2.4 Step-by-Step Fetch/Parse Flow

```
1. User enters CodePen URL
   ↓
2. Parse URL to extract {user}/{slug}
   ↓
3. Fetch https://codepen.io/{user}/pen/{slug}.js
   ↓
4. Parse JSONP response (strip callback wrapper)
   ↓
5. Extract:
   - html → htmlText
   - css → cssText
   - js → jsText
   - css_external → cssUrls[]
   - js_external → jsUrls[]
   - title → projectName suggestion
   ↓
6. Detect preprocessors (warn if SCSS/TypeScript)
   ↓
7. Validate external URLs (HTTPS, known CDNs)
   ↓
8. Populate MultiFileEditor with extracted content
   ↓
9. User reviews/edits, clicks Import
   ↓
10. Pass to processProjectImport() (existing pipeline)
```

---

## 3. Gaps Checklist

| # | Gap | Effort | Risk | Dependency | Suggested Approach |
|---|-----|--------|------|------------|-------------------|
| **G1** | CodePen URL parser | S | Low | None | Regex to extract `{user}/pen/{slug}` from various URL formats |
| **G2** | CodePen fetch implementation | M | Medium | None | Fetch `.js` endpoint, parse JSONP, extract content |
| **G3** | External resources extraction | S | Low | G2 | Parse `css_external`, `js_external` from response |
| **G4** | Preprocessor detection + warning | S | Low | G2 | Check `css_pre_processor`, `js_pre_processor` fields |
| **G5** | Library conflict detection | M | Medium | None | Extend `validateLibraryImports()` for duplicate jQuery, conflicting GSAP versions |
| **G6** | CodePen-specific pattern detection | M | High | None | Add validators for common CodePen anti-patterns (document.write, canvas-heavy, etc.) |
| **G7** | CORS handling | M | High | G2 | CodePen may block direct fetch; need proxy API route |
| **G8** | Rate limiting | S | Low | G7 | Debounce fetch, cache results |
| **G9** | Error handling UI | S | Low | G2 | Handle 404, private pens, rate limits gracefully |
| **G10** | Integration tests | M | Low | All | Test fixtures with real CodePen URLs |

### Effort Legend:
- **S** = Small (1-2 hours)
- **M** = Medium (4-8 hours)
- **L** = Large (1-2 days)

---

## 4. Webflow Limitation Mapping

| Limitation | Detection Method | UI Message | Fallback Strategy |
|------------|-----------------|------------|-------------------|
| **Inline event handlers** (`onclick`, `onload`, etc.) | Regex `on\w+=` in HTML | ⚠️ "Inline handlers removed. Recreate as JS listeners." | Auto-strip, preserve logic in JS comment |
| **document.write()** | Regex in JS | 🚫 "document.write() breaks Webflow. Manual refactor required." | Hard block with guidance |
| **Forbidden root tags** (`<html>`, `<head>`, `<body>`) | Tag detection | ✅ Auto-stripped (silent) | `prepareHTMLForWebflow()` |
| **Reserved `w-*` classes** | Prefix check | ⚠️ "Classes renamed: {list}" | BEM renamer handles |
| **Embed size > 50KB** | Byte count | 🚫 "Embed exceeds 50KB limit. Split or host externally." | Chunking (partial) |
| **CSS `@import`** | Regex `@import` | ⚠️ "CSS @import not supported. Inline the content." | Manual resolution |
| **CSS variables (partial)** | Var detection | ⚠️ "N CSS variables require fallback values." | Literalizer handles |
| **Modern CSS** (`:has()`, `@container`, etc.) | Feature detection | ⚠️ "Modern CSS features moved to embed." | Route to CSS embed |
| **jQuery version conflict** | Library detection | ⚠️ "Multiple jQuery versions detected." | Warn, dedupe suggestion |
| **GSAP version mismatch** | Version parsing | ⚠️ "GSAP version mismatch with plugins." | Warn, CDN alignment |
| **Canvas/WebGL** | Tag detection | ⚠️ "Canvas element requires JS initialization." | Pass-through with warning |
| **SVG with external refs** | `xlink:href` check | 🚫 "SVG external references won't load." | Inline suggestion |
| **SMIL animations** | `<animate>` tags | ⚠️ "SMIL animations deprecated. Convert to CSS/JS." | Warning |
| **Relative asset URLs** | URL classification | 🚫 "Relative URLs won't resolve. Host externally." | Hard block |
| **Preprocessor source** | Field check | ⚠️ "Pen uses {SCSS/TS}. Output is compiled, not source." | Info only |

---

## 5. Invalid CodePen Patterns (A/B/C Classification)

### Category A: Auto-fixable
*Pipeline can automatically handle these*

| Pattern | Detection | Auto-fix |
|---------|-----------|----------|
| Inline `onclick`, `onload`, etc. | Regex | Strip, warn user |
| `<html>`, `<head>`, `<body>` tags | Tag check | Auto-strip |
| Reserved `w-*` class names | Prefix match | BEM rename |
| CSS vendor prefixes (extra) | Property check | Pass through |
| `defer`/`async` script attributes | Attribute check | Preserve |
| Single quotes in HTML attributes | Quote detection | Normalize |
| Missing `alt` on images | Tag check | Add placeholder |

### Category B: Warn + Allow
*Let user proceed but surface clear warnings*

| Pattern | Detection | Warning Message |
|---------|-----------|-----------------|
| Canvas/WebGL elements | `<canvas>` tag | "Canvas requires custom JS initialization in Webflow." |
| SVG with filters | `<filter>` in SVG | "SVG filters may render differently in Webflow." |
| `requestAnimationFrame` loops | Regex in JS | "Animation loops must be manually started after page load." |
| LocalStorage/sessionStorage | API usage | "Storage APIs work in Webflow but data is per-domain." |
| Fetch/XMLHttpRequest | API usage | "API calls work but check CORS policy for your endpoints." |
| Multiple animation libraries | Library count | "Multiple animation libraries detected: {list}. May conflict." |
| iframe embeds | `<iframe>` tag | "iframes work but cannot be styled from parent." |
| Large inline base64 images | Data URI size | "Image {N}MB base64 increases page weight significantly." |
| CSS `calc()` nesting | Syntax check | "Deeply nested calc() may not render correctly." |
| Form elements | Form tags | "Forms require Webflow form handling or external service." |
| `position: sticky` | CSS property | "Sticky positioning works but test on all breakpoints." |
| CSS Grid subgrid | `subgrid` value | "Subgrid not supported in Safari <16. Fallback recommended." |

### Category C: Hard Block
*Must be resolved before import proceeds*

| Pattern | Detection | Block Message | Resolution |
|---------|-----------|---------------|------------|
| `document.write()` | Regex | "document.write() corrupts Webflow DOM. Remove or refactor to DOM methods." | Manual refactor |
| `eval()` / `new Function()` | Regex | "Dynamic code execution blocked for security." | Manual refactor |
| ES Modules (`import`/`export`) | Syntax detection | "ES modules not supported. Bundle with tool like Rollup." | Build step required |
| Top-level `await` | Syntax detection | "Top-level await requires module context." | Wrap in async IIFE |
| TypeScript source | `.ts` preprocessor | "Raw TypeScript not supported. Use compiled JS output." | Compile first |
| SCSS/Sass source | `.scss` preprocessor | "Raw SCSS not supported. Use compiled CSS output." | Compile first |
| Web Components | `customElements.define` | "Web Components not supported in Webflow." | Manual refactor |
| Shadow DOM | `attachShadow` | "Shadow DOM not supported. Use standard DOM." | Manual refactor |
| Server-side code | PHP/Python detection | "Server code cannot run in Webflow." | Remove |
| `<script type="module">` | Attribute check | "ES modules not supported in Webflow embed." | Bundle |
| Relative script `src` | URL check | "Relative scripts cannot be loaded. Host externally." | Host on CDN |
| Embed > 50KB (no chunk option) | Size check | "Content exceeds 50KB limit." | Split manually |

---

## 6. Implementation Plan

### Phase 1: Fetch/Parse + Normalization (Week 1)

**Goal:** CodePen URL → Multi-file editor populated

| Task | File | Description |
|------|------|-------------|
| 1.1 | `lib/codepen-resolver.ts` (NEW) | Create URL parser + `.js` endpoint fetcher |
| 1.2 | `app/api/codepen/fetch/route.ts` (NEW) | Proxy API route for CORS bypass |
| 1.3 | `lib/codepen-resolver.ts` | JSONP parser to extract HTML/CSS/JS/URLs |
| 1.4 | `app/.../import/page.tsx` | Wire `handleFetchCodePen()` to resolver |
| 1.5 | `lib/codepen-resolver.ts` | Preprocessor detection + warning generation |

**Deliverable:** User can paste CodePen URL, click Fetch, see real content in editor.

### Phase 2: Validations + Warnings (Week 2)

**Goal:** CodePen-specific validation layer before pipeline

| Task | File | Description |
|------|------|-------------|
| 2.1 | `lib/validation/codepen-validator.ts` (NEW) | Pattern detection for A/B/C categories |
| 2.2 | `lib/validation/embed-validator.ts` | Extend `validateLibraryImports()` for conflicts |
| 2.3 | `lib/validation/codepen-validator.ts` | Preprocessor warning integration |
| 2.4 | `app/.../import/page.tsx` | Show validation warnings/blocks in UI |
| 2.5 | `lib/external-resource-detector.ts` | Add CodePen-specific CDN domains (slater.app, etc.) |

**Deliverable:** Users see actionable warnings before import; blockers prevent submission.

### Phase 3: Hardening + Fixtures/Tests (Week 3)

**Goal:** Production-ready with regression coverage

| Task | File | Description |
|------|------|-------------|
| 3.1 | `tests/fixtures/codepen/` (NEW) | Add 3 fixture pens (see below) |
| 3.2 | `tests/codepen-resolver.test.ts` (NEW) | Unit tests for URL parsing, JSONP extraction |
| 3.3 | `tests/codepen-validator.test.ts` (NEW) | Pattern detection tests |
| 3.4 | `tests/regression/codepen-e2e.test.ts` (NEW) | End-to-end import tests |
| 3.5 | — | Edge case handling (private pens, 404, rate limits) |

**Test Fixtures:**

| Pen | URL | Why |
|-----|-----|-----|
| Simple (CSS-only button) | `https://codepen.io/digital_playground/pen/RwaVXOL` | No external deps, CSS animations |
| External CSS (Slater) | `https://codepen.io/osmosupply/pen/RNaeYqp` | Tests external stylesheet resolution |
| Heavy JS (GSAP) | `https://codepen.io/hexagoncircle/pen/LYpaPQp` | ScrollTrigger, complex init, CDN deps |

---

## 7. Open Questions

| # | Question | Impact | Suggested Resolution |
|---|----------|--------|---------------------|
| Q1 | Does CodePen `.js` endpoint have rate limits? | May need caching | Test empirically; implement cache in Convex if needed |
| Q2 | Should we support private pens via user auth? | Scope creep | Defer to v2; focus on public pens first |
| Q3 | How to handle Pens with preprocessors (SCSS/Babel)? | Output is compiled, not source | Warn user; proceed with compiled output |
| Q4 | Should external CSS be fetched and inlined? | Could exceed embed limits | Default to URL list; optional inline with size check |
| Q5 | What if CodePen blocks our proxy? | Pipeline breaks | Use server-side fetch; monitor for blocks |

---

## Appendix: Key File Paths Reference

### Existing Pipeline
- `app/(authenticated)/workspace/import/page.tsx` — Import UI
- `lib/project-engine.ts` — Pipeline orchestration
- `lib/html-parser.ts` — HTML extraction
- `lib/webflow-normalizer.ts` — CSS normalization
- `lib/webflow-converter.ts` — Webflow JSON generation
- `lib/webflow-safety-gate.ts` — Safety validation
- `lib/external-resource-detector.ts` — CDN detection
- `lib/validation/embed-validator.ts` — Embed limits

### New Files (to create)
- `lib/codepen-resolver.ts` — URL parsing + fetch + normalize
- `app/api/codepen/fetch/route.ts` — CORS proxy
- `lib/validation/codepen-validator.ts` — Pattern detection
- `tests/fixtures/codepen/*.json` — Test fixtures
- `tests/codepen-*.test.ts` — Test suites

---

**Report generated by Claude Code**
**Next step:** Phase 1 implementation (requires user approval)
