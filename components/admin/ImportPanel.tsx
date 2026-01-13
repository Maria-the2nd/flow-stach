"use client"

import { useState, useCallback } from "react"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Upload04Icon,
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { parseFullHtml, buildCodePayload, extractCssForSection, type DetectedSection, type CssExtractionOptions } from "@/lib/html-parser"
import { extractTokens, generateTokenManifest, tokenManifestToJson, extractFontFamilies, extractGoogleFontsUrl } from "@/lib/token-extractor"
import { buildTokenWebflowPayload, convertSectionToWebflow } from "@/lib/webflow-converter"
import { cn } from "@/lib/utils"

interface ImportResult {
  assetsCreated: number
  assetsUpdated: number
  payloadsCreated: number
  payloadsUpdated: number
  errors: string[]
}

const FLOW_PARTY_SECTION_MAP: Record<
  string,
  { slug: string; title: string; category: string; tags: string[] }
> = {
  header: { slug: "fp-navigation", title: "Flow Party Header", category: "navigation", tags: ["navigation", "header", "hero", "nav", "fixed", "responsive"] },
  navigation: { slug: "fp-navigation", title: "Flow Party Header", category: "navigation", tags: ["navigation", "header", "hero", "nav", "fixed", "responsive"] },
  nav: { slug: "fp-navigation", title: "Flow Party Header", category: "navigation", tags: ["navigation", "header", "hero", "nav", "fixed", "responsive"] },
  hero: { slug: "fp-hero", title: "Flow Party Hero", category: "hero", tags: ["hero", "landing", "section", "grid", "responsive"] },
  "client-bar": { slug: "fp-client-bar", title: "Flow Party Client Bar", category: "sections", tags: ["clients", "logos", "trust", "social-proof", "section"] },
  "intro-section": { slug: "fp-intro", title: "Flow Party Intro", category: "sections", tags: ["intro", "section", "typography", "trust", "avatars"] },
  "bento-section": { slug: "fp-bento", title: "Flow Party Bento Grid", category: "sections", tags: ["bento", "grid", "stats", "testimonial", "section"] },
  "product-section": { slug: "fp-product", title: "Flow Party Product (The Stash)", category: "sections", tags: ["products", "stash", "cards", "grid", "showcase", "section"] },
  "packs-section": { slug: "fp-packs", title: "Flow Party Party Packs", category: "sections", tags: ["packs", "cards", "pricing", "cta", "section"] },
  "features-section": { slug: "fp-features", title: "Flow Party Features", category: "sections", tags: ["features", "grid", "cards", "icons", "section"] },
  "collaborators-section": { slug: "fp-collaborators", title: "Flow Party Collaborators", category: "sections", tags: ["team", "collaborators", "grid", "avatars", "section"] },
  "pricing-section": { slug: "fp-pricing", title: "Flow Party Pricing", category: "sections", tags: ["pricing", "cards", "section", "tiers", "cta"] },
  "faq-section": { slug: "fp-faq", title: "Flow Party FAQ", category: "sections", tags: ["faq", "accordion", "section", "questions", "support"] },
  "cta-section": { slug: "fp-cta", title: "Flow Party CTA", category: "sections", tags: ["cta", "call-to-action", "section", "dark", "watermark"] },
  footer: { slug: "fp-footer", title: "Flow Party Footer", category: "navigation", tags: ["footer", "navigation", "links", "section"] },
}

function mergeNavigationSections(
  sections: DetectedSection[],
  fullCss: string,
  cssOptions: CssExtractionOptions
): DetectedSection[] {
  const navSections = sections.filter((section) => section.tagName === "nav")
  const hasMobileMenu = navSections.some((section) => section.className === "mobile-menu")
  if (!hasMobileMenu || navSections.length <= 1) return sections

  const mergedSelectors = Array.from(new Set(navSections.flatMap((section) => section.cssSelectors)))
  const mergedHtml = navSections.map((section) => section.htmlContent).join("\n\n")
  const mergedSection: DetectedSection = {
    id: "navigation",
    name: "Navigation",
    tagName: "nav",
    className: "nav",
    htmlContent: mergedHtml,
    cssSelectors: mergedSelectors,
    cssContent: extractCssForSection(fullCss, mergedSelectors, cssOptions),
  }

  const mergedSections: DetectedSection[] = []
  let inserted = false
  for (const section of sections) {
    if (section.tagName === "nav") {
      if (!inserted) {
        mergedSections.push(mergedSection)
        inserted = true
      }
      continue
    }
    mergedSections.push(section)
  }
  return mergedSections
}

