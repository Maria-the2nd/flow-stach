# PROMPT 15: Incremental/Streaming Generation for Large Payloads

**Priority:** POLISH (Tier 3)  
**Complexity:** High  
**Estimated Time:** 3-4 hours  
**Coverage Impact:** +1.5%

---

## Context

Currently, Flow Bridge processes the entire HTML/CSS/JS in one pass, generating the complete Webflow JSON payload before returning. For large inputs (complex pages, multiple sections, heavy CSS), this can:

1. Block the UI for several seconds
2. Cause memory spikes
3. Make it impossible to show progress
4. Risk timeout on very large inputs

Incremental/streaming generation would process and emit results progressively.

---

## Requirements

### 1. Progressive Processing

Instead of:
```
Input → [BLACK BOX] → Complete Output
```

Achieve:
```
Input → Section 1 ready → Section 2 ready → ... → Complete
```

### 2. Progress Reporting

```typescript
interface ConversionProgress {
  phase: 'parsing' | 'css-routing' | 'generating' | 'validating';
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;  // e.g., "Processing .hero section"
}
```

### 3. Streaming API

```typescript
// New streaming conversion function
async function* convertHtmlToWebflowStreaming(
  html: string,
  css: string,
  js: string,
  options: ConversionOptions
): AsyncGenerator<ConversionChunk, WebflowPayload, void>;

interface ConversionChunk {
  type: 'progress' | 'section' | 'warning' | 'error';
  data: ConversionProgress | WebflowNode | ValidationMessage;
}
```

### 4. Cancellation Support

```typescript
const controller = new AbortController();

const stream = convertHtmlToWebflowStreaming(html, css, js, {
  signal: controller.signal,
});

// User clicks cancel
controller.abort();
```

### 5. Memory Efficiency

- Process one section at a time
- Release intermediate data after each section
- Cap maximum in-flight data

---

## Architecture

### Current Flow (Blocking)

```
┌──────────────────────────────────────────────────────────────┐
│                      convertHtmlToWebflow()                  │
├──────────────────────────────────────────────────────────────┤
│ 1. Parse all HTML (blocking)                                 │
│ 2. Parse all CSS (blocking)                                  │
│ 3. Route all CSS (blocking)                                  │
│ 4. Generate all nodes (blocking)                             │
│ 5. Generate all styles (blocking)                            │
│ 6. Validate everything (blocking)                            │
│ 7. Return complete payload                                   │
└──────────────────────────────────────────────────────────────┘
```

### New Flow (Streaming)

```
┌──────────────────────────────────────────────────────────────┐
│                convertHtmlToWebflowStreaming()               │
├──────────────────────────────────────────────────────────────┤
│ 1. Parse HTML → yield { type: 'progress', phase: 'parsing' } │
│    └─ For each section:                                      │
│       └─ yield { type: 'progress', currentItem: '.hero' }    │
│                                                              │
│ 2. Parse CSS → yield { type: 'progress', phase: 'css' }      │
│                                                              │
│ 3. For each section:                                         │
│    ├─ Generate nodes                                         │
│    ├─ Generate styles                                        │
│    └─ yield { type: 'section', data: sectionPayload }        │
│                                                              │
│ 4. Validate → yield warnings/errors incrementally            │
│                                                              │
│ 5. Return final merged payload                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Files to Create/Modify

### 1. Create: `lib/webflow-converter-streaming.ts`

```typescript
/**
 * Streaming Webflow Converter
 * Processes HTML/CSS/JS incrementally with progress reporting
 */

import { WebflowPayload, ConversionOptions } from './webflow-converter';

export interface ConversionProgress {
  phase: 'parsing' | 'css-routing' | 'generating' | 'validating' | 'complete';
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
  elapsedMs: number;
  estimatedRemainingMs?: number;
}

export interface SectionResult {
  sectionId: string;
  nodes: any[];
  styles: any[];
  embedCSS?: string;
  embedJS?: string;
}

export type ConversionChunk =
  | { type: 'progress'; data: ConversionProgress }
  | { type: 'section'; data: SectionResult }
  | { type: 'warning'; data: ValidationMessage }
  | { type: 'error'; data: ValidationMessage };

