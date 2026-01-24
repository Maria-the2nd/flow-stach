/**
 * Pre-flight Validation for Webflow Payloads
 *
 * Prevents corrupt Webflow projects by detecting critical issues BEFORE paste:
 * - Duplicate UUIDs (makes project unrecoverable)
 * - Orphan node references (children array references non-existent nodes)
 * - Circular references (parent/child loops)
 * - Malformed JSON structure
 * - Invalid styles
 */

import type { WebflowNode, WebflowStyle, WebflowPayload } from "./webflow-converter";
import type { ValidationWarning, CanvasDetectionResult } from "./js-library-detector";
import { detectCanvasWebGL, validateCanvasContainer } from "./js-library-detector";
import { validateJsHtmlXRef, hasJsDomReferences, type XRefResult } from "./js-html-xref";
import {
  detectExternalResources,
  type ExternalResourceResult,
  type ExternalResource,
} from "./external-resource-detector";
import {
  validateHTMLStructure,
  type HTMLValidationResult,
} from "./html-validator";
import {
  ValidationSeverity,
  ValidationIssue,
  fatal,
  error,
  warning,
  info,
  FatalIssueCodes,
  ErrorIssueCodes,
  WarningIssueCodes,
  InfoIssueCodes,
  createValidationResult,
  formatIssues,
  type ValidationResult,
} from "./validation-types";

// ============================================
// VALID WEBFLOW VARIANT KEYS
// ============================================

/**
 * Valid Webflow breakpoint names.
 * Only these breakpoints are supported in Webflow Designer.
 */
export const VALID_BREAKPOINTS = new Set([
  'main',     // Base/desktop (default)
  'medium',   // Tablet landscape (991px)
  'small',    // Tablet portrait (767px)
  'tiny',     // Mobile landscape (479px)
  'xl',       // Large desktop (1280px)
  'xxl',      // Extra large desktop (1440px+)
]);

/**
 * Valid CSS pseudo-state names for Webflow variants.
 * These map to :hover, :focus, etc. pseudo-classes.
 */
export const VALID_PSEUDO_STATES = new Set([
  'hover',
  'focus',
  'active',
  'visited',
  'focus-visible',
  'focus-within',
  'checked',
  'disabled',
  'placeholder',
  'selection',
]);

/**
 * All valid variant keys (breakpoints + pseudo-states).
 */
export const VALID_VARIANT_KEYS = new Set([
  ...VALID_BREAKPOINTS,
  ...VALID_PSEUDO_STATES,
]);

/**
 * Reserved Webflow class prefixes that conflict with webflow.js.
 * User-generated styles MUST NOT use these prefixes.
 */
export const RESERVED_CLASS_PREFIXES = [
  'w-',       // Core Webflow classes (w-container, w-nav, etc.)
];

/**
 * Reserved Webflow class names that are special functional classes.
 */
export const RESERVED_CLASS_NAMES = new Set([
  // Layout classes
  'w-layout-grid', 'w-layout-hflex', 'w-layout-vflex', 'w-layout-blockcontainer',
  // Container classes
  'w-container', 'w-row', 'w-col', 'w-clearfix',
  // Component classes
  'w-button', 'w-slider', 'w-slide', 'w-nav', 'w-nav-menu', 'w-nav-link',
  'w-dropdown', 'w-dropdown-toggle', 'w-dropdown-list', 'w-dropdown-link',
  'w-tab-menu', 'w-tab-link', 'w-tab-content', 'w-tab-pane',
  'w-form', 'w-input', 'w-select', 'w-checkbox', 'w-radio',
  'w-lightbox', 'w-lightbox-content',
  // Utility classes
  'w-inline-block', 'w-embed', 'w-richtext', 'w-video',
]);

// ============================================
// VALIDATION RESULT TYPES
// ============================================

export interface UUIDValidation {
  isValid: boolean;
  duplicates: string[];
  invalidFormat: string[];
}

export interface OrphanValidation {
  isValid: boolean;
  orphanReferences: Array<{ parentId: string; missingChildId: string }>;
  unreachableNodes: string[];
}

export interface CircularValidation {
  isValid: boolean;
  cycles: string[][];
}

export interface StyleValidation {
  isValid: boolean;
  invalidStyles: Array<{ className: string; property: string; value: string; reason: string }>;
  missingStyleRefs: string[];
  /** Invalid variant keys detected (e.g., invalid breakpoints or pseudo-states) */
  invalidVariantKeys: Array<{ className: string; variantKey: string }>;
  /** Reserved w- class names used by LLM (conflicts with webflow.js) */
  reservedClassNames: string[];
}

export interface EmbedSizeValidation {
  css: number;
  js: number;
  warnings: string[];
  errors: string[];
}

export interface XRefValidation {
  /** Whether the cross-reference validation passed (no orphan IDs) */
  isValid: boolean;
  /** IDs referenced in JS but not found in HTML (ERROR level) */
  orphanIds: string[];
  /** Classes referenced in JS but not found in HTML (WARNING level) */
  orphanClasses: string[];
  /** Full cross-reference result for detailed inspection */
  details?: XRefResult;
  /** Standardized validation issues */
  issues: ValidationIssue[];
}

export interface ExternalResourceValidation {
  /** Whether validation passed (no relative resources) */
  isValid: boolean;
  /** Whether there are warnings (CDN resources that need manual addition) */
  hasWarnings: boolean;
  /** Full detection result */
  result: ExternalResourceResult;
}

export interface PreflightResult {
  isValid: boolean;
  canProceed: boolean;
  uuid: UUIDValidation;
  references: OrphanValidation;
  circular: CircularValidation;
  styles: StyleValidation;
  embedSize: EmbedSizeValidation;
  /** Node depth validation - checks for excessive nesting */
  depth: DepthValidation;
  /** JS-HTML cross-reference validation (only present if JS was provided) */
  xref?: XRefValidation;
  /** External resource validation (only present if HTML was provided) */
  externalResources?: ExternalResourceValidation;
  /** HTML structure validation (only present if HTML was provided) */
  htmlStructure?: HTMLValidationResult;
  /** @deprecated Use issues and validationResult instead */
  summary: string;
  /** Standardized validation issues */
  issues: ValidationIssue[];
  /** Standardized validation result */
  validationResult: ValidationResult;
}

// ============================================
// UUID VALIDATION
// ============================================

/**
 * UUID format pattern - Webflow accepts various ID formats:
 * - Traditional hex UUIDs: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * - Short hex IDs: a1b2c3d4
 * - Prefixed alphanumeric: wf-hero-001, fp-section-123
 *
 * The key requirement is: non-empty, alphanumeric with dashes/underscores
 */
const UUID_PATTERN = /^[\w-]+$/;

/**
 * Validate all node and style UUIDs for duplicates and format issues.
 * Duplicate UUIDs cause Webflow project corruption that's often unrecoverable.
 *
 * Note: Format validation is lenient - Webflow accepts various ID formats.
 * The critical check is for duplicates, which WILL corrupt projects.
 */
