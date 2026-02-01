/**
 * Cross-Test Aggregator
 *
 * Finds patterns across all tests to identify systemic issues.
 */

import type { TestIssues, CssChange } from './classifier';
import { categorizeProperty } from './classifier';

export interface PropertyPattern {
  property: string;
  category: string;
  testsAffected: string[];
  totalOccurrences: number;
  frequency: number; // testsAffected.length / totalTests
  examples: Array<{
    testSlug: string;
    selector: string;
    value?: string;
  }>;
}

export interface SelectorPattern {
  selector: string;
  testsAffected: string[];
  frequency: number;
  action: 'removed' | 'added';
}

export interface CrossTestAnalysis {
  totalTests: number;

  // Properties removed across tests (sorted by frequency)
  removedProperties: PropertyPattern[];

  // Properties added across tests
  addedProperties: PropertyPattern[];

  // Selectors removed across tests
  removedSelectors: SelectorPattern[];

  // By category summary
  byCategory: Map<string, {
    removed: PropertyPattern[];
    added: PropertyPattern[];
  }>;

  // Priority buckets
  highPriority: PropertyPattern[];   // affects 70%+ of tests
  mediumPriority: PropertyPattern[]; // affects 30-70% of tests
  lowPriority: PropertyPattern[];    // affects <30% of tests

  // Per-test summaries
  perTest: Map<string, {
    removedCount: number;
    addedCount: number;
    uniqueIssues: string[]; // issues only in this test
  }>;
}

/**
 * Aggregate issues across all tests to find patterns
 */
export function aggregateAcrossTests(allTestIssues: TestIssues[]): CrossTestAnalysis {
  const totalTests = allTestIssues.length;

  // Collect all removed properties across tests
  const removedPropertyMap = new Map<string, {
    testsAffected: Set<string>;
    totalOccurrences: number;
    examples: Array<{ testSlug: string; selector: string; value?: string }>;
  }>();

  // Collect all added properties
  const addedPropertyMap = new Map<string, {
    testsAffected: Set<string>;
    totalOccurrences: number;
    examples: Array<{ testSlug: string; selector: string; value?: string }>;
  }>();

  // Collect removed selectors
  const removedSelectorMap = new Map<string, Set<string>>();

  // Process each test
  for (const testIssues of allTestIssues) {
    // Process CSS changes
    for (const change of testIssues.cssChanges) {
      const map = change.action === 'removed' ? removedPropertyMap : addedPropertyMap;

      if (!map.has(change.property)) {
        map.set(change.property, {
          testsAffected: new Set(),
          totalOccurrences: 0,
          examples: [],
        });
      }

      const entry = map.get(change.property)!;
      entry.testsAffected.add(testIssues.testSlug);
      entry.totalOccurrences++;

      // Keep up to 5 examples per property
      if (entry.examples.length < 5) {
        entry.examples.push({
          testSlug: testIssues.testSlug,
          selector: change.selector,
          value: change.originalValue || change.newValue,
        });
      }
    }

    // Process removed selectors
    for (const selector of testIssues.removedSelectors) {
      if (!removedSelectorMap.has(selector)) {
        removedSelectorMap.set(selector, new Set());
      }
      removedSelectorMap.get(selector)!.add(testIssues.testSlug);
    }
  }

  // Convert to sorted arrays
  const removedProperties = convertToPatterns(removedPropertyMap, totalTests);
  const addedProperties = convertToPatterns(addedPropertyMap, totalTests);

  const removedSelectors: SelectorPattern[] = Array.from(removedSelectorMap.entries())
    .map(([selector, tests]) => ({
      selector,
      testsAffected: Array.from(tests),
      frequency: tests.size / totalTests,
      action: 'removed' as const,
    }))
    .sort((a, b) => b.frequency - a.frequency);

  // Group by category
  const byCategory = new Map<string, { removed: PropertyPattern[]; added: PropertyPattern[] }>();
  for (const prop of removedProperties) {
    const cat = prop.category;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { removed: [], added: [] });
    }
    byCategory.get(cat)!.removed.push(prop);
  }
  for (const prop of addedProperties) {
    const cat = prop.category;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, { removed: [], added: [] });
    }
    byCategory.get(cat)!.added.push(prop);
  }

  // Priority buckets (based on removed properties - these are the problems)
  const highPriority = removedProperties.filter(p => p.frequency >= 0.7);
  const mediumPriority = removedProperties.filter(p => p.frequency >= 0.3 && p.frequency < 0.7);
  const lowPriority = removedProperties.filter(p => p.frequency < 0.3);

  // Per-test analysis
  const perTest = new Map<string, {
    removedCount: number;
    addedCount: number;
    uniqueIssues: string[];
  }>();

  for (const testIssues of allTestIssues) {
    const uniqueIssues: string[] = [];

    // Find properties only removed in this test
    for (const [prop, count] of testIssues.removedProperties) {
      const globalEntry = removedPropertyMap.get(prop);
      if (globalEntry && globalEntry.testsAffected.size === 1) {
        uniqueIssues.push(`${prop} (unique removal)`);
      }
    }

    perTest.set(testIssues.testSlug, {
      removedCount: testIssues.cssChanges.filter(c => c.action === 'removed').length,
      addedCount: testIssues.cssChanges.filter(c => c.action === 'added').length,
      uniqueIssues,
    });
  }

  return {
    totalTests,
    removedProperties,
    addedProperties,
    removedSelectors,
    byCategory,
    highPriority,
    mediumPriority,
    lowPriority,
    perTest,
  };
}

/**
 * Convert map to sorted pattern array
 */
function convertToPatterns(
  map: Map<string, {
    testsAffected: Set<string>;
    totalOccurrences: number;
    examples: Array<{ testSlug: string; selector: string; value?: string }>;
  }>,
  totalTests: number
): PropertyPattern[] {
  return Array.from(map.entries())
    .map(([property, data]) => ({
      property,
      category: categorizeProperty(property),
      testsAffected: Array.from(data.testsAffected),
      totalOccurrences: data.totalOccurrences,
      frequency: data.testsAffected.size / totalTests,
      examples: data.examples,
    }))
    .sort((a, b) => {
      // Sort by frequency first, then by total occurrences
      if (b.frequency !== a.frequency) {
        return b.frequency - a.frequency;
      }
      return b.totalOccurrences - a.totalOccurrences;
    });
}

/**
 * Format frequency as percentage
 */
export function formatFrequency(frequency: number, totalTests: number): string {
  const affected = Math.round(frequency * totalTests);
  return `${affected}/${totalTests} tests (${(frequency * 100).toFixed(0)}%)`;
}
