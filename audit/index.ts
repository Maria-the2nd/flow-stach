#!/usr/bin/env node
/**
 * Webflow Pipeline Audit CLI
 *
 * Analyzes the HTML-to-Webflow pipeline to find patterns across test files.
 *
 * Usage:
 *   bun run audit:batch              # Analyze all tests
 *   bun run audit:single --only=slug # Analyze single test
 */

import { runBatchAnalysis, runSingleAnalysis } from './runner/batch-runner';
import type { CLIOptions } from './types';

/**
 * Parse command line arguments
 */
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};

  for (const arg of args) {
    if (arg.startsWith('--only=')) {
      options.only = arg.slice(7);
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.slice(9).split(',');
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Webflow Pipeline Audit - Cross-Test Analysis

Finds patterns across all test files to identify systemic issues
in the HTML-to-Webflow conversion pipeline.

Usage:
  bun run audit:batch                 # Analyze all tests
  bun run audit:single --only=slug    # Analyze single test

Options:
  --only=<slug>        Analyze single test by slug
  --filter=<tags>      Filter by tags (comma-separated)
  --verbose, -v        Verbose output
  --help, -h           Show this help

Output:
  temp/tests/_out/ANALYSIS.txt    Main analysis report
  temp/tests/_out/<slug>/
    ├── diff.patch                Code diff
    ├── original.html             Input HTML
    └── sanitized.html            Output HTML

The report shows:
  - HIGH PRIORITY: Issues in 70%+ of tests (systemic bugs)
  - MEDIUM PRIORITY: Issues in 30-70% of tests (conditional bugs)
  - LOW PRIORITY: Issues in <30% of tests (edge cases)
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║         WEBFLOW PIPELINE AUDIT - CROSS-TEST ANALYSIS            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    if (options.only) {
      await runSingleAnalysis(options.only, options);
    } else {
      await runBatchAnalysis(options);
    }
  } catch (err) {
    console.error('\n❌ Fatal error:', err);
    process.exit(1);
  }
}

// Run
main();
