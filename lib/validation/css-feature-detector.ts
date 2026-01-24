/**
 * CSS Feature Detection for Webflow Embed Requirements
 *
 * Detects modern CSS features that Webflow Designer doesn't support natively
 * and must be placed in custom code embeds instead.
 */

export interface CSSFeature {
  pattern: RegExp;
  name: string;
  category: 'colors' | 'layout' | 'selectors' | 'effects' | 'organization' | 'functions';
  embedRequired: boolean;
}

/**
 * CSS features that REQUIRE custom code embeds in Webflow
 */
export const EMBED_REQUIRED_FEATURES: CSSFeature[] = [
  // Modern Color Functions
  { pattern: /oklch\s*\(/gi, name: 'oklch colors', category: 'colors', embedRequired: true },
  { pattern: /color-mix\s*\(/gi, name: 'color-mix()', category: 'colors', embedRequired: true },
  { pattern: /\blch\s*\(/gi, name: 'lch colors', category: 'colors', embedRequired: true },
  { pattern: /\blab\s*\(/gi, name: 'lab colors', category: 'colors', embedRequired: true },

  // Container Queries
  { pattern: /@container\b/gi, name: '@container queries', category: 'layout', embedRequired: true },
  { pattern: /container-type\s*:/gi, name: 'container-type', category: 'layout', embedRequired: true },
  { pattern: /container-name\s*:/gi, name: 'container-name', category: 'layout', embedRequired: true },

  // Modern Selectors
  { pattern: /:has\s*\(/gi, name: ':has() selector', category: 'selectors', embedRequired: true },
  { pattern: /:where\s*\(/gi, name: ':where() selector', category: 'selectors', embedRequired: true },
  { pattern: /:is\s*\(/gi, name: ':is() selector', category: 'selectors', embedRequired: true },

  // Visual Effects
  { pattern: /backdrop-filter\s*:/gi, name: 'backdrop-filter', category: 'effects', embedRequired: true },

  // CSS Organization
  { pattern: /@layer\b/gi, name: '@layer', category: 'organization', embedRequired: true },
  { pattern: /@scope\b/gi, name: '@scope', category: 'organization', embedRequired: true },

  // Advanced Math Functions (when used with viewport units)
  { pattern: /clamp\s*\([^)]*v[wh]/gi, name: 'clamp() with viewport units', category: 'functions', embedRequired: true },
];

/**
 * Features that are WARNING-level (work in Webflow but may have limitations)
 */
export const WARNING_FEATURES: CSSFeature[] = [
  { pattern: /@supports\b/gi, name: '@supports', category: 'organization', embedRequired: false },
  { pattern: /aspect-ratio\s*:/gi, name: 'aspect-ratio', category: 'layout', embedRequired: false },
];

export interface DetectedFeature {
  name: string;
  category: string;
  count: number;
  embedRequired: boolean;
  samples: string[]; // First few occurrences
}

export interface CSSDetectionResult {
  /** CSS that can be safely used in Webflow Designer */
  nativeCSS: string;
  /** CSS that must be placed in custom code embeds */
  embedCSS: string;
  /** Detected features requiring embeds */
  detectedFeatures: DetectedFeature[];
  /** Warning-level features detected */
  warnings: string[];
  /** Whether any embed-required features were found */
  needsEmbed: boolean;
}

/**
 * Extract CSS rules from a stylesheet
 */
function extractCSSRules(css: string): string[] {
  const rules: string[] = [];
  let currentRule = '';
  let braceDepth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    const prevChar = i > 0 ? css[i - 1] : '';

    // Track string boundaries
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    // Track brace depth (only outside strings)
    if (!inString) {
      if (char === '{') {
        braceDepth++;
      } else if (char === '}') {
        braceDepth--;
      }
    }

    currentRule += char;

    // When we close a top-level rule, save it
    if (braceDepth === 0 && char === '}') {
      const trimmed = currentRule.trim();
      if (trimmed) {
        rules.push(trimmed);
      }
      currentRule = '';
    }
  }

  return rules;
}

/**
 * Check if a CSS rule contains any embed-required features
 */
function ruleNeedsEmbed(rule: string): {
  needsEmbed: boolean;
  features: DetectedFeature[];
} {
  const detectedFeatures: DetectedFeature[] = [];

  for (const feature of EMBED_REQUIRED_FEATURES) {
    const matches = rule.match(feature.pattern);
    if (matches && matches.length > 0) {
      detectedFeatures.push({
        name: feature.name,
        category: feature.category,
        count: matches.length,
        embedRequired: feature.embedRequired,
        samples: matches.slice(0, 3), // First 3 samples
      });
    }
  }

  return {
    needsEmbed: detectedFeatures.length > 0,
    features: detectedFeatures,
  };
}

/**
 * Detect warning-level features
 */
function detectWarnings(css: string): string[] {
  const warnings: string[] = [];

  for (const feature of WARNING_FEATURES) {
    if (feature.pattern.test(css)) {
      warnings.push(`Uses ${feature.name} - may have limited support in older browsers`);
      // Reset regex state
      feature.pattern.lastIndex = 0;
    }
  }

  return warnings;
}

/**
 * Split CSS into native-compatible and embed-required sections
 */
export function detectEmbedRequiredCSS(css: string): CSSDetectionResult {
  const nativeRules: string[] = [];
  const embedRules: string[] = [];
  const allDetectedFeatures = new Map<string, DetectedFeature>();

  // Extract individual CSS rules
  const rules = extractCSSRules(css);

  // Also preserve any @import, @charset, or comments at the top
  const preservedTop: string[] = [];
  const importMatch = css.match(/^[\s\S]*?(?=\S*\{|$)/);
  if (importMatch && importMatch[0].trim()) {
    const topContent = importMatch[0].trim();
    if (
      topContent.startsWith('@import') ||
      topContent.startsWith('@charset') ||
      topContent.startsWith('/*')
    ) {
      preservedTop.push(topContent);
    }
  }

  // Classify each rule
  for (const rule of rules) {
    const { needsEmbed, features } = ruleNeedsEmbed(rule);

    if (needsEmbed) {
      embedRules.push(rule);

      // Aggregate detected features
      for (const feature of features) {
        const existing = allDetectedFeatures.get(feature.name);
        if (existing) {
          existing.count += feature.count;
          existing.samples.push(...feature.samples);
          // Keep only first 5 samples
          existing.samples = existing.samples.slice(0, 5);
        } else {
          allDetectedFeatures.set(feature.name, { ...feature });
        }
      }
    } else {
      nativeRules.push(rule);
    }
  }

  // Detect warnings
  const warnings = detectWarnings(css);

  // Build final CSS strings
  let nativeCSS = preservedTop.join('\n\n');
  if (nativeRules.length > 0) {
    if (nativeCSS) nativeCSS += '\n\n';
    nativeCSS += nativeRules.join('\n\n');
  }

  const embedCSS = embedRules.join('\n\n');

  return {
    nativeCSS: nativeCSS.trim(),
    embedCSS: embedCSS.trim(),
    detectedFeatures: Array.from(allDetectedFeatures.values()),
    warnings,
    needsEmbed: embedRules.length > 0,
  };
}

/**
 * Validate that CSS doesn't exceed Webflow embed limits
 */
export function validateEmbedSize(css: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const size = new Blob([css]).size;

  // Webflow custom code limits (approximate)
  const SOFT_LIMIT = 10 * 1024; // 10KB - warn
  const HARD_LIMIT = 50 * 1024; // 50KB - error (Webflow may reject)

  if (size > HARD_LIMIT) {
    errors.push(`CSS embed is ${(size / 1024).toFixed(1)}KB - exceeds Webflow limit (~50KB)`);
  } else if (size > SOFT_LIMIT) {
    warnings.push(`CSS embed is ${(size / 1024).toFixed(1)}KB - consider optimizing`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format detection results for user display
 */
export function formatDetectionResults(result: CSSDetectionResult): string {
  const lines: string[] = [];

  if (result.needsEmbed) {
    lines.push('🔧 Modern CSS Features Detected (require custom code embed):');
    lines.push('');

    const byCategory = new Map<string, DetectedFeature[]>();
    for (const feature of result.detectedFeatures) {
      const list = byCategory.get(feature.category) || [];
      list.push(feature);
      byCategory.set(feature.category, list);
    }

    for (const [category, features] of byCategory) {
      lines.push(`  ${category.toUpperCase()}:`);
      for (const feature of features) {
        lines.push(`    • ${feature.name} (${feature.count} occurrence${feature.count > 1 ? 's' : ''})`);
      }
      lines.push('');
    }

    const sizeValidation = validateEmbedSize(result.embedCSS);
    if (sizeValidation.errors.length > 0) {
      lines.push('❌ SIZE ERRORS:');
      sizeValidation.errors.forEach((err) => lines.push(`  • ${err}`));
    }
    if (sizeValidation.warnings.length > 0) {
      lines.push('⚠️  SIZE WARNINGS:');
      sizeValidation.warnings.forEach((warn) => lines.push(`  • ${warn}`));
    }
  } else {
    lines.push('✅ All CSS is compatible with Webflow Designer');
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('⚠️  WARNINGS:');
    result.warnings.forEach((warn) => lines.push(`  • ${warn}`));
  }

  return lines.join('\n');
}
