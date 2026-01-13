# HTML Breakdown Process

> How to convert AI-generated HTML into Flow Stach sections + design tokens

---

## Current State

**Input**: Single HTML file from AI (Claude, ChatGPT, etc.)
- Contains all sections in one file
- Has CSS with `:root` variables and section-specific styles
- May include JavaScript

**Output needed**:
1. **Token manifest** (`{name}-tokens.json`) - extracted design variables
2. **Section files** - one HTML per section, each self-contained

---

## Problems With Current Approach

| Issue | Example |
|-------|---------|
| **Inconsistent tokens** | `flow-party-header.html` has 15 tokens, `flow-party-stash.html` has 6 |
| **Duplicated CSS** | Every section file has full `:root` block |
| **Manual splitting** | No clear rules for what constitutes a "section" |
| **Mixed CSS** | Section files include CSS for other sections |

---

## Improved Process

### Step 1: Extract Design Tokens (FIRST)

Before splitting sections, extract ALL tokens from the full HTML.

**What to extract:**
- Colors (hex values in `:root`)
- Font families
- Border radius values (keep as reference, don't make variables)
- Spacing values (keep as reference, don't make variables)

**Token manifest format:**
```json
{
  "schemaVersion": "1.0",
  "name": "Template Name",
  "slug": "template-slug",
  "namespace": "xx",
  "modes": ["light", "dark"],
  "variables": [
    { "path": "Colors / Background / Base", "type": "color", "cssVar": "--xx-bg", "values": { "light": "#f5f5f5", "dark": "#2d2f2e" } }
  ]
}
```

**Rules:**
- Only colors and font families become Webflow Variables
- Spacing, radius, shadows stay as CSS (not variables)
- Namespace = 2-3 letter prefix (fp, xx, etc.)
- Use slash notation for paths: `Colors / Accent / Strong`

---

### Step 2: Identify Sections

Look for these patterns in the HTML:

| Pattern | Section Type |
|---------|--------------|
| `<nav>` or `.nav` | Navigation |
| `<header>` or `.hero` | Hero |
| `<section>` with id | Named section |
| `<footer>` | Footer |
| Distinct visual block | Section |

**Section naming convention:**
```
{template-slug}-{section-name}.html

Examples:
flow-party-header.html      (nav + hero combined)
flow-party-client-bar.html  (logo bar)
flow-party-intro.html       (intro section)
flow-party-bento.html       (bento grid)
flow-party-stash.html       (products)
flow-party-pricing.html     (pricing table)
flow-party-faq.html         (accordion)
flow-party-cta.html         (call to action)
flow-party-footer.html      (footer)
```

---

### Step 3: Create Section Files

Each section file should be **self-contained**:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{Section Name}</title>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">

    <style>
        /* ===========================================
           DESIGN TOKENS (FULL SET - always include)
           =========================================== */
        :root {
            /* Dark Palette */
            --dark-bg: #2d2f2e;
            --dark-secondary: #434645;
            --text-light: #ffffff;
            --text-muted-dark: #767f7a;

            /* Light Palette */
            --light-bg: #f5f5f5;
            --card-bg: #ffffff;
            --text-dark: #171717;
            --text-muted: #afb6b4;
            --border: #dddfde;

            /* Accent Scale */
            --coral-lightest: #fff0eb;
            --coral-light: #ffc8b8;
            --coral-medium: #ff9d80;
            --coral-strong: #ff531f;
            --coral-vivid: #ff825c;

            /* Border Radius */
            --radius-sm: 24px;
            --radius-md: 32px;
            --radius-lg: 40px;
            --radius-xl: 48px;
            --radius-pill: 9999px;

            /* Typography */
            --font-body: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
            --font-logo: 'Antonio', sans-serif;
        }

        /* Base Reset */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--font-body);
            background: var(--dark-bg);  /* or --light-bg depending on section */
            color: var(--text-light);    /* or --text-dark */
            line-height: 1.5;
        }

        /* ===========================================
           SECTION-SPECIFIC STYLES (only this section)
           =========================================== */
        .section-name {
            /* styles */
        }

        /* ===========================================
           SHARED COMPONENTS (if used in this section)
           =========================================== */
        .btn-primary {
            /* only if buttons used in this section */
        }

        /* ===========================================
           RESPONSIVE
           =========================================== */
        @media (max-width: 1024px) { }
        @media (max-width: 768px) { }
        @media (max-width: 480px) { }
    </style>
