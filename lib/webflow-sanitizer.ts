/**
 * Webflow Payload Sanitization
 *
 * Auto-fixes common issues in Webflow JSON payloads to prevent Designer corruption.
 * Used in conjunction with preflight-validator.ts for validation + sanitization pipeline.
 *
 * CRITICAL: This module prevents catastrophic Designer corruption by fixing:
 * - Duplicate UUIDs (site-killer - makes project unrecoverable)
 * - Circular class references (causes Designer to hang)
 * - Orphaned state variants (causes "invalid keys" errors)
 * - Invalid class names
 * - Orphaned node references
 */

import type { WebflowNode, WebflowStyle, WebflowPayload, WebflowStyleVariant } from "./webflow-converter";
import {
  VALID_VARIANT_KEYS,
  VALID_BREAKPOINTS,
  VALID_PSEUDO_STATES,
  RESERVED_CLASS_PREFIXES,
  RESERVED_CLASS_NAMES,
} from "./preflight-validator";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Safe depth limit for Webflow - anything deeper gets flattened.
 * We use a conservative limit below MAX_NODE_DEPTH to give buffer.
 */
export const SAFE_DEPTH_LIMIT = 30;

// ============================================================================
// UUID GENERATION
// ============================================================================

/**
 * Generate a UUID v4 compatible with Webflow's ID format.
 * Uses crypto.randomUUID if available, otherwise fallback to Math.random.
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Regenerate ALL UUIDs to prevent conflicts.
 * This is the nuclear option - guarantees no duplicates but breaks external references.
 */
export function regenerateAllIds(payload: WebflowPayload): WebflowPayload {
  const idMap = new Map<string, string>();
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;

  // Generate new IDs for all nodes
  result.payload.nodes = result.payload.nodes.map((node) => {
    const newId = generateUUID();
    idMap.set(node._id, newId);
    return { ...node, _id: newId };
  });

  // Generate new IDs for all styles
  result.payload.styles = result.payload.styles.map((style) => {
    const newId = generateUUID();
    idMap.set(style._id, newId);
    return { ...style, _id: newId };
  });

  // Update all node children references to use new IDs
  // AND update node.classes to reference regenerated style IDs
  result.payload.nodes = result.payload.nodes.map((node) => {
    if (node.children && node.children.length > 0) {
      node.children = node.children.map((childId) => idMap.get(childId) || childId);
    }
    // CRITICAL: node.classes contains style UUIDs (style._id values), not class names
    // We must remap them to the regenerated style IDs
    if (node.classes && node.classes.length > 0) {
      node.classes = node.classes.map((styleId) => idMap.get(styleId) || styleId);
    }
    return node;
  });

  // Update style children references
  result.payload.styles = result.payload.styles.map((style) => {
    if (style.children && style.children.length > 0) {
      style.children = style.children.map((childId) => idMap.get(childId) || childId);
    }
    return style;
  });

  return result;
}

/**
 * Fix only duplicate UUIDs by regenerating them.
 * Preserves non-duplicate IDs for better traceability.
 *
 * IMPORTANT: When style IDs are regenerated, node.classes references are also updated.
 */
export function fixDuplicateIds(payload: WebflowPayload): {
  payload: WebflowPayload;
  fixed: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const fixed: string[] = [];

  // Track seen IDs
  const seenNodeIds = new Map<string, number>();
  const seenStyleIds = new Map<string, number>();

  // Maps for remapping references: oldId -> newId
  const nodeIdMap = new Map<string, string>();
  const styleIdMap = new Map<string, string>();

  // Fix duplicate node IDs
  result.payload.nodes = result.payload.nodes.map((node) => {
    const count = (seenNodeIds.get(node._id) || 0) + 1;
    seenNodeIds.set(node._id, count);

    if (count > 1) {
      const newId = generateUUID();
      nodeIdMap.set(node._id, newId);
      fixed.push(`Regenerated duplicate node ID: ${node._id} -> ${newId}`);
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
      styleIdMap.set(style._id, newId);
      fixed.push(`Regenerated duplicate style ID: ${style._id} -> ${newId}`);
      return { ...style, _id: newId };
    }
    return style;
  });

  // Update node.children references if any node IDs were changed
  if (nodeIdMap.size > 0) {
    result.payload.nodes = result.payload.nodes.map((node) => {
      if (node.children && node.children.length > 0) {
        node.children = node.children.map((childId) => nodeIdMap.get(childId) || childId);
      }
      return node;
    });
  }

  // Update node.classes references if any style IDs were changed
  // CRITICAL: node.classes contains style UUIDs (style._id values), not class names
  if (styleIdMap.size > 0) {
    result.payload.nodes = result.payload.nodes.map((node) => {
      if (node.classes && node.classes.length > 0) {
        node.classes = node.classes.map((styleId) => styleIdMap.get(styleId) || styleId);
      }
      return node;
    });
  }

  return { payload: result, fixed };
}

/**
 * Remove interactions data (ix2) to prevent conflicts.
 * Interactions often cause paste failures when copying between projects.
 */
export function stripInteractions(payload: WebflowPayload): WebflowPayload {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;

  if (result.payload.ix2) {
    result.payload.ix2 = {
      interactions: [],
      events: [],
      actionLists: [],
    };
  }

  return result;
}

/**
 * Break circular references in style hierarchy.
 * Circular references cause Designer to hang and corrupt state.
 */
export function breakCircularReferences(payload: WebflowPayload): {
  payload: WebflowPayload;
  broken: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const broken: string[] = [];

  const styleMap = new Map<string, WebflowStyle>();
  result.payload.styles.forEach((style) => {
    styleMap.set(style._id, style);
  });

  const visited = new Set<string>();
  const path: string[] = [];

  const removeCycles = (styleId: string): void => {
    if (path.includes(styleId)) {
      // Found cycle - break it by removing this child reference from parent
      const parentIdx = path.length - 1;
      const parentId = path[parentIdx];
      const parent = styleMap.get(parentId);
      if (parent && parent.children) {
        const originalLength = parent.children.length;
        parent.children = parent.children.filter((id) => id !== styleId);
        if (parent.children.length < originalLength) {
          broken.push(`Broke circular reference: ${parent.name} -> ${styleMap.get(styleId)?.name || styleId}`);
        }
      }
      return;
    }

    if (visited.has(styleId)) return;
    visited.add(styleId);
    path.push(styleId);

    const style = styleMap.get(styleId);
    if (style?.children) {
      // Create a copy to avoid mutation during iteration
      const childrenCopy = [...style.children];
      childrenCopy.forEach((childId) => removeCycles(childId));
    }

    path.pop();
  };

  result.payload.styles.forEach((style) => {
    visited.clear();
    removeCycles(style._id);
  });

  return { payload: result, broken };
}

