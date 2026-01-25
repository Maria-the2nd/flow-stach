/**
 * BEM Class Renamer Module
 *
 * Orchestrates class renaming for imported HTML/CSS to produce
 * Webflow-safe, namespaced BEM class names.
 *
 * This module leverages existing BEM utilities in flowbridge-semantic.ts
 * and provides a thin orchestration layer for the import pipeline.
 */

import type { ComponentTree, Component } from "./componentizer";
import {
  isHighRiskClass,
  detectHighRiskClasses,
  getHighRiskReason,
  formatBEM,
  parseToBEMParts,
  inferElementRole,
  updateHTMLClassReferences,
  updateCSSClassReferences,
  updateJSClassReferences,
  type ElementContext,
} from "./flowbridge-semantic";
import { RESERVED_CLASS_NAMES, RESERVED_CLASS_PREFIXES } from "./preflight-validator";

const MAX_BEM_LENGTH = 40;
const MAX_BLOCK_LENGTH = 16;
const MAX_PART_LENGTH = 20;
const ROLE_TOKENS = ["hero", "stats", "features", "card", "grid", "container"];
const BLOCK_STOP_WORDS = new Set([
  "test",
  "all",
  "outputs",
  "output",
  "project",
  "site",
  "page",
  "demo",
  "sample",
  "example",
]);

// ============================================
// TYPES
// ============================================

export interface BemRenamerOptions {
  /** Project slug used as BEM block prefix */
  projectSlug: string;
  /** Enable LLM refinement for ambiguous names */
  enableLlmRefinement?: boolean;
  /** Classes to preserve (whitelist) */
  preserveClasses?: string[];
  /** Update JavaScript class references */
  updateJSReferences?: boolean;
}

export interface ClassRenamingReport {
  status: "pass" | "warn";
  summary: {
    totalClasses: number;
    renamed: number;
    preserved: number;
    highRiskNeutralized: number;
    jsReferencesUpdated: number;
  };
  categories: {
    bemRenamed: Array<{ original: string; renamed: string; block: string }>;
    utilityNamespaced: Array<{ original: string; renamed: string }>;
    preserved: Array<{ className: string; reason: string }>;
    highRiskDetected: string[];
  };
  warnings: string[];
}

export interface BemRenamerResult {
  /** Map of original class name to new BEM class name */
  mapping: Map<string, string>;
  /** Updated component tree with renamed classes */
  updatedComponents: ComponentTree;
  /** Updated CSS with renamed class selectors */
  updatedCss: string;
  /** Updated JS with renamed class references */
  updatedJs: string;
  /** Detailed report for UI */
  report: ClassRenamingReport;
  /** Context for LLM semantic patching */
  llmContext?: LlmClassContext;
}

export interface LlmClassContext {
  /** Proposed class mappings for LLM review */
  proposedMapping: Array<{
    original: string;
    proposed: string;
    reason: string;
  }>;
  /** High-risk classes that were renamed */
  highRiskDetected: string[];
  /** Ambiguous names where LLM could suggest better alternatives */
  ambiguousNames: string[];
}

// ============================================
// MAIN RENAMING FUNCTION
// ============================================

/**
 * Main entry point for class renaming.
 * Performs deterministic BEM renaming across HTML, CSS, and JS.
 */
export function renameClassesForProject(params: {
  componentsTree: ComponentTree;
  css: string;
  js: string;
  establishedClasses: string[];
  options: BemRenamerOptions;
}): BemRenamerResult {
  const { componentsTree, css, js, establishedClasses, options } = params;

  // Build class usage index across all components
  const classUsage = buildClassUsageIndex(componentsTree);

  // Build element contexts for BEM inference
  const elementContexts = buildElementContexts(componentsTree);

  // Generate class renames
  const renameResult = generateProjectClassRenames({
    classUsage,
    elementContexts,
    establishedClasses,
    options,
  });

  // Apply renames to components
  const updatedComponents = applyRenamesToComponents(
    componentsTree,
    renameResult.mapping
  );

  // Apply renames to CSS
  const cssResult = updateCSSClassReferences(css, renameResult.mapping);

  // Apply renames to JS (if enabled)
  const jsResult = options.updateJSReferences !== false
    ? updateJSClassReferences(js, renameResult.mapping)
    : { updated: js, replacements: 0 };

  // Build report
  const report = buildClassRenamingReport(renameResult, {
    jsReplacementCount: jsResult.replacements,
  });

  // Build LLM context if refinement is enabled
  const llmContext = options.enableLlmRefinement
    ? buildLlmClassContext(renameResult)
    : undefined;

  return {
    mapping: renameResult.mapping,
    updatedComponents,
    updatedCss: cssResult.updated,
    updatedJs: jsResult.updated,
    report,
    llmContext,
  };
}

