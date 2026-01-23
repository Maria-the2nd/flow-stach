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
}

export interface EmbedSizeValidation {
  css: number;
  js: number;
  warnings: string[];
  errors: string[];
}

export interface PreflightResult {
  isValid: boolean;
  canProceed: boolean;
  uuid: UUIDValidation;
  references: OrphanValidation;
  circular: CircularValidation;
  styles: StyleValidation;
  embedSize: EmbedSizeValidation;
  summary: string;
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

  // Build style map and validate styleLess
  for (const style of safeStyles) {
    styleMap.set(style.name, style);

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

    // Validate variant styleLess
    for (const [variantName, variant] of Object.entries(style.variants)) {
      if (variant.styleLess) {
        const variantErrors = validateCSSSnippet(variant.styleLess);
        for (const err of variantErrors) {
          invalidStyles.push({
            className: `${style.name}@${variantName}`,
            property: err.property,
            value: err.value,
            reason: err.reason,
          });
        }
      }
    }
  }

  // Check all node class references exist
  for (const node of safeNodes) {
    if (Array.isArray(node.classes)) {
      for (const classRef of node.classes) {
        // Skip Webflow built-in classes
        if (classRef.startsWith("w-") || classRef === "w-layout-grid") {
          continue;
        }
        if (!styleMap.has(classRef)) {
          missingStyleRefs.push(`Node ${node._id} references missing style: ${classRef}`);
        }
      }
    }
  }

  return {
    isValid: invalidStyles.length === 0 && missingStyleRefs.length === 0,
    invalidStyles,
    missingStyleRefs,
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
  if (cssSize > 100000) {
    errors.push(`CSS embed exceeds 100KB (${Math.round(cssSize / 1024)}KB) - may fail to paste`);
  } else if (cssSize > 10000) {
    warnings.push(`CSS embed exceeds 10KB (${Math.round(cssSize / 1024)}KB) - consider optimization`);
  }

  if (jsSize > 100000) {
    errors.push(`JS embed exceeds 100KB (${Math.round(jsSize / 1024)}KB) - may fail to paste`);
  } else if (jsSize > 10000) {
    warnings.push(`JS embed exceeds 10KB (${Math.round(jsSize / 1024)}KB) - consider optimization`);
  }

  // Check HtmlEmbed nodes
  for (const node of safeNodes) {
    if (node.type === "HtmlEmbed") {
      const embedContent = node.data?.embed?.meta?.html || node.v || "";
      const embedSize = embedContent.length;

      if (embedSize > 100000) {
        errors.push(`HtmlEmbed node ${node._id} exceeds 100KB (${Math.round(embedSize / 1024)}KB)`);
      } else if (embedSize > 10000) {
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
// MASTER VALIDATION FUNCTION
// ============================================

/**
 * Generate validation summary string.
 */
function generateValidationSummary(
  criticalFailures: string[],
  styles: StyleValidation,
  embedSize: EmbedSizeValidation,
  nodeStructure: { errors: string[]; warnings: string[] }
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

  if (lines.length === 0) {
    lines.push("All validations passed");
  }

  return lines.join("\n");
}

/**
 * Create a failed preflight result for invalid payload structure.
 */
function createFailedPreflightResult(reason: string): PreflightResult {
  return {
    isValid: false,
    canProceed: false,
    uuid: { isValid: false, duplicates: [], invalidFormat: [] },
    references: { isValid: false, orphanReferences: [], unreachableNodes: [] },
    circular: { isValid: true, cycles: [] },
    styles: { isValid: true, invalidStyles: [], missingStyleRefs: [] },
    embedSize: { css: 0, js: 0, warnings: [], errors: [] },
    summary: `CRITICAL FAILURES (paste will corrupt project):\n   - ${reason}`,
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

  const { cssEmbed, jsEmbed } = options;

  // Run all validations
  const uuid = validateUUIDs(nodes, styles);
  const references = validateNodeReferences(nodes);
  const circular = detectCircularReferences(nodes);
  const styleValidation = validateStyles(styles, nodes);
  const embedSize = validateEmbedSize(nodes, cssEmbed, jsEmbed);
  const nodeStructure = validateNodeStructure(nodes);

  // Collect critical failures that MUST block
  const criticalFailures: string[] = [];

  if (!uuid.isValid) {
    if (uuid.duplicates.length > 0) {
      criticalFailures.push(`Duplicate UUIDs detected: ${uuid.duplicates.slice(0, 3).join(", ")}${uuid.duplicates.length > 3 ? "..." : ""}`);
    }
    if (uuid.invalidFormat.length > 0) {
      criticalFailures.push(`Invalid UUID format: ${uuid.invalidFormat.slice(0, 3).join(", ")}${uuid.invalidFormat.length > 3 ? "..." : ""}`);
    }
  }

  if (!circular.isValid) {
    criticalFailures.push(`Circular references detected: ${circular.cycles.length} cycle(s)`);
  }

  if (references.orphanReferences.length > 0) {
    criticalFailures.push(`Orphan node references: ${references.orphanReferences.length} missing`);
  }

  if (nodeStructure.errors.length > 0) {
    criticalFailures.push(`Node structure errors: ${nodeStructure.errors.length} errors`);
  }

  if (embedSize.errors.length > 0) {
    criticalFailures.push(...embedSize.errors);
  }

  const isValid = criticalFailures.length === 0 && styleValidation.isValid;
  const canProceed = criticalFailures.length === 0;

  return {
    isValid,
    canProceed,
    uuid,
    references,
    circular,
    styles: styleValidation,
    embedSize,
    summary: generateValidationSummary(criticalFailures, styleValidation, embedSize, nodeStructure),
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
