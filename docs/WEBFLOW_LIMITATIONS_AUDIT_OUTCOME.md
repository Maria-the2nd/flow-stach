# Webflow Limitations Audit — Outcome Summary

Date: 2026-01-24

This document summarizes the current state of the Webflow paste-safety audit and the safeguards implemented across the Flow Bridge conversion + export pipeline. It is meant to be a living reference so we can keep iterating on fixes without losing context.

## Scope

Audit focus:
- Webflow Designer paste safety (JSON payloads + embeds).
- Webflow Custom Code limitations (size limits, forbidden tags, inline handlers, unsupported CSS/JS).
- Crash‑prone patterns (duplicate IDs, invalid variants, circular references, depth overflow, unsafe embeds).

Primary sources of truth:
- `AUTHORITATIVE_CURRENT_STATE.md`
- `docs/WEBFLOW_CUSTOM_CODE_LIMITATIONS.md`
- `docs/webflow-export-surfaces.md`

## Outcome Summary (What Exists Now)

### 1) Shared Safety Gate (implemented)

Single, centralized gate in `lib/webflow-safety-gate.ts` that:
- Runs preflight validation and blocks unsafe payloads.
- Invokes sanitization when needed and revalidates.
- Sanitizes HtmlEmbed content via `prepareHTMLForWebflow` and removes inline handlers.
- Strips forbidden root tags (`doctype`, `html`, `head`, `body`) from embed HTML.
- Enforces Webflow embed size limits (hard 50,000 chars; soft 40,000 chars).
- Produces a structured Safety Report for UI surfaces.

### 2) Export Surfaces Routed Through the Safety Gate

The safety gate is now used on both conversion paths and UI copy surfaces:
- API conversion route: `app/api/webflow/convert/route.ts`
- Engine path: `lib/project-engine.ts`
- Clipboard: `lib/clipboard.ts`
- UI: project detail view, asset detail, components list, import wizard, asset content panels
  - `components/workspace/project-details-view.tsx`
  - `components/project/components-list.tsx`
  - `components/assets/AssetsContent.tsx`
  - `components/asset-detail/AssetDetailMain.tsx`
  - `components/admin/ImportWizard.tsx`

### 3) Safety Report UI

Safety report is exposed in:
- Components list (per component).
- Project site structure panel.
- Import wizard summary.
- Asset/Library surfaces.

The report surfaces:
- Fatal issues (block copy).
- Warnings.
- Auto-fixes and extracted embed content.
- Embed size checks.
- HtmlEmbed sanitization results.

## Webflow Limitations Coverage Matrix

The table below maps key Webflow limitations to their current enforcement status.

| Limitation / Risk | Status | Enforcement Location | Notes |
| --- | --- | --- | --- |
| Duplicate UUIDs | Enforced | `lib/preflight-validator.ts`, `lib/webflow-sanitizer.ts` | Sanitizer regenerates duplicates; preflight blocks if unsafe. |
| Orphan nodes / circular refs | Enforced | `lib/preflight-validator.ts`, `lib/webflow-sanitizer.ts` | Auto‑fix + revalidate. |
| Invalid variant keys / reserved classes | Enforced | `lib/preflight-validator.ts`, `lib/webflow-sanitizer.ts` | Invalid keys stripped; reserved class names prevented. |
| Excessive nesting depth | Enforced | `lib/webflow-sanitizer.ts` + safety gate | Depth above `SAFE_DEPTH_LIMIT` triggers flattening to HtmlEmbed. |
| HtmlEmbed crash patterns (React #137) | Enforced | `lib/validation/html-sanitizer.ts` via Safety Gate | Inline handler stripping + HTML sanitizer applied. |
| Forbidden root tags in embed HTML | Enforced | `lib/webflow-safety-gate.ts` | Strips `<html>`, `<head>`, `<body>`, `<!doctype>`. |
| Inline event handlers (`onclick=...`) | Enforced | `lib/webflow-safety-gate.ts` | Strips and warns user to recreate as JS listeners. |
| Embed size limit (50,000 chars) | Enforced | `lib/webflow-safety-gate.ts` | Blocks copy if exceeded; soft warnings at 40k. |
| Unsupported CSS in styleLess | Enforced | `lib/webflow-sanitizer.ts` | Extracted to CSS embed when invalid. |
| Unsupported JS/Interactions | Enforced | `lib/webflow-sanitizer.ts` | Interactions stripped; JS routed to embed. |
| External libraries (CDN) | Warned | `lib/external-resource-detector.ts` + UI | Instructions shown in Embeds tab / external libraries panel. |
| Custom code placement (Head vs Footer) | Warned | UI copy guidance | Listed in embeds/external library UI. |

## Known Gaps / Follow‑Up Work

These are not yet fully addressed and should be treated as next tasks:

1) **Embed chunking**  
   - Current behavior: hard block if embed exceeds 50,000 chars.  
   - Desired: automatic chunking into multiple embeds when safe.

2) **Regression test coverage (crash fixtures)**  
   - Required fixtures: React #137 patterns, invalid variant keys, reserved class names, deep nesting -> HtmlEmbed with sanitization, 50k embed limit enforcement.  
   - Tests exist but are not comprehensive for every crash trigger.

3) **Library import validation**  
   - `validateLibraryImports` exists but is not currently wired.
   - Should warn on duplicate jQuery or conflicting library loads.

4) **ZIP import support**  
   - UI currently accepts ZIP selection but blocks processing.  
   - Future: proper ZIP parsing or a clearer UX state.

## Recommended Next Actions

1) Add chunking logic for large CSS/JS/HTML embeds, then update the Safety Gate to emit ordered embed chunks and copy instructions.
2) Expand regression test suite with fixtures for every known Webflow crash trigger.
3) Wire `validateLibraryImports` in `app/api/webflow/convert/route.ts` and UI, and surface warnings in the Safety Report.
4) Review copy order UX so every surface reiterates the authoritative sequence:
   - **Style Guide (Design Tokens) → Embeds → Site Structure / Components**

## Where To Look In Code

- Safety Gate: `lib/webflow-safety-gate.ts`
- Preflight rules: `lib/preflight-validator.ts`
- Sanitizer: `lib/webflow-sanitizer.ts`
- HTML sanitizer: `lib/validation/html-sanitizer.ts`
- Export surfaces: `docs/webflow-export-surfaces.md`

