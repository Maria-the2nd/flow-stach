# Flow Bridge Implementation Prompts

Based on discovery report: **39% functional coverage (70/179 requirements)**

Run these prompts in priority order. Each is self-contained and targets specific gaps.

---

## PROMPT 1: JavaScript Library CDN Detection

**Priority:** CRITICAL  
**Impact:** All JS effects (GSAP, Three.js, etc.) break without CDN links  
**Files:** `lib/webflow-converter.ts:697-748`

```
<role>
You are implementing JavaScript library detection and CDN injection for Flow Bridge, an HTML-to-Webflow converter. You have deep knowledge of popular frontend animation/interaction libraries.
</role>

<context>
Current state:
- JS bundling exists at webflow-converter.ts:697-748 (creates HtmlEmbed)
- No library detection or CDN injection
- Scripts execute without dependencies → breaks GSAP, Three.js, etc.

The conversion pipeline already:
- Extracts <script> content from HTML (html-parser.ts:147-160)
- Creates HtmlEmbed nodes for JS (webflow-converter.ts:697-748)
</context>

<instructions>
## Task
Add library detection and CDN injection to the JS embed generation.

## Step 1: Create Library Detection Module
Create `lib/js-library-detector.ts` with:

```typescript
interface LibraryMatch {
  name: string;
  patterns: RegExp[];
  cdnUrl: string;
  cssUrl?: string;  // Some libraries need CSS too
  order: number;    // Load order (lower = first)
}

