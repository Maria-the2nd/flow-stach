"use client"

import { useState, useCallback, useMemo } from "react"
import Link from "next/link"
import { useUser } from "@clerk/nextjs"
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
  FileEditIcon,
  JavaScriptIcon,
  Layers01Icon,
  Copy01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SafetyReportPanel } from "@/components/validation/SafetyReportPanel"
import { Loader2 } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { extractCleanHtml, extractJsHooks, extractCssForSection, getClassesUsed } from "@/lib/html-parser"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { extractEnhancedTokens, type TokenExtraction, type EnhancedTokenExtraction } from "@/lib/token-extractor"
import { parseCSS, type ClassIndex } from "@/lib/css-parser"
import { componentizeHtml, type ComponentTree, type Component } from "@/lib/componentizer"
import { buildCssTokenPayload, buildComponentPayload, validateForWebflowPaste } from "@/lib/webflow-converter"
import { copyWebflowJson } from "@/lib/clipboard"
import { normalizeHtmlCssForWebflow } from "@/lib/webflow-normalizer"
import { literalizeCssForWebflow } from "@/lib/webflow-literalizer"
import { ensureWebflowPasteSafety } from "@/lib/webflow-safety-gate"
import { diagnoseVisibilityIssues } from "@/lib/webflow-verifier"
import { extractImages, type ImageAsset } from "@/lib/image-extractor"
import {
  applySemanticPatchResponse,
  buildSemanticPatchRequest,
  type FlowbridgeSemanticPatchResponse,
  type FlowbridgeSemanticPatchMeta,
  applyDeterministicComponentNames,
} from "@/lib/flowbridge-semantic"

type Step = "input" | "artifacts" | "complete"
type ProcessingStatus = "idle" | "parsing" | "extracting" | "componentizing" | "semantic" | "generating" | "complete"

interface UnsupportedContentResult {
  cleanedHtml: string
  removedReferences: string[]
  hasReact: boolean
  hasTailwind: boolean
  hasTypescript: boolean
}

type DetectedFont = {
  name: string
  source: string
  url?: string
  status: string
  warning?: boolean
  installationGuide: string
}

/**
 * Detects and removes unsupported content from HTML:
 * - .tsx/.jsx script references (React/TypeScript)
 * - Tailwind CDN or config references
 * Returns cleaned HTML and list of removed references
 */
