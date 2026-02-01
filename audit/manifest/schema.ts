/**
 * Manifest Schema Validation
 *
 * Uses Zod for runtime validation of test manifests.
 */

import { z } from 'zod';
import type { TestManifest } from '../types';

// Viewport dimensions schema
const ViewportDimensionsSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// Entry type enum
const EntryTypeSchema = z.enum(['single_html', 'split_files', 'codepen_dump']);

// Paths schema
const TestPathsSchema = z.object({
  html: z.string().min(1),
  css: z.string().optional(),
  js: z.string().optional(),
});

// Viewport overrides schema
const ViewportOverridesSchema = z
  .object({
    desktop: ViewportDimensionsSchema.optional(),
    tablet: ViewportDimensionsSchema.optional(),
    mobile: ViewportDimensionsSchema.optional(),
  })
  .optional();

// Expectations schema
const TestExpectationsSchema = z
  .object({
    maxDiffRatio: z.number().min(0).max(1).optional(),
    requiredClasses: z.array(z.string()).optional(),
  })
  .optional();

// Full manifest schema
export const TestManifestSchema = z.object({
  name: z.string().min(1),
  entryType: EntryTypeSchema,
  paths: TestPathsSchema,
  viewports: ViewportOverridesSchema,
  expectations: TestExpectationsSchema,
  tags: z.array(z.string()).optional(),
  skip: z.boolean().optional(),
});

/**
 * Validate a test manifest object
 */
export function validateManifest(data: unknown): TestManifest {
  return TestManifestSchema.parse(data);
}

/**
 * Safe validation that returns result object
 */
export function safeValidateManifest(data: unknown): {
  success: boolean;
  data?: TestManifest;
  error?: string;
} {
  const result = TestManifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
  };
}
