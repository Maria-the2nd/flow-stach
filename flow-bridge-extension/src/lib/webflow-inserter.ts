/**
 * Webflow Designer Extension Insertion Pipeline
 *
 * Converts XscpData JSON payloads into Webflow elements using the Designer Extension API.
 * This replaces the clipboard-based "copy/paste into Webflow" flow with direct element insertion.
 *
 * @see https://docs.developers.webflow.com/v2.0.0/docs/designer-extensions
 */

import type { XscpData, XscpNode, XscpStyle } from './types/xscp-data'
import { mapTagToPreset } from './preset-mapper'
import { parseStyleLess } from './style-parser'

// ============================================
// TYPES
// ============================================

export interface InsertionResult {
  success: boolean
  insertedCount: number
  stylesCreated: number
  errors: string[]
  warnings: string[]
  rootElementId?: string
}

export interface InsertionOptions {
  /** Target element to insert into/after. If null, uses selected or root element */
  targetElement?: unknown
  /** Insert as child (true) or sibling (false). Default: true if target supports children */
  insertAsChild?: boolean
}

// Type definitions for Webflow Designer API
// These are simplified versions - the actual API types come from @webflow/designer-extension-typings
interface WebflowAPI {
  getSelectedElement(): Promise<WebflowElement | null>
  getRootElement(): Promise<WebflowElement | null>
  elementBuilder(preset: unknown): BuilderElement
  elementPresets: Record<string, unknown>
  getStyleByName(name: string): Promise<WebflowStyle | null>
  createStyle(name: string): Promise<WebflowStyle>
  notify(options: { type: 'Info' | 'Success' | 'Error'; message: string }): void
}

interface WebflowElement {
  id: string
  type: string
  children?: WebflowElement[]
  append?(element: BuilderElement): Promise<WebflowElement>
  prepend?(element: BuilderElement): Promise<WebflowElement>
  after?(element: BuilderElement): Promise<WebflowElement>
  before?(element: BuilderElement): Promise<WebflowElement>
  setTag?(tag: string): Promise<void>
  setTextContent?(text: string): Promise<void>
  setStyles?(styles: WebflowStyle[]): Promise<void>
  setAttribute?(name: string, value: string): Promise<void>
  setCustomAttribute?(name: string, value: string): Promise<void>
}

interface BuilderElement {
  setTag?(tag: string): BuilderElement
  setTextContent?(text: string): BuilderElement
  setChildren?(children: BuilderElement[]): BuilderElement
  setAttribute?(name: string, value: string): BuilderElement
}

interface WebflowStyle {
  id: string
  name: string
  setProperties(
    properties: Record<string, string>,
    options?: { breakpoint?: string; pseudo?: string }
  ): Promise<void>
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate XscpData JSON structure before processing
 */
export function validateXscpData(json: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!json || typeof json !== 'object') {
    errors.push('Invalid JSON: must be an object')
    return { valid: false, errors }
  }

  const data = json as Record<string, unknown>

  // Check type field
  if (data.type !== '@webflow/XscpData') {
    errors.push(`Invalid type: expected "@webflow/XscpData", got "${data.type}"`)
  }

  // Check payload structure
  if (!data.payload || typeof data.payload !== 'object') {
    errors.push('Missing or invalid "payload" field')
    return { valid: false, errors }
  }

  const payload = data.payload as Record<string, unknown>

  // Check nodes array
  if (!Array.isArray(payload.nodes)) {
    errors.push('Missing or invalid "payload.nodes" array')
  }

  // Check styles array
  if (!Array.isArray(payload.styles)) {
    errors.push('Missing or invalid "payload.styles" array')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Parse and validate XscpData JSON string
 */
export function parseXscpJson(jsonString: string): { data: XscpData | null; errors: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonString)
  } catch (e) {
    return { data: null, errors: [`JSON parse error: ${(e as Error).message}`] }
  }

  const validation = validateXscpData(parsed)
  if (!validation.valid) {
    return { data: null, errors: validation.errors }
  }

