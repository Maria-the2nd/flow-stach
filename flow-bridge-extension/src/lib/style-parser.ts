/**
 * Style Parser - Parse styleLess strings with defensive validation
 *
 * Webflow uses a "styleLess" format for CSS properties, which is CSS-like
 * but without semicolons between properties (they're used as delimiters).
 *
 * Example styleLess:
 * "display: flex; flex-direction: column; gap: 1rem; padding: 2rem;"
 *
 * This module parses styleLess strings into property maps while handling:
 * - Empty/invalid declarations
 * - Truncated values (e.g., "rgba(26," or values ending with "," or "(")
 * - Malformed declarations
 * - CSS variables (which Webflow doesn't support natively)
 */

// ============================================
// TYPES
// ============================================

export interface ParsedProperty {
  /** CSS property name in kebab-case (e.g., "flex-direction") */
  property: string
  /** CSS property value (e.g., "column") */
  value: string
}

export interface ParseResult {
  /** Successfully parsed properties */
  properties: ParsedProperty[]
  /** Warnings about skipped/invalid declarations */
  warnings: string[]
}

// ============================================
// VALIDATION PATTERNS
// ============================================

/**
 * Patterns that indicate a truncated/invalid value.
 * These often occur when CSS is improperly split or exported.
 */
const TRUNCATED_VALUE_PATTERNS = [
  // Ends with comma (incomplete list)
  /,\s*$/,
  // Ends with opening parenthesis (incomplete function)
  /\(\s*$/,
  // Incomplete rgba/rgb/hsla/hsl
  /rgba?\s*\(\s*\d+\s*,?\s*$/i,
  /hsla?\s*\(\s*\d+\s*,?\s*$/i,
  // Incomplete calc
  /calc\s*\(\s*$/i,
  // Incomplete var
  /var\s*\(\s*$/i,
  // Incomplete url
  /url\s*\(\s*$/i,
  // Ends with operator (incomplete calc)
  /[\+\-\*\/]\s*$/,
  // Mismatched parentheses (more opens than closes)
]

/**
 * Check if a value appears to be truncated or invalid
 */
function isValueTruncated(value: string): boolean {
  const trimmed = value.trim()

  // Check for truncation patterns
  for (const pattern of TRUNCATED_VALUE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true
    }
  }

  // Check for mismatched parentheses
  let parenCount = 0
  for (const char of trimmed) {
    if (char === '(') parenCount++
    if (char === ')') parenCount--
  }
  if (parenCount > 0) {
    return true // More opens than closes = truncated
  }

  // Check for mismatched quotes
  const singleQuotes = (trimmed.match(/'/g) || []).length
  const doubleQuotes = (trimmed.match(/"/g) || []).length
  if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
    return true
  }

  return false
}

/**
 * Check if a property name is valid CSS
 */
function isValidPropertyName(property: string): boolean {
  const trimmed = property.trim()

  // Must not be empty
  if (!trimmed) return false

  // Must start with letter, underscore, or hyphen (for vendor prefixes)
  if (!/^[a-zA-Z_-]/.test(trimmed)) return false

  // Must only contain valid characters
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return false

  return true
}

/**
 * Check if a value is empty or meaningless
 */
function isEmptyValue(value: string): boolean {
  const trimmed = value.trim()
  return (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === 'NaN' ||
    trimmed === 'none' && false // 'none' is valid
  )
}

// ============================================
// PROPERTY NORMALIZATION
// ============================================

/**
 * CSS property aliases - map non-standard or deprecated properties
 */
const PROPERTY_ALIASES: Record<string, string> = {
  // Modern gap properties to grid equivalents (Webflow uses grid-* naming)
  'row-gap': 'grid-row-gap',
  'column-gap': 'grid-column-gap',
  'gap': 'grid-gap',
}

/**
 * Properties that Webflow doesn't support or should be filtered
 */
const UNSUPPORTED_PROPERTIES = new Set([
  // Vendor prefixes we don't need (Webflow adds these automatically)
  '-moz-appearance',
  '-ms-overflow-style',
  '-o-transform',
  // Scroll behavior (handled differently in Webflow)
  'scroll-behavior',
  'scroll-snap-type',
  'scroll-snap-align',
  // Pointer events sometimes cause issues
  // 'pointer-events', // Actually, this one is useful
  // Isolation
  'isolation',
  // Container queries (not supported yet)
  'container-type',
  'container-name',
])

/**
 * Normalize a CSS property name
 */
function normalizePropertyName(property: string): string | null {
  const trimmed = property.trim().toLowerCase()

  // Check if property is unsupported
  if (UNSUPPORTED_PROPERTIES.has(trimmed)) {
    return null
  }

  // Check for CSS variables (start with --)
  if (trimmed.startsWith('--')) {
    return null // Webflow handles variables differently
  }

  // Apply aliases
  if (PROPERTY_ALIASES[trimmed]) {
    return PROPERTY_ALIASES[trimmed]
  }

  return trimmed
}

/**
 * Normalize a CSS value
 */
function normalizeValue(value: string): { value: string; warning?: string } {
  let result = value.trim()
  let warning: string | undefined

  // Remove !important (Webflow doesn't use it)
  if (result.includes('!important')) {
    result = result.replace(/!important/gi, '').trim()
    warning = 'Removed !important flag'
  }

  // Check for CSS variables
  if (result.includes('var(--')) {
    return { value: '', warning: 'Contains unresolved CSS variable' }
  }

  // Normalize whitespace
  result = result.replace(/\s+/g, ' ')

  return { value: result, warning }
}

// ============================================
// MAIN PARSER
// ============================================

/**
 * Parse a styleLess string into CSS properties.
 *
 * DEFENSIVE PARSING:
 * - Skips empty declarations
 * - Skips invalid declarations that don't contain ":" properly
 * - Skips truncated/invalid values
 * - Reports warnings for all skipped items
 *
 * @param styleLess - The styleLess string to parse
 * @returns ParseResult with properties and warnings
 */
export function parseStyleLess(styleLess: string): ParseResult {
  const properties: ParsedProperty[] = []
  const warnings: string[] = []

  if (!styleLess || typeof styleLess !== 'string') {
    return { properties, warnings }
  }

  // Split by semicolons, handling potential edge cases
  const declarations = styleLess.split(';')

  for (const declaration of declarations) {
    const trimmed = declaration.trim()

    // Skip empty declarations
    if (!trimmed) {
      continue
    }

    // Find the first colon (property separator)
    const colonIndex = trimmed.indexOf(':')

    // Skip if no colon found
    if (colonIndex === -1) {
      warnings.push(`Skipped invalid declaration (no colon): "${trimmed.substring(0, 30)}..."`)
      continue
    }

    // Extract property and value
    const rawProperty = trimmed.substring(0, colonIndex)
    const rawValue = trimmed.substring(colonIndex + 1)

    // Validate property name
    if (!isValidPropertyName(rawProperty)) {
      warnings.push(`Skipped invalid property name: "${rawProperty}"`)
      continue
    }

    // Normalize property name
    const property = normalizePropertyName(rawProperty)
    if (!property) {
      // Property was filtered (CSS variable or unsupported)
      continue
    }

    // Normalize value
    const { value, warning: valueWarning } = normalizeValue(rawValue)
    if (valueWarning) {
      warnings.push(`${property}: ${valueWarning}`)
    }

    // Skip empty values
    if (isEmptyValue(value)) {
      warnings.push(`Skipped empty value for property: "${property}"`)
      continue
    }

    // Check for truncated values
    if (isValueTruncated(value)) {
      warnings.push(`Skipped truncated value for "${property}": "${value.substring(0, 30)}..."`)
      continue
    }

    // Add to properties
    properties.push({ property, value })
  }

  return { properties, warnings }
}

/**
 * Convert parsed properties back to styleLess format
 */
export function propertiesToStyleLess(properties: ParsedProperty[]): string {
  return properties.map((p) => `${p.property}: ${p.value};`).join(' ')
}

/**
 * Convert parsed properties to a property map (for Webflow API)
 */
export function propertiesToMap(properties: ParsedProperty[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const prop of properties) {
    map[prop.property] = prop.value
  }
  return map
}

/**
 * Validate a styleLess string without parsing (quick check)
 */
export function isValidStyleLess(styleLess: string): boolean {
  if (!styleLess || typeof styleLess !== 'string') {
    return false
  }

  // Quick checks
  const trimmed = styleLess.trim()

  // Must have at least one colon
  if (!trimmed.includes(':')) {
    return false
  }

  // Shouldn't have unbalanced braces (not valid in styleLess)
  const openBraces = (trimmed.match(/\{/g) || []).length
  const closeBraces = (trimmed.match(/\}/g) || []).length
  if (openBraces !== closeBraces) {
    return false
  }

  return true
}

/**
 * Sanitize a styleLess string (remove problematic content)
 */
export function sanitizeStyleLess(styleLess: string): string {
  const { properties } = parseStyleLess(styleLess)
  return propertiesToStyleLess(properties)
}
