/**
 * JavaScript Library Detection and CDN Injection
 *
 * Detects popular frontend animation/interaction libraries in JS code
 * and provides CDN URLs for injection into HtmlEmbed nodes.
 */

import {
  ValidationSeverity,
  ValidationIssue,
  warning,
  info,
  WarningIssueCodes,
  InfoIssueCodes,
} from './validation-types';

// ============================================
// TYPES
// ============================================

export interface LibraryMatch {
  name: string;
  displayName: string;
  patterns: RegExp[];
  cdnUrl: string;
  cssUrl?: string;  // Some libraries need CSS too
  order: number;    // Load order (lower = first)
  dependsOn?: string[];  // Other library names this depends on
}

export interface DetectedLibraries {
  scripts: string[];   // CDN URLs for <script> tags
  styles: string[];    // CDN URLs for <link> tags
  names: string[];     // Library names for logging/display
  displayNames: string[];  // Human-readable library names
  /** Info-level issues for detected libraries */
  issues: ValidationIssue[];
}

export interface PaidPluginWarning {
  name: string;
  displayName: string;
  note: string;
  /** Standardized validation issue */
  validationIssue: ValidationIssue;
}

// ============================================
// LIBRARY REGISTRY
// ============================================

const LIBRARY_REGISTRY: LibraryMatch[] = [
  // GSAP Core (must load first)
  {
    name: 'gsap-core',
    displayName: 'GSAP',
    patterns: [/\bgsap\./, /\bGSAP\b/, /\bTweenMax\b/, /\bTweenLite\b/, /\bTimelineMax\b/, /\bTimelineLite\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js',
    order: 1
  },
  // GSAP Plugins (depend on core)
  {
    name: 'gsap-scrolltrigger',
    displayName: 'GSAP ScrollTrigger',
    patterns: [/\bScrollTrigger\b/, /gsap\.registerPlugin\s*\(\s*ScrollTrigger\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js',
    order: 2,
    dependsOn: ['gsap-core']
  },
  {
    name: 'gsap-flip',
    displayName: 'GSAP Flip',
    patterns: [/\bFlip\b/, /gsap\.registerPlugin\s*\(\s*Flip\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Flip.min.js',
    order: 2,
    dependsOn: ['gsap-core']
  },
  {
    name: 'gsap-draggable',
    displayName: 'GSAP Draggable',
    patterns: [/\bDraggable\b/, /gsap\.registerPlugin\s*\(\s*Draggable\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Draggable.min.js',
    order: 2,
    dependsOn: ['gsap-core']
  },
  {
    name: 'gsap-motionpath',
    displayName: 'GSAP MotionPath',
    patterns: [/\bMotionPathPlugin\b/, /gsap\.registerPlugin\s*\(\s*MotionPathPlugin\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/MotionPathPlugin.min.js',
    order: 2,
    dependsOn: ['gsap-core']
  },
  {
    name: 'gsap-scrollto',
    displayName: 'GSAP ScrollTo',
    patterns: [/\bScrollToPlugin\b/, /gsap\.registerPlugin\s*\(\s*ScrollToPlugin\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollToPlugin.min.js',
    order: 2,
    dependsOn: ['gsap-core']
  },
  {
    name: 'gsap-textplugin',
    displayName: 'GSAP TextPlugin',
    patterns: [/\bTextPlugin\b/, /gsap\.registerPlugin\s*\(\s*TextPlugin\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/TextPlugin.min.js',
    order: 2,
    dependsOn: ['gsap-core']
  },
  {
    name: 'gsap-observer',
    displayName: 'GSAP Observer',
    patterns: [/\bObserver\b(?!\.prototype)/, /gsap\.registerPlugin\s*\(\s*Observer\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/Observer.min.js',
    order: 2,
    dependsOn: ['gsap-core']
  },
  // Smooth Scroll Libraries
  {
    name: 'lenis',
    displayName: 'Lenis Smooth Scroll',
    patterns: [/\bLenis\b/, /\bnew\s+Lenis\s*\(/],
    cdnUrl: 'https://unpkg.com/lenis@1.1.13/dist/lenis.min.js',
    order: 3
  },
  {
    name: 'locomotive',
    displayName: 'Locomotive Scroll',
    patterns: [/\bLocomotiveScroll\b/, /\bnew\s+LocomotiveScroll\s*\(/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.js',
    cssUrl: 'https://cdn.jsdelivr.net/npm/locomotive-scroll@4.1.4/dist/locomotive-scroll.min.css',
    order: 3
  },
  // Page Transitions
  {
    name: 'barba',
    displayName: 'Barba.js',
    patterns: [/\bbarba\./, /\bBarba\b/],
    cdnUrl: 'https://unpkg.com/@barba/core@2.9.7/dist/barba.umd.js',
    order: 3
  },
  // Sliders/Carousels
  {
    name: 'swiper',
    displayName: 'Swiper',
    patterns: [/\bSwiper\b/, /\bnew\s+Swiper\s*\(/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js',
    cssUrl: 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
    order: 3
  },
  {
    name: 'splide',
    displayName: 'Splide',
    patterns: [/\bSplide\b/, /\bnew\s+Splide\s*\(/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js',
    cssUrl: 'https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/css/splide.min.css',
    order: 3
  },
  // Text Animation
  {
    name: 'split-type',
    displayName: 'SplitType',
    patterns: [/\bSplitType\b/, /\bnew\s+SplitType\s*\(/],
    cdnUrl: 'https://unpkg.com/split-type@0.3.4/umd/index.min.js',
    order: 3
  },
  // Physics
  {
    name: 'matter',
    displayName: 'Matter.js',
    patterns: [/\bMatter\./, /\bMatter\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js',
    order: 3
  },
  // 3D
  {
    name: 'three',
    displayName: 'Three.js',
    patterns: [/\bTHREE\./, /\bTHREE\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    order: 3
  },
  // Animation Libraries
  {
    name: 'anime',
    displayName: 'Anime.js',
    patterns: [/\banime\s*\(/, /\banime\./, /\banime\s*=/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js',
    order: 3
  },
  {
    name: 'motion-one',
    displayName: 'Motion One',
    patterns: [/\bMotion\./, /\banimate\s*\([^)]*,\s*\{[^}]*duration:/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/motion@10.18.0/dist/motion.min.js',
    order: 3
  },
  // Scroll Animation
  {
    name: 'aos',
    displayName: 'AOS (Animate on Scroll)',
    patterns: [/\bAOS\.init\s*\(/, /\bAOS\b/, /data-aos=/],
    cdnUrl: 'https://unpkg.com/aos@2.3.4/dist/aos.js',
    cssUrl: 'https://unpkg.com/aos@2.3.4/dist/aos.css',
    order: 3
  },
  {
    name: 'scrollreveal',
    displayName: 'ScrollReveal',
    patterns: [/\bScrollReveal\b/, /\bScrollReveal\s*\(\s*\)/],
    cdnUrl: 'https://unpkg.com/scrollreveal@4.0.9/dist/scrollreveal.min.js',
    order: 3
  },
  // Utility Libraries
  {
    name: 'lodash',
    displayName: 'Lodash',
    patterns: [/\b_\./, /\blodash\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.21/lodash.min.js',
    order: 1
  },
  {
    name: 'jquery',
    displayName: 'jQuery',
    patterns: [/\$\s*\(/, /\bjQuery\s*\(/, /\$\.ajax/, /\bjQuery\b/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js',
    order: 1
  },
  // Video Players
  {
    name: 'plyr',
    displayName: 'Plyr',
    patterns: [/\bPlyr\b/, /\bnew\s+Plyr\s*\(/],
    cdnUrl: 'https://cdn.plyr.io/3.7.8/plyr.js',
    cssUrl: 'https://cdn.plyr.io/3.7.8/plyr.css',
    order: 3
  },
  // Charts
  {
    name: 'chartjs',
    displayName: 'Chart.js',
    patterns: [/\bChart\b/, /\bnew\s+Chart\s*\(/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    order: 3
  },
  // Lightbox/Gallery
  {
    name: 'lightgallery',
    displayName: 'lightGallery',
    patterns: [/\blightGallery\b/, /\$\([^)]+\)\.lightGallery/],
    cdnUrl: 'https://cdn.jsdelivr.net/npm/lightgallery@2.7.2/lightgallery.min.js',
    cssUrl: 'https://cdn.jsdelivr.net/npm/lightgallery@2.7.2/css/lightgallery.css',
    order: 3
  },
  // Form Validation
  {
    name: 'parsley',
    displayName: 'Parsley.js',
    patterns: [/\bParsley\b/, /\.parsley\s*\(/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/parsley.js/2.9.2/parsley.min.js',
    order: 4,
    dependsOn: ['jquery']
  },
  // Masonry/Grid Layout
  {
    name: 'masonry',
    displayName: 'Masonry',
    patterns: [/\bMasonry\b/, /\bnew\s+Masonry\s*\(/],
    cdnUrl: 'https://unpkg.com/masonry-layout@4.2.2/dist/masonry.pkgd.min.js',
    order: 3
  },
  {
    name: 'isotope',
    displayName: 'Isotope',
    patterns: [/\bIsotope\b/, /\bnew\s+Isotope\s*\(/, /\.isotope\s*\(/],
    cdnUrl: 'https://unpkg.com/isotope-layout@3.0.6/dist/isotope.pkgd.min.js',
    order: 3
  },
  // Typing Effects
  {
    name: 'typed',
    displayName: 'Typed.js',
    patterns: [/\bTyped\b/, /\bnew\s+Typed\s*\(/],
    cdnUrl: 'https://unpkg.com/typed.js@2.1.0/dist/typed.umd.js',
    order: 3
  },
  // Parallax
  {
    name: 'rellax',
    displayName: 'Rellax',
    patterns: [/\bRellax\b/, /\bnew\s+Rellax\s*\(/],
    cdnUrl: 'https://cdnjs.cloudflare.com/ajax/libs/rellax/1.12.1/rellax.min.js',
    order: 3
  },
  // Intersection Observer Polyfill
  {
    name: 'intersection-observer',
    displayName: 'IntersectionObserver Polyfill',
    patterns: [/\bIntersectionObserver\b/],
    cdnUrl: 'https://polyfill.io/v3/polyfill.min.js?features=IntersectionObserver',
    order: 0
  },
];

// ============================================
// CLUB GREENSOCK (PAID) PLUGINS
// ============================================

interface PaidPluginPattern {
  name: string;
  displayName: string;
  pattern: RegExp;
  note: string;
}

const CLUB_GREENSOCK_PATTERNS: PaidPluginPattern[] = [
  {
    name: 'ScrollSmoother',
    displayName: 'GSAP ScrollSmoother',
    pattern: /\bScrollSmoother\b/,
    note: 'Club GreenSock membership required. Free alternative: Lenis'
  },
  {
    name: 'SplitText',
    displayName: 'GSAP SplitText',
    pattern: /\bSplitText\b/,
    note: 'Club GreenSock membership required. Free alternative: SplitType'
  },
  {
    name: 'MorphSVG',
    displayName: 'GSAP MorphSVG',
    pattern: /\bMorphSVGPlugin\b/,
    note: 'Club GreenSock membership required'
  },
  {
    name: 'DrawSVG',
    displayName: 'GSAP DrawSVG',
    pattern: /\bDrawSVGPlugin\b/,
    note: 'Club GreenSock membership required'
  },
  {
    name: 'Physics2D',
    displayName: 'GSAP Physics2D',
    pattern: /\bPhysics2DPlugin\b/,
    note: 'Club GreenSock membership required'
  },
  {
    name: 'PhysicsProps',
    displayName: 'GSAP PhysicsProps',
    pattern: /\bPhysicsPropsPlugin\b/,
    note: 'Club GreenSock membership required'
  },
  {
    name: 'ScrambleText',
    displayName: 'GSAP ScrambleText',
    pattern: /\bScrambleTextPlugin\b/,
    note: 'Club GreenSock membership required'
  },
  {
    name: 'InertiaPlugin',
    displayName: 'GSAP Inertia',
    pattern: /\bInertiaPlugin\b/,
    note: 'Club GreenSock membership required'
  },
  {
    name: 'MotionPathHelper',
    displayName: 'GSAP MotionPathHelper',
    pattern: /\bMotionPathHelper\b/,
    note: 'Club GreenSock membership required'
  },
  {
    name: 'GSDevTools',
    displayName: 'GSAP DevTools',
    pattern: /\bGSDevTools\b/,
    note: 'Club GreenSock membership required (dev tool)'
  },
];

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Detect libraries used in JavaScript code
 */
export function detectLibraries(jsCode: string): DetectedLibraries {
  if (!jsCode || typeof jsCode !== 'string') {
    return { scripts: [], styles: [], names: [], displayNames: [], issues: [] };
  }

  const detected = new Map<string, LibraryMatch>();

  for (const lib of LIBRARY_REGISTRY) {
    for (const pattern of lib.patterns) {
      if (pattern.test(jsCode)) {
        detected.set(lib.name, lib);
        break;
      }
    }
  }

  // Add dependencies (e.g., if ScrollTrigger detected, ensure gsap-core is included)
  const withDeps = new Map<string, LibraryMatch>();
  for (const [name, lib] of detected) {
    // Add dependencies first
    if (lib.dependsOn) {
      for (const depName of lib.dependsOn) {
        const dep = LIBRARY_REGISTRY.find(l => l.name === depName);
        if (dep && !withDeps.has(depName)) {
          withDeps.set(depName, dep);
        }
      }
    }
    withDeps.set(name, lib);
  }

  // Sort by load order
  const sorted = Array.from(withDeps.values()).sort((a, b) => a.order - b.order);

  // Generate info issues for detected libraries
  const issues: ValidationIssue[] = sorted.map(lib => info(
    InfoIssueCodes.LIBRARY_DETECTED,
    `${lib.displayName} detected and will be injected via CDN`,
    {
      context: lib.name,
      suggestion: `CDN: ${lib.cdnUrl}`,
    }
  ));

  return {
    scripts: sorted.map(lib => lib.cdnUrl),
    styles: sorted.filter(lib => lib.cssUrl).map(lib => lib.cssUrl!),
    names: sorted.map(lib => lib.name),
    displayNames: sorted.map(lib => lib.displayName),
    issues,
  };
}

/**
 * Detect paid Club GreenSock plugins
 */
export function detectPaidPlugins(jsCode: string): PaidPluginWarning[] {
  if (!jsCode || typeof jsCode !== 'string') {
    return [];
  }

  return CLUB_GREENSOCK_PATTERNS
    .filter(p => p.pattern.test(jsCode))
    .map(p => ({
      name: p.name,
      displayName: p.displayName,
      note: p.note,
      validationIssue: warning(
        WarningIssueCodes.PAID_PLUGIN_REQUIRED,
        `${p.displayName}: ${p.note}`,
        {
          context: p.name,
          suggestion: p.note,
        }
      ),
    }));
}

// ============================================
// SCRIPT WRAPPING & EMBED GENERATION
// ============================================

/**
 * Wrap JavaScript code in DOMContentLoaded if not already wrapped
 */
export function wrapWithDOMContentLoaded(jsCode: string): string {
  if (!jsCode || typeof jsCode !== 'string') {
    return '';
  }

  const trimmed = jsCode.trim();
  if (!trimmed) {
    return '';
  }

  // Don't double-wrap if already has DOMContentLoaded or window.onload
  if (/DOMContentLoaded|document\.readyState|window\.onload|window\.addEventListener\s*\(\s*['"]load['"]/i.test(trimmed)) {
    return trimmed;
  }

  return `document.addEventListener('DOMContentLoaded', function() {
${trimmed}
});`;
}

/**
 * Generate a complete HTML embed with CDN scripts and user JS
 */
export function generateScriptEmbed(
  userJs: string,
  libraries: DetectedLibraries,
  options: {
    wrapInDOMContentLoaded?: boolean;
    minify?: boolean;
  } = {}
): string {
  const { wrapInDOMContentLoaded = true, minify = false } = options;
  const parts: string[] = [];

  // Add CSS links for libraries that need them
  for (const cssUrl of libraries.styles) {
    parts.push(`<link rel="stylesheet" href="${cssUrl}">`);
  }

  // Add library scripts
  for (const scriptUrl of libraries.scripts) {
    parts.push(`<script src="${scriptUrl}"><\/script>`);
  }

  // Add user script wrapped in DOMContentLoaded (if requested)
  if (userJs && userJs.trim()) {
    const processedJs = wrapInDOMContentLoaded ? wrapWithDOMContentLoaded(userJs) : userJs.trim();
    parts.push(`<script>\n${processedJs}\n<\/script>`);
  }

  const separator = minify ? '' : '\n';
  return parts.join(separator);
}

/**
 * Generate a Webflow-compatible script embed
 * Returns an object suitable for HtmlEmbed node creation
 */
export function generateWebflowScriptEmbed(
  userJs: string,
  options: {
    detectLibs?: boolean;
    wrapInDOMContentLoaded?: boolean;
  } = {}
): {
  embedHtml: string;
  detectedLibraries: DetectedLibraries;
  paidPluginWarnings: PaidPluginWarning[];
} {
  const { detectLibs = true, wrapInDOMContentLoaded = true } = options;

  // Detect libraries and paid plugins
  const detectedLibraries = detectLibs ? detectLibraries(userJs) : { scripts: [], styles: [], names: [], displayNames: [], issues: [] };
  const paidPluginWarnings = detectPaidPlugins(userJs);

  // Generate the embed HTML
  const embedHtml = generateScriptEmbed(userJs, detectedLibraries, { wrapInDOMContentLoaded });

  return {
    embedHtml,
    detectedLibraries,
    paidPluginWarnings,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get the library registry for UI display
 */
export function getLibraryRegistry(): ReadonlyArray<LibraryMatch> {
  return LIBRARY_REGISTRY;
}

/**
 * Get library info by name
 */
export function getLibraryInfo(name: string): LibraryMatch | undefined {
  return LIBRARY_REGISTRY.find(lib => lib.name === name);
}

/**
 * Check if a specific library is detected in code
 */
export function isLibraryUsed(jsCode: string, libraryName: string): boolean {
  const lib = LIBRARY_REGISTRY.find(l => l.name === libraryName);
  if (!lib) return false;
  return lib.patterns.some(pattern => pattern.test(jsCode));
}

/**
 * Get CDN URL for a library by name
 */
export function getCdnUrl(libraryName: string): string | undefined {
  const lib = LIBRARY_REGISTRY.find(l => l.name === libraryName);
  return lib?.cdnUrl;
}

/**
 * Format detected libraries for display
 */
export function formatDetectedLibraries(libraries: DetectedLibraries): string {
  if (libraries.names.length === 0) {
    return 'No external libraries detected';
  }
  return `Detected ${libraries.names.length} libraries: ${libraries.displayNames.join(', ')}`;
}

/**
 * Format paid plugin warnings for display
 */
export function formatPaidPluginWarnings(warnings: PaidPluginWarning[]): string[] {
  return warnings.map(w => `⚠️ ${w.displayName}: ${w.note}`);
}

// ============================================
// CANVAS/WEBGL DETECTION
// ============================================

export type CanvasLibrary = 'threejs' | 'matterjs' | 'curtains' | 'p5js' | 'pixijs' | 'generic-canvas' | 'generic-webgl';

export interface CanvasDetectionResult {
  /** Whether any canvas/WebGL usage was detected */
  detected: boolean;
  /** Which libraries were detected */
  libraries: CanvasLibrary[];
  /** Suggested container ID for the detected library */
  suggestedContainerId: string;
}

export interface ValidationWarning {
  /** @deprecated Use validationIssue.severity instead */
  type: 'warning' | 'error';
  message: string;
  suggestion?: string;
  /** Standardized validation issue */
  validationIssue: ValidationIssue;
}

interface CanvasLibraryPattern {
  name: CanvasLibrary;
  displayName: string;
  patterns: RegExp[];
  suggestedContainerId: string;
}

const CANVAS_LIBRARY_PATTERNS: CanvasLibraryPattern[] = [
  {
    name: 'threejs',
    displayName: 'Three.js',
    patterns: [/\bTHREE\./, /\bTHREE\b/, /WebGLRenderer/],
    suggestedContainerId: 'three-container',
  },
  {
    name: 'matterjs',
    displayName: 'Matter.js',
    patterns: [/\bMatter\.Engine/, /\bMatter\.Render/, /\bMatter\./],
    suggestedContainerId: 'matter-container',
  },
  {
    name: 'curtains',
    displayName: 'Curtains.js',
    patterns: [/\bnew\s+Curtains\s*\(/, /\bCurtains\b/],
    suggestedContainerId: 'curtains-container',
  },
  {
    name: 'p5js',
    displayName: 'p5.js',
    patterns: [/\bfunction\s+setup\s*\(\s*\)/, /\bfunction\s+draw\s*\(\s*\)/, /\bcreateCanvas\s*\(/],
    suggestedContainerId: 'p5-container',
  },
  {
    name: 'pixijs',
    displayName: 'PixiJS',
    patterns: [/\bPIXI\./, /\bPIXI\b/, /\bnew\s+PIXI\.Application/],
    suggestedContainerId: 'pixi-container',
  },
  {
    name: 'generic-webgl',
    displayName: 'WebGL',
    patterns: [/\.getContext\s*\(\s*['"]webgl['"]/, /\.getContext\s*\(\s*['"]webgl2['"]/],
    suggestedContainerId: 'webgl-container',
  },
  {
    name: 'generic-canvas',
    displayName: 'Canvas',
    patterns: [/document\.createElement\s*\(\s*['"]canvas['"]/, /\.getContext\s*\(\s*['"]2d['"]/],
    suggestedContainerId: 'canvas-container',
  },
];

/**
 * Detect canvas/WebGL library usage in JavaScript code
 */
export function detectCanvasWebGL(jsCode: string): CanvasDetectionResult {
  if (!jsCode || typeof jsCode !== 'string') {
    return {
      detected: false,
      libraries: [],
      suggestedContainerId: 'canvas-container',
    };
  }

  const detectedLibraries: CanvasLibrary[] = [];
  let suggestedContainerId = 'canvas-container';

  for (const lib of CANVAS_LIBRARY_PATTERNS) {
    for (const pattern of lib.patterns) {
      if (pattern.test(jsCode)) {
        detectedLibraries.push(lib.name);
        // Use the first detected library's suggested container
        if (detectedLibraries.length === 1) {
          suggestedContainerId = lib.suggestedContainerId;
        }
        break;
      }
    }
  }

  return {
    detected: detectedLibraries.length > 0,
    libraries: detectedLibraries,
    suggestedContainerId,
  };
}

/**
 * Get display name for a canvas library
 */
function getCanvasLibraryDisplayName(library: CanvasLibrary): string {
  const lib = CANVAS_LIBRARY_PATTERNS.find(l => l.name === library);
  return lib?.displayName ?? library;
}

/**
 * Validate that HTML has appropriate container elements for detected canvas/WebGL code
 */
export function validateCanvasContainer(
  html: string,
  detection: CanvasDetectionResult
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // If no canvas code detected, no validation needed
  if (!detection.detected) {
    return warnings;
  }

  // Check if HTML has a canvas tag
  const hasCanvasTag = /<canvas\b/i.test(html);
  if (hasCanvasTag) {
    return warnings; // Canvas tag exists, validation passes
  }

  // Check if HTML has the suggested container ID
  const containerIdPattern = new RegExp(`id\\s*=\\s*["']${detection.suggestedContainerId}["']`, 'i');
  if (containerIdPattern.test(html)) {
    return warnings; // Container ID exists, validation passes
  }

  // Generate warning for each detected library
  for (const library of detection.libraries) {
    const displayName = getCanvasLibraryDisplayName(library);
    const message = `${displayName} code detected but no canvas element or container found in HTML`;
    const suggestion = `Add a container element with id="${detection.suggestedContainerId}" or a <canvas> element`;
    warnings.push({
      type: 'warning',
      message,
      suggestion,
      validationIssue: warning(
        WarningIssueCodes.MISSING_CANVAS_CONTAINER,
        message,
        {
          context: displayName,
          suggestion,
        }
      ),
    });
  }

  return warnings;
}
