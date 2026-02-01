# Flowbridge — CodePen → Webflow Execution Prompts (UI already done)

This runbook assumes:
- The **CodePen tab UI is already implemented** and routes to `/workspace/import?source=codepen`.
- The **Multi-File editor** already exists (HTML/CSS/JS + `cssUrls[]` + `jsUrls[]`).
- The goal now is to make **Fetch** real, add **preflight validation + UX**, then harden with **tests**.

**Global guardrails (apply to EVERY prompt):**
- Keep changes **minimal and localized**.
- **No redesign**, no refactors unrelated to the task.
- Reuse existing contracts/components. **Do not fork pipelines.**
- Do **not** add new “CodePen project” types. CodePen creates normal Projects.
- If you touch a file: explain why.

---

## 0) Quick “definition of done” (so the CLI doesn’t hallucinate scope)

**Phase 1 DONE when:**
- User pastes a CodePen URL → clicks **Fetch** → editor populates with real HTML/CSS/JS + external URLs.
- Import uses the existing pipeline and creates a normal Project.
- Basic error states work (invalid URL, private pen, 404, fetch failure).

**Phase 2 DONE when:**
- Preflight shows **BLOCK / WARN / INFO** and blocks import only when needed.

**Phase 3 DONE when:**
- Tests run offline using fixtures; no live CodePen dependency.

---

## 1) Contract Doc (locks the rules)

**Why:** Prevent schema drift while implementing resolver + validation.

**Model:** `claude-opus`  
**Reasoning:** HIGH  
**Parallelizable:** No

```bash
claude-code   --model opus   --reasoning high   "Create /docs/tools/codepen/codepen-import-contract.md.

   MUST INCLUDE:
   1) Resolver return shape:
      - { input, meta, diagnostics }
   2) ImportInput (pipeline-facing, minimal):
      - projectName, htmlText, cssText, jsText, cssUrls[], jsUrls[], provenance:'codepen'
   3) Meta (UI/debug only, optional fields):
      - penUrl, user, slug, title, author, preprocessors, fetchedAt, sourceEndpoint
   4) ValidationMessage schema:
      - severity: block|warn|info
      - field: libraries|html|css|js|general
      - code, title, detail, evidence[], action{label, kind, payload}
   5) Validation split:
      - Preflight: fast checks after Fetch + again on Import
      - Postflight: pipeline-result checks (sizes, sanitizer diffs)
   6) Minimum severity rules:
      - BLOCK: document.write, eval/new Function, ES modules import/export or script type=module, empty htmlText,
              relative external URLs, clearly over embed limits
      - WARN: canvas/webgl, SVG filters/SMIL, storage APIs, fetch/xhr usage, preprocessors detected
      - INFO: provenance + general notices

   STYLE:
   - opinionated, compact, implementation-ready
   - no marketing fluff
   - do NOT add new product features
   - keep changes minimal and localized"
```

---

## 2) Resolver + Proxy (Fetch becomes real)

**Why:** This is the heart of CodePen support. No pipeline changes.

**Model:** `claude-opus`  
**Reasoning:** HIGH  
**Parallelizable:** No

```bash
claude-code   --model opus   --reasoning high   "Implement Phase 1A: CodePen resolver + server proxy. UI and pipeline must remain unchanged.

   Follow:
   - /docs/codepen-to-webflow-gap-analysis.md
   - /docs/tools/codepen/codepen-import-contract.md

   REQUIREMENTS:
   A) NEW: lib/codepen-resolver.ts
      - export resolveCodePen(penUrl: string): Promise<{ input, meta, diagnostics }>
      - Parse URL variants: /pen/, /full/, /debug/ into {user, slug}
      - Resolve source from: https://codepen.io/{user}/pen/{slug}.js
      - Parse JSONP safely (strip callback wrapper, JSON.parse)
      - Extract:
        - html -> input.htmlText
        - css  -> input.cssText
        - js   -> input.jsText
        - css_external -> input.cssUrls[]
        - js_external  -> input.jsUrls[]
        - title -> suggested projectName if empty
      - Set input.provenance='codepen'
      - Build meta: penUrl, user, slug, title, author, preprocessors, fetchedAt, sourceEndpoint='pen.js'
      - diagnostics can be empty for now (Phase 2 will expand)

   B) NEW: app/api/codepen/fetch/route.ts (server-side proxy)
      - Accept penUrl (query or JSON body). Validate it is a CodePen URL.
      - Server-fetch the .js endpoint and return raw text.
      - Error handling:
        - invalid URL (400)
        - private/blocked/404 (return structured error)
        - upstream failures (502)
      - Add small cache header or in-memory cache if trivial (optional)

   C) Tests (unit-level, offline where possible)
      - tests for:
        - URL parsing
        - JSONP parsing
        - external URL extraction
      - If test framework exists, use it. Otherwise add minimal tests consistent with repo.

   CONSTRAINTS:
   - NO changes to processProjectImport / project-engine pipeline.
   - NO UI changes in this step.
   - NO live network in tests (use fixture strings for JSONP).

   DELIVERABLES:
   - list files changed/created
   - how resolver is called
   - known limitations left for Phase 2"
```

---

## 3) UI Wiring (Fetch button calls resolver and populates editor)

