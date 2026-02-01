/**
 * Batch Audit Harness - Type Definitions
 *
 * Central type definitions for the audit pipeline.
 */

// ============================================================================
// Manifest Types
// ============================================================================

export type EntryType = 'single_html' | 'split_files' | 'codepen_dump';

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface ViewportOverrides {
  desktop?: ViewportDimensions;
  tablet?: ViewportDimensions;
  mobile?: ViewportDimensions;
}

export interface TestPaths {
  html: string;
  css?: string;
  js?: string;
}

export interface TestExpectations {
  maxDiffRatio?: number;
  requiredClasses?: string[];
}

export interface TestManifest {
  name: string;
  entryType: EntryType;
  paths: TestPaths;
  viewports?: ViewportOverrides;
  expectations?: TestExpectations;
  tags?: string[];
  skip?: boolean;
}

// ============================================================================
// Diff & Classification Types
// ============================================================================

export type IssueCategory =
  | 'spacing_loss'
  | 'body_base_loss'
  | 'breakpoint_drift'
  | 'transform_animation'
  | 'positioning_drift'
  | 'typography_change'
  | 'layout_change'
  | 'unknown';

export interface ClassifiedIssue {
  category: IssueCategory;
  description: string;
  diffLines: string[];
  severity: 'low' | 'medium' | 'high';
}

export interface DiffStats {
  totalPixels: number;
  diffPixels: number;
  diffRatio: number;
  passThreshold: boolean;
}

export interface DiffSummary {
  viewport: string;
  stats: DiffStats;
  issues: ClassifiedIssue[];
}

export interface CodeDiffResult {
  patch: string;
  linesAdded: number;
  linesRemoved: number;
  hasChanges: boolean;
}

// ============================================================================
// Pipeline & Runner Types
// ============================================================================

export interface BundleResult {
  originalHtml: string;
  sanitizedHtml: string;
  originalBundlePath: string;
  sanitizedBundlePath: string;
}

export interface ScreenshotResult {
  viewport: string;
  originalPath: string;
  sanitizedPath: string;
  diffPath: string;
  stats: DiffStats;
}

export interface AuditResult {
  testSlug: string;
  manifestPath: string;
  manifest: TestManifest;
  success: boolean;
  error?: string;
  bundle?: BundleResult;
  screenshots?: ScreenshotResult[];
  codeDiff?: CodeDiffResult;
  issues?: ClassifiedIssue[];
  timestamp: string;
  duration: number;
}

export interface BatchResult {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  results: AuditResult[];
  timestamp: string;
  totalDuration: number;
}

// ============================================================================
// CLI Types
// ============================================================================

export interface CLIOptions {
  only?: string;
  filter?: string[];
  noScreenshots?: boolean;
  verbose?: boolean;
  concurrency?: number;
}

// ============================================================================
// Config Types
// ============================================================================

export interface AuditConfig {
  testsDir: string;
  outputDir: string;
  defaultViewports: Record<string, ViewportDimensions>;
  defaultThreshold: number;
  screenshotTimeout: number;
}