const LIBRARY_REGISTRY: LibraryMatch[] = [
  {
    name: 'gsap-core',
    patterns: [/\bgsap\./, /\bGSAP\b/, /\bTweenMax\b/, /\bTweenLite\b/, /\bTimelineMax\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
    order: 1
  },
  {
    name: 'gsap-scrolltrigger',
    patterns: [/\bScrollTrigger\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
    order: 2
  },
  {
    name: 'gsap-flip',
    patterns: [/\bFlip\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js',
    order: 2
  },
  {
    name: 'gsap-draggable',
    patterns: [/\bDraggable\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Draggable.min.js',
    order: 2
  },
  {
    name: 'gsap-motionpath',
    patterns: [/\bMotionPathPlugin\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js',
    order: 2
  },
  {
    name: 'lenis',
    patterns: [/\bLenis\b/, /\bnew\s+Lenis\b/],
    cdnUrl: 'https://unpkg.com/@studio-freight/lenis@latest/dist/lenis.min.js',
    order: 3
  },
  {
    name: 'barba',
    patterns: [/\bbarba\./, /\bBarba\b/],
    cdnUrl: 'https://unpkg.com/@barba/core',
    order: 3
  },
  {
    name: 'swiper',
    patterns: [/\bSwiper\b/, /\bnew\s+Swiper\b/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',
    cssUrl: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
    order: 3
  },
  {
    name: 'split-type',
    patterns: [/\bSplitType\b/],
    cdnUrl: 'https://unpkg.com/split-type',
    order: 3
  },
  {
    name: 'matter',
    patterns: [/\bMatter\./, /\bMatter\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js',
    order: 3
  },
  {
    name: 'three',
    patterns: [/\bTHREE\./, /\bTHREE\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    order: 3
  },
  {
    name: 'locomotive',
    patterns: [/\bLocomotiveScroll\b/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js',
    cssUrl: 'https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css',
    order: 3
  },
  {
    name: 'anime',
    patterns: [/\banime\(/, /\banime\./],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js',
    order: 3
  }
];
```

## Step 2: Implement Detection Function

```typescript
export interface DetectedLibraries {
  scripts: string[];   // CDN URLs for <script> tags
  styles: string[];    // CDN URLs for <link> tags
  names: string[];     // Library names for logging
}

export function detectLibraries(jsCode: string): DetectedLibraries {
  const detected = new Set<LibraryMatch>();
  
  for (const lib of LIBRARY_REGISTRY) {
    for (const pattern of lib.patterns) {
      if (pattern.test(jsCode)) {
        detected.add(lib);
        break;
      }
    }
  }
  
  // Sort by order
  const sorted = Array.from(detected).sort((a, b) => a.order - b.order);
  
  return {
    scripts: sorted.map(lib => lib.cdnUrl),
    styles: sorted.filter(lib => lib.cssUrl).map(lib => lib.cssUrl!),
    names: sorted.map(lib => lib.name)
  };
}
```

## Step 3: Implement Script Wrapping

```typescript
export function wrapWithDOMContentLoaded(jsCode: string): string {
  // Don't double-wrap
  if (/DOMContentLoaded|document\.readyState/.test(jsCode)) {
    return jsCode;
  }
  
  return `document.addEventListener('DOMContentLoaded', function() {
${jsCode}
});`;
}

export function generateScriptEmbed(
  userJs: string, 
  libraries: DetectedLibraries
): string {
  const parts: string[] = [];
  
  // Add CSS links for libraries that need them
  for (const cssUrl of libraries.styles) {
    parts.push(`<link rel="stylesheet" href="${cssUrl}">`);
  }
  
  // Add library scripts
  for (const scriptUrl of libraries.scripts) {
    parts.push(`<script src="${scriptUrl}"><\/script>`);
  }
  
  // Add user script wrapped in DOMContentLoaded
  const wrappedJs = wrapWithDOMContentLoaded(userJs);
  parts.push(`<script>\n${wrappedJs}\n<\/script>`);
  
  return parts.join('\n');
}
```

## Step 4: Integrate into webflow-converter.ts

Modify the JS embed generation (around line 697-748):

1. Import the new module
2. Call detectLibraries() on the extracted JS
3. Use generateScriptEmbed() to create the HtmlEmbed content
4. Add detected library names to conversion warnings/info

## Step 5: Add Club GreenSock Warning

Some GSAP plugins are paid (Club GreenSock). Detect and warn:

```typescript
const CLUB_GREENSOCK_PATTERNS = [
  { name: 'ScrollSmoother', pattern: /\bScrollSmoother\b/ },
  { name: 'SplitText', pattern: /\bSplitText\b/ },
  { name: 'MorphSVG', pattern: /\bMorphSVGPlugin\b/ },
  { name: 'DrawSVG', pattern: /\bDrawSVGPlugin\b/ },
];

export function detectPaidPlugins(jsCode: string): string[] {
  return CLUB_GREENSOCK_PATTERNS
    .filter(p => p.pattern.test(jsCode))
    .map(p => p.name);
}
```

Add warnings when paid plugins detected (no CDN available).
</instructions>

<constraints>
- Do NOT modify existing JS extraction logic in html-parser.ts
- Do NOT break existing HtmlEmbed generation
- Preserve all existing functionality
- Add comprehensive JSDoc comments
- Include unit tests for library detection
</constraints>

<output_format>
1. Create lib/js-library-detector.ts with full implementation
2. Modify lib/webflow-converter.ts to integrate
3. Add tests in appropriate test file
4. Show git diff of changes
</output_format>
```

---

## PROMPT 2: Min-Width Breakpoint Support (1920px, 1440px, 1280px)

**Priority:** CRITICAL  
**Impact:** Desktop-first designs lose high-resolution styling  
**Files:** `lib/css-parser.ts:363-387, 1007-1058`

```
<role>
You are extending Flow Bridge's breakpoint mapping to support Webflow's three larger breakpoints (1920px, 1440px, 1280px) which use min-width queries and cascade UP.
</role>

<context>
Current state (css-parser.ts):
- detectBreakpoint() at lines 363-387 only handles max-width
- min-width ≥ 992px promotes to base styles (line 1028-1029)
- Four breakpoints supported: tiny (≤479), small (≤767), medium (≤991), desktop (base)

Webflow's actual breakpoint system:
- 1920px: min-width ≥1920px, cascades UP
- 1440px: min-width ≥1440px, cascades UP  
- 1280px: min-width ≥1280px, cascades UP
- Desktop (base): 992px-1279px, applies to ALL
- Tablet: max-width ≤991px, cascades DOWN
- Mobile Landscape: max-width ≤767px, cascades DOWN
- Mobile Portrait: max-width ≤478px, cascades DOWN
</context>

<instructions>
## Task
Extend breakpoint detection to handle min-width queries for larger breakpoints.

## Step 1: Update Breakpoint Types

In css-parser.ts, update the ClassIndexEntry interface (around line 16-25):

```typescript
interface ClassIndexEntry {
  className: string;
  baseStyles: Record<string, string>;
  hoverStyles: Record<string, string>;
  focusStyles: Record<string, string>;
  activeStyles: Record<string, string>;
  visitedStyles: Record<string, string>;
  // Existing (max-width, cascade DOWN)
  desktop: Record<string, string>;   // base
  medium: Record<string, string>;    // ≤991px tablet
  small: Record<string, string>;     // ≤767px mobile landscape
  tiny: Record<string, string>;      // ≤478px mobile portrait
  // NEW (min-width, cascade UP)
  xlarge: Record<string, string>;    // ≥1280px
  xxlarge: Record<string, string>;   // ≥1440px
  xxxlarge: Record<string, string>;  // ≥1920px
}
```

## Step 2: Update detectBreakpoint Function

Replace lines 363-387:

```typescript
type BreakpointName = 'tiny' | 'small' | 'medium' | 'desktop' | 'xlarge' | 'xxlarge' | 'xxxlarge';

interface BreakpointResult {
  name: BreakpointName;
  isMinWidth: boolean;  // true = cascades up, false = cascades down
}

function detectBreakpoint(mediaQuery: string): BreakpointResult | null {
  // Extract width value and type
  const maxMatch = mediaQuery.match(/max-width:\s*(\d+)/i);
  const minMatch = mediaQuery.match(/min-width:\s*(\d+)/i);
  
  if (maxMatch) {
    const width = parseInt(maxMatch[1], 10);
    // Cascade DOWN breakpoints
    if (width <= 479) return { name: 'tiny', isMinWidth: false };
    if (width <= 767) return { name: 'small', isMinWidth: false };
    if (width <= 991) return { name: 'medium', isMinWidth: false };
    // Anything above 991 in max-width goes to desktop base
    return { name: 'desktop', isMinWidth: false };
  }
  
  if (minMatch) {
    const width = parseInt(minMatch[1], 10);
    // Cascade UP breakpoints
    if (width >= 1920) return { name: 'xxxlarge', isMinWidth: true };
    if (width >= 1440) return { name: 'xxlarge', isMinWidth: true };
    if (width >= 1280) return { name: 'xlarge', isMinWidth: true };
    // min-width below 1280 promotes to desktop base
    return { name: 'desktop', isMinWidth: true };
  }
  
  return null; // Non-standard query
}
```

## Step 3: Handle Non-Standard Breakpoints with Rounding

```typescript
function roundToNearestBreakpoint(width: number, isMinWidth: boolean): BreakpointName {
  if (isMinWidth) {
    // Round UP for min-width
    if (width >= 1800) return 'xxxlarge';
    if (width >= 1400) return 'xxlarge';
    if (width >= 1200) return 'xlarge';
    return 'desktop';
  } else {
    // Round to nearest for max-width
    if (width <= 500) return 'tiny';
    if (width <= 800) return 'small';
    if (width <= 1024) return 'medium';
    return 'desktop';
  }
}
```

## Step 4: Update extractMediaBlocks (lines 1007-1058)

Modify to handle both min-width and max-width, route non-standard queries to embed:

```typescript
interface MediaBlock {
  query: string;
  content: string;
  breakpoint: BreakpointResult | null;
  isNonStandard: boolean;  // For embed routing
}

function extractMediaBlocks(css: string): {
  standard: MediaBlock[];
  nonStandard: MediaBlock[];  // These go to embed
} {
  const standard: MediaBlock[] = [];
  const nonStandard: MediaBlock[] = [];
  
  // ... existing brace matching logic ...
  
  for (const block of mediaBlocks) {
    const breakpoint = detectBreakpoint(block.query);
    
    // Check for non-standard queries
    const isNonStandard = 
      /orientation/i.test(block.query) ||
      /prefers-color-scheme/i.test(block.query) ||
      /prefers-reduced-motion/i.test(block.query) ||
      /print/i.test(block.query) ||
      /hover:\s*hover/i.test(block.query) ||
      /@container/i.test(block.query);
    
    if (isNonStandard || !breakpoint) {
      nonStandard.push({ ...block, breakpoint: null, isNonStandard: true });
    } else {
      standard.push({ ...block, breakpoint, isNonStandard: false });
    }
  }
  
  return { standard, nonStandard };
}
```

## Step 5: Update Webflow JSON Generation

The Webflow styleLess format uses these breakpoint keys:
- `main` - desktop base
- `medium` - tablet (≤991px)
- `small` - mobile landscape (≤767px)  
- `tiny` - mobile portrait (≤478px)
- `large` - 1280px breakpoint
- `xlarge` - 1440px breakpoint
- `xxlarge` - 1920px breakpoint

Update the style generation to include the new breakpoint keys.

## Step 6: Add Logging/Warnings

When breakpoints are rounded or non-standard queries are extracted:

```typescript
warnings.push({
  type: 'breakpoint_rounded',
  message: `Media query "${query}" rounded to ${breakpoint.name}`,
  severity: 'info'
});

warnings.push({
  type: 'breakpoint_embedded',
  message: `Non-standard media query moved to embed: ${query}`,
  severity: 'warning'
});
```
</instructions>

<constraints>
- Maintain backward compatibility with existing max-width handling
- Do NOT break existing 4-breakpoint output
- Non-standard queries MUST be extracted to embed, not discarded
- Add comprehensive tests for edge cases
</constraints>

<output_format>
1. Update lib/css-parser.ts with new breakpoint logic
2. Update any types/interfaces affected
3. Add tests for min-width detection
4. Show git diff of changes
</output_format>
```

---

## PROMPT 3: CSS Embed Routing for Complex Selectors

**Priority:** CRITICAL  
**Impact:** ::before, ::after, @keyframes, attribute selectors lost  
**Files:** `lib/css-parser.ts`, `lib/webflow-transcoder.ts`, `lib/webflow-literalizer.ts`

```
<role>
You are implementing CSS embed routing for Flow Bridge. Complex CSS that Webflow can't handle natively must be extracted into a separate embed block instead of being discarded.
</role>

<context>
Current state:
- webflow-literalizer.ts:137-140 warns and removes ::before/::after
- webflow-converter.ts:101-103 strips vendor prefixes
- No @keyframes detection or preservation
- Attribute selectors not handled
- Complex selectors generate warnings but are lost

These CSS features MUST go to embed (not native Webflow):
- @keyframes animations
- ::before, ::after pseudo-elements
- Complex pseudo-classes (:nth-child, :not, :has, :where, :is)
- Descendant/child/sibling combinators (.parent .child, .parent > .child, .el + .el)
- Attribute selectors ([data-*], input[type="text"])
- Compound selectors (.class1.class2)
- @font-face declarations
- @supports queries
- CSS variables (:root declarations)
- Vendor prefixes (-webkit-*, -moz-*)
</context>

<instructions>
## Task
Create a CSS routing system that separates native Webflow styles from embed-required styles.

## Step 1: Create CSS Router Module

Create `lib/css-embed-router.ts`:

```typescript
export interface CSSRoutingResult {
  native: string;           // CSS for Webflow native styles
  embed: string;            // CSS for embed block
  warnings: RouterWarning[];
}

export interface RouterWarning {
  type: 'embed_routed' | 'selector_complex' | 'at_rule_extracted';
  selector?: string;
  reason: string;
}

// Patterns that MUST go to embed
const EMBED_REQUIRED_PATTERNS = {
  // At-rules
  keyframes: /@keyframes\s+[\w-]+\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gi,
  fontFace: /@font-face\s*\{[^}]+\}/gi,
  supports: /@supports\s*\([^)]+\)\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gi,
  
  // CSS variables (entire :root block)
  rootVariables: /:root\s*\{[^}]+\}/gi,
};

// Selector patterns that require embed
const EMBED_SELECTOR_PATTERNS = [
  /::before/,
  /::after/,
  /::placeholder/,
  /::selection/,
  /::first-letter/,
  /::first-line/,
  /:nth-child\(/,
  /:nth-of-type\(/,
  /:nth-last-child\(/,
  /:nth-last-of-type\(/,
  /:first-of-type/,
  /:last-of-type/,
  /:only-child/,
  /:only-of-type/,
  /:not\(/,
  /:has\(/,
  /:where\(/,
  /:is\(/,
  /:empty/,
  /:target/,
  /:focus-within/,
  /:focus-visible/,
  /\[[\w-]+/, // Attribute selectors
  /\s+>\s+/,  // Child combinator
  /\s+\+\s+/, // Adjacent sibling
  /\s+~\s+/,  // General sibling
  /\.\w+\.\w+/, // Compound selectors
  /^#[\w-]+/,  // ID selectors (for styling)
  /^(html|body|div|span|p|a|ul|ol|li|h[1-6]|img|form|input|button|table|tr|td|th)\b/, // Tag selectors
];

// Vendor prefixes to embed
const VENDOR_PREFIXES = ['-webkit-', '-moz-', '-ms-', '-o-'];
```

## Step 2: Implement Router Function

```typescript
export function routeCSS(rawCSS: string): CSSRoutingResult {
  const warnings: RouterWarning[] = [];
  const embedParts: string[] = [];
  let nativeCSS = rawCSS;
  
  // Step 1: Extract at-rules
  for (const [name, pattern] of Object.entries(EMBED_REQUIRED_PATTERNS)) {
    const matches = nativeCSS.match(pattern);
    if (matches) {
      embedParts.push(...matches);
      nativeCSS = nativeCSS.replace(pattern, '');
      warnings.push({
        type: 'at_rule_extracted',
        reason: `@${name} moved to embed`
      });
    }
  }
  
  // Step 2: Extract rules with complex selectors
  const rulePattern = /([^{}]+)\{([^{}]+)\}/g;
  const nativeRules: string[] = [];
  let match;
  
  while ((match = rulePattern.exec(nativeCSS)) !== null) {
    const selector = match[1].trim();
    const body = match[2];
    
    const needsEmbed = EMBED_SELECTOR_PATTERNS.some(p => p.test(selector));
    
    if (needsEmbed) {
      embedParts.push(`${selector} { ${body} }`);
      warnings.push({
        type: 'selector_complex',
        selector,
        reason: 'Complex selector requires embed'
      });
    } else {
      nativeRules.push(`${selector} { ${body} }`);
    }
  }
  
  // Step 3: Handle vendor prefixes in remaining rules
  // Extract properties with vendor prefixes into embed versions
  
  return {
    native: nativeRules.join('\n'),
    embed: formatEmbedCSS(embedParts),
    warnings
  };
}

function formatEmbedCSS(parts: string[]): string {
  if (parts.length === 0) return '';
  
  return `<style>
/* === FLOW BRIDGE: Non-Native CSS === */
${parts.join('\n\n')}
</style>`;
}
```

## Step 3: Handle Breakpoints in Embed CSS

When CSS is routed to embed, preserve the original media queries:

```typescript
function formatEmbedWithBreakpoints(
  embedRules: Map<string, string[]>  // breakpoint -> rules
): string {
  const parts: string[] = [];
  
  // Base styles (no media query)
  if (embedRules.has('base')) {
    parts.push(embedRules.get('base')!.join('\n'));
  }
  
  // Tablet (max-width: 991px)
  if (embedRules.has('medium')) {
    parts.push(`@media (max-width: 991px) {\n${embedRules.get('medium')!.join('\n')}\n}`);
  }
  
  // Mobile Landscape (max-width: 767px)
  if (embedRules.has('small')) {
    parts.push(`@media (max-width: 767px) {\n${embedRules.get('small')!.join('\n')}\n}`);
  }
  
  // Mobile Portrait (max-width: 478px)
  if (embedRules.has('tiny')) {
    parts.push(`@media (max-width: 478px) {\n${embedRules.get('tiny')!.join('\n')}\n}`);
  }
  
  // Large breakpoints (min-width, cascade up)
  if (embedRules.has('xlarge')) {
    parts.push(`@media (min-width: 1280px) {\n${embedRules.get('xlarge')!.join('\n')}\n}`);
  }
  
  if (embedRules.has('xxlarge')) {
    parts.push(`@media (min-width: 1440px) {\n${embedRules.get('xxlarge')!.join('\n')}\n}`);
  }
  
  if (embedRules.has('xxxlarge')) {
    parts.push(`@media (min-width: 1920px) {\n${embedRules.get('xxxlarge')!.join('\n')}\n}`);
  }
  
  return parts.join('\n\n');
}
```

## Step 4: Integrate into Conversion Pipeline

Modify webflow-converter.ts to:
1. Call routeCSS() early in the pipeline
2. Pass native CSS to existing style parser
3. Generate separate HtmlEmbed for embed CSS
4. Place CSS embed BEFORE JS embed in output

## Step 5: Handle Edge Cases

```typescript
// Descendant selectors: try to flatten if simple
function tryFlattenDescendant(selector: string): string | null {
  // ".nav .link" -> can't flatten, embed
  // ".nav-link" already flat -> native
  const parts = selector.split(/\s+/);
  if (parts.length === 2 && parts.every(p => /^\.[a-z][\w-]*$/i.test(p))) {
    // Simple two-class descendant, must embed
    return null;
  }
  return null; // Can't flatten
}

// State selectors: separate base from state
function separateStateSelector(selector: string): { base: string; state: string } | null {
  const stateMatch = selector.match(/^(.+)(:(hover|focus|active|visited))$/);
  if (stateMatch) {
    return { base: stateMatch[1], state: stateMatch[2] };
  }
  return null;
}
```
</instructions>

<constraints>
- NEVER discard CSS - route to embed if not native
- Preserve exact selector specificity in embed
- Maintain order of rules (specificity matters)
- Test with real AI-generated HTML (messy selectors)
- Validate embed doesn't exceed 100KB (error) or 10KB (warn)
</constraints>

<output_format>
1. Create lib/css-embed-router.ts
2. Integrate into lib/webflow-converter.ts
3. Update lib/webflow-literalizer.ts to use router instead of stripping
4. Add comprehensive tests
5. Show git diff of changes
</output_format>
```

---

## PROMPT 4: BEM Class Naming in AI Renaming

**Priority:** HIGH  
**Impact:** Classes renamed but not in BEM format  
**Files:** `lib/flowbridge-semantic.ts:78-100`

```
<role>
You are enhancing Flow Bridge's AI class renaming to generate proper BEM-format class names and detect high-risk generic names that cause Webflow collisions.
</role>

<context>
Current state (flowbridge-semantic.ts):
- inferComponentName() at lines 78-100 generates names like "Nav", "Hero", "Footer"
- Not BEM format (should be "nav__item--active" not "NavItem")
- No high-risk generic name detection
- No JS class reference updating
- Namespace prefix supported but BEM structure missing

BEM format: block__element--modifier
- block: component name (nav, hero, card)
- element: part of component (item, heading, button)
- modifier: variant (active, large, primary)
</context>

<instructions>
## Task
Extend AI class renaming to output BEM-format names and detect collision risks.

## Step 1: Update Naming Output Format

Modify flowbridge-semantic.ts to generate BEM names:

```typescript
interface BEMClassMapping {
  original: string;
  bem: {
    block: string;
    element?: string;
    modifier?: string;
  };
  formatted: string;  // "block__element--modifier"
}

function formatBEM(block: string, element?: string, modifier?: string): string {
  let result = block.toLowerCase();
  if (element) result += `__${element.toLowerCase()}`;
  if (modifier) result += `--${modifier.toLowerCase()}`;
  return result;
}

// Examples:
// "Nav" + "Item" + "active" -> "nav__item--active"
// "Hero" + "Heading" -> "hero__heading"
// "Card" -> "card"
```

## Step 2: Enhance Component Inference

Update inferComponentName to detect element roles:

```typescript
interface ElementContext {
  tagName: string;
  parentBlock?: string;
  textContent?: string;
  classList: string[];
  attributes: Record<string, string>;
}

function inferElementRole(ctx: ElementContext): { element?: string; modifier?: string } {
  const { tagName, textContent, classList } = ctx;
  
  // Infer element from tag
  const tagToElement: Record<string, string> = {
    'h1': 'heading',
    'h2': 'heading',
    'h3': 'subheading',
    'h4': 'subheading',
    'h5': 'label',
    'h6': 'label',
    'p': 'text',
    'a': 'link',
    'button': 'button',
    'img': 'image',
    'ul': 'list',
    'ol': 'list',
    'li': 'item',
    'input': 'input',
    'label': 'label',
    'form': 'form',
    'nav': 'nav',
    'span': 'text',
  };
  
  let element = tagToElement[tagName.toLowerCase()];
  
  // Infer modifier from classes or content
  let modifier: string | undefined;
  
  // Check for size modifiers
  if (classList.some(c => /large|lg|big/i.test(c))) modifier = 'large';
  if (classList.some(c => /small|sm|tiny/i.test(c))) modifier = 'small';
  
  // Check for state modifiers
  if (classList.some(c => /active|current/i.test(c))) modifier = 'active';
  if (classList.some(c => /disabled/i.test(c))) modifier = 'disabled';
  
  // Check for variant modifiers
  if (classList.some(c => /primary/i.test(c))) modifier = 'primary';
  if (classList.some(c => /secondary/i.test(c))) modifier = 'secondary';
  
  // Check for visual modifiers
  if (classList.some(c => /dark/i.test(c))) modifier = 'dark';
  if (classList.some(c => /light/i.test(c))) modifier = 'light';
  
  // Refine element from content
  if (tagName === 'a' && textContent) {
    if (/learn more|read more|see more/i.test(textContent)) element = 'cta';
    if (/sign up|register|subscribe/i.test(textContent)) element = 'cta';
  }
  
  if (tagName === 'button' && textContent) {
    if (/submit|send/i.test(textContent)) element = 'submit';
    if (/cancel|close/i.test(textContent)) element = 'cancel';
  }
  
  return { element, modifier };
}
```

## Step 3: High-Risk Generic Name Detection

```typescript
const HIGH_RISK_GENERIC_NAMES = new Set([
  'container', 'wrapper', 'section', 'box', 'block',
  'button', 'btn', 'link', 'text', 'title', 'heading',
  'header', 'footer', 'nav', 'navbar', 'menu',
  'hero', 'cta', 'card', 'grid', 'flex', 'row', 'col', 'column',
  'image', 'img', 'icon', 'logo',
  'form', 'input', 'label', 'field',
  'list', 'item', 'content', 'main', 'aside',
  'active', 'visible', 'hidden', 'disabled',
  'primary', 'secondary', 'success', 'error', 'warning',
  'large', 'small', 'medium',
]);

// Webflow's reserved prefix
const WEBFLOW_RESERVED_PREFIX = 'w-';

function isHighRiskClass(className: string): boolean {
  const normalized = className.toLowerCase().replace(/[-_]/g, '');
  return HIGH_RISK_GENERIC_NAMES.has(normalized) || 
         className.startsWith(WEBFLOW_RESERVED_PREFIX);
}

function detectHighRiskClasses(classes: string[]): string[] {
  return classes.filter(isHighRiskClass);
}
```

## Step 4: Update Class Mapping with Namespace

```typescript
interface ClassRenameResult {
  mapping: Map<string, string>;  // original -> renamed
  highRiskDetected: string[];
  report: string;
}

function generateClassRenames(
  elements: ElementContext[],
  options: {
    namespace: string;
    blockName: string;
  }
): ClassRenameResult {
  const mapping = new Map<string, string>();
  const highRiskDetected: string[] = [];
  
  for (const el of elements) {
    for (const originalClass of el.classList) {
      if (mapping.has(originalClass)) continue;
      
      // Check high risk
      if (isHighRiskClass(originalClass)) {
        highRiskDetected.push(originalClass);
      }
      
      // Infer BEM parts
      const { element, modifier } = inferElementRole(el);
      
      // Format with namespace
      const bemName = formatBEM(
        `${options.namespace}${options.blockName}`,
        element,
        modifier
      );
      
      mapping.set(originalClass, bemName);
    }
  }
  
  return {
    mapping,
    highRiskDetected,
    report: generateReport(mapping, highRiskDetected)
  };
}

function generateReport(
  mapping: Map<string, string>,
  highRisk: string[]
): string {
  let report = 'CLASS RENAMING REPORT\n';
  report += '═'.repeat(40) + '\n\n';
  
  if (highRisk.length > 0) {
    report += '⚠️  HIGH-RISK GENERIC NAMES DETECTED:\n';
    report += highRisk.map(c => `   - ${c}`).join('\n');
    report += '\n\n';
  }
  
  report += 'ORIGINAL → RENAMED\n';
  report += '─'.repeat(40) + '\n';
  
  for (const [orig, renamed] of mapping) {
    report += `${orig.padEnd(25)} → ${renamed}\n`;
  }
  
  return report;
}
```

## Step 5: Update JavaScript Class References

```typescript
function updateJSClassReferences(
  jsCode: string,
  mapping: Map<string, string>
): string {
  let updated = jsCode;
  
  for (const [original, renamed] of mapping) {
    // querySelector patterns
    updated = updated.replace(
      new RegExp(`(['"\`])\\.${escapeRegex(original)}\\1`, 'g'),
      `$1.${renamed}$1`
    );
    
    // classList patterns
    updated = updated.replace(
      new RegExp(`classList\\.(add|remove|toggle|contains)\\((['"\`])${escapeRegex(original)}\\2\\)`, 'g'),
      `classList.$1($2${renamed}$2)`
    );
    
    // className assignment
    updated = updated.replace(
      new RegExp(`className\\s*=\\s*(['"\`])${escapeRegex(original)}\\1`, 'g'),
      `className = $1${renamed}$1`
    );
  }
  
  return updated;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

## Step 6: Add Configuration Options

```typescript
interface ClassRenamingOptions {
  enabled: boolean;
  namespace: string;
  preserveClasses: string[];  // Whitelist
  detectHighRisk: boolean;
  updateJSReferences: boolean;
  outputFormat: 'kebab-case' | 'camelCase' | 'PascalCase';
}

const DEFAULT_OPTIONS: ClassRenamingOptions = {
  enabled: true,
  namespace: 'fb-',
  preserveClasses: [],
  detectHighRisk: true,
  updateJSReferences: true,
  outputFormat: 'kebab-case',
};
```
</instructions>

<constraints>
- Preserve existing namespace functionality
- Don't rename classes in preserveClasses whitelist
- BEM format must be valid (no double underscores/dashes)
- JS reference updating must not break valid JS
- Generate detailed report for user review
</constraints>

<output_format>
1. Update lib/flowbridge-semantic.ts with BEM naming
2. Add high-risk detection
3. Add JS reference updating
4. Add configuration options
5. Show git diff of changes
</output_format>
```

---

## PROMPT 5: Asset URL Validation

**Priority:** HIGH  
**Impact:** Relative paths and data URIs cause broken images  
**Files:** `lib/webflow-converter.ts:557-570`

```
<role>
You are implementing asset URL validation for Flow Bridge to handle different image source types appropriately.
</role>

<context>
Current state (webflow-converter.ts:557-570):
- Handles <img> tags but no URL validation
- No distinction between absolute URLs, relative paths, data URIs
- No background-image URL handling

Required behavior:
- Absolute URLs (https://...) → keep as-is
- Data URIs (data:image/...) → flag for conversion, warn user
- Relative paths (./img/..., ../assets/...) → flag error, require user action
- background-image: url(...) → same logic
</context>

<instructions>
## Task
Add asset URL validation with appropriate handling for each type.

## Step 1: Create Asset Validator Module

Create `lib/asset-validator.ts`:

```typescript
export type AssetURLType = 'absolute' | 'data-uri' | 'relative' | 'protocol-relative' | 'invalid';

export interface AssetValidation {
  url: string;
  type: AssetURLType;
  isValid: boolean;
  warning?: string;
  error?: string;
  suggestedAction?: string;
}

export function classifyURL(url: string): AssetURLType {
  const trimmed = url.trim();
  
  if (!trimmed || trimmed === '') return 'invalid';
  
  // Data URI
  if (trimmed.startsWith('data:')) return 'data-uri';
  
  // Absolute URL
  if (/^https?:\/\//i.test(trimmed)) return 'absolute';
  
  // Protocol-relative
  if (trimmed.startsWith('//')) return 'protocol-relative';
  
  // Relative path
  if (trimmed.startsWith('./') || 
      trimmed.startsWith('../') || 
      trimmed.startsWith('/') ||
      /^[\w-]+\//.test(trimmed)) {
    return 'relative';
  }
  
  // Bare filename
  if (/\.(jpg|jpeg|png|gif|svg|webp|avif|ico)$/i.test(trimmed)) {
    return 'relative';
  }
  
  return 'invalid';
}

export function validateAssetURL(url: string): AssetValidation {
  const type = classifyURL(url);
  
  switch (type) {
    case 'absolute':
      return {
        url,
        type,
        isValid: true
      };
      
    case 'protocol-relative':
      return {
        url: `https:${url}`,  // Upgrade to https
        type,
        isValid: true,
        warning: 'Protocol-relative URL upgraded to HTTPS'
      };
      
    case 'data-uri':
      return {
        url,
        type,
        isValid: false,  // Can't use directly in Webflow
        warning: 'Data URI detected - requires conversion to hosted image',
        suggestedAction: 'Upload to Webflow assets or external host'
      };
      
    case 'relative':
      return {
        url,
        type,
        isValid: false,
        error: 'Relative path will not work in Webflow',
        suggestedAction: 'Upload image and use absolute URL'
      };
      
    case 'invalid':
    default:
      return {
        url,
        type: 'invalid',
        isValid: false,
        error: 'Invalid or empty URL'
      };
  }
}
```

## Step 2: Validate All Asset References

```typescript
export interface AssetManifest {
  images: AssetValidation[];
  backgroundImages: AssetValidation[];
  fonts: AssetValidation[];
  errors: string[];
  warnings: string[];
}

export function extractAndValidateAssets(
  html: string,
  css: string
): AssetManifest {
  const manifest: AssetManifest = {
    images: [],
    backgroundImages: [],
    fonts: [],
    errors: [],
    warnings: []
  };
  
  // Extract <img src="...">
  const imgPattern = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const validation = validateAssetURL(match[1]);
    manifest.images.push(validation);
    
    if (validation.error) manifest.errors.push(`Image: ${validation.error} - ${match[1]}`);
    if (validation.warning) manifest.warnings.push(`Image: ${validation.warning} - ${match[1]}`);
  }
  
  // Extract <source src="..."> (picture element)
  const sourcePattern = /<source[^>]+src(?:set)?=["']([^"']+)["']/gi;
  while ((match = sourcePattern.exec(html)) !== null) {
    const validation = validateAssetURL(match[1]);
    manifest.images.push(validation);
    
    if (validation.error) manifest.errors.push(`Source: ${validation.error} - ${match[1]}`);
    if (validation.warning) manifest.warnings.push(`Source: ${validation.warning} - ${match[1]}`);
  }
  
  // Extract background-image: url(...)
  const bgPattern = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgPattern.exec(css)) !== null) {
    const validation = validateAssetURL(match[1]);
    manifest.backgroundImages.push(validation);
    
    if (validation.error) manifest.errors.push(`Background: ${validation.error} - ${match[1]}`);
    if (validation.warning) manifest.warnings.push(`Background: ${validation.warning} - ${match[1]}`);
  }
  
  // Extract @font-face src
  const fontPattern = /@font-face\s*\{[^}]*src:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = fontPattern.exec(css)) !== null) {
    const validation = validateAssetURL(match[1]);
    manifest.fonts.push(validation);
    
    if (validation.error) manifest.errors.push(`Font: ${validation.error} - ${match[1]}`);
    if (validation.warning) manifest.warnings.push(`Font: ${validation.warning} - ${match[1]}`);
  }
  
  return manifest;
}
```

## Step 3: Google Fonts Detection

```typescript
export interface GoogleFontInfo {
  families: string[];
  weights: string[];
  linkTag: string;
}

export function detectGoogleFonts(html: string): GoogleFontInfo | null {
  // Match Google Fonts link tags
  const linkPattern = /<link[^>]+href=["']([^"']*fonts\.googleapis\.com[^"']*)["']/gi;
  const match = linkPattern.exec(html);
  
  if (!match) return null;
  
  const url = match[1];
  const families: string[] = [];
  const weights: string[] = [];
  
  // Parse family parameter
  const familyMatch = url.match(/family=([^&]+)/);
  if (familyMatch) {
    const familyStr = decodeURIComponent(familyMatch[1]);
    // Format: "Roboto:wght@400;700|Open+Sans:wght@400"
    const familyParts = familyStr.split('|');
    
    for (const part of familyParts) {
      const [name, weightStr] = part.split(':');
      families.push(name.replace(/\+/g, ' '));
      
      if (weightStr) {
        const weightMatch = weightStr.match(/wght@([\d;]+)/);
        if (weightMatch) {
          weights.push(...weightMatch[1].split(';'));
        }
      }
    }
  }
  
  return {
    families,
    weights: [...new Set(weights)],
    linkTag: match[0]
  };
}
```

## Step 4: Integrate into Converter

Modify webflow-converter.ts:

```typescript
// Early in conversion pipeline
const assetManifest = extractAndValidateAssets(html, css);

// Add to conversion result
if (assetManifest.errors.length > 0) {
  result.errors.push(...assetManifest.errors);
}

if (assetManifest.warnings.length > 0) {
  result.warnings.push(...assetManifest.warnings);
}

// For invalid images, either:
// 1. Replace with placeholder
// 2. Remove src attribute
// 3. Block conversion (configurable)
```
</instructions>

<constraints>
- Do NOT automatically fix relative paths (user must provide correct URL)
- Data URIs should warn but not block conversion
- Generate clear actionable messages for user
- Include line numbers in error messages if possible
</constraints>

<output_format>
1. Create lib/asset-validator.ts
2. Integrate into lib/webflow-converter.ts
3. Add asset manifest to conversion output
4. Add tests for URL classification
5. Show git diff of changes
</output_format>
```

---

## PROMPT 6: Validation & Safety Checks

**Priority:** MEDIUM  
**Impact:** Prevents corrupt Webflow projects  
**Files:** `lib/webflow-converter.ts`, `lib/webflow-verifier.ts`

```
<role>
You are implementing pre-flight validation checks for Flow Bridge to prevent corrupt Webflow projects from being generated.
</role>

<context>
Current state:
- webflow-verifier.ts has criticalFailures/warnings/recommendations (lines 14-29)
- No duplicate UUID checking
- No orphan node reference validation
- No circular dependency detection
- Embed size warning exists (>10KB warn, >100KB error)

Critical issues that corrupt Webflow projects:
1. Duplicate UUIDs - makes project unrecoverable
2. Orphan node references - children array references non-existent nodes
3. Circular references - parent/child loops
4. Malformed JSON structure
</context>

<instructions>
## Task
Add pre-flight validation to prevent Webflow project corruption.

## Step 1: UUID Validation

```typescript
interface UUIDValidation {
  isValid: boolean;
  duplicates: string[];
  invalidFormat: string[];
}

function validateUUIDs(nodes: WebflowNode[]): UUIDValidation {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  const invalidFormat: string[] = [];
  
  const UUID_PATTERN = /^[a-f0-9-]+$/i;
  
  function walk(node: WebflowNode) {
    const id = node._id;
    
    // Check format
    if (!UUID_PATTERN.test(id)) {
      invalidFormat.push(id);
    }
    
    // Check duplicates
    const count = (seen.get(id) || 0) + 1;
    seen.set(id, count);
    if (count === 2) {
      duplicates.push(id);
    }
    
    // Walk children
    if (node.children) {
      for (const childId of node.children) {
        const child = findNode(childId);
        if (child) walk(child);
      }
    }
  }
  
  for (const node of nodes) {
    walk(node);
  }
  
  return {
    isValid: duplicates.length === 0 && invalidFormat.length === 0,
    duplicates,
    invalidFormat
  };
}
```

## Step 2: Orphan Node Detection

```typescript
interface OrphanValidation {
  isValid: boolean;
  orphanReferences: Array<{ parentId: string; missingChildId: string }>;
  unreachableNodes: string[];
}

function validateNodeReferences(
  nodes: WebflowNode[],
  rootIds: string[]
): OrphanValidation {
  const nodeMap = new Map<string, WebflowNode>();
  const reachable = new Set<string>();
  const orphanReferences: Array<{ parentId: string; missingChildId: string }> = [];
  
  // Build node map
  for (const node of nodes) {
    nodeMap.set(node._id, node);
  }
  
  // Walk from roots, track reachable nodes
  function walk(nodeId: string, visited: Set<string>) {
    if (visited.has(nodeId)) return; // Cycle detection
    visited.add(nodeId);
    reachable.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    if (node.children) {
      for (const childId of node.children) {
        if (!nodeMap.has(childId)) {
          orphanReferences.push({ parentId: nodeId, missingChildId: childId });
        } else {
          walk(childId, visited);
        }
      }
    }
  }
  
  for (const rootId of rootIds) {
    walk(rootId, new Set());
  }
  
  // Find unreachable nodes
  const unreachableNodes = nodes
    .map(n => n._id)
    .filter(id => !reachable.has(id));
  
  return {
    isValid: orphanReferences.length === 0,
    orphanReferences,
    unreachableNodes
  };
}
```

## Step 3: Circular Reference Detection

```typescript
interface CircularValidation {
  isValid: boolean;
  cycles: string[][];  // Each array is a cycle path
}

function detectCircularReferences(nodes: WebflowNode[]): CircularValidation {
  const nodeMap = new Map<string, WebflowNode>();
  const cycles: string[][] = [];
  
  for (const node of nodes) {
    nodeMap.set(node._id, node);
  }
  
  function detectCycle(
    nodeId: string,
    path: string[],
    visited: Set<string>,
    recStack: Set<string>
  ): boolean {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (!node || !node.children) {
      recStack.delete(nodeId);
      path.pop();
      return false;
    }
    
    for (const childId of node.children) {
      if (!visited.has(childId)) {
        if (detectCycle(childId, path, visited, recStack)) {
          return true;
        }
      } else if (recStack.has(childId)) {
        // Found cycle
        const cycleStart = path.indexOf(childId);
        cycles.push([...path.slice(cycleStart), childId]);
        return true;
      }
    }
    
    recStack.delete(nodeId);
    path.pop();
    return false;
  }
  
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  for (const node of nodes) {
    if (!visited.has(node._id)) {
      detectCycle(node._id, [], visited, recStack);
    }
  }
  
  return {
    isValid: cycles.length === 0,
    cycles
  };
}
```

## Step 4: Style Validation

```typescript
interface StyleValidation {
  isValid: boolean;
  invalidStyles: Array<{ className: string; property: string; value: string; reason: string }>;
  missingStyleRefs: string[];  // Nodes reference non-existent styles
}

function validateStyles(
  styles: WebflowStyle[],
  nodes: WebflowNode[]
): StyleValidation {
  const styleMap = new Map<string, WebflowStyle>();
  const invalidStyles: Array<{ className: string; property: string; value: string; reason: string }> = [];
  const missingStyleRefs: string[] = [];
  
  for (const style of styles) {
    styleMap.set(style.className, style);
    
    // Validate CSS syntax in styleLess
    if (style.styleLess) {
      const cssErrors = validateCSSSnippet(style.styleLess);
      for (const err of cssErrors) {
        invalidStyles.push({
          className: style.className,
          property: err.property,
          value: err.value,
          reason: err.reason
        });
      }
    }
  }
  
  // Check all node class references exist
  for (const node of nodes) {
    if (node.classes) {
      for (const classRef of node.classes) {
        if (!styleMap.has(classRef)) {
          missingStyleRefs.push(`Node ${node._id} references missing style: ${classRef}`);
        }
      }
    }
  }
  
  return {
    isValid: invalidStyles.length === 0 && missingStyleRefs.length === 0,
    invalidStyles,
    missingStyleRefs
  };
}

function validateCSSSnippet(css: string): Array<{ property: string; value: string; reason: string }> {
  const errors: Array<{ property: string; value: string; reason: string }> = [];
  
  // Split into property: value pairs
  const declarations = css.split(';').filter(d => d.trim());
  
  for (const decl of declarations) {
    const [prop, ...valueParts] = decl.split(':');
    const property = prop?.trim();
    const value = valueParts.join(':').trim();
    
    if (!property || !value) {
      errors.push({ property: property || '?', value: value || '?', reason: 'Malformed declaration' });
      continue;
    }
    
    // Check for common issues
    if (value.includes('undefined') || value.includes('NaN')) {
      errors.push({ property, value, reason: 'Contains undefined/NaN' });
    }
    
    if (value.includes('{{') || value.includes('}}')) {
      errors.push({ property, value, reason: 'Contains unresolved template variables' });
    }
  }
  
  return errors;
}
```

## Step 5: Master Validation Function

```typescript
export interface PreflightResult {
  isValid: boolean;
  canProceed: boolean;  // true if only warnings, no critical errors
  uuid: UUIDValidation;
  references: OrphanValidation;
  circular: CircularValidation;
  styles: StyleValidation;
  embedSize: { css: number; js: number; warnings: string[] };
  summary: string;
}

export function runPreflightValidation(
  payload: WebflowPayload
): PreflightResult {
  const uuid = validateUUIDs(payload.nodes);
  const references = validateNodeReferences(payload.nodes, [payload.rootId]);
  const circular = detectCircularReferences(payload.nodes);
  const styles = validateStyles(payload.styles, payload.nodes);
  
  const embedSize = {
    css: payload.cssEmbed?.length || 0,
    js: payload.jsEmbed?.length || 0,
    warnings: [] as string[]
  };
  
  if (embedSize.css > 100000) {
    embedSize.warnings.push('CSS embed exceeds 100KB - may fail to paste');
  } else if (embedSize.css > 10000) {
    embedSize.warnings.push('CSS embed exceeds 10KB - consider optimization');
  }
  
  if (embedSize.js > 100000) {
    embedSize.warnings.push('JS embed exceeds 100KB - may fail to paste');
  }
  
  // Critical failures that MUST block
  const criticalFailures = [
    !uuid.isValid && 'Duplicate or invalid UUIDs detected',
    !circular.isValid && 'Circular references detected',
    references.orphanReferences.length > 0 && 'Orphan node references detected',
  ].filter(Boolean);
  
  const isValid = criticalFailures.length === 0 && styles.isValid;
  const canProceed = criticalFailures.length === 0;
  
  return {
    isValid,
    canProceed,
    uuid,
    references,
    circular,
    styles,
    embedSize,
    summary: generateValidationSummary(criticalFailures, styles, embedSize)
  };
}

function generateValidationSummary(
  criticalFailures: string[],
  styles: StyleValidation,
  embedSize: { warnings: string[] }
): string {
  const lines: string[] = [];
  
  if (criticalFailures.length > 0) {
    lines.push('❌ CRITICAL FAILURES (paste will corrupt project):');
    lines.push(...criticalFailures.map(f => `   - ${f}`));
  }
  
  if (!styles.isValid) {
    lines.push('⚠️  STYLE WARNINGS:');
    lines.push(...styles.invalidStyles.map(s => 
      `   - ${s.className}: ${s.property} = ${s.value} (${s.reason})`
    ));
  }
  
  if (embedSize.warnings.length > 0) {
    lines.push('⚠️  EMBED SIZE WARNINGS:');
    lines.push(...embedSize.warnings.map(w => `   - ${w}`));
  }
  
  if (lines.length === 0) {
    lines.push('✅ All validations passed');
  }
  
  return lines.join('\n');
}
```
</instructions>

<constraints>
- BLOCK conversion if critical failures detected (duplicates, circular refs)
- Allow conversion with warnings for non-critical issues
- Include clear error messages with node IDs for debugging
- Performance: validation should complete in <100ms for typical components
</constraints>

<output_format>
1. Create lib/preflight-validator.ts
2. Integrate into lib/webflow-converter.ts (run before output)
3. Update lib/webflow-verifier.ts to use new validators
4. Add comprehensive tests
5. Show git diff of changes
</output_format>
```

---

## Execution Order

Run prompts in this order for maximum impact:

1. **PROMPT 1: JS Library CDN** → Fixes broken animations immediately
2. **PROMPT 3: CSS Embed Routing** → Preserves ::before/::after/@keyframes
3. **PROMPT 2: Min-Width Breakpoints** → Enables 1920/1440/1280px styling
4. **PROMPT 6: Validation** → Prevents corrupt projects
5. **PROMPT 5: Asset Validation** → Catches broken images early
6. **PROMPT 4: BEM Naming** → Improves class quality

After completing all prompts, expected coverage: **~70-75%** (up from 39%)

---

## Post-Implementation Testing

After each prompt, test with:

```html
<!-- Test HTML with common patterns -->
<section class="hero">
  <h1 class="hero-title">Test</h1>
  <button class="btn primary" data-action="scroll">CTA</button>
</section>

<style>
  .hero::before { content: ''; position: absolute; }
  .hero-title { font-size: 48px; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @media (min-width: 1440px) { .hero-title { font-size: 64px; } }
</style>

<script>
  gsap.from('.hero-title', { opacity: 0, y: 50 });
</script>
```

Verify:
1. GSAP CDN added before user script
2. ::before and @keyframes in CSS embed
3. 1440px breakpoint styles preserved
4. No validation errors
5. Classes renamed to BEM format
