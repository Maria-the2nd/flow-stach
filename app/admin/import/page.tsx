"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Upload04Icon,
  ArrowRight01Icon,
  Alert01Icon,
  CheckmarkCircle01Icon,
  CodeIcon,
  PaintBoardIcon,
  GridIcon,
} from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { parseFullHtml, buildCodePayload, extractCssForSection, type DetectedSection, type CssExtractionOptions } from "@/lib/html-parser"
import { extractTokens, generateTokenManifest, tokenManifestToJson, extractFontFamilies, extractGoogleFontsUrl } from "@/lib/token-extractor"
import { buildTokenWebflowPayload, convertSectionToWebflow } from "@/lib/webflow-converter"

type Step = "input" | "preview" | "complete"

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
  header: {
    slug: "fp-navigation",
    title: "Flow Party Header",
    category: "navigation",
    tags: ["navigation", "header", "hero", "nav", "fixed", "responsive"],
  },
  navigation: {
    slug: "fp-navigation",
    title: "Flow Party Header",
    category: "navigation",
    tags: ["navigation", "header", "hero", "nav", "fixed", "responsive"],
  },
  nav: {
    slug: "fp-navigation",
    title: "Flow Party Header",
    category: "navigation",
    tags: ["navigation", "header", "hero", "nav", "fixed", "responsive"],
  },
  hero: {
    slug: "fp-hero",
    title: "Flow Party Hero",
    category: "hero",
    tags: ["hero", "landing", "section", "grid", "responsive"],
  },
  "client-bar": {
    slug: "fp-client-bar",
    title: "Flow Party Client Bar",
    category: "sections",
    tags: ["clients", "logos", "trust", "social-proof", "section"],
  },
  "intro-section": {
    slug: "fp-intro",
    title: "Flow Party Intro",
    category: "sections",
    tags: ["intro", "section", "typography", "trust", "avatars"],
  },
  "bento-section": {
    slug: "fp-bento",
    title: "Flow Party Bento Grid",
    category: "sections",
    tags: ["bento", "grid", "stats", "testimonial", "section"],
  },
  "product-section": {
    slug: "fp-product",
    title: "Flow Party Product (The Stash)",
    category: "sections",
    tags: ["products", "stash", "cards", "grid", "showcase", "section"],
  },
  "packs-section": {
    slug: "fp-packs",
    title: "Flow Party Party Packs",
    category: "sections",
    tags: ["packs", "cards", "pricing", "cta", "section"],
  },
  "features-section": {
    slug: "fp-features",
    title: "Flow Party Features",
    category: "sections",
    tags: ["features", "grid", "cards", "icons", "section"],
  },
  "collaborators-section": {
    slug: "fp-collaborators",
    title: "Flow Party Collaborators",
    category: "sections",
    tags: ["team", "collaborators", "grid", "avatars", "section"],
  },
  "pricing-section": {
    slug: "fp-pricing",
    title: "Flow Party Pricing",
    category: "sections",
    tags: ["pricing", "cards", "section", "tiers", "cta"],
  },
  "faq-section": {
    slug: "fp-faq",
    title: "Flow Party FAQ",
    category: "sections",
    tags: ["faq", "accordion", "section", "questions", "support"],
  },
  "cta-section": {
    slug: "fp-cta",
    title: "Flow Party CTA",
    category: "sections",
    tags: ["cta", "call-to-action", "section", "dark", "watermark"],
  },
  footer: {
    slug: "fp-footer",
    title: "Flow Party Footer",
    category: "navigation",
    tags: ["footer", "navigation", "links", "section"],
  },
}

