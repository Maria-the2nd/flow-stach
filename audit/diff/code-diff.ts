/**
 * Code Diff
 *
 * Computes and formats code differences between original and sanitized HTML.
 * Uses Prettier for formatting and unified diff for comparison.
 */

import * as prettier from 'prettier';
import { createTwoFilesPatch, diffLines } from 'diff';
import type { CodeDiffResult } from '../types';
import { PRETTIER_OPTIONS } from '../config';

/**
 * Format HTML using Prettier for consistent comparison
 */
async function formatHtml(html: string): Promise<string> {
  try {
    return await prettier.format(html, {
      parser: 'html',
      printWidth: PRETTIER_OPTIONS.printWidth,
      tabWidth: PRETTIER_OPTIONS.tabWidth,
      useTabs: PRETTIER_OPTIONS.useTabs,
    });
  } catch (err) {
    // If Prettier fails, return original (might have invalid HTML)
    console.warn('Prettier formatting failed, using original HTML');
    return html;
  }
}

/**
 * Compute unified diff between two HTML strings
 */
export function computeCodeDiff(
  originalHtml: string,
  sanitizedHtml: string
): CodeDiffResult {
  // Create unified patch
  const patch = createTwoFilesPatch(
    'original.html',
    'sanitized.html',
    originalHtml,
    sanitizedHtml,
    'Original',
    'Sanitized',
    { context: 3 }
  );

  // Count changes using line diff
  const lineDiff = diffLines(originalHtml, sanitizedHtml);

  let linesAdded = 0;
  let linesRemoved = 0;

  for (const part of lineDiff) {
    const lineCount = (part.value.match(/\n/g) || []).length;
    if (part.added) {
      linesAdded += lineCount;
    } else if (part.removed) {
      linesRemoved += lineCount;
    }
  }

  const hasChanges = linesAdded > 0 || linesRemoved > 0;

  return {
    patch,
    linesAdded,
    linesRemoved,
    hasChanges,
  };
}

/**
 * Compute formatted diff (prettier both sides first)
 */
export async function computeFormattedCodeDiff(
  originalHtml: string,
  sanitizedHtml: string
): Promise<CodeDiffResult> {
  const formattedOriginal = await formatHtml(originalHtml);
  const formattedSanitized = await formatHtml(sanitizedHtml);

  return computeCodeDiff(formattedOriginal, formattedSanitized);
}

/**
 * Extract changed CSS properties from diff
 */
export function extractCssChanges(patch: string): {
  added: string[];
  removed: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];

  const lines = patch.split('\n');

  for (const line of lines) {
    // Look for CSS property patterns
    const propertyMatch = line.match(/^([+-])\s*([a-z-]+)\s*:/i);
    if (propertyMatch) {
      const [, sign, property] = propertyMatch;
      if (sign === '+') {
        added.push(property);
      } else if (sign === '-') {
        removed.push(property);
      }
    }
  }

  return { added, removed };
}

/**
 * Extract changed class names from diff
 */
export function extractClassChanges(patch: string): {
  added: string[];
  removed: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];

  const lines = patch.split('\n');

  for (const line of lines) {
    // Look for class attribute patterns
    const classMatch = line.match(/^([+-]).*class="([^"]+)"/);
    if (classMatch) {
      const [, sign, classes] = classMatch;
      const classList = classes.split(/\s+/);

      if (sign === '+') {
        added.push(...classList);
      } else if (sign === '-') {
        removed.push(...classList);
      }
    }
  }

  // Deduplicate
  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
  };
}

/**
 * Get summary statistics from diff
 */
export function getDiffSummary(diff: CodeDiffResult): string {
  if (!diff.hasChanges) {
    return 'No changes detected';
  }

  const parts: string[] = [];

  if (diff.linesAdded > 0) {
    parts.push(`+${diff.linesAdded} lines`);
  }
  if (diff.linesRemoved > 0) {
    parts.push(`-${diff.linesRemoved} lines`);
  }

  return parts.join(', ');
}

/**
 * Extract only the changed hunks from a patch
 */
export function extractHunks(patch: string): string[] {
  const hunks: string[] = [];
  const lines = patch.split('\n');

  let currentHunk: string[] = [];
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (currentHunk.length > 0) {
        hunks.push(currentHunk.join('\n'));
      }
      currentHunk = [line];
      inHunk = true;
    } else if (inHunk) {
      if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff')) {
        if (currentHunk.length > 0) {
          hunks.push(currentHunk.join('\n'));
          currentHunk = [];
        }
        inHunk = false;
      } else {
        currentHunk.push(line);
      }
    }
  }

  if (currentHunk.length > 0) {
    hunks.push(currentHunk.join('\n'));
  }

  return hunks;
}
