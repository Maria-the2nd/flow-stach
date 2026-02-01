# CSS Compatibility Warnings System

## Overview

The CSS parser now emits structured warnings when properties are stripped or unsupported. This provides visibility into what CSS features cannot be natively supported in Webflow and need to be handled via CSS embeds.

## Warning Structure

```typescript
interface CssWarning {
  type:
    | "stripped_property"     // Property in STRIP_PROPERTIES (animation, -webkit-font-smoothing, etc.)
    | "unsupported_property"  // Property not in WEBFLOW_SUPPORTED_PROPERTIES
    | "complex_selector"
    | "animation"
    | "variable_unresolved"
    | "breakpoint_unmapped"
    | "breakpoint_rounded"
    | "breakpoint_embedded";
  message: string;            // Human-readable message
  selector?: string;          // CSS selector (e.g., ".btn", ".card:hover")
  property?: string;          // CSS property name (e.g., "animation", "transition")
  value?: string;             // CSS property value (e.g., "fadeIn 1s ease")
  reason?: "STRIP_PROPERTIES" | "unsupported" | "sanitized";
  severity?: "info" | "warning" | "error";
}
```

## Example Warnings

### 1. Stripped Property (Animation)

**Input CSS:**
```css
.animated {
  animation: fadeIn 1s ease;
}
```

**Warning Output:**
```json
{
  "type": "stripped_property",
  "message": "Property \"animation\" is not supported by Webflow and has been stripped",
  "selector": ".animated",
  "property": "animation",
  "value": "fadeIn 1s ease",
  "reason": "STRIP_PROPERTIES",
  "severity": "warning"
}
```

### 2. Unsupported Property

**Input CSS:**
```css
.custom {
  -webkit-custom-prop: value;
  unknown-prop: test;
}
```

**Warning Output:**
```json
{
  "type": "unsupported_property",
  "message": "Unsupported CSS property: -webkit-custom-prop",
  "selector": ".custom",
  "property": "-webkit-custom-prop",
  "value": "value",
  "reason": "unsupported",
  "severity": "warning"
}
```

### 3. Multiple Warnings in One Rule

**Input CSS:**
```css
.complex {
  animation: spin 2s linear infinite;
  -webkit-animation: spin 2s linear infinite;
  -webkit-font-smoothing: antialiased;
}
```

**Warning Output:** (3 warnings emitted)
```json
[
  {
    "type": "stripped_property",
    "selector": ".complex",
    "property": "animation",
    "value": "spin 2s linear infinite",
    "reason": "STRIP_PROPERTIES"
  },
  {
    "type": "stripped_property",
    "selector": ".complex",
    "property": "-webkit-animation",
    "value": "spin 2s linear infinite",
    "reason": "STRIP_PROPERTIES"
  },
  {
    "type": "stripped_property",
    "selector": ".complex",
    "property": "-webkit-font-smoothing",
    "value": "antialiased",
    "reason": "STRIP_PROPERTIES"
  }
]
```

## UI Display Format

### Compatibility Section (Proposed)