export interface StreamingOptions extends ConversionOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ConversionProgress) => void;
  chunkSize?: number;  // Process N sections before yielding
}

export async function* convertHtmlToWebflowStreaming(
  html: string,
  css: string,
  js: string,
  options: StreamingOptions = {}
): AsyncGenerator<ConversionChunk, WebflowPayload, void> {
  const startTime = performance.now();
  const { signal, chunkSize = 1 } = options;
  
  // Check for cancellation
  const checkAbort = () => {
    if (signal?.aborted) {
      throw new DOMException('Conversion cancelled', 'AbortError');
    }
  };
  
  // Phase 1: Parse HTML into sections
  yield {
    type: 'progress',
    data: createProgress('parsing', 0, 1, startTime),
  };
  
  checkAbort();
  
  const sections = await parseHtmlSections(html);
  const totalSections = sections.length;
  
  yield {
    type: 'progress',
    data: createProgress('parsing', 1, 1, startTime, 'HTML parsed'),
  };
  
  // Phase 2: Parse and route CSS
  yield {
    type: 'progress',
    data: createProgress('css-routing', 0, 1, startTime),
  };
  
  checkAbort();
  
  const { nativeCSS, embedCSS, classIndex } = await routeCSS(css);
  
  yield {
    type: 'progress',
    data: createProgress('css-routing', 1, 1, startTime, 'CSS routed'),
  };
  
  // Phase 3: Generate Webflow nodes for each section
  const allNodes: any[] = [];
  const allStyles: any[] = [];
  let processedSections = 0;
  
  for (const section of sections) {
    checkAbort();
    
    yield {
      type: 'progress',
      data: createProgress(
        'generating',
        processedSections,
        totalSections,
        startTime,
        `Processing ${section.selector || 'section'}`
      ),
    };
    
    // Generate nodes and styles for this section
    const sectionResult = await generateSectionPayload(
      section,
      classIndex,
      options
    );
    
    allNodes.push(...sectionResult.nodes);
    allStyles.push(...sectionResult.styles);
    
    // Yield section result
    yield {
      type: 'section',
      data: sectionResult,
    };
    
    processedSections++;
    
    // Allow UI to update
    await yieldToMain();
  }
  
  // Phase 4: Validation
  yield {
    type: 'progress',
    data: createProgress('validating', 0, 1, startTime),
  };
  
  checkAbort();
  
  const validationResult = await validatePayload({
    nodes: allNodes,
    styles: allStyles,
  });
  
  // Yield validation messages
  for (const warning of validationResult.warnings) {
    yield { type: 'warning', data: warning };
  }
  
  for (const error of validationResult.errors) {
    yield { type: 'error', data: error };
  }
  
  yield {
    type: 'progress',
    data: createProgress('complete', 1, 1, startTime),
  };
  
  // Return final payload
  return buildFinalPayload(allNodes, allStyles, embedCSS, js, validationResult);
}

// Helper: Create progress object
function createProgress(
  phase: ConversionProgress['phase'],
  current: number,
  total: number,
  startTime: number,
  currentItem?: string
): ConversionProgress {
  const elapsed = performance.now() - startTime;
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  
  // Estimate remaining time based on progress
  const estimatedTotal = current > 0 ? (elapsed / current) * total : undefined;
  const estimatedRemaining = estimatedTotal ? estimatedTotal - elapsed : undefined;
  
  return {
    phase,
    current,
    total,
    percentage,
    currentItem,
    elapsedMs: Math.round(elapsed),
    estimatedRemainingMs: estimatedRemaining ? Math.round(estimatedRemaining) : undefined,
  };
}

// Helper: Yield to main thread to prevent blocking
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

// Helper: Parse HTML into processable sections
async function parseHtmlSections(html: string): Promise<Section[]> {
  // ... implementation using html-parser.ts
}

// Helper: Generate payload for a single section
async function generateSectionPayload(
  section: Section,
  classIndex: ClassIndex,
  options: ConversionOptions
): Promise<SectionResult> {
  // ... implementation using webflow-converter.ts logic
}

