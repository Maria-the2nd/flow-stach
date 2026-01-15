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
  Copy01Icon,
  Layers01Icon,
  JavaScriptIcon,
  FileEditIcon,
} from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Import parsers
import { extractCleanHtml, getClassesUsed, extractJsHooks, extractCssForSection } from "@/lib/html-parser"
import { extractTokens, extractFontFamilies, extractGoogleFontsUrl, type TokenExtraction } from "@/lib/token-extractor"
import { parseCSS, type ClassIndex } from "@/lib/css-parser"
import { componentizeHtml, type ComponentTree, type Component } from "@/lib/componentizer"
import { buildCssTokenPayload, buildComponentPayload, validateForWebflowPaste } from "@/lib/webflow-converter"
import { copyToWebflowClipboard } from "@/lib/clipboard"
import { normalizeHtmlCssForWebflow } from "@/lib/webflow-normalizer"
import { literalizeCssForWebflow } from "@/lib/webflow-literalizer"
import {
  applySemanticPatchResponse,
  buildSemanticPatchRequest,
  type FlowbridgeSemanticPatchResponse,
  type FlowbridgeSemanticPatchMeta,
  applyDeterministicComponentNames,
} from "@/lib/flowbridge-semantic"

// ============================================
// TYPES
// ============================================

type Step = "input" | "artifacts" | "components" | "complete"

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

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function getAdminEmails(): string[] {
  const envValue = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""
  return envValue
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function buildCardGridWarnings(componentTree: ComponentTree, html: string): string[] {
  const warnings: string[] = []
  const allClasses = getClassesUsed(html)
  const cardClasses = allClasses.filter((name) => name.toLowerCase().includes("card"))
  if (cardClasses.length === 0) return warnings

  componentTree.components.forEach((component) => {
    const classText = component.classesUsed.join(" ").toLowerCase()
    const nameText = component.name.toLowerCase()
    const isCardGrid =
      classText.includes("card-grid") ||
      classText.includes("pricing-grid") ||
      classText.includes("bento-grid") ||
      classText.includes("features-grid") ||
      nameText.includes("pricing") ||
      nameText.includes("bento") ||
      nameText.includes("features")
    if (!isCardGrid) return
    const expectedCards = cardClasses.filter((name) => !name.toLowerCase().includes("grid"))
    const missingCards = expectedCards.filter((name) => !component.classesUsed.includes(name))
    if (missingCards.length > 0) {
      warnings.push(
        `Card grid "${component.name}" missing card children: ${missingCards.slice(0, 5).join(", ")}`
      )
    }
  })

  return warnings
}

function applyVisibilityDefaults(html: string, css: string): { html: string; warnings: string[] } {
  const warnings: string[] = []
  const hiddenRegex = /\.([a-zA-Z0-9_-]+)\s*\{[^}]*opacity\s*:\s*0[^}]*\}/g
  const visibleRegex = /\.([a-zA-Z0-9_-]+)\.visible\s*\{[^}]*opacity\s*:\s*1[^}]*\}/g

  const hiddenClasses = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = hiddenRegex.exec(css)) !== null) {
    hiddenClasses.add(match[1])
  }

  const visibleClasses = new Set<string>()
  while ((match = visibleRegex.exec(css)) !== null) {
    visibleClasses.add(match[1])
  }

  const targets = Array.from(hiddenClasses).filter((name) => visibleClasses.has(name))
  if (targets.length === 0) return { html, warnings }

  let updatedHtml = html
  for (const target of targets) {
    const classRegex = new RegExp(`class="([^"]*\\b${target}\\b[^"]*)"`, "gi")
    let count = 0
    updatedHtml = updatedHtml.replace(classRegex, (full, classValue) => {
      if (/\bvisible\b/i.test(classValue)) return full
      count += 1
      return `class="${classValue} visible"`
    })
    if (count > 0) {
      warnings.push(`Visibility override: added "visible" to ${count} ".${target}" elements.`)
    }
  }

  return { html: updatedHtml, warnings }
}

