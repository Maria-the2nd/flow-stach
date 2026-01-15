/**
 * Gradient Sanitizer for Webflow Import
 * 
 * Webflow has limited support for gradients:
 * - CSS variables inside gradients often fail
 * - Decimal percentages get rounded/reordered
 * - Complex gradient syntax may be dropped
 * 
 * This module sanitizes gradients for maximum Webflow compatibility.
 */

export interface GradientSanitizeResult {
    css: string
    sanitizedCount: number
    warnings: string[]
}

/**
 * Resolve CSS variable references to their actual values
 */
function resolveVarInValue(
    value: string,
    cssVariables: Record<string, string>
): string {
    // Match var(--name) or var(--name, fallback)
    const varRegex = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\s*\)/g

    let resolved = value
    let match
    let iterations = 0
    const maxIterations = 10 // Prevent infinite loops from circular refs

    while ((match = varRegex.exec(resolved)) !== null && iterations < maxIterations) {
        const [fullMatch, varName, fallback] = match
        const resolvedValue = cssVariables[varName] || fallback?.trim() || ''

        if (resolvedValue) {
            resolved = resolved.replace(fullMatch, resolvedValue)
            varRegex.lastIndex = 0 // Reset regex to catch nested vars
        }
        iterations++
    }

    return resolved
}

/**
 * Round percentage stops to whole numbers
 * e.g., "12.375%" -> "12%"
 */
function roundPercentageStops(gradient: string): string {
    return gradient.replace(
        /(\d+(?:\.\d+)?)\s*%/g,
        (_, num) => `${Math.round(parseFloat(num))}%`
    )
}

/**
 * Normalize color formats to hex where possible
 */
function normalizeColorToHex(color: string): string {
    // Already hex
    if (/^#[0-9a-fA-F]{3,8}$/.test(color.trim())) {
        return color.trim()
    }

    // RGB/RGBA to hex
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)/)
    if (rgbMatch) {
        const [, r, g, b] = rgbMatch
        const toHex = (n: string) => parseInt(n).toString(16).padStart(2, '0')
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }

    // HSL to hex (simplified - Webflow prefers hex)
    const hslMatch = color.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*[\d.]+)?\s*\)/)
    if (hslMatch) {
        const [, h, s, l] = hslMatch.map(parseFloat)
        const hex = hslToHex(h, s, l)
        return hex
    }

    return color
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
    s /= 100
    l /= 100

    const c = (1 - Math.abs(2 * l - 1)) * s
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = l - c / 2

    let r = 0, g = 0, b = 0

    if (h < 60) { r = c; g = x; b = 0 }
    else if (h < 120) { r = x; g = c; b = 0 }
    else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c }
    else if (h < 300) { r = x; g = 0; b = c }
    else { r = c; g = 0; b = x }

    const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * Sanitize a single gradient value
 */
function sanitizeGradient(
    gradient: string,
    cssVariables: Record<string, string>
): { sanitized: string; hadVars: boolean } {
    let result = gradient
    let hadVars = false

    // 1. Resolve CSS variables
    if (result.includes('var(')) {
        result = resolveVarInValue(result, cssVariables)
        hadVars = true
    }

    // 2. Round percentage stops
    result = roundPercentageStops(result)

    // 3. Try to normalize colors in gradient
    // Match color stops in gradient
    result = result.replace(
        /(linear-gradient|radial-gradient)\s*\(\s*([^,]+)\s*,\s*(.+)\s*\)/gi,
        (match, type, direction, stops) => {
            // Process each color stop
            const processedStops = stops
                .split(/\s*,\s*/)
                .map((stop: string) => {
                    // Split color from position
                    const parts = stop.trim().split(/\s+/)
                    if (parts.length > 0) {
                        parts[0] = normalizeColorToHex(parts[0])
                    }
                    return parts.join(' ')
                })
                .join(', ')

            return `${type}(${direction}, ${processedStops})`
        }
    )

    return { sanitized: result, hadVars }
}

/**
 * Extract CSS variables from CSS content
 */
export function extractCssVariablesFromCss(css: string): Record<string, string> {
    const variables: Record<string, string> = {}

    // Match :root { --var: value; } or * { --var: value; }
    const rootRegex = /(?::root|\*)[\s\S]*?\{([^}]+)\}/gi
    let match

    while ((match = rootRegex.exec(css)) !== null) {
        const block = match[1]
        const varRegex = /(--[\w-]+)\s*:\s*([^;]+)/g
        let varMatch

        while ((varMatch = varRegex.exec(block)) !== null) {
            const [, name, value] = varMatch
            variables[name] = value.trim()
        }
    }

    // Also check for variables in any selector
    const allVarRegex = /(--[\w-]+)\s*:\s*([^;]+)/g
    while ((match = allVarRegex.exec(css)) !== null) {
        const [, name, value] = match
        if (!variables[name]) {
            variables[name] = value.trim()
        }
    }

    return variables
}

/**
 * Main function: Sanitize all gradients in CSS for Webflow compatibility
 */
export function sanitizeGradientsForWebflow(
    css: string,
    cssVariables?: Record<string, string>
): GradientSanitizeResult {
    const warnings: string[] = []
    let sanitizedCount = 0

    // Extract CSS variables if not provided
    const vars = cssVariables || extractCssVariablesFromCss(css)

    // Regex to match gradient declarations
    const gradientRegex = /((?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\([^;]+\))/gi

    const result = css.replace(gradientRegex, (match) => {
        const { sanitized, hadVars } = sanitizeGradient(match, vars)

        if (sanitized !== match) {
            sanitizedCount++
            if (hadVars) {
                warnings.push(`Resolved CSS variables in gradient`)
            }
        }

        // Warn about unsupported gradient types
        if (match.includes('conic-gradient')) {
            warnings.push('conic-gradient may not be fully supported in Webflow')
        }
        if (match.includes('repeating-')) {
            warnings.push('repeating gradients may not be fully supported in Webflow')
        }

        return sanitized
    })

    return {
        css: result,
        sanitizedCount,
        warnings: [...new Set(warnings)] // Dedupe warnings
    }
}

/**
 * Check if CSS contains gradients that need sanitization
 */
export function hasGradientsNeedingSanitization(css: string): boolean {
    // Check for var() inside gradients
    const gradientWithVar = /gradient\s*\([^)]*var\s*\(/i
    if (gradientWithVar.test(css)) return true

    // Check for decimal percentages in gradients
    const gradientWithDecimal = /gradient\s*\([^)]*\d+\.\d+\s*%/i
    if (gradientWithDecimal.test(css)) return true

    return false
}

/**
 * Extract gradient value from a CSS property value.
 * Returns the gradient string if found, null otherwise.
 * 
 * @example
 * extractGradientFromValue('linear-gradient(red, blue)') // 'linear-gradient(red, blue)'
 * extractGradientFromValue('url(...), linear-gradient(...)') // 'linear-gradient(...)'
 * extractGradientFromValue('solid-color') // null
 */
export function extractGradientFromValue(value: string): string | null {
    if (!value) return null
    
    // Match any gradient type: linear-gradient, radial-gradient, conic-gradient, etc.
    const gradientMatch = value.match(/((?:linear|radial|conic|repeating-linear|repeating-radial)-gradient\s*\([^)]+\))/i)
    if (gradientMatch) {
        return gradientMatch[1]
    }
    
    return null
}
