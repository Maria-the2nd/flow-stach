/**
 * Unified Validation Severity System
 *
 * Standardized error levels across all Flow Stach validators to provide
 * consistent severity classification and user messaging.
 */

// ============================================
// SEVERITY ENUM
// ============================================

/**
 * Standard validation severity levels.
 *
 * FATAL - Blocks conversion entirely (unrecoverable issues)
 * ERROR - Conversion proceeds but paste will likely fail
 * WARNING - Conversion proceeds, paste works but issues may exist
 * INFO - Informational only, no action required
 */
export enum ValidationSeverity {
  /** Blocks conversion entirely - unrecoverable issues */
  FATAL = 'fatal',
  /** Conversion proceeds but paste will likely fail */
  ERROR = 'error',
  /** Conversion proceeds, paste works but issues may exist */
  WARNING = 'warning',
  /** Informational only, no action required */
  INFO = 'info',
}

// ============================================
// VALIDATION ISSUE INTERFACE
// ============================================

/**
 * Standard validation issue structure used across all validators.
 */
export interface ValidationIssue {
  /** Severity level of this issue */
  severity: ValidationSeverity;
  /** Issue code for programmatic handling (e.g., 'DUPLICATE_UUID', 'ORPHAN_REFERENCE') */
  code: string;
  /** Human-readable message describing the issue */
  message: string;
  /** Optional context (e.g., node ID, selector, line number) */
  context?: string;
  /** Optional suggested fix or action */
  suggestion?: string;
  /** Optional line number where issue was detected */
  lineNumber?: number;
  /** Optional file or section where issue occurred */
  location?: string;
}

// ============================================
// VALIDATION RESULT INTERFACE
// ============================================

/**
 * Standard validation result structure.
 */
export interface ValidationResult {
  /** Whether the validation passed (no FATAL or ERROR issues) */
  isValid: boolean;
  /** Whether to proceed with conversion (no FATAL issues) */
  canProceed: boolean;
  /** All detected issues */
  issues: ValidationIssue[];
  /** Summary message */
  summary: string;
}

// ============================================
// ISSUE CODES - FATAL
// ============================================

/**
 * Issue codes for FATAL severity (blocks conversion).
 */
export const FatalIssueCodes = {
  /** Duplicate UUIDs in Webflow output - causes unrecoverable project corruption */
  DUPLICATE_UUID: 'DUPLICATE_UUID',
  /** Circular node references - causes infinite loops in Webflow */
  CIRCULAR_REFERENCE: 'CIRCULAR_REFERENCE',
  /** Invalid JSON structure - cannot be parsed */
  INVALID_JSON: 'INVALID_JSON',
  /** Invalid payload structure - missing required fields */
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  /** Excessive nesting depth (>50 levels) causes Webflow Designer crash */
  EXCESSIVE_DEPTH: 'EXCESSIVE_DEPTH',
  /** Multiple root nodes - Webflow paste requires exactly one root element */
  MULTIPLE_ROOTS: 'MULTIPLE_ROOTS',
} as const;

// ============================================
// ISSUE CODES - ERROR
// ============================================

/**
 * Issue codes for ERROR severity (paste may fail).
 */
