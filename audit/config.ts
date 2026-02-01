/**
 * Batch Audit Harness - Configuration
 *
 * Central configuration for audit runs.
 */

import path from 'path';
import type { AuditConfig, ViewportDimensions } from './types';

// Project root (flow-stach)
export const PROJECT_ROOT = path.resolve(__dirname, '..');

// Default viewport dimensions
export const DEFAULT_VIEWPORTS: Record<string, ViewportDimensions> = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
};

// Default diff threshold (0-1, lower is stricter)
export const DEFAULT_DIFF_THRESHOLD = 0.05;

// Screenshot timeout in milliseconds
export const SCREENSHOT_TIMEOUT = 30000;

// Concurrency limit for batch processing
export const DEFAULT_CONCURRENCY = 3;

// Manifest file extension pattern
export const MANIFEST_PATTERN = '*.test.json';

// Full audit configuration
export const AUDIT_CONFIG: AuditConfig = {
  testsDir: path.join(PROJECT_ROOT, 'temp', 'tests'),
  outputDir: path.join(PROJECT_ROOT, 'temp', 'tests', '_out'),
  defaultViewports: DEFAULT_VIEWPORTS,
  defaultThreshold: DEFAULT_DIFF_THRESHOLD,
  screenshotTimeout: SCREENSHOT_TIMEOUT,
};

// Issue severity thresholds
export const SEVERITY_THRESHOLDS = {
  low: 0.01,    // < 1% diff
  medium: 0.05, // 1-5% diff
  high: 0.10,   // > 5% diff
};

// Pixelmatch options
export const PIXELMATCH_OPTIONS = {
  threshold: 0.1, // Pixel matching threshold
  includeAA: false, // Include anti-aliased pixels
};

// Prettier formatting options for code diff
export const PRETTIER_OPTIONS = {
  parser: 'html',
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
};
