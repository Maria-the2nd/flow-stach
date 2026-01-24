/**
 * JSX Parser
 * Parses React component source code, detects imports, and extracts JSX structure
 */

// ============================================
// TYPES
// ============================================

export interface ImportStatement {
  /** The import path (e.g., './Button', 'react', './styles.css') */
  path: string
  /** What is being imported */
  imports: string[]
  /** Whether this is a default import */
  isDefault: boolean
  /** Whether this is a CSS/style import */
  isCssImport: boolean
  /** Whether this is a local file (starts with ./ or ../) */
  isLocalFile: boolean
  /** Whether this is a React/library import (can be ignored) */
  isLibrary: boolean
  /** The full import line */
  raw: string
}

export interface ParsedComponent {
  /** Component name (from export or function name) */
  name: string
  /** The JSX content (everything in the return statement) */
  jsxContent: string
  /** Props the component accepts */
  props: string[]
  /** All import statements */
  imports: ImportStatement[]
  /** Local file imports that need to be provided */
  missingDependencies: ImportStatement[]
  /** Any useState/useEffect patterns detected */
  reactPatterns: ReactPattern[]
  /** Warnings about the code */
  warnings: string[]
}

export interface ReactPattern {
  type: 'useState' | 'useEffect' | 'useRef' | 'useContext' | 'onClick' | 'onChange' | 'other'
  description: string
  canConvert: boolean
  suggestion: string
}

export interface FileCollection {
  /** Main component file */
  main: { name: string; content: string }
  /** Additional files provided by user */
  dependencies: Map<string, string>
}

// ============================================
// IMPORT PARSING
// ============================================

/**
 * Known library imports that don't need user files
 */
const LIBRARY_IMPORTS = new Set([
  'react',
  'react-dom',
  'next',
  'next/link',
  'next/image',
  'next/router',
  'next/navigation',
  'framer-motion',
  'gsap',
  '@gsap/react',
  'animejs',
  'lenis',
  '@studio-freight/lenis',
  'swiper',
  'swiper/react',
  'locomotive-scroll',
  'styled-components',
  '@emotion/react',
  '@emotion/styled',
  'classnames',
  'clsx',
  'tailwind-merge',
])

/**
 * Parse import statements from React code
 */
export function parseImports(code: string): ImportStatement[] {
  const imports: ImportStatement[] = []

  // Match various import patterns
  const importRegex = /import\s+(?:(?:(\w+)(?:\s*,\s*)?)?(?:\{([^}]+)\})?\s+from\s+)?['"]([^'"]+)['"]\s*;?/g

  let match
  while ((match = importRegex.exec(code)) !== null) {
    const defaultImport = match[1]?.trim()
    const namedImports = match[2]?.split(',').map(s => s.trim()).filter(Boolean) || []
    const path = match[3]

    const allImports = defaultImport ? [defaultImport, ...namedImports] : namedImports
    const isLocalFile = path.startsWith('./') || path.startsWith('../')
    const isCssImport = /\.(css|scss|sass|less|styl)$/.test(path)
    const isLibrary = LIBRARY_IMPORTS.has(path) ||
                      path.startsWith('@') && !isLocalFile ||
                      !isLocalFile && !isCssImport

    imports.push({
      path,
      imports: allImports,
      isDefault: !!defaultImport,
      isCssImport,
      isLocalFile,
      isLibrary,
      raw: match[0],
    })
  }

  return imports
}

/**
 * Get dependencies that need to be provided by user
 */
export function getMissingDependencies(imports: ImportStatement[]): ImportStatement[] {
  return imports.filter(imp => imp.isLocalFile && !imp.isLibrary)
}

// ============================================
// JSX EXTRACTION
// ============================================

/**
 * Extract JSX content from a React component
 */
export function extractJsxContent(code: string): string | null {
  // Try to find return statement with JSX
  // Handle both arrow functions and regular functions

  // Pattern 1: return ( <JSX> )
  const returnMatch = code.match(/return\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*(?:\}|$)/m)
  if (returnMatch) {
    return cleanJsxContent(returnMatch[1])
  }

  // Pattern 2: return <JSX> (without parentheses)
  const directReturnMatch = code.match(/return\s+(<[\s\S]*?>)\s*;?\s*(?:\}|$)/m)
  if (directReturnMatch) {
    return cleanJsxContent(directReturnMatch[1])
  }

  // Pattern 3: Arrow function with implicit return => (<JSX>)
  const arrowMatch = code.match(/=>\s*\(\s*([\s\S]*?)\s*\)\s*(?:;|\}|$)/m)
  if (arrowMatch && arrowMatch[1].trim().startsWith('<')) {
    return cleanJsxContent(arrowMatch[1])
  }

  // Pattern 4: Arrow function with implicit return => <JSX>
  const directArrowMatch = code.match(/=>\s*(<[\s\S]*?>)\s*(?:;|\}|$)/m)
  if (directArrowMatch) {
    return cleanJsxContent(directArrowMatch[1])
  }

  return null
}

/**
 * Clean JSX content
 */
function cleanJsxContent(jsx: string): string {
  return jsx.trim()
}

/**
 * Extract component name from code
 */
export function extractComponentName(code: string): string {
  // Pattern 1: export default function Name
  const exportFuncMatch = code.match(/export\s+default\s+function\s+(\w+)/)
  if (exportFuncMatch) return exportFuncMatch[1]

  // Pattern 2: export default Name (at end)
  const exportDefaultMatch = code.match(/export\s+default\s+(\w+)\s*;?\s*$/)
  if (exportDefaultMatch) return exportDefaultMatch[1]

  // Pattern 3: function Name
  const funcMatch = code.match(/function\s+(\w+)\s*\(/)
  if (funcMatch) return funcMatch[1]

  // Pattern 4: const Name =
  const constMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=/)
  if (constMatch) return constMatch[1]

  return 'Component'
}

