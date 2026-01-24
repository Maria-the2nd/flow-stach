'use client'

import { useState, useCallback } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CodeIcon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Copy01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  FileAddIcon,
  Delete01Icon,
  DownloadCircle01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import {
  parseReactComponent,
  getAllMissingFiles,
  type ParsedComponent,
} from '@/lib/jsx-parser'
import {
  convertReactToWebflow,
  generateHtmlDocument,
  type ConversionResult,
} from '@/lib/jsx-to-html'

// ============================================
// TYPES
// ============================================

type Step = 'paste' | 'dependencies' | 'convert' | 'result'

interface ProvidedFile {
  path: string
  content: string
  type: 'component' | 'css' | 'other'
}

// ============================================
// COMPONENTS
// ============================================

function StepIndicator({ currentStep }: { currentStep: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'paste', label: 'Paste Code' },
    { key: 'dependencies', label: 'Add Files' },
    { key: 'convert', label: 'Convert' },
    { key: 'result', label: 'Result' },
  ]

  const currentIndex = steps.findIndex(s => s.key === currentStep)

  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step.key} className="flex items-center">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
              index < currentIndex && 'bg-green-500/20 text-green-400',
              index === currentIndex && 'bg-blue-500/20 text-blue-400',
              index > currentIndex && 'bg-neutral-800 text-neutral-500'
            )}
          >
            <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/20 text-xs">
              {index + 1}
            </span>
            {step.label}
          </div>
          {index < steps.length - 1 && (
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              size={16}
              className="mx-2 text-neutral-600"
            />
          )}
        </div>
      ))}
    </div>
  )
}

