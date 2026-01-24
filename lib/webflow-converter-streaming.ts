/**
 * Streaming Webflow Converter
 * Processes HTML/CSS/JS incrementally with progress reporting
 *
 * Enables:
 * - Progressive processing of large payloads
 * - Real-time progress updates
 * - Cancellation support via AbortController
 * - Memory-efficient section-by-section processing
 */

import type { DetectedSection } from "./html-parser";
import { parseFullHtml, detectSections, extractCleanHtml, extractCssForSection } from "./html-parser";
import { parseCSS, type ClassIndex } from "./css-parser";
import type { WebflowPayload, WebflowNode, WebflowStyle } from "./webflow-converter";
import { convertSectionToWebflow, convertHtmlCssToWebflow } from "./webflow-converter";
import {
  ValidationSeverity,
  type ValidationIssue,
  createValidationResult,
  type ValidationResult,
} from "./validation-types";

// ============================================
// TYPES
// ============================================

/**
 * Conversion phase indicator
 */
export type ConversionPhase =
  | 'parsing'
  | 'css-routing'
  | 'generating'
  | 'validating'
  | 'complete';

/**
 * Progress information for conversion
 */
export interface ConversionProgress {
  /** Current conversion phase */
  phase: ConversionPhase;
  /** Current item index (0-based) */
  current: number;
  /** Total items to process */
  total: number;
  /** Completion percentage (0-100) */
  percentage: number;
  /** Human-readable description of current item being processed */
  currentItem?: string;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
  /** Estimated remaining time in milliseconds (when available) */
  estimatedRemainingMs?: number;
}

/**
 * Result for a single section conversion
 */
export interface SectionResult {
  /** Unique section identifier */
  sectionId: string;
  /** Section name for display */
  sectionName: string;
  /** Generated Webflow nodes */
  nodes: WebflowNode[];
  /** Generated Webflow styles */
  styles: WebflowStyle[];
  /** CSS that must be embedded (non-native) */
  embedCSS?: string;
  /** JavaScript code for this section */
  embedJS?: string;
  /** Validation issues specific to this section */
  issues: ValidationIssue[];
}

/**
 * Chunk types emitted by the streaming converter
 */
export type ConversionChunk =
  | { type: 'progress'; data: ConversionProgress }
  | { type: 'section'; data: SectionResult }
  | { type: 'warning'; data: ValidationIssue }
  | { type: 'error'; data: ValidationIssue };

/**
 * Options for streaming conversion
 */
export interface StreamingConversionOptions {
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Callback for progress updates (alternative to consuming generator) */
  onProgress?: (progress: ConversionProgress) => void;
  /** Process N sections before yielding (default: 1 for real-time updates) */
  chunkSize?: number;
  /** ID prefix for generated nodes */
  idPrefix?: string;
  /** CSS extraction options */
  cssOptions?: {
    includeRoot?: boolean;
    includeReset?: boolean;
    includeBody?: boolean;
  };
}

/**
 * Final result returned by the streaming converter
 */
export interface StreamingConversionResult {
  /** Complete Webflow payload */
  payload: WebflowPayload;
  /** Individual section results */
  sections: SectionResult[];
  /** All validation issues */
  validation: ValidationResult;
  /** Total processing time in milliseconds */
  totalTimeMs: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a progress object
 */
function createProgress(
  phase: ConversionPhase,
  current: number,
  total: number,
  startTime: number,
  currentItem?: string
): ConversionProgress {
  const elapsed = performance.now() - startTime;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  // Estimate remaining time based on progress
  let estimatedRemainingMs: number | undefined;
  if (current > 0 && phase !== 'complete') {
    const timePerItem = elapsed / current;
    const remainingItems = total - current;
    estimatedRemainingMs = Math.round(timePerItem * remainingItems);
  }

  return {
    phase,
    current,
    total,
    percentage,
    currentItem,
    elapsedMs: Math.round(elapsed),
    estimatedRemainingMs,
  };
}

/**
 * Yield to main thread to prevent UI blocking
 */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else if (typeof setTimeout !== 'undefined') {
      setTimeout(resolve, 0);
    } else {
      resolve();
    }
  });
}

