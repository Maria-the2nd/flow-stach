"use client"

import { useState, useCallback } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { extractCleanHtml, extractJsHooks, extractCssForSection, getClassesUsed } from "@/lib/html-parser"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { extractTokens, extractFontFamilies, extractGoogleFontsUrl, type TokenExtraction } from "@/lib/token-extractor"
import { parseCSS, type ClassIndex } from "@/lib/css-parser"
import { componentizeHtml, type ComponentTree, type Component } from "@/lib/componentizer"
import { buildCssTokenPayload, buildComponentPayload, validateForWebflowPaste } from "@/lib/webflow-converter"
import { copyToWebflowClipboard } from "@/lib/clipboard"
import { normalizeHtmlCssForWebflow } from "@/lib/webflow-normalizer"
import { literalizeCssForWebflow } from "@/lib/webflow-literalizer"
import { diagnoseVisibilityIssues } from "@/lib/webflow-verifier"
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

function TokensTab(props: {
  tokensCss: string
  tokensJson: string
  tokenWebflowJson: string | null
  onCopyTokens: () => Promise<void>
  warnings: string[]
  fontInfo?: { googleFonts?: string; families?: string[] }
}) {
  const { tokenWebflowJson, onCopyTokens, warnings, fontInfo } = props
  const [copied, setCopied] = useState(false)

  const handleCopyToWebflow = async () => {
    if (!tokenWebflowJson) {
      toast.error("No token payload available")
      return
    }
    await onCopyTokens()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyFontUrl = () => {
    if (fontInfo?.googleFonts) {
      navigator.clipboard.writeText(fontInfo.googleFonts)
      toast.success("Font URL copied")
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Fonts */}
      {fontInfo?.families && fontInfo.families.length > 0 && (
        <Card className="border-blue-500/50 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600 text-xl font-bold">
              <HugeiconsIcon icon={CodeIcon} size={24} />
              Step 1: Install Fonts
            </CardTitle>
            <CardDescription className="text-base font-semibold">
              Add these fonts to your Webflow project BEFORE pasting components.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-4">
              {fontInfo.families.map((font) => (
                <div key={font} className="flex flex-col">
                  <span className="text-3xl font-extrabold mb-1">
                    Please install {font} and wait
                  </span>
                </div>
              ))}
            </div>

            {fontInfo.googleFonts && (
              <div className="text-sm font-mono text-muted-foreground bg-muted/50 p-2 rounded break-all">
                {fontInfo.googleFonts}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
              <p className="font-bold text-blue-900 dark:text-blue-100 mb-2">Instructions:</p>
              <ol className="list-decimal list-inside space-y-2 text-blue-800/80 dark:text-blue-200/80">
                <li>Go to <strong>Site Settings → Fonts</strong> in Webflow</li>
                <li>Search and add each font listed above</li>
                <li><strong>Wait</strong> for the fonts to be ready in the Designer</li>
                <li>Proceed to Step 2 below</li>
              </ol>
            </div>

            {fontInfo.googleFonts && (
              <Button variant="outline" className="w-full text-blue-700" onClick={handleCopyFontUrl}>
                <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2" />
                Copy Font URL
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Tokens */}
      <Card className="border-2 border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <HugeiconsIcon icon={PaintBoardIcon} size={24} />
            Step 2: Copy Design Tokens
          </CardTitle>
          <CardDescription className="text-base">
            Paste this <strong>FIRST</strong> into Webflow. Delete the div you just created after pasting, then proceed with the components.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="lg" className="w-full text-lg h-14" onClick={handleCopyToWebflow} disabled={!tokenWebflowJson}>
            <HugeiconsIcon icon={copied ? CheckmarkCircle01Icon : Copy01Icon} size={24} className="mr-2" />
            {copied ? "Copied! Paste in Webflow" : "Copy Design Tokens to Webflow"}
          </Button>
          {!tokenWebflowJson && <p className="text-sm text-muted-foreground mt-2 text-center">Token payload will be generated after parsing HTML.</p>}
        </CardContent>
      </Card>


      {warnings.length > 0 && (
        <CollapsibleSection title={`Warnings (${warnings.length})`}>
          <ul className="text-sm text-muted-foreground space-y-1">
            {warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        </CollapsibleSection>
      )}
    </div>
  )
}

function CssTab({ stylesCss, classIndex }: { stylesCss: string; classIndex: ClassIndex }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(stylesCss)
    toast.success("CSS copied to clipboard")
  }
  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="styles.css"
        rightElement={
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCopy() }}>
            <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
            Copy
          </Button>
        }
      >
        <ArtifactViewer content={stylesCss} />
      </CollapsibleSection>

      <CollapsibleSection
        title={`Class Coverage (${Object.keys(classIndex.classes).length} classes)`}
      >
        <ArtifactViewer content={JSON.stringify(classIndex, null, 2)} maxHeight="300px" />
      </CollapsibleSection>
    </div>
  )
}

function HtmlTab(props: {
  cleanHtml: string
  componentTree: ComponentTree | null
  classIndex: ClassIndex
  establishedClasses: Set<string>
  tokensPasted: boolean
  skipEstablishedStyles: boolean
  onSkipEstablishedStylesChange: (v: boolean) => void
  onCopyComponent: (c: Component) => void
}) {
  const {
    cleanHtml,
    componentTree,
    establishedClasses,
    tokensPasted,
    skipEstablishedStyles,
    onSkipEstablishedStylesChange,
    onCopyComponent,
  } = props

  const orderedComponents = componentTree
    ? [...componentTree.components].sort((a, b) => a.order - b.order)
    : []
  const navComponent = orderedComponents.find((c) => c.type === "nav")
  const heroComponent = orderedComponents.find((c) => c.type === "hero")
  const fullPageComponent: Component = {
    id: "full-page-copy",
    name: "Full Page (Whole Site)",
    type: "wrapper",
    tagName: "div",
    primaryClass: "",
    htmlContent: `<div>\n${cleanHtml}\n</div>`,
    classesUsed: [],
    assetsUsed: [],
    jsHooks: [],
    children: [],
    order: -2,
  }
  const headerComboComponent: Component | null =
    navComponent && heroComponent
      ? {
        id: "header-combo",
        name: "Header (Nav + Hero)",
        type: "header",
        tagName: "div",
        primaryClass: "",
        htmlContent: `<div>\n${navComponent.htmlContent}\n${heroComponent.htmlContent}\n</div>`,
        classesUsed: [],
        assetsUsed: [],
        jsHooks: Array.from(new Set([...navComponent.jsHooks, ...heroComponent.jsHooks])),
        children: [],
        order: -1,
      }
      : null

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(cleanHtml)
    toast.success("HTML copied to clipboard")
  }

  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="clean.html"
        rightElement={
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCopyHtml() }}>
            <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
            Copy
          </Button>
        }
      >
        <ArtifactViewer content={cleanHtml} />
      </CollapsibleSection>

      {componentTree && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Components ({componentTree.components.length})</CardTitle>
            <CardDescription className="text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ These are for copying to Webflow. To save in this app, click &quot;Save to Database&quot; above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="skipEstablishedStyles">Skip established styles</Label>
              <input
                id="skipEstablishedStyles"
                type="checkbox"
                checked={skipEstablishedStyles}
                onChange={(e) => onSkipEstablishedStylesChange(e.target.checked)}
              />
              <span className="text-xs text-muted-foreground">
                {tokensPasted
                  ? "Tokens pasted. Skipping reduces '-2' duplicates."
                  : "Paste tokens first to enable skipping."}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium">{fullPageComponent.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">Includes styles. Paste in Webflow canvas.</div>
                <Button size="sm" variant="default" className="mt-3 w-full bg-blue-600 hover:bg-blue-700" onClick={() => onCopyComponent(fullPageComponent)}>
                  Copy to Webflow
                </Button>
              </div>
              {headerComboComponent && (
                <div className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{headerComboComponent.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {navComponent?.name} + {heroComponent?.name}
                  </div>
                  <Button size="sm" variant="default" className="mt-3 w-full bg-blue-600 hover:bg-blue-700" onClick={() => onCopyComponent(headerComboComponent)}>
                    Copy to Webflow
                  </Button>
                </div>
              )}
              {componentTree.components.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {c.classesUsed.slice(0, 6).join(" ")}
                  </div>
                  <Button size="sm" variant="default" className="mt-3 w-full bg-blue-600 hover:bg-blue-700" onClick={() => onCopyComponent(c)}>
                    Copy to Webflow
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <CollapsibleSection title={`Established Classes (${establishedClasses.size})`}>
        <ArtifactViewer content={Array.from(establishedClasses).join("\n")} maxHeight="300px" />
      </CollapsibleSection>
    </div>
  )
}

function JsTab({ scriptsJs }: { scriptsJs: string }) {
  const handleCopyJs = () => {
    if (!scriptsJs) return
    navigator.clipboard.writeText(scriptsJs)
    toast.success("JavaScript copied")
  }
  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="scripts.js"
        rightElement={
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCopyJs() }} disabled={!scriptsJs}>
            <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
            Copy
          </Button>
        }
      >
        <ArtifactViewer content={scriptsJs || "// No JavaScript found"} maxHeight="300px" />
      </CollapsibleSection>
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
  const [tokensPasted, setTokensPasted] = useState(false)
  const [skipEstablishedStyles, setSkipEstablishedStyles] = useState(true)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
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
    let tokens: TokenExtraction | null = null
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
      tokens = extractTokens(normalization.css, name)
      const fontUrl = extractGoogleFontsUrl(htmlInput)
      const fontFamilies = extractFontFamilies(normalization.css)
      // Always set fonts if families found, even without Google URL
      if (fontFamilies.length > 0) {
        tokens.fonts = { googleFonts: fontUrl || "", families: fontFamilies }
      }
      pendingArtifacts = {
        tokensJson: JSON.stringify(
          {
            name: tokens.name,
            namespace: tokens.namespace,
            variables: tokens.variables,
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
        scriptsJs: cleanResult.extractedScripts,
        jsHooks: extractJsHooks(normalization.html),
        cssVariables: cssResult.cssVariables,
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
      }
      setArtifacts(pendingArtifacts)
      setComponentTree(components)
      setTokenWebflowJson(JSON.stringify(tokenPayloadResult.webflowPayload))
      setEstablishedClasses(tokenPayloadResult.establishedClasses)
      setTokenExtraction(tokens)
      setValidationWarnings([
        ...warnings,
        ...tokenPayloadResult.warnings,
        ...normalization.warnings,
        ...literalization.warnings,
        ...visibilityWarnings,
      ])
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

  const handleCopyTokens = useCallback(async () => {
    if (!tokenWebflowJson) {
      toast.error("No token payload available")
      return
    }
    try {
      const payload = JSON.parse(tokenWebflowJson)
      const result = await copyToWebflowClipboard(payload)
      if (result.success) {
        setTokensPasted(true)
        toast.success("Token styles copied! Paste in Webflow Designer.")
      } else {
        toast.error("Failed to copy to clipboard")
      }
    } catch (error) {
      console.error("Copy error:", error)
      toast.error("Failed to copy token payload")
    }
  }, [tokenWebflowJson])

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
        const copyResult = await copyToWebflowClipboard(JSON.stringify(result.webflowPayload))
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
          scriptsJs: artifacts.scriptsJs || undefined,
          jsHooks: artifacts.jsHooks,
        },
        components: componentsToImport,
        tokenWebflowJson: tokenWebflowJson || undefined,
        sourceHtml: htmlInput.length < 500000 ? htmlInput : undefined,
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
  }, [artifacts, componentTree, tokenExtraction, projectName, projectSlug, tokenWebflowJson, htmlInput, establishedClasses, importProject])

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
    setTokensPasted(false)
    setSkipEstablishedStyles(false)
    setLlmSummary(null)
  }, [])

  if (!isUserLoaded) {
    return <div className="flex min-h-[200px] items-center justify-center">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Unsupported Content Warning Dialog */}
      <AlertDialog 
        open={unsupportedContentDialog.open} 
        onOpenChange={(open) => setUnsupportedContentDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <HugeiconsIcon icon={Alert01Icon} size={24} />
              Unsupported Content Removed
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4 pt-4">
              <div className="text-sm">
                This importer only works with <strong>pure HTML, CSS, and JavaScript</strong> pages.
              </div>
              
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 space-y-2">
                <div className="font-medium text-amber-700 dark:text-amber-400">We removed the following:</div>
                <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                  {unsupportedContentDialog.removedReferences.map((ref, i) => (
                    <li key={i} className="font-mono text-xs">{ref}</li>
                  ))}
                </ul>
              </div>
              
              <div className="text-sm space-y-2 text-muted-foreground">
                {unsupportedContentDialog.hasReact && (
                  <div>• <strong>React/JSX</strong> components are not supported. Export your React app to static HTML first.</div>
                )}
                {unsupportedContentDialog.hasTypescript && (
                  <div>• <strong>TypeScript (.tsx)</strong> files need to be compiled to JavaScript first.</div>
                )}
                {unsupportedContentDialog.hasTailwind && (
                  <div>• <strong>Tailwind CSS</strong> utility classes are not supported. Use compiled/purged CSS instead.</div>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground border-t pt-3">
                For best results, use single-page HTML exports with inline or linked CSS/JS.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              onClick={() => setUnsupportedContentDialog(prev => ({ ...prev, open: false }))}
            >
              Continue with Cleaned HTML
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Tools</span>
        <h2 className="mt-2 font-display text-xl uppercase tracking-tight text-foreground">
          Import HTML
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Extract components from AI-generated HTML and convert to Webflow-ready assets.
        </p>
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <HugeiconsIcon icon={Alert01Icon} size={14} />
          Supports single-page HTML with CSS &amp; JavaScript only. No React, TypeScript, or Tailwind.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className={cn("px-3 py-1 rounded-full", step === "input" ? "bg-primary text-primary-foreground" : "bg-muted")}>
          1. Input
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="text-muted-foreground" />
        <span className={cn("px-3 py-1 rounded-full", step === "artifacts" ? "bg-primary text-primary-foreground" : "bg-muted")}>
          2. Artifacts
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="text-muted-foreground" />
        <span className={cn("px-3 py-1 rounded-full", step === "complete" ? "bg-primary text-primary-foreground" : "bg-muted")}>
          3. Complete
        </span>
      </div>

      {step === "input" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paste HTML</CardTitle>
              <CardDescription>
                Paste the full HTML file from any AI tool. 
                <span className="block mt-1 text-amber-600 dark:text-amber-400">
                  Supports pure HTML/CSS/JS only — no React, TypeScript (.tsx/.jsx), or Tailwind.
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Flow Party Landing"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="projectSlug">Slug (optional)</Label>
                  <Input
                    id="projectSlug"
                    value={projectSlug}
                    onChange={(e) => setProjectSlug(e.target.value)}
                    placeholder="auto-generated"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="lg" onClick={handleParse} disabled={!htmlInput.trim() || processingStatus !== "idle"}>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="mr-2" />
                  Parse HTML & Extract Artifacts
                </Button>
              </div>

              {processingStatus !== "idle" && <ProcessingTimeline status={processingStatus} />}

              <CollapsibleSection
                title="HTML Content"
                defaultOpen={!htmlInput}
                rightElement={
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="fileUpload"
                      className="flex items-center gap-2 px-3 py-1.5 text-xs border rounded-lg cursor-pointer hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <HugeiconsIcon icon={Upload04Icon} size={14} />
                      Upload .html
                    </Label>
                    <input id="fileUpload" type="file" accept=".html,.htm" className="hidden" onChange={handleFileUpload} />
                    {htmlInput && (
                      <span className="text-xs text-muted-foreground">{htmlInput.length.toLocaleString()} chars</span>
                    )}
                  </div>
                }
              >
                <div className="space-y-2 pt-2">
                  <Textarea
                    id="htmlInput"
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    placeholder="<html>...</html>"
                    className="font-mono text-sm min-h-[300px]"
                  />
                </div>
              </CollapsibleSection>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "artifacts" && artifacts && (
        <div className="space-y-6">
          <div className="flex gap-4 sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
            <Button className="flex-1" onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Importing...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} className="mr-2" />
                  Save to Database (+ Full Page)
                </>
              )}
            </Button>
          </div>

          {llmSummary && (
            <CollapsibleSection
              title={
                <div className="flex items-center gap-2">
                  <HugeiconsIcon icon={Layers01Icon} size={16} />
                  LLM Summary
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">Mode</div>
                  <div className="font-medium">{llmSummary.mode.toUpperCase()}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Model</div>
                  <div className="font-medium">{llmSummary.model || "n/a"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Remaining var()</div>
                  <div className="font-medium">{llmSummary.remainingCssVarCount}</div>
                </div>
                <div className="sm:col-span-3">
                  <div className="text-xs text-muted-foreground">Reason</div>
                  <div className="font-medium">{llmSummary.reason || "n/a"}</div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          <Tabs defaultValue="tokens" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="tokens" className="flex items-center gap-2">
                <HugeiconsIcon icon={PaintBoardIcon} size={14} />
                Tokens
              </TabsTrigger>
              <TabsTrigger value="css" className="flex items-center gap-2">
                <HugeiconsIcon icon={CodeIcon} size={14} />
                CSS
              </TabsTrigger>
              <TabsTrigger value="html" className="flex items-center gap-2">
                <HugeiconsIcon icon={FileEditIcon} size={14} />
                HTML
              </TabsTrigger>
              <TabsTrigger value="js" className="flex items-center gap-2">
                <HugeiconsIcon icon={JavaScriptIcon} size={14} />
                JS
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tokens" className="mt-6">
              <TokensTab
                tokensCss={artifacts.tokensCss}
                tokensJson={artifacts.tokensJson}
                tokenWebflowJson={tokenWebflowJson}
                onCopyTokens={handleCopyTokens}
                warnings={validationWarnings}
                fontInfo={tokenExtraction?.fonts}
              />
            </TabsContent>

            <TabsContent value="css" className="mt-6">
              <CssTab stylesCss={artifacts.stylesCss} classIndex={artifacts.classIndex} />
            </TabsContent>

            <TabsContent value="html" className="mt-6">
              <HtmlTab
                cleanHtml={artifacts.cleanHtml}
                componentTree={componentTree}
                classIndex={artifacts.classIndex}
                establishedClasses={establishedClasses}
                tokensPasted={tokensPasted}
                skipEstablishedStyles={skipEstablishedStyles}
                onSkipEstablishedStylesChange={setSkipEstablishedStyles}
                onCopyComponent={handleCopyComponent}
              />
            </TabsContent>

            <TabsContent value="js" className="mt-6">
              <JsTab scriptsJs={artifacts.scriptsJs} />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {step === "complete" && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={24} />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{importResult.assetsCreated}</div>
                <div className="text-sm text-muted-foreground">Assets Created</div>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{importResult.assetsUpdated}</div>
                <div className="text-sm text-muted-foreground">Assets Updated</div>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold">{importResult.artifactsStored}</div>
                <div className="text-sm text-muted-foreground">Artifacts Stored</div>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <div className="text-2xl font-bold text-amber-600">{importResult.errors.length}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/50">
                <div className="font-medium text-amber-600 mb-2">Errors:</div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {importResult.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <Button variant="outline" onClick={handleReset}>
                Import Another
              </Button>
              <Button asChild className="flex-1">
                <Link href="/assets">View Assets</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

