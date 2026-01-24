# Design Tokens Style Guide

## Overview

The **Style Guide** feature automatically generates a comprehensive, visual documentation of your design tokens in a format similar to Relume's style guides. It provides both an in-app visual interface and the ability to export directly to Webflow.

## What Are Design Tokens?

Design tokens are the visual design atoms of your design system — specifically, they are named entities that store visual design attributes. They include:

- **Colors**: Brand colors, backgrounds, text colors, accents
- **Typography**: Font families, sizes, weights, line heights
- **Spacing**: Margins, padding, gaps between elements
- **Border Radius**: Corner rounding values for buttons, cards, etc.
- **Shadows**: Elevation effects for layered interfaces
- **UI Components**: Example implementations (buttons, cards, inputs)

**✨ New:** Style guides now use 100% self-contained inline styles that won't conflict with your imported project's CSS!

## Accessing the Style Guide

### From an Imported Project

1. Navigate to **Workspace** → **Projects**
2. Click on any imported project
3. Select the **"Style Guide"** tab (located between Overview and Site)

The style guide will automatically extract and display all design tokens found in your project's CSS.

## Features

### 1. Visual Token Display

Each token category is displayed in an organized, visual format:

#### Colors
- Grid of color swatches
- Hex/RGB values displayed
- Hover to see token names
- Semantic color roles (Text, Background, Border, Accent)

#### Typography
- Font family samples with character sets
- Heading styles (H1-H6) with responsive sizes
- Body text variations by size and weight
- Line height specifications

#### Spacing
- Visual scale representation
- Bar indicators showing relative sizes
- Values in rem and px

#### Border Radius
- Visual preview boxes with rounded corners
- Grouped by size (Small, Medium, Large, XLarge)
- Actual border-radius applied to examples

#### Shadows
- Shadow preview cards
- Intensity levels (xxsmall to xxlarge)
- Visual comparison of elevation effects

#### UI Components ✨ NEW
- **Buttons**: Primary, Secondary, Outline variants
- **Card**: Example card with title and description
- **Input**: Form input field example
- Always displayed to show design system in action

### 2. Copy Functionality

The Style Guide provides three levels of copy functionality:

#### Individual Token Copy

**How to use:**
1. Hover over any token (color swatch, spacing value, etc.)
2. Click the small copy icon that appears
3. The raw value is copied to your clipboard

**Example output:**
```
#3B82F6
```

#### Category Copy

**How to use:**
1. Click the "Copy All [Category]" button in any section
2. All tokens in that category are copied as CSS variables

**Example output:**
```css
:root {
  --primary-color: #3B82F6;
  --secondary-color: #10B981;
  --accent-color: #F59E0B;
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
}
```

#### Webflow Style Guide Export

**How to use:**
1. Click **"Copy Style Guide to Webflow"** at the top
2. Open Webflow Designer
3. Paste (Cmd/Ctrl + V) into your canvas
4. A complete visual style guide page is created

**What gets created:**
- Organized sections with headings
- Color swatches with labels
- Typography samples
- Visual demonstrations of spacing, radius, and shadows
- **UI component examples** (buttons, cards, inputs)
- **Self-contained inline styles** - Won't conflict with your project's CSS
- Fully styled and ready to reference

## Setting Up Design Tokens

For the Style Guide to extract your tokens, use CSS custom properties (variables) in your imported HTML/CSS:

### Color Tokens

```css
:root {
  /* Brand Colors */
  --primary-color: #3B82F6;
  --secondary-color: #10B981;
  --accent-color: #F59E0B;
  
  /* Text Colors */
  --text-primary: #1F2937;
  --text-secondary: #6B7280;
  --text-muted: #9CA3AF;
  
  /* Background Colors */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F3F4F6;
  --bg-dark: #111827;
}
```

### Spacing Tokens

```css
:root {
  /* Spacing Scale */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --spacing-2xl: 4rem;
  
  /* Component Spacing */
  --padding-section: 4rem;
  --gap-grid: 1.5rem;
  --margin-card: 2rem;
}
```

### Border Radius Tokens

```css
:root {
  /* Radius Values */
  --radius-small: 4px;
  --radius-medium: 8px;
  --radius-large: 16px;
  --radius-xlarge: 24px;
  --radius-full: 9999px;
}
```

### Shadow Tokens

```css
:root {
  /* Shadow Elevations */
  --shadow-small: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-medium: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-large: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xlarge: 0 20px 25px rgba(0, 0, 0, 0.15);
}
```

### Typography Tokens

```css
:root {
  /* Font Families */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Open Sans', sans-serif;
  --font-mono: 'Fira Code', monospace;
}
```

## Best Practices

### Naming Conventions

Use clear, semantic naming for your tokens:

**✅ Good:**
```css
--color-primary
--spacing-section
--radius-button
--shadow-card
```

**❌ Avoid:**
```css
--blue
--big-space
--round
--drop-shadow
```

### Token Organization

Group related tokens together:

