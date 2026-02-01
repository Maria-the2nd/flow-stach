/**
 * Batch Runner - Smart Analysis
 *
 * Analyzes what's TRULY lost vs what's correctly transformed to BEM.
 */

import fs from 'fs';
import path from 'path';
import type { CLIOptions } from '../types';
import { AUDIT_CONFIG } from '../config';
import {
  loadAllManifests,
  loadManifestBySlug,
  filterManifestsByTags,
  filterSkipped,
  type LoadedManifest,
} from '../manifest/loader';
import {
  assembleBundle,
  createHtmlBundle,
  ensureOutputDir,
} from './bundle-assembler';
import { runPipeline } from './pipeline-executor';
import {
  analyzeTransformation,
  aggregateTrulyLost,
  type AnalysisResult,
} from '../diff/smart-analyzer';

/**
 * Run smart analysis on a single test
 */
async function analyzeTest(manifest: LoadedManifest): Promise<AnalysisResult | null> {
  try {
    // 1. Assemble bundle from manifest
    const bundle = assembleBundle({
      manifestPath: manifest.filePath,
      manifest: manifest.manifest,
      slug: manifest.slug,
    });

    if (bundle.error) {
      console.log(`✗ ${bundle.error}`);
      return null;
    }

    // 2. Create HTML bundle
    const originalHtml = createHtmlBundle(
      bundle.html,
      bundle.css,
      bundle.js,
      manifest.manifest.name
    );

    // 3. Run pipeline
    const pipelineResult = runPipeline({
      html: originalHtml,
      css: bundle.css,
      js: bundle.js,
    });

    // 4. Smart analysis
    const analysis = analyzeTransformation(
      manifest.slug,
      originalHtml,
      pipelineResult.sanitizedHtml
    );

    // 5. Save files for reference
    const outputDir = path.join(AUDIT_CONFIG.outputDir, manifest.slug);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(path.join(outputDir, 'original.html'), originalHtml, 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'sanitized.html'), pipelineResult.sanitizedHtml, 'utf-8');
    fs.writeFileSync(path.join(outputDir, 'analysis.json'), JSON.stringify(analysis, null, 2), 'utf-8');

    return analysis;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`✗ ${message}`);
    return null;
  }
}

/**
 * Generate smart report
 */
