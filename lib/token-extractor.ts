/**
 * Token Extractor for CSS Design Tokens
 * Parses :root CSS variables and generates token manifest
 */

export interface TokenVariable {
  cssVar: string;
  path: string;
  type: "color" | "fontFamily" | "spacing";
  values?: { light: string; dark: string };
  value?: string;
}

export interface RadiusToken {
  name: string;
  value: string;
  size: 'small' | 'medium' | 'large' | 'xlarge';
}

export interface ShadowToken {
  name: string;
  value: string;
  intensity: 'xxsmall' | 'xsmall' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
}

export interface UIElement {
  name: string;
  classes: string[];
  styles?: string;
}

export interface TokenExtraction {
  name: string;
  slug: string;
  namespace: string;
  modes: string[];
  variables: TokenVariable[];
  fonts?: {
    googleFonts: string;
    families: string[];
  };
}

export interface EnhancedTokenExtraction extends TokenExtraction {
  radius?: RadiusToken[];
  shadows?: ShadowToken[];
  uiElements?: {
    buttons?: UIElement[];
    inputs?: UIElement[];
  };
}

export interface TokenManifest {
  schemaVersion: string;
  name: string;
  slug: string;
  namespace: string;
  modes: string[];
  variables: TokenVariable[];
  fonts?: {
    googleFonts: string;
    headSnippet: string;
    families?: string[];
  };
}

/**
 * Extract enhanced tokens from CSS content (includes radius, shadows, UI elements)
 */
export function extractEnhancedTokens(
  css: string,
  html?: string,
  designSystemName: string = "Design System"
): EnhancedTokenExtraction {
  const baseExtraction = extractTokens(css, html, designSystemName);
  
  return {
    ...baseExtraction,
    radius: extractRadiusTokens(css),
    shadows: extractShadowTokens(css),
    uiElements: extractUIElements(css),
  };
}

/**
 * Extract tokens from CSS content (basic version)
 */
export function extractTokens(
  css: string,
  html?: string,
  designSystemName: string = "Design System"
): TokenExtraction {
  // Find ALL :root or .fp-root blocks - there may be multiple (light/dark themes, multiple style tags)
  const rootContents: string[] = [];
  const selectors = [":root", ".fp-root"];

  for (const selector of selectors) {
    const blocks = extractSelectorBlocks(css, selector);
    blocks.forEach((content) => {
      rootContents.push(content);
      console.log(
        "[token-extractor] Found",
        selector,
        "block #",
        rootContents.length,
        "with",
        content.length,
        "chars"
      );
    });
  }

  // Extract fonts if HTML is provided
  let googleFonts = "";
  let families: string[] = [];

  if (html) {
    const url = extractGoogleFontsUrl(html);
    if (url) googleFonts = url;
  }

  // Extract families from CSS (variables + usage)
  families = extractFontFamilies(css);

  if (rootContents.length === 0) {
    console.warn("[token-extractor] No :root found in CSS");
    return {
      name: designSystemName,
      slug: slugify(designSystemName),
      namespace: deriveNamespace(designSystemName),
      modes: [],
      variables: [],
      fonts: {
        googleFonts,
        families,
      },
    };
  }

  // Combine all root contents
  const combinedRootContent = rootContents.join("\n");
  console.log("[token-extractor] Combined", rootContents.length, ":root blocks, total", combinedRootContent.length, "chars");

  const variables = parseRootVariables(combinedRootContent);
  console.log("[token-extractor] Extracted", variables.length, "variables");

  const modes = detectModes(variables);

  return {
    name: designSystemName,
    slug: slugify(designSystemName),
    namespace: deriveNamespace(designSystemName),
    modes,
    variables,
    fonts: {
      googleFonts,
      families,
    },
  };
}

function extractSelectorBlocks(css: string, selector: string): string[] {
  const blocks: string[] = [];
  const selectorRegex = new RegExp(`${escapeRegex(selector)}\\s*\\{`, "g");
  let match;

  while ((match = selectorRegex.exec(css)) !== null) {
    const braceStart = css.indexOf("{", match.index);
    if (braceStart === -1) break;

    let depth = 1;
    let i = braceStart + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }

    const content = css.substring(braceStart + 1, i - 1);
    blocks.push(content);
    selectorRegex.lastIndex = i;
  }

  return blocks;
}

/**
 * Parse CSS variables from :root content
 */