</head>
<body>
    <!-- SECTION HTML ONLY -->
    <section class="section-name">
        ...
    </section>
</body>
</html>
```

---

### Step 4: Token-to-Webflow Variable Mapping

When creating the token manifest, map CSS variables to Webflow Variable paths:

| CSS Variable | Webflow Path | Type |
|--------------|--------------|------|
| `--dark-bg` | Colors / Background / Dark | color |
| `--light-bg` | Colors / Background / Light | color |
| `--card-bg` | Colors / Background / Card | color |
| `--text-light` | Colors / Text / Light | color |
| `--text-dark` | Colors / Text / Dark | color |
| `--text-muted` | Colors / Text / Muted | color |
| `--coral-strong` | Colors / Accent / Strong | color |
| `--coral-lightest` | Colors / Accent / Lightest | color |
| `--font-body` | Typography / Body | fontFamily |
| `--font-logo` | Typography / Display | fontFamily |

**NOT variables (stay as CSS):**
- `--radius-*` (Webflow doesn't support size variables well)
- `--spacing-*` (keep fixed)
- `--shadow-*` (keep fixed)

---

## Checklist for Each Section File

- [ ] Has complete `:root` with ALL design tokens
- [ ] Has base reset (`*`, `body`)
- [ ] Has ONLY CSS for this section (no other sections)
- [ ] Has shared components CSS (buttons, links) if used
- [ ] Has responsive breakpoints for this section only
- [ ] HTML is inside `<section>` or appropriate semantic tag
- [ ] No JavaScript unless section-specific
- [ ] Google Fonts linked in `<head>`

---

## Token Extraction Prompt (for AI)

When you have a full HTML file and want to extract tokens, use this prompt:

```
Extract design tokens from this HTML file. Output a JSON manifest with:

1. All color values from :root (as type: "color")
2. All font-family values from :root (as type: "fontFamily")
3. Use "light" and "dark" modes where applicable
4. Use slash notation for paths: "Colors / Background / Base"
5. Use 2-3 letter namespace prefix for cssVar

Do NOT include:
- Border radius values
- Spacing/padding values
- Shadow values
- Animation values

Format:
{
  "schemaVersion": "1.0",
  "name": "Template Name",
  "slug": "template-slug",
  "namespace": "xx",
  "modes": ["light", "dark"],
  "variables": [...]
}
```

---

## Section Splitting Prompt (for AI)

```
Split this HTML file into separate section files. For each section:

1. Create a complete standalone HTML file
2. Include the FULL :root design tokens (copy from original)
3. Include ONLY the CSS for that specific section
4. Include shared component CSS (buttons, links) if used in that section
5. Include responsive styles for that section only
6. Name files as: {template-slug}-{section-name}.html

Sections to identify:
- Navigation (nav, header)
- Hero (main banner)
- Each <section> tag with an id
- Footer

Output each file separately with clear filename header.
```

---

## File Structure After Breakdown

```
temp/
├── {template}-full.html          # Original AI output
├── {template}-tokens.json        # Extracted token manifest
├── {template}-header.html        # Nav + Hero (if combined)
├── {template}-nav.html           # Navigation only (if separate)
├── {template}-hero.html          # Hero only (if separate)
├── {template}-{section}.html     # Each section
├── {template}-footer.html        # Footer
└── style.css                     # (optional) shared styles reference
```

---

## Known Issues to Fix

1. **`flow-party-header.html`** - Has nav + hero combined. Consider splitting.
2. **Token inconsistency** - Standardize ALL section files to have full `:root`
3. **CSS leakage** - Some files have CSS for components not in that section

---

## Next Steps

1. [ ] Re-extract tokens from `flow-party-full.html` into `flow-party-tokens.json`
2. [ ] Update all 14 section files to have consistent full `:root` blocks
3. [ ] Clean CSS in each file to only include that section's styles
4. [ ] Create prompt templates for future AI-generated sites
