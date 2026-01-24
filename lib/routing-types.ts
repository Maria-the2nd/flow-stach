/**
 * CSS Routing Types
 *
 * Type definitions for the CSS routing debugger/tracer system.
 * These types enable detailed tracking of routing decisions.
 */

// ============================================
// ROUTING TRACE TYPES
// ============================================

/**
 * Complete trace of CSS routing decisions
 */
export interface CSSRoutingTrace {
  /** Original input CSS */
  originalCSS: string;

  /** All traced rules */
  rules: RoutedRule[];

  /** Summary statistics */
  summary: RoutingTraceSummary;

  /** Time taken to parse (ms) */
  parseTime?: number;

  /** Time taken to route (ms) */
  routeTime?: number;
}

/**
 * Summary of routing decisions
 */
export interface RoutingTraceSummary {
  totalRules: number;
  nativeRules: number;
  embedRules: number;
  splitRules: number;
  breakpointMappings: number;
  atRulesExtracted: number;
}

/**
 * A single routed CSS rule
 */
export interface RoutedRule {
  /** Unique identifier for UI keys */
  id: string;

  /** Original CSS selector */
  selector: string;

  /** Original rule text */
  originalCSS: string;

  /** Where this rule was routed */
  destination: RuleDestination;

  /** Why it was routed this way */
  reasons: RoutingReason[];

  /** Properties within this rule */
  properties: RoutedProperty[];

  /** Breakpoint information (if applicable) */
  breakpoint?: BreakpointMapping;

  /** Output CSS for native styles */
  nativeOutput?: string;

  /** Output CSS for embed styles */
  embedOutput?: string;

  /** Rule category for grouping */
  category: RuleCategory;
}

export type RuleDestination = 'native' | 'embed' | 'split';

export type RuleCategory =
  | 'at-rule'       // @keyframes, @font-face, etc.
  | 'root'          // :root CSS variables
  | 'media'         // @media rules
  | 'base'          // Regular rules outside media queries
  | 'pseudo'        // Rules with pseudo-elements/classes
  | 'combinator'    // Rules with combinators
  | 'attribute';    // Rules with attribute selectors

/**
 * A single CSS property and its routing
 */
export interface RoutedProperty {
  /** Property name (e.g., "display") */
  property: string;

  /** Property value (e.g., "flex") */
  value: string;

  /** Where this property was routed */
  destination: 'native' | 'embed';

  /** Why it was routed this way */
  reason: string;

  /** Transformation applied (if any) */
  transformed?: PropertyTransformation;
}

/**
 * Transformation applied to a property
 */
export interface PropertyTransformation {
  /** Original value */
  from: string;

  /** Transformed value */
  to: string;

  /** Why transformation was applied */
  reason: string;
}

/**
 * Breakpoint mapping information
 */
export interface BreakpointMapping {
  /** Original media query */
  original: string;

  /** Mapped Webflow breakpoint name */
  mapped: string;

  /** Whether value was rounded to match Webflow breakpoints */
  wasRounded: boolean;

  /** Original width value (if applicable) */
  originalWidth?: number;

  /** Mapped width value (if applicable) */
  mappedWidth?: number;
}

// ============================================
// ROUTING REASON TYPES
// ============================================

/**
 * Discriminated union of all possible routing reasons
 */
export type RoutingReason =
  | PseudoElementReason
  | PseudoClassComplexReason
  | AtRuleReason
  | CombinatorReason
  | IdSelectorReason
  | TagSelectorReason
  | AttributeSelectorReason
  | DescendantSelectorReason
  | CompoundSelectorReason
  | VendorPrefixReason
  | CSSVariableReason
  | StandardPropertyReason
  | NativeStateReason
  | BreakpointMappedReason
  | BreakpointNonstandardReason
  | RootVariablesReason;

export interface PseudoElementReason {
  type: 'pseudo-element';
  element: string;
}

export interface PseudoClassComplexReason {
  type: 'pseudo-class-complex';
  class: string;
}

export interface AtRuleReason {
  type: 'at-rule';
  rule: string;
}

export interface CombinatorReason {
  type: 'combinator';
  combinator: string;
}

export interface IdSelectorReason {
  type: 'id-selector';
}

export interface TagSelectorReason {
  type: 'tag-selector';
  tag: string;
}

export interface AttributeSelectorReason {
  type: 'attribute-selector';
  attribute: string;
}

export interface DescendantSelectorReason {
  type: 'descendant-selector';
}

export interface CompoundSelectorReason {
  type: 'compound-selector';
}

export interface VendorPrefixReason {
  type: 'vendor-prefix';
  prefix: string;
}

export interface CSSVariableReason {
  type: 'css-variable';
}

export interface StandardPropertyReason {
  type: 'standard-property';
}

export interface NativeStateReason {
  type: 'native-state';
  state: string;
}

export interface BreakpointMappedReason {
  type: 'breakpoint-mapped';
  from: string;
  to: string;
}

export interface BreakpointNonstandardReason {
  type: 'breakpoint-nonstandard';
  query: string;
}

export interface RootVariablesReason {
  type: 'root-variables';
}

// ============================================
// FILTER/SEARCH TYPES
// ============================================

export type RoutingFilter = 'all' | 'native' | 'embed';

export interface RoutingDebuggerState {
  filter: RoutingFilter;
  search: string;
  expandedRules: Set<string>;
  categoryFilter: RuleCategory | 'all';
}
