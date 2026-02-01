/**
 * Framework Detector
 *
 * Early detection of React, JSX, Tailwind, and other frameworks that may cause
 * conversion issues. This runs BEFORE conversion to warn/block incompatible content.
 *
 * CRITICAL: AI-generated sites often use React/JSX. This detector ensures we catch
 * these patterns early rather than failing with cryptic errors like React #137.
 */

// ============================================
// TYPES
// ============================================

export type FrameworkType =
  | 'react'
  | 'jsx'
  | 'tailwind'
  | 'vue'
  | 'angular'
  | 'svelte'
  | 'alpine'
  | 'unknown';

export type DetectionSeverity = 'block' | 'warn' | 'info';

export interface FrameworkDetection {
  /** Type of framework detected */
  framework: FrameworkType;
  /** Confidence level 0-1 */
  confidence: number;
  /** What triggered this detection */
  evidence: string[];
  /** Severity - should we block or just warn? */
  severity: DetectionSeverity;
  /** Human-readable message */
  message: string;
  /** Suggestion for user */
  suggestion: string;
}

export interface VoidElementIssue {
  /** The void element tag */
  tag: string;
  /** What's wrong with it */
  issue: 'has_children' | 'has_text' | 'malformed';
  /** Description */
  description: string;
  /** The problematic content (snippet) */
  snippet: string;
}

export interface FrameworkDetectionResult {
  /** Is the content safe to convert? */
  canConvert: boolean;
  /** Should we warn the user? */
  hasWarnings: boolean;
  /** All framework detections */
  frameworks: FrameworkDetection[];
  /** Void element issues found */
  voidElementIssues: VoidElementIssue[];
  /** Combined summary message */
  summary: string;
  /** Detailed issues for display */
  issues: Array<{
    severity: DetectionSeverity;
    message: string;
    suggestion?: string;
  }>;
}

// ============================================
// VOID ELEMENTS (HTML5 spec)
// ============================================

/**
 * Complete list of HTML5 void elements.
 * These elements CANNOT have children - they are self-closing.
 * If we detect content inside them, it's malformed HTML or JSX.
 *
 * React Error #137: "X is a void element tag and must neither have
 * children nor use dangerouslySetInnerHTML"
 */
export const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',    // Deprecated but still void
  'source',
  'track',
  'wbr',
]);

/**
 * Void elements that we drop entirely (handled in dropTags)
 */
export const VOID_ELEMENTS_TO_DROP = new Set([
  'meta',
  'link',
  'base',
  'input',  // Forms not supported
]);

/**
 * Void elements that need special conversion
 */
export const VOID_ELEMENTS_TO_CONVERT = new Set([
  'br',      // -> text node with \n
  'hr',      // -> styled div
  'img',     // -> Image node
  'embed',   // -> HtmlEmbed or drop
  'source',  // -> within video/audio
  'track',   // -> within video
  'area',    // -> within map, convert to link
  'col',     // -> within colgroup
  'wbr',     // -> text node with zero-width space
  'param',   // -> deprecated, drop
]);

// ============================================
// REACT/JSX DETECTION PATTERNS
// ============================================

/**
 * Strong React/JSX indicators - if found, content is likely React
 */