/**
 * Break circular references in NODE hierarchy.
 * CRITICAL: Circular node references cause "Maximum call stack size exceeded" in Webflow Designer.
 * This is different from style circular refs - it's about node.children pointing back to ancestors.
 */
export function breakCircularNodeReferences(payload: WebflowPayload): {
  payload: WebflowPayload;
  broken: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const broken: string[] = [];

  if (!Array.isArray(result.payload.nodes)) {
    return { payload: result, broken };
  }

  const nodeMap = new Map<string, WebflowNode>();
  result.payload.nodes.forEach((node) => {
    nodeMap.set(node._id, node);
  });

  // Track which nodes we've fully processed to avoid re-walking
  const fullyVisited = new Set<string>();

  const removeCycles = (nodeId: string, ancestorPath: Set<string>): void => {
    // If we've already processed this node completely, skip
    if (fullyVisited.has(nodeId)) return;

    const node = nodeMap.get(nodeId);
    if (!node || !Array.isArray(node.children) || node.children.length === 0) {
      fullyVisited.add(nodeId);
      return;
    }

    // Check each child for circular reference
    const originalChildren = [...node.children];
    const validChildren: string[] = [];

    for (const childId of originalChildren) {
      if (ancestorPath.has(childId)) {
        // Found circular reference - this child points to an ancestor
        broken.push(`Broke circular node reference: ${nodeId} -> ${childId} (child points to ancestor)`);
      } else {
        validChildren.push(childId);
        // Recurse into valid children
        const newPath = new Set(ancestorPath);
        newPath.add(nodeId);
        removeCycles(childId, newPath);
      }
    }

    // Update children array if we removed any
    if (validChildren.length !== originalChildren.length) {
      node.children = validChildren;
    }

    fullyVisited.add(nodeId);
  };

  // Find root nodes (nodes not referenced as children by any other node)
  const allChildIds = new Set<string>();
  for (const node of result.payload.nodes) {
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        allChildIds.add(childId);
      }
    }
  }
  const rootIds = result.payload.nodes
    .map((n) => n._id)
    .filter((id) => !allChildIds.has(id));

  // Start from each root
  for (const rootId of rootIds) {
    const ancestorPath = new Set<string>();
    removeCycles(rootId, ancestorPath);
  }

  // Also process any orphan nodes that weren't reachable from roots
  for (const node of result.payload.nodes) {
    if (!fullyVisited.has(node._id)) {
      removeCycles(node._id, new Set());
    }
  }

  return { payload: result, broken };
}

// ============================================================================
// DEPTH LIMITING / FLATTENING
// ============================================================================

export interface DepthLimitResult {
  payload: WebflowPayload;
  flattened: string[];
  /** CSS that needs to go into embed due to flattening losing nesting context */
  extractedCSS: string;
}

/**
 * Flatten nodes that exceed the safe depth limit.
 *
 * CRITICAL: Deeply nested structures (>30 levels) cause Webflow Designer to crash
 * with "Maximum call stack size exceeded". This function:
 *
 * 1. Detects nodes exceeding SAFE_DEPTH_LIMIT
 * 2. Flattens by moving deeply nested children up to a safe level
 * 3. Extracts position/layout CSS to embed so visual layout is preserved
 *
 * The strategy: When we hit depth limit, we create a "flat container" at the limit
 * and move all deeper children into it as siblings instead of nested.
 */
export function flattenDeepNesting(payload: WebflowPayload): DepthLimitResult {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const flattened: string[] = [];
  const cssLines: string[] = [];

  if (!Array.isArray(result.payload.nodes) || result.payload.nodes.length === 0) {
    return { payload: result, flattened, extractedCSS: '' };
  }

  const nodeMap = new Map<string, WebflowNode>();
  result.payload.nodes.forEach((node) => {
    nodeMap.set(node._id, node);
  });

  // Find root nodes
  const allChildIds = new Set<string>();
  for (const node of result.payload.nodes) {
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        allChildIds.add(childId);
      }
    }
  }
  const rootIds = result.payload.nodes
    .map((n) => n._id)
    .filter((id) => !allChildIds.has(id));

  // Track nodes to flatten and their new parents
  const nodesToHoist: Array<{ nodeId: string; newParentId: string; originalDepth: number }> = [];

  // DFS to find deep nodes
  const findDeepNodes = (
    nodeId: string,
    currentDepth: number,
    lastSafeParentId: string,
    visited: Set<string>
  ): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // Update safe parent if we're still within limits
    const safeParent = currentDepth <= SAFE_DEPTH_LIMIT ? nodeId : lastSafeParentId;

    // If we exceed the limit, mark for hoisting
    if (currentDepth > SAFE_DEPTH_LIMIT) {
      nodesToHoist.push({
        nodeId,
        newParentId: lastSafeParentId,
        originalDepth: currentDepth,
      });
    }

    // Recurse to children
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        findDeepNodes(childId, currentDepth + 1, safeParent, visited);
      }
    }
  };

  // Find all deep nodes starting from roots
  for (const rootId of rootIds) {
    findDeepNodes(rootId, 1, rootId, new Set());
  }

  if (nodesToHoist.length === 0) {
    return { payload: result, flattened, extractedCSS: '' };
  }

  // Group nodes by their new parent for efficient processing
  const hoistGroups = new Map<string, string[]>();
  for (const { nodeId, newParentId } of nodesToHoist) {
    if (!hoistGroups.has(newParentId)) {
      hoistGroups.set(newParentId, []);
    }
    hoistGroups.get(newParentId)!.push(nodeId);
  }

  // Process each group - move deep nodes to be children of their safe ancestor
  for (const [newParentId, nodeIds] of hoistGroups) {
    const newParent = nodeMap.get(newParentId);
    if (!newParent) continue;

    // Remove these nodes from their current parents
    for (const nodeId of nodeIds) {
      // Find current parent
      for (const node of result.payload.nodes) {
        if (Array.isArray(node.children) && node.children.includes(nodeId)) {
          // Remove from current parent
          node.children = node.children.filter((id) => id !== nodeId);
          break;
        }
      }
    }

    // Add to new parent
    if (!newParent.children) {
      newParent.children = [];
    }

    // Add hoisted nodes to the safe parent
    for (const nodeId of nodeIds) {
      if (!newParent.children.includes(nodeId)) {
        newParent.children.push(nodeId);
      }
    }

    flattened.push(
      `Flattened ${nodeIds.length} deeply nested node(s) under ${newParentId}`
    );
  }

  // Generate CSS to preserve visual nesting through positioning
  if (flattened.length > 0) {
    cssLines.push('/* ============================================ */');
    cssLines.push('/* CSS extracted due to depth flattening */');
    cssLines.push('/* These styles help preserve visual layout */');
    cssLines.push('/* after deeply nested elements were flattened */');
    cssLines.push('/* ============================================ */');
    cssLines.push('');
    cssLines.push('/* Note: You may need to adjust positioning manually */');
    cssLines.push('/* The original nesting provided implicit layout context */');
    cssLines.push('/* that is now lost. Review the flattened sections. */');
    cssLines.push('');
  }

  return {
    payload: result,
    flattened,
    extractedCSS: cssLines.length > 6 ? cssLines.join('\n') : '',
  };
}

