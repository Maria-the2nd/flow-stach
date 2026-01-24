# Three-Output System

**Status**: ✅ Implemented and Tested

The Flow Bridge conversion now produces three distinct outputs that users copy to different places in Webflow:

## The Three Outputs

### 1. **Webflow JSON** (`payload`)
- **Purpose**: Structure + native Webflow-compatible styles
- **Usage**: Paste into Webflow Designer (Cmd+V) or use Flow-Goodies extension
- **Contains**:
  - HTML structure as Webflow nodes
  - CSS classes that can be represented natively in Webflow
  - Native style properties (color, padding, margin, etc.)

### 2. **CSS Embed Block** (`embedCSS`)
- **Purpose**: Styles that cannot be represented in Webflow's native system
- **Usage**: Paste into an HTML Embed element on the page
- **Format**: Complete `<style>...</style>` block, ready to paste
- **Contains**:
  - `:root` CSS variables
  - Pseudo-elements (`::before`, `::after`)
  - `@keyframes` animations
  - Complex selectors (`:not()`, `:has()`, etc.)
  - `@media` queries with complex conditions
  - `@supports` queries

### 3. **JS Embed Block** (`embedJS`)
- **Purpose**: JavaScript functionality with automatic CDN injection
- **Usage**: Paste into an HTML Embed element on the page
- **Format**: Complete `<script>` block(s), ready to paste
- **Contains**:
  - CDN script tags for detected libraries (GSAP, Lenis, etc.)
  - User's JavaScript code wrapped in `DOMContentLoaded`
  - Libraries loaded in correct dependency order

## How It Works

### Conversion Pipeline

```
Input HTML/CSS/JS
      ↓
1. CSS Routing (BEFORE normalization)
   ├─→ Native CSS → Goes to Webflow styles
   └─→ Embed CSS → Goes to embedCSS field
      ↓
2. Normalize ONLY native CSS
   (No longer removes pseudo-elements!)
      ↓
3. JS Library Detection
   ├─→ Detect libraries (GSAP, Lenis, etc.)
   ├─→ Get CDN URLs in correct order
   └─→ Wrap user code in DOMContentLoaded
      ↓
4. Build Payload
   ├─→ Webflow JSON (structure + native styles)
   ├─→ embedCSS (wrapped in <style> tags)
   └─→ embedJS (CDN scripts + user code)
```

### WebflowPayload Interface

```typescript
interface WebflowPayload {
  type: "@webflow/XscpData";
  payload: {
    nodes: WebflowNode[];
    styles: WebflowStyle[];
    // ...
  };

  // NEW: Embed outputs
  embedCSS?: string;  // Complete <style> block
  embedJS?: string;   // Complete <script> block(s)

  meta: {
    // ...existing fields...

    // NEW: Quick check flags
    hasEmbedCSS: boolean;
    hasEmbedJS: boolean;
    embedCSSSize: number;  // Size in bytes
    embedJSSize: number;   // Size in bytes
  };
}
```

## Usage Example

### Input
```html
<div class="hero">Hello World</div>

<style>
:root {
  --primary-color: #ff6b6b;
}

.hero {
  color: var(--primary-color);
  padding: 2rem;
}

.hero::before {
  content: "→";
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>

<script>
gsap.to('.hero', { opacity: 1, duration: 1 });
</script>
```

### Output 1: Webflow JSON
```json
{
  "type": "@webflow/XscpData",
  "payload": {
    "nodes": [
      {
        "_id": "...",
        "type": "Block",
        "classes": ["hero"],
        // ...
      }
    ],
    "styles": [
      {
        "_id": "hero",
        "name": "Hero",
        "styleLess": "padding-top: 2rem; padding-bottom: 2rem; ..."
      }
    ]
  }
}
```

### Output 2: CSS Embed Block
```html
<style>
/* === FLOW BRIDGE: Non-Native CSS === */
:root {
  --primary-color: #ff6b6b;
}

.hero::before {
  content: "→";
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
```

### Output 3: JS Embed Block
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
  gsap.to('.hero', { opacity: 1, duration: 1 });
});
</script>
```

## User Workflow

1. **Convert HTML** → Get all three outputs
2. **Copy Webflow JSON** → Paste into Webflow Designer (via Flow-Goodies)
3. **Add HTML Embed element** → Paste CSS embed block
4. **Add another HTML Embed element** → Paste JS embed block
5. **Done!** Component is fully functional

## Benefits

### ✅ Complete Feature Support
- No more "pseudo-elements not supported" limitations
- CSS animations work natively
- Custom properties can be used
- Complex selectors preserved

### ✅ Automatic CDN Management
- No manual script tag hunting
- Correct load order guaranteed
- Dependency resolution automatic

### ✅ Clean Separation
- Webflow styles stay clean and editable
- Embed code is clearly marked
- Easy to update either independently

### ✅ Better DX
- Single conversion = everything needed
- Clear instructions for each output
- Validation warns if embeds required

## Testing

All functionality is covered by tests in `tests/three-output-system.test.ts`:

✅ CSS routing (pseudo-elements, :root, @keyframes)
✅ JS library detection (GSAP, Lenis, etc.)
✅ CDN injection in correct order
✅ DOMContentLoaded wrapping
✅ Empty embeds when not needed
✅ Meta flags accuracy
✅ Multiple libraries support

## Files Modified

### Core Conversion
- `lib/webflow-converter.ts`
  - Updated `WebflowPayload` interface
  - Added CSS routing before normalization
  - Added JS library detection
  - Included embed outputs in payload
  - Added meta flags

### Helper Functions
- `lib/css-embed-router.ts` (already existed)
  - Routes CSS between native and embed
  - Wraps embed CSS in `<style>` tags

- `lib/js-library-detector.ts` (already existed)
  - Detects libraries in JS code
  - Generates CDN script tags
  - Wraps user code in DOMContentLoaded

### Streaming Converter
- `lib/webflow-converter-streaming.ts`
  - Updated to include new meta fields

### Admin UI
- `app/admin/import/page.tsx` (already working)
  - Displays all three outputs in tabs
  - Copy buttons for each output
  - Clear instructions for usage

## Implementation Notes

### Critical Order of Operations

⚠️ **IMPORTANT**: CSS routing must happen BEFORE normalization:

```typescript
// ❌ WRONG - normalizer removes pseudo-elements first
const normalized = normalizeHtmlCssForWebflow(html, css);
const routed = routeCSS(normalized.css);  // Too late!

// ✅ CORRECT - route first, then normalize native CSS only
const routed = routeCSS(css);
const normalized = normalizeHtmlCssForWebflow(html, routed.native);
```

The normalizer strips non-Webflow-compatible CSS. If we normalize first, pseudo-elements and other embed-worthy CSS is lost before routing can capture it.

### Minification

- CSS embed is minified by default (via `css-embed-router`)
- JS embed is not minified (readable for debugging)
- Both can be minified by CDN or build tools

### Size Tracking

The `embedCSSSize` and `embedJSSize` fields track the byte size of each embed:

```typescript
const embedCSSSize = embedCSS ? new Blob([embedCSS]).size : 0;
const embedJSSize = embedJS ? new Blob([embedJS]).size : 0;
```

Useful for:
- Warning users about large embeds
- Tracking conversion efficiency
- Optimizing output size

## Future Enhancements

Potential improvements:

- [ ] Bundle multiple components' embeds into one
- [ ] Minify JS embed option
- [ ] Detect conflicting libraries
- [ ] Suggest free alternatives for paid GSAP plugins
- [ ] Inline critical CSS embed (for above-the-fold)
- [ ] Tree-shake unused CDN libraries
