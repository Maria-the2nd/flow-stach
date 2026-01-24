/**
 * JSX to HTML Converter
 * Converts parsed JSX content to plain HTML + vanilla JavaScript
 */

import type { ParsedComponent, ReactPattern } from './jsx-parser'

// ============================================
// TYPES
// ============================================

export interface ConversionResult {
  /** The converted HTML */
  html: string
  /** Generated vanilla JavaScript */
  javascript: string
  /** Combined CSS from all sources */
  css: string
  /** Warnings about conversion */
  warnings: string[]
}

export interface ConversionContext {
  /** Map of component names to their HTML output */
  componentMap: Map<string, string>
  /** All CSS content combined */
  cssContent: string[]
  /** Generated event handlers */
  eventHandlers: EventHandler[]
  /** Counter for generating unique IDs */
  idCounter: number
  /** Warnings accumulated during conversion */
  warnings: string[]
}

interface EventHandler {
  selector: string
  event: string
  handler: string
}

// ============================================
// JSX SYNTAX CONVERSION
// ============================================

/**
 * Convert JSX attributes to HTML attributes
 */
function convertJsxAttributes(jsx: string): string {
  let html = jsx

  // className → class
  html = html.replace(/\bclassName=/g, 'class=')

  // htmlFor → for
  html = html.replace(/\bhtmlFor=/g, 'for=')

  // Remove JSX expression braces for simple string values
  // e.g., prop={"value"} → prop="value"
  html = html.replace(/=\{["']([^"']+)["']\}/g, '="$1"')

  // Convert self-closing tags to proper HTML
  // <img ... /> is valid HTML5, but <div /> is not
  const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']

  // For non-void elements, convert self-closing to open/close
  html = html.replace(/<(\w+)([^>]*?)\/>/g, (match, tag, attrs) => {
    if (voidElements.includes(tag.toLowerCase())) {
      return match // Keep self-closing for void elements
    }
    return `<${tag}${attrs}></${tag}>`
  })

  return html
}

/**
 * Remove JSX expressions that can't be converted to static HTML
 */
function removeJsxExpressions(jsx: string): string {
  let html = jsx

  // Remove event handlers but track them for JS generation
  html = html.replace(/\s(on[A-Z]\w+)=\{([^}]+)\}/g, (_match, _event, _handler) => {
    void _match
    void _event
    void _handler
    // We'll handle these separately
    return ''
  })

  // Remove style objects (complex to convert)
  html = html.replace(/\sstyle=\{[^}]+\}/g, '')

  // Remove spread operators
  html = html.replace(/\s\{\.\.\.[\w.]+\}/g, '')

  // Convert simple variable expressions to placeholders
  // {variable} → [variable]
  html = html.replace(/\{(\w+)\}/g, (_match, varName) => {
    // Check if it's a simple variable reference (not a function call)
    if (!/[().]/.test(varName)) {
      return `<!-- {${varName}} -->`
    }
    return ''
  })

  // Remove complex expressions entirely
  html = html.replace(/\{[^}]+\}/g, '')

  return html
}

/**
 * Convert conditional rendering to HTML with comments
 */
function convertConditionals(jsx: string): string {
  let html = jsx

  // {condition && <element>} → <element> with comment
  html = html.replace(/\{(\w+)\s*&&\s*(<[^}]+>)\}/g, (_match, condition, element) => {
    return `<!-- if ${condition} -->${element}<!-- endif -->`
  })

  // {condition ? <a> : <b>} → first option with comment
  html = html.replace(/\{(\w+)\s*\?\s*(<[^:]+>)\s*:\s*(<[^}]+>)\}/g, (_match, condition, ifTrue, ifFalse) => {
    return `<!-- if ${condition} -->${ifTrue}<!-- else -->${ifFalse}<!-- endif -->`
  })

  return html
}

/**
 * Convert array mapping to repeated elements
 */
function convertArrayMaps(jsx: string): string {
  let html = jsx

  // {items.map(...)} → comment indicating dynamic content
  html = html.replace(/\{[\w.]+\.map\([^)]+\)\s*=>\s*\([^)]+\)\}/g, () => {
    return '<!-- Dynamic list: items rendered from array -->'
  })

  return html
}