function detectAndRemoveUnsupportedContent(html: string): UnsupportedContentResult {
  const removedReferences: string[] = []
  let cleanedHtml = html
  let hasReact = false
  let hasTailwind = false
  let hasTypescript = false

  // Detect and remove .tsx and .jsx script tags
  const tsxJsxRegex = /<script[^>]*src=["'][^"']*\.(tsx|jsx)["'][^>]*>[\s\S]*?<\/script>|<script[^>]*src=["'][^"']*\.(tsx|jsx)["'][^>]*\/?>/gi
  const tsxJsxMatches = cleanedHtml.match(tsxJsxRegex)
  if (tsxJsxMatches) {
    tsxJsxMatches.forEach(match => {
      const srcMatch = match.match(/src=["']([^"']+)["']/)
      if (srcMatch) {
        removedReferences.push(srcMatch[1])
        if (srcMatch[1].endsWith('.tsx')) hasTypescript = true
      }
    })
    cleanedHtml = cleanedHtml.replace(tsxJsxRegex, '<!-- Removed: React/TypeScript module -->')
    hasReact = true
  }

  // Detect and remove type="module" scripts pointing to tsx/jsx
  const moduleRegex = /<script[^>]*type=["']module["'][^>]*src=["'][^"']*\.(tsx|jsx)["'][^>]*>[\s\S]*?<\/script>|<script[^>]*type=["']module["'][^>]*src=["'][^"']*\.(tsx|jsx)["'][^>]*\/?>/gi
  const moduleMatches = cleanedHtml.match(moduleRegex)
  if (moduleMatches) {
    moduleMatches.forEach(match => {
      const srcMatch = match.match(/src=["']([^"']+)["']/)
      if (srcMatch && !removedReferences.includes(srcMatch[1])) {
        removedReferences.push(srcMatch[1])
        if (srcMatch[1].endsWith('.tsx')) hasTypescript = true
      }
    })
    cleanedHtml = cleanedHtml.replace(moduleRegex, '<!-- Removed: React/TypeScript module -->')
    hasReact = true
  }

  // Detect Tailwind CDN or config
  const tailwindCdnRegex = /<script[^>]*src=["'][^"']*tailwindcss[^"']*["'][^>]*>[\s\S]*?<\/script>|<script[^>]*src=["'][^"']*tailwindcss[^"']*["'][^>]*\/?>/gi
  const tailwindConfigRegex = /<script[^>]*>[\s\S]*?tailwind\.config[\s\S]*?<\/script>/gi

  if (tailwindCdnRegex.test(cleanedHtml)) {
    cleanedHtml = cleanedHtml.replace(tailwindCdnRegex, '<!-- Removed: Tailwind CDN -->')
    removedReferences.push('Tailwind CSS CDN')
    hasTailwind = true
  }

  if (tailwindConfigRegex.test(cleanedHtml)) {
    cleanedHtml = cleanedHtml.replace(tailwindConfigRegex, '<!-- Removed: Tailwind config -->')
    if (!removedReferences.includes('Tailwind CSS CDN')) {
      removedReferences.push('Tailwind CSS config')
    }
    hasTailwind = true
  }

  // Detect React CDN
  const reactCdnRegex = /<script[^>]*src=["'][^"']*(react|react-dom)[^"']*["'][^>]*>[\s\S]*?<\/script>|<script[^>]*src=["'][^"']*(react|react-dom)[^"']*["'][^>]*\/?>/gi
  if (reactCdnRegex.test(cleanedHtml)) {
    cleanedHtml = cleanedHtml.replace(reactCdnRegex, '<!-- Removed: React CDN -->')
    removedReferences.push('React CDN')
    hasReact = true
  }

  // Detect inline JSX-like content (basic check for React patterns)
  const jsxPatterns = /className=\{|useState\(|useEffect\(|<\w+\s+\{\.\.\.props\}/
  if (jsxPatterns.test(cleanedHtml)) {
    hasReact = true
  }

  return {
    cleanedHtml,
    removedReferences,
    hasReact,
    hasTailwind,
    hasTypescript,
  }
}

interface ExtractedArtifacts {
  tokensJson: string
  tokensCss: string
  stylesCss: string
  classIndex: ClassIndex
  cleanHtml: string
  scriptsJs: string
  jsHooks: string[]
  cssVariables: Map<string, string>
  externalScripts: string[]
}

interface ImportResult {
  projectId: string
  assetsCreated: number
  assetsUpdated: number
  payloadsCreated: number
  payloadsUpdated: number
  artifactsStored: number
  errors: string[]
}

interface LlmSummary {
  mode: FlowbridgeSemanticPatchMeta["mode"]
  model?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  renamedComponents: number
  htmlMutations: number
  cssMutations: number
  remainingCssVarCount: number
  reason?: string
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  className,
  rightElement,
}: {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  rightElement?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className={cn("border rounded-lg bg-card text-card-foreground shadow-sm", className)}>
      <div className="flex items-center justify-between p-4">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
        >
          {isOpen ? <HugeiconsIcon icon={ArrowDown01Icon} size={16} /> : <HugeiconsIcon icon={ArrowRight01Icon} size={16} />}
          {title}
        </button>
        {rightElement}
      </div>
      {isOpen && <div className="p-4 border-t pt-0">{children}</div>}
    </div>
  )
}

function ProcessingTimeline({ status }: { status: ProcessingStatus }) {
  const steps: { id: ProcessingStatus; label: string }[] = [
    { id: "parsing", label: "Parsing HTML & CSS" },
    { id: "extracting", label: "Extracting Tokens" },
    { id: "componentizing", label: "Identifying Components" },
    { id: "semantic", label: "Refining with AI" },
    { id: "generating", label: "Preparing Assets" },
  ]

  const getCurrentStepIndex = (s: ProcessingStatus) => {
    if (s === "idle") return -1
    if (s === "complete") return steps.length
    return steps.findIndex((step) => step.id === s)
  }

  const currentIndex = getCurrentStepIndex(status)

  return (
    <div className="space-y-4 py-4">
      <h3 className="text-sm font-medium text-muted-foreground">Processing...</h3>
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex || status === "complete"
          const isCurrent = index === currentIndex

          return (
            <div key={step.id} className="flex items-center gap-3 text-sm">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border",
                  isComplete
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary text-primary animate-pulse"
                      : "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isComplete ? (
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} />
                ) : isCurrent ? (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              <span
                className={cn(
                  isComplete ? "text-foreground" : isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ArtifactViewer({ content, maxHeight = "400px" }: { content: string; maxHeight?: string }) {
  return (
    <div className="relative">
      <pre
        className={cn("bg-muted rounded-lg p-4 text-sm overflow-auto font-mono", "border border-border")}
        style={{ maxHeight }}
      >
        <code>{content}</code>
      </pre>
    </div>
  )
}

export function ImportWizard() {
  const { isLoaded: isUserLoaded } = useUser()
  const importProject = useMutation(api.import.importProject)

  const [step, setStep] = useState<Step>("input")
  const [htmlInput, setHtmlInput] = useState("")
  const [projectName, setProjectName] = useState("")
  const [projectSlug, setProjectSlug] = useState("")
  const [artifacts, setArtifacts] = useState<ExtractedArtifacts | null>(null)
  const [componentTree, setComponentTree] = useState<ComponentTree | null>(null)
  const [tokenWebflowJson, setTokenWebflowJson] = useState<string | null>(null)
  const [establishedClasses, setEstablishedClasses] = useState<Set<string>>(new Set())
  const [tokenExtraction, setTokenExtraction] = useState<TokenExtraction | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [skipEstablishedStyles, setSkipEstablishedStyles] = useState(true)
  const [detectedImages, setDetectedImages] = useState<ImageAsset[]>([])
  const [detectedFonts, setDetectedFonts] = useState<DetectedFont[]>([])
  const [llmSummary, setLlmSummary] = useState<LlmSummary | null>(null)
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>("idle")
  const [unsupportedContentDialog, setUnsupportedContentDialog] = useState<{
    open: boolean
    removedReferences: string[]
    hasReact: boolean
    hasTailwind: boolean
    hasTypescript: boolean
  }>({ open: false, removedReferences: [], hasReact: false, hasTailwind: false, hasTypescript: false })

  const handleParse = useCallback(async () => {
    if (!htmlInput.trim()) {
      toast.error("Please paste HTML content")
      return
    }

    // Check for unsupported content (React, Tailwind, TypeScript)
    const unsupportedCheck = detectAndRemoveUnsupportedContent(htmlInput)
    let processedHtml = htmlInput

    if (unsupportedCheck.removedReferences.length > 0) {
      // Show warning dialog
      setUnsupportedContentDialog({
        open: true,
        removedReferences: unsupportedCheck.removedReferences,
        hasReact: unsupportedCheck.hasReact,
        hasTailwind: unsupportedCheck.hasTailwind,
        hasTypescript: unsupportedCheck.hasTypescript,
      })
      // Use cleaned HTML
      processedHtml = unsupportedCheck.cleanedHtml
      setHtmlInput(processedHtml)
    }

    let stage = "start"
    let pendingArtifacts: ExtractedArtifacts | null = null
    let tokens: EnhancedTokenExtraction | null = null
    try {
      stage = "parsing"
      setProcessingStatus("parsing")
      setLlmSummary(null)
      const cleanResult = extractCleanHtml(processedHtml)
      const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles)
      const cssResult = parseCSS(normalization.css)

      stage = "extracting"
      setProcessingStatus("extracting")
      const name = projectName || "Imported Design"

      // Use enhanced token extraction with HTML support for font detection
      tokens = extractEnhancedTokens(normalization.css, htmlInput, name)

      // Prepare JS content including external scripts
      const externalScriptComments = cleanResult.externalScripts.length > 0
        ? cleanResult.externalScripts.map(url => `// External Library: ${url}`).join('\n') + '\n\n'
        : '';
      const fullScriptsJs = externalScriptComments + cleanResult.extractedScripts;

      // Format tokens for database storage
      const colorTokens = tokens.variables
        .filter(v => v.type === 'color')
        .map(v => ({
          name: v.cssVar.replace('--', ''),
          value: v.values?.light || v.value || '',
        }));

      const typographyTokens = tokens.variables
        .filter(v => v.type === 'fontFamily')
        .map(v => ({
          name: v.cssVar.replace('--', ''),
          value: v.value || '',
        }));

      const spacingTokens = tokens.variables
        .filter(v => v.type === 'spacing')
        .map(v => ({
          name: v.cssVar.replace('--', ''),
          value: v.value || '',
        }));

      pendingArtifacts = {
        tokensJson: JSON.stringify(
          {
            name: tokens.name,
            namespace: tokens.namespace,
            variables: tokens.variables,
            colors: colorTokens,
            typography: typographyTokens,
            spacing: spacingTokens,
            radius: tokens.radius || [],
            shadows: tokens.shadows || [],
            fonts: tokens.fonts ? {
              googleFonts: tokens.fonts.googleFonts || "",
              headSnippet: tokens.fonts.googleFonts ? `<link href="${tokens.fonts.googleFonts}" rel="stylesheet">` : "",
              families: tokens.fonts.families || [],
            } : undefined
          },
          null,
          2
        ),
        tokensCss: cssResult.tokensCss,
        stylesCss: normalization.css,
        classIndex: cssResult.classIndex,
        cleanHtml: normalization.html,
        scriptsJs: fullScriptsJs,
        jsHooks: extractJsHooks(normalization.html),
        cssVariables: cssResult.cssVariables,
        externalScripts: cleanResult.externalScripts,
      }
      setArtifacts(pendingArtifacts)
      const initialTokenPayload = buildCssTokenPayload(normalization.css, { namespace: tokens.namespace, includePreview: true })
      setTokenWebflowJson(JSON.stringify(initialTokenPayload.webflowPayload))
      setEstablishedClasses(initialTokenPayload.establishedClasses)
      setTokenExtraction(tokens)

      stage = "componentizing"
      setProcessingStatus("componentizing")
      let components = componentizeHtml(normalization.html)
      const namingResult = applyDeterministicComponentNames(components)
      components = namingResult.componentTree
      const genericNameRegex = /^(section|block|article|main content|sidebar|navigation|header|footer)\s*\d*$/i
      const hasGenericNames = components.components.some((component) =>
        genericNameRegex.test(component.name.trim())
      )

      stage = "semantic"
      setProcessingStatus("semantic")
      let finalCss = normalization.css
      let llmMeta: FlowbridgeSemanticPatchMeta | null = null
      const patchCounts = { renamedComponents: 0, htmlMutations: 0, cssMutations: 0 }
      const preLiteralization = literalizeCssForWebflow(normalization.css)
      const forceLlm = process.env.NEXT_PUBLIC_FLOWBRIDGE_FORCE_LLM === "1"
      const semanticContext = buildSemanticPatchRequest(
        normalization.html,
        components,
        cssResult.classIndex,
        cssResult.cssVariables
      )
      const shouldInvokeLlm =
        forceLlm ||
        preLiteralization.remainingVarCount > 0 ||
        semanticContext.warnings.length > 0 ||
        hasGenericNames
      try {
        if (shouldInvokeLlm) {
          const response = await fetch("/api/flowbridge/semantic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request: semanticContext.request,
              model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL,
            }),
          })

          if (!response.ok) {
            llmMeta = { mode: "fallback", reason: `http_${response.status}` }
            toast.warning("LLM unavailable. Using deterministic conversion.")
          } else {
            const data = (await response.json()) as
              | {
                ok: true
                response: FlowbridgeSemanticPatchResponse
                meta: FlowbridgeSemanticPatchMeta
              }
              | {
                ok: false
                reason: string
                meta?: FlowbridgeSemanticPatchMeta
              }

            llmMeta = ("meta" in data ? data.meta : null) ?? null
            if ("ok" in data && data.ok && "response" in data) {
              const snapshotComponents =
                typeof structuredClone === "function"
                  ? structuredClone(components)
                  : (JSON.parse(JSON.stringify(components)) as typeof components)
              const snapshotCss = finalCss
              try {
                const applyResult = applySemanticPatchResponse({
                  componentTree: components,
                  patch: data.response,
                })

                const patchedHtml = applyResult.patchedHtml.trim()
                const hasEmptyComponentHtml = applyResult.componentTree.components.some(
                  (component) => !component.htmlContent.trim()
                )
                if (!patchedHtml || hasEmptyComponentHtml) {
                  components = snapshotComponents
                  finalCss = snapshotCss
                  llmMeta = { ...(llmMeta ?? { mode: "fallback" }), mode: "fallback", reason: "patch_rejected" }
                  toast.warning("LLM patch rejected. Using deterministic conversion.")
                } else {
                  components = applyResult.componentTree
                  finalCss =
                    data.response.cssPatches[data.response.cssPatches.length - 1]?.op === "replaceFinalCss"
                      ? data.response.cssPatches[data.response.cssPatches.length - 1].css
                      : finalCss
                  patchCounts.renamedComponents = applyResult.applied.renames
                  patchCounts.htmlMutations = applyResult.applied.htmlPatches
                  patchCounts.cssMutations = data.response.cssPatches.length
                }
              } catch (error) {
                components = snapshotComponents
                finalCss = snapshotCss
                llmMeta = { ...(llmMeta ?? { mode: "fallback" }), mode: "fallback", reason: "patch_apply_error" }
                console.warn("LLM_PATCH_ERROR", { error: String(error) })
                toast.warning("LLM patch failed. Using deterministic conversion.")
              }
            } else if ("ok" in data && !data.ok) {
              llmMeta = data.meta ?? { mode: "fallback", reason: data.reason }
              toast.warning("LLM unavailable. Using deterministic conversion.")
            }
          }
        } else {
          llmMeta = { mode: "fallback", reason: "no_semantic_issues" }
        }
      } catch (error) {
        llmMeta = { mode: "fallback", reason: "llm_error" }
        console.warn("LLM_UNAVAILABLE", { error: String(error) })
        toast.warning("LLM error. Using deterministic conversion.")
      }

      stage = "generating"
      setProcessingStatus("generating")
      const literalization = literalizeCssForWebflow(finalCss, { strict: process.env.NEXT_PUBLIC_FLOWBRIDGE_STRICT_LLM === "1" })
      const finalCssResult = parseCSS(literalization.css)
      const tokenPayloadResult = buildCssTokenPayload(literalization.css, { namespace: tokens.namespace, includePreview: true })
      const warnings = validateForWebflowPaste(finalCssResult.classIndex, components.components)
      const visibilityWarnings = diagnoseVisibilityIssues(normalization.html, literalization.css)

      pendingArtifacts = {
        tokensJson: JSON.stringify(
          { name: tokens.name, namespace: tokens.namespace, variables: tokens.variables, fonts: tokens.fonts },
          null,
          2
        ),
        tokensCss: cssResult.tokensCss,
        stylesCss: literalization.css,
        classIndex: finalCssResult.classIndex,
        cleanHtml: normalization.html,
        scriptsJs: cleanResult.extractedScripts,
        jsHooks: extractJsHooks(normalization.html),
        cssVariables: finalCssResult.cssVariables,
        externalScripts: cleanResult.externalScripts,
      }
      setArtifacts(pendingArtifacts)
      setComponentTree(components)
      setTokenWebflowJson(JSON.stringify(tokenPayloadResult.webflowPayload))
      setEstablishedClasses(tokenPayloadResult.establishedClasses)
      setTokenExtraction(tokens)
      const combinedWarnings = [
        ...warnings,
        ...tokenPayloadResult.warnings,
        ...normalization.warnings,
        ...literalization.warnings,
        ...visibilityWarnings,
      ]
      if (combinedWarnings.length > 0) {
        console.info("Import warnings:", combinedWarnings)
      }

      // Extract images for the database
      const images = extractImages(normalization.html, literalization.css)
      setDetectedImages(images)

      // Map fonts for the database
      const googleFontsUrl = tokens?.fonts?.googleFonts || "";
      const fontFamilies = tokens?.fonts?.families || [];
      const mappedFonts = fontFamilies.map(f => ({
        name: f,
        source: "Google Fonts",
        url: googleFontsUrl,
        status: "pending",
        warning: false,
        installationGuide: `Go to Site Settings -> Fonts and add ${f}`
      }));
      setDetectedFonts(mappedFonts)

      setLlmSummary({
        mode: llmMeta?.mode ?? "fallback",
        model: llmMeta?.model,
        renamedComponents: patchCounts.renamedComponents,
        htmlMutations: patchCounts.htmlMutations,
        cssMutations: patchCounts.cssMutations,
        remainingCssVarCount: literalization.remainingVarCount,
        reason: llmMeta?.reason,
      })

      if (!projectName) setProjectName(tokens.name)
      if (!projectSlug) setProjectSlug(tokens.slug)

      setProcessingStatus("complete")
      setStep("artifacts")
      toast.success(
        `Extracted ${components.components.length} components, ${Object.keys(finalCssResult.classIndex.classes).length} classes`
      )
    } catch (error: unknown) {
      const errorStage =
        typeof error === "object" &&
          error !== null &&
          "stage" in error &&
          typeof (error as { stage?: unknown }).stage === "string"
          ? (error as { stage: string }).stage
          : stage

      console.error("Parse error:", error)
      toast.error(`Failed during ${errorStage}. Check console.`)
      setProcessingStatus("idle")
      if (pendingArtifacts) {
        setArtifacts(pendingArtifacts)
        setComponentTree({
          components: [],
          rootOrder: [],
          repeatedPatterns: [],
          warnings: [errorStage],
        })
        if (tokens) setTokenExtraction(tokens)
        setStep("artifacts")
      }
    }
  }, [htmlInput, projectName, projectSlug])

  const componentSafetyReports = useMemo(() => {
    if (!artifacts || !componentTree) {
      return new Map<string, ReturnType<typeof ensureWebflowPasteSafety>["report"]>()
    }

    const reports = new Map<string, ReturnType<typeof ensureWebflowPasteSafety>["report"]>()
    for (const component of componentTree.components) {
      try {
        const result = buildComponentPayload(component, artifacts.classIndex, establishedClasses, {
          skipEstablishedStyles,
        })
        const safety = ensureWebflowPasteSafety({ payload: result.webflowPayload })
        reports.set(component.id, safety.report)
      } catch {
        // Skip report if payload fails to build or validate
      }
    }
    return reports
  }, [artifacts, componentTree, establishedClasses, skipEstablishedStyles])

  const handleCopyComponent = useCallback(
    async (component: Component) => {
      if (!artifacts) {
        toast.error("No artifacts available")
        return
      }
      try {
        const forceIncludeEstablishedStyles = component.id === "full-page-copy"
        const result = buildComponentPayload(component, artifacts.classIndex, establishedClasses, {
          skipEstablishedStyles: forceIncludeEstablishedStyles ? false : skipEstablishedStyles,
        })
        const copyResult = await copyWebflowJson(JSON.stringify(result.webflowPayload))
        if (copyResult.success) {
          toast.success(`${component.name} copied! Paste in Webflow Designer.`)
        } else {
          toast.error("Failed to copy to clipboard")
        }
      } catch (error) {
        console.error("Copy error:", error)
        toast.error(`Failed to copy ${component.name}`)
      }
    },
    [artifacts, establishedClasses, skipEstablishedStyles]
  )

  const handleImport = useCallback(async () => {
    if (!artifacts || !componentTree || !tokenExtraction) {
      toast.error("Please parse HTML first")
      return
    }
    setIsImporting(true)
    try {
      const slug = projectSlug || generateSlug(projectName || "imported")
      const componentsToImport = componentTree.components.map((component) => {
        const payloadResult = buildComponentPayload(component, artifacts.classIndex, establishedClasses)

        const cssSnippet = extractCssForSection(artifacts.stylesCss, component.classesUsed, {
          includeRoot: false,
          includeReset: false,
          includeBody: false,
          includeHtml: false,
          includeImg: false,
          includeKeyframes: true,
          dedupe: true,
        })

        const jsSnippet = artifacts.scriptsJs || ""
        const cssBlock = cssSnippet || "/* Uses design system token classes. See tokens asset. */"
        const jsBlock = jsSnippet ? `\n\n/* JS */\n${jsSnippet}` : ""

        return {
          id: component.id,
          name: component.name,
          slug: `${slug}-${component.id}`,
          category:
            component.type === "nav" || component.type === "footer"
              ? "navigation"
              : component.type === "hero"
                ? "hero"
                : "sections",
          tags: [slug, component.type, ...component.classesUsed.slice(0, 5)],
          htmlContent: component.htmlContent,
          classesUsed: component.classesUsed,
          jsHooks: component.jsHooks,
          webflowJson: JSON.stringify(payloadResult.webflowPayload),
          codePayload: `/* HTML */\n${component.htmlContent}\n\n/* CSS */\n${cssBlock}${jsBlock}`,
        }
      })

      const fullPageWrapperHtml = `<div>\n${artifacts.cleanHtml}\n</div>`
      const fullPageClasses = getClassesUsed(fullPageWrapperHtml)
      const fullPageComponent: Component = {
        id: "full-page",
        name: "Full Page",
        type: "section",
        tagName: "div",
        primaryClass: "",
        htmlContent: fullPageWrapperHtml,
        classesUsed: fullPageClasses,
        assetsUsed: [],
        jsHooks: extractJsHooks(fullPageWrapperHtml),
        children: [],
        order: -999,
      }

      const fullPagePayload = buildComponentPayload(
        fullPageComponent,
        artifacts.classIndex,
        establishedClasses
      )

      const fullPageCssSnippet = extractCssForSection(artifacts.stylesCss, fullPageClasses, {
        includeRoot: true,
        includeReset: true,
        includeBody: true,
        includeHtml: true,
        includeImg: true,
        includeKeyframes: true,
        dedupe: true,
      })
      const fullPageJsSnippet = artifacts.scriptsJs || ""
      const fullPageCssBlock = fullPageCssSnippet || "/* Uses design system token classes. See tokens asset. */"
      const fullPageJsBlock = fullPageJsSnippet ? `\n\n/* JS */\n${fullPageJsSnippet}` : ""

      componentsToImport.push({
        id: fullPageComponent.id,
        name: fullPageComponent.name,
        slug: `${slug}-full-page`,
        category: "full-page",
        tags: [slug, "full-page"],
        htmlContent: fullPageComponent.htmlContent,
        classesUsed: fullPageComponent.classesUsed,
        jsHooks: fullPageComponent.jsHooks,
        webflowJson: JSON.stringify(fullPagePayload.webflowPayload),
        codePayload: `/* HTML */\n${fullPageComponent.htmlContent}\n\n/* CSS */\n${fullPageCssBlock}${fullPageJsBlock}`,
      })
      const result = await importProject({
        projectName: projectName || "Imported Design",
        projectSlug: slug,
        artifacts: {
          tokensJson: artifacts.tokensJson,
          tokensCss: artifacts.tokensCss,
          stylesCss: artifacts.stylesCss,
          classIndex: JSON.stringify(artifacts.classIndex),
          cleanHtml: artifacts.cleanHtml,
          scriptsJs: artifacts.scriptsJs,
          externalScripts: artifacts.externalScripts,
          jsHooks: artifacts.jsHooks,
        },
        components: componentsToImport,
        tokenWebflowJson: tokenWebflowJson || undefined,
        sourceHtml: htmlInput.length < 500000 ? htmlInput : undefined,
        images: detectedImages,
        fonts: detectedFonts,
      })
      setImportResult(result)
      setStep("complete")
      if (result.errors.length > 0) {
        toast.warning(`Imported with ${result.errors.length} errors`)
      } else {
        toast.success(`Imported ${result.assetsCreated + result.assetsUpdated} assets!`)
      }
    } catch (error) {
      console.error("Import error:", error)
      toast.error("Import failed. Check console for details.")
    } finally {
      setIsImporting(false)
    }
  }, [
    artifacts,
    componentTree,
    tokenExtraction,
    projectName,
    projectSlug,
    tokenWebflowJson,
    htmlInput,
    establishedClasses,
    importProject,
    detectedImages,
    detectedFonts,
  ])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reject .tsx, .jsx, .ts files directly
    if (file.name.endsWith(".tsx") || file.name.endsWith(".jsx") || file.name.endsWith(".ts")) {
      toast.error("This importer only supports HTML files. React/TypeScript files (.tsx, .jsx, .ts) are not supported.")
      return
    }

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      toast.error("Please upload an HTML file")
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setHtmlInput(content)
      const name = file.name.replace(/\.html?$/i, "").replace(/-/g, " ")
      setProjectName(name.charAt(0).toUpperCase() + name.slice(1))

      // Quick check for potential issues
      const quickCheck = detectAndRemoveUnsupportedContent(content)
      if (quickCheck.removedReferences.length > 0) {
        toast.warning("File contains React/TypeScript/Tailwind references. These will be removed during parsing.")
      } else {
        toast.success("File loaded")
      }
    }
    reader.onerror = () => toast.error("Failed to read file")
    reader.readAsText(file)
  }, [])

  const handleReset = useCallback(() => {
    setStep("input")
    setHtmlInput("")
    setProjectName("")
    setProjectSlug("")
    setArtifacts(null)
    setComponentTree(null)
    setTokenWebflowJson(null)
    setEstablishedClasses(new Set())
    setTokenExtraction(null)
    setImportResult(null)
    setValidationWarnings([])
    setSkipEstablishedStyles(false)
    setLlmSummary(null)
  }, [])

  if (!isUserLoaded) {
    return <div className="flex min-h-[200px] items-center justify-center">Loading...</div>
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-20">
      {/* Unsupported Content Warning Dialog */}
      <AlertDialog
        open={unsupportedContentDialog.open}
        onOpenChange={(open) => setUnsupportedContentDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent className="glass-card border-none shadow-2xl sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-blue-600">
              <HugeiconsIcon icon={Alert01Icon} size={24} />
              Refined Processing
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4 text-slate-600 font-medium">
              <div>
                To ensure a premium design system integration, we refined your code:
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 space-y-2">
                <div className="font-bold text-blue-900 ">Adjustments made:</div>
                <ul className="list-disc list-inside text-sm space-y-1 text-blue-800/70">
                  {unsupportedContentDialog.removedReferences.map((ref, i) => (
                    <li key={i} className="font-mono text-xs">{ref}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 shadow-lg shadow-blue-200/50"
              onClick={() => setUnsupportedContentDialog(prev => ({ ...prev, open: false }))}
            >
              Perfect, Proceed
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col items-center text-center space-y-3 pt-10">
        <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-blue-600/60 bg-blue-50 px-4 py-1.5 rounded-full">Project Engine</span>
        <h1 className="premium-gradient-text font-display text-4xl leading-none tracking-tight sm:text-6xl uppercase">
          Import Design
        </h1>
        <p className="max-w-xl text-slate-500 font-medium text-sm sm:text-base leading-relaxed">
          Inject any AI-generated HTML/CSS into your library. <br className="hidden sm:block" />
          We&apos;ll automatically extract components, tokens, and assets.
        </p>
      </div>

      {step === "input" && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <Card className="glass-card border-none overflow-hidden rounded-[40px]">
            <CardContent className="p-1.5 sm:p-2">
              <div className="relative group">
                <div className="flex flex-col sm:flex-row gap-2 mb-2">
                  <div className="flex-grow glass-card border-none rounded-[32px] px-6 py-4 focus-within:ring-2 ring-blue-500/20 transition-all flex items-center gap-4">
                    <HugeiconsIcon icon={FileEditIcon} className="text-blue-500" size={20} />
                    <input
                      className="bg-transparent border-none text-slate-900 font-bold placeholder:text-slate-300 w-full focus:outline-none"
                      placeholder="Name your masterpiece"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                  </div>
                  <div className="glass-card border-none rounded-[32px] px-6 py-4 flex items-center gap-2 cursor-pointer hover:bg-white/80 transition-all overflow-hidden relative">
                    <Label htmlFor="fileUpload" className="flex items-center gap-3 cursor-pointer">
                      <HugeiconsIcon icon={Upload04Icon} className="text-slate-400 group-hover:text-blue-500" size={20} />
                      <span className="text-sm font-bold text-slate-600 whitespace-nowrap">Upload .html</span>
                    </Label>
                    <input id="fileUpload" type="file" accept=".html,.htm" className="hidden" onChange={handleFileUpload} />
                  </div>
                </div>

                <div className="bg-slate-50/50 rounded-[32px] p-6 min-h-[400px] border border-slate-100/50 relative overflow-hidden transition-all duration-700 group-focus-within:border-blue-500/20 group-focus-within:bg-white/40">
                  <Textarea
                    id="htmlInput"
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    placeholder="Paste the code here..."
                    className="absolute inset-0 bg-transparent border-none focus-visible:ring-0 font-mono text-sm resize-none p-8 text-slate-600 h-full w-full"
                  />
                  {!htmlInput && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                      <HugeiconsIcon icon={CodeIcon} size={120} className="text-slate-400" strokeWidth={1} />
                    </div>
                  )}
                </div>

                <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-4">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={14} className="text-green-500" />
                    HTML / CSS / JS ONLY
                  </div>

                  <Button
                    size="lg"
                    onClick={handleParse}
                    disabled={!htmlInput.trim() || processingStatus !== "idle"}
                    className="bg-blue-600 hover:bg-black text-white rounded-full px-12 h-14 font-black shadow-xl shadow-blue-200/50 group transition-all duration-500 hover:scale-105"
                  >
                    {processingStatus === "idle" ? (
                      <>
                        <span className="mr-3">EXTRACT ASSETS</span>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    ) : (
                      <span className="animate-pulse">PROCESSING...</span>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {processingStatus !== "idle" && (
            <div className="mt-12 glass-card p-10 rounded-[40px] border-none animate-in fade-in zoom-in duration-700">
              <ProcessingTimeline status={processingStatus} />
            </div>
          )}
        </div>
      )}

      {step === "artifacts" && artifacts && (
        <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Header Status Card */}
            <div className="glass-card border-none p-8 rounded-[40px] flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-[4] group-hover:rotate-12 transition-transform duration-1000 pointer-events-none">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={120} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tighter uppercase text-slate-900">{projectName}</h2>
                <div className="flex flex-wrap gap-3">
                  <Badge variant="secondary" className="rounded-full bg-blue-50 text-blue-600 border-none px-4 py-1 font-bold text-[10px] uppercase">
                    {componentTree?.components.length || 0} Components
                  </Badge>
                  <Badge variant="secondary" className="rounded-full bg-slate-50 text-slate-600 border-none px-4 py-1 font-bold text-[10px] uppercase tracking-widest font-mono">
                    {Object.keys(artifacts.classIndex.classes).length} Styles
                  </Badge>
                  {llmSummary?.mode !== "live" && (
                    <Badge variant="secondary" className="rounded-full bg-purple-50 text-purple-600 border-none px-4 py-1 font-bold text-[10px] uppercase">
                      AI Optimized
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="bg-blue-600 hover:bg-black text-white rounded-full px-10 h-16 font-black shadow-2xl shadow-blue-200/50 text-lg transition-all duration-500"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="animate-spin mr-3" size={24} />
                    SAVING...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} size={24} className="mr-3 text-white/50" />
                    SAVE TO LIBRARY
                  </>
                )}
              </Button>
            </div>

            {/* Visual Preview Grid */}
            <div className="glass-card border-none p-10 rounded-[40px] space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg uppercase tracking-widest text-slate-900 border-l-4 border-blue-600 pl-6">Detected Visuals</h3>
                <span className="text-xs font-bold text-slate-400">{detectedImages.length} Matches</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {detectedImages.slice(0, 8).map((img, i) => (
                  <div key={i} className="aspect-square rounded-[24px] overflow-hidden bg-slate-50 border border-slate-100 group relative">
                    <img src={img.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Badge className="bg-white/90 text-black border-none rounded-full text-[8px]">{img.type.split('/')[1]}</Badge>
                    </div>
                  </div>
                ))}
                {detectedImages.length === 0 && (
                  <div className="col-span-full py-10 flex flex-col items-center justify-center text-slate-300 gap-4">
                    <HugeiconsIcon icon={Layers01Icon} size={48} strokeWidth={1} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">No static images found</span>
                  </div>
                )}
              </div>
            </div>

            {/* Component Tree View */}
            <div className="glass-card border-none p-10 rounded-[40px] space-y-8">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-lg uppercase tracking-widest text-slate-900 border-l-4 border-blue-600 pl-6">Structure</h3>
                <div className="flex items-center gap-2">
                  <Label htmlFor="skip-toggle" className="text-[10px] font-black text-slate-400 uppercase">Skip Core Styles</Label>
                  <input
                    id="skip-toggle"
                    type="checkbox"
                    className="rounded-full h-4 w-4 accent-blue-600"
                    checked={skipEstablishedStyles}
                    onChange={(e) => setSkipEstablishedStyles(e.target.checked)}
                  />
                </div>
              </div>

              <div className="grid gap-3 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                {componentTree?.components.map((c) => {
                  const safetyReport = componentSafetyReports.get(c.id)
                  return (
                    <div key={c.id} className="glass-card border-none rounded-[32px] p-6 hover:bg-white/80 transition-all border border-transparent hover:border-slate-100 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 font-black text-sm">
                            {c.type === "nav" ? "NAV" : c.type === "hero" ? "HERO" : "SEC"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{c.name}</div>
                            <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400">{c.classesUsed.length} classes detected</div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-full bg-slate-50 text-slate-900 font-bold hover:bg-blue-600 hover:text-white transition-all text-[10px] group-hover:px-6"
                          onClick={() => handleCopyComponent(c)}
                        >
                          COPY
                        </Button>
                      </div>
                      {safetyReport && (
                        <details className="mt-4 rounded-2xl border border-slate-100 bg-white/70 p-3 text-xs">
                          <summary className="cursor-pointer font-semibold text-slate-700">Safety Report</summary>
                          <div className="mt-3">
                            <SafetyReportPanel report={safetyReport} />
                          </div>
                        </details>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <aside className="space-y-8">
            {/* Fonts Checklist */}
            <div className="glass-card border-none p-10 rounded-[40px] space-y-6">
              <h3 className="font-black text-sm uppercase tracking-widest text-slate-900">Font Stack</h3>
              <div className="space-y-4">
                {detectedFonts.map((font, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">{font.name}</span>
                      <Badge className="bg-green-50 text-green-600 border-none rounded-full text-[8px] font-black">GOO</Badge>
                    </div>
                    <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                      <div className="h-full w-full bg-green-500" />
                    </div>
                  </div>
                ))}
                {detectedFonts.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No custom font families found.</p>
                )}
              </div>
            </div>

            {/* LLM Engine Data */}
            {llmSummary && (
              <div className="glass-card border-none p-10 rounded-[40px] space-y-6 bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-2xl shadow-purple-200/50">
                <div className="flex items-center gap-3 opacity-80">
                  <HugeiconsIcon icon={JavaScriptIcon} size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Optimizing Intelligence</span>
                </div>
                <div className="space-y-4">
                  <div className="text-3xl font-black tracking-tighter leading-none">
                    {llmSummary.htmlMutations} Adjustments
                  </div>
                  <p className="text-xs font-medium text-white/70 leading-relaxed uppercase tracking-wider italic">
                    &ldquo;AI parsed your architecture and mapped {llmSummary.renamedComponents} custom components with semantic accuracy.&rdquo;
                  </p>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-black tracking-[0.2em] opacity-80 uppercase">
                  <span>MODEL: {llmSummary.model?.split('/').pop() || "FP-GEN-V2"}</span>
                  <span>V:{llmSummary.mode.toUpperCase()}</span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              onClick={handleReset}
              className="w-full rounded-full border-2 border-slate-100 hover:bg-slate-50 font-black h-14 text-slate-400 uppercase tracking-widest text-[10px]"
            >
              Reset Engine
            </Button>
          </aside>
        </div>
      )}

      {step === "complete" && importResult && (
        <div className="animate-in fade-in zoom-in duration-1000 max-w-2xl mx-auto">
          <Card className="glass-card border-none p-12 rounded-[50px] text-center space-y-8 shadow-2xl shadow-blue-100">
            <div className="mx-auto h-24 w-24 rounded-[32px] bg-green-50 flex items-center justify-center text-green-500 shadow-lg shadow-green-100">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="premium-gradient-text text-4xl font-black uppercase tracking-tight">Injection Successful</h2>
              <p className="text-slate-500 font-medium">Your design has been fully converted and indexed.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50/50 p-6 rounded-[32px]">
                <div className="text-3xl font-black text-slate-900">{importResult.assetsCreated}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">New Assets</div>
              </div>
              <div className="bg-slate-50/50 p-6 rounded-[32px]">
                <div className="text-3xl font-black text-slate-900">{importResult.artifactsStored}</div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Artifacts</div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <Button asChild className="bg-black hover:bg-blue-600 text-white rounded-full h-16 font-black text-lg transition-all duration-500">
                <Link href="/assets">EXPLORE LIBRARY</Link>
              </Button>
              <Button variant="ghost" onClick={handleReset} className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                Import Another Project
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

