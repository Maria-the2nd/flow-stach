# Magnetic Cursor Effect

A smooth magnetic cursor effect that follows interactive elements and creates an engaging hover experience.

## What It Does

Creates a custom cursor that smoothly follows mouse movement and gets "attracted" to elements marked with `data-magnetic`. When hovering over magnetic elements, the cursor scales up and the element subtly moves toward the cursor position, creating a satisfying magnetic pull effect.

## Quick Start

### Step 1: Copy to Webflow
1. Click "Copy to Webflow" button
2. Open Webflow Designer
3. Select the page/section where you want the effect
4. Press `Cmd+V` (Mac) or `Ctrl+V` (Windows)

### Step 2: Add GSAP
Add this script before `</body>`:
```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
```

### Step 3: Add the JavaScript
Copy the code from the Code tab and add it in Page Settings > Before `</body>` tag.

### Step 4: Configure (Optional)
No additional configuration required. To customize:
- Adjust `data-magnetic-strength` on magnetic elements (default: 0.3, range: 0.1-1.0)
- Style the `.magnetic-cursor` class for different cursor appearance

## Markup Requirements

### Cursor Element
```html
<div class="magnetic-cursor" data-magnetic-cursor></div>
```
- Must have `data-magnetic-cursor` attribute
- Position: fixed, pointer-events: none
- Place once per page

### Magnetic Elements
```html
<a href="#" class="button" data-magnetic data-magnetic-strength="0.3">
  Hover Me
</a>
```
- Add `data-magnetic` to any element you want to be magnetic
- Optional: `data-magnetic-strength` for custom pull strength

## Options

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-magnetic-cursor` | boolean | - | Marks the cursor element |
| `data-magnetic` | boolean | - | Makes element magnetic |
| `data-magnetic-strength` | number | 0.3 | Pull strength (0.1-1.0) |

## Common Mistakes

1. **Cursor not visible** - Ensure the cursor element has proper z-index and is not hidden by overflow:hidden on parent elements.

2. **GSAP not loaded** - The script requires GSAP. Add the CDN link before your custom code.

3. **Multiple cursor elements** - Only one `data-magnetic-cursor` element should exist per page.

## Performance Notes

- Uses `requestAnimationFrame` for smooth 60fps animation
- Event listeners are added once at initialization
- Call `magneticCursor.destroy()` when removing the component in SPA contexts

## Dependencies

- GSAP 3.x (required)
