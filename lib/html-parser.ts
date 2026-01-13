/**
 * HTML Parser for AI-generated full-page HTML
 * Splits HTML into individual sections and extracts CSS
 */

export interface DetectedSection {
  id: string;
  name: string;
  tagName: string;
  className: string;
  htmlContent: string;
  cssSelectors: string[];
  cssContent: string;
  jsContent?: string;
}

export interface CssExtractionOptions {
  includeRoot?: boolean;
  includeReset?: boolean;
  includeBody?: boolean;
  includeHtml?: boolean;
  includeImg?: boolean;
  includeKeyframes?: boolean;
  dedupe?: boolean;
}

export interface ParseOptions {
  cssOptions?: CssExtractionOptions;
}

export interface ParseResult {
  title: string;
  sections: DetectedSection[];
  fullCss: string;
  fullJs: string;
  rootTokens: string;
  errors: string[];
}

/**
 * Main entry point - parse full HTML into sections
 */
export function parseFullHtml(html: string, options: ParseOptions = {}): ParseResult {
  const errors: string[] = [];

  // Extract title
  const title = extractTitle(html);

  // Extract CSS from <style> tags
  const fullCss = extractStyleContent(html);

  // Extract :root tokens block
  const rootTokens = extractRootTokens(fullCss);

  // Extract JS from <script> tags
  const fullJs = extractScriptContent(html);

  // Extract body content
  const bodyContent = extractBodyContent(html);

  // Detect sections
  const sections = detectSections(bodyContent, fullCss, options.cssOptions);

  return {
    title,
    sections,
    fullCss,
    fullJs,
    rootTokens,
    errors,
  };
}

/**
 * Extract page title from <title> tag
 */
function extractTitle(html: string): string {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  if (match) {
    // Clean up title: "Flow Party - Hero" -> "Flow Party"
    const title = match[1].trim();
    const dashIndex = title.indexOf(' - ');
    return dashIndex > 0 ? title.substring(0, dashIndex) : title;
  }
  return "Untitled";
}

/**
 * Extract all CSS content from <style> tags
 */
function extractStyleContent(html: string): string {
  const styleBlocks: string[] = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;

  while ((match = styleRegex.exec(html)) !== null) {
    styleBlocks.push(match[1].trim());
  }

  console.log("[html-parser] Found", styleBlocks.length, "style blocks, total CSS length:", styleBlocks.join('').length);

  return styleBlocks.join('\n\n');
}

/**
 * Extract :root { ... } block from CSS
 */
function extractRootTokens(css: string): string {
  const selectors = [":root", ".fp-root"];
  for (const selector of selectors) {
    const regex = new RegExp(`${escapeRegex(selector)}\\s*\\{([^}]+)\\}`);
    const match = css.match(regex);
    if (match) {
      return `${selector} {\n${match[1].trim()}\n}`;
    }
  }
  return "";
}

/**
 * Extract all JS content from <script> tags (excluding external src)
 */
function extractScriptContent(html: string): string {
  const scriptBlocks: string[] = [];
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      scriptBlocks.push(content);
    }
  }

  return scriptBlocks.join('\n\n');
}

/**
 * Extract content inside <body> tags
 */
function extractBodyContent(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1].trim() : html;
}

/**
 * Detect individual sections from body content
 */