// Helper: Build final merged payload
function buildFinalPayload(
  nodes: any[],
  styles: any[],
  embedCSS: string,
  js: string,
  validation: ValidationResult
): WebflowPayload {
  // ... implementation
}
```

### 2. Create: `hooks/use-streaming-conversion.ts`

```typescript
/**
 * React hook for streaming conversion with progress
 */

import { useState, useCallback, useRef } from 'react';
import {
  convertHtmlToWebflowStreaming,
  ConversionProgress,
  ConversionChunk,
  StreamingOptions,
} from '@/lib/webflow-converter-streaming';
import { WebflowPayload } from '@/lib/webflow-converter';
import { ValidationMessage } from '@/lib/validation-types';

interface UseStreamingConversionResult {
  convert: (html: string, css: string, js: string) => Promise<WebflowPayload | null>;
  cancel: () => void;
  progress: ConversionProgress | null;
  sections: SectionResult[];
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
  isConverting: boolean;
  isCancelled: boolean;
}

export function useStreamingConversion(
  options?: Partial<StreamingOptions>
): UseStreamingConversionResult {
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [sections, setSections] = useState<SectionResult[]>([]);
  const [warnings, setWarnings] = useState<ValidationMessage[]>([]);
  const [errors, setErrors] = useState<ValidationMessage[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const convert = useCallback(async (
    html: string,
    css: string,
    js: string
  ): Promise<WebflowPayload | null> => {
    // Reset state
    setSections([]);
    setWarnings([]);
    setErrors([]);
    setProgress(null);
    setIsConverting(true);
    setIsCancelled(false);
    
    // Create abort controller
    abortControllerRef.current = new AbortController();
    
    try {
      const stream = convertHtmlToWebflowStreaming(html, css, js, {
        ...options,
        signal: abortControllerRef.current.signal,
      });
      
      let result: WebflowPayload | null = null;
      
      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'progress':
            setProgress(chunk.data);
            break;
          case 'section':
            setSections(prev => [...prev, chunk.data]);
            break;
          case 'warning':
            setWarnings(prev => [...prev, chunk.data]);
            break;
          case 'error':
            setErrors(prev => [...prev, chunk.data]);
            break;
        }
      }
      
      // Get final result from generator return value
      result = await stream.return(undefined as any);
      
      return result.value;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setIsCancelled(true);
        return null;
      }
      throw error;
    } finally {
      setIsConverting(false);
      abortControllerRef.current = null;
    }
  }, [options]);
  
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);
  
  return {
    convert,
    cancel,
    progress,
    sections,
    warnings,
    errors,
    isConverting,
    isCancelled,
  };
}
```

### 3. Create: `components/conversion-progress.tsx`

```tsx
'use client';

import { ConversionProgress } from '@/lib/webflow-converter-streaming';

interface ConversionProgressBarProps {
  progress: ConversionProgress | null;
  onCancel?: () => void;
}

