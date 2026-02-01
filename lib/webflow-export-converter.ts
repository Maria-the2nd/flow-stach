/**
 * Webflow Export Converter
 *
 * Thin wrapper around the main converter for Webflow-exported templates.
 * Since Webflow exports are already Webflow-native, we:
 * - Use reduced normalization
 * - Preserve data-w-* attributes (interaction IDs)
 * - Keep CSS variables as-is
 * - Preserve Webflow framework classes
 */

import { type WebflowExportResult, getDetectedLibraries } from './webflow-export-parser'
import { convertHtmlCssToWebflow, type WebflowPayload } from './webflow-converter'

// ============================================
// TYPES
// ============================================

export interface MarketplacePayload {
  /** The Webflow JSON payload for copy-paste */
  webflowJson: string
  /** CSS to add via HTML embed or page head code */
  cssEmbed: string
  /** JavaScript to add via page settings */
  jsEmbed: string
  /** External library CDN URLs */
  libraryImports: {
    scripts: string[]
    styles: string[]
  }
  /** Detected library names for display */
  detectedLibraries: string[]
  /** Metadata about the conversion */
  meta: {
    /** Original page title */
    title: string
    /** Webflow page ID */
    pageId: string
    /** Webflow site ID */
    siteId: string
    /** Number of fonts that need manual installation */
    fontCount: number
    /** Number of images */
    imageCount: number
    /** Warnings from conversion */
    warnings: string[]
  }
}

// ============================================
// MAIN CONVERTER
// ============================================

/**
 * Convert a parsed Webflow export to marketplace payload format
 */
export function convertWebflowExportToPayload(
  parsed: WebflowExportResult
): MarketplacePayload {
  // Since this is a Webflow export, the CSS is already Webflow-compatible
  // We can use the main converter with the webflow-export source option
  const webflowPayload = convertHtmlCssToWebflow(
    parsed.html,
    parsed.projectCss,
    { source: 'webflow-export' }
  )

  // Combine inline scripts for jsEmbed
  const jsEmbed = parsed.inlineScripts.length > 0
    ? parsed.inlineScripts.join('\n\n')
    : ''

  // Get detected libraries
  const detectedLibraries = getDetectedLibraries(parsed)

  // Extract CSS embed from the converter result (if any)
  // For Webflow exports, the projectCss IS the embed CSS
  // The converter may have routed some to native and some to embed
  let cssEmbed = parsed.projectCss

  // If the converter extracted embed CSS, prefer that
  if (webflowPayload.embedCSS) {
    // The converter wraps in <style> tags, but we want raw CSS for storage
    cssEmbed = unwrapStyleTag(webflowPayload.embedCSS)
  }

  return {
    webflowJson: JSON.stringify(webflowPayload, null, 2),
    cssEmbed,
    jsEmbed,
    libraryImports: parsed.libraryImports,
    detectedLibraries,
    meta: {
      title: parsed.metadata.title,
      pageId: parsed.metadata.pageId,
      siteId: parsed.metadata.siteId,
      fontCount: parsed.fonts.length,
      imageCount: parsed.images.length,
      warnings: parsed.warnings,
    },
  }
}

/**
 * Convert Webflow export directly to the format needed for database storage
 */
export function convertWebflowExportForStorage(
  parsed: WebflowExportResult
): {
  webflowJson: string
  cssEmbed: string | undefined
  jsEmbed: string | undefined
  libraryImports: { scripts: string[]; styles: string[] }
  detectedLibraries: string[]
  hasEmbeds: boolean
} {
  const payload = convertWebflowExportToPayload(parsed)

  return {
    webflowJson: payload.webflowJson,
    cssEmbed: payload.cssEmbed || undefined,
    jsEmbed: payload.jsEmbed || undefined,
    libraryImports: payload.libraryImports,
    detectedLibraries: payload.detectedLibraries,
    hasEmbeds: !!(payload.cssEmbed || payload.jsEmbed),
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Remove <style> wrapper tags from CSS content
 */
function unwrapStyleTag(css: string): string {
  // Match <style>...</style> with optional attributes
  const styleMatch = css.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (styleMatch) {
    return styleMatch[1].trim()
  }
  return css.trim()
}

/**
 * Validate that a Webflow export conversion produced valid output
 */
export function validateConversionResult(payload: MarketplacePayload): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for webflowJson
  if (!payload.webflowJson) {
    errors.push('No Webflow JSON generated')
  } else {
    try {
      const parsed = JSON.parse(payload.webflowJson) as WebflowPayload
      if (!parsed.payload?.nodes || parsed.payload.nodes.length === 0) {
        warnings.push('Webflow JSON has no nodes')
      }
      if (!parsed.payload?.styles || parsed.payload.styles.length === 0) {
        warnings.push('Webflow JSON has no styles')
      }
    } catch {
      errors.push('Invalid Webflow JSON format')
    }
  }

  // Check metadata
  if (!payload.meta.pageId) {
    warnings.push('No Webflow page ID found (data-wf-page)')
  }
  if (!payload.meta.siteId) {
    warnings.push('No Webflow site ID found (data-wf-site)')
  }

  // Add warnings from conversion
  warnings.push(...payload.meta.warnings)

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Generate a summary of what was extracted for display
 */
export function generateConversionSummary(payload: MarketplacePayload): string[] {
  const summary: string[] = []

  // Parse webflowJson to get stats
  try {
    const parsed = JSON.parse(payload.webflowJson) as WebflowPayload
    const nodeCount = parsed.payload?.nodes?.length ?? 0
    const styleCount = parsed.payload?.styles?.length ?? 0
    summary.push(`${nodeCount} element${nodeCount !== 1 ? 's' : ''}, ${styleCount} style${styleCount !== 1 ? 's' : ''}`)
  } catch {
    summary.push('Webflow JSON generated')
  }

  if (payload.cssEmbed) {
    const lines = payload.cssEmbed.split('\n').length
    summary.push(`${lines} lines of CSS embed`)
  }

  if (payload.jsEmbed) {
    const lines = payload.jsEmbed.split('\n').length
    summary.push(`${lines} lines of JavaScript embed`)
  }

  if (payload.libraryImports.scripts.length > 0) {
    summary.push(`${payload.libraryImports.scripts.length} external script${payload.libraryImports.scripts.length !== 1 ? 's' : ''}`)
  }

  if (payload.libraryImports.styles.length > 0) {
    summary.push(`${payload.libraryImports.styles.length} external stylesheet${payload.libraryImports.styles.length !== 1 ? 's' : ''}`)
  }

  if (payload.detectedLibraries.length > 0) {
    summary.push(`Libraries: ${payload.detectedLibraries.join(', ')}`)
  }

  if (payload.meta.fontCount > 0) {
    summary.push(`${payload.meta.fontCount} custom font${payload.meta.fontCount !== 1 ? 's' : ''} (manual upload required)`)
  }

  if (payload.meta.imageCount > 0) {
    summary.push(`${payload.meta.imageCount} image${payload.meta.imageCount !== 1 ? 's' : ''} (Webflow CDN URLs preserved)`)
  }

  return summary
}