export function validateUUIDs(
  nodes: WebflowNode[],
  styles: WebflowStyle[]
): UUIDValidation {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  const invalidFormat: string[] = [];

  // Guard against non-array inputs
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeStyles = Array.isArray(styles) ? styles : [];

  // Check node IDs
  for (const node of safeNodes) {
    const id = node._id;

    if (!id) {
      invalidFormat.push("(empty node ID)");
      continue;
    }

    // Check format - lenient pattern that accepts alphanumeric with dashes/underscores
    if (!UUID_PATTERN.test(id)) {
      invalidFormat.push(id);
    }

    // Check duplicates - this is the CRITICAL check
    const count = (seen.get(id) || 0) + 1;
    seen.set(id, count);
    if (count === 2) {
      duplicates.push(id);
    }
  }

  // Check style IDs (separate namespace from nodes, but still check for duplicates within styles)
  const styleSeen = new Map<string, number>();
  for (const style of safeStyles) {
    const id = style._id;

    if (!id) {
      invalidFormat.push("(empty style ID)");
      continue;
    }

    // Check format - lenient pattern for style IDs
    if (!UUID_PATTERN.test(id)) {
      invalidFormat.push(`style: ${id}`);
    }

    // Check duplicates within styles
    const count = (styleSeen.get(id) || 0) + 1;
    styleSeen.set(id, count);
    if (count === 2) {
      duplicates.push(`style: ${id}`);
    }
  }

  return {
    isValid: duplicates.length === 0 && invalidFormat.length === 0,
    duplicates,
    invalidFormat,
  };
}

// ============================================
// ORPHAN NODE DETECTION
// ============================================

/**
 * Validate that all node references are valid.
 * Detects:
 * - Children array references to non-existent nodes
 * - Unreachable nodes (not connected to root)
 */
export function validateNodeReferences(
  nodes: WebflowNode[],
  rootIds?: string[]
): OrphanValidation {
  // Guard against non-array input
  if (!Array.isArray(nodes)) {
    return { isValid: true, orphanReferences: [], unreachableNodes: [] };
  }

  const nodeMap = new Map<string, WebflowNode>();
  const reachable = new Set<string>();
  const orphanReferences: Array<{ parentId: string; missingChildId: string }> = [];

  // Build node map
  for (const node of nodes) {
    nodeMap.set(node._id, node);
  }

  // Determine root IDs - if not provided, find nodes that are not children of any other node
  let effectiveRootIds = rootIds;
  if (!effectiveRootIds || effectiveRootIds.length === 0) {
    const allChildIds = new Set<string>();
    for (const node of nodes) {
      if (Array.isArray(node.children)) {
        for (const childId of node.children) {
          allChildIds.add(childId);
        }
      }
    }
    effectiveRootIds = nodes
      .map(n => n._id)
      .filter(id => !allChildIds.has(id));
  }

  // Walk from roots, track reachable nodes
  function walk(nodeId: string, visited: Set<string>): void {
    if (visited.has(nodeId)) return; // Cycle detection
    visited.add(nodeId);
    reachable.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        if (!nodeMap.has(childId)) {
          orphanReferences.push({ parentId: nodeId, missingChildId: childId });
        } else {
          walk(childId, visited);
        }
      }
    }
  }

  for (const rootId of effectiveRootIds) {
    walk(rootId, new Set());
  }

  // Find unreachable nodes (excluding text nodes which might be leaf nodes)
  const unreachableNodes = nodes
    .map(n => n._id)
    .filter(id => !reachable.has(id));

  return {
    isValid: orphanReferences.length === 0,
    orphanReferences,
    unreachableNodes,
  };
}

// ============================================
// CIRCULAR REFERENCE DETECTION
// ============================================

/**
 * Detect circular references in node hierarchy.
 * Circular references cause infinite loops during Webflow rendering.
 *
 * Note: This function finds ALL cycles in the graph, not just the first one.
 */
export function detectCircularReferences(nodes: WebflowNode[]): CircularValidation {
  if (!Array.isArray(nodes)) {
    return { isValid: true, cycles: [] };
  }

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
  ): void {
    visited.add(nodeId);
    recStack.add(nodeId);
    path.push(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node || !Array.isArray(node.children)) {
      recStack.delete(nodeId);
      path.pop();
      return;
    }

    for (const childId of node.children) {
      if (!visited.has(childId)) {
        detectCycle(childId, path, visited, recStack);
      } else if (recStack.has(childId)) {
        // Found cycle - record it but continue to find other cycles
        const cycleStart = path.indexOf(childId);
        cycles.push([...path.slice(cycleStart), childId]);
        // Don't return - continue checking other children for more cycles
      }
    }

    recStack.delete(nodeId);
    path.pop();
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
    cycles,
  };
}

// ============================================
// STYLE VALIDATION
// ============================================

/**
 * Validate CSS snippet for common issues.
 */
function validateCSSSnippet(
  css: string
): Array<{ property: string; value: string; reason: string }> {
  const errors: Array<{ property: string; value: string; reason: string }> = [];

  if (!css) return errors;

  // Split into property: value pairs
  const declarations = css.split(";").filter(d => d.trim());

  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) continue;

    const property = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();

    if (!property || !value) {
      errors.push({
        property: property || "?",
        value: value || "?",
        reason: "Malformed declaration",
      });
      continue;
    }

    // Check for undefined/NaN values (JavaScript leak)
    if (value.includes("undefined") || value.includes("NaN")) {
      errors.push({ property, value, reason: "Contains undefined/NaN" });
    }

    // Check for unresolved template variables
    if (value.includes("{{") || value.includes("}}")) {
      errors.push({ property, value, reason: "Contains unresolved template variables" });
    }

    // Check for unresolved CSS variables (Webflow doesn't support them)
    if (value.includes("var(--")) {
      errors.push({ property, value, reason: "Contains unresolved CSS variable" });
    }

    // Check for !important (not supported in Webflow)
    if (value.includes("!important")) {
      errors.push({ property, value, reason: "Contains !important (not supported)" });
    }

    // Check for empty url() values
    if (/url\(\s*['"]?\s*['"]?\s*\)/.test(value)) {
      errors.push({ property, value, reason: "Empty url() value" });
    }

    // Check for invalid color values
    if (property.includes("color") || property.includes("background")) {
      if (value === "transparent" || value === "inherit" || value === "initial") {
        // These are valid
      } else if (value.startsWith("#") && !/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value)) {
        errors.push({ property, value, reason: "Invalid hex color format" });
      }
    }

    // Check for negative dimensions (usually errors)
    // Note: Negative margins are valid CSS, so we exclude them
    if (
      (property === "width" || property === "height" || property === "padding") &&
      value.startsWith("-")
    ) {
      errors.push({ property, value, reason: "Negative dimension value" });
    }
  }

  return errors;
}

/**
 * Check if a class name uses a reserved Webflow prefix or name.
 */
function isReservedClassName(className: string): boolean {
  // Check exact reserved names
  if (RESERVED_CLASS_NAMES.has(className)) {
    return true;
  }
  // Check reserved prefixes
  for (const prefix of RESERVED_CLASS_PREFIXES) {
    if (className.startsWith(prefix)) {
      return true;
    }
  }
  return false;
}

/**
 * Validate all styles and their references.
 */
