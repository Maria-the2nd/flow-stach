# Grid Layout Compatibility

> How Flow Stach handles CSS Grid conversion for Webflow compatibility.

## The "Zero Rows" Issue

### Problem
Webflow's import engine has a strict validation for Grid containers. If a grid container does not have an explicit `grid-template-rows` or `grid-auto-rows` property defined, Webflow often defaults to **0 rows**, effectively collapsing the grid height to zero and locking the UI in the Designer.

This commonly happens with "implicit" grids where rows are just expected to be added automatically by the browser, but Webflow requires explicit instruction.

### Fix
The `webflow-converter` automatically detects Grid containers (`display: grid`) and checks for row definitions.

- **Detection**: Checks for missing `grid-template-rows` AND `grid-auto-rows`.
- **Action**: Injects `grid-template-rows: auto;` if both are missing.
- **Result**: Ensures at least one implicit row exists, preventing the 0-height collapse.

```typescript
// lib/webflow-converter.ts
if (!base.has("grid-template-rows") && !base.has("grid-auto-rows")) {
  style.styleLess += " grid-template-rows: auto;";
}
```

## The "Zero Columns" Issue

### Problem
When using advanced Grid features like `repeat(auto-fit, minmax(300px, 1fr))`, Webflow's import engine sometimes fails to calculate the initial column count, leading to **0 columns** or a single collapsed column. This is especially true when the container width isn't statically analyzable during import.

### Fix
The `css-parser` pre-calculates an estimated column count for complex `repeat()` patterns.

- **Detection**: Identifies `auto-fit` or `auto-fill` with `minmax()`.
- **Action**: Calculates a safe estimate based on a standard desktop width (1024px) divided by the minimum column width.
- **Safety**: Enforces `Math.max(1, ...)` to ensure we NEVER generate a grid with 0 columns.

```typescript
// lib/css-parser.ts
const targetContainerPx = 1024;
const rawEstimate = Math.floor(targetContainerPx / minPx);
const estimatedColumns = Math.max(1, Math.min(6, rawEstimate));
return Array(estimatedColumns).fill("1fr").join(" ");
```

## Responsive Grid Behavior

### Problem
Early versions of the converter forced mobile grids to `1fr` (single column) to "play it safe." This destroyed custom mobile layouts (e.g., 2-column grids on phones).

### Fix
We removed the forced mobile degradation. The converter now:
1. Respects the original CSS media queries for Grid columns.
2. Promotes the "base" (desktop) style to Webflow's main breakpoint.
3. Allows mobile styles to naturally override or inherit, just like standard CSS.

## Zero Opacity Handling

### Problem
Sometimes styles imported with `opacity: 0` (e.g., for entrance animations) would make elements invisible and unselectable in the Webflow Designer, confusing users who thought the import failed.

### Fix
The parser sanitizes `opacity: 0` to `opacity: 1` during the static style extraction phase (unless it's part of an interaction definition), ensuring elements are visible by default in the canvas.