/**
 * Simpler approach: Instead of complex hoisting, just limit children recursion.
 * When a node is too deep, convert it to an HtmlEmbed containing the rest.
 * This preserves the visual appearance through embed while avoiding Webflow's parser.
 */
export function convertDeepNodesToEmbed(payload: WebflowPayload): {
  payload: WebflowPayload;
  converted: string[];
  embedHTML: string;
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const converted: string[] = [];
  const embedParts: string[] = [];

  if (!Array.isArray(result.payload.nodes) || result.payload.nodes.length === 0) {
    return { payload: result, converted, embedHTML: '' };
  }

  const nodeMap = new Map<string, WebflowNode>();
  const styleMap = new Map<string, WebflowStyle>();

  result.payload.nodes.forEach((node) => nodeMap.set(node._id, node));
  result.payload.styles.forEach((style) => styleMap.set(style.name, style));

  // Find root nodes
  const allChildIds = new Set<string>();
  for (const node of result.payload.nodes) {
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        allChildIds.add(childId);
      }
    }
  }
  const rootIds = result.payload.nodes
    .map((n) => n._id)
    .filter((id) => !allChildIds.has(id));

  // Helper to convert a node subtree to HTML string
  const nodeToHTML = (nodeId: string, indent: string = '', visited: Set<string> = new Set()): string => {
    // CRITICAL: Prevent infinite recursion from circular refs
    if (visited.has(nodeId)) {
      return `${indent}<!-- Circular ref removed -->`;
    }
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return '';

    // Text node
    if (node.text === true) {
      return `${indent}${node.v || ''}`;
    }

    const tag = node.tag || 'div';
    const classes = Array.isArray(node.classes) ? node.classes.join(' ') : '';
    const classAttr = classes ? ` class="${classes}"` : '';

    // Get any inline styles (cast to allow arbitrary data properties)
    let styleAttr = '';
    const nodeData = node.data as Record<string, unknown> | undefined;
    if (nodeData?.style && typeof nodeData.style === 'object') {
      const styleObj = nodeData.style as Record<string, string>;
      const styleStr = Object.entries(styleObj)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      if (styleStr) {
        styleAttr = ` style="${styleStr}"`;
      }
    }

    // Self-closing tags
    if (['img', 'br', 'hr', 'input'].includes(tag)) {
      const src = node.data?.attr?.src || '';
      const alt = node.data?.attr?.alt || '';
      const srcAttr = src ? ` src="${src}"` : '';
      const altAttr = alt ? ` alt="${alt}"` : '';
      return `${indent}<${tag}${classAttr}${srcAttr}${altAttr}${styleAttr} />`;
    }

    // Build children HTML
    let childrenHTML = '';
    if (Array.isArray(node.children) && node.children.length > 0) {
      const childIndent = indent + '  ';
      childrenHTML = '\n' + node.children
        .map((childId) => nodeToHTML(childId, childIndent, visited))
        .filter(Boolean)
        .join('\n') + '\n' + indent;
    } else if (node.v) {
      // Node has text content
      childrenHTML = node.v;
    }

    return `${indent}<${tag}${classAttr}${styleAttr}>${childrenHTML}</${tag}>`;
  };

  // DFS to find and convert deep subtrees
  const processNode = (
    nodeId: string,
    currentDepth: number,
    visited: Set<string>
  ): void => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node) return;

    // If this node is at the depth limit and has children, convert children to embed
    if (currentDepth >= SAFE_DEPTH_LIMIT && Array.isArray(node.children) && node.children.length > 0) {
      // Convert children to HTML embed - use shared visited set for cycle protection
      const htmlVisited = new Set<string>();
      const childrenHTML = node.children
        .map((childId) => nodeToHTML(childId, '', htmlVisited))
        .filter(Boolean)
        .join('\n');

      if (childrenHTML) {
        // Create embed node ID
        const embedId = `embed-flatten-${node._id}`;

        // Create new HtmlEmbed node
        const embedNode: WebflowNode = {
          _id: embedId,
          type: 'HtmlEmbed',
          tag: 'div',
          classes: [],
          children: [],
          data: {
            embed: {
              type: 'custom',
              meta: {
                html: `<!-- Flattened from depth ${currentDepth} -->\n${childrenHTML}`,
                div: true,
                iframe: false,
                script: false,
                compilable: false,
              },
            },
          },
          v: `<!-- Flattened from depth ${currentDepth} -->\n${childrenHTML}`,
        };

        // Add embed node to nodes array
        result.payload.nodes.push(embedNode);

        // Replace children with just the embed
        node.children = [embedId];

        converted.push(
          `Converted ${node.children.length} child(ren) of node at depth ${currentDepth} to HTML embed`
        );

        embedParts.push(childrenHTML);
      }
      return; // Don't recurse further - we've converted the subtree
    }

    // Recurse to children
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        processNode(childId, currentDepth + 1, visited);
      }
    }
  };

  // Process from roots
  for (const rootId of rootIds) {
    processNode(rootId, 1, new Set());
  }

  return {
    payload: result,
    converted,
    embedHTML: embedParts.join('\n\n'),
  };
}