export function validateStyles(
  styles: WebflowStyle[],
  nodes: WebflowNode[]
): StyleValidation {
  // Guard against non-array inputs
  const safeStyles = Array.isArray(styles) ? styles : [];
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  const styleMap = new Map<string, WebflowStyle>();
  const invalidStyles: Array<{ className: string; property: string; value: string; reason: string }> = [];
  const missingStyleRefs: string[] = [];
  const invalidVariantKeys: Array<{ className: string; variantKey: string }> = [];
  const reservedClassNames: string[] = [];

  // Build style map and validate styleLess
  for (const style of safeStyles) {
    styleMap.set(style.name, style);

    // CRITICAL: Check if user-generated style uses reserved w- prefix
    // This is different from node class references - these are STYLE DEFINITIONS
    if (isReservedClassName(style.name)) {
      reservedClassNames.push(style.name);
    }

    // Validate base styleLess
    if (style.styleLess) {
      const cssErrors = validateCSSSnippet(style.styleLess);
      for (const err of cssErrors) {
        invalidStyles.push({
          className: style.name,
          property: err.property,
          value: err.value,
          reason: err.reason,
        });
      }
    }

    // Validate variant styleLess AND variant keys
    if (style.variants && typeof style.variants === 'object') {
      for (const [variantKey, variant] of Object.entries(style.variants)) {
        // CRITICAL: Validate variant key against allowed breakpoints/states
        // Invalid keys cause [PersistentUIState] errors and Designer crashes
        if (!VALID_VARIANT_KEYS.has(variantKey)) {
          invalidVariantKeys.push({
            className: style.name,
            variantKey,
          });
        }

        // Validate variant styleLess content
        if (variant && variant.styleLess) {
          const variantErrors = validateCSSSnippet(variant.styleLess);
          for (const err of variantErrors) {
            invalidStyles.push({
              className: `${style.name}@${variantKey}`,
              property: err.property,
              value: err.value,
              reason: err.reason,
            });
          }
        }
      }
    }
  }

  // Check all node class references exist
  for (const node of safeNodes) {
    if (Array.isArray(node.classes)) {
      for (const classRef of node.classes) {
        // Skip Webflow built-in classes ONLY for reference checks
        // (nodes CAN reference built-in classes like w-layout-grid)
        if (isReservedClassName(classRef)) {
          // This is OK - nodes can USE Webflow classes
          // We only block DEFINING new styles with reserved names
          continue;
        }
        if (!styleMap.has(classRef)) {
          missingStyleRefs.push(`Node ${node._id} references missing style: ${classRef}`);
        }
      }
    }
  }

  // Validation passes only if all checks pass
  const isValid =
    invalidStyles.length === 0 &&
    missingStyleRefs.length === 0 &&
    invalidVariantKeys.length === 0 &&
    reservedClassNames.length === 0;

  return {
    isValid,
    invalidStyles,
    missingStyleRefs,
    invalidVariantKeys,
    reservedClassNames,
  };
}

// ============================================
// EMBED SIZE VALIDATION
// ============================================

/**
 * Validate embed sizes (CSS/JS).
 * Large embeds can fail to paste or crash Webflow.
 */
export function validateEmbedSize(
  nodes: WebflowNode[],
  cssEmbed?: string,
  jsEmbed?: string
): EmbedSizeValidation {
  // Guard against non-array input
  const safeNodes = Array.isArray(nodes) ? nodes : [];

  const warnings: string[] = [];
  const errors: string[] = [];

  const cssSize = cssEmbed?.length || 0;
  const jsSize = jsEmbed?.length || 0;

  // Check global embeds
  if (cssSize > 50000) {
    errors.push(`CSS embed exceeds 50KB (${Math.round(cssSize / 1024)}KB) - exceeds Webflow limit`);
  } else if (cssSize > 40000) {
    warnings.push(`CSS embed is large (${Math.round(cssSize / 1024)}KB) - consider splitting`);
  }

  if (jsSize > 50000) {
    errors.push(`JS embed exceeds 50KB (${Math.round(jsSize / 1024)}KB) - exceeds Webflow limit`);
  } else if (jsSize > 40000) {
    warnings.push(`JS embed is large (${Math.round(jsSize / 1024)}KB) - consider splitting`);
  }

  // Check HtmlEmbed nodes
  for (const node of safeNodes) {
    if (node.type === "HtmlEmbed") {
      const embedContent = node.data?.embed?.meta?.html || node.v || "";
      const embedSize = embedContent.length;

      if (embedSize > 50000) {
        errors.push(`HtmlEmbed node ${node._id} exceeds 50KB (${Math.round(embedSize / 1024)}KB)`);
      } else if (embedSize > 40000) {
        warnings.push(`HtmlEmbed node ${node._id} is large (${Math.round(embedSize / 1024)}KB)`);
      }
    }
  }

  return {
    css: cssSize,
    js: jsSize,
    warnings,
    errors,
  };
}

// ============================================
// NODE STRUCTURE VALIDATION
// ============================================

/**
 * Validate node structure integrity.
 */
export function validateNodeStructure(
  nodes: WebflowNode[]
): { errors: string[]; warnings: string[] } {
  // Guard against non-array input
  if (!Array.isArray(nodes)) {
    return { errors: [], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  const validTypes = new Set([
    "Block",
    "Link",
    "Image",
    "Video",
    "HtmlEmbed",
    "Heading",
    "Paragraph",
    "Section",
    "List",
    "ListItem",
  ]);

  const tagTypeMap: Record<string, string[]> = {
    h1: ["Heading", "Block"],
    h2: ["Heading", "Block"],
    h3: ["Heading", "Block"],
    h4: ["Heading", "Block"],
    h5: ["Heading", "Block"],
    h6: ["Heading", "Block"],
    p: ["Paragraph", "Block"],
    a: ["Link", "Block"],
    img: ["Image"],
    video: ["Video"],
    ul: ["List", "Block"],
    ol: ["List", "Block"],
    li: ["ListItem", "Block"],
    section: ["Block"], // NOT "Section"!
    div: ["Block"],
    nav: ["Block"],
    header: ["Block"],
    footer: ["Block"],
    span: ["Block"],
  };

  for (const node of nodes) {
    // Text nodes validation
    if (node.text === true) {
      if (typeof node.v !== "string") {
        errors.push(`Text node ${node._id} missing "v" property`);
      }
      if (Array.isArray(node.children) && node.children.length > 0) {
        errors.push(`Text node ${node._id} has children (text nodes must be leaf nodes)`);
      }
      continue;
    }

    // Type validation
    if (node.type && !validTypes.has(node.type)) {
      errors.push(`Node ${node._id} has invalid type: ${node.type}`);
    }

    // Tag/type consistency
    if (node.tag && node.type) {
      const validTypesForTag = tagTypeMap[node.tag.toLowerCase()];
      if (validTypesForTag && !validTypesForTag.includes(node.type)) {
        if (node.tag.toLowerCase() === "section" && node.type === "Section") {
          errors.push(`Node ${node._id}: tag="section" should use type="Block", not type="Section"`);
        } else {
          warnings.push(`Node ${node._id}: tag="${node.tag}" with type="${node.type}" may cause issues`);
        }
      }
    }

    // Block nodes should have tag
    if (node.type === "Block" && !node.tag) {
      warnings.push(`Block node ${node._id} missing tag attribute`);
    }

    // Image validation
    if (node.type === "Image" && !node.data?.attr?.src) {
      warnings.push(`Image node ${node._id} missing src attribute`);
    }

    // Link validation
    if (node.type === "Link" && !node.data?.link?.url) {
      warnings.push(`Link node ${node._id} missing url`);
    }

    // HtmlEmbed validation
    if (node.type === "HtmlEmbed") {
      if (!node.data?.embed?.meta?.html && !node.v) {
        warnings.push(`HtmlEmbed node ${node._id} missing embed content`);
      }
    }
  }

  return { errors, warnings };
}

// ============================================
// DEPTH VALIDATION
// ============================================

/**
 * Maximum allowed nesting depth for Webflow nodes.
 * Exceeding this limit can cause Webflow Designer to crash.
 */
export const MAX_NODE_DEPTH = 50;

export interface DepthValidation {
  isValid: boolean;
  maxDepthFound: number;
  /** Nodes that exceed the depth limit */
  deepNodes: Array<{ nodeId: string; depth: number; path: string[] }>;
}

/**
 * Validate that node hierarchy doesn't exceed maximum depth.
 * Excessive nesting (>50 levels) crashes Webflow Designer.
 */
export function validateNodeDepth(nodes: WebflowNode[]): DepthValidation {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { isValid: true, maxDepthFound: 0, deepNodes: [] };
  }

  const nodeMap = new Map<string, WebflowNode>();
  const deepNodes: Array<{ nodeId: string; depth: number; path: string[] }> = [];
  let maxDepthFound = 0;

  // Build node map
  for (const node of nodes) {
    nodeMap.set(node._id, node);
  }

  // Find root nodes (nodes that are not children of any other node)
  const childIds = new Set<string>();
  for (const node of nodes) {
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        childIds.add(childId);
      }
    }
  }
  const rootIds = nodes.map(n => n._id).filter(id => !childIds.has(id));

  // DFS to find maximum depth
  function measureDepth(nodeId: string, currentDepth: number, path: string[], visited: Set<string>): void {
    if (visited.has(nodeId)) return; // Prevent infinite loops from circular refs
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    const newPath = [...path, nodeId];

    // Track max depth
    if (currentDepth > maxDepthFound) {
      maxDepthFound = currentDepth;
    }

    // Check if this node exceeds the limit
    if (currentDepth > MAX_NODE_DEPTH) {
      deepNodes.push({
        nodeId,
        depth: currentDepth,
        path: newPath,
      });
    }

    // Recurse to children
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        measureDepth(childId, currentDepth + 1, newPath, visited);
      }
    }
  }

  // Start from each root
  for (const rootId of rootIds) {
    measureDepth(rootId, 1, [], new Set());
  }

  return {
    isValid: deepNodes.length === 0,
    maxDepthFound,
    deepNodes,
  };
}

