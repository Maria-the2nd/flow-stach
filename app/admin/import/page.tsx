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
import { parseFullHtml, buildCodePayload, type DetectedSection } from "@/lib/html-parser"
import { extractTokens, generateTokenManifest, tokenManifestToJson } from "@/lib/token-extractor"

type Step = "input" | "preview" | "complete"

interface ImportResult {
  assetsCreated: number
  assetsUpdated: number
  payloadsCreated: number
  payloadsUpdated: number
  errors: string[]
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
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseFullHtml> | null>(null)
  const [tokenExtraction, setTokenExtraction] = useState<ReturnType<typeof extractTokens> | null>(null)
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Parse HTML
  const handleParse = useCallback(() => {
    if (!htmlInput.trim()) {
      toast.error("Please paste HTML content")
      return
    }

    try {
      const result = parseFullHtml(htmlInput)

      if (result.sections.length === 0) {
        toast.error("No sections detected. Make sure HTML contains <section>, <nav>, or <footer> tags.")
        return
      }

      // Extract tokens
      const name = designSystemName || result.title || "Imported Design"
      const tokens = extractTokens(result.fullCss, name)

      setParseResult(result)
      setTokenExtraction(tokens)
      setDesignSystemName(name)

      // Select all sections by default
      setSelectedSections(new Set(result.sections.map((s) => s.id)))

      setStep("preview")
      const colorCount = tokens.variables.filter((v) => v.type === "color").length
      const fontCount = tokens.variables.filter((v) => v.type === "fontFamily").length
      toast.success(`Detected ${result.sections.length} sections, ${colorCount} colors, ${fontCount} fonts`)
    } catch (error) {
      console.error("Parse error:", error)
      toast.error("Failed to parse HTML. Check console for details.")
    }
  }, [htmlInput, designSystemName])

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
      const slug = tokenExtraction.slug
      const manifest = generateTokenManifest(tokenExtraction)

      const sectionsToImport = parseResult.sections
        .filter((s) => selectedSections.has(s.id))
        .map((section) => ({
          id: section.id,
          name: section.name,
          slug: `${slug}-${section.id}`,
          category: "sections",
          tags: [slug, section.id, ...section.cssSelectors.slice(0, 3)],
          codePayload: buildCodePayload(section),
        }))

      const result = await importSections({
        designSystemName: tokenExtraction.name,
        designSystemSlug: slug,
        sections: sectionsToImport,
        tokenManifest: tokenManifestToJson(manifest),
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
  }, [parseResult, tokenExtraction, selectedSections, importSections])

  // Reset wizard
  const handleReset = useCallback(() => {
    setStep("input")
    setHtmlInput("")
    setDesignSystemName("")
    setParseResult(null)
    setTokenExtraction(null)
    setSelectedSections(new Set())
    setImportResult(null)
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

              <Button onClick={handleParse} className="w-full" disabled={!htmlInput.trim()}>
                Parse HTML
                <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
              </Button>
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