/**
 * Check if abort signal is triggered
 */
function checkAbort(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Conversion cancelled', 'AbortError');
  }
}

/**
 * Merge multiple section results into a single Webflow payload
 */
function mergeResults(
  sections: SectionResult[],
  rootTokensCss: string,
  fullJs: string
): WebflowPayload {
  const allNodes: WebflowNode[] = [];
  const allStyles: WebflowStyle[] = [];
  const seenStyleIds = new Set<string>();

  // Collect nodes and dedupe styles
  for (const section of sections) {
    allNodes.push(...section.nodes);

    for (const style of section.styles) {
      if (!seenStyleIds.has(style._id)) {
        seenStyleIds.add(style._id);
        allStyles.push(style);
      }
    }
  }

  return {
    type: "@webflow/XscpData",
    payload: {
      nodes: allNodes,
      styles: allStyles,
      assets: [],
      ix1: [],
      ix2: {
        interactions: [],
        events: [],
        actionLists: [],
      },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      hasEmbedCSS: false,
      hasEmbedJS: false,
      embedCSSSize: 0,
      embedJSSize: 0,
    },
  };
}

/**
 * Extract section name for display
 */
function getSectionDisplayName(section: DetectedSection): string {
  return section.name || section.className || section.id || 'Section';
}

// ============================================
// MAIN STREAMING CONVERTER
// ============================================

/**
 * Convert HTML/CSS/JS to Webflow payload with streaming progress
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 * const stream = convertHtmlToWebflowStreaming(html, css, js, {
 *   signal: controller.signal,
 * });
 *
 * for await (const chunk of stream) {
 *   switch (chunk.type) {
 *     case 'progress':
 *       updateProgressBar(chunk.data);
 *       break;
 *     case 'section':
 *       addSection(chunk.data);
 *       break;
 *     case 'warning':
 *       showWarning(chunk.data);
 *       break;
 *   }
 * }
 *
 * // Get final result
 * const result = stream.return(undefined);
 * ```
 */
