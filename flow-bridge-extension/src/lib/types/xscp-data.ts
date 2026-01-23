/**
 * Type definitions for Webflow's @webflow/XscpData clipboard format
 *
 * XscpData is the internal format Webflow uses for copy/paste operations.
 * This format includes nodes (DOM tree), styles (CSS classes), and interactions.
 */

// ============================================
// NODE TYPES
// ============================================

/**
 * Webflow node types that map to different element behaviors
 */
export type XscpNodeType =
  | 'Block'       // Generic container (div, section, etc.)
  | 'Section'     // Full-width section (rarely used - most sections are Block with tag=section)
  | 'Link'        // Anchor element
  | 'Image'       // Image element
  | 'Video'       // Video element
  | 'HtmlEmbed'   // Custom HTML embed
  | 'Heading'     // H1-H6 heading
  | 'Paragraph'   // Paragraph text
  | 'List'        // UL/OL list
  | 'ListItem'    // LI list item

/**
 * Link data for anchor elements
 */
export interface XscpLinkData {
  /** Link mode: 'external', 'page', 'section', 'email', 'phone' */
  mode: string
  /** The URL or reference */
  url: string
  /** Link target: '_blank', '_self', etc. */
  target?: string
}

/**
 * Attribute data for images
 */
export interface XscpImageAttr {
  src?: string
  alt?: string
  loading?: 'lazy' | 'eager'
  width?: string
  height?: string
}

/**
 * HTML embed data
 */
export interface XscpEmbedData {
  type: 'html' | string
  meta: {
    html: string
    div: boolean
    iframe: boolean
    script: boolean
    compilable: boolean
  }
}

/**
 * Custom attribute (data-*, aria-*, id, etc.)
 */
export interface XscpAttribute {
  name: string
  value: string
}

/**
 * Node data containing type-specific information
 */
export interface XscpNodeData {
  /** Tag name (usually same as node.tag) */
  tag?: string
  /** Is this a text container */
  text?: boolean
  /** Custom attributes (data-*, id, aria-*) */
  xattr?: XscpAttribute[]
  /** Link data for anchor elements */
  link?: XscpLinkData
  /** Image attributes */
  attr?: XscpImageAttr
  /** HTML embed data */
  embed?: XscpEmbedData
  /** Whether this is inside a rich text element */
  insideRTE?: boolean
}

/**
 * A node in the Webflow DOM tree
 */
export interface XscpNode {
  /** Unique identifier for this node */
  _id: string
  /** Node type (determines behavior and rendering) */
  type?: XscpNodeType
  /** HTML tag name */
  tag?: string
  /** Array of class names applied to this element */
  classes?: string[]
  /** Array of child node IDs */
  children?: string[]
  /** Is this a text node? */
  text?: boolean
  /** Text content (only for text nodes where text=true) */
  v?: string
  /** Type-specific data */
  data?: XscpNodeData
}

// ============================================
// STYLE TYPES
// ============================================

/**
 * Style variant (responsive breakpoint or pseudo-class)
 */
export interface XscpStyleVariant {
  /** CSS properties in styleLess format */
  styleLess: string
}

/**
 * A CSS class/style definition
 */
export interface XscpStyle {
  /** Unique identifier (often same as name) */
  _id: string
  /** Whether this is a "fake" style (generated, not user-defined) */
  fake: boolean
  /** Style type (always "class" for class-based styles) */
  type: 'class' | string
  /** Class name */
  name: string
  /** Namespace for scoping (usually empty) */
  namespace: string
  /** Combo class indicator (e.g., "." for combo classes) */
  comb: string
  /** CSS properties in styleLess format */
  styleLess: string
  /** Responsive/pseudo variants */
  variants: Record<string, XscpStyleVariant>
  /** Child style IDs (for combo classes) */
  children: string[]
}

// ============================================
// INTERACTION TYPES (for reference, ignored in MVP)
// ============================================

/**
 * Legacy interaction (ix1)
 */
export interface XscpInteractionLegacy {
  // Structure varies, not needed for MVP
  [key: string]: unknown
}

/**
 * Modern interaction structure (ix2)
 */
export interface XscpInteraction2 {
  /** Interaction definitions */
  interactions: unknown[]
  /** Event triggers */
  events: unknown[]
  /** Action lists */
  actionLists: unknown[]
}

// ============================================
// PAYLOAD TYPES
// ============================================

/**
 * Token manifest embedded in meta (optional)
 */
export interface XscpTokenManifest {
  schemaVersion: number
  namespace: string
  variables: unknown[]
  [key: string]: unknown
}

/**
 * Metadata about the payload
 */
export interface XscpMeta {
  /** Number of symbols that couldn't be linked */
  unlinkedSymbolCount: number
  /** Number of dropped link references */
  droppedLinks: number
  /** Number of removed dynamic bindings */
  dynBindRemovedCount: number
  /** Number of removed dynamic list bindings */
  dynListBindRemovedCount: number
  /** Number of removed pagination elements */
  paginationRemovedCount: number
  /** Optional design token manifest */
  tokenManifest?: XscpTokenManifest
}

/**
 * The payload containing all element and style data
 */
export interface XscpPayload {
  /** DOM tree nodes */
  nodes: XscpNode[]
  /** CSS class definitions */
  styles: XscpStyle[]
  /** External assets (images, fonts, etc.) */
  assets: unknown[]
  /** Legacy interactions */
  ix1: XscpInteractionLegacy[]
  /** Modern interactions */
  ix2: XscpInteraction2
}

/**
 * Complete XscpData structure (the clipboard format)
 */
export interface XscpData {
  /** Type identifier (must be "@webflow/XscpData") */
  type: '@webflow/XscpData'
  /** The payload containing elements and styles */
  payload: XscpPayload
  /** Metadata about the payload */
  meta: XscpMeta
}

// ============================================
// TYPE GUARDS
// ============================================

/**
 * Check if an object is a valid XscpData structure
 */
export function isXscpData(obj: unknown): obj is XscpData {
  if (!obj || typeof obj !== 'object') return false
  const data = obj as Record<string, unknown>
  return (
    data.type === '@webflow/XscpData' &&
    typeof data.payload === 'object' &&
    data.payload !== null &&
    Array.isArray((data.payload as XscpPayload).nodes) &&
    Array.isArray((data.payload as XscpPayload).styles)
  )
}

/**
 * Check if a node is a text node
 */
export function isTextNode(node: XscpNode): boolean {
  return node.text === true && typeof node.v === 'string'
}

/**
 * Check if a node is an HTML embed
 */
export function isHtmlEmbed(node: XscpNode): boolean {
  return node.type === 'HtmlEmbed' || !!node.data?.embed
}

/**
 * Get text content from a text node
 */
export function getTextContent(node: XscpNode): string | null {
  if (isTextNode(node)) {
    return node.v ?? null
  }
  return null
}