```css
:root {
  /* === COLORS === */
  --color-primary: #3B82F6;
  --color-secondary: #10B981;
  
  /* === SPACING === */
  --spacing-xs: 0.5rem;
  --spacing-sm: 1rem;
  
  /* === RADIUS === */
  --radius-small: 4px;
  --radius-medium: 8px;
  
  /* === SHADOWS === */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Using Tokens in Your CSS

Reference your tokens consistently:

```css
.button {
  background-color: var(--color-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-md);
}
```

## Workflow Examples

### Example 1: Building a Design System

1. **Import your base HTML/CSS** with defined tokens
2. **Review the Style Guide** to verify all tokens were extracted
3. **Copy individual tokens** as needed when building components
4. **Export to Webflow** to create a reference page for your team

### Example 2: Client Handoff

1. **Import the client's design** with your defined token system
2. **Navigate to Style Guide** tab
3. **Click "Copy Style Guide to Webflow"**
4. **Paste into client's Webflow project**
5. Client now has a visual reference of all design tokens

### Example 3: Design System Documentation

1. **Import your design system**
2. **Use Category Copy** to export tokens by category
3. **Paste into documentation** (Notion, Confluence, etc.)
4. **Update as tokens evolve** by re-importing

## Troubleshooting

### No Tokens Detected

**Problem:** Style Guide tab shows "No design tokens found"

**Solutions:**
- Ensure your CSS uses CSS custom properties (variables starting with `--`)
- Check that variables are defined in `:root` selector
- Variables must be in the format: `--name: value;`

### Missing Token Categories

**Problem:** Some token types (radius, shadows) don't appear

**Solutions:**
- Use proper naming: `--radius-*` for border radius, `--shadow-*` for shadows
- Ensure tokens are actually defined as CSS variables, not just direct values
- Check for typos in variable names

**Note:** Spacing and UI Components sections now always appear with defaults if no tokens found!

### Style Guide Looks Different in Webflow

**Problem:** Text sizes or layout broken when pasted into Webflow

**Solution (Fixed!):** This was a major issue that's now resolved:
- Style guide now uses 100% self-contained inline styles
- Every element has explicit font sizes, spacing, and styling
- Won't be affected by your project's global CSS
- Should look perfect regardless of what you import

### Copy Button Not Working

**Problem:** Nothing happens when clicking copy buttons

**Solutions:**
- Ensure your browser supports Clipboard API
- Check browser permissions for clipboard access
- Try using HTTPS (required for clipboard API in some browsers)

### Webflow Paste Issues

**Problem:** Pasted style guide looks broken in Webflow

**Solutions:**
- Ensure you're pasting into a container on the canvas
- Check that you copied the full payload (large style guides may be truncated)
- Try pasting individual sections instead of the entire guide

## Technical Details

### Token Detection

The system automatically detects tokens by:

1. **CSS Variable Parsing**: Scans `:root` blocks for `--variable-name` patterns
2. **Type Categorization**: Classifies by name patterns and value formats
3. **Value Extraction**: Captures both light and dark mode values if present
4. **Semantic Grouping**: Organizes by purpose (primary, secondary, etc.)

### Supported Token Types

| Type | Detection Pattern | Example |
|------|------------------|---------|
| Colors | Value format, name patterns | `--color-primary: #3B82F6;` |
| Typography | `--font-` prefix | `--font-heading: 'Inter';` |
| Spacing | `--spacing-`, `-padding-`, `-margin-`, `-gap-` | `--spacing-md: 1.5rem;` |
| Radius | `--radius-` prefix | `--radius-medium: 8px;` |
| Shadows | `--shadow-` prefix | `--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);` |

### Storage Format

Tokens are stored in your project's database with the following structure:

```typescript
{
  colors: [{ name: "primary-color", value: "#3B82F6" }],
  typography: [{ name: "font-heading", value: "Inter" }],
  spacing: [{ name: "spacing-md", value: "1.5rem" }],
  radius: [{ name: "medium", value: "8px", size: "medium" }],
  shadows: [{ name: "lg", value: "0 10px 15px...", intensity: "large" }]
}
```

## API Reference

### Component Props

#### StyleGuideView

```typescript
interface StyleGuideViewProps {
  tokens: EnhancedTokenExtraction;
  onCopyWebflowPayload?: () => void;
}
```

#### CopyButton

```typescript
interface CopyButtonProps {
  value: string;
  label?: string;
  variant?: "individual" | "category";
  className?: string;
}
```

#### CategoryCopyButton

```typescript
interface CategoryCopyButtonProps {
  tokens: Array<{ name: string; value: string }>;
  category: string;
  className?: string;
}
```

## Related Features

- **[Import Wizard](../cli-prompts/START-HERE.md)**: Import projects with design tokens
- **[Component Library](./COMPONENTS.md)**: Use tokens in components
- **[Webflow Export](./WEBFLOW_EXPORT.md)**: Export designs to Webflow

## Support

For issues or questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review [Known Limitations](../STYLE_GUIDE_IMPLEMENTATION.md#known-limitations)
3. Submit an issue on GitHub

---

**Last Updated:** January 24, 2026  
**Version:** 1.0.0