  return { data: parsed as XscpData, errors: [] }
}

// ============================================
// STYLE CREATION
// ============================================

/**
 * Create or retrieve a Webflow style by name
 */
async function getOrCreateStyle(
  webflow: WebflowAPI,
  name: string
): Promise<WebflowStyle | null> {
  try {
    // Try to get existing style first
    const existing = await webflow.getStyleByName(name)
    if (existing) {
      return existing
    }

    // Create new style
    return await webflow.createStyle(name)
  } catch (e) {
    console.error(`Failed to get/create style "${name}":`, e)
    return null
  }
}

/**
 * Apply styleLess properties to a Webflow style
 */
async function applyStyleProperties(
  style: WebflowStyle,
  styleLess: string,
  options: { breakpoint?: string; pseudo?: string } = {}
): Promise<string[]> {
  const warnings: string[] = []

  const { properties, warnings: parseWarnings } = parseStyleLess(styleLess)
  warnings.push(...parseWarnings)

  if (properties.length === 0) {
    return warnings
  }

  // Convert to property map
  const propMap: Record<string, string> = {}
  for (const prop of properties) {
    propMap[prop.property] = prop.value
  }

  try {
    await style.setProperties(propMap, {
      breakpoint: options.breakpoint || 'main',
      pseudo: options.pseudo,
    })
  } catch (e) {
    warnings.push(`Failed to set properties on style "${style.name}": ${(e as Error).message}`)
  }

  return warnings
}

/**
 * Process all styles from XscpData payload
 */
async function processStyles(
  webflow: WebflowAPI,
  styles: XscpStyle[]
): Promise<{
  styleMap: Map<string, WebflowStyle>
  warnings: string[]
  created: number
}> {
  const styleMap = new Map<string, WebflowStyle>()
  const warnings: string[] = []
  let created = 0

  for (const xscpStyle of styles) {
    const style = await getOrCreateStyle(webflow, xscpStyle.name)
    if (!style) {
      warnings.push(`Could not create/retrieve style: ${xscpStyle.name}`)
      continue
    }

    styleMap.set(xscpStyle.name, style)
    created++

    // Apply main styles
    if (xscpStyle.styleLess) {
      const mainWarnings = await applyStyleProperties(style, xscpStyle.styleLess)
      warnings.push(...mainWarnings)
    }

    // Apply variants (pseudo-states and breakpoints)
    if (xscpStyle.variants) {
      for (const [variantKey, variant] of Object.entries(xscpStyle.variants)) {
        if (!variant.styleLess) continue

        // Determine if this is a pseudo-class variant
        const pseudoClasses = ['hover', 'focus', 'active', 'visited', 'focus-visible', 'focus-within']
        const isPseudo = pseudoClasses.includes(variantKey.toLowerCase())

        const variantWarnings = await applyStyleProperties(style, variant.styleLess, {
          breakpoint: isPseudo ? 'main' : variantKey,
          pseudo: isPseudo ? variantKey : undefined,
        })
        warnings.push(...variantWarnings.map((w) => `${xscpStyle.name}@${variantKey}: ${w}`))
      }
    }
  }

  return { styleMap, warnings, created }
}

// ============================================
// ELEMENT BUILDING
// ============================================

/**
 * Build a Webflow element from an XscpNode
 */
