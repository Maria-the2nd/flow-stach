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
  const mediaRegex = /@media\s*([^{]+)\{([\s\S]*?)\}\s*\}/g;

  let mediaMatch;
  while ((mediaMatch = mediaRegex.exec(cleanCss)) !== null) {
    const query = mediaMatch[1].trim();
    const content = mediaMatch[2];
    const rules = parseRulesFromContent(content);
    mediaBlocks.push({ query, rules });
  }

  const baseContent = cleanCss.replace(mediaRegex, "");
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
    let removedCustomProps = false;

    for (const entry of entries) {
      const name = entry.name;
      if (name.startsWith("--")) {
        removedCustomProps = true;
        continue;
      }
      if (name.toLowerCase() === "content") {
        warnings.push(`Removed unsupported content property on "${rule.selector}".`);
        continue;
      }
      const { resolved, hasUnresolved } = resolveCssVariables(entry.value, variables, 8);
      if (hasUnresolved) {
        extractVarNames(entry.value).forEach((varName) => unresolved.add(varName));
      }
      // Ensure resolved value doesn't have unexpected quotes (defensive check)
      const cleanedValue = resolved.trim().replace(/^['"]|['"]$/g, '');
      processed.push({ name, value: cleanedValue });
    }

    if (removedCustomProps) {
      warnings.push(`Removed CSS custom properties from "${rule.selector}".`);
    }

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
