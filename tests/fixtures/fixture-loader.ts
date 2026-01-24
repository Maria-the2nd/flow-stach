import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface WebflowPayload {
  type: "@webflow/XscpData";
  payload: {
    nodes: unknown[];
    styles: unknown[];
    assets: unknown[];
    ix1: unknown[];
    ix2: {
      interactions: unknown[];
      events: unknown[];
      actionLists: unknown[];
    };
  };
  embedCSS?: string;
  embedJS?: string;
  meta: {
    unlinkedSymbolCount: number;
    droppedLinks: number;
    dynBindRemovedCount: number;
    totalLinks: number;
    pageCount: number;
    inlineOnly: boolean;
    pasted: boolean;
    publishedToWebflow: boolean;
  };
}

export interface TestFixture {
  name: string;
  description: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  payload: WebflowPayload;
  expectedResult: {
    shouldBlock: boolean;
    shouldSanitize: boolean;
    sanitizationChanges?: string[];
    warnings?: string[];
  };
}

/**
 * Load a single test fixture from the fixtures directory
 */
export function loadFixture(category: string, filename: string): TestFixture {
  const fixturePath = join(__dirname, category, filename);
  const content = readFileSync(fixturePath, 'utf-8');
  return JSON.parse(content) as TestFixture;
}

/**
 * Load all fixtures from a category directory
 */
export function loadAllFixtures(category: string): TestFixture[] {
  const categoryPath = join(__dirname, category);
  const files = readdirSync(categoryPath).filter(f => f.endsWith('.json'));

  return files.map(filename => loadFixture(category, filename));
}

/**
 * Create a minimal valid WebflowPayload for testing
 */
export function createMinimalPayload(): WebflowPayload {
  return {
    type: "@webflow/XscpData",
    payload: {
      nodes: [],
      styles: [],
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
      totalLinks: 0,
      pageCount: 1,
      inlineOnly: true,
      pasted: true,
      publishedToWebflow: false,
    },
  };
}