function combineHeaderHeroSections(
  sections: DetectedSection[],
  fullCss: string,
  cssOptions: CssExtractionOptions
): DetectedSection[] {
  const navSection = sections.find((section) => section.tagName === "nav" || section.className === "nav")
  const heroSection = sections.find((section) => section.className.includes("hero") || section.id.includes("hero"))

  if (!navSection || !heroSection) return sections

  const existingIds = new Set(sections.map((section) => section.id))
  let headerId = "header"
  let counter = 1
  while (existingIds.has(headerId)) {
    headerId = `header-${counter}`
    counter += 1
  }

  const mergedSelectors = Array.from(new Set([...navSection.cssSelectors, ...heroSection.cssSelectors]))
  const mergedHtml = [navSection.htmlContent, heroSection.htmlContent].join("\n\n")
  const headerSection: DetectedSection = {
    id: headerId,
    name: "Header",
    tagName: "header",
    className: "header",
    htmlContent: mergedHtml,
    cssSelectors: mergedSelectors,
    cssContent: extractCssForSection(fullCss, mergedSelectors, cssOptions),
  }

  const mergedSections: DetectedSection[] = []
  let inserted = false
  for (const section of sections) {
    if (section === navSection) {
      if (!inserted) {
        mergedSections.push(headerSection)
        inserted = true
      }
      continue
    }
    mergedSections.push(section)
  }

  return mergedSections
}

function resolveSectionMeta(
  section: DetectedSection,
  slugPrefix: string,
  useFlowPartyMap: boolean
): { slug: string; name: string; category: string; tags: string[] } {
  if (useFlowPartyMap) {
    const keyCandidates = [section.id, section.className, section.name.toLowerCase().replace(/\s+/g, "-")]
    for (const key of keyCandidates) {
      const mapped = FLOW_PARTY_SECTION_MAP[key]
      if (mapped) {
        return { slug: mapped.slug, name: mapped.title, category: mapped.category, tags: mapped.tags }
      }
    }
  }

  const category = section.tagName === "nav" || section.tagName === "footer" ? "navigation" : section.id.includes("hero") ? "hero" : "sections"
  return { slug: `${slugPrefix}-${section.id}`, name: section.name, category, tags: [slugPrefix, section.id, ...section.cssSelectors.slice(0, 3)] }
}

function createInstanceSlug(baseSlug: string): string {
  const now = new Date()
  const timestamp = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0")].join("-")
  const random = Math.random().toString(36).slice(2, 6)
  return `${baseSlug}-${timestamp}-${random}`
}

function stripTokenCss(css: string): string {
  return css.replace(/:root\s*\{[^}]*\}/g, "").replace(/\.fp-root\s*\{[^}]*\}/g, "").trim()
}

interface ImportProgress {
  step: "parsing" | "converting" | "saving" | "complete"
  current: number
  total: number
  currentSection?: string
}

interface ImportPanelProps {
  onImportComplete?: () => void
}

