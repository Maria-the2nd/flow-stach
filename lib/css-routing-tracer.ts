/**
 * CSS Routing Tracer
 *
 * Records detailed routing decisions for debugging.
 * Used to track why each CSS rule was routed to native or embed.
 */

import {
  CSSRoutingTrace,
  RoutedRule,
  RoutingReason,
  RoutingTraceSummary,
  RuleDestination,
  RuleCategory,
  BreakpointMapping,
  PropertyTransformation,
} from './routing-types';

export class CSSRoutingTracer {
  private rules: RoutedRule[] = [];
  private startTime: number = 0;
  private parseEndTime: number = 0;
  private ruleCounter: number = 0;

  constructor() {
    this.startTime = performance.now();
  }

  /**
   * Mark the end of parsing phase
   */
  markParseComplete(): void {
    this.parseEndTime = performance.now();
  }

  /**
   * Trace a CSS rule being analyzed
   */
  traceRule(
    selector: string,
    originalCSS: string,
    destination: RuleDestination,
    reasons: RoutingReason[],
    category: RuleCategory = 'base'
  ): string {
    const id = `rule-${this.ruleCounter++}`;

    this.rules.push({
      id,
      selector,
      originalCSS,
      destination,
      reasons,
      properties: [],
      category,
    });

    return id;
  }

  /**
   * Trace an at-rule (keyframes, font-face, etc.)
   */
  traceAtRule(
    ruleName: string,
    content: string,
    atRuleType: string
  ): string {
    const id = `rule-${this.ruleCounter++}`;

    this.rules.push({
      id,
      selector: ruleName,
      originalCSS: content,
      destination: 'embed',
      reasons: [{ type: 'at-rule', rule: atRuleType }],
      properties: [],
      category: 'at-rule',
      embedOutput: content,
    });

    return id;
  }

  /**
   * Trace :root CSS variables
   */
  traceRootVariables(content: string): string {
    const id = `rule-${this.ruleCounter++}`;

    this.rules.push({
      id,
      selector: ':root',
      originalCSS: content,
      destination: 'embed',
      reasons: [{ type: 'root-variables' }],
      properties: [],
      category: 'root',
      embedOutput: content,
    });

    return id;
  }

  /**
   * Trace a media query rule
   */
  traceMediaRule(
    selector: string,
    originalCSS: string,
    destination: RuleDestination,
    reasons: RoutingReason[],
    breakpoint?: BreakpointMapping
  ): string {
    const id = `rule-${this.ruleCounter++}`;

    this.rules.push({
      id,
      selector,
      originalCSS,
      destination,
      reasons,
      properties: [],
      category: 'media',
      breakpoint,
    });

    return id;
  }