**Why:** Connect your existing UI to the resolver. Keep scope tiny.

**Model:** `gpt-5.2-codex-mini`  
**Reasoning:** LOW  
**Parallelizable:** Only after step 2

```bash
codex   --model gpt-5.2-codex-mini   --reasoning low   "Wire the CodePen UI Fetch button to the new resolver with minimal changes.

   REQUIREMENTS:
   - Replace any existing Fetch stub with real logic.
   - On Fetch:
     - call the server proxy /api/codepen/fetch with the pen URL
     - pass returned text into lib/codepen-resolver.ts (or call resolver endpoint if implemented that way)
     - set component state:
       htmlText, cssText, jsText, cssUrls, jsUrls
     - if projectName is empty, set it to resolved title
   - Show errors inline near the URL field:
     - invalid URL
     - 404/private
     - fetch failure
   - Do NOT run import pipeline on Fetch.
   - Do NOT restyle, refactor, or rename unrelated components.

   DELIVERABLES:
   - list files changed
   - how errors are presented
   - confirm existing Multi-File editor inputs are populated correctly"
```

---

## 4) Preflight Validation + UX (BLOCK / WARN / INFO)

**Why:** Prevent dead imports and set expectations.

**Model:** `claude-sonnet`  
**Reasoning:** MEDIUM  
**Parallelizable:** No (touches submit gating + UX)

```bash
claude-code   --model sonnet   --reasoning medium   "Implement CodePen preflight validation and UI hierarchy (block/warn/info) with minimal changes.

   Follow /docs/tools/codepen/codepen-import-contract.md.

   REQUIREMENTS:
   A) NEW: lib/validation/codepen-preflight.ts
      - export runCodePenPreflight(input, meta): { blockers, warnings, infos }
      - Implement MINIMUM rules:

        BLOCK:
        - empty htmlText
        - document.write()
        - eval() or new Function()
        - ES modules: 'import ' or 'export ' in JS OR <script type='module'> usage
        - relative URLs in cssUrls/jsUrls (non-https, starts with '/', './', '../')
        - clearly over embed limits if you can compute (otherwise warn)

        WARN:
        - <canvas> or WebGL usage
        - SVG filters or SMIL animate tags
        - localStorage/sessionStorage
        - fetch/XMLHttpRequest
        - preprocessors detected (SCSS/TS/Babel flags in meta)

        INFO:
        - provenance and general notices

   B) UI:
      - Add a compact “Health” panel above the editor:
        - counts: blockers/warnings/info
        - expandable list
      - Inline hints:
        - show library-related messages near Libraries section
        - html/css/js messages near their editors
      - Import button behavior:
        - if blockers exist: disable or block submit + scroll to panel + toast 'Fix blockers before importing.'
        - if only warnings: allow import

   C) Integration:
      - Run preflight after Fetch and again on Import click (because user can edit).
      - Do NOT modify core pipeline. Only gate before calling existing import.

   DELIVERABLES:
   - list files changed
   - list of rules implemented
   - screenshots not required, but describe where UI appears"
```

---

## 5) Library Conflict Detection (Optional but recommended)

**Why:** CodePen pens often include duplicates (GSAP/jQuery). Keep as WARN.

**Model:** `claude-sonnet`  
**Reasoning:** MEDIUM  
**Parallelizable:** Yes (after step 4)

```bash
claude-code   --model sonnet   --reasoning medium   "Add library conflict detection for cssUrls/jsUrls and surface as WARN in the Health panel.

   REQUIREMENTS:
   - Extend existing library validation (or add new validator) to detect:
     - duplicate URLs
     - multiple jQuery versions
     - likely GSAP core + plugin mismatches (best-effort)
   - Output WARN messages with clear guidance:
     - what was detected
     - suggested fix (remove duplicates / align versions)
   - Wire results into preflight diagnostics under field='libraries'
   - No breaking changes to existing library validators.

   DELIVERABLES:
   - files changed
   - examples of detections"
```

---

## 6) Fixtures + Tests (Hardening)

**Why:** Avoid regressions and avoid relying on live CodePen.

**Model:** `claude-opus`  
**Reasoning:** HIGH  
**Parallelizable:** No

```bash
claude-code   --model opus   --reasoning high   "Add offline fixtures and tests for CodePen import (resolver + preflight + pipeline integration if feasible).

   REQUIREMENTS:
   - Create tests/fixtures/codepen/ with at least 3 fixtures:
     1) simple pen output
     2) external CSS (Slater) pen output
     3) heavy JS (GSAP) pen output
   - Fixtures must store:
     - raw JSONP response text OR parsed object
     - expected normalized ImportInput
   - Add tests for:
     - URL parsing
     - JSONP parsing
     - external URLs extraction
     - preflight severity classification
   - Add one integration-style test that runs:
     resolver -> preflight -> existing import entry (mock or real depending on repo)
   - Tests must not hit the network.

   DELIVERABLES:
   - how to run tests
   - files added/changed
   - what is covered and what is not"
```

---

## Extra: “Don’t go rogue” line you can append to any prompt

Add this to the end of any prompt if you’ve been burned before:

> "Do not refactor unrelated code, rename files, or change styling. Keep diff minimal and localized to this task only."