```tsx
// components/workspace/CompatibilityWarnings.tsx
export function CompatibilityWarnings({ warnings }: { warnings: CssWarning[] }) {
  const strippedWarnings = warnings.filter(w => w.type === "stripped_property");
  const unsupportedWarnings = warnings.filter(w => w.type === "unsupported_property");

  if (strippedWarnings.length === 0 && unsupportedWarnings.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600">
        <ShieldCheck className="w-4 h-4" />
        <span>All CSS properties are natively supported by Webflow</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {strippedWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-2">
            <AlertCircle className="w-4 h-4" />
            Stripped Properties ({strippedWarnings.length})
          </h4>
          <p className="text-xs text-amber-700 mb-3">
            These properties are not supported by Webflow and have been removed from native styles.
            Consider adding them to a CSS embed if needed.
          </p>
          <div className="space-y-2">
            {strippedWarnings.map((warning, i) => (
              <div key={i} className="bg-white rounded p-2 text-xs font-mono">
                <div className="text-amber-900 font-semibold">{warning.selector}</div>
                <div className="text-gray-600">
                  {warning.property}: <span className="text-amber-700">{warning.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unsupportedWarnings.length > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-orange-900 mb-2">
            <AlertCircle className="w-4 h-4" />
            Unsupported Properties ({unsupportedWarnings.length})
          </h4>
          <p className="text-xs text-orange-700 mb-3">
            These properties are not recognized and have been skipped.
          </p>
          <div className="space-y-2">
            {unsupportedWarnings.map((warning, i) => (
              <div key={i} className="bg-white rounded p-2 text-xs font-mono">
                <div className="text-orange-900 font-semibold">{warning.selector}</div>
                <div className="text-gray-600">
                  {warning.property}: <span className="text-orange-700">{warning.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### Integration in ProjectDetailsView

Add a new tab to the existing tabs:

```tsx
// In ProjectDetailsView.tsx
const secondaryTabItems = [
  { label: "Images", value: "images" },
  { label: "Embeds", value: "embeds" },
  { label: "Fonts", value: "fonts" },
  { label: "Compatibility", value: "compatibility", badge: compatibilityWarningCount }, // NEW
];

// In TabsContent section:
<TabsContent value="compatibility" className="mt-0">
  <CompatibilityWarnings warnings={cssParserWarnings} />
</TabsContent>
```

## Integration with Import Pipeline

To surface warnings in the UI, the import pipeline needs to:

1. **Capture warnings during parsing** (✅ Already implemented in `lib/css-parser.ts`)
2. **Store warnings in artifacts** (TODO: Add to Convex schema)
3. **Pass warnings to UI** (TODO: Read from artifacts in ProjectDetailsView)

### Step 1: Update Convex Schema

Add a new field to `importProjects` to store CSS compatibility warnings:

```typescript
// convex/schema.ts
importProjects: defineTable({
  // ... existing fields ...

  // Add CSS parsing warnings
  cssCompatibilityWarnings: v.optional(v.array(v.object({
    type: v.string(),
    message: v.string(),
    selector: v.optional(v.string()),
    property: v.optional(v.string()),
    value: v.optional(v.string()),
    reason: v.optional(v.string()),
    severity: v.optional(v.string()),
  }))),
}),
```

### Step 2: Store Warnings During Import

In the import flow (`convex/import.ts` or wherever CSS parsing happens):

```typescript
import { parseCSS } from "../lib/css-parser";

const cssResult = parseCSS(cssContent);

// Store warnings for UI display
await ctx.db.patch(projectId, {
  cssCompatibilityWarnings: cssResult.classIndex.warnings.filter(
    w => w.type === "stripped_property" || w.type === "unsupported_property"
  )
});
```

### Step 3: Display in UI

In `ProjectDetailsView.tsx`:

```typescript
// Access warnings from project data
const cssWarnings = project.cssCompatibilityWarnings ?? [];

// Pass to CompatibilityWarnings component
<CompatibilityWarnings warnings={cssWarnings} />
```

## Benefits

1. **Transparency**: Users can see exactly what CSS features won't work in Webflow
2. **Actionable**: Users know which properties need to be added to CSS embeds
3. **Debugging**: Clear selector + property + value context helps identify issues
4. **Validation**: Warnings surface before paste, not after

## Example Output

When importing a project with animations:

```
Compatibility Warnings (3)

Stripped Properties (3)
─────────────────────────────────────
.animated
  animation: fadeIn 1s ease

.spinner
  animation: rotate 2s linear infinite

.smooth
  -webkit-font-smoothing: antialiased
```

## Future Enhancements

1. **Auto-route to embeds**: Automatically add stripped properties to CSS embed
2. **One-click fix**: "Move to Embed" button that adds stripped rules to embed section
3. **Warning suppression**: Allow users to mark warnings as "expected" and hide them
4. **Export warnings**: Copy warnings as CSV or JSON for documentation
