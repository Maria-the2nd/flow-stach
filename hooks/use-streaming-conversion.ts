/**
 * React hook for streaming Webflow conversion with progress
 *
 * Provides:
 * - Real-time progress updates
 * - Section-by-section results
 * - Cancellation support
 * - Accumulated warnings/errors
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  convertHtmlToWebflowStreaming,
  type ConversionProgress,
  type ConversionChunk,
  type SectionResult,
  type StreamingConversionOptions,
  type StreamingConversionResult,
  type WebflowPayload,
} from '@/lib/webflow-converter-streaming';
import { ValidationSeverity, type ValidationIssue } from '@/lib/validation-types';

// ============================================
// TYPES
// ============================================

export interface UseStreamingConversionOptions extends Omit<StreamingConversionOptions, 'signal' | 'onProgress'> {
  /** Called when a section completes (alternative to polling sections array) */
  onSectionComplete?: (section: SectionResult) => void;
  /** Called when conversion completes successfully */
  onComplete?: (result: StreamingConversionResult) => void;
  /** Called when conversion errors */
  onError?: (error: Error) => void;
}

export interface UseStreamingConversionReturn {
  /**
   * Start conversion with the given HTML/CSS/JS
   * Returns the final result, or null if cancelled
   */
  convert: (html: string, css: string, js?: string) => Promise<StreamingConversionResult | null>;

  /**
   * Cancel an in-progress conversion
   */
  cancel: () => void;

  /**
   * Reset state to initial values
   */
  reset: () => void;

  // Progress state
  /** Current progress, null when not converting */
  progress: ConversionProgress | null;

  /** Completed sections so far */
  sections: SectionResult[];

  /** Accumulated warnings */
  warnings: ValidationIssue[];

  /** Accumulated errors */
  errors: ValidationIssue[];

  // Status flags
  /** Whether conversion is currently in progress */
  isConverting: boolean;

  /** Whether conversion was cancelled */
  isCancelled: boolean;

  /** Whether conversion completed successfully */
  isComplete: boolean;

  /** Final result (available after completion) */
  result: StreamingConversionResult | null;

  /** Final Webflow payload (convenience shorthand for result.payload) */
  payload: WebflowPayload | null;

  /** Total processing time in ms (available after completion) */
  totalTimeMs: number | null;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useStreamingConversion(
  options: UseStreamingConversionOptions = {}
): UseStreamingConversionReturn {
  const { onSectionComplete, onComplete, onError, ...streamOptions } = options;

  // State
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [sections, setSections] = useState<SectionResult[]>([]);
  const [warnings, setWarnings] = useState<ValidationIssue[]>([]);
  const [errors, setErrors] = useState<ValidationIssue[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<StreamingConversionResult | null>(null);
  const [totalTimeMs, setTotalTimeMs] = useState<number | null>(null);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /**
   * Reset all state to initial values
   */
  const reset = useCallback(() => {
    setProgress(null);
    setSections([]);
    setWarnings([]);
    setErrors([]);
    setIsConverting(false);
    setIsCancelled(false);
    setIsComplete(false);
    setResult(null);
    setTotalTimeMs(null);
    abortControllerRef.current = null;
  }, []);

  /**
   * Cancel the current conversion
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsCancelled(true);
      setIsConverting(false);
    }
  }, []);

  /**
   * Start the conversion process
   */
  const convert = useCallback(async (
    html: string,
    css: string,
    js: string = ''
  ): Promise<StreamingConversionResult | null> => {
    // Reset state for new conversion
    setSections([]);
    setWarnings([]);
    setErrors([]);
    setProgress(null);
    setIsConverting(true);
    setIsCancelled(false);
    setIsComplete(false);
    setResult(null);
    setTotalTimeMs(null);

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const stream = convertHtmlToWebflowStreaming(html, css, js, {
        ...streamOptions,
        signal: abortControllerRef.current.signal,
        onProgress: setProgress,
      });

      let finalResult: StreamingConversionResult | undefined;

      // Consume the generator
      while (true) {
        const { done, value } = await stream.next();

        if (done) {
          finalResult = value;
          break;
        }

        const chunk = value as ConversionChunk;

        switch (chunk.type) {
          case 'progress':
            setProgress(chunk.data);
            break;

          case 'section':
            setSections(prev => [...prev, chunk.data]);
            optionsRef.current.onSectionComplete?.(chunk.data);
            break;

          case 'warning':
            setWarnings(prev => [...prev, chunk.data]);
            break;

          case 'error':
            setErrors(prev => [...prev, chunk.data]);
            break;
        }
      }

      if (finalResult) {
        setResult(finalResult);
        setTotalTimeMs(finalResult.totalTimeMs);
        setIsComplete(true);
        setIsConverting(false);
        optionsRef.current.onComplete?.(finalResult);
        return finalResult;
      }

      return null;

    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // Conversion was cancelled - this is expected
        setIsCancelled(true);
        setIsConverting(false);
        return null;
      }

      // Actual error
      const errorObj = error instanceof Error ? error : new Error(String(error));
      setErrors(prev => [
        ...prev,
        {
          severity: ValidationSeverity.FATAL,
          code: 'CONVERSION_ERROR',
          message: errorObj.message,
        },
      ]);
      setIsConverting(false);
      optionsRef.current.onError?.(errorObj);
      throw errorObj;

    } finally {
      abortControllerRef.current = null;
    }
  }, [streamOptions]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    convert,
    cancel,
    reset,
    progress,
    sections,
    warnings,
    errors,
    isConverting,
    isCancelled,
    isComplete,
    result,
    payload: result?.payload ?? null,
    totalTimeMs,
  };
}

// ============================================
// UTILITY HOOKS
// ============================================

/**
 * Hook to track just the conversion progress percentage
 * Useful for simple progress indicators
 */
export function useConversionProgress(
  conversionState: Pick<UseStreamingConversionReturn, 'progress' | 'isConverting' | 'isComplete'>
): {
  percentage: number;
  phase: string;
  isActive: boolean;
} {
  const { progress, isConverting, isComplete } = conversionState;

  if (isComplete) {
    return { percentage: 100, phase: 'Complete', isActive: false };
  }

  if (!isConverting || !progress) {
    return { percentage: 0, phase: 'Idle', isActive: false };
  }

  const phaseLabels: Record<string, string> = {
    'parsing': 'Parsing HTML',
    'css-routing': 'Routing CSS',
    'generating': 'Generating',
    'validating': 'Validating',
    'complete': 'Complete',
  };

  return {
    percentage: progress.percentage,
    phase: phaseLabels[progress.phase] || progress.phase,
    isActive: true,
  };
}

/**
 * Hook to track section completion status
 */
export function useSectionProgress(
  conversionState: Pick<UseStreamingConversionReturn, 'progress' | 'sections'>
): {
  completedCount: number;
  totalCount: number;
  currentSection: string | null;
} {
  const { progress, sections } = conversionState;

  return {
    completedCount: sections.length,
    totalCount: progress?.total || 0,
    currentSection: progress?.currentItem || null,
  };
}

// ============================================
// RE-EXPORTS
// ============================================

export type {
  ConversionProgress,
  SectionResult,
  StreamingConversionResult,
  WebflowPayload,
  ValidationIssue,
};