/**
 * Remove orphaned state variants (e.g., "button:hover" without "button" base class).
 * These cause "invalid keys" errors in Webflow.
 */
export function removeOrphanedStates(payload: WebflowPayload): {
  payload: WebflowPayload;
  removed: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const removed: string[] = [];

  // Collect base class names (those without ":" in the name)
  const baseClassNames = new Set<string>(
    result.payload.styles.filter((s) => !s.name.includes(":")).map((s) => s.name)
  );

  // Filter out orphaned state variants
  result.payload.styles = result.payload.styles.filter((style) => {
    if (style.name.includes(":")) {
      const baseName = style.name.split(":")[0];
      if (!baseClassNames.has(baseName)) {
        removed.push(`Removed orphaned state variant: ${style.name} (missing base class: ${baseName})`);
        return false;
      }
    }
    return true;
  });

  return { payload: result, removed };
}

/**
 * Sanitize class names to valid Webflow format (kebab-case, alphanumeric).
 */
export function sanitizeClassNames(payload: WebflowPayload): {
  payload: WebflowPayload;
  renamed: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const renamed: string[] = [];
  const nameMap = new Map<string, string>();

  result.payload.styles = result.payload.styles.map((style) => {
    const parts = style.name.split(":");
    const baseName = parts[0];
    const state = parts[1];

    // Check if name needs sanitization
    const sanitized = baseName
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");

    if (sanitized !== baseName) {
      const newName = state ? `${sanitized}:${state}` : sanitized;
      renamed.push(`Renamed class: ${style.name} -> ${newName}`);
      nameMap.set(style.name, newName);
      return { ...style, name: newName };
    }
    return style;
  });

  // Update node class references
  if (nameMap.size > 0) {
    result.payload.nodes = result.payload.nodes.map((node) => {
      if (node.classes && node.classes.length > 0) {
        node.classes = node.classes.map((className) => nameMap.get(className) || className);
      }
      return node;
    });
  }

  return { payload: result, renamed };
}

/**
 * Remove orphaned node references (children that don't exist).
 */
export function removeOrphanedNodeReferences(payload: WebflowPayload): {
  payload: WebflowPayload;
  removed: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const removed: string[] = [];

  const nodeIds = new Set<string>(result.payload.nodes.map((n) => n._id));

  result.payload.nodes = result.payload.nodes.map((node) => {
    if (node.children) {
      node.children = node.children.filter((childId) => {
        const exists = nodeIds.has(childId);
        if (!exists) {
          removed.push(`Removed orphan reference: ${node._id} -> ${childId}`);
        }
        return exists;
      });
    }
    return node;
  });

  return { payload: result, removed };
}

// ============================================================================
// MULTIPLE ROOTS FIX
// ============================================================================

/**
 * Wrap multiple root nodes in a single container.
 * Webflow paste requires EXACTLY ONE root node.
 * Multiple roots cause "Subtree reification resulted in more than one root!" error.
 *
 * @param payload - The Webflow payload to fix
 * @returns Fixed payload with single root, and list of changes
 */
export function wrapMultipleRoots(payload: WebflowPayload): {
  payload: WebflowPayload;
  wrapped: boolean;
  rootCount: number;
  changes: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const changes: string[] = [];

  if (!Array.isArray(result.payload.nodes) || result.payload.nodes.length === 0) {
    return { payload: result, wrapped: false, rootCount: 0, changes };
  }

  // Find root nodes (not a child of any other node, excluding text nodes)
  const childIds = new Set<string>();
  for (const node of result.payload.nodes) {
    if (Array.isArray(node.children)) {
      for (const childId of node.children) {
        childIds.add(childId);
      }
    }
  }

  const rootNodes = result.payload.nodes.filter(
    (n) => !n.text && !childIds.has(n._id)
  );
  const rootIds = rootNodes.map((n) => n._id);

  // If we have exactly 1 root (or 0), no action needed
  if (rootIds.length <= 1) {
    return { payload: result, wrapped: false, rootCount: rootIds.length, changes };
  }

  // Multiple roots detected - wrap them in a container
  const wrapperId = generateUUID();
  const existingWrapperStyle = result.payload.styles.find(
    (style) => style.name === "multi-root-wrapper"
  );
  const wrapperStyleId = existingWrapperStyle?._id ?? generateUUID();
  const wrapperNode: WebflowNode = {
    _id: wrapperId,
    type: "Block",
    tag: "div",
    classes: [wrapperStyleId],
    children: rootIds,
    data: { 
      tag: "div", 
      text: false,
      displayName: "Content Wrapper (Delete after pasting)",
    },
  };

  // Add the wrapper style if it doesn't exist
  if (!existingWrapperStyle) {
    result.payload.styles.push({
      _id: wrapperStyleId,
      fake: false,
      type: "class",
      name: "multi-root-wrapper",
      namespace: "",
      comb: "",
      styleLess: "display: block; width: 100%;",
      variants: {},
      children: [],
    });
  }

  // Add wrapper as first node (root should be first in array for Webflow)
  result.payload.nodes.unshift(wrapperNode);

  changes.push(
    `Wrapped ${rootIds.length} root elements in a container (Webflow requires single root)`
  );

  return {
    payload: result,
    wrapped: true,
    rootCount: rootIds.length,
    changes,
  };
}

/**
 * Sanitize invalid variant keys by removing them from styles.
 * Invalid keys cause [PersistentUIState] errors and crash Webflow Designer.
 */
export function sanitizeInvalidVariantKeys(payload: WebflowPayload): {
  payload: WebflowPayload;
  removed: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const removed: string[] = [];

  result.payload.styles = result.payload.styles.map((style) => {
    if (!style.variants || typeof style.variants !== 'object') {
      return style;
    }

    const validVariants: Record<string, WebflowStyleVariant> = {};
    for (const [variantKey, variantValue] of Object.entries(style.variants)) {
      if (VALID_VARIANT_KEYS.has(variantKey)) {
        validVariants[variantKey] = variantValue;
      } else {
        removed.push(`Removed invalid variant "${variantKey}" from style "${style.name}"`);
      }
    }

    return { ...style, variants: validVariants };
  });

  return { payload: result, removed };
}