export const ErrorIssueCodes = {
  /** Orphan node references - children array references non-existent nodes */
  ORPHAN_REFERENCE: 'ORPHAN_REFERENCE',
  /** Relative asset URLs - cannot be loaded in Webflow */
  RELATIVE_ASSET: 'RELATIVE_ASSET',
  /** Relative external resource (script/stylesheet) - cannot be loaded */
  RELATIVE_RESOURCE: 'RELATIVE_RESOURCE',
  /** JavaScript references HTML element ID that doesn't exist */
  ORPHAN_ID_REFERENCE: 'ORPHAN_ID_REFERENCE',
  /** Node structure error - invalid type/tag combination */
  NODE_STRUCTURE_ERROR: 'NODE_STRUCTURE_ERROR',
  /** Invalid UUID format */
  INVALID_UUID_FORMAT: 'INVALID_UUID_FORMAT',
  /** Text node has children (must be leaf nodes) */
  TEXT_NODE_HAS_CHILDREN: 'TEXT_NODE_HAS_CHILDREN',
  /** Embed exceeds Webflow size limit */
  EMBED_SIZE_EXCEEDED: 'EMBED_SIZE_EXCEEDED',
  /** Nested form elements - invalid HTML that breaks form submission */
  NESTED_FORM: 'NESTED_FORM',
  /** Invalid variant key (unknown breakpoint or state) - causes [PersistentUIState] error */
  INVALID_VARIANT_KEY: 'INVALID_VARIANT_KEY',
  /** Reserved Webflow class name (w-*) used - conflicts with webflow.js */
  RESERVED_CLASS_NAME: 'RESERVED_CLASS_NAME',
  /** Ghost variant key - references non-existent node ID */
  GHOST_VARIANT_KEY: 'GHOST_VARIANT_KEY',
  /** Orphan interaction target - ix2 references non-existent node */
  ORPHAN_INTERACTION_TARGET: 'ORPHAN_INTERACTION_TARGET',
  /** Orphan asset reference - node references non-existent asset */
  ORPHAN_ASSET_REFERENCE: 'ORPHAN_ASSET_REFERENCE',
  /** Orphan child reference - children array contains non-existent node ID (FATAL level) */
  ORPHAN_CHILD_REFERENCE: 'ORPHAN_CHILD_REFERENCE',
} as const;

// ============================================
// ISSUE CODES - WARNING
// ============================================

/**
 * Issue codes for WARNING severity (paste works but issues exist).
 */
export const WarningIssueCodes = {
  /** Missing alt attribute on image */
  MISSING_ALT: 'MISSING_ALT',
  /** PX units used (if not converted to rem) */
  PX_UNITS: 'PX_UNITS',
  /** Non-standard breakpoint detected */
  NONSTANDARD_BREAKPOINT: 'NONSTANDARD_BREAKPOINT',
  /** Large embed size approaching limit */
  EMBED_SIZE_LARGE: 'EMBED_SIZE_LARGE',
  /** External CDN resource needs manual addition */
  EXTERNAL_CDN_RESOURCE: 'EXTERNAL_CDN_RESOURCE',
  /** JavaScript references HTML class that doesn't exist */
  ORPHAN_CLASS_REFERENCE: 'ORPHAN_CLASS_REFERENCE',
  /** Canvas/WebGL code without proper container */
  MISSING_CANVAS_CONTAINER: 'MISSING_CANVAS_CONTAINER',
  /** Club GreenSock (paid) plugin detected */
  PAID_PLUGIN_REQUIRED: 'PAID_PLUGIN_REQUIRED',
  /** Invalid style declaration */
  INVALID_STYLE: 'INVALID_STYLE',
  /** Missing style reference */
  MISSING_STYLE_REF: 'MISSING_STYLE_REF',
  /** Reserved Webflow class name (w-*) used - conflicts with webflow.js */
  RESERVED_CLASS_NAME: 'RESERVED_CLASS_NAME',
  /** Protocol-relative URL upgraded to HTTPS */
  PROTOCOL_RELATIVE_URL: 'PROTOCOL_RELATIVE_URL',
  /** Data URI detected - requires conversion */
  DATA_URI_DETECTED: 'DATA_URI_DETECTED',
  /** Large data URI detected */
  LARGE_DATA_URI: 'LARGE_DATA_URI',
  /** Unreachable nodes (not connected to root) */
  UNREACHABLE_NODE: 'UNREACHABLE_NODE',
  /** Node structure warning */
  NODE_STRUCTURE_WARNING: 'NODE_STRUCTURE_WARNING',
  /** Empty link without accessible text */
  EMPTY_LINK: 'EMPTY_LINK',
  /** Block element inside inline element */
  INVALID_NESTING: 'INVALID_NESTING',
  /** Ghost variant was stripped and removed */
  GHOST_VARIANT_STRIPPED: 'GHOST_VARIANT_STRIPPED',
  /** Interaction was extracted to JS embed due to invalid references */
  INTERACTION_EXTRACTED_TO_EMBED: 'INTERACTION_EXTRACTED_TO_EMBED',
  /** CSS was extracted to embed due to unsupported features */
  CSS_EXTRACTED_TO_EMBED: 'CSS_EXTRACTED_TO_EMBED',
  /** Asset reference was orphaned but non-critical */
  ORPHAN_ASSET_WARNING: 'ORPHAN_ASSET_WARNING',
} as const;

