/**
 * Actionable Report Generator
 *
 * Generates a clear, prioritized report focused on patterns across all tests.
 */

import fs from 'fs';
import path from 'path';
import type { CrossTestAnalysis, PropertyPattern } from '../diff/aggregator';
import { formatFrequency } from '../diff/aggregator';
import { AUDIT_CONFIG } from '../config';

/**
 * Generate the main actionable report
 */
export function generateActionableReport(analysis: CrossTestAnalysis): string {
  const lines: string[] = [];

  // Header
  lines.push('=' .repeat(70));
  lines.push('WEBFLOW PIPELINE AUDIT - CROSS-TEST ANALYSIS');
  lines.push('=' .repeat(70));
  lines.push('');
  lines.push(`Total tests analyzed: ${analysis.totalTests}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');

  // Executive Summary
  lines.push('-'.repeat(70));
  lines.push('EXECUTIVE SUMMARY');
  lines.push('-'.repeat(70));
  lines.push('');
  lines.push(`High Priority Issues (70%+ of tests):    ${analysis.highPriority.length} properties`);
  lines.push(`Medium Priority Issues (30-70% of tests): ${analysis.mediumPriority.length} properties`);
  lines.push(`Low Priority Issues (<30% of tests):      ${analysis.lowPriority.length} properties`);
  lines.push('');

  // High Priority - FIX THESE FIRST
  if (analysis.highPriority.length > 0) {
    lines.push('');
    lines.push('=' .repeat(70));
    lines.push('HIGH PRIORITY - FIX THESE FIRST (affects 70%+ of tests)');
    lines.push('=' .repeat(70));
    lines.push('');
    lines.push('These are SYSTEMIC issues in the pipeline. Fixing these will improve');
    lines.push('most or all test files.');
    lines.push('');

    for (const pattern of analysis.highPriority) {
      lines.push(...formatPropertyPattern(pattern, analysis.totalTests));
      lines.push('');
    }
  }

  // Medium Priority
  if (analysis.mediumPriority.length > 0) {
    lines.push('');
    lines.push('=' .repeat(70));
    lines.push('MEDIUM PRIORITY (affects 30-70% of tests)');
    lines.push('=' .repeat(70));
    lines.push('');
    lines.push('These affect a significant subset. May be conditional bugs or');
    lines.push('specific to certain CSS patterns.');
    lines.push('');

    for (const pattern of analysis.mediumPriority) {
      lines.push(...formatPropertyPattern(pattern, analysis.totalTests));
      lines.push('');
    }
  }

  // Low Priority
  if (analysis.lowPriority.length > 0) {
    lines.push('');
    lines.push('=' .repeat(70));
    lines.push('LOW PRIORITY (affects <30% of tests)');
    lines.push('=' .repeat(70));
    lines.push('');
    lines.push('Edge cases or file-specific issues. May not be worth fixing if they');
    lines.push('only affect one or two tests.');
    lines.push('');

    for (const pattern of analysis.lowPriority.slice(0, 20)) { // Limit to 20
      lines.push(...formatPropertyPatternCompact(pattern, analysis.totalTests));
    }
    if (analysis.lowPriority.length > 20) {
      lines.push(`  ... and ${analysis.lowPriority.length - 20} more low-priority properties`);
    }
    lines.push('');
  }

  // By Category Summary
  lines.push('');
  lines.push('=' .repeat(70));
  lines.push('SUMMARY BY CATEGORY');
  lines.push('=' .repeat(70));
  lines.push('');

  const categoryOrder = ['spacing', 'layout', 'positioning', 'sizing', 'typography',
                         'background', 'border', 'animation', 'overflow', 'other'];

  for (const category of categoryOrder) {
    const catData = analysis.byCategory.get(category);
    if (!catData || catData.removed.length === 0) continue;

    const highCount = catData.removed.filter(p => p.frequency >= 0.7).length;
    const totalCount = catData.removed.length;
    const indicator = highCount > 0 ? ' ⚠️ NEEDS ATTENTION' : '';

    lines.push(`${category.toUpperCase()}:${indicator}`);
    lines.push(`  ${totalCount} properties affected (${highCount} high priority)`);

    // List the high-priority ones
    const highProps = catData.removed.filter(p => p.frequency >= 0.7);
    if (highProps.length > 0) {
      lines.push(`  High priority: ${highProps.map(p => p.property).join(', ')}`);
    }
    lines.push('');
  }

  // Per-Test Summary
  lines.push('');
  lines.push('=' .repeat(70));
  lines.push('PER-TEST BREAKDOWN');
  lines.push('=' .repeat(70));
  lines.push('');

  const sortedTests = Array.from(analysis.perTest.entries())
    .sort((a, b) => b[1].removedCount - a[1].removedCount);

  for (const [testSlug, data] of sortedTests) {
    const uniqueNote = data.uniqueIssues.length > 0
      ? ` (${data.uniqueIssues.length} unique issues)`
      : '';
    lines.push(`${testSlug}: ${data.removedCount} removed, ${data.addedCount} added${uniqueNote}`);

    if (data.uniqueIssues.length > 0) {
      for (const issue of data.uniqueIssues.slice(0, 3)) {
        lines.push(`  - ${issue}`);
      }
      if (data.uniqueIssues.length > 3) {
        lines.push(`  - ... and ${data.uniqueIssues.length - 3} more unique issues`);
      }
    }
  }

  // Action Items
  lines.push('');
  lines.push('=' .repeat(70));
  lines.push('RECOMMENDED ACTION PLAN');
  lines.push('=' .repeat(70));
  lines.push('');

  if (analysis.highPriority.length > 0) {
    lines.push('1. START HERE - Fix high-priority systemic issues:');
    const topIssues = analysis.highPriority.slice(0, 5);
    for (const issue of topIssues) {
      lines.push(`   - ${issue.property} (${issue.category}): ${formatFrequency(issue.frequency, analysis.totalTests)}`);
    }
    lines.push('');
  }

  // Group high-priority by category for targeted fixes
  const highByCategory = new Map<string, PropertyPattern[]>();
  for (const p of analysis.highPriority) {
    if (!highByCategory.has(p.category)) {
      highByCategory.set(p.category, []);
    }
    highByCategory.get(p.category)!.push(p);
  }

  if (highByCategory.size > 0) {
    lines.push('2. Fix by category (check the relevant normalizer/literalizer code):');
    for (const [cat, props] of highByCategory) {
      lines.push(`   - ${cat}: ${props.map(p => p.property).join(', ')}`);
    }
    lines.push('');
  }

  lines.push('3. After fixing high-priority, re-run audit to verify improvements');
  lines.push('4. Then address medium-priority issues');
  lines.push('5. Low-priority issues may be acceptable trade-offs');
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a property pattern with full details
 */
function formatPropertyPattern(pattern: PropertyPattern, totalTests: number): string[] {
  const lines: string[] = [];

  lines.push(`▸ ${pattern.property.toUpperCase()} [${pattern.category}]`);
  lines.push(`  Frequency: ${formatFrequency(pattern.frequency, totalTests)}`);
  lines.push(`  Total occurrences: ${pattern.totalOccurrences}`);
  lines.push(`  Tests affected: ${pattern.testsAffected.join(', ')}`);

  if (pattern.examples.length > 0) {
    lines.push('  Examples:');
    for (const ex of pattern.examples.slice(0, 3)) {
      const val = ex.value ? `: ${ex.value}` : '';
      lines.push(`    - ${ex.selector}${val} (${ex.testSlug})`);
    }
  }

  return lines;
}

/**
 * Format a property pattern compactly
 */
function formatPropertyPatternCompact(pattern: PropertyPattern, totalTests: number): string[] {
  const affected = Math.round(pattern.frequency * totalTests);
  return [`  ${pattern.property}: ${affected}/${totalTests} tests (${pattern.testsAffected.join(', ')})`];
}

/**
 * Write report to file
 */
export function writeReport(analysis: CrossTestAnalysis): void {
  const report = generateActionableReport(analysis);
  const reportPath = path.join(AUDIT_CONFIG.outputDir, 'ANALYSIS.txt');

  // Ensure output dir exists
  if (!fs.existsSync(AUDIT_CONFIG.outputDir)) {
    fs.mkdirSync(AUDIT_CONFIG.outputDir, { recursive: true });
  }

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\nReport written to: ${reportPath}`);

  // Also print to console
  console.log('\n' + report);
}

/**
 * Legacy function for compatibility - generates simple summary
 */
export async function generateSummary(batch: { results: Array<{ testSlug: string; codeDiff?: { patch: string } }> }): Promise<void> {
  // This is now handled by the new analysis flow
  console.log('Summary generation moved to cross-test analysis');
}