const REACT_STRONG_PATTERNS = [
  // JSX attribute syntax (camelCase events)
  { pattern: /\sonClick\s*=\s*[{]/i, description: 'JSX onClick handler' },
  { pattern: /\sonChange\s*=\s*[{]/i, description: 'JSX onChange handler' },
  { pattern: /\sonSubmit\s*=\s*[{]/i, description: 'JSX onSubmit handler' },
  { pattern: /\sonKeyDown\s*=\s*[{]/i, description: 'JSX onKeyDown handler' },
  { pattern: /\sonMouseEnter\s*=\s*[{]/i, description: 'JSX onMouseEnter handler' },

  // className instead of class (definitive React)
  { pattern: /\sclassName\s*=\s*["'{]/i, description: 'JSX className attribute' },

  // JSX expressions in attributes
  { pattern: /\s\w+\s*=\s*\{[^}]+\}/i, description: 'JSX expression in attribute' },

  // React fragment syntax
  { pattern: /<React\.Fragment>/i, description: 'React.Fragment component' },
  { pattern: /<Fragment>/i, description: 'Fragment component' },
  { pattern: /<>/i, description: 'React fragment shorthand' },

  // React hooks in script
  { pattern: /useState\s*\(/i, description: 'React useState hook' },
  { pattern: /useEffect\s*\(/i, description: 'React useEffect hook' },
  { pattern: /useRef\s*\(/i, description: 'React useRef hook' },
  { pattern: /useContext\s*\(/i, description: 'React useContext hook' },
  { pattern: /useMemo\s*\(/i, description: 'React useMemo hook' },
  { pattern: /useCallback\s*\(/i, description: 'React useCallback hook' },

  // React imports
  { pattern: /import\s+.*\s+from\s+['"]react['"]/i, description: 'React import' },
  { pattern: /import\s+.*\s+from\s+['"]react-dom['"]/i, description: 'ReactDOM import' },
  { pattern: /require\s*\(\s*['"]react['"]\s*\)/i, description: 'React require' },

  // JSX self-closing syntax with spaces (React style)
  { pattern: /<\w+[^>]+\/\s*>/i, description: 'JSX self-closing tag' },

  // ReactDOM render
  { pattern: /ReactDOM\.render\s*\(/i, description: 'ReactDOM.render call' },
  { pattern: /createRoot\s*\(/i, description: 'React 18 createRoot' },

  // Component syntax patterns - NO 'i' flag to ensure case-sensitive matching
  // Must match PascalCase like <MyComponent not <div
  { pattern: /<[A-Z][a-zA-Z0-9]*\s/, description: 'PascalCase component tag' },
  { pattern: /<[A-Z][a-zA-Z0-9]*>/, description: 'PascalCase component tag' },

  // CSS-in-JS patterns (Styled Components, Emotion)
  { pattern: /styled\.[a-z]+`/i, description: 'Styled Components template' },
  { pattern: /styled\([^)]+\)`/i, description: 'Styled Components wrapper' },
  { pattern: /css`[^`]+`/i, description: 'Emotion css template' },
  { pattern: /@emotion\/react/i, description: 'Emotion import' },
  { pattern: /styled-components/i, description: 'Styled Components import' },

  // CSS Modules (className={styles.xxx})
  { pattern: /className=\{styles\.\w+\}/i, description: 'CSS Modules usage' },

  // Legacy React class components (should be deprecated per the document)
  { pattern: /extends\s+React\.Component/i, description: 'React class component' },
  { pattern: /extends\s+Component/i, description: 'React class component' },
  { pattern: /React\.createClass/i, description: 'Legacy createClass (deprecated)' },
  { pattern: /componentWillMount/i, description: 'Deprecated lifecycle method' },
  { pattern: /componentWillReceiveProps/i, description: 'Deprecated lifecycle method' },
  { pattern: /componentWillUpdate/i, description: 'Deprecated lifecycle method' },

  // Redux/Global state (won't work with Webflow's isolated roots)
  { pattern: /useSelector\s*\(/i, description: 'Redux useSelector hook' },
  { pattern: /useDispatch\s*\(/i, description: 'Redux useDispatch hook' },
  { pattern: /<Provider\s+store=/i, description: 'Redux Provider' },

  // Next.js specific patterns
  { pattern: /import\s+.*\s+from\s+['"]next\/link['"]/i, description: 'Next.js Link import' },
  { pattern: /import\s+.*\s+from\s+['"]next\/image['"]/i, description: 'Next.js Image import' },
  { pattern: /import\s+.*\s+from\s+['"]next\/router['"]/i, description: 'Next.js Router import' },
  { pattern: /getServerSideProps/i, description: 'Next.js SSR function' },
  { pattern: /getStaticProps/i, description: 'Next.js SSG function' },
];

/**
 * Weak React/JSX indicators - need multiple to confirm
 * These are less definitive and could appear in non-React code
 */
const REACT_WEAK_PATTERNS = [
  // JSX expression with JavaScript code (e.g., {variable} or {obj.property})
  // Must have actual JS-like content, not just empty braces
  { pattern: /\{[a-zA-Z_$][a-zA-Z0-9_$.]*\}/i, description: 'JSX variable expression' },
  // Could be React or data attribute
  { pattern: /data-testid\s*=/i, description: 'data-testid attribute (common in React)' },
  // Conditional rendering patterns - more specific to avoid CSS false positives
  { pattern: /\{[^}]+\s*\?\s*[^}]+\s*:\s*[^}]+\}/i, description: 'Ternary in JSX' },
  { pattern: /\{[^}]+\s*&&\s*</i, description: 'Conditional rendering' },
];

// ============================================
// TAILWIND DETECTION PATTERNS
// ============================================

/**
 * Common Tailwind utility class patterns
 */
const TAILWIND_PATTERNS = [
  // Layout
  { pattern: /\bflex\b/i, description: 'flex utility' },
  { pattern: /\bgrid\b/i, description: 'grid utility' },
  { pattern: /\bhidden\b/i, description: 'hidden utility' },
  { pattern: /\bblock\b/i, description: 'block utility' },
  { pattern: /\binline-flex\b/i, description: 'inline-flex utility' },

  // Spacing (p-X, m-X, px-X, etc.)
  { pattern: /\bp-\d+\b/i, description: 'padding utility' },
  { pattern: /\bpx-\d+\b/i, description: 'padding-x utility' },
  { pattern: /\bpy-\d+\b/i, description: 'padding-y utility' },
  { pattern: /\bpt-\d+\b/i, description: 'padding-top utility' },
  { pattern: /\bpb-\d+\b/i, description: 'padding-bottom utility' },
  { pattern: /\bpl-\d+\b/i, description: 'padding-left utility' },
  { pattern: /\bpr-\d+\b/i, description: 'padding-right utility' },
  { pattern: /\bm-\d+\b/i, description: 'margin utility' },
  { pattern: /\bmx-\d+\b/i, description: 'margin-x utility' },
  { pattern: /\bmy-\d+\b/i, description: 'margin-y utility' },
  { pattern: /\bmt-\d+\b/i, description: 'margin-top utility' },
  { pattern: /\bmb-\d+\b/i, description: 'margin-bottom utility' },
  { pattern: /\bml-\d+\b/i, description: 'margin-left utility' },
  { pattern: /\bmr-\d+\b/i, description: 'margin-right utility' },
  { pattern: /\bgap-\d+\b/i, description: 'gap utility' },
  { pattern: /\bspace-[xy]-\d+\b/i, description: 'space utility' },

  // Sizing
  { pattern: /\bw-\d+\b/i, description: 'width utility' },
  { pattern: /\bh-\d+\b/i, description: 'height utility' },
  { pattern: /\bw-full\b/i, description: 'full width utility' },
  { pattern: /\bh-full\b/i, description: 'full height utility' },
  { pattern: /\bw-screen\b/i, description: 'screen width utility' },
  { pattern: /\bh-screen\b/i, description: 'screen height utility' },
  { pattern: /\bmax-w-/i, description: 'max-width utility' },
  { pattern: /\bmin-h-/i, description: 'min-height utility' },

  // Colors with Tailwind naming
  { pattern: /\bbg-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/i, description: 'Tailwind color utility' },
  { pattern: /\btext-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/i, description: 'Tailwind text color utility' },
  { pattern: /\bborder-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/i, description: 'Tailwind border color utility' },

  // Typography
  { pattern: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/i, description: 'Tailwind text size utility' },
  { pattern: /\bfont-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/i, description: 'Tailwind font weight utility' },
  { pattern: /\bleading-\d+\b/i, description: 'Tailwind line-height utility' },
  { pattern: /\btracking-/i, description: 'Tailwind letter-spacing utility' },

  // Borders
  { pattern: /\brounded-(?:none|sm|md|lg|xl|2xl|3xl|full)\b/i, description: 'Tailwind rounded utility' },
  { pattern: /\bborder-\d+\b/i, description: 'Tailwind border width utility' },

  // Shadows
  { pattern: /\bshadow-(?:sm|md|lg|xl|2xl|inner|none)\b/i, description: 'Tailwind shadow utility' },

  // Flexbox/Grid specific
  { pattern: /\bitems-(?:start|end|center|baseline|stretch)\b/i, description: 'Tailwind align-items utility' },
  { pattern: /\bjustify-(?:start|end|center|between|around|evenly)\b/i, description: 'Tailwind justify-content utility' },
  { pattern: /\bflex-(?:row|col|wrap|nowrap)\b/i, description: 'Tailwind flex direction utility' },
  { pattern: /\bgrid-cols-\d+\b/i, description: 'Tailwind grid columns utility' },
  { pattern: /\bcol-span-\d+\b/i, description: 'Tailwind col-span utility' },

  // Responsive prefixes
  { pattern: /\b(?:sm|md|lg|xl|2xl):/i, description: 'Tailwind responsive prefix' },

  // State prefixes
  { pattern: /\bhover:/i, description: 'Tailwind hover prefix' },
  { pattern: /\bfocus:/i, description: 'Tailwind focus prefix' },
  { pattern: /\bactive:/i, description: 'Tailwind active prefix' },
  { pattern: /\bdark:/i, description: 'Tailwind dark mode prefix' },
];

// ============================================
// VUE DETECTION PATTERNS
// ============================================

const VUE_PATTERNS = [
  { pattern: /\bv-if\s*=/i, description: 'Vue v-if directive' },
  { pattern: /\bv-for\s*=/i, description: 'Vue v-for directive' },
  { pattern: /\bv-model\s*=/i, description: 'Vue v-model directive' },
  { pattern: /\bv-bind\s*:/i, description: 'Vue v-bind directive' },
  { pattern: /\bv-on\s*:/i, description: 'Vue v-on directive' },
  { pattern: /@click\s*=/i, description: 'Vue @click shorthand' },
  { pattern: /:class\s*=/i, description: 'Vue :class binding' },
  { pattern: /\{\{\s*\w+\s*\}\}/i, description: 'Vue mustache syntax' },
  { pattern: /import\s+.*\s+from\s+['"]vue['"]/i, description: 'Vue import' },
];

// ============================================
// ANGULAR DETECTION PATTERNS
// ============================================

const ANGULAR_PATTERNS = [
  { pattern: /\*ngIf\s*=/i, description: 'Angular *ngIf directive' },
  { pattern: /\*ngFor\s*=/i, description: 'Angular *ngFor directive' },
  { pattern: /\[ngClass\]\s*=/i, description: 'Angular ngClass binding' },
  { pattern: /\(click\)\s*=/i, description: 'Angular (click) binding' },
  { pattern: /\[\(ngModel\)\]/i, description: 'Angular two-way binding' },
  { pattern: /\{\{\s*\w+\s*\}\}/i, description: 'Angular interpolation' },
  { pattern: /import\s+.*\s+from\s+['"]@angular/i, description: 'Angular import' },
];

// ============================================
// SVELTE DETECTION PATTERNS
// ============================================

const SVELTE_PATTERNS = [
  { pattern: /\{#if\s+/i, description: 'Svelte #if block' },
  { pattern: /\{#each\s+/i, description: 'Svelte #each block' },
  { pattern: /\{\/if\}/i, description: 'Svelte /if block' },
  { pattern: /\{\/each\}/i, description: 'Svelte /each block' },
  { pattern: /on:click\s*=/i, description: 'Svelte on:click' },
  { pattern: /bind:\w+\s*=/i, description: 'Svelte bind directive' },
  { pattern: /import\s+.*\s+from\s+['"]svelte/i, description: 'Svelte import' },
];

// ============================================
// ALPINE.JS DETECTION PATTERNS
// ============================================

const ALPINE_PATTERNS = [
  { pattern: /x-data\s*=/i, description: 'Alpine x-data directive' },
  { pattern: /x-show\s*=/i, description: 'Alpine x-show directive' },
  { pattern: /x-if\s*=/i, description: 'Alpine x-if directive' },
  { pattern: /x-for\s*=/i, description: 'Alpine x-for directive' },
  { pattern: /@click\s*=/i, description: 'Alpine @click shorthand' },
  { pattern: /x-bind\s*:/i, description: 'Alpine x-bind directive' },
  { pattern: /x-on\s*:/i, description: 'Alpine x-on directive' },
];

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Detect React/JSX patterns in HTML content
 */
function detectReact(html: string): FrameworkDetection | null {
  const evidence: string[] = [];
  let strongMatches = 0;
  let weakMatches = 0;

  // Check strong patterns
  for (const { pattern, description } of REACT_STRONG_PATTERNS) {
    if (pattern.test(html)) {
      evidence.push(description);
      strongMatches++;
    }
  }

  // Check weak patterns
  for (const { pattern, description } of REACT_WEAK_PATTERNS) {
    if (pattern.test(html)) {
      evidence.push(`[weak] ${description}`);
      weakMatches++;
    }
  }

  // Need at least 1 strong match or 4+ weak matches to detect React
  if (strongMatches === 0 && weakMatches < 4) {
    return null;
  }

  // Calculate confidence
  const confidence = Math.min(1, (strongMatches * 0.3) + (weakMatches * 0.1));

  // Determine severity based on what we found - any strong match = block
  const hasClassName = evidence.some(e => e.includes('className'));
  const hasJsxHandler = evidence.some(e => e.includes('onClick') || e.includes('onChange') || e.includes('onSubmit'));
  const hasHook = evidence.some(e => e.includes('useState') || e.includes('useEffect') || e.includes('useRef'));
  const hasReactImport = evidence.some(e => e.includes('React import') || e.includes('ReactDOM'));
  const hasFragment = evidence.some(e => e.includes('Fragment'));
  const hasPascalCase = evidence.some(e => e.includes('PascalCase'));
  const hasCssInJs = evidence.some(e => e.includes('Styled Components') || e.includes('Emotion'));
  const hasRedux = evidence.some(e => e.includes('Redux'));
  const hasNextJs = evidence.some(e => e.includes('Next.js'));
  const hasLegacyReact = evidence.some(e => e.includes('deprecated') || e.includes('class component'));
  const hasCssModules = evidence.some(e => e.includes('CSS Modules'));

  let severity: DetectionSeverity = 'warn';
  let message = 'React/JSX patterns detected';
  let suggestion = 'Consider converting React components to plain HTML before importing';

  // Any definitive React pattern should block
  if (hasClassName || hasJsxHandler || hasHook || hasReactImport || hasFragment || strongMatches >= 2) {
    severity = 'block';
    message = 'React/JSX code detected - cannot convert directly to Webflow';
    suggestion = 'Use a React build tool to render static HTML first, or manually convert JSX to HTML';
  }

  // CSS-in-JS requires special handling - styles won't transfer
  if (hasCssInJs) {
    severity = 'block';
    message = 'CSS-in-JS detected (Styled Components/Emotion) - styles will not transfer to Webflow';
    suggestion = 'Extract CSS to external stylesheets before converting, or use DevLink Transform method';
  }

  // Redux/global state won't work with Webflow's isolated React roots
  if (hasRedux) {
    severity = 'block';
    message = 'Redux/global state detected - Webflow uses isolated React roots that cannot share state';
    suggestion = 'Use localStorage, URL params, or custom events for cross-component communication';
  }

  // Next.js requires full build pipeline
  if (hasNextJs) {
    severity = 'block';
    message = 'Next.js patterns detected - requires build pipeline transformation';
    suggestion = 'Build Next.js to static HTML first (next build && next export) or use DevLink';
  }

  // Legacy React patterns need modernization
  if (hasLegacyReact && !hasClassName && strongMatches < 2) {
    severity = 'warn';
    message = 'Legacy React patterns detected (deprecated lifecycle methods or class components)';
    suggestion = 'Modernize to functional components with hooks before converting';
  }

  // CSS Modules need extraction
  if (hasCssModules) {
    severity = 'block';
    message = 'CSS Modules detected - class names are locally scoped and won\'t transfer';
    suggestion = 'Convert CSS Modules to global classes with BEM naming before importing';
  }

  return {
    framework: hasClassName ? 'jsx' : 'react',
    confidence,
    evidence,
    severity,
    message,
    suggestion,
  };
}

/**
 * Detect Tailwind CSS patterns
 */
function detectTailwind(html: string): FrameworkDetection | null {
  const evidence: string[] = [];
  let matches = 0;

  for (const { pattern, description } of TAILWIND_PATTERNS) {
    if (pattern.test(html)) {
      evidence.push(description);
      matches++;
    }
  }

  // Need at least 3 Tailwind patterns to confirm
  // Lower threshold because even small components can have multiple utilities
  if (matches < 3) {
    return null;
  }

  const confidence = Math.min(1, matches * 0.1);

  return {
    framework: 'tailwind',
    confidence,
    evidence: evidence.slice(0, 10), // Limit evidence to first 10
    severity: 'warn',
    message: `Tailwind CSS detected (${matches} utility classes found)`,
    suggestion: 'Tailwind classes will be preserved but need CSS embed to work. Consider using semantic class names for better Webflow compatibility.',
  };
}

/**
 * Detect Vue patterns
 */
function detectVue(html: string): FrameworkDetection | null {
  const evidence: string[] = [];

  for (const { pattern, description } of VUE_PATTERNS) {
    if (pattern.test(html)) {
      evidence.push(description);
    }
  }

  if (evidence.length === 0) {
    return null;
  }

  const confidence = Math.min(1, evidence.length * 0.25);

  return {
    framework: 'vue',
    confidence,
    evidence,
    severity: 'block',
    message: 'Vue.js template detected - cannot convert to Webflow',
    suggestion: 'Render Vue component to static HTML first, or manually convert template syntax',
  };
}

/**
 * Detect Angular patterns
 */
function detectAngular(html: string): FrameworkDetection | null {
  const evidence: string[] = [];

  for (const { pattern, description } of ANGULAR_PATTERNS) {
    if (pattern.test(html)) {
      evidence.push(description);
    }
  }

  if (evidence.length === 0) {
    return null;
  }

  const confidence = Math.min(1, evidence.length * 0.25);

  return {
    framework: 'angular',
    confidence,
    evidence,
    severity: 'block',
    message: 'Angular template detected - cannot convert to Webflow',
    suggestion: 'Render Angular component to static HTML first, or manually convert template syntax',
  };
}

/**
 * Detect Svelte patterns
 */
function detectSvelte(html: string): FrameworkDetection | null {
  const evidence: string[] = [];

  for (const { pattern, description } of SVELTE_PATTERNS) {
    if (pattern.test(html)) {
      evidence.push(description);
    }
  }

  if (evidence.length === 0) {
    return null;
  }

  const confidence = Math.min(1, evidence.length * 0.25);

  return {
    framework: 'svelte',
    confidence,
    evidence,
    severity: 'block',
    message: 'Svelte template detected - cannot convert to Webflow',
    suggestion: 'Build Svelte component to static HTML first',
  };
}

/**
 * Detect Alpine.js patterns
 */
function detectAlpine(html: string): FrameworkDetection | null {
  const evidence: string[] = [];

  for (const { pattern, description } of ALPINE_PATTERNS) {
    if (pattern.test(html)) {
      evidence.push(description);
    }
  }

  if (evidence.length === 0) {
    return null;
  }

  const confidence = Math.min(1, evidence.length * 0.2);

  return {
    framework: 'alpine',
    confidence,
    evidence,
    severity: 'warn',
    message: 'Alpine.js directives detected',
    suggestion: 'Alpine.js directives will be stripped. Convert interactive behavior to Webflow interactions or custom JS embed.',
  };
}

// ============================================
// VOID ELEMENT DETECTION
// ============================================

/**
 * Check for void elements with invalid content.
 * This detects malformed HTML that will cause React error #137.
 */
function detectVoidElementIssues(html: string): VoidElementIssue[] {
  const issues: VoidElementIssue[] = [];

  for (const voidTag of VOID_ELEMENTS) {
    // Pattern: <voidTag ...> content </voidTag>
    // This is ALWAYS wrong - void elements cannot have closing tags with content
    const closingTagPattern = new RegExp(
      `<${voidTag}\\b[^>]*>([\\s\\S]*?)</${voidTag}>`,
      'gi'
    );

    let match;
    while ((match = closingTagPattern.exec(html)) !== null) {
      const content = match[1].trim();
      if (content) {
        issues.push({
          tag: voidTag,
          issue: 'has_children',
          description: `<${voidTag}> is a void element and cannot have children or content`,
          snippet: match[0].slice(0, 100) + (match[0].length > 100 ? '...' : ''),
        });
      }
    }

    // Pattern: <voidTag>text (without closing, but with text after)
    // This indicates possible malformed JSX or invalid HTML
    const malformedPattern = new RegExp(
      `<${voidTag}\\b[^/>]*>([^<]+)`,
      'gi'
    );

    while ((match = malformedPattern.exec(html)) !== null) {
      const textAfter = match[1].trim();
      // Only flag if there's significant text (not just whitespace)
      if (textAfter && textAfter.length > 0 && !/^[\s\n\r]*$/.test(textAfter)) {
        // Check if this is actually followed by text content (not another tag)
        // to avoid false positives like <br>\n<div>
        if (!textAfter.startsWith('<')) {
          issues.push({
            tag: voidTag,
            issue: 'has_text',
            description: `Text found after <${voidTag}> element - may indicate malformed HTML`,
            snippet: match[0].slice(0, 100) + (match[0].length > 100 ? '...' : ''),
          });
        }
      }
    }
  }

  return issues;
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Run comprehensive framework detection on HTML content.
 * This should be called EARLY in the conversion pipeline.
 *
 * @param html - The HTML content to analyze
 * @returns Detection result with warnings and blocking issues
 */
export function detectFrameworks(html: string): FrameworkDetectionResult {
  const frameworks: FrameworkDetection[] = [];
  const issues: FrameworkDetectionResult['issues'] = [];

  // Run all framework detectors
  const reactDetection = detectReact(html);
  if (reactDetection) frameworks.push(reactDetection);

  const tailwindDetection = detectTailwind(html);
  if (tailwindDetection) frameworks.push(tailwindDetection);

  const vueDetection = detectVue(html);
  if (vueDetection) frameworks.push(vueDetection);

  const angularDetection = detectAngular(html);
  if (angularDetection) frameworks.push(angularDetection);

  const svelteDetection = detectSvelte(html);
  if (svelteDetection) frameworks.push(svelteDetection);

  const alpineDetection = detectAlpine(html);
  if (alpineDetection) frameworks.push(alpineDetection);

  // Check for void element issues
  const voidElementIssues = detectVoidElementIssues(html);

  // Build issues list
  for (const fw of frameworks) {
    issues.push({
      severity: fw.severity,
      message: fw.message,
      suggestion: fw.suggestion,
    });
  }

  for (const voidIssue of voidElementIssues) {
    issues.push({
      severity: 'block',
      message: `Invalid ${voidIssue.tag} element: ${voidIssue.description}`,
      suggestion: `Remove content from <${voidIssue.tag}> element - void elements cannot have children`,
    });
  }

  // Determine overall status
  const hasBlockingFramework = frameworks.some(f => f.severity === 'block');
  const hasVoidIssues = voidElementIssues.length > 0;
  const canConvert = !hasBlockingFramework && !hasVoidIssues;
  const hasWarnings = frameworks.some(f => f.severity === 'warn');

  // Generate summary
  let summary = '';
  if (!canConvert) {
    const blockers: string[] = [];
    if (hasBlockingFramework) {
      const blockingFrameworks = frameworks.filter(f => f.severity === 'block');
      blockers.push(blockingFrameworks.map(f => f.framework).join(', '));
    }
    if (hasVoidIssues) {
      blockers.push(`${voidElementIssues.length} void element issue(s)`);
    }
    summary = `BLOCKED: ${blockers.join(' and ')} detected. Convert to plain HTML first.`;
  } else if (hasWarnings) {
    const warnings = frameworks.filter(f => f.severity === 'warn');
    summary = `WARNING: ${warnings.map(f => f.framework).join(', ')} detected. Conversion may require adjustments.`;
  } else {
    summary = 'No framework issues detected - safe to convert.';
  }

  return {
    canConvert,
    hasWarnings,
    frameworks,
    voidElementIssues,
    summary,
    issues,
  };
}

/**
 * Quick check if HTML is likely from a framework that can't be converted.
 * Faster than full detection - use for early bailout.
 */
export function isLikelyFrameworkCode(html: string): boolean {
  // Quick checks for definitive framework markers
  if (/\sclassName\s*=/.test(html)) return true;  // React
  if (/\bv-if\s*=/.test(html)) return true;        // Vue
  if (/\*ngIf\s*=/.test(html)) return true;        // Angular
  if (/\{#if\s+/.test(html)) return true;          // Svelte
  if (/\bonClick\s*=\s*\{/.test(html)) return true; // React JSX

  return false;
}

/**
 * Check if content has void element issues that would cause React error #137.
 */
export function hasVoidElementProblems(html: string): boolean {
  for (const voidTag of VOID_ELEMENTS) {
    // Quick check for closing void tags with content
    const pattern = new RegExp(`<${voidTag}\\b[^>]*>[\\s\\S]+?</${voidTag}>`, 'i');
    if (pattern.test(html)) {
      return true;
    }
  }
  return false;
}

/**
 * Clean void elements by removing any invalid content.
 * This is a sanitization step to prevent React error #137.
 */
export function sanitizeVoidElements(html: string): { html: string; fixed: string[] } {
  let result = html;
  const fixed: string[] = [];

  for (const voidTag of VOID_ELEMENTS) {
    // Replace <void>content</void> with just <void>
    const closingPattern = new RegExp(
      `<(${voidTag})\\b([^>]*)>([\\s\\S]*?)</${voidTag}>`,
      'gi'
    );

    result = result.replace(closingPattern, (match, tag, attrs) => {
      fixed.push(`Removed invalid content from <${tag}> element`);
      // Preserve attributes, make self-closing
      return attrs.trim() ? `<${tag} ${attrs.trim()} />` : `<${tag} />`;
    });
  }

  return { html: result, fixed };
}

// ============================================
// EXPORTS
// ============================================

export {
  REACT_STRONG_PATTERNS,
  REACT_WEAK_PATTERNS,
  TAILWIND_PATTERNS,
  VUE_PATTERNS,
  ANGULAR_PATTERNS,
  SVELTE_PATTERNS,
  ALPINE_PATTERNS,
};
