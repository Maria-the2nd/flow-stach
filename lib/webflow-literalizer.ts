/**
 * Webflow CSS literalization pass.
 * Resolves CSS variables and strips unsupported constructs for Webflow paste.
 */

import { extractCssVariables, resolveCssVariables } from "./css-parser";

export interface WebflowLiteralizeResult {
  css: string;
  warnings: string[];
  unresolvedVariables: string[];
  remainingVarCount: number;
}

interface RawRule {
  selector: string;
  properties: string;
}

interface MediaBlock {
  query: string;
  rules: RawRule[];
}

interface PropertyEntry {
  name: string;
  value: string;
}

const COMMENT_REGEX = /\/\*[\s\S]*?\*\//g;

export function literalizeCssForWebflow(
  css: string,
  options: { strict?: boolean } = {}
): WebflowLiteralizeResult {
  const warnings: string[] = [];
  const variables = extractCssVariables(css);
  const unresolved = new Set<string>();

  const parsed = parseCssBlocks(css);
  const baseRules = processRules(parsed.baseRules, variables, warnings, unresolved);
  const mediaBlocks = parsed.mediaBlocks.map((block) => ({
    query: block.query,
    rules: processRules(block.rules, variables, warnings, unresolved),
  }));

  const literalCss = serializeCss(baseRules, mediaBlocks);
  const remainingVarCount = (literalCss.match(/var\(\s*--/g) || []).length;
  if (remainingVarCount > 0) {
    warnings.push(`Remaining CSS variables in final CSS: ${remainingVarCount}`);
  }
  if (unresolved.size > 0) {
    const names = Array.from(unresolved);
    warnings.push(
      `Unresolved CSS variables: ${names.slice(0, 6).join(", ")}${names.length > 6 ? "..." : ""}`
    );
  }

  if (options.strict && (unresolved.size > 0 || remainingVarCount > 0)) {
    throw new Error("Unresolved CSS variables remain after literalization.");
  }

  return {
    css: literalCss,
    warnings,
    unresolvedVariables: Array.from(unresolved),
    remainingVarCount,
  };
}

function parseCssBlocks(css: string): { baseRules: RawRule[]; mediaBlocks: MediaBlock[] } {
  const cleanCss = css.replace(COMMENT_REGEX, "");
  const mediaBlocks: MediaBlock[] = [];

  // Use proper brace matching to extract media blocks
  // (The simple regex /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g fails for nested braces)
  const mediaStartRegex = /@media\s*([^{]+)\s*\{/g;
  const fullMatches: string[] = [];
  let match;

  while ((match = mediaStartRegex.exec(cleanCss)) !== null) {
    const query = match[1].trim();
    const openBraceIndex = match.index + match[0].length - 1;

    // Find the matching closing brace using brace counting
    let braceCount = 1;
    let i = openBraceIndex + 1;
    while (i < cleanCss.length && braceCount > 0) {
      if (cleanCss[i] === "{") braceCount++;
      else if (cleanCss[i] === "}") braceCount--;
      i++;
    }

    if (braceCount === 0) {
      const content = cleanCss.slice(openBraceIndex + 1, i - 1);
      const fullMatch = cleanCss.slice(match.index, i);
      fullMatches.push(fullMatch);
      const rules = parseRulesFromContent(content);
      mediaBlocks.push({ query, rules });
    }
  }

  // Remove all media blocks from CSS to get base rules
  let baseContent = cleanCss;
  for (const fullMatch of fullMatches) {
    baseContent = baseContent.replace(fullMatch, "");
  }
  const baseRules = parseRulesFromContent(baseContent);

  return { baseRules, mediaBlocks };
}

function parseRulesFromContent(content: string): RawRule[] {
  const rules: RawRule[] = [];
  const ruleRegex = /([^{}]+)\{([^{}]+)\}/g;
  let match;

  while ((match = ruleRegex.exec(content)) !== null) {
    const selector = match[1].trim();
    const properties = match[2].trim();
    if (!selector || selector.startsWith("@")) continue;
    rules.push({ selector, properties });
  }

  return rules;
}

function processRules(
  rules: RawRule[],
  variables: Map<string, string>,
  warnings: string[],
  unresolved: Set<string>
): RawRule[] {
  const output: RawRule[] = [];

  for (const rule of rules) {
    if (rule.selector.includes("::")) {
      warnings.push(`Removed pseudo-element rule: ${rule.selector}`);
      continue;
    }

    const entries = parseProperties(rule.properties);
    const processed: PropertyEntry[] = [];
    for (const entry of entries) {
      const name = entry.name;
      // Don't strip custom properties - they act as fallback for unresolved vars
      // if (name.startsWith("--")) {
      //   continue;
      // }
      if (name.toLowerCase() === "content") {
        warnings.push(`Removed unsupported content property on "${rule.selector}".`);
        continue;
      }
      // Pass property name to preserve font-family quotes
      const { resolved, hasUnresolved } = resolveCssVariables(entry.value, variables, 8, name);
      if (hasUnresolved) {
        extractVarNames(entry.value).forEach((varName) => unresolved.add(varName));
      }
      // Ensure resolved value doesn't have unexpected quotes (defensive check)
      // BUT preserve quotes for font-family - they're semantically meaningful
      const cleanedValue = name.toLowerCase() === "font-family"
        ? resolved
        : stripSurroundingQuotes(resolved);
      processed.push({ name, value: cleanedValue });
    }

    // Keep custom properties to support unresolved variables
    // if (removedCustomProps) {
    //   warnings.push(`Removed CSS custom properties from "${rule.selector}".`);
    // }

    if (processed.length === 0) continue;

    output.push({
      selector: rule.selector,
      properties: serializeProperties(processed),
    });
  }

  return output;
}

function parseProperties(propertiesStr: string): PropertyEntry[] {
  const entries: PropertyEntry[] = [];
  const properties: string[] = [];
  let current = "";
  let parenDepth = 0;

  for (const char of propertiesStr) {
    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    if (char === ";" && parenDepth === 0) {
      if (current.trim()) properties.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) properties.push(current.trim());

  for (const prop of properties) {
    const colonIndex = prop.indexOf(":");
    if (colonIndex === -1) continue;
    const name = prop.substring(0, colonIndex).trim();
    const value = prop.substring(colonIndex + 1).trim();
    if (!name || !value) continue;
    entries.push({ name, value });
  }

  return entries;
}

function serializeProperties(entries: PropertyEntry[]): string {
  return entries.map((entry) => `${entry.name}: ${entry.value};`).join(" ");
}

function serializeCss(baseRules: RawRule[], mediaBlocks: MediaBlock[]): string {
  const baseCss = baseRules
    .map((rule) => `${rule.selector} { ${rule.properties} }`)
    .join("\n");

  const mediaCss = mediaBlocks
    .map((block) => {
      if (block.rules.length === 0) return "";
      const rules = block.rules.map((rule) => `${rule.selector} { ${rule.properties} }`).join("\n");
      return `@media ${block.query} {\n${rules}\n}`;
    })
    .filter(Boolean)
    .join("\n");

  return [baseCss, mediaCss].filter(Boolean).join("\n").trim();
}

function extractVarNames(value: string): string[] {
  const matches = value.match(/var\(\s*(--[\w-]+)/g);
  if (!matches) return [];
  return matches.map((match) => match.replace(/var\(\s*/, "").trim());
}

function stripSurroundingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed.charAt(0);
  const last = trimmed.charAt(trimmed.length - 1);
  if ((first === '"' || first === "'") && first === last) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
