# Action Plan 2: HTML Import Improvements

## Overview

Simplify the HTML import workflow by adding a "Full HTML (token-stripped)" copy option and improving JavaScript/library handling.

## Current State

The system has three working outputs:
1. **Full Site Copy** - Complete HTML with all styles baked in (works, don't touch)
2. **Design Tokens** - CSS variables extracted as Webflow classes (works, don't touch)
3. **Individual Components** - Token-stripped components pasted one by one (works, but tedious)

## Goal

Replace tedious individual component pasting with single "Full HTML (Token-Stripped)" action.

```
Before: Design Tokens → Component 1 → Component 2 → Component N...
After:  Design Tokens → Full HTML (Token-Stripped)
```

---

## Task 2.1: Add Full HTML (Token-Stripped) Handler

**Location:** `app/admin/import/page.tsx` (after `handleCopyComponent` ~line 1117)

### Implementation

Create `handleCopyFullHtmlStripped` that:
- Combines all component HTML into one wrapper div
- Uses existing `buildComponentPayload()` with `establishedClasses` and `skipEstablishedStyles`

```typescript
const handleCopyFullHtmlStripped = useCallback(async () => {
  if (!artifacts || !componentTree) return

  // Combine all component HTML
  const combinedHtml = componentTree.components
    .sort((a, b) => a.order - b.order)
    .map(c => c.htmlContent)
    .join('\n')

  const fullComponent: Component = {
    id: "full-html-stripped",
    name: "Full Site (Token-Stripped)",
    type: "wrapper",
    tagName: "div",
    primaryClass: "",
    htmlContent: `<div>\n${combinedHtml}\n</div>`,
    classesUsed: getClassesUsed(combinedHtml),
    order: 0,
    children: [],
  }

  const result = buildComponentPayload(
    fullComponent,
    artifacts.classIndex,
    establishedClasses,
    { skipEstablishedStyles }
  )

  await copyToWebflowClipboard(JSON.stringify(result.webflowPayload))
  toast.success('Copied Full HTML (token-stripped) to clipboard')
}, [artifacts, componentTree, establishedClasses, skipEstablishedStyles])
```

### Subtasks

- [ ] Add `handleCopyFullHtmlStripped` function
- [ ] Create helper `getClassesUsed(html: string): string[]` to extract class names from HTML
- [ ] Test with sample HTML containing multiple sections

---

## Task 2.2: Update HtmlTab UI

**Location:** `app/admin/import/page.tsx` - `HtmlTab` component (lines 503-689)

### Implementation

Add prominent "Full HTML" section BEFORE individual components:

```tsx
{/* NEW: Full HTML (Token-Stripped) - Primary Action */}
<Card className="border-primary/50 bg-primary/5">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <HugeiconsIcon icon={Copy01Icon} size={20} />
      Full Site (Token-Stripped)
    </CardTitle>
    <CardDescription>
      Paste Design Tokens first, then paste this. All components combined into one paste.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    <div className="text-sm text-muted-foreground">
      <strong>Workflow:</strong>
      <ol className="list-decimal list-inside mt-1 space-y-1">
        <li>Copy & paste Design Tokens (from Tokens tab)</li>
        <li>Click button below to copy full HTML</li>
        <li>Paste into Webflow Designer (Ctrl/Cmd+V)</li>
      </ol>
    </div>
    <Button
      onClick={onCopyFullHtmlStripped}
      className="w-full"
      size="lg"
    >
      <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2" />
      Copy Full HTML for Webflow
    </Button>
  </CardContent>
</Card>

{/* Existing individual components - now secondary/collapsible */}
<details className="mt-4">
  <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
    Individual Components ({componentTree.components.length}) — for advanced use
  </summary>
  <div className="mt-3 space-y-3">
    {/* existing component list */}
  </div>
</details>
```

### Subtasks

- [ ] Update `HtmlTabProps` interface to include `onCopyFullHtmlStripped: () => void`
- [ ] Add new Card section for Full HTML action
- [ ] Wrap existing component list in `<details>` element
- [ ] Pass `handleCopyFullHtmlStripped` to HtmlTab component

---

## Task 2.3: Add External Scripts to Artifacts State

**Location:** `app/admin/import/page.tsx` - `handleParse` (~line 849)

### Current Issue

`extractCleanHtml()` already extracts `externalScripts` (CDN URLs) but they're not stored in state.

### Implementation

```typescript
// In handleParse function
const cleanResult = extractCleanHtml(html, options)

setArtifacts({
  // ... existing fields
  cleanHtml: cleanResult.cleanHtml,
  tokenCss: cleanResult.tokenCss,
  externalScripts: cleanResult.externalScripts,  // ADD THIS
})
```

### Subtasks

- [ ] Update `Artifacts` type definition to include `externalScripts: string[]`
- [ ] Add `externalScripts` to setArtifacts call
- [ ] Verify `extractCleanHtml` return type includes `externalScripts`

---

## Task 2.4: Display External Scripts in JsTab

**Location:** `app/admin/import/page.tsx` - `JsTab` component (lines 701-802)

### Implementation

Add external scripts section with clear Webflow instructions:

```tsx
interface JsTabProps {
  // ... existing props
  externalScripts: string[]
}

// In JsTab component:
{externalScripts.length > 0 && (
  <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
    <CardHeader>
      <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center gap-2">
        <HugeiconsIcon icon={AlertCircleIcon} size={20} />
        External Libraries Required
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm">
        This site uses external libraries. Add these to Webflow:
      </p>

      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>Go to <strong>Project Settings → Custom Code</strong></li>
        <li>Paste in <strong>"Head Code"</strong> section:</li>
      </ol>

      <pre className="p-3 bg-muted rounded text-xs overflow-x-auto font-mono">
        {externalScripts.map(url => `<script src="${url}"></script>`).join('\n')}
      </pre>

      <Button
        variant="outline"
        onClick={() => {
          const scriptTags = externalScripts
            .map(url => `<script src="${url}"></script>`)
            .join('\n')
          navigator.clipboard.writeText(scriptTags)
          toast.success('Copied script tags to clipboard')
        }}
      >
        <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2" />
        Copy Script Tags
      </Button>
    </CardContent>
  </Card>
)}
```

### Subtasks

- [ ] Update `JsTabProps` interface
- [ ] Add external scripts Card section
- [ ] Add copy handler for script tags
- [ ] Pass `externalScripts` from parent to JsTab

---

## Acceptance Criteria

- [ ] "Full HTML (Token-Stripped)" button visible as primary action in HTML tab
- [ ] Clicking button copies combined HTML with token references (not baked styles)
- [ ] Individual components still available in collapsible section
- [ ] External scripts displayed with clear Webflow instructions
- [ ] Script tags copyable with one click
- [ ] Toast notifications confirm copy actions

## Dependencies

- **Action Plan 1 (CSS Unit Support)** - Should be completed first to ensure units are preserved in full HTML output

## Testing Checklist

1. Import HTML with 5+ sections
2. Copy Full HTML (token-stripped)
3. Paste into Webflow Designer
4. Verify all sections appear
5. Verify styles reference token classes (not baked values)
6. Verify external scripts section appears for HTML with CDN links