// ============================================
// CLASS USAGE ANALYSIS
// ============================================

interface ClassUsageEntry {
  className: string;
  /** Number of components using this class */
  componentCount: number;
  /** Component IDs where this class is used */
  componentIds: string[];
  /** Is this class high-risk for Webflow collision? */
  isHighRisk: boolean;
  /** Reason for high-risk classification */
  highRiskReason?: string;
}

/**
 * Build an index of class usage across all components
 */
function buildClassUsageIndex(
  componentsTree: ComponentTree
): Map<string, ClassUsageEntry> {
  const usage = new Map<string, ClassUsageEntry>();

  for (const component of componentsTree.components) {
    for (const className of component.classesUsed) {
      if (!usage.has(className)) {
        const isHigh = isHighRiskClass(className);
        usage.set(className, {
          className,
          componentCount: 0,
          componentIds: [],
          isHighRisk: isHigh,
          highRiskReason: isHigh ? getHighRiskReason(className) : undefined,
        });
      }

      const entry = usage.get(className)!;
      entry.componentCount += 1;
      if (!entry.componentIds.includes(component.id)) {
        entry.componentIds.push(component.id);
      }
    }
  }

  return usage;
}

/**
 * Build element contexts from components for BEM inference
 */
function buildElementContexts(
  componentsTree: ComponentTree
): Map<string, ElementContext[]> {
  const contexts = new Map<string, ElementContext[]>();

  for (const component of componentsTree.components) {
    const componentContexts = extractElementContextsFromHtml(
      component.htmlContent
    );
    contexts.set(component.id, componentContexts);
  }

  return contexts;
}

/**
 * Extract element contexts from HTML for BEM inference
 */
function extractElementContextsFromHtml(html: string): ElementContext[] {
  const contexts: ElementContext[] = [];
  const tagPattern = /<(\w+)([^>]*)>/g;

  let match;
  while ((match = tagPattern.exec(html)) !== null) {
    const tagName = match[1].toLowerCase();
    const attrString = match[2];

    // Extract class attribute
    const classMatch = attrString.match(/class=["']([^"']+)["']/);
    const classList = classMatch
      ? classMatch[1].split(/\s+/).filter(Boolean)
      : [];

    // Extract id attribute
    const idMatch = attrString.match(/id=["']([^"']+)["']/);
    const id = idMatch ? idMatch[1] : undefined;

    // Extract other attributes
    const attributes: Record<string, string> = {};
    const attrRegex = /([a-zA-Z0-9-]+)=["']([^"']*)["']/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attributes[attrMatch[1]] = attrMatch[2];
    }

    if (classList.length > 0) {
      contexts.push({
        tagName,
        classList,
        attributes,
        parentBlock: undefined, // Could be inferred from DOM structure
      });
    }
  }

  return contexts;
}

// ============================================
// CLASS RENAMING LOGIC
// ============================================

interface RenameGenerationResult {
  mapping: Map<string, string>;
  highRiskDetected: string[];
  ambiguousNames: string[];
  detailedRenames: Array<{
    original: string;
    renamed: string;
    block: string;
    reason: string;
    isHighRisk: boolean;
    isShared: boolean;
  }>;
  preserved: Array<{ className: string; reason: string }>;
}

/**
 * Generate BEM class renames for the project
 */