function WarningList({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null

  return (
    <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
      <div className="flex items-center gap-2 text-yellow-400 mb-2">
        <HugeiconsIcon icon={Alert01Icon} size={16} />
        <span className="text-sm font-medium">Warnings</span>
      </div>
      <ul className="text-sm text-yellow-300/80 space-y-1">
        {warnings.map((warning, i) => (
          <li key={i}>• {warning}</li>
        ))}
      </ul>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function ImportReactPage() {
  // State
  const [step, setStep] = useState<Step>('paste')
  const [mainCode, setMainCode] = useState('')
  const [mainFileName, setMainFileName] = useState('Component.jsx')
  const [parsedMain, setParsedMain] = useState<ParsedComponent | null>(null)
  const [providedFiles, setProvidedFiles] = useState<ProvidedFile[]>([])
  const [currentFileInput, setCurrentFileInput] = useState('')
  const [currentFilePath, setCurrentFilePath] = useState('')
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Get missing files that haven't been provided yet
  const getMissingFiles = useCallback(() => {
    if (!parsedMain) return []
    const all = getAllMissingFiles(parsedMain)
    const providedPaths = new Set(providedFiles.map(f => f.path))
    return all.filter(f => !providedPaths.has(f.path))
  }, [parsedMain, providedFiles])

  // Parse the main component
  const handleParse = () => {
    if (!mainCode.trim()) return

    const parsed = parseReactComponent(mainCode, mainFileName)
    setParsedMain(parsed)

    const missing = getAllMissingFiles(parsed)
    if (missing.length > 0) {
      setStep('dependencies')
    } else {
      // No dependencies, go straight to convert
      performConversion(parsed, [])
    }
  }

  // Add a dependency file
  const handleAddFile = () => {
    if (!currentFileInput.trim() || !currentFilePath.trim()) return

    const fileType = currentFilePath.endsWith('.css') || currentFilePath.endsWith('.scss')
      ? 'css'
      : currentFilePath.endsWith('.jsx') || currentFilePath.endsWith('.tsx')
        ? 'component'
        : 'other'

    setProvidedFiles(prev => [
      ...prev,
      { path: currentFilePath, content: currentFileInput, type: fileType }
    ])
    setCurrentFileInput('')
    setCurrentFilePath('')
  }

  // Remove a provided file
  const handleRemoveFile = (path: string) => {
    setProvidedFiles(prev => prev.filter(f => f.path !== path))
  }

  // Perform the conversion
  const performConversion = (parsed: ParsedComponent, files: ProvidedFile[]) => {
    // Build maps for the converter
    const componentDeps = new Map<string, ParsedComponent>()
    const cssFiles: string[] = []

    for (const file of files) {
      if (file.type === 'css') {
        cssFiles.push(file.content)
      } else if (file.type === 'component') {
        const depParsed = parseReactComponent(file.content, file.path)
        componentDeps.set(depParsed.name, depParsed)
      }
    }

    const result = convertReactToWebflow(parsed, componentDeps, cssFiles)
    setConversionResult(result)
    setStep('result')
  }

  // Handle convert button
  const handleConvert = () => {
    if (!parsedMain) return
    performConversion(parsedMain, providedFiles)
  }

  // Copy to clipboard
  const handleCopy = async (content: string, type: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Download as file
  const handleDownload = () => {
    if (!conversionResult || !parsedMain) return

    const doc = generateHtmlDocument(conversionResult, parsedMain.name)
    const blob = new Blob([doc], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${parsedMain.name.toLowerCase()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Reset everything
  const handleReset = () => {
    setStep('paste')
    setMainCode('')
    setMainFileName('Component.jsx')
    setParsedMain(null)
    setProvidedFiles([])
    setCurrentFileInput('')
    setCurrentFilePath('')
    setConversionResult(null)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Import React Component</h1>
        <p className="text-neutral-400 mb-6">
          Paste your React component code and convert it to plain HTML + CSS + JavaScript
        </p>

        <StepIndicator currentStep={step} />

        {/* Step 1: Paste Code */}
        {step === 'paste' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-neutral-400 mb-2">
                File name (optional)
              </label>
              <input
                type="text"
                value={mainFileName}
                onChange={e => setMainFileName(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
                placeholder="Component.jsx"
              />
            </div>

            <div>
              <label className="block text-sm text-neutral-400 mb-2">
                Paste your React component code
              </label>
              <textarea
                value={mainCode}
                onChange={e => setMainCode(e.target.value)}
                className="w-full h-96 bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 font-mono text-sm resize-none"
                placeholder={`import React from 'react'
import './styles.css'
import { Button } from './Button'

export default function Hero() {
  return (
    <section className="hero">
      <h1>Welcome</h1>
      <Button>Get Started</Button>
    </section>
  )
}`}
              />
            </div>

            <button
              onClick={handleParse}
              disabled={!mainCode.trim()}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                mainCode.trim()
                  ? 'bg-blue-600 hover:bg-blue-500'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              )}
            >
              <HugeiconsIcon icon={CodeIcon} size={16} />
              Parse Component
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </button>
          </div>
        )}

        {/* Step 2: Add Dependencies */}
        {step === 'dependencies' && parsedMain && (
          <div className="space-y-6">
            {/* Parsed info */}
            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
              <h3 className="font-medium mb-2">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="inline mr-2 text-green-400" />
                Parsed: {parsedMain.name}
              </h3>
              <div className="text-sm text-neutral-400 space-y-1">
                <p>Imports detected: {parsedMain.imports.length}</p>
                <p>React patterns: {parsedMain.reactPatterns.map(p => p.type).join(', ') || 'None'}</p>
              </div>
              <WarningList warnings={parsedMain.warnings} />
            </div>

            {/* Missing files */}
            {getMissingFiles().length > 0 && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <h3 className="font-medium text-orange-400 mb-3">
                  <HugeiconsIcon icon={Alert01Icon} size={16} className="inline mr-2" />
                  Missing Files ({getMissingFiles().length})
                </h3>
                <ul className="text-sm space-y-2">
                  {getMissingFiles().map((file, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-neutral-800 rounded text-xs">
                        {file.type}
                      </span>
                      <code className="text-orange-300">{file.path}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Provided files */}
            {providedFiles.length > 0 && (
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <h3 className="font-medium text-green-400 mb-3">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} className="inline mr-2" />
                  Provided Files ({providedFiles.length})
                </h3>
                <ul className="text-sm space-y-2">
                  {providedFiles.map((file, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-neutral-800 rounded text-xs">
                          {file.type}
                        </span>
                        <code className="text-green-300">{file.path}</code>
                      </div>
                      <button
                        onClick={() => handleRemoveFile(file.path)}
                        className="p-1 hover:bg-neutral-800 rounded"
                      >
                        <HugeiconsIcon icon={Delete01Icon} size={14} className="text-red-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Add file form */}
            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
              <h3 className="font-medium mb-3">
                <HugeiconsIcon icon={FileAddIcon} size={16} className="inline mr-2" />
                Add a file
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">
                    File path (e.g., ./Button.jsx or ./styles.css)
                  </label>
                  <input
                    type="text"
                    value={currentFilePath}
                    onChange={e => setCurrentFilePath(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm"
                    placeholder="./Button.jsx"
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-1">
                    File content
                  </label>
                  <textarea
                    value={currentFileInput}
                    onChange={e => setCurrentFileInput(e.target.value)}
                    className="w-full h-48 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 font-mono text-sm resize-none"
                    placeholder="Paste the file content here..."
                  />
                </div>

                <button
                  onClick={handleAddFile}
                  disabled={!currentFilePath.trim() || !currentFileInput.trim()}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 rounded text-sm',
                    currentFilePath.trim() && currentFileInput.trim()
                      ? 'bg-green-600 hover:bg-green-500'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  )}
                >
                  <HugeiconsIcon icon={FileAddIcon} size={14} />
                  Add File
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep('paste')}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                Back
              </button>

              <button
                onClick={handleConvert}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium"
              >
                Convert to HTML
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3/4: Result */}
        {step === 'result' && conversionResult && (
          <div className="space-y-6">
            <WarningList warnings={conversionResult.warnings} />

            {/* HTML Output */}
            <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">HTML</h3>
                <button
                  onClick={() => handleCopy(conversionResult.html, 'html')}
                  className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-sm"
                >
                  <HugeiconsIcon
                    icon={copied === 'html' ? CheckmarkCircle01Icon : Copy01Icon}
                    size={14}
                    className={copied === 'html' ? 'text-green-400' : ''}
                  />
                  {copied === 'html' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="bg-neutral-950 p-3 rounded text-sm overflow-x-auto max-h-64 overflow-y-auto">
                <code>{conversionResult.html || '(No HTML output)'}</code>
              </pre>
            </div>

            {/* CSS Output */}
            {conversionResult.css && (
              <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">CSS</h3>
                  <button
                    onClick={() => handleCopy(conversionResult.css, 'css')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-sm"
                  >
                    <HugeiconsIcon
                      icon={copied === 'css' ? CheckmarkCircle01Icon : Copy01Icon}
                      size={14}
                      className={copied === 'css' ? 'text-green-400' : ''}
                    />
                    {copied === 'css' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-neutral-950 p-3 rounded text-sm overflow-x-auto max-h-64 overflow-y-auto">
                  <code>{conversionResult.css}</code>
                </pre>
              </div>
            )}

            {/* JavaScript Output */}
            {conversionResult.javascript && (
              <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-800">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">JavaScript</h3>
                  <button
                    onClick={() => handleCopy(conversionResult.javascript, 'js')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-sm"
                  >
                    <HugeiconsIcon
                      icon={copied === 'js' ? CheckmarkCircle01Icon : Copy01Icon}
                      size={14}
                      className={copied === 'js' ? 'text-green-400' : ''}
                    />
                    {copied === 'js' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-neutral-950 p-3 rounded text-sm overflow-x-auto max-h-64 overflow-y-auto">
                  <code>{conversionResult.javascript}</code>
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                Start Over
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-medium"
              >
                <HugeiconsIcon icon={DownloadCircle01Icon} size={16} />
                Download HTML File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