function mergeNavigationSections(
  sections: DetectedSection[],
  fullCss: string,
  cssOptions: CssExtractionOptions
): DetectedSection[] {
  const navSections = sections.filter((section) => section.tagName === "nav")
  const hasMobileMenu = navSections.some((section) => section.className === "mobile-menu")
  if (!hasMobileMenu || navSections.length <= 1) return sections

  const mergedSelectors = Array.from(
    new Set(navSections.flatMap((section) => section.cssSelectors))
  )
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
  const navSection = sections.find(
    (section) => section.tagName === "nav" || section.className === "nav"
  )
  const heroSection = sections.find(
    (section) => section.className.includes("hero") || section.id.includes("hero")
  )

  if (!navSection || !heroSection) return sections

  const existingIds = new Set(sections.map((section) => section.id))
  let headerId = "header"
  let counter = 1
  while (existingIds.has(headerId)) {
    headerId = `header-${counter}`
    counter += 1
  }

  const mergedSelectors = Array.from(
    new Set([...navSection.cssSelectors, ...heroSection.cssSelectors])
  )
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
    const keyCandidates = [
      section.id,
      section.className,
      section.name.toLowerCase().replace(/\s+/g, "-"),
    ]
    for (const key of keyCandidates) {
      const mapped = FLOW_PARTY_SECTION_MAP[key]
      if (mapped) {
        return {
          slug: mapped.slug,
          name: mapped.title,
          category: mapped.category,
          tags: mapped.tags,
        }
      }
    }
  }

  const category =
    section.tagName === "nav" || section.tagName === "footer"
      ? "navigation"
      : section.id.includes("hero")
        ? "hero"
        : "sections"

  return {
    slug: `${slugPrefix}-${section.id}`,
    name: section.name,
    category,
    tags: [slugPrefix, section.id, ...section.cssSelectors.slice(0, 3)],
  }
}

function createInstanceSlug(baseSlug: string): string {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
  ].join("-")
  const random = Math.random().toString(36).slice(2, 6)
  return `${baseSlug}-${timestamp}-${random}`
}

function stripTokenCss(css: string): string {
  return css
    .replace(/:root\s*\{[^}]*\}/g, "")
    .replace(/\.fp-root\s*\{[^}]*\}/g, "")
    .trim()
}