function generateProjectClassRenames(params: {
  classUsage: Map<string, ClassUsageEntry>;
  elementContexts: Map<string, ElementContext[]>;
  establishedClasses: string[];
  options: BemRenamerOptions;
}): RenameGenerationResult {
  const { classUsage, elementContexts, establishedClasses, options } = params;

  const mapping = new Map<string, string>();
  const highRiskDetected: string[] = [];
  const ambiguousNames: string[] = [];
  const detailedRenames: RenameGenerationResult["detailedRenames"] = [];
  const preserved: Array<{ className: string; reason: string }> = [];

  // Build preserve set
  const preserveSet = new Set([
    ...establishedClasses,
    ...(options.preserveClasses || []),
  ]);

  // Track used BEM names to avoid duplicates
  const usedBemNames = new Set<string>();

  // Sanitize project slug for use as BEM block
  const projectBlock = sanitizeProjectBlock(options.projectSlug);

  // Process each class
  for (const [className, usage] of classUsage) {
    // Skip if preserved
    if (preserveSet.has(className)) {
      mapping.set(className, className);
      preserved.push({ className, reason: "Design token or whitelist" });
      continue;
    }

    // Skip if already starts with our namespace
    if (
      className.startsWith(`${projectBlock}__`) ||
      className.startsWith(`${projectBlock}-`)
    ) {
      mapping.set(className, className);
      preserved.push({ className, reason: "Already namespaced" });
      continue;
    }

    // Track high-risk classes
    if (usage.isHighRisk) {
      highRiskDetected.push(className);
    }

    // Determine if shared (used in multiple components)
    const isShared = usage.componentCount > 1;

    // Find element context for this class
    const context = findBestElementContext(className, elementContexts);

    // Generate BEM name
    const bemResult = generateBemName({
      className,
      context,
      projectBlock,
      isShared,
      isHighRisk: usage.isHighRisk,
      usedBemNames,
    });

    mapping.set(className, bemResult.bemName);
    usedBemNames.add(bemResult.bemName);

    // Track ambiguous names for LLM
    if (bemResult.isAmbiguous) {
      ambiguousNames.push(className);
    }

    detailedRenames.push({
      original: className,
      renamed: bemResult.bemName,
      block: projectBlock,
      reason: bemResult.reason,
      isHighRisk: usage.isHighRisk,
      isShared,
    });
  }

  return {
    mapping,
    highRiskDetected,
    ambiguousNames,
    detailedRenames,
    preserved,
  };
}

/**
 * Find the best element context for a class
 */
function findBestElementContext(
  className: string,
  elementContexts: Map<string, ElementContext[]>
): ElementContext | undefined {
  for (const contexts of elementContexts.values()) {
    for (const ctx of contexts) {
      if (ctx.classList.includes(className)) {
        return ctx;
      }
    }
  }
  return undefined;
}

interface BemNameResult {
  bemName: string;
  reason: string;
  isAmbiguous: boolean;
}

/**
 * Generate a BEM class name for a single class
 */
function generateBemName(params: {
  className: string;
  context: ElementContext | undefined;
  projectBlock: string;
  isShared: boolean;
  isHighRisk: boolean;
  usedBemNames: Set<string>;
}): BemNameResult {
  const { className, context, projectBlock, isShared, isHighRisk, usedBemNames } = params;

  // Parse existing class name for hints
  const existingParts = parseToBEMParts(className);

  // Shared classes become BEM utilities (avoid cross-component collisions)
  if (isShared) {
    const utilityToken = selectRoleToken(className, existingParts.element, context) || "utility";
    const element = `utility-${utilityToken}`;
    const bemName = ensureUniqueBemName(
      enforceMaxBemLength(formatBEM(projectBlock, element), MAX_BEM_LENGTH),
      usedBemNames
    );

    return {
      bemName,
      reason: "Shared class namespaced as BEM utility",
      isAmbiguous: isHighRisk || utilityToken === "utility",
    };
  }

  // Infer element/modifier from context if available
  const inferred = context
    ? inferElementRole(context)
    : { element: undefined, modifier: undefined };

  // Determine block name
  let block = projectBlock;

  // Determine element name (strict BEM: always include element)
  let element = inferred.element || existingParts.element;

  // If the class name itself looks like a block (not generic), use it as element
  if (!element && existingParts.block && !isHighRisk) {
    element = sanitizeBemPart(existingParts.block);
  }

  // High-risk generic names get forced into element slot to avoid collisions
  if (!element && isHighRisk) {
    element = sanitizeBemPart(className) || "element";
  }

  // Use role token if still ambiguous or not in our allowed set
  const roleToken = selectRoleToken(className, element, context);
  if (!element || !ROLE_TOKENS.includes(element)) {
    element = roleToken || element || "container";
  }

  // Determine modifier
  const modifier = inferred.modifier || existingParts.modifier;

  // Sanitize parts + enforce maximum length
  let normalizedElement = sanitizeBemPart(element, MAX_PART_LENGTH);
  if (isReservedClassName(normalizedElement)) {
    normalizedElement = `x-${normalizedElement}`;
  }
  let normalizedModifier = modifier ? sanitizeBemPart(modifier, MAX_PART_LENGTH) : undefined;
  if (normalizedModifier && isReservedClassName(normalizedModifier)) {
    normalizedModifier = `x-${normalizedModifier}`;
  }
  let bemName = enforceMaxBemLength(
    formatBEM(block, normalizedElement, normalizedModifier),
    MAX_BEM_LENGTH
  );

  // Ensure uniqueness (keep within max length)
  bemName = ensureUniqueBemName(bemName, usedBemNames);

  // Determine if ambiguous (would benefit from LLM naming)
  const isAmbiguous =
    isHighRisk ||
    !element ||
    element === "container" ||
    element === "section" ||
    element === "text";

  // Build reason string
  let reason = "";
  if (isHighRisk) {
    reason = `High-risk generic name neutralized`;
  } else if (inferred.element) {
    reason = `Inferred from HTML context (${context?.tagName})`;
  } else if (existingParts.element) {
    reason = `Preserved element from original class`;
  } else {
    reason = `Namespaced from original`;
  }

  return { bemName, reason, isAmbiguous };
}