export function ImportPanel({ onImportComplete }: ImportPanelProps) {
  const importSections = useMutation(api.import.importSections)

  const [htmlInput, setHtmlInput] = useState("")
  const [designSystemName, setDesignSystemName] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [showHtmlInput, setShowHtmlInput] = useState(false)
  const [showOptions, setShowOptions] = useState(false)

  // Progress tracking
  const [progress, setProgress] = useState<ImportProgress | null>(null)

  // Options
  const [stripBaseStyles, setStripBaseStyles] = useState(true)
  const [mergeNavigation, setMergeNavigation] = useState(true)
  const [useFlowPartyMap, setUseFlowPartyMap] = useState(false)
  const [alwaysCreateNew, setAlwaysCreateNew] = useState(true)
  const [combineHeaderHero, setCombineHeaderHero] = useState(true)
  const [useLlmConversion, setUseLlmConversion] = useState(false)

  const [conversionSummary, setConversionSummary] = useState<{
    llmSuccess: number
    llmFailed: number
    fallbackUsed: number
    errors: string[]
  } | null>(null)

  const convertSectionWithLlm = useCallback(
    async (section: DetectedSection, namespace: string): Promise<string | undefined> => {
      const startTime = Date.now()
      try {
        const response = await fetch("/api/webflow/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: section.htmlContent,
            css: stripTokenCss(section.cssContent),
            idPrefix: namespace,
            sectionName: section.name,
          }),
        })

        if (!response.ok) {
          console.warn("[ImportPanel] LLM failed:", section.name, { status: response.status, duration: Date.now() - startTime })
          return undefined
        }

        const data = await response.json()
        return data?.webflowJson as string | undefined
      } catch (error) {
        console.error("[ImportPanel] LLM exception:", section.name, error)
        return undefined
      }
    },
    []
  )

  const resolveWebflowJson = useCallback(
    async (section: DetectedSection, namespace: string): Promise<string | undefined> => {
      if (useLlmConversion) {
        const llmJson = await convertSectionWithLlm(section, namespace)
        if (llmJson) return llmJson
      }

      const fallbackPayload = convertSectionToWebflow(section, { idPrefix: namespace })
      const hasFallback = fallbackPayload.payload.nodes.length > 0 || fallbackPayload.payload.styles.length > 0
      return hasFallback ? JSON.stringify(fallbackPayload) : undefined
    },
    [convertSectionWithLlm, useLlmConversion]
  )

  const parseHtml = useCallback(() => {
    if (!htmlInput.trim()) {
      toast.error("Please paste HTML content")
      return null
    }

    try {
      const cssOptions: CssExtractionOptions = stripBaseStyles
        ? { includeRoot: false, includeReset: false, includeBody: false, includeHtml: false, includeImg: false, dedupe: true }
        : { dedupe: true }

      const sectionOptions = { includeDivs: true, divClassPattern: /^(?:[\w-]+-section|client-bar)$/i }
      const result = parseFullHtml(htmlInput, { cssOptions, sectionOptions })
      let sections = result.sections.filter(
        (section) => section.className && !section.className.toLowerCase().includes("wrapper") && !section.name.toLowerCase().includes("wrapper")
      )

      if (mergeNavigation) {
        sections = mergeNavigationSections(sections, result.fullCss, cssOptions)
      }

      if (combineHeaderHero) {
        sections = combineHeaderHeroSections(sections, result.fullCss, cssOptions)
      }

      if (sections.length === 0) {
        toast.error("No sections detected. Make sure HTML contains <section>, <nav>, or <footer> tags.")
        return null
      }

      const trimmedName = designSystemName.trim()
      const normalizedName = trimmedName && /flow party/i.test(trimmedName) ? "Flow Party" : trimmedName
      const name = normalizedName || result.title || "Imported Design"
      const tokens = extractTokens(result.fullCss, name)
      const fontUrl = extractGoogleFontsUrl(htmlInput)
      const fontFamilies = extractFontFamilies(result.fullCss)
      if (fontUrl && fontFamilies.length > 0) {
        tokens.fonts = { googleFonts: fontUrl, families: fontFamilies }
      }

      return { result: { ...result, sections }, tokens, designSystemName: name }
    } catch (error) {
      console.error("Parse error:", error)
      toast.error("Failed to parse HTML. Check console for details.")
      return null
    }
  }, [htmlInput, designSystemName, mergeNavigation, combineHeaderHero, stripBaseStyles])

  const handleImport = useCallback(async () => {
    // Start progress - parsing
    setProgress({ step: "parsing", current: 0, total: 1, currentSection: "Parsing HTML..." })

    const parsed = parseHtml()
    if (!parsed) {
      setProgress(null)
      return
    }

    setIsImporting(true)
    const totalSections = parsed.result.sections.length

    try {
      const baseSlug = parsed.tokens.slug
      const instanceSlug = alwaysCreateNew ? createInstanceSlug(baseSlug) : baseSlug
      const tokensForImport = { ...parsed.tokens, slug: instanceSlug }
      const manifest = generateTokenManifest(tokensForImport)
      const tokenSlug = `${instanceSlug}-tokens`
      const useMap = !alwaysCreateNew && useFlowPartyMap && baseSlug === "flow-party"
      const tokenWebflowPayload = buildTokenWebflowPayload(tokensForImport)
      const tokenWebflowJson = tokenWebflowPayload.payload.styles.length > 0 ? JSON.stringify(tokenWebflowPayload) : undefined

      const sectionsToImport = []
      let webflowJsonCount = 0
      let emptyCount = 0

      // Process each section with progress updates
      for (let i = 0; i < parsed.result.sections.length; i++) {
        const section = parsed.result.sections[i]
        setProgress({
          step: "converting",
          current: i + 1,
          total: totalSections,
          currentSection: section.name,
        })

        const webflowJson = await resolveWebflowJson(section, tokensForImport.namespace)
        if (webflowJson && webflowJson !== "{}" && !webflowJson.includes('"placeholder"')) {
          webflowJsonCount++
        } else {
          emptyCount++
        }
        sectionsToImport.push({
          id: section.id,
          ...resolveSectionMeta(section, instanceSlug, useMap),
          codePayload: buildCodePayload(section),
          webflowJson,
          dependencies: [tokenSlug],
        })
      }

      setConversionSummary({
        llmSuccess: useLlmConversion ? webflowJsonCount : 0,
        llmFailed: useLlmConversion ? emptyCount : 0,
        fallbackUsed: useLlmConversion ? 0 : webflowJsonCount,
        errors: [],
      })

      // Saving step
      setProgress({ step: "saving", current: totalSections, total: totalSections, currentSection: "Saving to database..." })

      const result = await importSections({
        designSystemName: parsed.tokens.name,
        designSystemSlug: instanceSlug,
        sections: sectionsToImport,
        tokenManifest: tokenManifestToJson(manifest),
        tokenWebflowJson,
      })

      setProgress({ step: "complete", current: totalSections, total: totalSections })
      setImportResult(result)

      if (result.errors.length > 0) {
        toast.warning(`Imported with ${result.errors.length} errors`)
      } else {
        toast.success(`Imported ${result.assetsCreated + result.assetsUpdated} sections!`)
      }

      onImportComplete?.()
    } catch (error) {
      console.error("Import error:", error)
      toast.error("Failed to import. Check console for details.")
      setProgress(null)
    } finally {
      setIsImporting(false)
    }
  }, [parseHtml, importSections, useFlowPartyMap, alwaysCreateNew, resolveWebflowJson, useLlmConversion, onImportComplete])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      toast.error("Please upload an HTML file")
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setHtmlInput(content)
      const name = file.name.replace(/\.html?$/i, "").replace(/-/g, " ")
      setDesignSystemName(name.charAt(0).toUpperCase() + name.slice(1))
      setShowHtmlInput(true)
      toast.success("File loaded")
    }
    reader.onerror = () => toast.error("Failed to read file")
    reader.readAsText(file)
  }, [])

  const handleReset = useCallback(() => {
    setHtmlInput("")
    setDesignSystemName("")
    setImportResult(null)
    setConversionSummary(null)
    setShowHtmlInput(false)
    setProgress(null)
  }, [])

  return (
    <div className="space-y-4">
      {/* Top bar with options and import button */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Design System Name"
          value={designSystemName}
          onChange={(e) => setDesignSystemName(e.target.value)}
          className="h-8 w-48 text-sm"
        />

        <Label htmlFor="file-upload-panel" className="cursor-pointer">
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-dashed px-3 text-sm hover:bg-muted/50">
            <HugeiconsIcon icon={Upload04Icon} className="h-3.5 w-3.5" />
            Upload HTML
          </div>
        </Label>
        <Input
          id="file-upload-panel"
          type="file"
          accept=".html,.htm"
          onChange={handleFileUpload}
          className="hidden"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowOptions(!showOptions)}
          className="h-8 gap-1.5"
        >
          <HugeiconsIcon icon={Settings02Icon} className="h-3.5 w-3.5" />
          Options
          <HugeiconsIcon icon={showOptions ? ArrowUp01Icon : ArrowDown01Icon} className="h-3 w-3" />
        </Button>

        <Button
          onClick={handleImport}
          disabled={!htmlInput.trim() || isImporting}
          size="sm"
          className="ml-auto h-8"
        >
          {isImporting ? "Importing..." : "Import"}
          <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Collapsible options */}
      {showOptions && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-dashed p-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={stripBaseStyles} onChange={(e) => setStripBaseStyles(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Strip base styles
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={mergeNavigation} onChange={(e) => setMergeNavigation(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Merge navigation
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={combineHeaderHero} onChange={(e) => setCombineHeaderHero(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Combine header + hero
          </label>
          <label className={cn("flex items-center gap-2", alwaysCreateNew && "opacity-50")}>
            <input type="checkbox" checked={useFlowPartyMap} onChange={(e) => setUseFlowPartyMap(e.target.checked)} disabled={alwaysCreateNew} className="h-3.5 w-3.5 rounded" />
            Use Flow Party map
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={alwaysCreateNew} onChange={(e) => setAlwaysCreateNew(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Always create new
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useLlmConversion} onChange={(e) => setUseLlmConversion(e.target.checked)} className="h-3.5 w-3.5 rounded" />
            Use LLM conversion
          </label>
        </div>
      )}

      {/* Progress bar during import */}
      {progress && progress.step !== "complete" && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {progress.step === "parsing" && "Parsing HTML..."}
              {progress.step === "converting" && `Converting: ${progress.currentSection}`}
              {progress.step === "saving" && "Saving to database..."}
            </span>
            <span className="text-muted-foreground">
              {progress.step === "converting" ? `${progress.current}/${progress.total}` : ""}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{
                width: `${progress.step === "parsing" ? 5 : progress.step === "saving" ? 95 : (progress.current / progress.total) * 90 + 5}%`,
              }}
            />
          </div>
          {progress.step === "converting" && (
            <p className="text-xs text-muted-foreground">
              Processing section {progress.current} of {progress.total}
            </p>
          )}
        </div>
      )}

      {/* Collapsible HTML input */}
      <div className="rounded-lg border">
        <button
          type="button"
          onClick={() => setShowHtmlInput(!showHtmlInput)}
          className="flex w-full items-center justify-between p-3 text-left text-sm hover:bg-muted/50"
        >
          <span className="font-medium">
            HTML Content
            {htmlInput && (
              <Badge variant="cyan" className="ml-2">
                {Math.round(htmlInput.length / 1024)}KB
              </Badge>
            )}
          </span>
          <HugeiconsIcon icon={showHtmlInput ? ArrowUp01Icon : ArrowDown01Icon} className="h-4 w-4" />
        </button>

        {showHtmlInput && (
          <div className="border-t p-3">
            <Textarea
              placeholder="Paste your full HTML here..."
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              className="min-h-[150px] font-mono text-xs"
            />
          </div>
        )}
      </div>

      {/* Import result */}
      {importResult && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-emerald-600" />
            <span className="font-medium text-emerald-600">Import Complete</span>
            <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
              <span>Created: {importResult.assetsCreated}</span>
              <span>Updated: {importResult.assetsUpdated}</span>
            </div>
          </div>

          {conversionSummary && (conversionSummary.llmSuccess > 0 || conversionSummary.fallbackUsed > 0) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {conversionSummary.llmSuccess > 0 && <Badge variant="cyan">LLM: {conversionSummary.llmSuccess}</Badge>}
              {conversionSummary.llmFailed > 0 && <Badge variant="orange">LLM Failed: {conversionSummary.llmFailed}</Badge>}
              {conversionSummary.fallbackUsed > 0 && <Badge variant="yellow">Fallback: {conversionSummary.fallbackUsed}</Badge>}
            </div>
          )}

          {importResult.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {importResult.errors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            Import Another
          </Button>
        </div>
      )}
    </div>
  )
}