// ============================================
// JS-HTML CROSS-REFERENCE VALIDATION
// ============================================

/**
 * Validate JavaScript DOM references against HTML targets.
 * Detects when JS references elements that don't exist in HTML.
 *
 * @param html - HTML content to validate
 * @param jsCode - JavaScript code to analyze
 * @returns XRefValidation result
 */
export function validateJsHtmlReferences(
  html: string,
  jsCode?: string
): XRefValidation {
  // If no JavaScript provided, skip validation
  if (!jsCode || !hasJsDomReferences(jsCode)) {
    return {
      isValid: true,
      orphanIds: [],
      orphanClasses: [],
      issues: [],
    };
  }

  const xrefResult = validateJsHtmlXRef(jsCode, html);

  return {
    isValid: xrefResult.isValid,
    orphanIds: xrefResult.orphanIds,
    orphanClasses: xrefResult.orphanClasses,
    details: xrefResult,
    issues: xrefResult.issues,
  };
}

// ============================================
// CANVAS/WEBGL VALIDATION
// ============================================

export interface CanvasValidation {
  hasIssues: boolean;
  warnings: ValidationWarning[];
  detection: CanvasDetectionResult;
}

/**
 * Validate canvas/WebGL requirements in HTML and JS.
 * Checks if canvas/WebGL code exists and if appropriate container elements are present.
 *
 * This should be called BEFORE converting to Webflow format to warn about missing containers.
 */
export function validateCanvasWebGLRequirements(
  html: string,
  jsCode?: string
): CanvasValidation {
  // If no JavaScript provided, skip canvas detection
  if (!jsCode) {
    return {
      hasIssues: false,
      warnings: [],
      detection: { detected: false, libraries: [], suggestedContainerId: 'canvas-container' },
    };
  }

  // Detect canvas/WebGL usage in JavaScript
  const detection = detectCanvasWebGL(jsCode);

  // Validate HTML has appropriate containers
  const warnings = validateCanvasContainer(html, detection);

  return {
    hasIssues: warnings.length > 0,
    warnings,
    detection,
  };
}

// ============================================
// GHOST VARIANT VALIDATION
// ============================================

/**
 * UUID format regex - checks for proper UUID v4 format.
 * Webflow variant keys that reference nodes should be proper UUIDs.
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID v4 format.
 */
export function isUUIDFormat(str: string): boolean {
  return UUID_V4_REGEX.test(str);
}

export interface GhostVariantValidation {
  isValid: boolean;
  ghostVariants: Array<{
    className: string;
    variantKey: string;
    styleId: string;
  }>;
}

/**
 * Validate that variant keys in styles reference valid targets.
 * Variant keys can be:
 * 1. Valid breakpoint names (main, medium, small, tiny, xl, xxl)
 * 2. Valid pseudo-state names (hover, focus, active, etc.)
 * 3. UUIDs that exist in nodes (for component overrides)
 *
 * Ghost variants reference non-existent nodes and cause Designer instability.
 */
export function validateGhostVariants(
  styles: WebflowStyle[],
  nodes: WebflowNode[]
): GhostVariantValidation {
  if (!Array.isArray(styles) || !Array.isArray(nodes)) {
    return { isValid: true, ghostVariants: [] };
  }

  const nodeIds = new Set(nodes.map(n => n._id));
  const ghostVariants: Array<{ className: string; variantKey: string; styleId: string }> = [];

  for (const style of styles) {
    if (!style.variants || typeof style.variants !== 'object') continue;

    for (const variantKey of Object.keys(style.variants)) {
      // Check if key is a valid breakpoint
      const isBreakpoint = VALID_BREAKPOINTS.has(variantKey);
      // Check if key is a valid pseudo-state
      const isState = VALID_PSEUDO_STATES.has(variantKey);
      // Check if key is a UUID format that exists in nodes (component overrides)
      const isExistingNode = isUUIDFormat(variantKey) && nodeIds.has(variantKey);

      // If none of the above, it's a ghost variant
      if (!isBreakpoint && !isState && !isExistingNode) {
        // Only flag as ghost if it looks like a UUID (component override attempt)
        // Regular invalid variant keys are already caught by validateStyles
        if (isUUIDFormat(variantKey)) {
          ghostVariants.push({
            className: style.name,
            variantKey,
            styleId: style._id,
          });
        }
      }
    }
  }

  return {
    isValid: ghostVariants.length === 0,
    ghostVariants,
  };
}

// ============================================
// INTERACTION REFERENCE VALIDATION (ix2)
// ============================================

export interface InteractionValidation {
  isValid: boolean;
  orphanTargets: Array<{
    interactionIndex: number;
    interactionName?: string;
    targetId: string;
    targetType: 'trigger' | 'action';
  }>;
}

/**
 * Extract all target IDs from an interaction object.
 * Interactions can reference nodes in triggers and actions.
 */
function extractInteractionTargetIds(interaction: unknown): string[] {
  const targets: string[] = [];

  if (!interaction || typeof interaction !== 'object') return targets;

  const obj = interaction as Record<string, unknown>;

  // Check common target locations in ix2 structure
  // Trigger targets
  if (obj.trigger && typeof obj.trigger === 'object') {
    const trigger = obj.trigger as Record<string, unknown>;
    if (typeof trigger.target === 'string') targets.push(trigger.target);
    if (typeof trigger.targetId === 'string') targets.push(trigger.targetId);
    if (typeof trigger.selector === 'string' && trigger.selector.startsWith('#')) {
      targets.push(trigger.selector.slice(1)); // Remove # prefix
    }
  }

  // Action targets in actionLists
  if (obj.actionTypeId && typeof obj.target === 'object') {
    const target = obj.target as Record<string, unknown>;
    if (typeof target.id === 'string') targets.push(target.id);
  }

  // Recursively check nested objects
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        targets.push(...extractInteractionTargetIds(item));
      }
    } else if (value && typeof value === 'object') {
      targets.push(...extractInteractionTargetIds(value));
    }
  }

  return targets;
}