function generateSmartReport(results: AnalysisResult[]): string {
  const lines: string[] = [];

  // Header
  lines.push('═'.repeat(70));
  lines.push('WEBFLOW PIPELINE AUDIT - SMART ANALYSIS');
  lines.push('═'.repeat(70));
  lines.push('');
  lines.push('This analysis distinguishes between:');
  lines.push('  ✅ PRESERVED - Properties transformed to BEM classes (working correctly)');
  lines.push('  ❌ TRULY LOST - Properties that have NO equivalent in output');
  lines.push('');

  // Overall stats
  let totalOriginal = 0;
  let totalPreserved = 0;
  let totalLost = 0;

  for (const r of results) {
    totalOriginal += r.summary.totalOriginalProperties;
    totalPreserved += r.summary.preservedCount;
    totalLost += r.summary.trulyLostCount;
  }

  const overallRate = totalOriginal > 0 ? (totalPreserved / totalOriginal * 100).toFixed(1) : '100';

  lines.push('─'.repeat(70));
  lines.push('OVERALL SUMMARY');
  lines.push('─'.repeat(70));
  lines.push(`Total CSS properties analyzed: ${totalOriginal}`);
  lines.push(`Properties preserved (as BEM): ${totalPreserved} ✅`);
  lines.push(`Properties TRULY lost:         ${totalLost} ❌`);
  lines.push(`Preservation rate:             ${overallRate}%`);
  lines.push('');

  // Per-test breakdown
  lines.push('─'.repeat(70));
  lines.push('PER-TEST PRESERVATION RATES');
  lines.push('─'.repeat(70));

  const sortedResults = [...results].sort((a, b) =>
    a.summary.preservationRate - b.summary.preservationRate
  );

  for (const r of sortedResults) {
    const rate = (r.summary.preservationRate * 100).toFixed(1);
    const status = r.summary.preservationRate >= 0.9 ? '✅' : r.summary.preservationRate >= 0.7 ? '⚠️' : '❌';
    lines.push(`${status} ${r.testSlug}: ${rate}% (${r.summary.preservedCount}/${r.summary.totalOriginalProperties} preserved, ${r.summary.trulyLostCount} lost)`);
  }
  lines.push('');

  // Aggregate truly lost properties
  const trulyLostAggregated = aggregateTrulyLost(results);

  if (trulyLostAggregated.length === 0) {
    lines.push('═'.repeat(70));
    lines.push('🎉 NO PROPERTIES TRULY LOST!');
    lines.push('═'.repeat(70));
    lines.push('All CSS properties are being preserved as BEM classes.');
    lines.push('');
  } else {
    lines.push('═'.repeat(70));
    lines.push('TRULY LOST PROPERTIES - THESE NEED ATTENTION');
    lines.push('═'.repeat(70));
    lines.push('');
    lines.push('These properties exist in the original but have NO equivalent in the');
    lines.push('sanitized output. They need to be handled by the normalizer/literalizer.');
    lines.push('');

    // Group by frequency
    const highFreq = trulyLostAggregated.filter(p => p.testsAffected.length >= results.length * 0.7);
    const medFreq = trulyLostAggregated.filter(p =>
      p.testsAffected.length >= results.length * 0.3 &&
      p.testsAffected.length < results.length * 0.7
    );
    const lowFreq = trulyLostAggregated.filter(p => p.testsAffected.length < results.length * 0.3);

    if (highFreq.length > 0) {
      lines.push('🔴 HIGH PRIORITY (70%+ of tests):');
      lines.push('');
      for (const prop of highFreq) {
        lines.push(`  ${prop.property}: ${prop.testsAffected.length}/${results.length} tests, ${prop.totalOccurrences} occurrences`);
        for (const ex of prop.examples) {
          lines.push(`    └─ ${ex.selector} { ${prop.property}: ${ex.value} } (${ex.test})`);
        }
        lines.push('');
      }
    }

    if (medFreq.length > 0) {
      lines.push('🟡 MEDIUM PRIORITY (30-70% of tests):');
      lines.push('');
      for (const prop of medFreq) {
        lines.push(`  ${prop.property}: ${prop.testsAffected.length}/${results.length} tests`);
        if (prop.examples.length > 0) {
          const ex = prop.examples[0];
          lines.push(`    └─ e.g., ${ex.selector} { ${prop.property}: ${ex.value} }`);
        }
      }
      lines.push('');
    }

    if (lowFreq.length > 0) {
      lines.push('🟢 LOW PRIORITY (<30% of tests):');
      lines.push('');
      for (const prop of lowFreq.slice(0, 15)) {
        lines.push(`  ${prop.property}: ${prop.testsAffected.length}/${results.length} tests (${prop.testsAffected.join(', ')})`);
      }
      if (lowFreq.length > 15) {
        lines.push(`  ... and ${lowFreq.length - 15} more`);
      }
      lines.push('');
    }
  }

  // Selector mappings (to show BEM conversions are working)
  const allMappings = new Map<string, string>();
  for (const r of results) {
    for (const m of r.selectorMappings) {
      if (!allMappings.has(m.original)) {
        allMappings.set(m.original, m.bem);
      }
    }
  }

  if (allMappings.size > 0) {
    lines.push('─'.repeat(70));
    lines.push('BEM SELECTOR MAPPINGS (working correctly)');
    lines.push('─'.repeat(70));
    lines.push('');
    for (const [original, bem] of allMappings) {
      lines.push(`  ${original} → ${bem}`);
    }
    lines.push('');
  }

  // Variable resolutions
  const allVars = new Map<string, { value: string; count: number }>();
  for (const r of results) {
    for (const v of r.variableResolutions) {
      const existing = allVars.get(v.variable);
      if (existing) {
        existing.count += v.occurrences;
      } else {
        allVars.set(v.variable, { value: v.value, count: v.occurrences });
      }
    }
  }

  if (allVars.size > 0) {
    lines.push('─'.repeat(70));
    lines.push('CSS VARIABLE RESOLUTIONS (working correctly)');
    lines.push('─'.repeat(70));
    lines.push('');
    const sortedVars = Array.from(allVars.entries()).sort((a, b) => b[1].count - a[1].count);
    for (const [varName, data] of sortedVars.slice(0, 20)) {
      lines.push(`  ${varName} → ${data.value} (${data.count}x)`);
    }
    if (sortedVars.length > 20) {
      lines.push(`  ... and ${sortedVars.length - 20} more variables`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Run batch analysis
 */
export async function runBatchAnalysis(options: CLIOptions = {}): Promise<void> {
  console.log('🔍 Starting smart analysis...\n');

  ensureOutputDir();

  const loadResult = loadAllManifests();
  if (loadResult.errors.length > 0) {
    console.error('⚠️  Manifest load errors:');
    for (const err of loadResult.errors) {
      console.error(`   ${err.filePath}: ${err.error}`);
    }
  }

  let manifests = loadResult.manifests;
  if (options.filter && options.filter.length > 0) {
    manifests = filterManifestsByTags(manifests, options.filter);
  }

  const { active, skipped } = filterSkipped(manifests);
  console.log(`Found ${active.length} tests to analyze\n`);

  if (active.length === 0) {
    console.log('No tests to analyze.');
    return;
  }

  const results: AnalysisResult[] = [];

  for (const manifest of active) {
    process.stdout.write(`  Analyzing ${manifest.slug}... `);
    const result = await analyzeTest(manifest);
    if (result) {
      results.push(result);
      const rate = (result.summary.preservationRate * 100).toFixed(0);
      console.log(`✓ ${rate}% preserved (${result.summary.trulyLostCount} truly lost)`);
    }
  }

  console.log('\nGenerating report...\n');

  const report = generateSmartReport(results);

  // Write report
  const reportPath = path.join(AUDIT_CONFIG.outputDir, 'SMART_ANALYSIS.txt');
  fs.writeFileSync(reportPath, report, 'utf-8');

  console.log(report);
  console.log(`\nReport saved to: ${reportPath}`);
}

/**
 * Run single test analysis
 */
export async function runSingleAnalysis(slug: string, options: CLIOptions = {}): Promise<void> {
  const manifest = loadManifestBySlug(slug);
  if (!manifest) {
    console.error(`Test not found: ${slug}`);
    return;
  }

  ensureOutputDir();
  console.log(`Analyzing ${slug}...\n`);

  const result = await analyzeTest(manifest);
  if (result) {
    console.log(`Preservation rate: ${(result.summary.preservationRate * 100).toFixed(1)}%`);
    console.log(`Properties preserved: ${result.summary.preservedCount}`);
    console.log(`Properties truly lost: ${result.summary.trulyLostCount}`);

    if (result.trulyLost.length > 0) {
      console.log('\nTruly lost properties:');
      for (const lost of result.trulyLost.slice(0, 20)) {
        console.log(`  ${lost.selector} { ${lost.property}: ${lost.value} }`);
      }
      if (result.trulyLost.length > 20) {
        console.log(`  ... and ${result.trulyLost.length - 20} more`);
      }
    }
  }
}

// Legacy exports
export async function runBatchAudit(options: CLIOptions = {}): Promise<any> {
  await runBatchAnalysis(options);
  return { results: [], totalTests: 0, passed: 0, failed: 0, skipped: 0 };
}

export async function runSingleTest(slug: string, options: CLIOptions = {}): Promise<any> {
  await runSingleAnalysis(slug, options);
  return null;
}