function buildElement(
  webflow: WebflowAPI,
  node: XscpNode,
  nodeMap: Map<string, XscpNode>
): BuilderElement | null {
  // Skip text nodes - they're handled separately as text content
  if (node.text === true) {
    return null
  }

  // Map tag/type to Webflow preset
  const mapping = mapTagToPreset(node.tag || 'div', node.type)
  const preset = webflow.elementPresets[mapping.preset]

  if (!preset) {
    console.warn(`Unknown preset: ${mapping.preset}, falling back to DivBlock`)
    const fallbackPreset = webflow.elementPresets.DivBlock
    if (!fallbackPreset) {
      return null
    }
  }

  const builder = webflow.elementBuilder(preset || webflow.elementPresets.DivBlock)

  // Set tag if different from preset default
  if (node.tag && builder.setTag && mapping.requiresTagOverride) {
    builder.setTag(node.tag)
  }

  // Build children recursively
  if (node.children && node.children.length > 0 && builder.setChildren) {
    const childBuilders: BuilderElement[] = []

    for (const childId of node.children) {
      const childNode = nodeMap.get(childId)
      if (!childNode) continue

      // Handle text nodes
      if (childNode.text === true && childNode.v) {
        // Text content will be set after insertion
        continue
      }

      const childBuilder = buildElement(webflow, childNode, nodeMap)
      if (childBuilder) {
        childBuilders.push(childBuilder)
      }
    }

    if (childBuilders.length > 0) {
      builder.setChildren(childBuilders)
    }
  }

  return builder
}

/**
 * Apply attributes to an inserted element
 */
async function applyAttributes(
  element: WebflowElement,
  node: XscpNode,
  warnings: string[]
): Promise<void> {
  // Apply xattr (custom attributes like data-*, id, aria-*)
  if (node.data?.xattr && element.setCustomAttribute) {
    for (const attr of node.data.xattr) {
      try {
        await element.setCustomAttribute(attr.name, attr.value)
      } catch (e) {
        warnings.push(`Failed to set attribute ${attr.name}: ${(e as Error).message}`)
      }
    }
  }

  // Apply link data for anchors
  if (node.data?.link && element.setAttribute) {
    try {
      await element.setAttribute('href', node.data.link.url || '#')
      if (node.data.link.target) {
        await element.setAttribute('target', node.data.link.target)
      }
    } catch (e) {
      warnings.push(`Failed to set link attributes: ${(e as Error).message}`)
    }
  }

  // Apply image attributes
  if (node.data?.attr && element.setAttribute) {
    if (node.data.attr.src) {
      try {
        await element.setAttribute('src', node.data.attr.src)
      } catch (e) {
        warnings.push(`Failed to set image src: ${(e as Error).message}`)
      }
    }
    if (node.data.attr.alt) {
      try {
        await element.setAttribute('alt', node.data.attr.alt)
      } catch (e) {
        warnings.push(`Failed to set image alt: ${(e as Error).message}`)
      }
    }
  }
}

/**
 * Apply text content to text node children
 */
async function applyTextContent(
  element: WebflowElement,
  node: XscpNode,
  nodeMap: Map<string, XscpNode>,
  warnings: string[]
): Promise<void> {
  if (!node.children || !element.setTextContent) return

  for (const childId of node.children) {
    const childNode = nodeMap.get(childId)
    if (childNode?.text === true && childNode.v) {
      try {
        await element.setTextContent(childNode.v)
        // Only apply first text node (Webflow elements have single text content)
        break
      } catch (e) {
        warnings.push(`Failed to set text content: ${(e as Error).message}`)
      }
    }
  }
}

/**
 * Apply styles to an inserted element
 */
async function applyStylesToElement(
  element: WebflowElement,
  node: XscpNode,
  styleMap: Map<string, WebflowStyle>,
  warnings: string[]
): Promise<void> {
  if (!node.classes || node.classes.length === 0 || !element.setStyles) {
    return
  }

  const styles: WebflowStyle[] = []
  for (const className of node.classes) {
    // Skip Webflow layout classes (they're applied automatically)
    if (className === 'w-layout-grid') continue

    const style = styleMap.get(className)
    if (style) {
      styles.push(style)
    } else {
      warnings.push(`Style "${className}" not found in style map`)
    }
  }

  if (styles.length > 0) {
    try {
      await element.setStyles(styles)
    } catch (e) {
      warnings.push(`Failed to apply styles: ${(e as Error).message}`)
    }
  }
}

// ============================================
// MAIN INSERTION LOGIC
// ============================================