function parseRootVariables(rootContent: string): TokenVariable[] {
  const variables: TokenVariable[] = [];
  // More flexible regex - matches CSS custom properties
  const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let match;
  let totalFound = 0;
  let skippedRadius = 0;
  const skippedUncategorized: string[] = [];

  while ((match = varRegex.exec(rootContent)) !== null) {
    totalFound++;
    const [, name, value] = match;
    const cssVar = `--${name}`;
    const cleanValue = value.trim();

    // Skip radius variables (CSS-only, not Webflow Variables)
    if (name.startsWith('radius-')) {
      skippedRadius++;
      continue;
    }

    // Categorize variable
    const category = categorizeVariable(name, cleanValue);
    if (!category) {
      skippedUncategorized.push(cssVar);
      continue;
    }

    const variable: TokenVariable = {
      cssVar,
      path: category.path,
      type: category.type,
    };

    // Determine if this is a mode-based variable
    if (category.type === 'color') {
      // For now, set single value - mode pairing done in post-processing
      variable.value = cleanValue;
    } else {
      variable.value = cleanValue;
    }

    variables.push(variable);
  }

  console.log("[token-extractor] Regex found", totalFound, "total variables");
  console.log("[token-extractor] Skipped", skippedRadius, "radius variables");
  if (skippedUncategorized.length > 0) {
    console.log("[token-extractor] Skipped uncategorized:", skippedUncategorized.join(", "));
  }

  // Post-process: pair light/dark mode variables
  return pairModeVariables(variables);
}

/**
 * Categorize a CSS variable by name and value
 */
function categorizeVariable(name: string, value: string): { path: string; type: "color" | "fontFamily" | "spacing" } | null {
  const nameLower = name.toLowerCase();

  // Typography
  if (nameLower.startsWith('font-')) {
    const fontName = formatPathSegment(name.replace('font-', ''));
    return { path: `Typography / ${fontName}`, type: 'fontFamily' };
  }

  // Spacing - padding, margin, gap, section spacing
  const isSpacing = nameLower.includes('padding') ||
    nameLower.includes('margin') ||
    nameLower.includes('gap') ||
    nameLower.includes('spacing') ||
    nameLower.includes('section-') ||
    nameLower.includes('page-') ||
    nameLower.includes('container-') ||
    isSpacingValue(value);

  if (isSpacing) {
    const spacingName = formatPathSegment(name);
    return { path: `Spacing / ${spacingName}`, type: 'spacing' };
  }

  // Colors - detect by value format or name patterns
  const isColor = isColorValue(value) ||
    nameLower.includes('bg') ||
    nameLower.includes('text') ||
    nameLower.includes('border') ||
    nameLower.includes('coral') ||
    nameLower.includes('accent') ||
    nameLower.includes('dark') ||
    nameLower.includes('light') ||
    nameLower.includes('card') ||
    nameLower.includes('muted');

  if (isColor) {
    const path = deriveColorPath(name);
    return { path, type: 'color' };
  }

  return null;
}

/**
 * Check if value looks like a spacing value
 */
function isSpacingValue(value: string): boolean {
  const v = value.toLowerCase().trim();
  return (
    /^\d+(\.\d+)?(px|rem|em|vw|vh|%)$/.test(v) ||
    /^\d+(\.\d+)?(px|rem|em|vw|vh|%)\s+\d+(\.\d+)?(px|rem|em|vw|vh|%)/.test(v)
  );
}

/**
 * Check if value looks like a color
 */
function isColorValue(value: string): boolean {
  const v = value.toLowerCase().trim();
  return (
    v.startsWith('#') ||
    v.startsWith('rgb') ||
    v.startsWith('hsl') ||
    v.startsWith('oklch') ||
    v.startsWith('var(--') ||
    /^(transparent|inherit|currentcolor)$/i.test(v)
  );
}

/**
 * Derive Webflow Variable path from CSS variable name
 */
function deriveColorPath(name: string): string {
  const nameLower = name.toLowerCase();

  // Background colors
  if (nameLower.includes('bg') || nameLower === 'dark-bg' || nameLower === 'light-bg' || nameLower === 'card-bg') {
    const segment = formatPathSegment(
      name.replace(/-?bg$/i, '').replace(/^bg-?/i, '') || 'Base'
    );
    return `Colors / Background / ${segment}`;
  }

  // Dark palette
  if (nameLower.startsWith('dark-')) {
    const segment = formatPathSegment(name.replace('dark-', ''));
    return `Colors / Dark / ${segment}`;
  }

  // Text colors
  if (nameLower.startsWith('text-')) {
    const segment = formatPathSegment(name.replace('text-', ''));
    return `Colors / Text / ${segment}`;
  }

  // Accent/Coral colors
  if (nameLower.startsWith('coral-') || nameLower.startsWith('accent-')) {
    const segment = formatPathSegment(
      name.replace('coral-', '').replace('accent-', '')
    );
    return `Colors / Accent / ${segment}`;
  }

  // Border
  if (nameLower === 'border') {
    return 'Colors / Border / Default';
  }

  // Light palette
  if (nameLower.startsWith('light-')) {
    const segment = formatPathSegment(name.replace('light-', ''));
    return `Colors / Light / ${segment}`;
  }

  // Card colors
  if (nameLower.includes('card')) {
    const segment = formatPathSegment(name.replace(/-?card-?/i, '') || 'Card');
    return `Colors / Background / ${segment}`;
  }

  // Default
  return `Colors / Other / ${formatPathSegment(name)}`;
}