/**
 * Validate that ix2 interaction references point to existing nodes.
 * Orphan interaction targets cause runtime errors in Webflow.
 */
export function validateInteractionReferences(
  payload: WebflowPayload
): InteractionValidation {
  const orphanTargets: InteractionValidation['orphanTargets'] = [];

  if (!payload?.payload?.nodes || !Array.isArray(payload.payload.nodes)) {
    return { isValid: true, orphanTargets };
  }

  const nodeIds = new Set(payload.payload.nodes.map(n => n._id));

  // Check ix2 interactions
  const ix2 = payload.payload.ix2;
  if (ix2?.interactions && Array.isArray(ix2.interactions)) {
    ix2.interactions.forEach((interaction, idx) => {
      const targets = extractInteractionTargetIds(interaction);
      const interactionObj = interaction as Record<string, unknown>;

      for (const targetId of targets) {
        // Only check if targetId looks like a node reference (UUID-like)
        if (targetId && !nodeIds.has(targetId) && isUUIDFormat(targetId)) {
          orphanTargets.push({
            interactionIndex: idx,
            interactionName: typeof interactionObj.name === 'string' ? interactionObj.name : undefined,
            targetId,
            targetType: 'trigger',
          });
        }
      }
    });
  }

  // Check ix2 events
  if (ix2?.events && Array.isArray(ix2.events)) {
    for (const event of ix2.events) {
      const targets = extractInteractionTargetIds(event);
      for (const targetId of targets) {
        if (targetId && !nodeIds.has(targetId) && isUUIDFormat(targetId)) {
          orphanTargets.push({
            interactionIndex: -1,
            targetId,
            targetType: 'trigger',
          });
        }
      }
    }
  }

  // Check actionLists
  if (ix2?.actionLists && Array.isArray(ix2.actionLists)) {
    for (const actionList of ix2.actionLists) {
      const targets = extractInteractionTargetIds(actionList);
      for (const targetId of targets) {
        if (targetId && !nodeIds.has(targetId) && isUUIDFormat(targetId)) {
          orphanTargets.push({
            interactionIndex: -1,
            targetId,
            targetType: 'action',
          });
        }
      }
    }
  }

  return {
    isValid: orphanTargets.length === 0,
    orphanTargets,
  };
}

// ============================================
// ASSET REFERENCE VALIDATION
// ============================================

export interface AssetValidation {
  isValid: boolean;
  orphanAssets: Array<{
    nodeId: string;
    assetId: string;
    assetType: 'image' | 'video' | 'other';
  }>;
}

/**
 * Validate that asset references in nodes point to existing assets.
 */
export function validateAssetReferences(
  payload: WebflowPayload
): AssetValidation {
  const orphanAssets: AssetValidation['orphanAssets'] = [];

  if (!payload?.payload?.nodes || !Array.isArray(payload.payload.nodes)) {
    return { isValid: true, orphanAssets };
  }

  // Build asset ID set
  const assetIds = new Set<string>();
  if (Array.isArray(payload.payload.assets)) {
    for (const asset of payload.payload.assets) {
      if (asset && typeof asset === 'object' && '_id' in asset) {
        assetIds.add((asset as { _id: string })._id);
      }
    }
  }

  // Skip validation if no assets are defined (common case)
  if (assetIds.size === 0) {
    return { isValid: true, orphanAssets };
  }

  // Check node asset references
  for (const node of payload.payload.nodes) {
    const data = node.data as Record<string, unknown> | undefined;

    // Check direct asset reference
    if (data?.asset && typeof data.asset === 'string') {
      if (!assetIds.has(data.asset)) {
        orphanAssets.push({
          nodeId: node._id,
          assetId: data.asset,
          assetType: node.type === 'Image' ? 'image' : node.type === 'Video' ? 'video' : 'other',
        });
      }
    }

    // Check attr.src that might reference assets
    if (data?.attr && typeof data.attr === 'object') {
      const attr = data.attr as Record<string, unknown>;
      if (typeof attr.src === 'string' && attr.src.startsWith('asset://')) {
        const assetRef = attr.src.replace('asset://', '');
        if (!assetIds.has(assetRef)) {
          orphanAssets.push({
            nodeId: node._id,
            assetId: assetRef,
            assetType: 'image',
          });
        }
      }
    }
  }

  return {
    isValid: orphanAssets.length === 0,
    orphanAssets,
  };
}

// ============================================
// CHILDREN REFERENCE VALIDATION
// ============================================

export interface ChildrenValidation {
  isValid: boolean;
  orphanChildren: Array<{
    parentId: string;
    missingChildId: string;
  }>;
}

/**
 * Validate that all children references in nodes point to existing nodes.
 * This is FATAL - orphan children WILL crash Designer.
 */
export function validateChildrenReferences(
  nodes: WebflowNode[]
): ChildrenValidation {
  if (!Array.isArray(nodes)) {
    return { isValid: true, orphanChildren: [] };
  }

  const nodeIds = new Set(nodes.map(n => n._id));
  const orphanChildren: ChildrenValidation['orphanChildren'] = [];

  for (const node of nodes) {
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        if (!nodeIds.has(childId)) {
          orphanChildren.push({
            parentId: node._id,
            missingChildId: childId,
          });
        }
      }
    }
  }

  return {
    isValid: orphanChildren.length === 0,
    orphanChildren,
  };
}

// ============================================
// COMPONENT VARIANT VALIDATION
// ============================================

export interface ComponentValidation {
  isValid: boolean;
  issues: string[];
}

/**
 * Validate component structures and their variants.
 * Components may have nested structures that need recursive validation.
 */
