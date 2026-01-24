/**
 * InsertPanel - UI for clipboard-free Webflow insertion
 *
 * Provides a textarea for users to paste XscpData JSON, validates it,
 * and triggers insertion into the Webflow canvas using the Designer Extension API.
 */

import { useState, useCallback, useEffect } from 'react'
import { parseXscpJson, insertXscpData, type InsertionResult } from '../lib/webflow-inserter'
import type { XscpData } from '../lib/types/xscp-data'

// ============================================
// TYPES
// ============================================

interface ValidationState {
  status: 'idle' | 'valid' | 'invalid'
  errors: string[]
  nodeCount?: number
  styleCount?: number
}

interface InsertState {
  status: 'idle' | 'inserting' | 'success' | 'error'
  result?: InsertionResult
}

// Webflow Designer API (will be available in extension context)
declare const webflow: {
  getSelectedElement(): Promise<unknown>
  getRootElement(): Promise<unknown>
  elementBuilder(preset: unknown): unknown
  elementPresets: Record<string, unknown>
  getStyleByName(name: string): Promise<unknown>
  createStyle(name: string): Promise<unknown>
  notify(options: { type: 'Info' | 'Success' | 'Error'; message: string }): void
}

// ============================================
// COMPONENT
// ============================================

export function InsertPanel() {
  const [jsonInput, setJsonInput] = useState('')
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle', errors: [] })
  const [insertState, setInsertState] = useState<InsertState>({ status: 'idle' })
  const [parsedData, setParsedData] = useState<XscpData | null>(null)

  // Validate JSON when input changes
  const validateInput = useCallback((input: string) => {
    if (!input.trim()) {
      setValidation({ status: 'idle', errors: [] })
      setParsedData(null)
      return
    }

    const { data, errors } = parseXscpJson(input)

    if (errors.length > 0 || !data) {
      setValidation({ status: 'invalid', errors })
      setParsedData(null)
    } else {
      setValidation({
        status: 'valid',
        errors: [],
        nodeCount: data.payload.nodes.length,
        styleCount: data.payload.styles.length,
      })
      setParsedData(data)
    }
  }, [])

  // Debounce validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validateInput(jsonInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [jsonInput, validateInput])

  // Handle insert
  const handleInsert = useCallback(async () => {
    if (!parsedData || validation.status !== 'valid') {
      return
    }

    setInsertState({ status: 'inserting' })

    try {
      // Check if webflow API is available
      if (typeof webflow === 'undefined') {
        setInsertState({
          status: 'error',
          result: {
            success: false,
            insertedCount: 0,
            stylesCreated: 0,
            errors: ['Webflow Designer API not available. Make sure this extension is running inside Webflow Designer.'],
            warnings: [],
          },
        })
        return
      }

      const result = await insertXscpData(webflow as never, parsedData)

      setInsertState({
        status: result.success ? 'success' : 'error',
        result,
      })

      // Clear input on success
      if (result.success) {
        setJsonInput('')
        setParsedData(null)
        setValidation({ status: 'idle', errors: [] })
      }
    } catch (e) {
      setInsertState({
        status: 'error',
        result: {
          success: false,
          insertedCount: 0,
          stylesCreated: 0,
          errors: [`Unexpected error: ${(e as Error).message}`],
          warnings: [],
        },
      })
    }
  }, [parsedData, validation.status])

  // Handle paste from clipboard
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setJsonInput(text)
    } catch (e) {
      // Clipboard read failed, user needs to paste manually
      console.warn('Could not read clipboard:', e)
    }
  }, [])

  // Clear input
  const handleClear = useCallback(() => {
    setJsonInput('')
    setParsedData(null)
    setValidation({ status: 'idle', errors: [] })
    setInsertState({ status: 'idle' })
  }, [])

  return (
    <div className="insert-panel">
      <div className="insert-header">
        <h3>Insert Webflow JSON</h3>
        <p className="insert-desc">
          Paste your Webflow JSON payload below to insert elements directly into the canvas.
        </p>
      </div>

      <div className="insert-actions-top">
        <button
          className="btn btn-secondary btn-sm"
          onClick={handlePaste}
          title="Paste from clipboard"
        >
          📋 Paste
        </button>
        {jsonInput && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleClear}
            title="Clear input"
          >
            ✕ Clear
          </button>
        )}
      </div>

      <div className="insert-input-container">
        <textarea
          className={`insert-textarea ${validation.status === 'invalid' ? 'invalid' : ''} ${validation.status === 'valid' ? 'valid' : ''}`}
          placeholder='Paste @webflow/XscpData JSON here...'
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Validation Status */}
      {validation.status === 'invalid' && (
        <div className="insert-validation error">
          <strong>Invalid JSON:</strong>
          <ul>
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.status === 'valid' && (
        <div className="insert-validation success">
          <strong>Valid payload:</strong>
          <span>{validation.nodeCount} nodes, {validation.styleCount} styles</span>
        </div>
      )}

      {/* Insert Result */}
      {insertState.status === 'success' && insertState.result && (
        <div className="insert-result success">
          <strong>Inserted successfully!</strong>
          <p>
            {insertState.result.insertedCount} element(s), {insertState.result.stylesCreated} style(s)
          </p>
          {insertState.result.warnings.length > 0 && (
            <details>
              <summary>{insertState.result.warnings.length} warning(s)</summary>
              <ul>
                {insertState.result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {insertState.status === 'error' && insertState.result && (
        <div className="insert-result error">
          <strong>Insertion failed:</strong>
          <ul>
            {insertState.result.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
          {insertState.result.warnings.length > 0 && (
            <details>
              <summary>{insertState.result.warnings.length} warning(s)</summary>
              <ul>
                {insertState.result.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Insert Button */}
      <div className="insert-actions">
        <button
          className="btn btn-primary"
          onClick={handleInsert}
          disabled={validation.status !== 'valid' || insertState.status === 'inserting'}
        >
          {insertState.status === 'inserting' ? (
            <>
              <span className="spinner-sm" /> Inserting...
            </>
          ) : (
            '🚀 Insert into Canvas'
          )}
        </button>
      </div>

      <div className="insert-help">
        <details>
          <summary>How to use</summary>
          <ol>
            <li>Copy Webflow JSON from Flow Stach or your code</li>
            <li>Paste it in the textarea above</li>
            <li>Select an element in the Webflow canvas (optional)</li>
            <li>Click &ldquo;Insert into Canvas&rdquo;</li>
          </ol>
          <p>
            <strong>Note:</strong> Elements will be inserted as children of the selected element,
            or at the root if nothing is selected.
          </p>
        </details>
      </div>

      <style>{`
        .insert-panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .insert-header h3 {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 600;
        }

        .insert-desc {
          margin: 0;
          font-size: 12px;
          color: #666;
        }

        .insert-actions-top {
          display: flex;
          gap: 8px;
        }

        .insert-input-container {
          position: relative;
        }

        .insert-textarea {
          width: 100%;
          min-height: 150px;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-family: monospace;
          font-size: 11px;
          resize: vertical;
          background: #fafafa;
          transition: border-color 0.2s;
        }

        .insert-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          background: #fff;
        }

        .insert-textarea.invalid {
          border-color: #ef4444;
          background: #fef2f2;
        }

        .insert-textarea.valid {
          border-color: #22c55e;
          background: #f0fdf4;
        }

        .insert-validation {
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
        }

        .insert-validation.error {
          background: #fef2f2;
          color: #dc2626;
        }

        .insert-validation.success {
          background: #f0fdf4;
          color: #16a34a;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .insert-validation ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .insert-result {
          padding: 12px;
          border-radius: 6px;
          font-size: 12px;
        }

        .insert-result.success {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .insert-result.error {
          background: #fef2f2;
          border: 1px solid #fecaca;
        }

        .insert-result strong {
          display: block;
          margin-bottom: 4px;
        }

        .insert-result p {
          margin: 0;
        }

        .insert-result ul {
          margin: 8px 0 0 0;
          padding-left: 20px;
        }

        .insert-result details {
          margin-top: 8px;
        }

        .insert-result summary {
          cursor: pointer;
          color: #666;
        }

        .insert-actions {
          margin-top: 8px;
        }

        .insert-actions .btn {
          width: 100%;
        }

        .insert-help {
          margin-top: 8px;
          font-size: 12px;
        }

        .insert-help summary {
          cursor: pointer;
          color: #666;
        }

        .insert-help ol {
          margin: 8px 0;
          padding-left: 20px;
        }

        .insert-help li {
          margin: 4px 0;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #334155;
        }

        .btn-secondary:hover {
          background: #e2e8f0;
        }

        .btn-sm {
          padding: 4px 10px;
          font-size: 12px;
        }

        .spinner-sm {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