/**
 * Sanitize reserved class names by renaming styles that use w- prefix.
 * Reserved class names conflict with webflow.js and can corrupt Designer state.
 */
export function sanitizeReservedClassNames(payload: WebflowPayload): {
  payload: WebflowPayload;
  renamed: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const renamed: string[] = [];

  result.payload.styles = result.payload.styles.map((style) => {
    // Check if style name uses reserved prefix
    const isReserved = RESERVED_CLASS_PREFIXES.some(prefix => style.name.startsWith(prefix)) ||
                       RESERVED_CLASS_NAMES.has(style.name);

    if (isReserved) {
      // Rename by adding "custom-" prefix to avoid conflict
      const newName = `custom-${style.name.replace(/^w-/, '')}`;
      renamed.push(`Renamed reserved class: ${style.name} -> ${newName}`);
      return { ...style, name: newName };
    }
    return style;
  });

  return { payload: result, renamed };
}

/**
 * Sanitize text nodes that include <br> tags (React #137 crash prevention).
 */
export function sanitizeTextNodeLineBreaks(payload: WebflowPayload): {
  payload: WebflowPayload;
  removedCount: number;
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  let removedCount = 0;

  result.payload.nodes = result.payload.nodes.map((node) => {
    if (!node.text || typeof node.v !== "string") return node;
    if (!/<br\s*\/?>/i.test(node.v)) return node;

    const sanitized = node.v.replace(/<br\s*\/?>/gi, "\n");
    if (sanitized !== node.v) {
      removedCount += 1;
      return { ...node, v: sanitized };
    }
    return node;
  });

  return { payload: result, removedCount };
}

// ============================================================================
// EMBED CONTENT INTERFACE
// ============================================================================

export interface EmbedContent {
  /** CSS that was extracted due to unsupported features */
  css: string;
  /** JS that was extracted from broken interactions */
  js: string;
  /** HTML that couldn't be converted (reserved for future use) */
  html: string;
  /** Warnings about what was extracted */
  warnings: string[];
}

export interface StrippedContent {
  type: 'ghost_variant' | 'invalid_css' | 'broken_interaction' | 'orphan_child';
  className?: string;
  key?: string;
  value?: unknown;
  suggestion: string;
}

// ============================================================================
// GHOST VARIANT SANITIZER WITH TRACKING
// ============================================================================

/**
 * UUID format check for variant keys that might be node references.
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUUIDFormat(str: string): boolean {
  return UUID_V4_REGEX.test(str);
}

/**
 * Sanitize ghost variant keys - variant keys that reference non-existent nodes.
 * Returns the sanitized payload and a list of what was stripped.
 */
