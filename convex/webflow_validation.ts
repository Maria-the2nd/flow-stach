/**
 * Convex-compatible Webflow Payload Validation
 *
 * This module provides validation for Webflow JSON payloads within Convex mutations.
 * It detects critical issues that would corrupt Webflow Designer projects.
 *
 * CRITICAL: This prevents catastrophic Designer corruption from:
 * - Duplicate UUIDs (site-killer - makes project unrecoverable)
 * - Circular class references (causes Designer to hang)
 * - Orphaned state variants (causes "invalid keys" errors)
 * - Invalid payload structure
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface WebflowNode {
  _id: string;
  type?: string;
  tag?: string;
  classes?: string[];
  children?: string[];
  text?: boolean;
  v?: string;
  data?: Record<string, unknown>;
}

interface WebflowStyle {
  _id: string;
  name: string;
  type?: string;
  children?: string[];
  styleLess?: string;
  variants?: Record<string, unknown>;
}

interface WebflowPayload {
  type: string;
  payload: {
    nodes: WebflowNode[];
    styles: WebflowStyle[];
    assets?: unknown[];
    ix2?: unknown;
  };
  meta?: unknown;
}

export interface ValidationIssue {
  severity: "fatal" | "error" | "warning";
  code: string;
  message: string;
}

export interface PayloadValidationResult {
  isValid: boolean;
  canProceed: boolean;
  issues: ValidationIssue[];
  summary: string;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check for duplicate UUIDs in nodes and styles.
 * CRITICAL: Duplicate UUIDs will corrupt Webflow projects irreparably.
 */
function validateUniqueIds(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set<string>();
  const styleIds = new Set<string>();

  // Check node IDs
  for (const node of payload.payload.nodes) {
    if (!node._id) {
      issues.push({
        severity: "fatal",
        code: "MISSING_NODE_ID",
        message: "Node is missing _id property",
      });
      continue;
    }
    if (nodeIds.has(node._id)) {
      issues.push({
        severity: "fatal",
        code: "DUPLICATE_NODE_ID",
        message: `Duplicate node UUID: ${node._id}`,
      });
    }
    nodeIds.add(node._id);
  }

  // Check style IDs
  for (const style of payload.payload.styles) {
    if (!style._id) {
      issues.push({
        severity: "fatal",
        code: "MISSING_STYLE_ID",
        message: `Style "${style.name}" is missing _id property`,
      });
      continue;
    }
    if (styleIds.has(style._id)) {
      issues.push({
        severity: "fatal",
        code: "DUPLICATE_STYLE_ID",
        message: `Duplicate style UUID: ${style._id} (${style.name})`,
      });
    }
    styleIds.add(style._id);
  }

  return issues;
}

/**
 * Check for circular references in style children.
 * CRITICAL: Circular references cause Designer to hang and corrupt state.
 */