  /**
   * Trace a property within a rule
   */
  traceProperty(
    ruleId: string,
    property: string,
    value: string,
    destination: 'native' | 'embed',
    reason: string,
    transformed?: PropertyTransformation
  ): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.properties.push({
        property,
        value,
        destination,
        reason,
        transformed,
      });
    }
  }

  /**
   * Set output CSS for a rule
   */
  setRuleOutput(
    ruleId: string,
    nativeOutput?: string,
    embedOutput?: string
  ): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      if (nativeOutput) rule.nativeOutput = nativeOutput;
      if (embedOutput) rule.embedOutput = embedOutput;
    }
  }

  /**
   * Update rule destination after analysis
   */
  updateRuleDestination(ruleId: string, destination: RuleDestination): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.destination = destination;
    }
  }

  /**
   * Add a reason to an existing rule
   */
  addReason(ruleId: string, reason: RoutingReason): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.reasons.push(reason);
    }
  }

  /**
   * Generate the final routing trace
   */
  finalize(originalCSS: string): CSSRoutingTrace {
    const endTime = performance.now();

    const summary = this.calculateSummary();

    return {
      originalCSS,
      rules: this.rules,
      summary,
      parseTime: this.parseEndTime > 0 ? this.parseEndTime - this.startTime : undefined,
      routeTime: endTime - (this.parseEndTime > 0 ? this.parseEndTime : this.startTime),
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(): RoutingTraceSummary {
    let nativeRules = 0;
    let embedRules = 0;
    let splitRules = 0;
    let breakpointMappings = 0;
    let atRulesExtracted = 0;

    for (const rule of this.rules) {
      switch (rule.destination) {
        case 'native':
          nativeRules++;
          break;
        case 'embed':
          embedRules++;
          break;
        case 'split':
          splitRules++;
          break;
      }

      if (rule.breakpoint) {
        breakpointMappings++;
      }

      if (rule.category === 'at-rule' || rule.category === 'root') {
        atRulesExtracted++;
      }
    }

    return {
      totalRules: this.rules.length,
      nativeRules,
      embedRules,
      splitRules,
      breakpointMappings,
      atRulesExtracted,
    };
  }

  /**
   * Get current rule count
   */
  getRuleCount(): number {
    return this.rules.length;
  }

  /**
   * Get rules by destination
   */
  getRulesByDestination(destination: RuleDestination): RoutedRule[] {
    return this.rules.filter(r => r.destination === destination);
  }

  /**
   * Get rules by category
   */
  getRulesByCategory(category: RuleCategory): RoutedRule[] {
    return this.rules.filter(r => r.category === category);
  }
}

// ============================================
// HELPER FUNCTIONS FOR REASON FORMATTING
// ============================================

/**
 * Format a routing reason as a human-readable string
 */
export function formatRoutingReason(reason: RoutingReason): string {
  switch (reason.type) {
    case 'pseudo-element':
      return `Pseudo-element (${reason.element}) requires embed`;
    case 'pseudo-class-complex':
      return `Complex pseudo-class (${reason.class}) requires embed`;
    case 'at-rule':
      return `At-rule (@${reason.rule}) requires embed`;
    case 'combinator':
      return `Combinator (${reason.combinator}) requires embed`;
    case 'id-selector':
      return 'ID selector requires embed';
    case 'tag-selector':
      return `Tag selector (${reason.tag}) requires embed`;
    case 'attribute-selector':
      return `Attribute selector (${reason.attribute}) requires embed`;
    case 'descendant-selector':
      return 'Descendant selector (.parent .child) requires embed';
    case 'compound-selector':
      return 'Compound selector (.class1.class2) requires embed';
    case 'vendor-prefix':
      return `Vendor prefix (${reason.prefix}) requires embed`;
    case 'css-variable':
      return 'CSS variable requires embed';
    case 'standard-property':
      return 'Standard property - native';
    case 'native-state':
      return `State (${reason.state}) supported natively`;
    case 'breakpoint-mapped':
      return `Breakpoint mapped: ${reason.from} → ${reason.to}`;
    case 'breakpoint-nonstandard':
      return `Non-standard breakpoint (${reason.query}) - moved to embed`;
    case 'root-variables':
      return 'CSS custom properties (:root) - moved to embed';
    default:
      return 'Unknown reason';
  }
}

/**
 * Get a short label for a routing reason type
 */
export function getReasonLabel(reason: RoutingReason): string {
  switch (reason.type) {
    case 'pseudo-element':
      return reason.element;
    case 'pseudo-class-complex':
      return reason.class;
    case 'at-rule':
      return `@${reason.rule}`;
    case 'combinator':
      return reason.combinator;
    case 'id-selector':
      return '#id';
    case 'tag-selector':
      return reason.tag;
    case 'attribute-selector':
      return `[${reason.attribute}]`;
    case 'descendant-selector':
      return '.a .b';
    case 'compound-selector':
      return '.a.b';
    case 'vendor-prefix':
      return reason.prefix;
    case 'css-variable':
      return 'var()';
    case 'standard-property':
      return 'standard';
    case 'native-state':
      return reason.state;
    case 'breakpoint-mapped':
      return 'breakpoint';
    case 'breakpoint-nonstandard':
      return 'media';
    case 'root-variables':
      return ':root';
    default:
      return '?';
  }
}

/**
 * Get icon for destination
 */
export function getDestinationIcon(destination: RuleDestination): string {
  switch (destination) {
    case 'native':
      return '✅';
    case 'embed':
      return '⚠️';
    case 'split':
      return '↔️';
    default:
      return '❓';
  }
}

/**
 * Get category icon
 */
export function getCategoryIcon(category: RuleCategory): string {
  switch (category) {
    case 'at-rule':
      return '📐';
    case 'root':
      return '🎨';
    case 'media':
      return '📱';
    case 'base':
      return '📄';
    case 'pseudo':
      return '👻';
    case 'combinator':
      return '🔗';
    case 'attribute':
      return '🏷️';
    default:
      return '📋';
  }
}