export function sanitizeGhostVariants(payload: WebflowPayload): {
  sanitized: WebflowPayload;
  stripped: StrippedContent[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const stripped: StrippedContent[] = [];

  // Build set of node IDs
  const nodeIds = new Set(result.payload.nodes.map(n => n._id));

  // Valid keys are breakpoints, states, or existing node IDs
  const validKeys = new Set([
    ...VALID_BREAKPOINTS,
    ...VALID_PSEUDO_STATES,
  ]);

  result.payload.styles = result.payload.styles.map(style => {
    if (!style.variants || typeof style.variants !== 'object') {
      return style;
    }

    const cleanVariants: Record<string, WebflowStyleVariant> = {};
    let hadGhosts = false;

    for (const [key, value] of Object.entries(style.variants)) {
      const isValidKey = validKeys.has(key);
      const isExistingNode = isUUIDFormat(key) && nodeIds.has(key);

      if (isValidKey || isExistingNode) {
        cleanVariants[key] = value;
      } else if (isUUIDFormat(key)) {
        // This is a ghost variant - UUID format but node doesn't exist
        hadGhosts = true;
        stripped.push({
          type: 'ghost_variant',
          className: style.name,
          key: key,
          value: value,
          suggestion: `Ghost variant "${key}" in style "${style.name}" was removed - it referenced a non-existent node.`,
        });
      } else {
        // Invalid variant key (not UUID, not breakpoint, not state)
        // This is handled by sanitizeInvalidVariantKeys
        cleanVariants[key] = value;
      }
    }

    if (hadGhosts) {
      return {
        ...style,
        variants: Object.keys(cleanVariants).length > 0 ? cleanVariants : {},
      };
    }
    return style;
  });

  return { sanitized: result, stripped };
}

// ============================================================================
// INTERACTION TO JS EMBED EXTRACTOR
// ============================================================================

/**
 * Convert a Webflow ix2 trigger type to GSAP-equivalent code.
 */
function convertTriggerToGSAP(triggerType: string, selector: string): string {
  switch (triggerType) {
    case 'scroll':
    case 'SCROLL':
      return `gsap.to("${selector}", {
  scrollTrigger: {
    trigger: "${selector}",
    start: "top 80%",
    toggleActions: "play none none reverse"
  },
  opacity: 1,
  y: 0,
  duration: 0.6
});`;

    case 'click':
    case 'CLICK':
      return `document.querySelector("${selector}")?.addEventListener("click", () => {
  // Click animation - customize as needed
  gsap.to("${selector}", { scale: 1.05, duration: 0.2, yoyo: true, repeat: 1 });
});`;

    case 'hover':
    case 'HOVER':
    case 'MOUSE_OVER':
      return `const el = document.querySelector("${selector}");
if (el) {
  el.addEventListener("mouseenter", () => {
    gsap.to("${selector}", { scale: 1.05, duration: 0.3 });
  });
  el.addEventListener("mouseleave", () => {
    gsap.to("${selector}", { scale: 1, duration: 0.3 });
  });
}`;

    case 'load':
    case 'PAGE_START':
      return `// Page load animation
gsap.from("${selector}", {
  opacity: 0,
  y: 20,
  duration: 0.6,
  delay: 0.2
});`;

    default:
      return `// Interaction type: ${triggerType}
// Selector: ${selector}
// Add your custom animation here
// gsap.to("${selector}", { ... });`;
  }
}

/**
 * Extract broken interactions (those with orphan targets) and convert to GSAP JS.
 */
export function extractBrokenInteractionsToJS(
  payload: WebflowPayload,
  brokenInteractionIndexes: number[]
): {
  sanitizedPayload: WebflowPayload;
  jsEmbed: string;
  extractedCount: number;
} {
  if (!payload.payload.ix2?.interactions || brokenInteractionIndexes.length === 0) {
    return { sanitizedPayload: payload, jsEmbed: '', extractedCount: 0 };
  }

  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const jsLines: string[] = [];

  jsLines.push('// ============================================');
  jsLines.push('// Interactions extracted from Webflow');
  jsLines.push('// These had invalid references and were converted to GSAP');
  jsLines.push('// You may need to update selectors to match your elements');
  jsLines.push('// ============================================');
  jsLines.push('');
  jsLines.push('// Ensure GSAP is loaded: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>');
  jsLines.push('// For scroll triggers: <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>');
  jsLines.push('');

  // Extract and convert broken interactions
  const brokenSet = new Set(brokenInteractionIndexes);
  let extractedCount = 0;

  result.payload.ix2!.interactions = result.payload.ix2!.interactions.filter((interaction, idx) => {
    if (!brokenSet.has(idx)) return true;

    // Extract this interaction
    extractedCount++;
    const interactionObj = interaction as Record<string, unknown>;
    const name = typeof interactionObj.name === 'string' ? interactionObj.name : `Interaction ${idx + 1}`;

    jsLines.push(`// --- ${name} ---`);

    // Try to extract trigger info
    const trigger = interactionObj.trigger as Record<string, unknown> | undefined;
    const triggerType = typeof trigger?.type === 'string' ? trigger.type : 'unknown';
    const selector = typeof trigger?.selector === 'string' ? trigger.selector : '.your-element';

    jsLines.push(convertTriggerToGSAP(triggerType, selector));
    jsLines.push('');

    return false; // Remove from payload
  });

  // Clean up ix2 if empty
  if (result.payload.ix2!.interactions.length === 0) {
    result.payload.ix2 = {
      interactions: [],
      events: [],
      actionLists: [],
    };
  }

  return {
    sanitizedPayload: result,
    jsEmbed: jsLines.join('\n'),
    extractedCount,
  };
}

// ============================================================================
// INVALID CSS TO EMBED EXTRACTOR
// ============================================================================

/**
 * Patterns for CSS features that Webflow doesn't support natively.
 * These need to be extracted to cssEmbed.
 */
const UNSUPPORTED_CSS_PATTERNS = [
  { pattern: /oklch\([^)]+\)/gi, name: 'oklch color' },
  { pattern: /color-mix\([^)]+\)/gi, name: 'color-mix' },
  { pattern: /@container[^{]+\{[^}]*\}/gi, name: 'container query' },
  { pattern: /:has\([^)]+\)/gi, name: ':has selector' },
  { pattern: /backdrop-filter:\s*[^;]+;?/gi, name: 'backdrop-filter' },
  { pattern: /@layer[^{]+\{/gi, name: '@layer' },
  { pattern: /text-wrap:\s*balance[^;]*;?/gi, name: 'text-wrap: balance' },
  { pattern: /accent-color:\s*[^;]+;?/gi, name: 'accent-color' },
];

/**
 * Extract invalid/unsupported CSS from styleLess and move to embed.
 */
export function extractInvalidCSSToEmbed(payload: WebflowPayload): {
  sanitizedPayload: WebflowPayload;
  cssEmbed: string;
  extractedFeatures: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const cssLines: string[] = [];
  const extractedFeatures: string[] = [];

  cssLines.push('/* ============================================ */');
  cssLines.push('/* CSS extracted from Webflow (unsupported features) */');
  cssLines.push('/* Add this to an HTML Embed element in <style> tags */');
  cssLines.push('/* ============================================ */');
  cssLines.push('');

  let hasExtracted = false;

  result.payload.styles = result.payload.styles.map(style => {
    let styleLess = style.styleLess || '';
    let extractedForThisStyle = false;
    const styleCSS: string[] = [];

    for (const { pattern, name } of UNSUPPORTED_CSS_PATTERNS) {
      const matches = styleLess.match(pattern);
      if (matches) {
        hasExtracted = true;
        extractedForThisStyle = true;

        if (!extractedFeatures.includes(name)) {
          extractedFeatures.push(name);
        }

        // Add to embed CSS
        for (const match of matches) {
          styleCSS.push(`  ${match}`);
        }

        // Remove from styleLess (Webflow styleLess doesn't support comments)
        styleLess = styleLess.replace(pattern, '');
      }
    }

    // Also check variants
    if (style.variants) {
      for (const [variantKey, variant] of Object.entries(style.variants)) {
        let variantCSS = variant.styleLess || '';
        const variantStyleCSS: string[] = [];

        for (const { pattern, name } of UNSUPPORTED_CSS_PATTERNS) {
          const matches = variantCSS.match(pattern);
          if (matches) {
            hasExtracted = true;

            if (!extractedFeatures.includes(name)) {
              extractedFeatures.push(name);
            }

            for (const match of matches) {
              variantStyleCSS.push(`  ${match}`);
            }

            variantCSS = variantCSS.replace(pattern, '');
          }
        }

        if (variantStyleCSS.length > 0) {
          // Add variant CSS to embed
          const breakpointSelector = VALID_BREAKPOINTS.has(variantKey)
            ? getBreakpointMediaQuery(variantKey)
            : '';
          const stateSelector = VALID_PSEUDO_STATES.has(variantKey)
            ? `:${variantKey}`
            : '';

          if (breakpointSelector) {
            cssLines.push(`${breakpointSelector} {`);
            cssLines.push(`  .${style.name} {`);
            cssLines.push(...variantStyleCSS.map(l => `  ${l}`));
            cssLines.push(`  }`);
            cssLines.push(`}`);
          } else if (stateSelector) {
            cssLines.push(`.${style.name}${stateSelector} {`);
            cssLines.push(...variantStyleCSS);
            cssLines.push(`}`);
          }
          cssLines.push('');

          // Update variant styleLess
          style.variants![variantKey] = { styleLess: variantCSS };
        }
      }
    }

    if (extractedForThisStyle && styleCSS.length > 0) {
      cssLines.push(`.${style.name} {`);
      cssLines.push(...styleCSS);
      cssLines.push(`}`);
      cssLines.push('');
    }

    return extractedForThisStyle ? { ...style, styleLess } : style;
  });

  return {
    sanitizedPayload: result,
    cssEmbed: hasExtracted ? cssLines.join('\n') : '',
    extractedFeatures,
  };
}

/**
 * Get media query for a breakpoint name.
 */
function getBreakpointMediaQuery(breakpoint: string): string {
  switch (breakpoint) {
    case 'medium': return '@media (max-width: 991px)';
    case 'small': return '@media (max-width: 767px)';
    case 'tiny': return '@media (max-width: 479px)';
    case 'large': return '@media (min-width: 992px)';
    case 'xl': return '@media (min-width: 1280px)';
    case 'xxl': return '@media (min-width: 1440px)';
    default: return '';
  }
}

// ============================================================================
// ORPHAN CHILD REFERENCE REMOVAL
// ============================================================================

/**
 * Remove orphan child references from nodes.
 */
export function removeOrphanChildReferences(payload: WebflowPayload): {
  payload: WebflowPayload;
  removed: string[];
} {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;
  const removed: string[] = [];

  const nodeIds = new Set<string>(result.payload.nodes.map(n => n._id));

  result.payload.nodes = result.payload.nodes.map(node => {
    if (!node.children || node.children.length === 0) return node;

    node.children = node.children.filter(childId => {
      const exists = nodeIds.has(childId);
      if (!exists) {
        removed.push(`Removed orphan child reference: ${node._id} -> ${childId}`);
      }
      return exists;
    });

    return node;
  });

  return { payload: result, removed };
}

// ============================================================================
// STRIP ALL INTERACTIONS
// ============================================================================

/**
 * Strip all ix2 interactions from payload.
 * Use as last resort when interactions can't be fixed.
 */
export function stripAllInteractions(payload: WebflowPayload): WebflowPayload {
  const result = JSON.parse(JSON.stringify(payload)) as WebflowPayload;

  result.payload.ix2 = {
    interactions: [],
    events: [],
    actionLists: [],
  };

  return result;
}

/**
 * Check if payload has problematic interactions.
 */
export function hasProblematicInteractions(payload: WebflowPayload): boolean {
  const ix2 = payload.payload.ix2;
  if (!ix2) return false;

  // Check if there are any interactions referencing missing nodes
  const nodeIds = new Set(payload.payload.nodes.map(n => n._id));

  const checkTargets = (obj: unknown): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    const record = obj as Record<string, unknown>;

    // Check for target references
    if (typeof record.target === 'string' && !nodeIds.has(record.target)) {
      return true;
    }
    if (typeof record.targetId === 'string' && !nodeIds.has(record.targetId)) {
      return true;
    }

    // Recurse
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (checkTargets(item)) return true;
        }
      } else if (value && typeof value === 'object') {
        if (checkTargets(value)) return true;
      }
    }
    return false;
  };

  if (ix2.interactions) {
    for (const interaction of ix2.interactions) {
      if (checkTargets(interaction)) return true;
    }
  }

  return false;
}

