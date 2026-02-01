/**
 * Webflow Export Parser
 *
 * Parses Webflow-exported template folders and extracts:
 * - HTML content from index.html
 * - Project-specific CSS (excluding normalize.css and webflow.css)
 * - External library references (scripts and styles)
 * - Font information from @font-face rules
 * - Image URLs
 * - Metadata (title, page ID, site ID)
 */

// ============================================
// TYPES
// ============================================

export interface FontInfo {
  family: string
  src: string
  weight?: string
  style?: string
}

export interface WebflowExportMetadata {
  title: string
  pageId: string       // data-wf-page attribute
  siteId: string       // data-wf-site attribute
  lastPublished?: string
}

export interface WebflowExportResult {
  /** Cleaned body content (inner HTML) */
  html: string
  /** Combined project-specific CSS (excludes normalize.css, webflow.css) */
  projectCss: string
  /** Extracted inline <script> contents */
  inlineScripts: string[]
  /** External library CDN URLs */
  libraryImports: {
    scripts: string[]
    styles: string[]
  }
  /** Detected custom fonts from @font-face rules */
  fonts: FontInfo[]
  /** Image URLs found in HTML and CSS */
  images: string[]
  /** Page metadata from HTML attributes */
  metadata: WebflowExportMetadata
  /** Files that were parsed */
  parsedFiles: string[]
  /** Warnings encountered during parsing */
  warnings: string[]
}

export interface WebflowExportFile {
  path: string
  content: string
}

// ============================================
// CONSTANTS
// ============================================

/** CSS files to skip (Webflow framework CSS) */
const SKIP_CSS_FILES = [
  'normalize.css',
  'webflow.css',
]

/** Known library patterns for detection */
const LIBRARY_PATTERNS: Record<string, RegExp> = {
  'jQuery': /jquery/i,
  'GSAP': /gsap/i,
  'ScrollTrigger': /scrolltrigger/i,
  'Lenis': /lenis/i,
  'Splide': /splide/i,
  'Swiper': /swiper/i,
  'Locomotive Scroll': /locomotive/i,
  'AOS': /aos\.js/i,
  'Anime.js': /anime\.min\.js/i,
  'Three.js': /three\.min\.js/i,
  'FinSweet': /finsweet/i,
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extracts the filename from a path
 */
function getFilename(path: string): string {
  return path.split('/').pop() || path
}

/**
 * Checks if a CSS file should be skipped (framework CSS)
 */
function shouldSkipCssFile(path: string): boolean {
  const filename = getFilename(path).toLowerCase()
  return SKIP_CSS_FILES.some(skip => filename === skip.toLowerCase())
}

/**
 * Checks if a file is a project-specific CSS file (*.webflow.css or custom)
 */
function isProjectCss(path: string): boolean {
  const filename = getFilename(path).toLowerCase()
  // Project CSS typically ends with .webflow.css or is in css/ folder
  // but not normalize or webflow framework
  return (
    path.toLowerCase().includes('/css/') &&
    filename.endsWith('.css') &&
    !shouldSkipCssFile(path)
  )
}

/**
 * Extracts @font-face rules from CSS content
 */
function extractFonts(css: string): FontInfo[] {
  const fonts: FontInfo[] = []
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi

  let match
  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1]

    // Extract font-family
    const familyMatch = block.match(/font-family:\s*['"]?([^'";]+)['"]?/i)
    const family = familyMatch ? familyMatch[1].trim() : ''

    // Extract src
    const srcMatch = block.match(/src:\s*([^;]+)/i)
    const src = srcMatch ? srcMatch[1].trim() : ''

    // Extract weight
    const weightMatch = block.match(/font-weight:\s*(\d+|normal|bold)/i)
    const weight = weightMatch ? weightMatch[1] : undefined

    // Extract style
    const styleMatch = block.match(/font-style:\s*(\w+)/i)
    const style = styleMatch ? styleMatch[1] : undefined

    if (family && src) {
      fonts.push({ family, src, weight, style })
    }
  }

  return fonts
}

/**
 * Extracts image URLs from HTML content
 */