// ============================================
// EVENT HANDLER EXTRACTION
// ============================================

/**
 * Extract event handlers from JSX and generate vanilla JS
 */
function extractEventHandlers(jsx: string, ctx: ConversionContext): { html: string; handlers: EventHandler[] } {
  const handlers: EventHandler[] = []
  let html = jsx

  // Pattern to match elements with event handlers
  const eventPattern = /<(\w+)([^>]*?)(on[A-Z]\w+)=\{([^}]+)\}([^>]*?)>/g

  html = html.replace(eventPattern, (match, tag, beforeAttrs, eventName, handler, afterAttrs) => {
    const uniqueId = `js-${ctx.idCounter++}`
    const eventType = eventName.replace(/^on/, '').toLowerCase()

    handlers.push({
      selector: `[data-handler="${uniqueId}"]`,
      event: eventType,
      handler: cleanHandlerCode(handler),
    })

    return `<${tag}${beforeAttrs} data-handler="${uniqueId}"${afterAttrs}>`
  })

  return { html, handlers }
}

/**
 * Clean handler code for vanilla JS
 */
function cleanHandlerCode(handler: string): string {
  let code = handler.trim()

  // Remove arrow function wrapper if present
  // () => doSomething() → doSomething()
  code = code.replace(/^\(\)\s*=>\s*/, '')

  // (e) => doSomething(e) → function(e) { doSomething(e) }
  code = code.replace(/^\((\w+)\)\s*=>\s*(.+)$/, 'function($1) { $2 }')

  // Handle setState patterns
  // setCount(count + 1) → // setState: count + 1
  code = code.replace(/set(\w+)\(([^)]+)\)/g, '// Update state: $1 = $2')

  return code
}

// ============================================
// COMPONENT RESOLUTION
// ============================================

/**
 * Resolve component references to their HTML
 */
function resolveComponents(jsx: string, ctx: ConversionContext): string {
  let html = jsx

  // Find component usage: <ComponentName ... />
  // Components start with uppercase
  const componentPattern = /<([A-Z]\w+)([^>]*?)(?:\/>|>([^<]*)<\/\1>)/g

  html = html.replace(componentPattern, (match, componentName, attrs, children) => {
    const componentHtml = ctx.componentMap.get(componentName)

    if (componentHtml) {
      // If we have the component's HTML, use it
      let result = componentHtml

      // If there are children, try to inject them
      if (children) {
        result = result.replace(/\{children\}|<!-- children -->/, children)
      }

      return result
    } else {
      // Mark as unresolved component
      ctx.warnings.push(`Component <${componentName}> not found - rendered as div`)
      return `<div class="${componentName.toLowerCase()}"${attrs ? ' ' + convertJsxAttributes(attrs.trim()) : ''}>${children || ''}</div>`
    }
  })

  return html
}

// ============================================
// JAVASCRIPT GENERATION
// ============================================

/**
 * Generate vanilla JavaScript from React patterns
 */
function generateJavaScript(patterns: ReactPattern[], handlers: EventHandler[]): string {
  const lines: string[] = []

  // Add DOMContentLoaded wrapper
  lines.push('document.addEventListener("DOMContentLoaded", function() {')

  // Add event listeners
  for (const handler of handlers) {
    lines.push(`  // Event handler`)
    lines.push(`  const el = document.querySelector('${handler.selector}');`)
    lines.push(`  if (el) {`)
    lines.push(`    el.addEventListener('${handler.event}', ${handler.handler});`)
    lines.push(`  }`)
    lines.push('')
  }

  // Add pattern-based code
  for (const pattern of patterns) {
    if (pattern.type === 'useEffect' && pattern.canConvert) {
      lines.push(`  // Effect converted from useEffect`)
      lines.push(`  // ${pattern.suggestion}`)
    }
    if (pattern.type === 'useRef' && pattern.canConvert) {
      lines.push(`  // Ref converted from useRef`)
      lines.push(`  // Use document.querySelector() instead`)
    }
  }

  lines.push('});')

  // Only return if there's actual content
  if (handlers.length > 0 || patterns.some(p => p.canConvert)) {
    return lines.join('\n')
  }

  return ''
}

