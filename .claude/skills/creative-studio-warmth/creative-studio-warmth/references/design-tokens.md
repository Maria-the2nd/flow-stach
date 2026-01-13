# Design Tokens

## Colors

### Dark Palette
```css
--dark-bg: #2d2f2e;           /* Hero, services, stats backgrounds */
--dark-secondary: #434645;     /* Watermark text, subtle elements */
--text-light: #ffffff;         /* White text on dark */
--text-muted-dark: #767f7a;    /* Muted text on dark backgrounds */
```

### Light Palette
```css
--light-bg: #f5f5f5;          /* Main content background */
--card-bg: #ffffff;            /* Cards, FAQ, footer */
--text-dark: #171717;          /* Primary text on light */
--text-muted: #afb6b4;         /* Secondary text, labels */
--border: #dddfde;             /* Borders, dividers */
```

### Coral Scale (Key Accent)
```css
--coral-lightest: #fff0eb;    /* Discovery band, subtle highlights */
--coral-light: #ffc8b8;       /* Concept band */
--coral-medium: #ff9d80;      /* Execution band */
--coral-strong: #ff531f;      /* Primary CTA, Launch band, links */
--coral-vivid: #ff825c;       /* Hover states */
```

## Typography

### Fonts
- **Display/Logo**: `Antonio` (700 weight, uppercase)
- **Body**: `Plus Jakarta Sans` (400, 500, 600, 700 weights)
- **Fallback**: `-apple-system, BlinkMacSystemFont, sans-serif`

### Scale
```css
/* Responsive clamp values */
--text-hero: clamp(2rem, 4vw, 3rem);
--text-section: clamp(3rem, 7vw, 5rem);
--text-giant: clamp(5rem, 10vw, 8rem);
--text-watermark: clamp(10rem, 22vw, 18rem);
```

## Border Radius
```css
--radius-sm: 24px;    /* Cards */
--radius-md: 32px;    /* Footer, hero image */
--radius-lg: 40px;    /* Large elements */
--radius-xl: 48px;    /* Content wrapper overlap */
--radius-pill: 9999px; /* Buttons, pills */
```

## Transitions
```css
/* Standard */
transition: all 0.3s ease;

/* Hero animations */
animation: slideFromLeft 1.4s cubic-bezier(1, -0.13, 0.18, 0.96);
animation: slideFromBottom 0.9s cubic-bezier(1, -0.13, 0.18, 0.96);
animation: fadeUp 0.6s cubic-bezier(0.93, 0.03, 0.56, 1);
```

## Breakpoints
- **Desktop**: 1200px+
- **Tablet**: 810px - 1199px
- **Mobile**: < 810px
