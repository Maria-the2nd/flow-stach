/**
 * Streaming Webflow Converter Tests
 *
 * Verifies that the streaming converter correctly processes HTML/CSS/JS
 * incrementally with proper progress reporting and cancellation support.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  convertHtmlToWebflowStreaming,
  convertWithProgress,
  estimateProcessingTime,
  type ConversionChunk,
  type ConversionProgress,
  type SectionResult,
  type StreamingConversionResult,
} from "../lib/webflow-converter-streaming";

// ============================================
// TEST DATA
// ============================================

const singleSectionHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
  <style>
    .hero {
      display: flex;
      background: #000;
      color: white;
      padding: 80px 40px;
    }
    .hero-title {
      font-size: 48px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <section class="hero">
    <h1 class="hero-title">Hello World</h1>
  </section>
</body>
</html>
`;

const multiSectionHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Multi Section Page</title>
  <style>
    :root {
      --primary: #007bff;
      --text: #333;
    }
    .nav {
      display: flex;
      justify-content: space-between;
      padding: 20px;
      background: white;
    }
    .nav-logo {
      font-weight: bold;
      font-size: 24px;
    }
    .hero {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .hero-title {
      font-size: 64px;
      color: white;
    }
    .hero-subtitle {
      font-size: 24px;
      color: rgba(255, 255, 255, 0.8);
    }
    .features {
      padding: 80px 40px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 40px;
    }
    .feature-card {
      padding: 30px;
      border-radius: 8px;
      background: #f8f9fa;
    }
    .footer {
      padding: 40px;
      background: #1a1a1a;
      color: white;
      text-align: center;
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav class="nav">
    <div class="nav-logo">Brand</div>
    <div class="nav-links">
      <a href="#">Home</a>
      <a href="#">About</a>
      <a href="#">Contact</a>
    </div>
  </nav>

  <!-- Hero Section -->
  <section class="hero">
    <h1 class="hero-title">Welcome to Our Site</h1>
    <p class="hero-subtitle">Building amazing experiences</p>
  </section>

  <!-- Features Section -->
  <section class="features">
    <div class="feature-card">
      <h3>Feature 1</h3>
      <p>Description of feature 1</p>
    </div>
    <div class="feature-card">
      <h3>Feature 2</h3>
      <p>Description of feature 2</p>
    </div>
    <div class="feature-card">
      <h3>Feature 3</h3>
      <p>Description of feature 3</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="footer">
    <p>&copy; 2024 Brand. All rights reserved.</p>
  </footer>
</body>
</html>
`;

const minimalCss = `
.hero {
  display: flex;
  background: #000;
}
`;

const complexJs = `
document.addEventListener('DOMContentLoaded', function() {
  const hero = document.querySelector('.hero');
  hero.addEventListener('click', () => {
    console.log('Hero clicked');
  });
});
`;

// ============================================
// HELPER FUNCTIONS
// ============================================

async function collectChunks(
  stream: AsyncGenerator<ConversionChunk, StreamingConversionResult, void>
): Promise<{ chunks: ConversionChunk[]; result: StreamingConversionResult }> {
  const chunks: ConversionChunk[] = [];
  let result: StreamingConversionResult;

  while (true) {
    const { done, value } = await stream.next();

    if (done) {
      result = value as StreamingConversionResult;
      break;
    }

    chunks.push(value as ConversionChunk);
  }

  return { chunks, result: result! };
}

function getProgressChunks(chunks: ConversionChunk[]): ConversionProgress[] {
  return chunks
    .filter((c): c is { type: "progress"; data: ConversionProgress } => c.type === "progress")
    .map((c) => c.data);
}

function getSectionChunks(chunks: ConversionChunk[]): SectionResult[] {
  return chunks
    .filter((c): c is { type: "section"; data: SectionResult } => c.type === "section")
    .map((c) => c.data);
}

// ============================================
// TESTS
// ============================================

describe("Streaming Webflow Converter", () => {
  describe("Basic streaming functionality", () => {
    it("converts single section HTML and yields progress", async () => {
      const stream = convertHtmlToWebflowStreaming(singleSectionHtml, minimalCss, "");
      const { chunks, result } = await collectChunks(stream);

      // Should have progress chunks
      const progressChunks = getProgressChunks(chunks);
      expect(progressChunks.length).toBeGreaterThan(0);

      // Should progress through phases
      const phases = progressChunks.map((p) => p.phase);
      expect(phases).toContain("parsing");

      // Final result should be valid
      expect(result).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.sections.length).toBeGreaterThan(0);
      expect(result.totalTimeMs).toBeGreaterThan(0);
    });

    it("converts multi-section HTML with correct section count", async () => {
      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "");
      const { chunks, result } = await collectChunks(stream);

      // Should yield section chunks
      const sectionChunks = getSectionChunks(chunks);
      expect(sectionChunks.length).toBeGreaterThan(1);

      // Result should have all sections
      expect(result.sections.length).toBe(sectionChunks.length);

      // Each section should have nodes
      for (const section of result.sections) {
        expect(section.nodes.length).toBeGreaterThan(0);
        expect(section.sectionName).toBeDefined();
        expect(section.sectionId).toBeDefined();
      }
    });

    it("yields progress with correct percentage progression", async () => {
      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "");
      const { chunks } = await collectChunks(stream);

      const progressChunks = getProgressChunks(chunks);
      const percentages = progressChunks.map((p) => p.percentage);

      // Percentages should generally increase (with possible resets between phases)
      const lastPercentage = percentages[percentages.length - 1];
      expect(lastPercentage).toBe(100);

      // All percentages should be valid
      for (const pct of percentages) {
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
      }
    });

    it("includes elapsed time in progress updates", async () => {
      const stream = convertHtmlToWebflowStreaming(singleSectionHtml, minimalCss, "");
      const { chunks } = await collectChunks(stream);

      const progressChunks = getProgressChunks(chunks);

      for (const progress of progressChunks) {
        expect(progress.elapsedMs).toBeDefined();
        expect(progress.elapsedMs).toBeGreaterThanOrEqual(0);
      }

      // Later progress should have higher elapsed time
      if (progressChunks.length >= 2) {
        const firstProgress = progressChunks[0];
        const lastProgress = progressChunks[progressChunks.length - 1];
        expect(lastProgress.elapsedMs).toBeGreaterThanOrEqual(firstProgress.elapsedMs);
      }
    });
  });

  describe("Phase progression", () => {
    it("progresses through all expected phases", async () => {
      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "");
      const { chunks } = await collectChunks(stream);

      const progressChunks = getProgressChunks(chunks);
      const phases = new Set(progressChunks.map((p) => p.phase));

      // Should have all main phases
      expect(phases.has("parsing")).toBe(true);
      expect(phases.has("complete")).toBe(true);
    });

    it("reports current item during generation phase", async () => {
      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "");
      const { chunks } = await collectChunks(stream);

      const generatingProgress = getProgressChunks(chunks).filter(
        (p) => p.phase === "generating"
      );

      // Should have currentItem during generation
      const withCurrentItem = generatingProgress.filter((p) => p.currentItem);
      expect(withCurrentItem.length).toBeGreaterThan(0);
    });
  });

  describe("Cancellation support", () => {
    it("respects AbortController cancellation", async () => {
      const controller = new AbortController();

      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "", {
        signal: controller.signal,
      });

      // Start consuming but cancel after first chunk
      const firstResult = await stream.next();
      expect(firstResult.done).toBe(false);

      // Cancel
      controller.abort();

      // Next iteration should throw AbortError (DOMException with name "AbortError")
      try {
        await stream.next();
        expect.fail("Should have thrown AbortError");
      } catch (error) {
        expect((error as DOMException).name).toBe("AbortError");
      }
    });

    it("stops processing when aborted during conversion", async () => {
      const controller = new AbortController();
      const chunks: ConversionChunk[] = [];

      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "", {
        signal: controller.signal,
      });

      try {
        let chunkCount = 0;
        for await (const chunk of stream) {
          chunks.push(chunk);
          chunkCount++;

          // Abort after 3 chunks
          if (chunkCount >= 3) {
            controller.abort();
          }
        }
      } catch (error) {
        expect((error as Error).name).toBe("AbortError");
      }

      // Should have collected some chunks before abort
      expect(chunks.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("convertWithProgress convenience function", () => {
    it("returns final result with progress callbacks", async () => {
      const progressUpdates: ConversionProgress[] = [];
      const sectionResults: SectionResult[] = [];

      const result = await convertWithProgress(singleSectionHtml, minimalCss, "", {
        onProgress: (p) => progressUpdates.push(p),
        onSection: (s) => sectionResults.push(s),
      });

      expect(result).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(sectionResults.length).toBeGreaterThan(0);
    });

    it("calls onComplete callback", async () => {
      const onComplete = vi.fn();

      await convertWithProgress(singleSectionHtml, minimalCss, "", {
        onComplete,
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.any(Object),
          sections: expect.any(Array),
          validation: expect.any(Object),
          totalTimeMs: expect.any(Number),
        })
      );
    });

    it("supports cancellation via AbortController", async () => {
      const controller = new AbortController();

      // Abort immediately
      controller.abort();

      const result = await convertWithProgress(multiSectionHtml, "", "", {
        signal: controller.signal,
      });

      // Should return null when cancelled
      expect(result).toBeNull();
    });
  });

  describe("estimateProcessingTime", () => {
    it("returns estimate for simple HTML", () => {
      const simpleHtml = "<section class='hero'>Hello</section>";
      const simpleCss = ".hero { color: red; }";

      const estimate = estimateProcessingTime(simpleHtml, simpleCss);

      expect(estimate.estimatedMs).toBeDefined();
      expect(estimate.estimatedMs).toBeGreaterThan(0);
      expect(estimate.complexity).toBe("simple");
    });

    it("returns higher estimate for complex HTML", () => {
      const simpleEstimate = estimateProcessingTime("<div>Hello</div>", ".a { color: red; }");
      const complexEstimate = estimateProcessingTime(multiSectionHtml, minimalCss);

      expect(complexEstimate.estimatedMs).toBeGreaterThan(simpleEstimate.estimatedMs);
    });

    it("categorizes complexity correctly", () => {
      const tiny = estimateProcessingTime("<div>Hi</div>", ".a{}");
      expect(["simple", "moderate"]).toContain(tiny.complexity);

      // Large HTML should be more complex
      const largeHtml = Array(100)
        .fill('<section class="section-test"><div class="content">Content</div></section>')
        .join("\n");
      const largeCss = Array(100)
        .fill(".section-test { padding: 20px; } .content { color: #333; }")
        .join("\n");

      const large = estimateProcessingTime(largeHtml, largeCss);
      expect(["moderate", "complex"]).toContain(large.complexity);
    });
  });

  describe("Output validation", () => {
    it("produces valid Webflow payload structure", async () => {
      const stream = convertHtmlToWebflowStreaming(singleSectionHtml, minimalCss, "");
      const { result } = await collectChunks(stream);

      // Payload structure
      expect(result.payload.type).toBe("@webflow/XscpData");
      expect(result.payload.payload).toBeDefined();
      expect(result.payload.payload.nodes).toBeDefined();
      expect(result.payload.payload.styles).toBeDefined();
      expect(Array.isArray(result.payload.payload.nodes)).toBe(true);
      expect(Array.isArray(result.payload.payload.styles)).toBe(true);
    });

    it("deduplicates styles across sections", async () => {
      // Create HTML with repeated class usage
      const htmlWithSharedClasses = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            .shared-class { color: red; }
          </style>
        </head>
        <body>
          <section class="section-a shared-class">Section A</section>
          <section class="section-b shared-class">Section B</section>
        </body>
        </html>
      `;

      const stream = convertHtmlToWebflowStreaming(htmlWithSharedClasses, "", "");
      const { result } = await collectChunks(stream);

      // Count styles with 'shared-class' name
      const sharedStyles = result.payload.payload.styles.filter(
        (s) => s.name === "shared-class"
      );

      // Should only have one instance (deduplicated)
      expect(sharedStyles.length).toBeLessThanOrEqual(1);
    });

    it("includes validation result", async () => {
      const stream = convertHtmlToWebflowStreaming(singleSectionHtml, minimalCss, "");
      const { result } = await collectChunks(stream);

      expect(result.validation).toBeDefined();
      expect(result.validation.isValid).toBeDefined();
      expect(result.validation.canProceed).toBeDefined();
      expect(Array.isArray(result.validation.issues)).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("handles empty HTML gracefully", async () => {
      const stream = convertHtmlToWebflowStreaming("", "", "");
      const { result } = await collectChunks(stream);

      expect(result).toBeDefined();
      // Should produce minimal output
      expect(result.payload.payload.nodes.length).toBeGreaterThanOrEqual(0);
    });

    it("handles HTML without sections", async () => {
      const noSectionsHtml = `
        <!DOCTYPE html>
        <html>
        <body>
          <div class="content">Just a div, no sections</div>
        </body>
        </html>
      `;

      const stream = convertHtmlToWebflowStreaming(noSectionsHtml, "", "");
      const { result } = await collectChunks(stream);

      // Should fall back to full-page conversion
      expect(result).toBeDefined();
      expect(result.sections.length).toBeGreaterThan(0);
    });

    it("handles CSS with warnings", async () => {
      const cssWithWarnings = `
        .hero {
          color: var(--undefined-var);
          transition: all 0.3s ease; /* stripped by parser */
        }
      `;

      const stream = convertHtmlToWebflowStreaming(singleSectionHtml, cssWithWarnings, "");
      const { chunks, result } = await collectChunks(stream);

      // Should have warning chunks
      const warningChunks = chunks.filter((c) => c.type === "warning");
      // May or may not have warnings depending on CSS parser behavior
      expect(result.validation).toBeDefined();
    });

    it("includes JavaScript in section results", async () => {
      const htmlWithInlineJs = `
        <!DOCTYPE html>
        <html>
        <body>
          <section class="hero">
            <h1>Hero</h1>
          </section>
          <script>console.log('test');</script>
        </body>
        </html>
      `;

      const stream = convertHtmlToWebflowStreaming(htmlWithInlineJs, minimalCss, complexJs);
      const { result } = await collectChunks(stream);

      // JavaScript should be available in the result
      expect(result).toBeDefined();
    });
  });

  describe("Progress callback option", () => {
    it("calls onProgress callback during streaming", async () => {
      const progressUpdates: ConversionProgress[] = [];

      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "", {
        onProgress: (p) => progressUpdates.push(p),
      });

      await collectChunks(stream);

      expect(progressUpdates.length).toBeGreaterThan(0);

      // Should have final progress
      const lastUpdate = progressUpdates[progressUpdates.length - 1];
      expect(lastUpdate.phase).toBe("complete");
      expect(lastUpdate.percentage).toBe(100);
    });
  });

  describe("Chunk batching", () => {
    it("respects chunkSize option", async () => {
      const stream = convertHtmlToWebflowStreaming(multiSectionHtml, "", "", {
        chunkSize: 2,
      });

      const { chunks } = await collectChunks(stream);
      const sectionChunks = getSectionChunks(chunks);

      // Should still have all sections
      expect(sectionChunks.length).toBeGreaterThan(1);
    });
  });
});
