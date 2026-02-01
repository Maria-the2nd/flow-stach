'use client'

import { useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  FolderOpen,
  UploadCloud,
} from 'lucide-react'

import { api } from '@/convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

import {
  parseWebflowExport,
  type WebflowExportFile,
  type WebflowExportResult,
} from '@/lib/webflow-export-parser'
import { processProjectImport, type ProcessingStage } from '@/lib/project-engine'

export interface WebflowTemplateImportHandle {
  handleImport: () => Promise<void>
  isImporting: boolean
}

/**
 * Clean CSS for processing through the project engine.
 * Removes @font-face rules with relative paths (../fonts/...) since
 * the font detector will find fonts from CSS properties instead.
 */
function cleanCssForProcessing(css: string): string {
  // Remove @font-face blocks that reference local/relative files
  return css.replace(/@font-face\s*\{[^}]*url\(['"]?\.\.\/fonts\/[^}]*\}/gi, '')
}

/**
 * Build a single HTML document from parsed Webflow export.
 * This creates the same format expected by processProjectImport.
 */
function buildHtmlFromWebflowExport(parsed: WebflowExportResult): string {
  // Filter out jQuery (Webflow includes it by default)
  const cssLinks = parsed.libraryImports.styles
    .filter(url => !url.toLowerCase().includes('jquery'))
    .map(url => `<link rel="stylesheet" href="${url}">`)
    .join('\n')

  const jsLinks = parsed.libraryImports.scripts
    .filter(url => !url.toLowerCase().includes('jquery'))
    .map(url => `<script src="${url}"></script>`)
    .join('\n')

  // Clean CSS: remove @font-face with relative paths
  const cleanedCss = cleanCssForProcessing(parsed.projectCss)

  return `<!DOCTYPE html>
<html>
<head>
${cssLinks}
<style>${cleanedCss}</style>
</head>
<body>
${parsed.html}
${jsLinks}
${parsed.inlineScripts.map(s => `<script>${s}</script>`).join('\n')}
</body>
</html>`
}

export const WebflowTemplateImport = forwardRef<WebflowTemplateImportHandle>(function WebflowTemplateImport(_, ref) {
  const [templateName, setTemplateName] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<WebflowExportFile[] | null>(null)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStageLabel, setCurrentStageLabel] = useState('INITIALIZING')
  const [isDone, setIsDone] = useState(false)
  const [importedTemplateName, setImportedTemplateName] = useState('')
  const [newProjectId, setNewProjectId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use the same mutation as HTML Bundle import
  const importMutation = useMutation(api.import.importProject)

  const handleFolderSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    const files: WebflowExportFile[] = []
    let detectedFolderName = ''

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const path = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name

      // Get folder name from first file's path
      if (!detectedFolderName && path.includes('/')) {
        detectedFolderName = path.split('/')[0].replace('.webflow', '').replace(/[-_]/g, ' ')
      }

      if (file.name.endsWith('.html') || file.name.endsWith('.css') || file.name.endsWith('.js')) {
        try {
          const content = await file.text()
          files.push({ path, content })
        } catch {
          console.warn(`Failed to read file: ${path}`)
        }
      }
    }

    if (files.length > 0) {
      setSelectedFolder(files)
      setFolderName(detectedFolderName || 'Template')
      if (!templateName && detectedFolderName) {
        setTemplateName(detectedFolderName)
      }
      toast.success(`Loaded ${files.length} files`)
    } else {
      toast.error('No valid files found in the selected folder')
    }
  }, [templateName])

  const handleImport = useCallback(async () => {
    if (!templateName.trim()) {
      toast.error('Please enter a template name')
      return
    }

    if (!selectedFolder || selectedFolder.length === 0) {
      toast.error('Please select a folder to import')
      return
    }

    setIsImporting(true)
    setProgress(5)
    setCurrentStageLabel('PARSING')

    try {
      // Step 1: Parse the Webflow export folder
      setProgress(10)
      setCurrentStageLabel('PARSING FOLDER')
      const parsed = parseWebflowExport(selectedFolder)

      // Log warnings from parsing
      if (parsed.warnings.length > 0) {
        parsed.warnings.forEach(w => console.warn('[WebflowTemplateImport]', w))
      }

      // Step 2: Convert to single HTML document
      setProgress(15)
      setCurrentStageLabel('BUILDING HTML')
      const finalHtml = buildHtmlFromWebflowExport(parsed)

      // Step 3: Process through the same engine as HTML Bundle import
      // This handles font detection, image extraction, CSS processing, etc.
      const result = await processProjectImport(
        finalHtml,
        templateName.trim(),
        (stage: ProcessingStage, prog: number) => {
          setProgress(15 + prog * 0.7) // Scale to 15-85%
          setCurrentStageLabel(stage.toUpperCase())
        }
      )

      // Step 4: Store via same mutation as HTML Bundle
      setProgress(90)
      setCurrentStageLabel('SAVING')

      const importResponse = await importMutation({
        projectName: result.projectName,
        projectSlug: result.projectSlug,
        artifacts: result.artifacts,
        components: result.components,
        tokenWebflowJson: result.tokenWebflowJson,
        sourceHtml: finalHtml,
        fonts: result.fonts,
        images: result.images.map(img => ({
          ...img,
          sizeWarning: img.sizeWarning || false,
          blocked: img.blocked || false,
          classification: img.classification || 'absolute',
        })),
      })

      setProgress(100)
      setCurrentStageLabel('COMPLETE')
      setImportedTemplateName(templateName.trim())
      setNewProjectId(importResponse.projectId)
      setIsDone(true)
      toast.success('Template imported successfully!')
    } catch (error) {
      console.error('Import error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to import template')
      setIsImporting(false)
    }
  }, [templateName, selectedFolder, importMutation])

  // Expose handleImport to parent via ref
  useImperativeHandle(ref, () => ({
    handleImport,
    isImporting,
  }), [handleImport, isImporting])

  // Success screen - matches HTML Bundle success exactly
  if (isDone && newProjectId) {
    return (
      <div className="max-w-6xl mx-auto py-24 px-6 text-center space-y-8">
        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-in zoom-in duration-500 border border-emerald-500/20">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground mb-2">Import Successful</h1>
          <p className="text-muted-foreground font-medium">Your template &ldquo;{importedTemplateName}&rdquo; is ready and converted.</p>
        </div>
        <Link href={`/workspace/projects/${newProjectId}`}>
          <Button className="bg-primary text-primary-foreground hover:opacity-90 shadow-xl shadow-primary/20 premium-hover px-12 h-14 rounded-2xl font-black text-lg btn-premium">
            View Project <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      {/* Progress Overlay */}
      {isImporting && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
          <div className="w-full max-w-sm space-y-8">
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-foreground">Importing Template...</h3>
              <p className="text-muted-foreground text-sm">Processing Webflow export through conversion pipeline.</p>
            </div>
            <div className="space-y-2">
              <Progress value={progress} className="h-3 bg-accent [&>div]:bg-primary rounded-full shadow-inner" />
              <div className="flex justify-between text-xs font-bold text-primary tracking-wider">
                <span>{Math.round(progress)}% COMPLETE</span>
                <span>{currentStageLabel}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Name Field */}
      <div className="space-y-3 max-w-xl">
        <Label htmlFor="templateName" className="text-foreground font-bold ml-1">Template Name</Label>
        <Input
          id="templateName"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          placeholder="e.g. Portfolio Template, SaaS Landing Page"
          className="h-14 rounded-2xl border-border focus:ring-primary focus:border-primary font-bold bg-slate-500/5 backdrop-blur-sm shadow-inner px-6 text-lg"
        />
        <p className="text-[10px] text-muted-foreground font-medium ml-1">Give it a name that describes the template.</p>
      </div>

      {/* Folder Upload */}
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          /* @ts-expect-error webkitdirectory is non-standard but widely supported */
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFolderSelect}
          className="hidden"
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            // Note: drag & drop for folders has limited browser support
            fileInputRef.current?.click()
          }}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[40px] p-24 text-center group hover:bg-white/[0.02] transition-all cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-white/10 bg-slate-500/5 ring-1 ring-white/5 shadow-inner'}`}
        >
          <div className={`w-32 h-32 rounded-[40px] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-2xl ${selectedFolder ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10' : 'bg-primary/10 text-primary shadow-primary/10'}`}>
            {selectedFolder ? <CheckCircle2 className="w-16 h-16" /> : <FolderOpen className="w-16 h-16" />}
          </div>
          <h4 className="text-3xl font-black text-foreground mb-3 tracking-tight">
            {selectedFolder ? folderName : 'Upload Webflow Export'}
          </h4>
          <p className="text-muted-foreground font-medium text-lg max-w-[400px] leading-relaxed">
            {selectedFolder
              ? `${selectedFolder.length} files loaded`
              : 'Select the exported .webflow folder from your computer'}
          </p>
          {!selectedFolder && (
            <Button variant="outline" size="sm" className="mt-6 rounded-xl">
              <UploadCloud className="w-4 h-4 mr-2" />
              Browse Folders
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