/**
 * Extract props from component definition
 */
export function extractProps(code: string): string[] {
  // Pattern 1: function Component({ prop1, prop2 })
  const destructuredMatch = code.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\function))\s*\(\s*\{\s*([^}]+)\s*\}/)
  if (destructuredMatch) {
    return destructuredMatch[1].split(',').map(p => p.trim().split('=')[0].trim()).filter(Boolean)
  }

  // Pattern 2: function Component(props)
  const propsMatch = code.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\function))\s*\(\s*(\w+)\s*\)/)
  if (propsMatch && propsMatch[1] !== '') {
    return [propsMatch[1]]
  }

  return []
}

// ============================================
// REACT PATTERN DETECTION
// ============================================

/**
 * Detect React-specific patterns that may need conversion
 */
export function detectReactPatterns(code: string): ReactPattern[] {
  const patterns: ReactPattern[] = []

  // useState
  if (code.includes('useState')) {
    const stateMatches = code.match(/const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState/g)
    const count = stateMatches?.length || 0
    patterns.push({
      type: 'useState',
      description: `${count} state variable(s) detected`,
      canConvert: false,
      suggestion: 'Convert to vanilla JS variables or CSS classes for toggles',
    })
  }

  // useEffect
  if (code.includes('useEffect')) {
    patterns.push({
      type: 'useEffect',
      description: 'Side effects detected',
      canConvert: true,
      suggestion: 'Will convert to DOMContentLoaded event listener',
    })
  }

  // useRef
  if (code.includes('useRef')) {
    patterns.push({
      type: 'useRef',
      description: 'DOM refs detected',
      canConvert: true,
      suggestion: 'Will convert to document.querySelector()',
    })
  }

  // useContext
  if (code.includes('useContext')) {
    patterns.push({
      type: 'useContext',
      description: 'Context usage detected',
      canConvert: false,
      suggestion: 'Remove or replace with props/global variables',
    })
  }

  // onClick handlers
  if (code.includes('onClick')) {
    patterns.push({
      type: 'onClick',
      description: 'Click handlers detected',
      canConvert: true,
      suggestion: 'Will convert to addEventListener("click", ...)',
    })
  }

  // onChange handlers
  if (code.includes('onChange')) {
    patterns.push({
      type: 'onChange',
      description: 'Change handlers detected',
      canConvert: true,
      suggestion: 'Will convert to addEventListener("change", ...)',
    })
  }

  return patterns
}

// ============================================
// MAIN PARSER
// ============================================

/**
 * Parse a React component file
 */
export function parseReactComponent(code: string, _fileName: string = 'Component.jsx'): ParsedComponent {
  const warnings: string[] = []

  // Parse imports
  const imports = parseImports(code)
  const missingDependencies = getMissingDependencies(imports)

  // Extract component info
  const name = extractComponentName(code)
  const props = extractProps(code)
  const jsxContent = extractJsxContent(code)

  if (!jsxContent) {
    warnings.push('Could not extract JSX content. Make sure component has a return statement with JSX.')
  }

  // Detect React patterns
  const reactPatterns = detectReactPatterns(code)

  // Add warnings for unconvertible patterns
  for (const pattern of reactPatterns) {
    if (!pattern.canConvert) {
      warnings.push(`${pattern.type}: ${pattern.description}. ${pattern.suggestion}`)
    }
  }

  return {
    name,
    jsxContent: jsxContent || '',
    props,
    imports,
    missingDependencies,
    reactPatterns,
    warnings,
  }
}

/**
 * Parse multiple React files and resolve dependencies
 */
export function parseReactFiles(files: FileCollection): {
  components: Map<string, ParsedComponent>
  allCss: string[]
  unresolved: string[]
} {
  const components = new Map<string, ParsedComponent>()
  const allCss: string[] = []
  const unresolved: string[] = []

  // Parse main file
  const mainParsed = parseReactComponent(files.main.content, files.main.name)
  components.set(files.main.name, mainParsed)

  // Parse dependency files
  for (const [path, content] of files.dependencies) {
    if (path.endsWith('.css') || path.endsWith('.scss')) {
      allCss.push(content)
    } else if (path.endsWith('.jsx') || path.endsWith('.tsx') || path.endsWith('.js') || path.endsWith('.ts')) {
      const parsed = parseReactComponent(content, path)
      components.set(path, parsed)
    }
  }

  // Check for unresolved dependencies
  for (const [, component] of components) {
    for (const dep of component.missingDependencies) {
      const normalizedPath = normalizePath(dep.path)
      const found = files.dependencies.has(normalizedPath) ||
                    files.dependencies.has(normalizedPath + '.jsx') ||
                    files.dependencies.has(normalizedPath + '.tsx') ||
                    files.dependencies.has(normalizedPath + '.js') ||
                    files.dependencies.has(normalizedPath + '.css')

      if (!found && !dep.isCssImport) {
        unresolved.push(dep.path)
      }
    }
  }

  return { components, allCss, unresolved: [...new Set(unresolved)] }
}

/**
 * Normalize import path
 */
function normalizePath(path: string): string {
  // Remove ./ prefix
  let normalized = path.replace(/^\.\//, '')
  // Remove file extension if present
  normalized = normalized.replace(/\.(jsx|tsx|js|ts)$/, '')
  return normalized
}

/**
 * Get a flat list of all missing files needed
 */
export function getAllMissingFiles(parsed: ParsedComponent): { path: string; type: 'component' | 'css' | 'other' }[] {
  return parsed.missingDependencies.map(dep => ({
    path: dep.path,
    type: dep.isCssImport ? 'css' :
          dep.imports.length > 0 ? 'component' : 'other'
  }))
}
