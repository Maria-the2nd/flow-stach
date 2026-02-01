# CSS Property Guardrail Implementation Summary

## Overview

Implemented a guardrail system that emits structured warnings when CSS properties are stripped from native Webflow styles. This ensures users have visibility into which properties cannot be natively supported and need to be handled via CSS embeds.

## File Changes

### 1. [lib/css-parser.ts](../lib/css-parser.ts#L133-L147) - CssWarning Interface

**Added** new warning type and metadata fields:

```typescript
export interface CssWarning {
  type:
    | "unsupported_property"
    | "unsupported_selector"
    | "complex_selector"
    | "animation"
    | "variable_unresolved"
    | "breakpoint_unmapped"
    | "breakpoint_rounded"
    | "breakpoint_embedded"
    | "stripped_property";        // ← NEW
  message: string;
  selector?: string;
  property?: string;
  value?: string;                 // ← NEW
  reason?: "STRIP_PROPERTIES" | "unsupported" | "sanitized";  // ← NEW
  severity?: "info" | "warning" | "error";
}
```

### 2. [lib/css-parser.ts](../lib/css-parser.ts#L787-L826) - parseProperties Function

**Modified** function signature to accept selector parameter and emit warnings for stripped properties:

```typescript
// BEFORE:
function parseProperties(
  propertiesStr: string,
  variables: Map<string, string>,
  warnings: CssWarning[]
): Record<string, string> {
  // ...
  if (STRIP_PROPERTIES.has(name)) continue;  // ❌ Silently skipped
  // ...
}

// AFTER:
function parseProperties(
  propertiesStr: string,
  variables: Map<string, string>,
  warnings: CssWarning[],
  selector?: string                           // ← NEW parameter
): Record<string, string> {
  // ...
  // Emit warning for stripped properties
  if (STRIP_PROPERTIES.has(name)) {
    warnings.push({
      type: "stripped_property",              // ← NEW warning
      message: `Property "${name}" is not supported by Webflow and has been stripped`,
      selector,
      property: name,
      value,
      reason: "STRIP_PROPERTIES",
      severity: "warning",
    });
    continue;
  }
  // ...
}
```

### 3. [lib/css-parser.ts](../lib/css-parser.ts#L853-L863) - Enhanced unsupported_property Warnings

**Updated** unsupported property warnings to include full context:

```typescript
// BEFORE:
if (!WEBFLOW_SUPPORTED_PROPERTIES.has(name) && !SHORTHAND_EXPANSIONS[name]) {
  warnings.push({
    type: "unsupported_property",
    message: `Unsupported CSS property: ${name}`,
    property: name
  });
  continue;
}

// AFTER:
if (!WEBFLOW_SUPPORTED_PROPERTIES.has(name) && !SHORTHAND_EXPANSIONS[name]) {
  warnings.push({
    type: "unsupported_property",
    message: `Unsupported CSS property: ${name}`,
    selector,                    // ← NEW
    property: name,
    value,                       // ← NEW
    reason: "unsupported",       // ← NEW
    severity: "warning",         // ← NEW
  });
  continue;
}
```

### 4. Call Sites Updated

**Updated** all 4 call sites of `parseProperties` to pass the selector parameter:

```typescript
// 1. In processRule() - line 1258
const properties = parseProperties(propertiesStr, variables, warnings, selector);

// 2. In media query min-width handler - line 1488
const props = parseProperties(propertiesStr, variables, warnings, selectors);

// 3. In legacy min-width handler - line 1524
const props = parseProperties(propertiesStr, variables, warnings, selectors);

// 4. In extractElementBaseStyles() - line 1631
const properties = parseProperties(propertiesStr, variables, warnings, selector);
```

## Example Warning Output

### Transition Properties (Before Implementation)

**Input CSS:**
```css
.btn {
  transition: all 200ms ease;
  transform: translateY(0);
}
```

**Before (NO warnings):**
- Properties silently stripped
- User has no visibility into what was lost

**After (WITH warnings):**
```json
{
  "type": "stripped_property",
  "message": "Property \"transition\" is not supported by Webflow and has been stripped",
  "selector": ".btn",
  "property": "transition",
  "value": "all 200ms ease",
  "reason": "STRIP_PROPERTIES",
  "severity": "warning"
}
```

**NOTE:** After implementing transition support (separate feature), transition properties are NO LONGER stripped, so no warning is emitted.

### Animation Properties (Current Behavior)

**Input CSS:**
```css
.animated {
  animation: fadeIn 1s ease;
}

.spinner {
  animation: rotate 2s linear infinite;
}

.smooth {
  -webkit-font-smoothing: antialiased;
}
```