// ============================================
// MAIN CONVERTER
// ============================================

/**
 * Convert a parsed React component to HTML + JS + CSS
 */
export function convertJsxToHtml(
  component: ParsedComponent,
  dependencies: Map<string, ParsedComponent> = new Map(),
  cssFiles: string[] = []
): ConversionResult {
  const ctx: ConversionContext = {
    componentMap: new Map(),
    cssContent: [...cssFiles],
    eventHandlers: [],
    idCounter: 1,
    warnings: [...component.warnings],
  }

  // Build component map from dependencies
  for (const [, dep] of dependencies) {
    if (dep.jsxContent) {
      // Recursively convert child components first
      const childResult = convertJsxToHtml(dep, new Map(), [])
      ctx.componentMap.set(dep.name, childResult.html)
      ctx.cssContent.push(childResult.css)
    }
  }

  let html = component.jsxContent

  if (!html) {
    return {
      html: '',
      javascript: '',
      css: ctx.cssContent.join('\n\n'),
      warnings: ['No JSX content found to convert'],
    }
  }

  // Step 1: Extract event handlers before removing them
  const handlerResult = extractEventHandlers(html, ctx)
  html = handlerResult.html
  ctx.eventHandlers = handlerResult.handlers

  // Step 2: Resolve component references
  html = resolveComponents(html, ctx)

  // Step 3: Convert JSX-specific syntax
  html = convertJsxAttributes(html)
  html = convertConditionals(html)
  html = convertArrayMaps(html)
  html = removeJsxExpressions(html)

  // Step 4: Clean up whitespace
  html = html
    .replace(/\n\s*\n/g, '\n')
    .trim()

  // Step 5: Generate JavaScript
  const javascript = generateJavaScript(component.reactPatterns, ctx.eventHandlers)

  return {
    html,
    javascript,
    css: ctx.cssContent.filter(Boolean).join('\n\n'),
    warnings: ctx.warnings,
  }
}

/**
 * Convert multiple components and combine into final output
 */
export function convertReactToWebflow(
  mainComponent: ParsedComponent,
  dependencies: Map<string, ParsedComponent>,
  cssFiles: string[]
): ConversionResult {
  const result = convertJsxToHtml(mainComponent, dependencies, cssFiles)

  // Wrap in a root div if not already wrapped
  let finalHtml = result.html
  if (!finalHtml.trim().startsWith('<')) {
    finalHtml = `<div class="converted-component">${finalHtml}</div>`
  }

  // Add component name as a wrapper class
  if (mainComponent.name && mainComponent.name !== 'Component') {
    const rootMatch = finalHtml.match(/^<(\w+)/)
    if (rootMatch) {
      const tag = rootMatch[1]
      const className = mainComponent.name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')

      if (finalHtml.includes('class="')) {
        finalHtml = finalHtml.replace(/class="/, `class="${className} `)
      } else {
        finalHtml = finalHtml.replace(`<${tag}`, `<${tag} class="${className}"`)
      }
    }
  }

  return {
    ...result,
    html: finalHtml,
  }
}

/**
 * Generate a complete HTML document from conversion result
 */
export function generateHtmlDocument(result: ConversionResult, title: string = 'Converted Component'): string {
  const lines: string[] = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${title}</title>`,
  ]

  if (result.css) {
    lines.push('  <style>')
    lines.push(result.css.split('\n').map(l => '    ' + l).join('\n'))
    lines.push('  </style>')
  }

  lines.push('</head>')
  lines.push('<body>')
  lines.push(result.html.split('\n').map(l => '  ' + l).join('\n'))

  if (result.javascript) {
    lines.push('  <script>')
    lines.push(result.javascript.split('\n').map(l => '    ' + l).join('\n'))
    lines.push('  </script>')
  }

  lines.push('</body>')
  lines.push('</html>')

  return lines.join('\n')
}