export async function* convertHtmlToWebflowStreaming(
  html: string,
  css: string,
  js: string,
  options: StreamingConversionOptions = {}
): AsyncGenerator<ConversionChunk, StreamingConversionResult, void> {
  const startTime = performance.now();
  const { signal, chunkSize = 1, onProgress } = options;
  const allIssues: ValidationIssue[] = [];
  const sectionResults: SectionResult[] = [];

  // Helper to emit progress
  const emitProgress = (progress: ConversionProgress) => {
    onProgress?.(progress);
  };

  // ============================================
  // PHASE 1: Parse HTML into sections
  // ============================================

  const parsingProgress = createProgress('parsing', 0, 3, startTime, 'Extracting content...');
  yield { type: 'progress', data: parsingProgress };
  emitProgress(parsingProgress);

  checkAbort(signal);

  // Extract clean HTML (strips scripts/styles)
  const cleanResult = extractCleanHtml(html);

  yield {
    type: 'progress',
    data: createProgress('parsing', 1, 3, startTime, 'Parsing HTML structure...'),
  };

  checkAbort(signal);

  // Parse full HTML to detect sections
  const parseResult = parseFullHtml(html, {
    cssOptions: options.cssOptions,
  });

  yield {
    type: 'progress',
    data: createProgress('parsing', 2, 3, startTime, `Found ${parseResult.sections.length} sections`),
  };

  checkAbort(signal);
  await yieldToMain();

  const sections = parseResult.sections;
  const totalSections = sections.length;

  // Handle edge case: no sections detected
  if (totalSections === 0) {
    // Fall back to converting entire content as single section
    const fullResult = convertHtmlCssToWebflow(cleanResult.cleanHtml, css, {
      idPrefix: options.idPrefix,
    });

    const singleSection: SectionResult = {
      sectionId: 'full-page',
      sectionName: 'Full Page',
      nodes: fullResult.payload.nodes,
      styles: fullResult.payload.styles,
      embedCSS: cleanResult.extractedStyles,
      embedJS: js,
      issues: [],
    };

    sectionResults.push(singleSection);

    yield { type: 'section', data: singleSection };

    const finalProgress = createProgress('complete', 1, 1, startTime);
    yield { type: 'progress', data: finalProgress };
    emitProgress(finalProgress);

    const totalTime = performance.now() - startTime;

    return {
      payload: fullResult,
      sections: sectionResults,
      validation: createValidationResult(allIssues),
      totalTimeMs: Math.round(totalTime),
    };
  }

  yield {
    type: 'progress',
    data: createProgress('parsing', 3, 3, startTime, 'HTML parsed'),
  };

  // ============================================
  // PHASE 2: Parse and route CSS
  // ============================================

  yield {
    type: 'progress',
    data: createProgress('css-routing', 0, 2, startTime, 'Parsing CSS...'),
  };

  checkAbort(signal);

  // Parse CSS into class index
  const cssResult = parseCSS(css);

  // Add CSS parser warnings
  for (const warning of cssResult.classIndex.warnings) {
    const issue: ValidationIssue = {
      severity: warning.severity === 'error'
        ? ValidationSeverity.ERROR
        : ValidationSeverity.WARNING,
      code: warning.type.toUpperCase(),
      message: warning.message,
      context: warning.selector || warning.property,
    };
    allIssues.push(issue);
    yield { type: 'warning', data: issue };
  }

  yield {
    type: 'progress',
    data: createProgress('css-routing', 1, 2, startTime, 'Routing CSS to sections...'),
  };

  checkAbort(signal);
  await yieldToMain();

  yield {
    type: 'progress',
    data: createProgress('css-routing', 2, 2, startTime, 'CSS routed'),
  };

  // ============================================
  // PHASE 3: Generate Webflow nodes per section
  // ============================================

  let processedSections = 0;
  let chunkedSections: SectionResult[] = [];

  for (const section of sections) {
    checkAbort(signal);

    const sectionName = getSectionDisplayName(section);

    yield {
      type: 'progress',
      data: createProgress(
        'generating',
        processedSections,
        totalSections,
        startTime,
        `Processing ${sectionName}...`
      ),
    };

    try {
      // Convert this section to Webflow format
      const sectionPayload = convertSectionToWebflow(section, {
        idPrefix: options.idPrefix || section.className?.split('-')[0],
      });

      // Collect section-specific issues from preflight validation
      const sectionIssues: ValidationIssue[] = [];

      if (sectionPayload.meta.preflightValidation && !sectionPayload.meta.preflightValidation.isValid) {
        const issue: ValidationIssue = {
          severity: sectionPayload.meta.preflightValidation.canProceed
            ? ValidationSeverity.WARNING
            : ValidationSeverity.ERROR,
          code: 'PREFLIGHT_VALIDATION',
          message: sectionPayload.meta.preflightValidation.summary,
          context: sectionName,
        };
        sectionIssues.push(issue);
        allIssues.push(issue);

        if (sectionPayload.meta.preflightValidation.canProceed) {
          yield { type: 'warning', data: issue };
        } else {
          yield { type: 'error', data: issue };
        }
      }

      // Build section result
      const sectionResult: SectionResult = {
        sectionId: section.id,
        sectionName,
        nodes: sectionPayload.payload.nodes,
        styles: sectionPayload.payload.styles,
        embedCSS: cssResult.classIndex.nonStandardMediaCss,
        embedJS: section.jsContent,
        issues: sectionIssues,
      };

      sectionResults.push(sectionResult);
      chunkedSections.push(sectionResult);

    } catch (err) {
      // Handle conversion error for this section
      const errorIssue: ValidationIssue = {
        severity: ValidationSeverity.ERROR,
        code: 'SECTION_CONVERSION_ERROR',
        message: err instanceof Error ? err.message : 'Unknown conversion error',
        context: sectionName,
      };
      allIssues.push(errorIssue);
      yield { type: 'error', data: errorIssue };
    }

    processedSections++;

    // Yield sections in chunks
    if (chunkedSections.length >= chunkSize || processedSections === totalSections) {
      for (const result of chunkedSections) {
        yield { type: 'section', data: result };
      }
      chunkedSections = [];

      // Allow UI to update
      await yieldToMain();
    }
  }

  yield {
    type: 'progress',
    data: createProgress('generating', totalSections, totalSections, startTime, 'All sections generated'),
  };

  // ============================================
  // PHASE 4: Final validation
  // ============================================

  yield {
    type: 'progress',
    data: createProgress('validating', 0, 1, startTime, 'Validating output...'),
  };

  checkAbort(signal);

  // Merge all sections into final payload
  const finalPayload = mergeResults(sectionResults, parseResult.rootTokens, parseResult.fullJs || js);

  // Run final validation
  const validationResult = createValidationResult(allIssues);

  yield {
    type: 'progress',
    data: createProgress('validating', 1, 1, startTime, 'Validation complete'),
  };

  // ============================================
  // PHASE 5: Complete
  // ============================================

  const totalTime = performance.now() - startTime;

  const completeProgress = createProgress('complete', 1, 1, startTime);
  yield { type: 'progress', data: completeProgress };
  emitProgress(completeProgress);

  return {
    payload: finalPayload,
    sections: sectionResults,
    validation: validationResult,
    totalTimeMs: Math.round(totalTime),
  };
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Convert HTML to Webflow with blocking execution but progress callbacks
 *
 * Use this when you need the final result but still want progress updates.
 * Returns null if cancelled via AbortController.
 */
export async function convertWithProgress(
  html: string,
  css: string,
  js: string,
  options: StreamingConversionOptions & {
    onSection?: (section: SectionResult) => void;
    onWarning?: (issue: ValidationIssue) => void;
    onError?: (issue: ValidationIssue) => void;
    onComplete?: (result: StreamingConversionResult) => void;
  } = {}
): Promise<StreamingConversionResult | null> {
  const { onSection, onWarning, onError, onComplete, ...streamOptions } = options;

  try {
    const stream = convertHtmlToWebflowStreaming(html, css, js, streamOptions);

    let result: StreamingConversionResult | undefined;

    while (true) {
      const { done, value } = await stream.next();

      if (done) {
        result = value as StreamingConversionResult;
        break;
      }

      const chunk = value as ConversionChunk;

      switch (chunk.type) {
        case 'section':
          onSection?.(chunk.data);
          break;
        case 'warning':
          onWarning?.(chunk.data);
          break;
        case 'error':
          onError?.(chunk.data);
          break;
      }
    }

    if (!result) {
      throw new Error('Conversion did not produce a result');
    }

    onComplete?.(result);
    return result;

  } catch (error) {
    // Handle cancellation gracefully
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

/**
 * Estimate processing time based on input size
 *
 * Useful for showing expected duration before starting conversion.
 */
export function estimateProcessingTime(html: string, css: string): {
  estimatedMs: number;
  complexity: 'simple' | 'moderate' | 'complex';
} {
  const htmlSize = html.length;
  const cssSize = css.length;
  const totalSize = htmlSize + cssSize;

  // Count approximate sections (naive heuristic)
  const sectionMatches = html.match(/<(?:section|nav|header|footer|article|aside)[^>]*>/gi);
  const sectionCount = sectionMatches?.length || 1;

  // Count CSS classes (naive heuristic)
  const classMatches = css.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g);
  const classCount = classMatches?.length || 0;

  // Estimate based on size and complexity
  // Base: 100ms + 1ms per 1KB + 10ms per section + 1ms per 10 classes
  const baseTime = 100;
  const sizeTime = totalSize / 1000;
  const sectionTime = sectionCount * 10;
  const classTime = classCount / 10;

  const estimatedMs = Math.round(baseTime + sizeTime + sectionTime + classTime);

  let complexity: 'simple' | 'moderate' | 'complex';
  if (estimatedMs < 500) {
    complexity = 'simple';
  } else if (estimatedMs < 2000) {
    complexity = 'moderate';
  } else {
    complexity = 'complex';
  }

  return { estimatedMs, complexity };
}

// ============================================
// RE-EXPORTS
// ============================================

export type {
  DetectedSection,
  WebflowPayload,
  WebflowNode,
  WebflowStyle,
  ClassIndex,
  ValidationIssue,
  ValidationResult,
};
