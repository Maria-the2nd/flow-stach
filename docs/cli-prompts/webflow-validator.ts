/**
 * Flow Bridge: Webflow Payload Validation & Sanitization
 * 
 * This module validates and sanitizes HTML→Webflow JSON conversions
 * to prevent Designer corruption and paste failures.
 */

const uuidv4 = (): string => {
  if (typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return `uuid-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WebflowNode {
  _id: string;
  tag: string;
  classes: string[];
  children: string[];
  type: string;
  data?: {
    text?: string;
    href?: string;
    attr?: Record<string, string>;
    [key: string]: unknown;
  };
}

export interface WebflowStyle {
  _id: string;
  fake: boolean;
  type: 'class';
  name: string;
  namespace: string;
  comb: string;
  styleLess: string;
  variants: Record<string, unknown>;
  children: string[];
  selector: string | null;
}

export interface WebflowPayload {
  type: '@webflow/XscpData';
  payload: {
    nodes: WebflowNode[];
    styles: WebflowStyle[];
    assets: unknown[];
    ix2?: unknown;
    meta?: Record<string, unknown>;
  };
}

export interface ValidationError {
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  sanitizedPayload?: WebflowPayload;
}

// ============================================================================
// VALIDATION RULES
// ============================================================================

class WebflowValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];

  /**
   * CRITICAL: Check for duplicate UUIDs
   * This is a "site-killer" - will corrupt entire project
   */
  validateUniqueIds(payload: WebflowPayload): boolean {
    const nodeIds = new Set<string>();
    const styleIds = new Set<string>();
    let hasDuplicates = false;

    // Check node IDs
    payload.payload.nodes.forEach(node => {
      if (nodeIds.has(node._id)) {
        this.errors.push({
          severity: 'error',
          rule: 'unique-ids',
          message: `Duplicate node UUID: ${node._id}`,
          context: { nodeType: node.type, nodeTag: node.tag }
        });
        hasDuplicates = true;
      }
      nodeIds.add(node._id);
    });

    // Check style IDs
    payload.payload.styles.forEach(style => {
      if (styleIds.has(style._id)) {
        this.errors.push({
          severity: 'error',
          rule: 'unique-ids',
          message: `Duplicate style UUID: ${style._id}`,
          context: { styleName: style.name }
        });
        hasDuplicates = true;
      }
      styleIds.add(style._id);
    });

    return !hasDuplicates;
  }

  /**
   * CRITICAL: Check for circular class references
   * Will cause Designer to hang and corrupt state
   */
  validateNoCircularReferences(payload: WebflowPayload): boolean {
    const styleMap = new Map<string, WebflowStyle>();
    payload.payload.styles.forEach(style => {
      styleMap.set(style._id, style);
    });

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (styleId: string, path: string[] = []): boolean => {
      if (recursionStack.has(styleId)) {
        this.errors.push({
          severity: 'error',
          rule: 'no-circular-refs',
          message: 'Circular class reference detected',
          context: { cyclePath: [...path, styleId] }
        });
        return true;
      }

      if (visited.has(styleId)) {
        return false;
      }

      visited.add(styleId);
      recursionStack.add(styleId);

      const style = styleMap.get(styleId);
      if (style && style.children) {
        for (const childId of style.children) {
          if (hasCycle(childId, [...path, styleId])) {
            return true;
          }
        }
      }

      recursionStack.delete(styleId);
      return false;
    };

    let foundCycles = false;
    for (const style of payload.payload.styles) {
      if (hasCycle(style._id)) {
        foundCycles = true;
      }
    }

    return !foundCycles;
  }

  /**
   * CRITICAL: Validate all state variants have parent classes
   * Orphaned states cause "invalid keys" errors
   */
  validateNoOrphanedStates(payload: WebflowPayload): boolean {
    const baseClassNames = new Set<string>(
      payload.payload.styles
        .filter(s => !s.name.includes(':'))
        .map(s => s.name)
    );

    const orphans: string[] = [];
    payload.payload.styles.forEach(style => {
      if (style.name.includes(':')) {
        const baseName = style.name.split(':')[0];
        if (!baseClassNames.has(baseName)) {
          orphans.push(style.name);
          this.errors.push({
            severity: 'error',
            rule: 'no-orphaned-states',
            message: `State variant without parent class: ${style.name}`,
            context: { expectedParent: baseName }
          });
        }
      }
    });

    return orphans.length === 0;
  }

  /**
   * Check all styles have required properties
   */
  validateStyleStructure(payload: WebflowPayload): boolean {
    const requiredProps = ['_id', 'type', 'name', 'styleLess'];
    let allValid = true;

    payload.payload.styles.forEach((style, index) => {
      const missing = requiredProps.filter(prop => !(prop in style));
      if (missing.length > 0) {
        this.errors.push({
          severity: 'error',
          rule: 'style-structure',
          message: `Style missing required properties: ${missing.join(', ')}`,
          context: { styleIndex: index, styleName: style.name || 'unnamed' }
        });
        allValid = false;
      }

      // Validate styleLess is valid CSS
      if (style.styleLess && typeof style.styleLess !== 'string') {
        this.errors.push({
          severity: 'error',
          rule: 'style-structure',
          message: 'styleLess must be a string',
          context: { styleName: style.name }
        });
        allValid = false;
      }
    });

    return allValid;
  }

  /**
   * Validate class names follow Webflow conventions
   */
  validateClassNames(payload: WebflowPayload): boolean {
    const classNamePattern = /^[a-z0-9-_]+$/i;
    let allValid = true;

    payload.payload.styles.forEach(style => {
      // Extract base name (remove state suffix like :hover)
      const baseName = style.name.split(':')[0];
      
      if (!classNamePattern.test(baseName)) {
        this.warnings.push({
          severity: 'warning',
          rule: 'class-naming',
          message: `Class name contains invalid characters: ${style.name}`,
          context: { 
            styleName: style.name,
            suggestion: baseName.toLowerCase().replace(/[^a-z0-9-_]/g, '-')
          }
        });
        allValid = false;
      }

      // Warn about extremely long names
      if (baseName.length > 50) {
        this.warnings.push({
          severity: 'warning',
          rule: 'class-naming',
          message: `Class name is excessively long (${baseName.length} chars): ${baseName.substring(0, 30)}...`,
          context: { styleName: style.name }
        });
      }
    });

    return allValid;
  }

  /**
   * Check for orphaned node references
   */
  validateNodeReferences(payload: WebflowPayload): boolean {
    const nodeIds = new Set<string>(
      payload.payload.nodes.map(n => n._id)
    );

    let allValid = true;
    payload.payload.nodes.forEach(node => {
      if (node.children) {
        node.children.forEach(childId => {
          if (!nodeIds.has(childId)) {
            this.errors.push({
              severity: 'error',
              rule: 'node-references',
              message: `Node references non-existent child: ${childId}`,
              context: { parentId: node._id, parentType: node.type }
            });
            allValid = false;
          }
        });
      }
    });

    return allValid;
  }

  /**
   * Warn about excessive class count
   */
  validateClassCount(payload: WebflowPayload): boolean {
    const classCount = payload.payload.styles.length;
    
    if (classCount > 200) {
      this.warnings.push({
        severity: 'warning',
        rule: 'class-count',
        message: `Component has ${classCount} classes - consider refactoring`,
        context: { classCount }
      });
    }

    if (classCount > 500) {
      this.errors.push({
        severity: 'error',
        rule: 'class-count',
        message: `Component has ${classCount} classes - will cause Designer performance issues`,
        context: { classCount }
      });
      return false;
    }

    return true;
  }

  /**
   * Run all validations
   */
  validate(payload: WebflowPayload): ValidationResult {
    this.errors = [];
    this.warnings = [];

    // Run all validation rules
    this.validateUniqueIds(payload);
    this.validateNoCircularReferences(payload);
    this.validateNoOrphanedStates(payload);
    this.validateStyleStructure(payload);
    this.validateClassNames(payload);
    this.validateNodeReferences(payload);
    this.validateClassCount(payload);

    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  getErrors(): ValidationError[] {
    return this.errors;
  }

  getWarnings(): ValidationError[] {
    return this.warnings;
  }
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

export class WebflowSanitizer {
  /**
   * Regenerate ALL UUIDs to prevent conflicts
   */
  private regenerateIds(payload: WebflowPayload): WebflowPayload {
    const idMap = new Map<string, string>();

    // Generate new IDs for all nodes
    payload.payload.nodes = payload.payload.nodes.map(node => {
      const newId = uuidv4();
      idMap.set(node._id, newId);
      return { ...node, _id: newId };
    });

    // Generate new IDs for all styles
    payload.payload.styles = payload.payload.styles.map(style => {
      const newId = uuidv4();
      idMap.set(style._id, newId);
      return { ...style, _id: newId };
    });

    // Update all references to use new IDs
    payload.payload.nodes = payload.payload.nodes.map(node => {
      if (node.children && node.children.length > 0) {
        node.children = node.children.map(childId => 
          idMap.get(childId) || childId
        );
      }
      return node;
    });

    return payload;
  }

  /**
   * Remove all interaction data (ix2) to prevent conflicts
   */
  private stripInteractions(payload: WebflowPayload): WebflowPayload {
    delete payload.payload.ix2;
    return payload;
  }

  /**
   * Break circular references in style hierarchy
   */
  private breakCircularReferences(payload: WebflowPayload): WebflowPayload {
    const styleMap = new Map<string, WebflowStyle>();
    payload.payload.styles.forEach(style => {
      styleMap.set(style._id, style);
    });

    const visited = new Set<string>();
    const path: string[] = [];

    const removeCycles = (styleId: string): void => {
      if (path.includes(styleId)) {
        // Found cycle - break it by removing this child reference
        const parentIdx = path.indexOf(styleId);
        const parent = styleMap.get(path[parentIdx - 1]);
        if (parent) {
          parent.children = parent.children.filter(id => id !== styleId);
          console.warn(`Broke circular reference: ${parent.name} -> ${styleMap.get(styleId)?.name}`);
        }
        return;
      }

      if (visited.has(styleId)) return;
      visited.add(styleId);
      path.push(styleId);

      const style = styleMap.get(styleId);
      if (style?.children) {
        style.children.forEach(childId => removeCycles(childId));
      }

      path.pop();
    };

    payload.payload.styles.forEach(style => {
      removeCycles(style._id);
    });

    return payload;
  }

  /**
   * Remove orphaned state variants
   */
  private removeOrphanedStates(payload: WebflowPayload): WebflowPayload {
    const baseClassNames = new Set<string>(
      payload.payload.styles
        .filter(s => !s.name.includes(':'))
        .map(s => s.name)
    );

    payload.payload.styles = payload.payload.styles.filter(style => {
      if (style.name.includes(':')) {
        const baseName = style.name.split(':')[0];
        if (!baseClassNames.has(baseName)) {
          console.warn(`Removing orphaned state variant: ${style.name}`);
          return false;
        }
      }
      return true;
    });

    return payload;
  }

  /**
   * Sanitize class names to valid format
   */
  private sanitizeClassNames(payload: WebflowPayload): WebflowPayload {
    payload.payload.styles = payload.payload.styles.map(style => {
      const parts = style.name.split(':');
      let baseName = parts[0];
      const state = parts[1];

      // Convert to lowercase kebab-case
      baseName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .replace(/-+/g, '-'); // Collapse multiple hyphens

      style.name = state ? `${baseName}:${state}` : baseName;
      return style;
    });

    return payload;
  }

  /**
   * Remove orphaned node references
   */
  private removeOrphanedReferences(payload: WebflowPayload): WebflowPayload {
    const nodeIds = new Set<string>(
      payload.payload.nodes.map(n => n._id)
    );

    payload.payload.nodes = payload.payload.nodes.map(node => {
      if (node.children) {
        node.children = node.children.filter(childId => {
          const exists = nodeIds.has(childId);
          if (!exists) {
            console.warn(`Removing orphaned child reference: ${childId}`);
          }
          return exists;
        });
      }
      return node;
    });

    return payload;
  }

  /**
   * Full sanitization pipeline
   */
  sanitize(payload: WebflowPayload): WebflowPayload {
    let sanitized = { ...payload };

    console.log('🧹 Starting Webflow payload sanitization...');
    
    sanitized = this.regenerateIds(sanitized);
    console.log('✓ Regenerated all UUIDs');
    
    sanitized = this.stripInteractions(sanitized);
    console.log('✓ Stripped interaction data');
    
    sanitized = this.breakCircularReferences(sanitized);
    console.log('✓ Broke circular references');
    
    sanitized = this.removeOrphanedStates(sanitized);
    console.log('✓ Removed orphaned state variants');
    
    sanitized = this.sanitizeClassNames(sanitized);
    console.log('✓ Sanitized class names');
    
    sanitized = this.removeOrphanedReferences(sanitized);
    console.log('✓ Removed orphaned node references');

    return sanitized;
  }
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

/**
 * Validate and optionally sanitize a Webflow payload
 * 
 * @param payload - The Webflow JSON payload to validate
 * @param autoSanitize - If true, automatically sanitize on validation failure
 * @returns Validation result with sanitized payload if applicable
 */
export function validateWebflowPayload(
  payload: WebflowPayload,
  autoSanitize: boolean = true
): ValidationResult {
  const validator = new WebflowValidator();
  const result = validator.validate(payload);

  if (!result.valid && autoSanitize) {
    console.log('❌ Validation failed, attempting auto-sanitization...');
    const sanitizer = new WebflowSanitizer();
    const sanitized = sanitizer.sanitize(payload);
    
    // Re-validate sanitized payload
    const revalidateResult = validator.validate(sanitized);
    
    return {
      ...revalidateResult,
      sanitizedPayload: sanitized
    };
  }

  return result;
}

/**
 * Helper to format validation errors for user display
 */
export function formatValidationErrors(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.errors.length > 0) {
    lines.push('❌ ERRORS (Must fix before pasting):');
    result.errors.forEach((error, i) => {
      lines.push(`  ${i + 1}. [${error.rule}] ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    lines.push('\n⚠️  WARNINGS (Recommended to fix):');
    result.warnings.forEach((warning, i) => {
      lines.push(`  ${i + 1}. [${warning.rule}] ${warning.message}`);
    });
  }

  if (result.valid) {
    lines.push('✅ Payload is valid and safe to paste');
  }

  return lines.join('\n');
}