// ============================================
// ISSUE CODES - INFO
// ============================================

/**
 * Issue codes for INFO severity (informational only).
 */
export const InfoIssueCodes = {
  /** AI fallback was used for conversion */
  AI_FALLBACK_USED: 'AI_FALLBACK_USED',
  /** External library detected and will be injected */
  LIBRARY_DETECTED: 'LIBRARY_DETECTED',
  /** Class name was renamed for Webflow compatibility */
  CLASS_RENAMED: 'CLASS_RENAMED',
  /** CSS variable was resolved */
  CSS_VAR_RESOLVED: 'CSS_VAR_RESOLVED',
  /** Dynamic JS reference skipped (template literal/variable) */
  DYNAMIC_REFERENCE_SKIPPED: 'DYNAMIC_REFERENCE_SKIPPED',
  /** Deprecated HTML element detected */
  DEPRECATED_ELEMENT: 'DEPRECATED_ELEMENT',
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create a validation issue with standard structure.
 */
export function createIssue(
  severity: ValidationSeverity,
  code: string,
  message: string,
  options?: {
    context?: string;
    suggestion?: string;
    lineNumber?: number;
    location?: string;
  }
): ValidationIssue {
  return {
    severity,
    code,
    message,
    ...options,
  };
}

/**
 * Create a FATAL issue.
 */
export function fatal(code: string, message: string, options?: Omit<ValidationIssue, 'severity' | 'code' | 'message'>): ValidationIssue {
  return createIssue(ValidationSeverity.FATAL, code, message, options);
}

/**
 * Create an ERROR issue.
 */
export function error(code: string, message: string, options?: Omit<ValidationIssue, 'severity' | 'code' | 'message'>): ValidationIssue {
  return createIssue(ValidationSeverity.ERROR, code, message, options);
}

/**
 * Create a WARNING issue.
 */
export function warning(code: string, message: string, options?: Omit<ValidationIssue, 'severity' | 'code' | 'message'>): ValidationIssue {
  return createIssue(ValidationSeverity.WARNING, code, message, options);
}

/**
 * Create an INFO issue.
 */
export function info(code: string, message: string, options?: Omit<ValidationIssue, 'severity' | 'code' | 'message'>): ValidationIssue {
  return createIssue(ValidationSeverity.INFO, code, message, options);
}

/**
 * Check if any issues block conversion (FATAL level).
 */
export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some(i => i.severity === ValidationSeverity.FATAL);
}

/**
 * Check if any issues will cause paste failure (FATAL or ERROR level).
 */
export function hasFailureIssues(issues: ValidationIssue[]): boolean {
  return issues.some(i => i.severity === ValidationSeverity.FATAL || i.severity === ValidationSeverity.ERROR);
}

/**
 * Get issues filtered by severity.
 */
export function getIssuesBySeverity(issues: ValidationIssue[], severity: ValidationSeverity): ValidationIssue[] {
  return issues.filter(i => i.severity === severity);
}

/**
 * Get all FATAL issues.
 */
export function getFatalIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return getIssuesBySeverity(issues, ValidationSeverity.FATAL);
}

/**
 * Get all ERROR issues.
 */
export function getErrorIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return getIssuesBySeverity(issues, ValidationSeverity.ERROR);
}

/**
 * Get all WARNING issues.
 */
export function getWarningIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return getIssuesBySeverity(issues, ValidationSeverity.WARNING);
}