/**
 * Format a path segment (capitalize words)
 */
function formatPathSegment(str: string): string {
  if (!str) return 'Default';
  return str
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Default';
}

/**
 * Detect which modes are present
 */
function detectModes(variables: TokenVariable[]): string[] {
  const hasLight = variables.some(v =>
    v.cssVar.includes('light') || v.path.includes('Light')
  );
  const hasDark = variables.some(v =>
    v.cssVar.includes('dark') || v.path.includes('Dark')
  );

  if (hasLight && hasDark) {
    return ['light', 'dark'];
  }
  return [];
}

/**
 * Pair light/dark mode variables together
 */
function pairModeVariables(variables: TokenVariable[]): TokenVariable[] {
  const pairedVariables: TokenVariable[] = [];
  const processed = new Set<string>();

  // Known light/dark pairs (semantic mapping)
  const modePairs: Record<string, { light: string; dark: string }> = {
    'Colors / Background / Base': {
      light: '--light-bg',
      dark: '--dark-bg',
    },
    'Colors / Text / Primary': {
      light: '--text-dark',
      dark: '--text-light',
    },
    'Colors / Text / Muted': {
      light: '--text-muted',
      dark: '--text-muted-dark',
    },
  };

  // First, handle explicit pairs
  for (const [path, pair] of Object.entries(modePairs)) {
    const lightVar = variables.find(v => v.cssVar === pair.light);
    const darkVar = variables.find(v => v.cssVar === pair.dark);

    if (lightVar && darkVar) {
      pairedVariables.push({
        cssVar: pair.light,
        path,
        type: 'color',
        values: {
          light: lightVar.value || '',
          dark: darkVar.value || '',
        },
      });
      processed.add(lightVar.cssVar);
      processed.add(darkVar.cssVar);
    }
  }

  // Add remaining unpaired variables
  for (const v of variables) {
    if (!processed.has(v.cssVar)) {
      pairedVariables.push(v);
    }
  }

  return pairedVariables;
}

/**
 * Generate full token manifest
 */
export function generateTokenManifest(extraction: TokenExtraction): TokenManifest {
  return {
    schemaVersion: '1.0',
    name: extraction.name,
    slug: extraction.slug,
    namespace: extraction.namespace,
    modes: extraction.modes,
    variables: extraction.variables,
    fonts: extraction.fonts ? {
      googleFonts: extraction.fonts.googleFonts,
      headSnippet: generateFontSnippet(extraction.fonts.families),
    } : undefined,
  };
}

/**
 * Generate Google Fonts head snippet
 */
function generateFontSnippet(families: string[]): string {
  if (!families.length) return '';

  const fontParams = families
    .map(f => `family=${encodeURIComponent(f)}`)
    .join('&');

  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fontParams}&display=swap" rel="stylesheet">`;
}

/**
 * Extract Google Fonts URL from HTML
 */
export function extractGoogleFontsUrl(html: string): string | null {
  const match = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Extract font families from CSS font-family values
 */
export function extractFontFamilies(css: string): string[] {
  const families: string[] = [];
  
  // 1. Extract from CSS variables (e.g., --font-primary: 'Inter')
  // Matches: --font-xxx: 'Font' or "Font" or Font
  const varRegex = /--font-[\w-]+\s*:\s*(?:'([^']+)'|"([^"]+)"|([a-zA-Z\s-]+))/g;
  let match;

  while ((match = varRegex.exec(css)) !== null) {
    // match[1] = single quotes, match[2] = double quotes, match[3] = no quotes
    const family = (match[1] || match[2] || match[3]).trim().split(',')[0].trim();
    if (family && !families.includes(family)) {
      families.push(family);
    }
  }

  // 2. Extract from standard font-family properties
  const propRegex = /font-family\s*:\s*(?:'([^']+)'|"([^"]+)"|([a-zA-Z\s-]+))/g;
  while ((match = propRegex.exec(css)) !== null) {
    const family = (match[1] || match[2] || match[3]).trim().split(',')[0].trim();
    if (family && !families.includes(family) && !family.startsWith("var(")) {
      families.push(family);
    }
  }

  return families;
}

/**
 * Create URL-safe slug
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Derive namespace from design system name
 * "Flow Party" -> "fp", "My Design System" -> "mds"
 */
function deriveNamespace(name: string): string {
  const words = name.split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 3).toLowerCase();
  }
  return words.map(w => w.charAt(0).toLowerCase()).join('');
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert token manifest to JSON string
 */