**Warning Output:**
```json
[
  {
    "type": "stripped_property",
    "message": "Property \"animation\" is not supported by Webflow and has been stripped",
    "selector": ".animated",
    "property": "animation",
    "value": "fadeIn 1s ease",
    "reason": "STRIP_PROPERTIES",
    "severity": "warning"
  },
  {
    "type": "stripped_property",
    "message": "Property \"animation\" is not supported by Webflow and has been stripped",
    "selector": ".spinner",
    "property": "animation",
    "value": "rotate 2s linear infinite",
    "reason": "STRIP_PROPERTIES",
    "severity": "warning"
  },
  {
    "type": "stripped_property",
    "message": "Property \"-webkit-font-smoothing\" is not supported by Webflow and has been stripped",
    "selector": ".smooth",
    "property": "-webkit-font-smoothing",
    "value": "antialiased",
    "reason": "STRIP_PROPERTIES",
    "severity": "warning"
  }
]
```

### Display Format (Console/UI)

```
[WARNING] .animated: animation = "fadeIn 1s ease"
Reason: STRIP_PROPERTIES
Message: Property "animation" is not supported by Webflow and has been stripped

[WARNING] .spinner: animation = "rotate 2s linear infinite"
Reason: STRIP_PROPERTIES
Message: Property "animation" is not supported by Webflow and has been stripped

[WARNING] .smooth: -webkit-font-smoothing = "antialiased"
Reason: STRIP_PROPERTIES
Message: Property "-webkit-font-smoothing" is not supported by Webflow and has been stripped
```

## Test Results

✅ **All 8 tests passing** in [tests/css-stripped-warnings.test.ts](../tests/css-stripped-warnings.test.ts)

```bash
bun test css-stripped-warnings

 8 pass
 0 fail
 49 expect() calls
```

### Test Coverage

1. ✅ Emits warning when animation property is stripped
2. ✅ Emits warning when animation-name is stripped
3. ✅ Emits warning for multiple stripped properties in one rule
4. ✅ Includes selector context in warning
5. ✅ Emits unsupported_property warning for unknown properties
6. ✅ Does NOT emit warning for supported transition properties
7. ✅ Formats warning message correctly
8. ✅ Provides all required fields for UI display

## Integration Steps (TODO)

To surface these warnings in the UI, complete these integration steps:

### 1. Backend: Store Warnings in Convex

Update `convex/schema.ts`:

```typescript
importProjects: defineTable({
  // ... existing fields ...
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

### 2. Backend: Capture Warnings During Import

In `convex/import.ts` or wherever CSS parsing happens:

```typescript
const cssResult = parseCSS(cssContent);

await ctx.db.patch(projectId, {
  cssCompatibilityWarnings: cssResult.classIndex.warnings.filter(
    w => w.type === "stripped_property" || w.type === "unsupported_property"
  )
});
```

### 3. Frontend: Display Warnings in ProjectDetailsView

Add a new "Compatibility" tab:

```tsx
// components/workspace/project-details-view.tsx
const secondaryTabItems = [
  { label: "Images", value: "images" },
  { label: "Embeds", value: "embeds" },
  { label: "Fonts", value: "fonts" },
  { label: "Compatibility", value: "compatibility", badge: compatibilityWarningCount },
];

<TabsContent value="compatibility" className="mt-0">
  <CompatibilityWarnings warnings={project.cssCompatibilityWarnings ?? []} />
</TabsContent>
```

See [docs/css-compatibility-warnings.md](./css-compatibility-warnings.md) for full UI component examples.

## Benefits

1. **Transparency**: Users can see exactly what CSS features won't work in Webflow
2. **Debugging**: Clear selector + property + value context helps identify issues
3. **Actionable**: Users know which properties need to be added to CSS embeds
4. **Validation**: Warnings surface during import, not after paste

## Files Created/Modified

**Modified:**
- [lib/css-parser.ts](../lib/css-parser.ts) - Core guardrail implementation (3 sections)

**Created:**
- [tests/css-stripped-warnings.test.ts](../tests/css-stripped-warnings.test.ts) - 8 comprehensive tests
- [docs/css-compatibility-warnings.md](./css-compatibility-warnings.md) - UI integration guide
- [docs/css-guardrail-implementation.md](./css-guardrail-implementation.md) - This summary

## Next Steps

1. ✅ **Implement guardrail** (DONE)
2. ✅ **Add tests** (DONE)
3. ✅ **Document UI integration** (DONE)
4. TODO: Update Convex schema to store warnings
5. TODO: Capture warnings during import
6. TODO: Create CompatibilityWarnings UI component
7. TODO: Add Compatibility tab to ProjectDetailsView
