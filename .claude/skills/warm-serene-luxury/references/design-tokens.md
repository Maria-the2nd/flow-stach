# Design Tokens

Updated for Flow Party template. All values are exact.

## Colors

### Core
| Token | Value | Usage |
|-------|-------|-------|
| `--color-light` | `#FAFAFA` | Primary background |
| `--color-dark` | `#1A1A1A` | Primary text |

### Light Opacity Variants
| Token | Value |
|-------|-------|
| `--color-light-75` | `rgba(250, 250, 250, 0.75)` |
| `--color-light-10` | `rgba(250, 250, 250, 0.10)` |

### Dark Opacity Variants
| Token | Value | Usage |
|-------|-------|-------|
| `--color-dark-75` | `rgba(26, 26, 26, 0.75)` | Secondary text |
| `--color-dark-65` | `rgba(26, 26, 26, 0.65)` | Muted text |
| `--color-dark-40` | `rgba(26, 26, 26, 0.40)` | Placeholder, labels |
| `--color-dark-10` | `rgba(26, 26, 26, 0.10)` | Borders, dividers |
| `--color-dark-05` | `rgba(26, 26, 26, 0.05)` | Hover states |
| `--color-dark-03` | `rgba(26, 26, 26, 0.03)` | Card backgrounds |

### Vivid Gradients
| Token | Value | Usage |
|-------|-------|-------|
| `--gradient-purple` | `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` | Primary accent |
| `--gradient-pink` | `linear-gradient(135deg, #f093fb 0%, #f5576c 100%)` | Secondary accent |
| `--gradient-cyan` | `linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)` | Tertiary accent |
| `--gradient-green` | `linear-gradient(135deg, #11998e 0%, #38ef7d 100%)` | Success/nature |
| `--gradient-coral` | `linear-gradient(135deg, #ff531f 0%, #f093fb 100%)` | Featured/highlight |

## Typography

### Font Families
| Token | Value |
|-------|-------|
| `--font-display` | `"Antonio", sans-serif` |
| `--font-body` | `"Onest", -apple-system, sans-serif` |

### Google Fonts Import
```html
<link href="https://fonts.googleapis.com/css2?family=Antonio:wght@400;500;600;700&family=Onest:wght@300;400;500&display=swap" rel="stylesheet">
```

### Type Scale
| Style | Font | Size | Weight | Letter-spacing | Line-height | Transform |
|-------|------|------|--------|----------------|-------------|-----------|
| Display | Antonio | 96px | 600 | -0.02em | 95% | uppercase |
| H1 | Onest | 80px | 300 | -0.03em | 92% | none |
| H2 | Onest | 36px | 400 | -0.02em | 108% | none |
| Section Label | Antonio | 14px | 500 | +0.1em | 104% | uppercase |
| Body | Onest | 18px | 400 | -0.01em | 160% | none |
| Small | Onest | 14px | 400 | 0 | 136% | none |

### Responsive Typography
| Style | Desktop | Tablet (≤1199px) | Mobile (≤767px) | Small (≤479px) |
|-------|---------|------------------|-----------------|----------------|
| Display | 96px | 72px | 48px | 36px |
| H1 | 80px | 56px | 36px | 28px |
| H2 | 36px | 28px | 24px | 24px |

## Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--section-padding` | `88px` | Section vertical padding |
| `--container-max` | `1456px` | Max content width |
| `--container-padding` | `24px` | Horizontal padding |
| `--grid-gap` | `40px` | Grid column gap |

## Layout

### Grid
```css
.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 40px;
}
```

### Breakpoints
| Name | Value | Nav Behavior |
|------|-------|--------------|
| Desktop | `≥1200px` | Full nav links |
| Large Tablet | `992px – 1199px` | Hamburger menu |
| Tablet | `768px – 991px` | Hamburger menu |
| Mobile | `480px – 767px` | Hamburger menu |
| Small Mobile | `<480px` | Hamburger menu, stacked CTAs |

### Responsive Section Padding
| Breakpoint | Padding |
|------------|---------|
| Desktop | `88px` |
| Tablet (≤1199px) | `64px` |
| Mobile (≤767px) | `48px` |

## Borders

| Token | Value |
|-------|-------|
| `--border-color` | `rgba(26, 26, 26, 0.10)` |
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |
| `--radius-full` | `9999px` |

## Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition` | `0.2s ease` | Standard (buttons, links) |
| `--transition-slow` | `0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)` | Reveals, accordions |
| `--transition-smooth` | `0.6s cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions, images |

## CSS Variables Block

```css
:root {
  /* Colors */
  --color-light: #FAFAFA;
  --color-dark: #1A1A1A;
  --color-light-75: rgba(250, 250, 250, 0.75);
  --color-light-10: rgba(250, 250, 250, 0.10);
  --color-dark-75: rgba(26, 26, 26, 0.75);
  --color-dark-65: rgba(26, 26, 26, 0.65);
  --color-dark-40: rgba(26, 26, 26, 0.40);
  --color-dark-10: rgba(26, 26, 26, 0.10);
  --color-dark-05: rgba(26, 26, 26, 0.05);
  --color-dark-03: rgba(26, 26, 26, 0.03);
  
  /* Vivid Gradients */
  --gradient-purple: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-pink: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  --gradient-cyan: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  --gradient-green: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  --gradient-coral: linear-gradient(135deg, #ff531f 0%, #f093fb 100%);
  
  /* Typography */
  --font-display: "Antonio", sans-serif;
  --font-body: "Onest", -apple-system, sans-serif;
  
  /* Spacing */
  --section-padding: 88px;
  --container-max: 1456px;
  --container-padding: 24px;
  --grid-gap: 40px;
  
  /* Borders */
  --border-color: rgba(26, 26, 26, 0.10);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  
  /* Transitions */
  --transition: 0.2s ease;
  --transition-slow: 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --transition-smooth: 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
```