/**
 * Get all INFO issues.
 */
export function getInfoIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return getIssuesBySeverity(issues, ValidationSeverity.INFO);
}

/**
 * Count issues by severity.
 */
export function countBySeverity(issues: ValidationIssue[]): Record<ValidationSeverity, number> {
  return {
    [ValidationSeverity.FATAL]: issues.filter(i => i.severity === ValidationSeverity.FATAL).length,
    [ValidationSeverity.ERROR]: issues.filter(i => i.severity === ValidationSeverity.ERROR).length,
    [ValidationSeverity.WARNING]: issues.filter(i => i.severity === ValidationSeverity.WARNING).length,
    [ValidationSeverity.INFO]: issues.filter(i => i.severity === ValidationSeverity.INFO).length,
  };
}

/**
 * Create a validation result from issues.
 */
export function createValidationResult(issues: ValidationIssue[], customSummary?: string): ValidationResult {
  const counts = countBySeverity(issues);
  const canProceed = counts[ValidationSeverity.FATAL] === 0;
  const isValid = canProceed && counts[ValidationSeverity.ERROR] === 0;

  let summary = customSummary;
  if (!summary) {
    if (issues.length === 0) {
      summary = 'All validations passed';
    } else {
      const parts: string[] = [];
      if (counts[ValidationSeverity.FATAL] > 0) {
        parts.push(`${counts[ValidationSeverity.FATAL]} fatal`);
      }
      if (counts[ValidationSeverity.ERROR] > 0) {
        parts.push(`${counts[ValidationSeverity.ERROR]} error${counts[ValidationSeverity.ERROR] > 1 ? 's' : ''}`);
      }
      if (counts[ValidationSeverity.WARNING] > 0) {
        parts.push(`${counts[ValidationSeverity.WARNING]} warning${counts[ValidationSeverity.WARNING] > 1 ? 's' : ''}`);
      }
      if (counts[ValidationSeverity.INFO] > 0) {
        parts.push(`${counts[ValidationSeverity.INFO]} info`);
      }
      summary = parts.join(', ');
    }
  }

  return {
    isValid,
    canProceed,
    issues,
    summary,
  };
}

/**
 * Format issues for display.
 */