function getAdminEmails(): string[] {
  const envValue = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""
  return envValue
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function ImportWizard() {
  const { isLoaded: isUserLoaded, user } = useUser()
  const importSections = useMutation(api.import.importSections)

  const [step, setStep] = useState<Step>("input")
  const [htmlInput, setHtmlInput] = useState("")
  const [designSystemName, setDesignSystemName] = useState("")
  const [designSystemImageUrl, setDesignSystemImageUrl] = useState("")
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseFullHtml> | null>(null)
  const [tokenExtraction, setTokenExtraction] = useState<ReturnType<typeof extractTokens> | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
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
      console.log("[convertSectionWithLlm] starting fetch", {
        sectionName: section.name,
        htmlLength: section.htmlContent.length,
        cssLength: section.cssContent.length,
        namespace,
      })

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

        console.log("[convertSectionWithLlm] fetch response", {
          sectionName: section.name,
          ok: response.ok,
          status: response.status,
          duration: Date.now() - startTime,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.warn("[convertSectionWithLlm] LLM failed:", section.name, {
            status: response.status,
            error: errorData.error,
            schemaErrors: errorData.schemaErrors,
            requestId: errorData.requestId,
          })
          return undefined
        }

        const data = await response.json()
        if (data?.requestId) {
          console.info("[convertSectionWithLlm] LLM success:", section.name, {
            requestId: data.requestId,
            duration: Date.now() - startTime,
          })
        }
        return data?.webflowJson as string | undefined
      } catch (error) {
        console.error("[convertSectionWithLlm] fetch EXCEPTION:", section.name, error)
        return undefined
      }
    },
    []
  )

  const resolveWebflowJson = useCallback(
    async (section: DetectedSection, namespace: string): Promise<string | undefined> => {
      console.log("[resolveWebflowJson] called", {
        sectionName: section.name,
        useLlmConversion,
        namespace,
      })

      if (useLlmConversion) {
        console.log("[resolveWebflowJson] calling LLM for:", section.name)
        const llmJson = await convertSectionWithLlm(section, namespace)
        console.log("[resolveWebflowJson] LLM result:", section.name, !!llmJson ? "success" : "failed/empty")
        if (llmJson) return llmJson
      } else {
        console.log("[resolveWebflowJson] LLM disabled, using fallback for:", section.name)
      }

      const fallbackPayload = convertSectionToWebflow(section, { idPrefix: namespace })
      const hasFallback =
        fallbackPayload.payload.nodes.length > 0 || fallbackPayload.payload.styles.length > 0
      console.log("[resolveWebflowJson] fallback result:", section.name, {
        hasPayload: hasFallback,
        nodes: fallbackPayload.payload.nodes.length,
        styles: fallbackPayload.payload.styles.length,
      })
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
        ? {
            includeRoot: false,
            includeReset: false,
            includeBody: false,
            includeHtml: false,
            includeImg: false,
            dedupe: true,
          }
        : { dedupe: true }

      const sectionOptions = {
        includeDivs: true,
        divClassPattern: /^(?:[\w-]+-section|client-bar)$/i,
      }
      const result = parseFullHtml(htmlInput, { cssOptions, sectionOptions })
      let sections = result.sections.filter(
        (section) =>
          section.className &&
          !section.className.toLowerCase().includes("wrapper") &&
          !section.name.toLowerCase().includes("wrapper")
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

      // Extract tokens
      const trimmedName = designSystemName.trim()
      const normalizedName = trimmedName && /flow party/i.test(trimmedName) ? "Flow Party" : trimmedName
      const name = normalizedName || result.title || "Imported Design"
      const tokens = extractTokens(result.fullCss, name)
      const fontUrl = extractGoogleFontsUrl(htmlInput)
      const fontFamilies = extractFontFamilies(result.fullCss)
      if (fontUrl && fontFamilies.length > 0) {
        tokens.fonts = {
          googleFonts: fontUrl,
          families: fontFamilies,
        }
      }

      return {
        result: { ...result, sections },
        tokens,
        designSystemName: name,
      }
    } catch (error) {
      console.error("Parse error:", error)
      toast.error("Failed to parse HTML. Check console for details.")
      return null
    }
  }, [htmlInput, designSystemName, mergeNavigation, combineHeaderHero, stripBaseStyles])

  // Parse HTML
  const handleParse = useCallback(() => {
    const parsed = parseHtml()
    if (!parsed) return

    setParseResult(parsed.result)
    setTokenExtraction(parsed.tokens)
    setDesignSystemName(parsed.designSystemName)

    // Select all sections by default
    setSelectedSections(new Set(parsed.result.sections.map((s) => s.id)))

    setStep("preview")
    const colorCount = parsed.tokens.variables.filter((v) => v.type === "color").length
    const fontCount = parsed.tokens.variables.filter((v) => v.type === "fontFamily").length
    toast.success(`Detected ${parsed.result.sections.length} sections, ${colorCount} colors, ${fontCount} fonts`)
  }, [parseHtml])

  const handleAutoImport = useCallback(async () => {
    const parsed = parseHtml()
    if (!parsed) return

    setIsImporting(true)

    try {
      const baseSlug = parsed.tokens.slug
      const instanceSlug = alwaysCreateNew ? createInstanceSlug(baseSlug) : baseSlug
      const tokensForImport = { ...parsed.tokens, slug: instanceSlug }
      const manifest = generateTokenManifest(tokensForImport)
      const tokenSlug = `${instanceSlug}-tokens`
      const useMap = !alwaysCreateNew && useFlowPartyMap && baseSlug === "flow-party"
      const tokenWebflowPayload = buildTokenWebflowPayload(tokensForImport)
      const tokenWebflowJson =
        tokenWebflowPayload.payload.styles.length > 0 ? JSON.stringify(tokenWebflowPayload) : undefined

      const sectionsToImport = []
      let webflowJsonCount = 0
      let emptyCount = 0
      for (const section of parsed.result.sections) {
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

      // Log conversion summary
      console.log("[handleAutoImport] conversion summary", {
        total: sectionsToImport.length,
        withWebflowJson: webflowJsonCount,
        withoutWebflowJson: emptyCount,
        useLlmConversion,
      })

      // Update summary state for UI
      setConversionSummary({
        llmSuccess: useLlmConversion ? webflowJsonCount : 0,
        llmFailed: useLlmConversion ? emptyCount : 0,
        fallbackUsed: useLlmConversion ? 0 : webflowJsonCount,
        errors: [],
      })

      const result = await importSections({
        designSystemName: parsed.tokens.name,
        designSystemSlug: instanceSlug,
        designSystemImageUrl: designSystemImageUrl.trim() || undefined,
        sections: sectionsToImport,
        tokenManifest: tokenManifestToJson(manifest),
        tokenWebflowJson,
      })

      setParseResult(parsed.result)
      setTokenExtraction(parsed.tokens)
      setImportResult(result)
      setStep("complete")

      if (result.errors.length > 0) {
        toast.warning(`Imported with ${result.errors.length} errors`)
      } else {
        toast.success(`Imported ${result.assetsCreated + result.assetsUpdated} sections!`)
      }
    } catch (error) {
      console.error("Auto import error:", error)
      toast.error("Auto import failed. Check console for details.")
    } finally {
      setIsImporting(false)
    }
  }, [parseHtml, importSections, useFlowPartyMap, alwaysCreateNew, resolveWebflowJson, designSystemImageUrl])

  // Handle file upload
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

      // Extract name from filename
      const name = file.name.replace(/\.html?$/i, "").replace(/-/g, " ")
      setDesignSystemName(name.charAt(0).toUpperCase() + name.slice(1))

      toast.success("File loaded")
    }
    reader.onerror = () => {
      toast.error("Failed to read file")
    }
    reader.readAsText(file)
  }, [])

  // Toggle section selection
  const toggleSection = useCallback((sectionId: string) => {
    setSelectedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }, [])

  // Select/deselect all
  const toggleAll = useCallback(() => {
    if (!parseResult) return
    if (selectedSections.size === parseResult.sections.length) {
      setSelectedSections(new Set())
    } else {
      setSelectedSections(new Set(parseResult.sections.map((s) => s.id)))
    }
  }, [parseResult, selectedSections])

  // Import sections
  const handleImport = useCallback(async () => {
    if (!parseResult || !tokenExtraction || selectedSections.size === 0) {
      toast.error("No sections selected")
      return
    }

    setIsImporting(true)

    try {
      const baseSlug = tokenExtraction.slug
      const instanceSlug = alwaysCreateNew ? createInstanceSlug(baseSlug) : baseSlug
      const tokensForImport = { ...tokenExtraction, slug: instanceSlug }
      const manifest = generateTokenManifest(tokensForImport)
      const tokenSlug = `${instanceSlug}-tokens`
      const useMap = !alwaysCreateNew && useFlowPartyMap && baseSlug === "flow-party"
      const tokenWebflowPayload = buildTokenWebflowPayload(tokensForImport)
      const tokenWebflowJson =
        tokenWebflowPayload.payload.styles.length > 0 ? JSON.stringify(tokenWebflowPayload) : undefined

      const sectionsToImport = []
      let webflowJsonCount = 0
      let emptyCount = 0
      for (const section of parseResult.sections) {
        if (!selectedSections.has(section.id)) continue
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

      // Log conversion summary
      console.log("[handleImport] conversion summary", {
        total: sectionsToImport.length,
        withWebflowJson: webflowJsonCount,
        withoutWebflowJson: emptyCount,
        useLlmConversion,
      })

      // Update summary state for UI
      setConversionSummary({
        llmSuccess: useLlmConversion ? webflowJsonCount : 0,
        llmFailed: useLlmConversion ? emptyCount : 0,
        fallbackUsed: useLlmConversion ? 0 : webflowJsonCount,
        errors: [],
      })

      const result = await importSections({
        designSystemName: tokenExtraction.name,
        designSystemSlug: instanceSlug,
        designSystemImageUrl: designSystemImageUrl.trim() || undefined,
        sections: sectionsToImport,
        tokenManifest: tokenManifestToJson(manifest),
        tokenWebflowJson,
      })

      setImportResult(result)
      setStep("complete")

      if (result.errors.length > 0) {
        toast.warning(`Imported with ${result.errors.length} errors`)
      } else {
        toast.success(`Imported ${result.assetsCreated + result.assetsUpdated} sections!`)
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error("Failed to import. Check console for details.")
    } finally {
      setIsImporting(false)
    }
  }, [parseResult, tokenExtraction, selectedSections, importSections, useFlowPartyMap, alwaysCreateNew, resolveWebflowJson, designSystemImageUrl])

  // Reset wizard
  const handleReset = useCallback(() => {
    setStep("input")
    setHtmlInput("")
    setDesignSystemName("")
    setDesignSystemImageUrl("")
    setParseResult(null)
    setTokenExtraction(null)
    setSelectedSections(new Set())
    setImportResult(null)
    setConversionSummary(null)
  }, [])

  if (!isUserLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ""
  const adminEmails = getAdminEmails()
  const isAdmin = adminEmails.includes(userEmail)

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <HugeiconsIcon icon={Alert01Icon} className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Not Authorized</CardTitle>
            <CardDescription>
              You don&apos;t have permission to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link href="/assets">
                Return to Assets
                <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <HugeiconsIcon icon={Upload04Icon} className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Import HTML Sections</CardTitle>
          <CardDescription>
            {step === "input" && "Paste AI-generated HTML to split into sections and extract design tokens."}
            {step === "preview" && "Review detected sections and select which ones to import."}
            {step === "complete" && "Import complete!"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Step 1: Input */}
          {step === "input" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="design-name">Design System Name</Label>
                <Input
                  id="design-name"
                  placeholder="e.g., Flow Party"
                  value={designSystemName}
                  onChange={(e) => setDesignSystemName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="design-image">Template Thumbnail URL</Label>
                <Input
                  id="design-image"
                  placeholder="https://..."
                  value={designSystemImageUrl}
                  onChange={(e) => setDesignSystemImageUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="html-input">HTML Content</Label>
                <Textarea
                  id="html-input"
                  placeholder="Paste your full HTML here..."
                  value={htmlInput}
                  onChange={(e) => setHtmlInput(e.target.value)}
                  className="min-h-[200px] font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">or</span>
                <Label
                  htmlFor="file-upload"
                  className="cursor-pointer rounded-md border border-dashed px-4 py-2 text-sm hover:bg-muted/50"
                >
                  Upload .html file
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".html,.htm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-dashed p-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Options</Label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={stripBaseStyles}
                    onChange={(event) => setStripBaseStyles(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Strip base styles (:root, reset, body, html, img) from sections
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mergeNavigation}
                    onChange={(event) => setMergeNavigation(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Merge mobile menu + main nav into a single Navigation section
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={combineHeaderHero}
                    onChange={(event) => setCombineHeaderHero(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Create Header (nav + hero) as its own asset
                </label>
                <label className={`flex items-center gap-2 text-sm ${alwaysCreateNew ? "opacity-60" : ""}`}>
                  <input
                    type="checkbox"
                    checked={useFlowPartyMap}
                    onChange={(event) => setUseFlowPartyMap(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                    disabled={alwaysCreateNew}
                  />
                  Use Flow Party slug map (fp-*)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={alwaysCreateNew}
                    onChange={(event) => setAlwaysCreateNew(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Always create new assets (no overwrite)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={useLlmConversion}
                    onChange={(event) => setUseLlmConversion(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Use LLM to generate Webflow JSON (requires OPENROUTER_API_KEY)
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={handleParse} className="w-full" disabled={!htmlInput.trim()}>
                  Parse HTML
                  <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  onClick={handleAutoImport}
                  variant="outline"
                  className="w-full"
                  disabled={!htmlInput.trim() || isImporting}
                >
                  {isImporting ? "Importing..." : "Auto Import (Parse + Import)"}
                </Button>
              </div>
            </>
          )}

          {/* Step 2: Preview */}
          {step === "preview" && parseResult && tokenExtraction && (
            <>
              {/* Token Summary */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <HugeiconsIcon icon={PaintBoardIcon} className="h-4 w-4 text-primary" />
                  Design System: {tokenExtraction.name}
                </div>
                <div className="mt-2 flex gap-4 text-sm text-muted-foreground">
                  <span>{tokenExtraction.variables.filter((v) => v.type === "color").length} colors</span>
                  <span>{tokenExtraction.variables.filter((v) => v.type === "fontFamily").length} fonts</span>
                  {tokenExtraction.modes.length > 0 && (
                    <span>{tokenExtraction.modes.length} modes</span>
                  )}
                </div>
              </div>

              {/* Section List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <HugeiconsIcon icon={GridIcon} className="h-4 w-4" />
                    Sections ({selectedSections.size}/{parseResult.sections.length})
                  </Label>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {selectedSections.size === parseResult.sections.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>

                <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-lg border p-2">
                  {parseResult.sections.map((section) => (
                    <div
                      key={section.id}
                      className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        id={section.id}
                        checked={selectedSections.has(section.id)}
                        onChange={() => toggleSection(section.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor={section.id} className="flex-1 cursor-pointer">
                        <div className="font-medium">{section.name}</div>
                        <div className="text-xs text-muted-foreground">
                          &lt;{section.tagName}&gt; · {section.cssSelectors.length} classes
                        </div>
                      </Label>
                      <HugeiconsIcon icon={CodeIcon} className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("input")} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={selectedSections.size === 0 || isImporting}
                  className="flex-1"
                >
                  {isImporting ? "Importing..." : `Import ${selectedSections.size} Sections`}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Complete */}
          {step === "complete" && importResult && (
            <>
              <div className="rounded-lg border bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5" />
                  Import Successful
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <div>Assets created: {importResult.assetsCreated}</div>
                  <div>Assets updated: {importResult.assetsUpdated}</div>
                  <div>Payloads created: {importResult.payloadsCreated}</div>
                  <div>Payloads updated: {importResult.payloadsUpdated}</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <div className="text-sm font-medium text-destructive">
                    {importResult.errors.length} errors:
                  </div>
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {importResult.errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {conversionSummary && (
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="text-sm font-medium">Webflow Conversion Summary</div>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {conversionSummary.llmSuccess > 0 && (
                      <div className="text-emerald-600">LLM conversions: {conversionSummary.llmSuccess}</div>
                    )}
                    {conversionSummary.llmFailed > 0 && (
                      <div className="text-amber-600">LLM failures (used fallback): {conversionSummary.llmFailed}</div>
                    )}
                    {conversionSummary.fallbackUsed > 0 && (
                      <div>Fallback conversions: {conversionSummary.fallbackUsed}</div>
                    )}
                    {conversionSummary.llmSuccess === 0 && conversionSummary.llmFailed === 0 && conversionSummary.fallbackUsed === 0 && (
                      <div className="text-destructive">No valid Webflow payloads generated</div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  Import Another
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/assets">
                    View Assets
                    <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">Signed in as {userEmail}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminImportPage() {
  return (
    <>
      <SignedIn>
        <ImportWizard />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