function extractImagesFromHtml(html: string): string[] {
  const images: string[] = []

  // Match src attributes in img tags
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi
  let match
  while ((match = imgSrcRegex.exec(html)) !== null) {
    const url = match[1]
    if (url && !url.startsWith('data:')) {
      images.push(url)
    }
  }

  // Match srcset attributes
  const srcsetRegex = /srcset=["']([^"']+)["']/gi
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcset = match[1]
    // Parse srcset (format: "url size, url size, ...")
    const urls = srcset.split(',').map(part => {
      const [url] = part.trim().split(/\s+/)
      return url
    }).filter(url => url && !url.startsWith('data:'))
    images.push(...urls)
  }

  // Match background images in inline styles
  const bgRegex = /url\(['"]?([^'")\s]+)['"]?\)/gi
  while ((match = bgRegex.exec(html)) !== null) {
    const url = match[1]
    if (url && !url.startsWith('data:') && isImageUrl(url)) {
      images.push(url)
    }
  }

  return [...new Set(images)] // Deduplicate
}

/**
 * Extracts image URLs from CSS content
 */
function extractImagesFromCss(css: string): string[] {
  const images: string[] = []
  const bgRegex = /url\(['"]?([^'")\s]+)['"]?\)/gi

  let match
  while ((match = bgRegex.exec(css)) !== null) {
    const url = match[1]
    if (url && !url.startsWith('data:') && isImageUrl(url)) {
      images.push(url)
    }
  }

  return [...new Set(images)]
}

/**
 * Checks if a URL likely points to an image
 */
function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.avif']
  const lowerUrl = url.toLowerCase()
  return imageExtensions.some(ext => lowerUrl.includes(ext)) ||
    lowerUrl.includes('images/') ||
    lowerUrl.includes('/image/') ||
    lowerUrl.includes('assets-global.website-files.com')
}

/**
 * Detects which libraries are referenced by URL
 */
function detectLibraries(scripts: string[], styles: string[]): string[] {
  const detected: string[] = []
  const allUrls = [...scripts, ...styles]

  for (const [name, pattern] of Object.entries(LIBRARY_PATTERNS)) {
    if (allUrls.some(url => pattern.test(url))) {
      detected.push(name)
    }
  }

  // Also check for webflow.js
  if (scripts.some(url => url.includes('webflow.') && url.endsWith('.js'))) {
    detected.push('Webflow Runtime')
  }

  return detected
}

// ============================================
// MAIN PARSER
// ============================================

/**
 * Parses a Webflow export folder
 *
 * @param files - Array of files from the folder upload
 * @returns Parsed export result
 */
export function parseWebflowExport(files: WebflowExportFile[]): WebflowExportResult {
  const warnings: string[] = []
  const parsedFiles: string[] = []

  // Find index.html
  const indexFile = files.find(f =>
    getFilename(f.path).toLowerCase() === 'index.html'
  )

  if (!indexFile) {
    throw new Error('No index.html found in the upload. Make sure you uploaded a Webflow export folder.')
  }
  parsedFiles.push(indexFile.path)

  // Parse HTML
  const htmlContent = indexFile.content
  const { bodyHtml, metadata, externalScripts, externalStyles, inlineScripts } = parseHtml(htmlContent)

  // Collect project CSS files
  const cssFiles = files.filter(f => isProjectCss(f.path))
  let projectCss = ''

  for (const cssFile of cssFiles) {
    parsedFiles.push(cssFile.path)
    projectCss += `/* === ${getFilename(cssFile.path)} === */\n`
    projectCss += cssFile.content + '\n\n'
  }

  // Warn if no project CSS found
  if (cssFiles.length === 0) {
    warnings.push('No project-specific CSS files found. Expected *.webflow.css in css/ folder.')
  }

  // Extract fonts from CSS
  const fonts = extractFonts(projectCss)

  // Extract images
  const htmlImages = extractImagesFromHtml(bodyHtml)
  const cssImages = extractImagesFromCss(projectCss)
  const images = [...new Set([...htmlImages, ...cssImages])]

  // Check for font files in the fonts/ folder
  const fontFiles = files.filter(f => f.path.toLowerCase().includes('/fonts/'))
  if (fontFiles.length > 0) {
    warnings.push(
      `Found ${fontFiles.length} font file(s) in fonts/ folder. ` +
      `These need to be uploaded to Webflow manually.`
    )
  }

  // Detect libraries
  const detectedLibraries = detectLibraries(externalScripts, externalStyles)

  // Check for webflow.js dependency
  if (externalScripts.some(url => url.includes('webflow.') && url.endsWith('.js'))) {
    warnings.push(
      'This template uses webflow.js for interactions. ' +
      'Complex interactions may need to be recreated in Webflow Designer.'
    )
  }

  return {
    html: bodyHtml,
    projectCss: projectCss.trim(),
    inlineScripts,
    libraryImports: {
      scripts: externalScripts,
      styles: externalStyles,
    },
    fonts,
    images,
    metadata,
    parsedFiles,
    warnings,
  }
}

