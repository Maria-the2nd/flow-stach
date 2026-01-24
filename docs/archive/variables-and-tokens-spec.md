# Variables and Tokens Spec (Marketplace)

## Purpose
- Define how design tokens work for templates and standalone components.
- Document clipboard limits and the required extension flow.
- Provide a repeatable schema and prompt for future asset creation.

## Executive Summary (Validated by Research)
- Webflow clipboard JSON cannot create Variables. Any "variables" block is ignored.
- Variable bindings are UUID-based only. Name matching does not rebind.
- Pasting across sites causes unbinding when UUIDs do not exist in the destination.
- Two viable paths for binding: clone strategy (UUIDs preserved) or dynamic mapping (extension rewrites UUIDs).
- The only robust automation path is a Designer Extension that can create variables and remap UUIDs.
- Shared Libraries are the official Webflow solution, but they are workspace-only and not viable for a marketplace.

## Decisions
- Tokens cover colors and font families only. Spacing and layout stay structural.
- Templates are bundles that include a single `page-wrapper` with `fp-root`.
- Standalone components do not require tokens and do not inject wrappers.
- Dark mode is set via `data-fp-theme="dark"` (override tokens only).
- Link styling is in the token asset only; components never enforce global link styles.

## Token Schema (Per Template)
Each template has its own token set and Variable Collection.

Example manifest (extension import/export):
```json
{
  "schemaVersion": "1.0",
  "template": { "name": "Flow Party", "slug": "flow-party", "namespace": "fp" },
  "modes": ["light", "dark"],
  "variables": [
    { "path": "Colors / Background / Base", "type": "color", "cssVar": "--fp-bg", "values": { "light": "#f5f5f5", "dark": "#2d2f2e" } },
    { "path": "Colors / Text / Primary", "type": "color", "cssVar": "--fp-text", "values": { "light": "#171717", "dark": "#ffffff" } },
    { "path": "Colors / Text / Muted", "type": "color", "cssVar": "--fp-text-muted", "values": { "light": "#afb6b4", "dark": "#767f7a" } },
    { "path": "Colors / Link / Default", "type": "color", "cssVar": "--fp-link", "values": { "light": "#ff531f", "dark": "#ffffff" } },
    { "path": "Colors / Link / Hover", "type": "color", "cssVar": "--fp-link-hover", "values": { "light": "#ff825c", "dark": "#ff825c" } },
    { "path": "Typography / Body", "type": "fontFamily", "cssVar": "--fp-font-body", "value": "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif" },
    { "path": "Typography / Display", "type": "fontFamily", "cssVar": "--fp-font-display", "value": "'Antonio', sans-serif" }
  ],
  "baseStyles": [
    ".fp-root { font-family: var(--fp-font-body, inherit); color: var(--fp-text, currentColor); }",
    ".fp-root a { color: var(--fp-link, currentColor); text-decoration: none; }",
    ".fp-root a:hover { color: var(--fp-link-hover, currentColor); }"
  ]
}
```

## Theme Overrides
Tokens are applied on `.fp-root` for light mode.
Dark overrides are applied via attribute:
```css
[data-fp-theme="dark"] {
  --fp-bg: #2d2f2e;
  --fp-text: #ffffff;
  --fp-text-muted: #767f7a;
  --fp-link: #ffffff;
}
```

## Asset Types and Rules

### Token Asset (per template)
- Creates `page-wrapper` with class `fp-root`.
- Defines CSS variables on `.fp-root` and dark overrides on `[data-fp-theme="dark"]`.
- Defines base link styles (prevents default blue).
- Includes Google Fonts in code payload only (head snippet), not Webflow JSON.

### Standalone Component Asset
- No wrapper. No `fp-root`. No required token dependency.
- Layout, spacing, border widths, shadows, sizes are fixed in CSS.
- Colors and font-family use tokens with fallbacks:
  - `color: var(--fp-text, currentColor);`
  - `background: var(--fp-bg, transparent);`
  - `font-family: var(--fp-font-body, inherit);` (only when needed)

### Template Asset
- Includes `page-wrapper` with `fp-root`.
- Sections may set `data-fp-theme="dark"` on dark blocks.
- Depends on its token asset.
- Components inside use the same component payloads (no special versions).

## Clipboard Constraints (Must-Read)
- Clipboard JSON (`@webflow/XscpData`) cannot create Variables.
- Variable bindings are UUID-based only; name matching never rebinds.
- When a referenced UUID is missing, Webflow unbinds and keeps fallback values.
- A "variables" block in JSON is ignored by the deserializer.

## Extension Flow (Required for Real Variables)

### Import Tokens
1. Parse token manifest JSON.
2. Create or update Variable Collection (Template Name).
3. Create modes (Light, Dark).
4. Create variables with nice names (from `path`).
5. Set per-mode values.
6. Write CSS custom properties to `.fp-root` and `[data-fp-theme="dark"]`.

### Export Tokens
1. Read Variable Collections and modes.
2. Map variables to manifest format (path + cssVar).
3. Export JSON for reuse.

### Template Install
1. Ensure `page-wrapper` exists with `fp-root`.
2. Create variables (if missing).
3. Map source UUIDs to destination UUIDs.
4. Inject components using updated payloads.

### Mapping Logic (UUID Sync)
- Fetch target variables via `webflow.getAllVariableCollections()`.
- Build `Map<VariableName, UUID>`.
- Replace source UUIDs in payload before paste or inject.
- If modes are missing, create them before mapping.

## Update Workflow (Current Repo)
- Update payloads in `convex/admin.ts`.
- Use Admin "Update Code Payloads" for existing assets.
- Use "Seed Demo Data" for new assets.
- If dependencies need updating, extend `updatePayloads` to patch `dependencies` or clear + seed.

## Prompt Template for Future Assets
```
You are updating Flow Stach assets. Follow these rules:

Token rules:
- Only colors and font families are tokenized.
- Use CSS vars with fallbacks:
  color: var(--fp-text, currentColor);
  background: var(--fp-bg, transparent);
  font-family: var(--fp-font-body, inherit);

Structure rules:
- Components: no wrapper, no fp-root, no global a styles.
- Templates: include page-wrapper with class fp-root; sections may use data-fp-theme=\"dark\".
- Base link style exists only in token asset:
  .fp-root a { color: var(--fp-link, currentColor); text-decoration: none; }
  .fp-root a:hover { color: var(--fp-link-hover, currentColor); }

Layout rules:
- Do NOT change spacing/padding/layout/border/shadow sizes.
- Only replace colors and font-family.

Deliverables per asset:
- slug, title, category, tags, preview
- HTML/CSS/JS payload
- Webflow JSON if available (avoid transitions in styleLess)

Assets to update/create:
[PASTE LIST HERE]
```

## References
- docs/research/Webflow Variables JSON Paste Investigation.pdf