export function formatIssues(issues: ValidationIssue[]): string {
  if (issues.length === 0) {
    return 'No issues detected';
  }

  const lines: string[] = [];
  const severityOrder = [ValidationSeverity.FATAL, ValidationSeverity.ERROR, ValidationSeverity.WARNING, ValidationSeverity.INFO];
  const severityEmoji: Record<ValidationSeverity, string> = {
    [ValidationSeverity.FATAL]: '🚫',
    [ValidationSeverity.ERROR]: '❌',
    [ValidationSeverity.WARNING]: '⚠️',
    [ValidationSeverity.INFO]: 'ℹ️',
  };
  const severityLabel: Record<ValidationSeverity, string> = {
    [ValidationSeverity.FATAL]: 'FATAL',
    [ValidationSeverity.ERROR]: 'ERROR',
    [ValidationSeverity.WARNING]: 'WARNING',
    [ValidationSeverity.INFO]: 'INFO',
  };

  for (const severity of severityOrder) {
    const severityIssues = issues.filter(i => i.severity === severity);
    if (severityIssues.length === 0) continue;

    lines.push(`\n${severityEmoji[severity]} ${severityLabel[severity]} (${severityIssues.length}):`);
    for (const issue of severityIssues) {
      let line = `  - ${issue.message}`;
      if (issue.context) {
        line += ` [${issue.context}]`;
      }
      if (issue.lineNumber) {
        line += ` (line ${issue.lineNumber})`;
      }
      lines.push(line);
      if (issue.suggestion) {
        lines.push(`    → ${issue.suggestion}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Get severity level from numeric priority (for sorting).
 * Lower number = higher priority (more severe).
 */
export function getSeverityPriority(severity: ValidationSeverity): number {
  switch (severity) {
    case ValidationSeverity.FATAL: return 0;
    case ValidationSeverity.ERROR: return 1;
    case ValidationSeverity.WARNING: return 2;
    case ValidationSeverity.INFO: return 3;
    default: return 4;
  }
}

/**
 * Sort issues by severity (most severe first).
 */
export function sortBySeverity(issues: ValidationIssue[]): ValidationIssue[] {
  return [...issues].sort((a, b) => getSeverityPriority(a.severity) - getSeverityPriority(b.severity));
}

/**
 * Merge multiple validation results into one.
 */
export function mergeValidationResults(results: ValidationResult[]): ValidationResult {
  const allIssues = results.flatMap(r => r.issues);
  return createValidationResult(allIssues);
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

/**
 * Convert legacy 'error' | 'warning' severity to ValidationSeverity.
 * For backward compatibility with existing validators.
 */
export function fromLegacySeverity(legacy: 'error' | 'warning' | 'info'): ValidationSeverity {
  switch (legacy) {
    case 'error': return ValidationSeverity.ERROR;
    case 'warning': return ValidationSeverity.WARNING;
    case 'info': return ValidationSeverity.INFO;
    default: return ValidationSeverity.WARNING;
  }
}

/**
 * Convert ValidationSeverity to legacy 'error' | 'warning' format.
 * For backward compatibility with existing validators.
 */
export function toLegacySeverity(severity: ValidationSeverity): 'error' | 'warning' | 'info' {
  switch (severity) {
    case ValidationSeverity.FATAL: return 'error';
    case ValidationSeverity.ERROR: return 'error';
    case ValidationSeverity.WARNING: return 'warning';
    case ValidationSeverity.INFO: return 'info';
    default: return 'warning';
  }
}

/**
 * Convert legacy 'PASS' | 'WARN' | 'FAIL' status to appropriate severity.
 * For backward compatibility with webflow-verifier.
 */
export function fromLegacyStatus(status: 'PASS' | 'WARN' | 'FAIL'): ValidationSeverity | null {
  switch (status) {
    case 'FAIL': return ValidationSeverity.ERROR;
    case 'WARN': return ValidationSeverity.WARNING;
    case 'PASS': return null; // No issue
    default: return null;
  }
}

// ============================================
// CLASS RENAMING REPORT
// ============================================

/**
 * Report structure for BEM class renaming operations.
 * Used by the BEM renamer stage to communicate results to UI.
 */
export interface ClassRenamingReport {
  /** Overall status of the renaming operation */
  status: "pass" | "warn";
  /** Summary statistics */
  summary: {
    /** Total number of classes processed */
    totalClasses: number;
    /** Number of classes that were renamed */
    renamed: number;
    /** Number of classes preserved (design tokens, whitelist) */
    preserved: number;
    /** Number of high-risk generic names neutralized */
    highRiskNeutralized: number;
    /** Number of JS references updated */
    jsReferencesUpdated: number;
  };
  /** Categorized rename details */
  categories: {
    /** Classes renamed with full BEM structure (block__element--modifier) */
    bemRenamed: Array<{
      original: string;
      renamed: string;
      block: string;
    }>;
    /** Classes namespaced as utilities */
    utilityNamespaced: Array<{
      original: string;
      renamed: string;
    }>;
    /** Classes preserved without renaming */
    preserved: Array<{
      className: string;
      reason: string;
    }>;
    /** High-risk generic names that were detected */
    highRiskDetected: string[];
  };
  /** Warning messages */
  warnings: string[];
}

/**
 * Create an empty/default ClassRenamingReport
 */
export function createEmptyClassRenamingReport(): ClassRenamingReport {
  return {
    status: "pass",
    summary: {
      totalClasses: 0,
      renamed: 0,
      preserved: 0,
      highRiskNeutralized: 0,
      jsReferencesUpdated: 0,
    },
    categories: {
      bemRenamed: [],
      utilityNamespaced: [],
      preserved: [],
      highRiskDetected: [],
    },
    warnings: [],
  };
}