/**
 * Sanitize a string for use as BEM block/element name
 */
function sanitizeBemPart(name: string, maxLength = MAX_PART_LENGTH): string {
  const sanitized = name
    .toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!sanitized) return "";
  if (sanitized.length <= maxLength) return sanitized;
  return sanitized.slice(0, maxLength).replace(/-+$/g, "");
}

function sanitizeProjectBlock(projectSlug: string): string {
  const base = sanitizeBemPart(projectSlug, 80);
  const tokens = base.split("-").filter((token) => token && !BLOCK_STOP_WORDS.has(token));
  let candidate = tokens.slice(0, 3).join("-");

  if (!candidate) {
    candidate = "block";
  }

  if (candidate.length > MAX_BLOCK_LENGTH) {
    candidate = tokens.slice(0, 2).join("-") || candidate;
  }

  if (candidate.length > MAX_BLOCK_LENGTH) {
    candidate = tokens.map((t) => t[0]).join("");
  }

  if (candidate.length > MAX_BLOCK_LENGTH) {
    candidate = candidate.slice(0, MAX_BLOCK_LENGTH).replace(/-+$/g, "");
  }

  if (!candidate || isReservedClassName(candidate)) {
    candidate = `x-${candidate || "block"}`;
  }

  return candidate;
}

function selectRoleToken(
  className: string,
  elementHint?: string,
  context?: ElementContext
): string | undefined {
  const classLower = className.toLowerCase();
  for (const token of ROLE_TOKENS) {
    if (classLower.includes(token)) return token;
  }

  if (elementHint) {
    const elementLower = elementHint.toLowerCase();
    for (const token of ROLE_TOKENS) {
      if (elementLower.includes(token)) return token;
    }
  }

  const tag = context?.tagName?.toLowerCase();
  if (tag === "section") return "container";
  if (tag === "div") return "container";
  if (tag === "ul" || tag === "ol") return "grid";

  return undefined;
}

function enforceMaxBemLength(bemName: string, maxLength: number): string {
  if (bemName.length <= maxLength) return bemName;

  const parsed = parseToBEMParts(bemName);
  const block = sanitizeBemPart(parsed.block || "block", MAX_BLOCK_LENGTH);
  let element = sanitizeBemPart(parsed.element || "container", MAX_PART_LENGTH);
  let modifier = parsed.modifier ? sanitizeBemPart(parsed.modifier, MAX_PART_LENGTH) : undefined;

  let rebuilt = formatBEM(block, element, modifier);
  if (rebuilt.length <= maxLength) return rebuilt;

  if (modifier) {
    modifier = sanitizeBemPart(modifier, 10);
    rebuilt = formatBEM(block, element, modifier);
    if (rebuilt.length <= maxLength) return rebuilt;
  }

  element = sanitizeBemPart(element, 12);
  rebuilt = formatBEM(block, element, modifier);
  if (rebuilt.length <= maxLength) return rebuilt;

  const remaining = Math.max(maxLength - block.length - 2, 8);
  element = sanitizeBemPart(element, remaining);
  rebuilt = formatBEM(block, element, modifier);

  return rebuilt.length <= maxLength ? rebuilt : rebuilt.slice(0, maxLength).replace(/-+$/g, "");
}