function validateNoCircularReferences(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const styleMap = new Map<string, WebflowStyle>();

  for (const style of payload.payload.styles) {
    styleMap.set(style._id, style);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(styleId: string, path: string[] = []): boolean {
    if (recursionStack.has(styleId)) {
      issues.push({
        severity: "fatal",
        code: "CIRCULAR_REFERENCE",
        message: `Circular reference detected: ${[...path, styleId].join(" -> ")}`,
      });
      return true;
    }

    if (visited.has(styleId)) return false;

    visited.add(styleId);
    recursionStack.add(styleId);

    const style = styleMap.get(styleId);
    if (style?.children) {
      for (const childId of style.children) {
        if (hasCycle(childId, [...path, styleId])) {
          return true;
        }
      }
    }

    recursionStack.delete(styleId);
    return false;
  }

  for (const style of payload.payload.styles) {
    hasCycle(style._id);
  }

  return issues;
}

/**
 * Check for orphaned state variants (e.g., "button:hover" without "button" base).
 */
function validateNoOrphanedStates(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const baseClassNames = new Set(
    payload.payload.styles
      .filter((s) => !s.name.includes(":"))
      .map((s) => s.name)
  );

  for (const style of payload.payload.styles) {
    if (style.name.includes(":")) {
      const baseName = style.name.split(":")[0];
      if (!baseClassNames.has(baseName)) {
        issues.push({
          severity: "error",
          code: "ORPHANED_STATE",
          message: `State variant "${style.name}" missing base class "${baseName}"`,
        });
      }
    }
  }

  return issues;
}

/**
 * Check for orphaned node references.
 */
function validateNodeReferences(payload: WebflowPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(payload.payload.nodes.map((n) => n._id));

  for (const node of payload.payload.nodes) {
    if (node.children) {
      for (const childId of node.children) {
        if (!nodeIds.has(childId)) {
          issues.push({
            severity: "error",
            code: "ORPHAN_REFERENCE",
            message: `Node ${node._id} references missing child: ${childId}`,
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Generate a UUID v4.
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Fix duplicate UUIDs by regenerating them.
 */
function fixDuplicateIds(payload: WebflowPayload): { payload: WebflowPayload; fixed: number } {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  let fixed = 0;

  const seenNodeIds = new Map<string, number>();
  const seenStyleIds = new Map<string, number>();
  const idMap = new Map<string, string>();

  // Fix duplicate node IDs
  result.payload.nodes = result.payload.nodes.map((node) => {
    const count = (seenNodeIds.get(node._id) || 0) + 1;
    seenNodeIds.set(node._id, count);

    if (count > 1) {
      const newId = generateUUID();
      idMap.set(node._id, newId);
      fixed++;
      return { ...node, _id: newId };
    }
    return node;
  });

  // Fix duplicate style IDs
  result.payload.styles = result.payload.styles.map((style) => {
    const count = (seenStyleIds.get(style._id) || 0) + 1;
    seenStyleIds.set(style._id, count);

    if (count > 1) {
      const newId = generateUUID();
      fixed++;
      return { ...style, _id: newId };
    }
    return style;
  });

  return { payload: result, fixed };
}

/**
 * Remove orphaned state variants.
 */
function removeOrphanedStates(payload: WebflowPayload): { payload: WebflowPayload; removed: number } {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;

  const baseClassNames = new Set(
    result.payload.styles.filter((s) => !s.name.includes(":")).map((s) => s.name)
  );

  const originalLength = result.payload.styles.length;
  result.payload.styles = result.payload.styles.filter((style) => {
    if (style.name.includes(":")) {
      const baseName = style.name.split(":")[0];
      return baseClassNames.has(baseName);
    }
    return true;
  });

  return { payload: result, removed: originalLength - result.payload.styles.length };
}

/**
 * Remove orphaned node references.
 */
function removeOrphanedReferences(payload: WebflowPayload): { payload: WebflowPayload; removed: number } {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  let removed = 0;

  const nodeIds = new Set(result.payload.nodes.map((n) => n._id));

  result.payload.nodes = result.payload.nodes.map((node) => {
    if (node.children) {
      const originalLength = node.children.length;
      node.children = node.children.filter((childId) => nodeIds.has(childId));
      removed += originalLength - node.children.length;
    }
    return node;
  });

  return { payload: result, removed };
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate a Webflow JSON payload.
 *
 * @param jsonString - The Webflow JSON payload as a string
 * @returns Validation result with issues and summary
 */
export function validateWebflowJson(jsonString: string): PayloadValidationResult {
  // Handle empty/placeholder payloads
  if (!jsonString || jsonString === '{"placeholder":true}') {
    return {
      isValid: false,
      canProceed: false,
      issues: [{ severity: "warning", code: "PLACEHOLDER", message: "Placeholder payload - no validation needed" }],
      summary: "Placeholder payload",
    };
  }

  let payload: WebflowPayload;
  try {
    payload = JSON.parse(jsonString) as WebflowPayload;
  } catch {
    return {
      isValid: false,
      canProceed: false,
      issues: [{ severity: "fatal", code: "INVALID_JSON", message: "Failed to parse JSON" }],
      summary: "Invalid JSON",
    };
  }

  // Check basic structure
  if (payload.type !== "@webflow/XscpData") {
    return {
      isValid: false,
      canProceed: false,
      issues: [{ severity: "fatal", code: "INVALID_TYPE", message: `Invalid payload type: ${payload.type}` }],
      summary: "Invalid payload type",
    };
  }

  if (!payload.payload?.nodes || !payload.payload?.styles) {
    return {
      isValid: false,
      canProceed: false,
      issues: [{ severity: "fatal", code: "MISSING_DATA", message: "Payload missing nodes or styles array" }],
      summary: "Missing nodes or styles",
    };
  }

  // Run all validations
  const issues: ValidationIssue[] = [
    ...validateUniqueIds(payload),
    ...validateNoCircularReferences(payload),
    ...validateNoOrphanedStates(payload),
    ...validateNodeReferences(payload),
  ];

  const hasFatal = issues.some((i) => i.severity === "fatal");
  const hasError = issues.some((i) => i.severity === "error");

  return {
    isValid: issues.length === 0,
    canProceed: !hasFatal,
    issues,
    summary: issues.length === 0
      ? "Payload is valid"
      : `${issues.filter((i) => i.severity === "fatal").length} fatal, ${issues.filter((i) => i.severity === "error").length} errors, ${issues.filter((i) => i.severity === "warning").length} warnings`,
  };
}

/**
 * Validate and sanitize a Webflow JSON payload.
 * Automatically fixes issues when possible.
 *
 * @param jsonString - The Webflow JSON payload as a string
 * @returns Sanitized JSON string and validation info
 */
export function validateAndSanitizeWebflowJson(jsonString: string): {
  sanitizedJson: string;
  validation: PayloadValidationResult;
  sanitizationApplied: boolean;
  changes: string[];
} {
  const changes: string[] = [];

  // Handle empty/placeholder payloads
  if (!jsonString || jsonString === '{"placeholder":true}') {
    return {
      sanitizedJson: jsonString,
      validation: {
        isValid: false,
        canProceed: false,
        issues: [{ severity: "warning", code: "PLACEHOLDER", message: "Placeholder payload" }],
        summary: "Placeholder payload",
      },
      sanitizationApplied: false,
      changes: [],
    };
  }

  let payload: WebflowPayload;
  try {
    payload = JSON.parse(jsonString) as WebflowPayload;
  } catch {
    return {
      sanitizedJson: jsonString,
      validation: {
        isValid: false,
        canProceed: false,
        issues: [{ severity: "fatal", code: "INVALID_JSON", message: "Failed to parse JSON" }],
        summary: "Invalid JSON",
      },
      sanitizationApplied: false,
      changes: [],
    };
  }

  // Check basic structure
  if (payload.type !== "@webflow/XscpData" || !payload.payload?.nodes || !payload.payload?.styles) {
    return {
      sanitizedJson: jsonString,
      validation: {
        isValid: false,
        canProceed: false,
        issues: [{ severity: "fatal", code: "INVALID_STRUCTURE", message: "Invalid payload structure" }],
        summary: "Invalid structure",
      },
      sanitizationApplied: false,
      changes: [],
    };
  }

  // Apply sanitization
  let current = payload;

  // Fix duplicate IDs
  const dupResult = fixDuplicateIds(current);
  current = dupResult.payload;
  if (dupResult.fixed > 0) {
    changes.push(`Fixed ${dupResult.fixed} duplicate UUID(s)`);
  }

  // Remove orphaned states
  const stateResult = removeOrphanedStates(current);
  current = stateResult.payload;
  if (stateResult.removed > 0) {
    changes.push(`Removed ${stateResult.removed} orphaned state variant(s)`);
  }

  // Remove orphaned references
  const refResult = removeOrphanedReferences(current);
  current = refResult.payload;
  if (refResult.removed > 0) {
    changes.push(`Removed ${refResult.removed} orphaned reference(s)`);
  }

  // Re-validate after sanitization
  const sanitizedJson = JSON.stringify(current);
  const validation = validateWebflowJson(sanitizedJson);

  return {
    sanitizedJson,
    validation,
    sanitizationApplied: changes.length > 0,
    changes,
  };
}