export function ConversionProgressBar({ 
  progress, 
  onCancel 
}: ConversionProgressBarProps) {
  if (!progress) return null;
  
  const phaseLabels = {
    parsing: 'Parsing HTML...',
    'css-routing': 'Routing CSS...',
    generating: 'Generating Webflow nodes...',
    validating: 'Validating output...',
    complete: 'Complete!',
  };
  
  return (
    <div className="conversion-progress">
      <div className="progress-header">
        <span className="phase-label">{phaseLabels[progress.phase]}</span>
        <span className="percentage">{progress.percentage}%</span>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      
      <div className="progress-details">
        {progress.currentItem && (
          <span className="current-item">{progress.currentItem}</span>
        )}
        
        <span className="timing">
          {formatTime(progress.elapsedMs)} elapsed
          {progress.estimatedRemainingMs && (
            <> • ~{formatTime(progress.estimatedRemainingMs)} remaining</>
          )}
        </span>
      </div>
      
      {onCancel && progress.phase !== 'complete' && (
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
```

---

## Integration Example

```tsx
// In app/admin/import/page.tsx

import { useStreamingConversion } from '@/hooks/use-streaming-conversion';
import { ConversionProgressBar } from '@/components/conversion-progress';

export default function ImportPage() {
  const {
    convert,
    cancel,
    progress,
    sections,
    warnings,
    errors,
    isConverting,
    isCancelled,
  } = useStreamingConversion();
  
  const handleConvert = async () => {
    const payload = await convert(html, css, js);
    if (payload) {
      setPayload(payload);
    }
  };
  
  return (
    <div>
      {/* ... input fields ... */}
      
      <button onClick={handleConvert} disabled={isConverting}>
        {isConverting ? 'Converting...' : 'Convert'}
      </button>
      
      {isConverting && (
        <ConversionProgressBar 
          progress={progress}
          onCancel={cancel}
        />
      )}
      
      {/* Show sections as they complete */}
      {sections.map((section, i) => (
        <div key={i} className="section-preview">
          ✅ {section.sectionId} ready
        </div>
      ))}
      
      {isCancelled && (
        <div className="cancelled">Conversion cancelled</div>
      )}
    </div>
  );
}
```

---

## Performance Considerations

### 1. Chunking Strategy

```typescript
// Process multiple small sections together
const CHUNK_SIZE = 5;  // Process 5 sections before yielding

for (let i = 0; i < sections.length; i += CHUNK_SIZE) {
  const chunk = sections.slice(i, i + CHUNK_SIZE);
  
  for (const section of chunk) {
    // Process section
  }
  
  yield { type: 'progress', ... };
  await yieldToMain();
}
```

### 2. Memory Management

```typescript
// Release processed sections from memory
function* processWithCleanup(sections) {
  for (const section of sections) {
    const result = processSection(section);
    yield result;
    
    // Allow GC to collect section data
    section.html = null;
    section.elements = null;
  }
}
```

### 3. Web Workers (Future Enhancement)

```typescript
// Offload heavy processing to worker
const worker = new Worker('/conversion-worker.js');

worker.postMessage({ html, css, js });

worker.onmessage = (event) => {
  const { type, data } = event.data;
  // Handle chunks from worker
};
```

---

## Test Cases

```typescript
describe('convertHtmlToWebflowStreaming', () => {
  it('should yield progress updates', async () => {
    const chunks: ConversionChunk[] = [];
    
    const stream = convertHtmlToWebflowStreaming(html, css, js);
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const progressChunks = chunks.filter(c => c.type === 'progress');
    expect(progressChunks.length).toBeGreaterThan(0);
  });

  it('should yield sections incrementally', async () => {
    const html = `
      <section class="hero"></section>
      <section class="features"></section>
      <section class="footer"></section>
    `;
    
    const sections: SectionResult[] = [];
    const stream = convertHtmlToWebflowStreaming(html, '', '');
    
    for await (const chunk of stream) {
      if (chunk.type === 'section') {
        sections.push(chunk.data);
      }
    }
    
    expect(sections.length).toBe(3);
  });

  it('should support cancellation', async () => {
    const controller = new AbortController();
    
    const stream = convertHtmlToWebflowStreaming(html, css, js, {
      signal: controller.signal,
    });
    
    // Start iteration
    const iterator = stream[Symbol.asyncIterator]();
    await iterator.next();
    
    // Cancel
    controller.abort();
    
    // Should throw AbortError
    await expect(iterator.next()).rejects.toThrow('AbortError');
  });

  it('should estimate remaining time', async () => {
    let sawEstimate = false;
    
    const stream = convertHtmlToWebflowStreaming(largeHtml, css, js);
    
    for await (const chunk of stream) {
      if (chunk.type === 'progress' && chunk.data.estimatedRemainingMs) {
        sawEstimate = true;
      }
    }
    
    expect(sawEstimate).toBe(true);
  });
});
```

---

## Success Criteria

1. Progress updates emitted during conversion
2. Sections yielded as they complete
3. Cancellation stops processing immediately
4. Memory usage stays bounded
5. UI remains responsive during conversion
6. Time estimates reasonably accurate
7. Final payload identical to blocking version
8. Error handling works for partial failures