function ensureUniqueBemName(baseName: string, usedBemNames: Set<string>): string {
  if (!usedBemNames.has(baseName)) {
    return baseName;
  }

  let counter = 2;
  let candidate = baseName;
  while (usedBemNames.has(candidate)) {
    const suffix = `-${counter}`;
    const trimmed = baseName.length + suffix.length > MAX_BEM_LENGTH
      ? baseName.slice(0, MAX_BEM_LENGTH - suffix.length).replace(/-+$/g, "")
      : baseName;
    candidate = `${trimmed}${suffix}`;
    counter++;
  }

  return candidate;
}

function isReservedClassName(name: string): boolean {
  if (RESERVED_CLASS_NAMES.has(name)) return true;
  return RESERVED_CLASS_PREFIXES.some((prefix) => name.startsWith(prefix));
}

// ============================================
// APPLY RENAMES TO COMPONENTS
// ============================================

/**
 * Apply class renames to component tree
 */
function applyRenamesToComponents(
  componentsTree: ComponentTree,
  mapping: Map<string, string>
): ComponentTree {
  const updatedComponents: Component[] = componentsTree.components.map(
    (component) => {
      // Update HTML content
      const htmlResult = updateHTMLClassReferences(
        component.htmlContent,
        mapping
      );

      // Update classesUsed array
      const updatedClasses = component.classesUsed.map(
        (cls) => mapping.get(cls) || cls
      );

      // Update primaryClass
      const updatedPrimaryClass =
        mapping.get(component.primaryClass) || component.primaryClass;

      return {
        ...component,
        htmlContent: htmlResult.updated,
        classesUsed: updatedClasses,
        primaryClass: updatedPrimaryClass,
      };
    }
  );

  return {
    ...componentsTree,
    components: updatedComponents,
  };
}

// ============================================
// REPORT GENERATION
// ============================================

/**
 * Build the class renaming report for UI
 */
function buildClassRenamingReport(
  renameResult: RenameGenerationResult,
  options: { jsReplacementCount: number }
): ClassRenamingReport {
  const { mapping, highRiskDetected, detailedRenames, preserved } = renameResult;

  // Count actual renames (excluding identity mappings)
  const actualRenames = detailedRenames.filter(
    (r) => r.original !== r.renamed
  );

  // Categorize renames
  const bemRenamed: ClassRenamingReport["categories"]["bemRenamed"] = [];
  const utilityNamespaced: ClassRenamingReport["categories"]["utilityNamespaced"] = [];

  for (const rename of actualRenames) {
    if (rename.renamed.includes("__")) {
      // Full BEM with element
      bemRenamed.push({
        original: rename.original,
        renamed: rename.renamed,
        block: rename.block,
      });
    } else {
      // Simple namespace
      utilityNamespaced.push({
        original: rename.original,
        renamed: rename.renamed,
      });
    }
  }

  // Build warnings
  const warnings: string[] = [];
  if (highRiskDetected.length > 0) {
    warnings.push(
      `${highRiskDetected.length} high-risk generic class name(s) were renamed to prevent Webflow collisions`
    );
  }

  // Determine status
  const status: ClassRenamingReport["status"] =
    warnings.length > 0 ? "warn" : "pass";

  return {
    status,
    summary: {
      totalClasses: mapping.size,
      renamed: actualRenames.length,
      preserved: preserved.length,
      highRiskNeutralized: highRiskDetected.length,
      jsReferencesUpdated: options.jsReplacementCount,
    },
    categories: {
      bemRenamed,
      utilityNamespaced,
      preserved: preserved,
      highRiskDetected,
    },
    warnings,
  };
}

// ============================================
// LLM CONTEXT GENERATION
// ============================================

/**
 * Build context for LLM semantic patching
 */
function buildLlmClassContext(
  renameResult: RenameGenerationResult
): LlmClassContext {
  const proposedMapping = renameResult.detailedRenames.map((rename) => ({
    original: rename.original,
    proposed: rename.renamed,
    reason: rename.reason,
  }));

  return {
    proposedMapping,
    highRiskDetected: renameResult.highRiskDetected,
    ambiguousNames: renameResult.ambiguousNames,
  };
}

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Check if BEM renaming feature is enabled
 */
export function isBemRenamingEnabled(): boolean {
  if (typeof process === "undefined") return true;
  return process.env.NEXT_PUBLIC_FLOWBRIDGE_BEM_RENAME !== "0";
}

/**
 * Get high-risk classes from a list of class names
 */
export { detectHighRiskClasses, isHighRiskClass, getHighRiskReason };