export function validateComponentStructure(
  payload: WebflowPayload
): ComponentValidation {
  const issues: string[] = [];

  // Check for components array if present
  const components = (payload.payload as Record<string, unknown>).components;
  if (!components || !Array.isArray(components)) {
    return { isValid: true, issues };
  }

  // Validate each component
  for (const component of components) {
    if (!component || typeof component !== 'object') continue;

    const comp = component as Record<string, unknown>;

    // Check component has required fields
    if (!comp._id) {
      issues.push('Component missing _id');
    }

    // Check component nodes if present
    if (comp.nodes && Array.isArray(comp.nodes)) {
      const childrenResult = validateChildrenReferences(comp.nodes as WebflowNode[]);
      if (!childrenResult.isValid) {
        for (const orphan of childrenResult.orphanChildren) {
          issues.push(`Component ${comp._id}: node ${orphan.parentId} references missing child ${orphan.missingChildId}`);
        }
      }
    }

    // Check component styles if present
    if (comp.styles && Array.isArray(comp.styles)) {
      const ghostResult = validateGhostVariants(
        comp.styles as WebflowStyle[],
        (comp.nodes as WebflowNode[]) || []
      );
      if (!ghostResult.isValid) {
        for (const ghost of ghostResult.ghostVariants) {
          issues.push(`Component ${comp._id}: style ${ghost.className} has ghost variant ${ghost.variantKey}`);
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

// ============================================
// MASTER VALIDATION FUNCTION
// ============================================

/**
 * Generate validation summary string.
 */
function generateValidationSummary(
  criticalFailures: string[],
  styles: StyleValidation,
  embedSize: EmbedSizeValidation,
  nodeStructure: { errors: string[]; warnings: string[] },
  xref?: XRefValidation,
  externalResources?: ExternalResourceValidation
): string {
  const lines: string[] = [];

  if (criticalFailures.length > 0) {
    lines.push("CRITICAL FAILURES (paste will corrupt project):");
    lines.push(...criticalFailures.map(f => `   - ${f}`));
  }

  if (nodeStructure.errors.length > 0) {
    lines.push("NODE STRUCTURE ERRORS:");
    lines.push(...nodeStructure.errors.slice(0, 5).map(e => `   - ${e}`));
    if (nodeStructure.errors.length > 5) {
      lines.push(`   ... and ${nodeStructure.errors.length - 5} more`);
    }
  }

  if (embedSize.errors.length > 0) {
    lines.push("EMBED SIZE ERRORS:");
    lines.push(...embedSize.errors.map(e => `   - ${e}`));
  }

  if (!styles.isValid) {
    lines.push("STYLE WARNINGS:");
    lines.push(
      ...styles.invalidStyles.slice(0, 5).map(
        s => `   - ${s.className}: ${s.property} = ${s.value} (${s.reason})`
      )
    );
    if (styles.invalidStyles.length > 5) {
      lines.push(`   ... and ${styles.invalidStyles.length - 5} more`);
    }
  }

  if (styles.missingStyleRefs.length > 0) {
    lines.push("MISSING STYLE REFERENCES:");
    lines.push(...styles.missingStyleRefs.slice(0, 5).map(r => `   - ${r}`));
    if (styles.missingStyleRefs.length > 5) {
      lines.push(`   ... and ${styles.missingStyleRefs.length - 5} more`);
    }
  }

  if (embedSize.warnings.length > 0) {
    lines.push("EMBED SIZE WARNINGS:");
    lines.push(...embedSize.warnings.map(w => `   - ${w}`));
  }

  if (nodeStructure.warnings.length > 0) {
    lines.push("NODE WARNINGS:");
    lines.push(...nodeStructure.warnings.slice(0, 5).map(w => `   - ${w}`));
    if (nodeStructure.warnings.length > 5) {
      lines.push(`   ... and ${nodeStructure.warnings.length - 5} more`);
    }
  }

  // Add xref warnings (orphan classes are warnings, not errors)
  if (xref && xref.orphanClasses.length > 0) {
    lines.push("JS-HTML CROSS-REFERENCE WARNINGS:");
    lines.push(`   JS references ${xref.orphanClasses.length} CSS class(es) not found in HTML:`);
    lines.push(...xref.orphanClasses.slice(0, 5).map(c => `   - .${c}`));
    if (xref.orphanClasses.length > 5) {
      lines.push(`   ... and ${xref.orphanClasses.length - 5} more`);
    }
  }

  // Add external resource warnings (CDN resources that need manual addition)
  if (externalResources && externalResources.hasWarnings) {
    const cdnResources = externalResources.result.all.filter(r => !r.isRelative);
    if (cdnResources.length > 0) {
      lines.push("EXTERNAL RESOURCE WARNINGS:");
      lines.push(`   ${cdnResources.length} external resource(s) need manual addition to Webflow:`);
      lines.push(...cdnResources.slice(0, 5).map(r => `   - ${r.type === 'stylesheet' ? 'CSS' : 'JS'}: ${r.url}`));
      if (cdnResources.length > 5) {
        lines.push(`   ... and ${cdnResources.length - 5} more`);
      }
    }
  }

  if (lines.length === 0) {
    lines.push("All validations passed");
  }

  return lines.join("\n");
}

/**
 * Create a failed preflight result for invalid payload structure.
 */
function createFailedPreflightResult(reason: string): PreflightResult {
  const fatalIssue = fatal(FatalIssueCodes.INVALID_PAYLOAD, reason);
  const issues = [fatalIssue];
  return {
    isValid: false,
    canProceed: false,
    uuid: { isValid: false, duplicates: [], invalidFormat: [] },
    references: { isValid: false, orphanReferences: [], unreachableNodes: [] },
    circular: { isValid: true, cycles: [] },
    styles: { isValid: true, invalidStyles: [], missingStyleRefs: [], invalidVariantKeys: [], reservedClassNames: [] },
    embedSize: { css: 0, js: 0, warnings: [], errors: [] },
    depth: { isValid: true, maxDepthFound: 0, deepNodes: [] },
    summary: `CRITICAL FAILURES (paste will corrupt project):\n   - ${reason}`,
    issues,
    validationResult: createValidationResult(issues),
  };
}

/**
 * Run all pre-flight validations on a Webflow payload.
 * Call this BEFORE allowing paste to prevent project corruption.
 */
export function runPreflightValidation(
  payload: WebflowPayload,
  options: {
    cssEmbed?: string;
    jsEmbed?: string;
    /** HTML content for JS-HTML cross-reference validation */
    html?: string;
    /** JavaScript code for JS-HTML cross-reference validation */
    jsCode?: string;
  } = {}
): PreflightResult {
  // Defensive validation of payload structure
  if (!payload || typeof payload !== "object") {
    return createFailedPreflightResult("Invalid payload: expected object");
  }
  if (!payload.payload || typeof payload.payload !== "object") {
    return createFailedPreflightResult("Invalid payload: missing payload property");
  }

  const { nodes, styles } = payload.payload;

  if (!Array.isArray(nodes)) {
    return createFailedPreflightResult("Invalid payload: nodes must be an array");
  }
  if (!Array.isArray(styles)) {
    return createFailedPreflightResult("Invalid payload: styles must be an array");
  }

  const { cssEmbed, jsEmbed, html, jsCode } = options;

  // Run all validations
  const uuid = validateUUIDs(nodes, styles);
  const references = validateNodeReferences(nodes);
  const circular = detectCircularReferences(nodes);
  const styleValidation = validateStyles(styles, nodes);
  const embedSize = validateEmbedSize(nodes, cssEmbed, jsEmbed);
  const nodeStructure = validateNodeStructure(nodes);
  const depthValidation = validateNodeDepth(nodes);

  // NEW: Ghost variant validation
  const ghostVariantValidation = validateGhostVariants(styles, nodes);

  // NEW: Children reference validation (more thorough than orphan detection)
  const childrenValidation = validateChildrenReferences(nodes);

  // NEW: Interaction reference validation
  const interactionValidation = validateInteractionReferences(payload);

  // NEW: Asset reference validation
  const assetValidation = validateAssetReferences(payload);

  // NEW: Component structure validation
  const componentValidation = validateComponentStructure(payload);

  // Run JS-HTML cross-reference validation if HTML and JS are provided
  let xref: XRefValidation | undefined;
  if (html && jsCode) {
    xref = validateJsHtmlReferences(html, jsCode);
  }

  // Run external resource validation if HTML is provided
  let externalResources: ExternalResourceValidation | undefined;
  if (html) {
    const resourceResult = detectExternalResources(html);
    externalResources = {
      isValid: !resourceResult.hasErrors,
      hasWarnings: resourceResult.hasWarnings,
      result: resourceResult,
    };
  }

  // Run HTML structure validation if HTML is provided
  let htmlStructure: HTMLValidationResult | undefined;
  if (html) {
    htmlStructure = validateHTMLStructure(html);
  }

  // Collect standardized validation issues
  const issues: ValidationIssue[] = [];

  // Collect critical failures that MUST block (for legacy summary)
  const criticalFailures: string[] = [];

  // FATAL: Duplicate UUIDs
  if (uuid.duplicates.length > 0) {
    for (const dupId of uuid.duplicates) {
      issues.push(fatal(
        FatalIssueCodes.DUPLICATE_UUID,
        `Duplicate UUID detected: ${dupId}`,
        { context: dupId, suggestion: 'Regenerate node IDs to fix duplicate UUID issues' }
      ));
    }
    criticalFailures.push(`Duplicate UUIDs detected: ${uuid.duplicates.slice(0, 3).join(", ")}${uuid.duplicates.length > 3 ? "..." : ""}`);
  }

  // ERROR: Invalid UUID format
  if (uuid.invalidFormat.length > 0) {
    for (const invalidId of uuid.invalidFormat) {
      issues.push(error(
        ErrorIssueCodes.INVALID_UUID_FORMAT,
        `Invalid UUID format: ${invalidId}`,
        { context: invalidId, suggestion: 'Use alphanumeric IDs with dashes/underscores' }
      ));
    }
    criticalFailures.push(`Invalid UUID format: ${uuid.invalidFormat.slice(0, 3).join(", ")}${uuid.invalidFormat.length > 3 ? "..." : ""}`);
  }

  // FATAL: Circular references
  if (!circular.isValid) {
    for (const cycle of circular.cycles) {
      issues.push(fatal(
        FatalIssueCodes.CIRCULAR_REFERENCE,
        `Circular reference detected: ${cycle.join(" -> ")}`,
        { context: cycle.join(" -> "), suggestion: 'Check parent-child relationships for circular dependencies' }
      ));
    }
    criticalFailures.push(`Circular references detected: ${circular.cycles.length} cycle(s)`);
  }

  // ERROR: Orphan node references
  if (references.orphanReferences.length > 0) {
    for (const ref of references.orphanReferences) {
      issues.push(error(
        ErrorIssueCodes.ORPHAN_REFERENCE,
        `Node ${ref.parentId} references missing child ${ref.missingChildId}`,
        { context: `${ref.parentId} -> ${ref.missingChildId}`, suggestion: 'Ensure all child references point to existing nodes' }
      ));
    }
    criticalFailures.push(`Orphan node references: ${references.orphanReferences.length} missing`);
  }

  // WARNING: Unreachable nodes
  if (references.unreachableNodes.length > 0) {
    for (const nodeId of references.unreachableNodes) {
      issues.push(warning(
        WarningIssueCodes.UNREACHABLE_NODE,
        `Node ${nodeId} is not reachable from any root`,
        { context: nodeId }
      ));
    }
  }

  // ERROR: Node structure errors
  if (nodeStructure.errors.length > 0) {
    for (const err of nodeStructure.errors) {
      issues.push(error(
        ErrorIssueCodes.NODE_STRUCTURE_ERROR,
        err,
      ));
    }
    criticalFailures.push(`Node structure errors: ${nodeStructure.errors.length} errors`);
  }

  // WARNING: Node structure warnings
  if (nodeStructure.warnings.length > 0) {
    for (const warn of nodeStructure.warnings) {
      issues.push(warning(
        WarningIssueCodes.NODE_STRUCTURE_WARNING,
        warn,
      ));
    }
  }

  // ERROR: Embed size exceeded
  if (embedSize.errors.length > 0) {
    for (const err of embedSize.errors) {
      issues.push(error(
        ErrorIssueCodes.EMBED_SIZE_EXCEEDED,
        err,
        { suggestion: 'Consider splitting large embeds into smaller chunks' }
      ));
    }
    criticalFailures.push(...embedSize.errors);
  }

  // WARNING: Large embed size
  if (embedSize.warnings.length > 0) {
    for (const warn of embedSize.warnings) {
      issues.push(warning(
        WarningIssueCodes.EMBED_SIZE_LARGE,
        warn,
        { suggestion: 'Consider optimizing or splitting the embed' }
      ));
    }
  }

  // WARNING: Invalid styles
  if (styleValidation.invalidStyles.length > 0) {
    for (const s of styleValidation.invalidStyles) {
      issues.push(warning(
        WarningIssueCodes.INVALID_STYLE,
        `${s.className}: ${s.property} = ${s.value} (${s.reason})`,
        { context: s.className }
      ));
    }
  }

  // WARNING: Missing style references
  if (styleValidation.missingStyleRefs.length > 0) {
    for (const ref of styleValidation.missingStyleRefs) {
      issues.push(warning(
        WarningIssueCodes.MISSING_STYLE_REF,
        ref,
      ));
    }
  }

  // ERROR: Invalid variant keys (causes [PersistentUIState] crash in Webflow Designer)
  if (styleValidation.invalidVariantKeys.length > 0) {
    for (const { className, variantKey } of styleValidation.invalidVariantKeys) {
      issues.push(error(
        ErrorIssueCodes.INVALID_VARIANT_KEY,
        `Style "${className}" has invalid variant key "${variantKey}"`,
        {
          context: `${className}@${variantKey}`,
          suggestion: `Use valid breakpoints (${Array.from(VALID_BREAKPOINTS).join(', ')}) or states (${Array.from(VALID_PSEUDO_STATES).slice(0, 4).join(', ')}...)`
        }
      ));
    }
    criticalFailures.push(`Invalid variant keys: ${styleValidation.invalidVariantKeys.length} invalid key(s) - will cause [PersistentUIState] crash`);
  }

  // ERROR: Reserved Webflow class names (conflicts with webflow.js)
  if (styleValidation.reservedClassNames.length > 0) {
    for (const className of styleValidation.reservedClassNames) {
      issues.push(error(
        ErrorIssueCodes.RESERVED_CLASS_NAME,
        `Style "${className}" uses reserved Webflow class name`,
        {
          context: className,
          suggestion: 'Rename the class to not start with "w-" - this prefix is reserved for Webflow\'s internal classes'
        }
      ));
    }
    criticalFailures.push(`Reserved class names: ${styleValidation.reservedClassNames.slice(0, 3).join(', ')}${styleValidation.reservedClassNames.length > 3 ? '...' : ''}`);
  }

  // ERROR: Ghost variant keys (references non-existent nodes)
  if (!ghostVariantValidation.isValid) {
    for (const ghost of ghostVariantValidation.ghostVariants) {
      issues.push(error(
        ErrorIssueCodes.GHOST_VARIANT_KEY,
        `Style "${ghost.className}" has variant key "${ghost.variantKey}" that references non-existent node`,
        {
          context: `${ghost.className}@${ghost.variantKey}`,
          suggestion: 'This variant key appears to be a component override for a node that doesn\'t exist. It will be stripped during sanitization.'
        }
      ));
    }
    criticalFailures.push(`Ghost variant keys: ${ghostVariantValidation.ghostVariants.length} variant(s) reference non-existent nodes`);
  }

  // FATAL: Orphan children references (crashes Designer)
  if (!childrenValidation.isValid) {
    for (const orphan of childrenValidation.orphanChildren) {
      issues.push(fatal(
        FatalIssueCodes.CIRCULAR_REFERENCE, // Using circular as closest match for FATAL orphan
        `Node "${orphan.parentId}" has child "${orphan.missingChildId}" that doesn't exist`,
        {
          context: `${orphan.parentId} -> ${orphan.missingChildId}`,
          suggestion: 'This will crash Webflow Designer. The missing child reference will be removed during sanitization.'
        }
      ));
    }
    criticalFailures.push(`Orphan children: ${childrenValidation.orphanChildren.length} node(s) reference missing children - WILL CRASH DESIGNER`);
  }

  // ERROR: Orphan interaction targets
  if (!interactionValidation.isValid) {
    for (const orphan of interactionValidation.orphanTargets) {
      issues.push(error(
        ErrorIssueCodes.ORPHAN_INTERACTION_TARGET,
        `Interaction ${orphan.interactionName || `#${orphan.interactionIndex}`} references non-existent node: "${orphan.targetId}"`,
        {
          context: `ix2.${orphan.targetType}:${orphan.targetId}`,
          suggestion: 'This interaction will be extracted to jsEmbed as GSAP code since the target node doesn\'t exist.'
        }
      ));
    }
    criticalFailures.push(`Orphan interaction targets: ${interactionValidation.orphanTargets.length} interaction(s) reference missing nodes`);
  }

  // WARNING: Orphan asset references (non-critical but should be noted)
  if (!assetValidation.isValid) {
    for (const orphan of assetValidation.orphanAssets) {
      issues.push(warning(
        WarningIssueCodes.ORPHAN_ASSET_WARNING,
        `Node "${orphan.nodeId}" references non-existent ${orphan.assetType} asset: "${orphan.assetId}"`,
        {
          context: `${orphan.nodeId}:${orphan.assetId}`,
          suggestion: 'The asset reference will be cleared. You may need to re-upload the asset in Webflow.'
        }
      ));
    }
  }

  // ERROR: Component structure issues
  if (!componentValidation.isValid) {
    for (const issue of componentValidation.issues) {
      issues.push(error(
        ErrorIssueCodes.NODE_STRUCTURE_ERROR,
        issue,
        {
          suggestion: 'Component structure issues may cause paste failures. Consider simplifying the component.'
        }
      ));
    }
    criticalFailures.push(`Component issues: ${componentValidation.issues.length} structural problem(s)`);
  }

  // FATAL: Excessive nesting depth (causes Webflow Designer crash)
  if (!depthValidation.isValid) {
    for (const deepNode of depthValidation.deepNodes) {
      issues.push(fatal(
        FatalIssueCodes.EXCESSIVE_DEPTH,
        `Node "${deepNode.nodeId}" exceeds maximum depth (${deepNode.depth} > ${MAX_NODE_DEPTH})`,
        {
          context: `Depth: ${deepNode.depth}, Path: ${deepNode.path.slice(-5).join(' -> ')}`,
          suggestion: 'Flatten the HTML structure - Webflow Designer crashes with deeply nested elements'
        }
      ));
    }
    criticalFailures.push(`Excessive nesting: ${depthValidation.deepNodes.length} node(s) exceed ${MAX_NODE_DEPTH} levels - max depth found: ${depthValidation.maxDepthFound}`);
  }

  // Include xref issues (ERROR and WARNING levels)
  if (xref) {
    // Add issues from xref (already standardized)
    issues.push(...(xref.details?.issues || []));

    // Legacy: Add to criticalFailures if orphan IDs exist
    if (xref.orphanIds.length > 0) {
      criticalFailures.push(`JS references ${xref.orphanIds.length} missing HTML ID(s): ${xref.orphanIds.slice(0, 3).join(", ")}${xref.orphanIds.length > 3 ? "..." : ""}`);
    }
  }

  // Include external resource issues
  if (externalResources) {
    issues.push(...externalResources.result.issues);

    // Legacy: Add to criticalFailures if relative resources exist
    if (!externalResources.isValid) {
      const relativeResources = externalResources.result.all.filter(r => r.isRelative);
      criticalFailures.push(`${relativeResources.length} relative resource(s) cannot be loaded: ${relativeResources.slice(0, 3).map(r => r.url).join(", ")}${relativeResources.length > 3 ? "..." : ""}`);
    }
  }

  // Include HTML structure issues
  if (htmlStructure) {
    issues.push(...htmlStructure.issues);

    // Legacy: Add to criticalFailures if nested forms exist
    if (htmlStructure.errors.length > 0) {
      criticalFailures.push(`HTML structure errors: ${htmlStructure.errors.length} issue(s)`);
    }
  }

  const validationResult = createValidationResult(issues);
  const isValid = validationResult.isValid;
  const canProceed = validationResult.canProceed;

  return {
    isValid,
    canProceed,
    uuid,
    references,
    circular,
    styles: styleValidation,
    embedSize,
    depth: depthValidation,
    xref,
    externalResources,
    htmlStructure,
    summary: generateValidationSummary(criticalFailures, styleValidation, embedSize, nodeStructure, xref, externalResources),
    issues,
    validationResult,
  };
}

/**
 * Quick validation check - returns true if payload is safe to paste.
 * Use this for fast checks; use runPreflightValidation for detailed results.
 *
 * Note: Returns false for malformed payloads that cause validation errors.
 */
export function isPayloadSafe(payload: WebflowPayload): boolean {
  try {
    const result = runPreflightValidation(payload);
    return result.canProceed;
  } catch (error) {
    // Malformed payloads that throw are not safe to paste
    console.error("[preflight-validator] isPayloadSafe failed:", error);
    return false;
  }
}

/**
 * Format preflight result for display.
 */
export function formatPreflightResult(result: PreflightResult): string {
  const lines: string[] = [];

  if (result.canProceed) {
    if (result.isValid) {
      lines.push("Pre-flight Check: PASSED");
    } else {
      lines.push("Pre-flight Check: PASSED WITH WARNINGS");
    }
  } else {
    lines.push("Pre-flight Check: BLOCKED");
    lines.push("Critical issues must be fixed before pasting.");
  }

  lines.push("");
  lines.push(result.summary);

  return lines.join("\n");
}

// ============================================
// RE-EXPORTS FROM EXTERNAL RESOURCE DETECTOR
// ============================================

export {
  detectExternalResources,
  getRelativeResources,
  getCDNResources,
  getStylesheetWarnings,
  getScriptWarnings,
  hasBlockingResourceIssues,
  getAllResourceMessages,
  generateResourceInstructions,
  filterAutoDetectedScripts,
} from "./external-resource-detector";

export type {
  ExternalResource,
  ExternalResourceResult,
} from "./external-resource-detector";

// ============================================
// RE-EXPORTS FROM HTML VALIDATOR
// ============================================

export {
  validateHTMLStructure,
  detectNestedForms,
  detectMissingAlt,
  detectEmptyLinks,
  detectInvalidNesting,
  detectDeprecatedElements,
} from "./html-validator";

export type {
  HTMLValidationResult,
} from "./html-validator";

// Re-export validation types for convenience
export {
  ValidationSeverity,
  FatalIssueCodes,
  ErrorIssueCodes,
  WarningIssueCodes,
  InfoIssueCodes,
  createIssue,
  fatal,
  error,
  warning,
  info,
  hasBlockingIssues,
  hasFailureIssues,
  getIssuesBySeverity,
  getFatalIssues,
  getErrorIssues,
  getWarningIssues,
  getInfoIssues,
  countBySeverity,
  createValidationResult,
  formatIssues,
  sortBySeverity,
  mergeValidationResults,
} from "./validation-types";

export type {
  ValidationIssue,
  ValidationResult,
} from "./validation-types";
