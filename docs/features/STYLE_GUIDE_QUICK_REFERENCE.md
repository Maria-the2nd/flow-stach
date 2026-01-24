# Design Tokens Style Guide - Quick Reference

**✨ v2 Update:** Now with self-contained inline styles, UI components, and default spacing!

## 🚀 Getting Started (30 seconds)

1. **Import a project** with CSS variables
2. **Open project** → Click **"Style Guide"** tab
3. **Done!** All tokens auto-detected and displayed
4. **Paste in Webflow** → Perfect layout, no conflicts!

## 📋 Quick Actions

| Action | How To |
|--------|--------|
| **Copy single token** | Hover over token → Click copy icon |
| **Copy all colors** | Click "Copy All Color" button |
| **Copy all typography** | Click "Copy All Typography" button |
| **Export to Webflow** | Click "Copy Style Guide to Webflow" → Paste in Webflow |
| **View UI examples** | Scroll to "UI Components" section - Always present! |

## 🎨 Token Format Examples

### Minimal Setup
```css
:root {
  /* Colors */
  --primary: #3B82F6;
  --text: #1F2937;
  
  /* Spacing */
  --spacing-md: 1.5rem;
  
  /* Radius */
  --radius-md: 8px;
  
  /* Shadows */
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
}
```

### Full Token System
```css
:root {
  /* === COLORS === */
  --color-primary: #3B82F6;
  --color-secondary: #10B981;
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --bg-primary: #FFFFFF;
  
  /* === TYPOGRAPHY === */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Open Sans', sans-serif;
  
  /* === SPACING === */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  
  /* === RADIUS === */
  --radius-small: 4px;
  --radius-medium: 8px;
  --radius-large: 16px;
  
  /* === SHADOWS === */
  --shadow-small: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-medium: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-large: 0 10px 15px rgba(0,0,0,0.1);
}
```

## 🔧 Naming Patterns

The system auto-detects tokens based on naming:

| Token Type | Naming Pattern | Examples |
|------------|----------------|----------|
| **Colors** | `--*color*`, `--text-*`, `--bg-*` | `--primary-color`, `--text-dark`, `--bg-light` |
| **Typography** | `--font-*` | `--font-heading`, `--font-body`, `--font-mono` |
| **Spacing** | `--spacing-*`, `--*padding*`, `--*margin*`, `--*gap*` | `--spacing-md`, `--section-padding`, `--card-gap` |
| **Radius** | `--radius-*` | `--radius-small`, `--radius-button`, `--radius-card` |
| **Shadows** | `--shadow-*` | `--shadow-sm`, `--shadow-card`, `--shadow-header` |

## 💡 Common Use Cases

### Use Case 1: Quick Token Reference
```
1. Open Style Guide tab
2. Hover over any token
3. Click copy icon
4. Paste into your code
```

### Use Case 2: Export Token Documentation
```
1. Open Style Guide tab
2. Click "Copy All Color" (or any category)
3. Paste into your docs
4. Repeat for other categories
```

### Use Case 3: Create Webflow Style Guide Page
```
1. Open Style Guide tab
2. Click "Copy Style Guide to Webflow"
3. Open Webflow Designer
4. Paste (Cmd/Ctrl + V) into canvas
5. Visual style guide created!
```

### Use Case 4: Share Tokens with Team
```
1. Open Style Guide tab
2. Copy individual sections or full guide
3. Share via Slack/Email/Notion
4. Team has reference for all design tokens
```

## ⚠️ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| No tokens detected | Use CSS variables in `:root` block |
| Missing category | Check naming pattern (e.g., `--radius-*` for radius) |
| Copy button not working | Check browser permissions for clipboard |
| Webflow paste broken | Paste into container, not empty canvas |

## 📊 Token Organization Tips

### ✅ Do This
```css
/* Organized by category */
:root {
  /* Brand Colors */
  --color-primary: #3B82F6;
  --color-secondary: #10B981;
  
  /* UI Colors */
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
}
```

### ❌ Avoid This
```css
/* Mixed and unclear */
:root {
  --blue: #3B82F6;
  --the-text-color: #1F2937;
  --bigPadding: 2rem;
}
```

## 🎯 Pro Tips

1. **Use semantic names**: `--color-primary` not `--blue`
2. **Group by category**: Comment sections for clarity
3. **Be consistent**: Pick a naming convention and stick to it
4. **Use scales**: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, etc.
5. **Document usage**: Add comments explaining when to use each token

## 📚 Full Documentation

For complete details, see:
- **[Full Style Guide Documentation](./STYLE_GUIDE.md)**
- **[Implementation Details](../STYLE_GUIDE_IMPLEMENTATION.md)**
- **[General Documentation](../README.md)**

---

**Quick Links:**
- [Home](../README.md) | [Features](./STYLE_GUIDE.md) | [Troubleshooting](./STYLE_GUIDE.md#troubleshooting)