/**
 * Find the root node(s) in the XscpData payload
 * Root nodes are those that aren't referenced as children by any other node
 */
function findRootNodes(nodes: XscpNode[]): XscpNode[] {
  const childIds = new Set<string>()

  for (const node of nodes) {
    if (node.children) {
      for (const childId of node.children) {
        childIds.add(childId)
      }
    }
  }

  // Root nodes are those not referenced as children
  return nodes.filter((n) => !childIds.has(n._id) && !n.text)
}

/**
 * Insert XscpData elements into the Webflow canvas
 *
 * This is the main entry point for the insertion pipeline.
 */
export async function insertXscpData(
  webflow: WebflowAPI,
  data: XscpData,
  options: InsertionOptions = {}
): Promise<InsertionResult> {
  const result: InsertionResult = {
    success: false,
    insertedCount: 0,
    stylesCreated: 0,
    errors: [],
    warnings: [],
  }

  try {
    // 1. Find target element
    let target: WebflowElement | null = options.targetElement as WebflowElement | null

    if (!target) {
      // Try selected element first
      target = await webflow.getSelectedElement()
    }

    if (!target) {
      // Fallback to root element
      target = await webflow.getRootElement()
    }

    if (!target) {
      result.errors.push('No target element found. Please select an element or ensure the page has a root element.')
      return result
    }

    // 2. Process styles first (they must exist before attaching to elements)
    const { styleMap, warnings: styleWarnings, created } = await processStyles(
      webflow,
      data.payload.styles
    )
    result.stylesCreated = created
    result.warnings.push(...styleWarnings)

    // 3. Build node lookup map
    const nodeMap = new Map<string, XscpNode>()
    for (const node of data.payload.nodes) {
      nodeMap.set(node._id, node)
    }

    // 4. Find root nodes to insert
    const rootNodes = findRootNodes(data.payload.nodes)

    if (rootNodes.length === 0) {
      result.errors.push('No root nodes found in payload')
      return result
    }

    // 5. Insert each root node
    for (const rootNode of rootNodes) {
      const builder = buildElement(webflow, rootNode, nodeMap)
      if (!builder) {
        result.warnings.push(`Could not build element for node: ${rootNode._id}`)
        continue
      }

      // Determine insert method
      let insertedElement: WebflowElement | null = null

      // Check if target supports children (has append method)
      const canAppend = typeof target.append === 'function'
      const shouldInsertAsChild = options.insertAsChild ?? canAppend

      try {
        if (shouldInsertAsChild && target.append) {
          insertedElement = await target.append(builder)
        } else if (target.after) {
          insertedElement = await target.after(builder)
        } else {
          result.errors.push('Target element does not support insertion')
          continue
        }
      } catch (e) {
        result.errors.push(`Failed to insert element: ${(e as Error).message}`)
        continue
      }

      if (!insertedElement) {
        result.warnings.push(`Element insertion returned null for node: ${rootNode._id}`)
        continue
      }

      result.insertedCount++
      if (!result.rootElementId) {
        result.rootElementId = insertedElement.id
      }

      // 6. Apply attributes, text content, and styles to inserted element
      await applyAttributes(insertedElement, rootNode, result.warnings)
      await applyTextContent(insertedElement, rootNode, nodeMap, result.warnings)
      await applyStylesToElement(insertedElement, rootNode, styleMap, result.warnings)
    }

    result.success = result.insertedCount > 0

    // Notify user
    if (result.success) {
      webflow.notify({
        type: 'Success',
        message: `Inserted ${result.insertedCount} element(s) with ${result.stylesCreated} style(s)`,
      })
    } else {
      webflow.notify({
        type: 'Error',
        message: result.errors[0] || 'Insertion failed',
      })
    }
  } catch (e) {
    result.errors.push(`Unexpected error: ${(e as Error).message}`)
    webflow.notify({
      type: 'Error',
      message: `Insertion failed: ${(e as Error).message}`,
    })
  }

  return result
}