export function tokenManifestToJson(manifest: TokenManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Parse token manifest from JSON string
 */
export function parseTokenManifest(json: string): TokenManifest | null {
  try {
    return JSON.parse(json) as TokenManifest;
  } catch {
    return null;
  }
}

/**
 * Extract border-radius tokens from CSS
 */
export function extractRadiusTokens(css: string): RadiusToken[] {
  const radiusTokens: RadiusToken[] = [];
  const varRegex = /--radius-([\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = varRegex.exec(css)) !== null) {
    const [, name, value] = match;
    const cleanValue = value.trim();
    
    // Determine size category
    let size: RadiusToken['size'] = 'medium';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('small') || nameLower.includes('sm')) {
      size = 'small';
    } else if (nameLower.includes('large') || nameLower.includes('lg')) {
      size = 'large';
    } else if (nameLower.includes('xlarge') || nameLower.includes('xl')) {
      size = 'xlarge';
    }

    radiusTokens.push({
      name,
      value: cleanValue,
      size,
    });
  }

  // Also extract from border-radius properties
  const propRegex = /border-radius\s*:\s*([^;]+);/g;
  const uniqueValues = new Set<string>();
  
  while ((match = propRegex.exec(css)) !== null) {
    const value = match[1].trim();
    // Skip CSS variables references
    if (!value.startsWith('var(') && !uniqueValues.has(value)) {
      uniqueValues.add(value);
    }
  }

  // Add unique literal values
  uniqueValues.forEach((value, idx) => {
    if (!radiusTokens.some(t => t.value === value)) {
      radiusTokens.push({
        name: `radius-${idx + 1}`,
        value,
        size: 'medium',
      });
    }
  });

  return radiusTokens;
}

/**
 * Extract box-shadow tokens from CSS
 */
export function extractShadowTokens(css: string): ShadowToken[] {
  const shadowTokens: ShadowToken[] = [];
  const varRegex = /--shadow-([\w-]+)\s*:\s*([^;]+);/g;
  let match;

  while ((match = varRegex.exec(css)) !== null) {
    const [, name, value] = match;
    const cleanValue = value.trim();
    
    // Determine intensity
    let intensity: ShadowToken['intensity'] = 'medium';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('xxsmall') || nameLower === 'xxs') {
      intensity = 'xxsmall';
    } else if (nameLower.includes('xsmall') || nameLower === 'xs') {
      intensity = 'xsmall';
    } else if (nameLower.includes('small') || nameLower === 'sm') {
      intensity = 'small';
    } else if (nameLower.includes('large') || nameLower === 'lg') {
      intensity = 'large';
    } else if (nameLower.includes('xlarge') || nameLower === 'xl') {
      intensity = 'xlarge';
    } else if (nameLower.includes('xxlarge') || nameLower === 'xxl') {
      intensity = 'xxlarge';
    }

    shadowTokens.push({
      name,
      value: cleanValue,
      intensity,
    });
  }

  // Also extract from box-shadow properties
  const propRegex = /box-shadow\s*:\s*([^;]+);/g;
  const uniqueValues = new Set<string>();
  
  while ((match = propRegex.exec(css)) !== null) {
    const value = match[1].trim();
    // Skip CSS variables and 'none'
    if (!value.startsWith('var(') && value !== 'none' && !uniqueValues.has(value)) {
      uniqueValues.add(value);
    }
  }

  // Add unique literal values
  uniqueValues.forEach((value, idx) => {
    if (!shadowTokens.some(t => t.value === value)) {
      shadowTokens.push({
        name: `shadow-${idx + 1}`,
        value,
        intensity: 'medium',
      });
    }
  });

  return shadowTokens;
}

/**
 * Extract UI element patterns from CSS
 */
export function extractUIElements(css: string): { buttons?: UIElement[]; inputs?: UIElement[] } {
  const buttons: UIElement[] = [];
  const inputs: UIElement[] = [];

  // Button patterns
  const buttonRegex = /\.(btn|button|cta|action)[-\w]*\s*\{([^}]+)\}/gi;
  let match;

  while ((match = buttonRegex.exec(css)) !== null) {
    const [, className] = match;
    const styles = match[2];
    
    if (!buttons.some(b => b.name === className)) {
      buttons.push({
        name: className,
        classes: [className],
        styles,
      });
    }
  }

  // Input patterns
  const inputRegex = /\.(input|field|form-control|textbox)[-\w]*\s*\{([^}]+)\}/gi;
  
  while ((match = inputRegex.exec(css)) !== null) {
    const [, className] = match;
    const styles = match[2];
    
    if (!inputs.some(i => i.name === className)) {
      inputs.push({
        name: className,
        classes: [className],
        styles,
      });
    }
  }

  return {
    buttons: buttons.length > 0 ? buttons : undefined,
    inputs: inputs.length > 0 ? inputs : undefined,
  };
}