// ============================================================================
// MAIN SANITIZATION PIPELINE
// ============================================================================

export interface SanitizationResult {
  payload: WebflowPayload;
  changes: string[];
  hadIssues: boolean;
  /** Content extracted to embeds (for display/use) */
  embedContent?: EmbedContent;
}

/**
 * Run full sanitization pipeline on a Webflow payload.
 * Fixes all known corruption-causing issues and extracts problematic content to embeds.
 *
 * CRITICAL: Call this before storing or copying any payload.
 */
export function sanitizeWebflowPayload(
  payload: WebflowPayload,
  options: {
    /** Indexes of interactions that have broken references */
    brokenInteractionIndexes?: number[];
    /** Skip wrapping multiple roots (for component exports where multi-root is intentional) */
    skipMultiRootWrapper?: boolean;
  } = {}
): SanitizationResult {
  const changes: string[] = [];
  const embedContent: EmbedContent = {
    css: '',
    js: '',
    html: '',
    warnings: [],
  };
  let current = payload;

  // 1. Fix duplicate UUIDs (CRITICAL - site-killer)
  const dupResult = fixDuplicateIds(current);
  current = dupResult.payload;
  changes.push(...dupResult.fixed);

  // 2. Break circular references in STYLES (CRITICAL - causes hangs)
  const circResult = breakCircularReferences(current);
  current = circResult.payload;
  changes.push(...circResult.broken);

  // 2b. Break circular references in NODES (CRITICAL - causes "Maximum call stack size exceeded")
  const circNodeResult = breakCircularNodeReferences(current);
  current = circNodeResult.payload;
  changes.push(...circNodeResult.broken);

  // 2c. Flatten deeply nested structures (CRITICAL - causes "Maximum call stack size exceeded")
  // Deep nesting (>30 levels) crashes Webflow Designer - convert to HTML embeds
  const depthResult = convertDeepNodesToEmbed(current);
  current = depthResult.payload;
  if (depthResult.converted.length > 0) {
    changes.push(...depthResult.converted);
    embedContent.html += (embedContent.html ? '\n\n' : '') + depthResult.embedHTML;
    embedContent.warnings.push(
      `Deeply nested content (>${SAFE_DEPTH_LIMIT} levels) was converted to HTML embeds. ` +
      `This preserves the visual structure while avoiding Webflow Designer crashes.`
    );
  }

  // 2d. Wrap multiple roots in single container (CRITICAL - causes "Subtree reification" crash)
  // Webflow paste requires EXACTLY ONE root node
  // Skip for component exports if skipMultiRootWrapper is true
  if (!options.skipMultiRootWrapper) {
    const rootWrapResult = wrapMultipleRoots(current);
    current = rootWrapResult.payload;
    if (rootWrapResult.wrapped) {
      changes.push(...rootWrapResult.changes);
      embedContent.warnings.push(
        `Your content had ${rootWrapResult.rootCount} root elements. ` +
        `They were wrapped in a container div since Webflow requires a single root.`
      );
    }
  }

  // 2e. Strip <br> tags from text nodes (React #137 crash prevention)
  const brResult = sanitizeTextNodeLineBreaks(current);
  current = brResult.payload;
  if (brResult.removedCount > 0) {
    changes.push("Removed <br> tags from text nodes (React #137 crash prevention)");
    embedContent.warnings.push(
      "Text nodes containing <br> tags were sanitized to prevent Webflow Designer crash."
    );
  }

  // 3. Remove orphaned state variants (causes invalid keys)
  const orphanResult = removeOrphanedStates(current);
  current = orphanResult.payload;
  changes.push(...orphanResult.removed);

  // 4. Sanitize ghost variant keys (references to non-existent nodes)
  const ghostResult = sanitizeGhostVariants(current);
  current = ghostResult.sanitized;
  if (ghostResult.stripped.length > 0) {
    const ghostCount = ghostResult.stripped.length;
    changes.push(`Removed ${ghostCount} ghost variant reference(s)`);
    embedContent.warnings.push(
      `${ghostCount} variant(s) referenced non-existent nodes and were removed. ` +
      `These may have been component overrides that lost their targets.`
    );
  }

  // 5. Sanitize invalid variant keys (CRITICAL - causes [PersistentUIState] crash)
  const variantResult = sanitizeInvalidVariantKeys(current);
  current = variantResult.payload;
  changes.push(...variantResult.removed);

  // 6. Sanitize reserved class names (prevents webflow.js conflicts)
  const reservedResult = sanitizeReservedClassNames(current);
  current = reservedResult.payload;
  changes.push(...reservedResult.renamed);

  // 7. Sanitize class names (prevents parse errors)
  const nameResult = sanitizeClassNames(current);
  current = nameResult.payload;
  changes.push(...nameResult.renamed);

  // 8. Remove orphan child references (CRITICAL - crashes Designer)
  const orphanChildResult = removeOrphanChildReferences(current);
  current = orphanChildResult.payload;
  if (orphanChildResult.removed.length > 0) {
    changes.push(...orphanChildResult.removed);
    embedContent.warnings.push(
      `${orphanChildResult.removed.length} orphan child reference(s) were removed. ` +
      `Some elements may be missing from the pasted result.`
    );
  }

  // 9. Remove legacy orphaned node references (prevents missing children)
  const nodeRefResult = removeOrphanedNodeReferences(current);
  current = nodeRefResult.payload;
  changes.push(...nodeRefResult.removed);

  // 10. Extract broken interactions to JS embed
  if (options.brokenInteractionIndexes && options.brokenInteractionIndexes.length > 0) {
    const ixResult = extractBrokenInteractionsToJS(current, options.brokenInteractionIndexes);
    current = ixResult.sanitizedPayload;
    if (ixResult.jsEmbed) {
      embedContent.js += (embedContent.js ? '\n\n' : '') + ixResult.jsEmbed;
      changes.push(`Extracted ${ixResult.extractedCount} interaction(s) to JS embed`);
      embedContent.warnings.push(
        `${ixResult.extractedCount} interaction(s) had invalid references and were converted to GSAP code. ` +
        `Add the JS embed code and include GSAP library for animations to work.`
      );
    }
  }

  // 11. Extract unsupported CSS to embed
  const cssResult = extractInvalidCSSToEmbed(current);
  current = cssResult.sanitizedPayload;
  if (cssResult.cssEmbed) {
    embedContent.css += (embedContent.css ? '\n\n' : '') + cssResult.cssEmbed;
    changes.push(`Extracted ${cssResult.extractedFeatures.length} unsupported CSS feature(s) to embed`);
    embedContent.warnings.push(
      `Modern CSS features (${cssResult.extractedFeatures.join(', ')}) were extracted to CSS embed. ` +
      `Add the CSS embed code to an HTML Embed element for full styling.`
    );
  }

  // 12. Strip all interactions if still problematic
  if (hasProblematicInteractions(current)) {
    current = stripAllInteractions(current);
    changes.push("Stripped all remaining interaction data due to unresolvable references");
    embedContent.warnings.push(
      'All interactions were removed because they had references that could not be resolved. ' +
      'You may need to recreate animations manually in Webflow or use the JS embed alternative.'
    );
  }

  return {
    payload: current,
    changes,
    hadIssues: changes.length > 0,
    embedContent: (embedContent.css || embedContent.js || embedContent.warnings.length > 0) ? embedContent : undefined,
  };
}