/**
 * Parses HTML content and extracts relevant data
 */
function parseHtml(html: string): {
  bodyHtml: string
  metadata: WebflowExportMetadata
  externalScripts: string[]
  externalStyles: string[]
  inlineScripts: string[]
} {
  const externalScripts: string[] = []
  const externalStyles: string[] = []
  const inlineScripts: string[] = []

  // Extract metadata
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
  const pageIdMatch = html.match(/data-wf-page=["']([^"']+)["']/i)
  const siteIdMatch = html.match(/data-wf-site=["']([^"']+)["']/i)
  const publishedMatch = html.match(/data-wf-published=["']([^"']+)["']/i)

  const metadata: WebflowExportMetadata = {
    title: titleMatch ? titleMatch[1].trim() : 'Untitled',
    pageId: pageIdMatch ? pageIdMatch[1] : '',
    siteId: siteIdMatch ? siteIdMatch[1] : '',
    lastPublished: publishedMatch ? publishedMatch[1] : undefined,
  }

  // Extract external scripts (from head and body)
  const scriptSrcRegex = /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi
  let match
  while ((match = scriptSrcRegex.exec(html)) !== null) {
    const src = match[1]
    // Skip local js files from the export
    if (!src.startsWith('./') && !src.startsWith('../') && !src.startsWith('js/')) {
      externalScripts.push(src)
    }
  }

  // Extract inline scripts
  const inlineScriptRegex = /<script(?![^>]+src)[^>]*>([\s\S]*?)<\/script>/gi
  while ((match = inlineScriptRegex.exec(html)) !== null) {
    const content = match[1].trim()
    if (content) {
      inlineScripts.push(content)
    }
  }

  // Extract external stylesheets
  const linkHrefRegex = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi
  while ((match = linkHrefRegex.exec(html)) !== null) {
    const href = match[1]
    // Skip local CSS files from the export
    if (!href.startsWith('./') && !href.startsWith('../') && !href.startsWith('css/')) {
      externalStyles.push(href)
    }
  }

  // Also check for href before rel (Webflow sometimes uses this order)
  const linkHrefRegex2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']stylesheet["'][^>]*>/gi
  while ((match = linkHrefRegex2.exec(html)) !== null) {
    const href = match[1]
    if (!href.startsWith('./') && !href.startsWith('../') && !href.startsWith('css/') &&
        !externalStyles.includes(href)) {
      externalStyles.push(href)
    }
  }

  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  let bodyHtml = bodyMatch ? bodyMatch[1] : html

  // Remove inline scripts from body (we extracted them separately)
  bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '')

  // Clean up whitespace
  bodyHtml = bodyHtml.trim()

  return {
    bodyHtml,
    metadata,
    externalScripts,
    externalStyles,
    inlineScripts,
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generates a slug from a title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Detects libraries from parsed export
 */
export function getDetectedLibraries(result: WebflowExportResult): string[] {
  return detectLibraries(
    result.libraryImports.scripts,
    result.libraryImports.styles
  )
}

/**
 * Formats the export result for display
 */
export function formatExportSummary(result: WebflowExportResult): string {
  const lines = [
    `Title: ${result.metadata.title}`,
    `Page ID: ${result.metadata.pageId || 'Not found'}`,
    `Site ID: ${result.metadata.siteId || 'Not found'}`,
    ``,
    `Parsed files: ${result.parsedFiles.length}`,
    `- ${result.parsedFiles.join('\n- ')}`,
    ``,
    `External scripts: ${result.libraryImports.scripts.length}`,
    `External styles: ${result.libraryImports.styles.length}`,
    `Fonts detected: ${result.fonts.length}`,
    `Images found: ${result.images.length}`,
    `Inline scripts: ${result.inlineScripts.length}`,
  ]

  if (result.warnings.length > 0) {
    lines.push(``, `Warnings:`)
    result.warnings.forEach(w => lines.push(`- ${w}`))
  }

  return lines.join('\n')
}