// ============================================
// TAB COMPONENTS
// ============================================

interface ArtifactViewerProps {
  content: string
  maxHeight?: string
}

function ArtifactViewer({ content, maxHeight = "400px" }: ArtifactViewerProps) {
  return (
    <div className="relative">
      <pre
        className={cn(
          "bg-muted rounded-lg p-4 text-sm overflow-auto font-mono",
          "border border-border"
        )}
        style={{ maxHeight }}
      >
        <code>{content}</code>
      </pre>
    </div>
  )
}

// ============================================
// TOKENS TAB
// ============================================

interface TokensTabProps {
  tokensCss: string
  tokensJson: string
  tokenWebflowJson: string | null
  onCopyTokens: () => Promise<void>
  warnings: string[]
  fontInfo?: { googleFonts?: string; families?: string[] }
}

function TokensTab({ tokensCss, tokensJson, tokenWebflowJson, onCopyTokens, warnings, fontInfo }: TokensTabProps) {
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

  const handleCopyJson = () => {
    navigator.clipboard.writeText(tokensJson)
    toast.success("JSON copied to clipboard")
  }

  const handleCopyCss = () => {
    navigator.clipboard.writeText(tokensCss)
    toast.success("CSS copied to clipboard")
  }

  const handleCopyFontUrl = () => {
    if (fontInfo?.googleFonts) {
      navigator.clipboard.writeText(fontInfo.googleFonts)
      toast.success("Google Fonts URL copied")
    }
  }

  return (
    <div className="space-y-6">
      {/* Google Fonts Info */}
      {fontInfo && fontInfo.families && fontInfo.families.length > 0 && (
        <Card className="border-blue-500/50 border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center gap-2 text-blue-600 font-bold">
              <HugeiconsIcon icon={CodeIcon} size={24} />
              Step 1: Install Google Fonts
            </CardTitle>
            <CardDescription className="text-base font-semibold text-blue-800 dark:text-blue-300">
              Please install these fonts in your Webflow project and WAIT for them to load.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                {fontInfo.families.map((font) => (
                  <div key={font} className="flex flex-col">
                    <span className="text-3xl font-extrabold text-foreground mb-1">
                      Please install {font} and wait
                    </span>
                    <span className="text-sm font-mono text-muted-foreground break-all bg-muted/50 p-2 rounded">
                      {fontInfo.googleFonts || "No Google Fonts URL specified in this payload"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="font-bold text-blue-900 dark:text-blue-100 mb-2 underline">How to add fonts in Webflow Designer:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900/80 dark:text-blue-200/80">
                  <li>Go to <strong>Site Settings → Fonts</strong></li>
                  <li>In the <strong>Google Fonts</strong> section, search for each font listed above</li>
                  <li>Add them to your project and <strong>save changes</strong></li>
                  <li><strong>Wait</strong> a few seconds for the fonts to propagate to the Designer</li>
                  <li>Once installed, proceed to Step 2 below</li>
                </ol>
              </div>

              {fontInfo.googleFonts && (
                <Button variant="outline" className="w-full text-blue-700 border-blue-300 hover:bg-blue-50" onClick={handleCopyFontUrl}>
                  <HugeiconsIcon icon={Copy01Icon} size={16} className="mr-2" />
                  Copy Google Fonts URL
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main action - Step 2 */}
      <Card className="border-2 border-primary/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <HugeiconsIcon icon={PaintBoardIcon} size={24} />
            Step 2: Copy Design Tokens
          </CardTitle>
          <CardDescription className="text-base">
            Paste this <strong>FIRST</strong> into Webflow. Delete the div you just created after pasting, then proceed with individual components.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="w-full text-lg h-14"
            onClick={handleCopyToWebflow}
            disabled={!tokenWebflowJson}
          >
            <HugeiconsIcon icon={copied ? CheckmarkCircle01Icon : Copy01Icon} size={24} className="mr-2" />
            {copied ? "Copied! Paste in Webflow" : "Copy Design Tokens"}
          </Button>
          {!tokenWebflowJson && (
            <p className="text-sm text-muted-foreground mt-2 text-center">
              Token payload will be generated after parsing HTML.
            </p>
          )}
        </CardContent>
      </Card>


      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <HugeiconsIcon icon={Alert01Icon} size={16} />
              Warnings ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              {warnings.slice(0, 5).map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
              {warnings.length > 5 && (
                <li className="text-muted-foreground">...and {warnings.length - 5} more</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* CSS Variables Preview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">tokens.css</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopyCss}>
              <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ArtifactViewer content={tokensCss || "/* No :root tokens found */"} maxHeight="200px" />
        </CardContent>
      </Card>

      {/* JSON Preview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">tokens.json</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopyJson}>
              <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ArtifactViewer content={tokensJson} maxHeight="200px" />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// CSS TAB
// ============================================

interface CssTabProps {
  stylesCss: string
  classIndex: ClassIndex
}

function CssTab({ stylesCss, classIndex }: CssTabProps) {
  const classNames = Object.keys(classIndex.classes)
  const styledClasses = classNames.filter(
    (name) => classIndex.classes[name].baseStyles || classIndex.classes[name].hoverStyles
  )

  const handleCopyCss = () => {
    navigator.clipboard.writeText(stylesCss)
    toast.success("CSS copied to clipboard")
  }

  const handleCopyClassIndex = () => {
    navigator.clipboard.writeText(JSON.stringify(classIndex, null, 2))
    toast.success("Class index copied to clipboard")
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Class Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{classNames.length}</div>
              <div className="text-xs text-muted-foreground">Total Classes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{styledClasses.length}</div>
              <div className="text-xs text-muted-foreground">With Styles</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{classIndex.warnings.length}</div>
              <div className="text-xs text-muted-foreground">Warnings</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {classIndex.warnings.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <HugeiconsIcon icon={Alert01Icon} size={16} />
              CSS Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
              {classIndex.warnings.map((w, i) => (
                <li key={i}>• {w.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* CSS Preview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">styles.css</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopyCss}>
              <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ArtifactViewer content={stylesCss} maxHeight="300px" />
        </CardContent>
      </Card>

      {/* Class List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">classIndex.json ({classNames.length} classes)</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopyClassIndex}>
              <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {classNames.map((name) => (
              <span
                key={name}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-mono",
                  styledClasses.includes(name)
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                .{name}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// HTML TAB
// ============================================

interface HtmlTabProps {
  cleanHtml: string
  componentTree: ComponentTree | null
  establishedClasses: Set<string>
  tokensPasted: boolean
  skipEstablishedStyles: boolean
  onSkipEstablishedStylesChange: (skip: boolean) => void
  onCopyComponent: (component: Component) => Promise<void>
}

function HtmlTab({
  cleanHtml,
  componentTree,
  establishedClasses,
  tokensPasted,
  skipEstablishedStyles,
  onSkipEstablishedStylesChange,
  onCopyComponent
}: HtmlTabProps) {
  const orderedComponents = componentTree
    ? [...componentTree.components].sort((a, b) => a.order - b.order)
    : []
  const navComponent = orderedComponents.find((c) => c.type === "nav")
  const heroComponent = orderedComponents.find((c) => c.type === "hero")
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

  const handleCopyCleanHtml = () => {
    navigator.clipboard.writeText(cleanHtml)
    toast.success("Clean HTML copied to clipboard")
  }

  return (
    <div className="space-y-6">
      {/* Component List */}
      {componentTree && componentTree.components.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HugeiconsIcon icon={Layers01Icon} size={16} />
              Components ({componentTree.components.length})
            </CardTitle>
            <CardDescription>
              Copy components to paste in Webflow Designer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Style handling option */}
            {establishedClasses.size > 0 && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipEstablishedStyles}
                    onChange={(e) => onSkipEstablishedStylesChange(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <div className="font-medium text-sm">Skip established styles</div>
                    <div className="text-xs text-muted-foreground">
                      {tokensPasted ? (
                        <span className="text-green-600">
                          Tokens were pasted. Enable this to avoid &quot;-2&quot; class duplicates.
                        </span>
                      ) : (
                        <span>
                          Enable only if you already pasted the token payload. Otherwise keep unchecked.
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {establishedClasses.size} classes can be skipped
                    </div>
                  </div>
                </label>
              </div>
            )}
            <div className="space-y-2">
              {headerComboComponent && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{headerComboComponent.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {navComponent?.name} + {heroComponent?.name}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(headerComboComponent.htmlContent)
                        toast.success(`${headerComboComponent.name} HTML copied`)
                      }}
                    >
                      <HugeiconsIcon icon={CodeIcon} size={14} className="mr-1" />
                      HTML
                    </Button>
                    <Button size="sm" onClick={() => onCopyComponent(headerComboComponent)}>
                      <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                      Webflow
                    </Button>
                  </div>
                </div>
              )}
              {componentTree.components.map((component) => (
                <div
                  key={component.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">{component.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {component.type} • {component.classesUsed.length} classes • {component.jsHooks.length} JS hooks
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(component.htmlContent)
                        toast.success(`${component.name} HTML copied`)
                      }}
                    >
                      <HugeiconsIcon icon={CodeIcon} size={14} className="mr-1" />
                      HTML
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => onCopyComponent(component)}
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
                      Webflow
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {componentTree && componentTree.warnings.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
              <HugeiconsIcon icon={Alert01Icon} size={16} />
              Componentization Warnings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground space-y-1">
              {componentTree.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Clean HTML Preview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">clean.html</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopyCleanHtml}>
              <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
              Copy
            </Button>
          </div>
          <CardDescription>
            HTML with inline styles, style tags, and script tags removed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ArtifactViewer content={cleanHtml} maxHeight="300px" />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// JS TAB
// ============================================

interface JsTabProps {
  scriptsJs: string
  jsHooks: string[]
  componentTree: ComponentTree | null
}

function JsTab({ scriptsJs, jsHooks, componentTree }: JsTabProps) {
  const handleCopyJs = () => {
    navigator.clipboard.writeText(scriptsJs)
    toast.success("JavaScript copied to clipboard")
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Card className="border-blue-500/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-blue-600">
            <HugeiconsIcon icon={JavaScriptIcon} size={16} />
            JavaScript Handoff
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>JavaScript must be added manually to Webflow:</p>
          <ol className="list-decimal list-inside mt-2 space-y-1">
            <li>Copy the JS code below</li>
            <li>In Webflow, go to Project Settings → Custom Code</li>
            <li>Paste into &quot;Before &lt;/body&gt; tag&quot; section</li>
            <li>Alternatively, use an HTML Embed element</li>
          </ol>
        </CardContent>
      </Card>

      {/* JS Hooks */}
      {jsHooks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">JS Hooks ({jsHooks.length})</CardTitle>
            <CardDescription>
              Elements referenced by JavaScript (IDs, data attributes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {jsHooks.map((hook) => (
                <span
                  key={hook}
                  className="px-2 py-0.5 rounded text-xs font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                >
                  {hook}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-component JS hooks */}
      {componentTree && componentTree.components.some((c) => c.jsHooks.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">JS Hooks by Component</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {componentTree.components
                .filter((c) => c.jsHooks.length > 0)
                .map((component) => (
                  <div key={component.id} className="p-2 rounded bg-muted/50">
                    <div className="font-medium text-sm">{component.name}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {component.jsHooks.map((hook) => (
                        <span
                          key={hook}
                          className="px-1.5 py-0.5 rounded text-xs font-mono bg-blue-100/50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                        >
                          {hook}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scripts Preview */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">scripts.js</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCopyJs} disabled={!scriptsJs}>
              <HugeiconsIcon icon={Copy01Icon} size={14} className="mr-1" />
              Copy
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ArtifactViewer
            content={scriptsJs || "// No JavaScript found"}
            maxHeight="300px"
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

function ImportWizard() {
  const { isLoaded: isUserLoaded, user } = useUser()
  const importProject = useMutation(api.import.importProject)

  // Step state
  const [step, setStep] = useState<Step>("input")

  // Input state
  const [htmlInput, setHtmlInput] = useState("")
  const [projectName, setProjectName] = useState("")
  const [projectSlug, setProjectSlug] = useState("")

  // Extracted artifacts
  const [artifacts, setArtifacts] = useState<ExtractedArtifacts | null>(null)
  const [componentTree, setComponentTree] = useState<ComponentTree | null>(null)
  const [tokenWebflowJson, setTokenWebflowJson] = useState<string | null>(null)
  const [establishedClasses, setEstablishedClasses] = useState<Set<string>>(new Set())
  const [tokenExtraction, setTokenExtraction] = useState<TokenExtraction | null>(null)

  // Import state
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Style handling options
  const [tokensPasted, setTokensPasted] = useState(false)
  const [skipEstablishedStyles, setSkipEstablishedStyles] = useState(false)

  // Validation warnings
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [llmSummary, setLlmSummary] = useState<LlmSummary | null>(null)

  // Parse HTML and extract artifacts
  const handleParse = useCallback(async () => {
    if (!htmlInput.trim()) {
      toast.error("Please paste HTML content")
      return
    }

    try {
      setLlmSummary(null)
      // 1. Extract clean HTML and artifacts
      const cleanResult = extractCleanHtml(htmlInput)

      // 1.5 Normalize HTML + CSS for Webflow conversion
      const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles)
      const visibilityDefaults = applyVisibilityDefaults(normalization.html, normalization.css)
      let normalizedHtml = visibilityDefaults.html

      // 2. Parse CSS for semantic request + diagnostics
      const cssResult = parseCSS(normalization.css)

      // 3. Extract tokens
      const name = projectName || "Imported Design"
      const tokens = extractTokens(normalization.css, name)
      const fontUrl = extractGoogleFontsUrl(htmlInput)
      const fontFamilies = extractFontFamilies(normalization.css)
      if (fontUrl && fontFamilies.length > 0) {
        tokens.fonts = { googleFonts: fontUrl, families: fontFamilies }
      }

      // 4. Componentize clean HTML
      let components = componentizeHtml(normalizedHtml)
      const namingResult = applyDeterministicComponentNames(components)
      components = namingResult.componentTree
      const initialFooterPresent =
        /<footer\b/i.test(normalizedHtml) ||
        /\bclass="[^"]*footer[^"]*"/i.test(normalizedHtml) ||
        /\bid="footer"/i.test(normalizedHtml)
      const initialUnexpectedFooters = initialFooterPresent
        ? []
        : components.components.filter((component) => component.name.toLowerCase().startsWith("footer"))
      const cardWarningsPre = buildCardGridWarnings(components, normalizedHtml)
      const hasUnresolvedVars = cssResult.classIndex.warnings.some(
        (warning) => warning.type === "variable_unresolved"
      )
      const forceLlm = process.env.NEXT_PUBLIC_FLOWBRIDGE_FORCE_LLM === "1"
      const shouldInvokeLlm =
        forceLlm || hasUnresolvedVars || initialUnexpectedFooters.length > 0 || cardWarningsPre.length > 0

      // 4.5 Optional semantic repair pass (LLM)
      let semanticWarnings: string[] = []
      let finalCss = normalization.css
      let llmMeta: FlowbridgeSemanticPatchMeta | null = null
      const patchCounts = { renamedComponents: 0, htmlMutations: 0, cssMutations: 0 }
      if (shouldInvokeLlm) {
        try {
          const semanticContext = buildSemanticPatchRequest(
            normalizedHtml,
            components,
            cssResult.classIndex,
            cssResult.cssVariables
          )

          const response = await fetch("/api/flowbridge/semantic", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request: semanticContext.request,
              model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL,
            }),
          })

          if (!response.ok) {
            console.warn("LLM_UNAVAILABLE", { status: response.status })
            llmMeta = { mode: "fallback", reason: `http_${response.status}` }
          } else {
            const data = (await response.json()) as {
              ok: boolean
              response?: FlowbridgeSemanticPatchResponse
              meta?: FlowbridgeSemanticPatchMeta
              reason?: string
            }

            llmMeta = data.meta ?? null

            if (data.ok && data.response) {
              const applyResult = applySemanticPatchResponse({
                componentTree: components,
                patch: data.response,
              })
              components = applyResult.componentTree
              normalizedHtml = applyResult.patchedHtml
              semanticWarnings = applyResult.warnings
              patchCounts.renamedComponents = applyResult.applied.renames
              patchCounts.htmlMutations = applyResult.applied.htmlPatches
              patchCounts.cssMutations = data.response.cssPatches.length
              const cssPatch = data.response.cssPatches[data.response.cssPatches.length - 1]
              if (cssPatch?.op === "replaceFinalCss") {
                finalCss = cssPatch.css
              }
              if (data.response.notes.length > 0) {
                semanticWarnings.push(...data.response.notes.map((note) => `LLM: ${note}`))
              }
              console.info("LLM_PATCH_APPLIED", patchCounts)
            } else {
              console.warn("LLM_UNAVAILABLE", { reason: data.reason })
            }
          }
        } catch (error) {
          console.warn("LLM_UNAVAILABLE", { error: String(error) })
          llmMeta = { mode: "fallback", reason: "llm_error" }
        }
      } else {
        llmMeta = { mode: "fallback", reason: "no_semantic_issues" }
      }

      const footerPresent =
        /<footer\b/i.test(normalizedHtml) ||
        /\bclass="[^"]*footer[^"]*"/i.test(normalizedHtml) ||
        /\bid="footer"/i.test(normalizedHtml)
      if (!footerPresent) {
        const unexpectedFooters = components.components.filter((component) =>
          component.name.toLowerCase().startsWith("footer")
        )
        if (unexpectedFooters.length > 0) {
          semanticWarnings.push("Unexpected extracted section (Footer) removed: no footer in input HTML.")
          const removedIds = new Set(unexpectedFooters.map((component) => component.id))
          components.components = components.components.filter((component) => !removedIds.has(component.id))
          components.rootOrder = components.rootOrder.filter((id) => !removedIds.has(id))
        }
      }

      const cardWarnings = buildCardGridWarnings(components, normalizedHtml)
      if (cardWarnings.length > 0) {
        semanticWarnings.push(...cardWarnings)
      }

      // 5. Literalize CSS for Webflow paste
      const literalization = literalizeCssForWebflow(finalCss, {
        strict: process.env.NEXT_PUBLIC_FLOWBRIDGE_STRICT_LLM === "1",
      })

      // 6. Re-parse CSS using literalized values
      const finalCssResult = parseCSS(literalization.css)

      // 7. Build token Webflow payload from literal CSS
      const tokenPayloadResult = buildCssTokenPayload(literalization.css, {
        namespace: tokens.namespace,
        includePreview: true,
      })

      // 8. Validate for Webflow paste
      const warnings = validateForWebflowPaste(finalCssResult.classIndex, components.components)

      // Store results
      setArtifacts({
        tokensJson: JSON.stringify(
          {
            name: tokens.name,
            namespace: tokens.namespace,
            variables: tokens.variables,
            fonts: tokens.fonts,
          },
          null,
          2
        ),
        tokensCss: cssResult.tokensCss,
        stylesCss: literalization.css,
        classIndex: finalCssResult.classIndex,
        cleanHtml: normalizedHtml,
        scriptsJs: cleanResult.extractedScripts,
        jsHooks: extractJsHooks(normalizedHtml),
        cssVariables: finalCssResult.cssVariables,
      })
      setComponentTree(components)
      setTokenWebflowJson(JSON.stringify(tokenPayloadResult.webflowPayload))
      setEstablishedClasses(tokenPayloadResult.establishedClasses)
      setTokenExtraction(tokens)
      setValidationWarnings([
        ...warnings,
        ...tokenPayloadResult.warnings,
        ...normalization.warnings,
        ...visibilityDefaults.warnings,
        ...namingResult.warnings,
        ...semanticWarnings,
        ...literalization.warnings,
      ])
      setLlmSummary({
        mode: llmMeta?.mode ?? "fallback",
        model: llmMeta?.model,
        latencyMs: llmMeta?.latencyMs,
        inputTokens: llmMeta?.inputTokens,
        outputTokens: llmMeta?.outputTokens,
        renamedComponents: patchCounts.renamedComponents,
        htmlMutations: patchCounts.htmlMutations,
        cssMutations: patchCounts.cssMutations,
        remainingCssVarCount: literalization.remainingVarCount,
        reason: llmMeta?.reason ?? (llmMeta ? undefined : "llm_unavailable"),
      })

      // Update project name/slug if not set
      if (!projectName) {
        setProjectName(tokens.name)
      }
      if (!projectSlug) {
        setProjectSlug(tokens.slug)
      }

      setStep("artifacts")
      toast.success(
        `Extracted ${components.components.length} components, ${Object.keys(finalCssResult.classIndex.classes).length} classes`
      )
    } catch (error) {
      console.error("Parse error:", error)
      toast.error("Failed to parse HTML. Check console for details.")
    }
  }, [htmlInput, projectName, projectSlug])

  // Copy token payload to Webflow clipboard
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
        toast.success("Token styles copied! Paste in Webflow Designer, then you can skip styles on component paste.")
      } else {
        toast.error("Failed to copy to clipboard")
      }
    } catch (error) {
      console.error("Copy error:", error)
      toast.error("Failed to copy token payload")
    }
  }, [tokenWebflowJson])

  // Copy component to Webflow clipboard
  const handleCopyComponent = useCallback(
    async (component: Component) => {
      if (!artifacts) {
        toast.error("No artifacts available")
        return
      }

      try {
        const result = buildComponentPayload(
          component,
          artifacts.classIndex,
          establishedClasses,
          { skipEstablishedStyles }
        )

        if (result.warnings.length > 0) {
          toast.warning(`${component.name}: ${result.warnings[0]}`)
        }

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

  // Import to database
  const handleImport = useCallback(async () => {
    if (!artifacts || !componentTree || !tokenExtraction) {
      toast.error("Please parse HTML first")
      return
    }

    setIsImporting(true)

    try {
      const slug = projectSlug || generateSlug(projectName || "imported")

      const componentsToImport = componentTree.components.map((component) => {
        const payloadResult = buildComponentPayload(
          component,
          artifacts.classIndex,
          establishedClasses
        )

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
          category: component.type === "nav" || component.type === "footer" ? "navigation" : component.type === "hero" ? "hero" : "sections",
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
        sourceHtml: htmlInput.length < 500000 ? htmlInput : undefined, // Don't store huge files
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

  // File upload handler
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
      setProjectName(name.charAt(0).toUpperCase() + name.slice(1))

      toast.success("File loaded")
    }
    reader.onerror = () => {
      toast.error("Failed to read file")
    }
    reader.readAsText(file)
  }, [])

  // Reset wizard
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

  // Admin check
  if (!isUserLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const adminEmails = getAdminEmails()
  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
  const isAdmin = userEmail && adminEmails.includes(userEmail)

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Alert01Icon} size={20} className="text-amber-500" />
              Admin Access Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This page is restricted to administrators only.
            </p>
            <Button asChild className="mt-4 w-full">
              <Link href="/assets">Back to Assets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Import HTML</h1>
        <p className="text-muted-foreground mt-1">
          Extract components from AI-generated HTML and convert to Webflow-ready assets.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <span
          className={cn(
            "px-3 py-1 rounded-full",
            step === "input" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          1. Input
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="text-muted-foreground" />
        <span
          className={cn(
            "px-3 py-1 rounded-full",
            step === "artifacts" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          2. Artifacts
        </span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} className="text-muted-foreground" />
        <span
          className={cn(
            "px-3 py-1 rounded-full",
            step === "complete" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          3. Complete
        </span>
      </div>

      {/* INPUT STEP */}
      {step === "input" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Paste HTML</CardTitle>
              <CardDescription>
                Paste the full HTML file from Claude, ChatGPT, or any AI tool.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="projectName">Project Name</Label>
                  <Input
                    id="projectName"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., Flow Party Landing"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="projectSlug">Slug (optional)</Label>
                  <Input
                    id="projectSlug"
                    value={projectSlug}
                    onChange={(e) => setProjectSlug(e.target.value)}
                    placeholder="auto-generated"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="htmlInput">HTML Content</Label>
                <Textarea
                  id="htmlInput"
                  value={htmlInput}
                  onChange={(e) => setHtmlInput(e.target.value)}
                  placeholder="<html>...</html>"
                  className="font-mono text-sm min-h-[300px]"
                />
              </div>

              <div className="flex items-center gap-4">
                <Label
                  htmlFor="fileUpload"
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-muted"
                >
                  <HugeiconsIcon icon={Upload04Icon} size={16} />
                  Upload .html file
                </Label>
                <input
                  id="fileUpload"
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {htmlInput && (
                  <span className="text-sm text-muted-foreground">
                    {htmlInput.length.toLocaleString()} characters
                  </span>
                )}
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleParse}
                disabled={!htmlInput.trim()}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={20} className="mr-2" />
                Parse HTML & Extract Artifacts
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ARTIFACTS STEP */}
      {step === "artifacts" && artifacts && (
        <div className="space-y-6">
          {llmSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HugeiconsIcon icon={Layers01Icon} size={16} />
                  LLM Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
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
                    <div className="text-xs text-muted-foreground">Latency</div>
                    <div className="font-medium">
                      {typeof llmSummary.latencyMs === "number" ? `${llmSummary.latencyMs}ms` : "n/a"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Tokens In/Out</div>
                    <div className="font-medium">
                      {llmSummary.inputTokens ?? "n/a"} / {llmSummary.outputTokens ?? "n/a"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Patch Counts</div>
                    <div className="font-medium">
                      {llmSummary.renamedComponents} / {llmSummary.htmlMutations} / {llmSummary.cssMutations}
                    </div>
                    <div className="text-[11px] text-muted-foreground">rename / html / css</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Remaining var()</div>
                    <div className="font-medium">{llmSummary.remainingCssVarCount}</div>
                  </div>
                </div>
                {llmSummary.reason && (
                  <p className="text-xs text-muted-foreground mt-3">Reason: {llmSummary.reason}</p>
                )}
              </CardContent>
            </Card>
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
                establishedClasses={establishedClasses}
                tokensPasted={tokensPasted}
                skipEstablishedStyles={skipEstablishedStyles}
                onSkipEstablishedStylesChange={setSkipEstablishedStyles}
                onCopyComponent={handleCopyComponent}
              />
            </TabsContent>

            <TabsContent value="js" className="mt-6">
              <JsTab
                scriptsJs={artifacts.scriptsJs}
                jsHooks={artifacts.jsHooks}
                componentTree={componentTree}
              />
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex gap-4">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
            <Button
              className="flex-1"
              onClick={handleImport}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Importing...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={20} className="mr-2" />
                  Save to Database ({componentTree?.components.length || 0} components)
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* COMPLETE STEP */}
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
                <div className="text-2xl font-bold text-amber-600">
                  {importResult.errors.length}
                </div>
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