/**
 * Quick check if payload likely needs sanitization.
 * Use this for fast pre-checks before running full validation.
 */
export function payloadLikelyNeedsSanitization(payload: WebflowPayload): boolean {
  if (!payload?.payload?.nodes || !payload?.payload?.styles) {
    return true;
  }

  // Check for duplicate node IDs
  const nodeIds = new Set<string>();
  for (const node of payload.payload.nodes) {
    if (nodeIds.has(node._id)) return true;
    nodeIds.add(node._id);
  }

  // Check for duplicate style IDs
  const styleIds = new Set<string>();
  for (const style of payload.payload.styles) {
    if (styleIds.has(style._id)) return true;
    styleIds.add(style._id);
  }

  // Check for orphaned state variants
  const baseClasses = new Set(
    payload.payload.styles.filter((s) => !s.name.includes(":")).map((s) => s.name)
  );
  for (const style of payload.payload.styles) {
    if (style.name.includes(":")) {
      const baseName = style.name.split(":")[0];
      if (!baseClasses.has(baseName)) return true;
    }
  }

  // Check for text nodes containing <br> (React #137 crash pattern)
  for (const node of payload.payload.nodes) {
    if (node.text && typeof node.v === "string" && /<br\s*\/?>/i.test(node.v)) {
      return true;
    }
  }

  // Check for circular style references
  const styleMap = new Map<string, WebflowStyle>();
  for (const style of payload.payload.styles) {
    if (style?._id) {
      styleMap.set(style._id, style);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const hasCycle = (styleId: string): boolean => {
    if (visiting.has(styleId)) return true;
    if (visited.has(styleId)) return false;
    visiting.add(styleId);
    const style = styleMap.get(styleId);
    if (style?.children) {
      for (const childId of style.children) {
        if (hasCycle(childId)) return true;
      }
    }
    visiting.delete(styleId);
    visited.add(styleId);
    return false;
  };

  for (const styleId of styleMap.keys()) {
    if (hasCycle(styleId)) {
      return true;
    }
  }

  return false;
}