export function detectSections(
  bodyContent: string,
  fullCss: string,
  cssOptions: CssExtractionOptions = {}
): DetectedSection[] {
  const sections: DetectedSection[] = [];
  const usedIds = new Set<string>();

  // Pattern 1: HTML comments marking sections
  // <!-- Navigation --> or <!-- Hero Section -->
  const commentPattern = /<!--\s*([^-]+)\s*-->\s*(<(?:section|nav|footer|header|div)[^>]*>[\s\S]*?<\/(?:section|nav|footer|header|div)>)/gi;

  // Pattern 2: Semantic tags with class/id
  const semanticPattern = /<(section|nav|footer|header)([^>]*)>([\s\S]*?)<\/\1>/gi;

  // Track processed HTML to avoid duplicates
  const processedHtml = new Set<string>();

  // Helper to ensure unique ID
  const ensureUniqueId = (baseId: string): string => {
    let id = baseId;
    let counter = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${counter}`;
      counter++;
    }
    usedIds.add(id);
    return id;
  };

  // First pass: Find sections marked with comments
  let match;
  while ((match = commentPattern.exec(bodyContent)) !== null) {
    const [fullMatch, commentName, sectionHtml] = match;
    const htmlSignature = sectionHtml.substring(0, 100);

    if (!processedHtml.has(htmlSignature)) {
      processedHtml.add(htmlSignature);
      const section = createSection(commentName.trim(), sectionHtml, fullCss, ensureUniqueId, cssOptions);
      if (section) {
        sections.push(section);
      }
    }
  }

  // Second pass: Find semantic tags not already processed
  while ((match = semanticPattern.exec(bodyContent)) !== null) {
    const [fullMatch, tagName, attributes, innerContent] = match;
    const sectionHtml = fullMatch;
    const htmlSignature = sectionHtml.substring(0, 100);

    if (!processedHtml.has(htmlSignature)) {
      processedHtml.add(htmlSignature);

      // Extract name from class or id
      const classMatch = attributes.match(/class="([^"]+)"/);
      const idMatch = attributes.match(/id="([^"]+)"/);
      const className = classMatch ? classMatch[1].split(' ')[0] : '';
      const id = idMatch ? idMatch[1] : '';

      const name = formatSectionName(className || id || tagName);
      const section = createSection(name, sectionHtml, fullCss, ensureUniqueId, cssOptions);
      if (section) {
        sections.push(section);
      }
    }
  }

  return sections;
}

/**
 * Create a DetectedSection object from HTML content
 */
function createSection(
  name: string,
  html: string,
  fullCss: string,
  ensureUniqueId: (baseId: string) => string,
  cssOptions: CssExtractionOptions
): DetectedSection | null {
  // Extract tag info
  const tagMatch = html.match(/<(section|nav|footer|header|div)([^>]*)>/i);
  if (!tagMatch) return null;

  const tagName = tagMatch[1].toLowerCase();
  const attributes = tagMatch[2];

  // Extract class name
  const classMatch = attributes.match(/class="([^"]+)"/);
  const className = classMatch ? classMatch[1].split(' ')[0] : '';

  // Extract ID
  const idMatch = attributes.match(/id="([^"]+)"/);
  const id = idMatch ? idMatch[1] : '';

  // Generate unique section ID
  const baseId = generateSectionId(className || id || name);
  const sectionId = ensureUniqueId(baseId);

  // Collect all class names used in this section
  const cssSelectors = extractClassNames(html);

  // Extract CSS rules for this section
  const cssContent = extractCssForSection(fullCss, cssSelectors, cssOptions);

  return {
    id: sectionId,
    name: formatSectionName(name),
    tagName,
    className,
    htmlContent: html.trim(),
    cssSelectors,
    cssContent,
  };
}

/**
 * Extract all class names from HTML
 */
export function extractClassNames(html: string): string[] {
  const classNames = new Set<string>();
  const classRegex = /class="([^"]+)"/gi;
  let match;

  while ((match = classRegex.exec(html)) !== null) {
    const classes = match[1].split(/\s+/);
    classes.forEach(c => {
      if (c.trim()) {
        classNames.add(c.trim());
      }
    });
  }

  return Array.from(classNames);
}

/**
 * Extract CSS rules that match the given selectors
 */
export function extractCssForSection(
  fullCss: string,
  selectors: string[],
  options: CssExtractionOptions = {}
): string {
  const cssLines: string[] = [];
  const seen = new Set<string>();
  const settings = {
    includeRoot: options.includeRoot !== false,
    includeReset: options.includeReset !== false,
    includeBody: options.includeBody !== false,
    includeHtml: options.includeHtml === true,
    includeImg: options.includeImg === true,
    includeKeyframes: options.includeKeyframes !== false,
    dedupe: options.dedupe !== false,
  };

  const pushRule = (rule: string) => {
    const trimmed = rule.trim();
    if (!trimmed) return;
    if (!settings.dedupe) {
      cssLines.push(rule);
      return;
    }
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    cssLines.push(rule);
  };

  // Always include :root tokens
  if (settings.includeRoot) {
    const rootRegex = /\/\*[\s\S]*?\*\/\s*:root\s*\{[^}]+\}|:root\s*\{[^}]+\}/g;
    for (const match of fullCss.matchAll(rootRegex)) {
      pushRule(match[0]);
    }
    const fpRootRegex = /\.fp-root\s*\{[^}]+\}/g;
    for (const match of fullCss.matchAll(fpRootRegex)) {
      pushRule(match[0]);
    }
  }

  // Always include universal reset
  if (settings.includeReset) {
    const resetMatch = fullCss.match(/\*\s*\{[^}]+\}/);
    if (resetMatch) {
      pushRule('\n' + resetMatch[0]);
    }
  }

  // Always include body styles
  if (settings.includeBody) {
    const bodyMatch = fullCss.match(/body\s*\{[^}]+\}/);
    if (bodyMatch) {
      pushRule('\n' + bodyMatch[0]);
    }
  }

  if (settings.includeHtml) {
    const htmlMatch = fullCss.match(/html\s*\{[^}]+\}/);
    if (htmlMatch) {
      pushRule('\n' + htmlMatch[0]);
    }
  }

  if (settings.includeImg) {
    const imgMatch = fullCss.match(/img\s*\{[^}]+\}/);
    if (imgMatch) {
      pushRule('\n' + imgMatch[0]);
    }
  }

  // Build regex patterns for selectors
  const selectorPatterns = selectors.map(s => escapeRegex(s));

  // Extract matching CSS rules
  // Match: .class-name { ... } or .class-name:hover { ... }
  const ruleRegex = /([.#][\w-]+(?:[:\s][^{]*)?)\s*\{([^}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(fullCss)) !== null) {
    const [fullRule, selector] = match;

    // Check if any of our selectors match
    for (const pattern of selectorPatterns) {
      if (selector.includes('.' + pattern) || selector.includes('#' + pattern)) {
        pushRule('\n' + fullRule);
        break;
      }
    }
  }

  // Extract media queries containing our selectors
  const mediaRegex = /@media[^{]+\{([\s\S]*?)\}\s*\}/g;
  while ((match = mediaRegex.exec(fullCss)) !== null) {
    const [fullMedia, mediaContent] = match;

    // Check if media query contains any of our selectors
    for (const pattern of selectorPatterns) {
      if (mediaContent.includes('.' + pattern) || mediaContent.includes('#' + pattern)) {
        pushRule('\n' + fullMedia);
        break;
      }
    }
  }

  // Extract @keyframes used in this section
  if (settings.includeKeyframes) {
    const keyframesRegex = /@keyframes\s+(\w+)\s*\{[\s\S]*?\}\s*\}/g;
    while ((match = keyframesRegex.exec(fullCss)) !== null) {
      const [fullKeyframe, animationName] = match;
      // Check if animation is referenced in our CSS
      if (cssLines.some(line => line.includes(animationName))) {
        pushRule('\n' + fullKeyframe);
      }
    }
  }

  return cssLines.join('\n');
}

/**
 * Generate a URL-safe section ID
 */
function generateSectionId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Format section name for display
 */
function formatSectionName(input: string): string {
  // Remove common suffixes
  let name = input
    .replace(/-section$/i, '')
    .replace(/section$/i, '')
    .replace(/-/g, ' ');

  // Title case
  name = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return name.trim() || 'Untitled Section';
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build complete section HTML file with tokens
 */
export function buildSectionHtml(
  section: DetectedSection,
  rootTokens: string,
  title: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${section.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Antonio:wght@700&display=swap" rel="stylesheet">
    <style>
        ${section.cssContent}
    </style>
</head>
<body>
    ${section.htmlContent}
</body>
</html>`;
}

/**
 * Build codePayload format for asset storage
 */
export function buildCodePayload(
  section: DetectedSection,
  jsContent?: string
): string {
  let payload = `/* HTML */\n${section.htmlContent}\n\n/* CSS */\n${section.cssContent}`;

  if (jsContent) {
    payload += `\n\n/* JS */\n${jsContent}`;
  }

  return payload;
}
