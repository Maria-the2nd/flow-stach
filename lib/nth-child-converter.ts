/**
 * nth-child to BEM Converter
 *
 * Converts CSS :nth-child(N) selectors to BEM modifier classes.
 * This enables native Webflow support instead of requiring CSS embed.
 *
 * Example:
 * Input CSS:
 *   .step-card:nth-child(1) { background: #aefbff; }
 *   .step-card:nth-child(2) { background: #f6bbfd; }
 *   .step-card:nth-child(3) { background: #ffff94; }
 *
 * Output CSS:
 *   .step-card-1 { background: #aefbff; }
 *   .step-card-2 { background: #f6bbfd; }
 *   .step-card-3 { background: #ffff94; }
 *
 * HTML Injection (applied to elements by position):
 *   <div class="step-card step-card-1">...</div>
 *   <div class="step-card step-card-2">...</div>
 *   <div class="step-card step-card-3">...</div>
 */

// Common color names mapped to hex values for semantic naming
const COLOR_NAME_MAP: Record<string, string[]> = {
  // Cyan/Teal family
  cyan: ['#aefbff', '#00ffff', '#00bcd4', '#17a2b8', '#20c997', '#0dcaf0'],
  teal: ['#008080', '#009688', '#26a69a', '#80cbc4'],
  aqua: ['#7fdbff', '#00ffff'],

  // Pink/Magenta family
  pink: ['#f6bbfd', '#ff69b4', '#ff1493', '#e91e63', '#f06292', '#ec407a', '#ffc0cb'],
  magenta: ['#ff00ff', '#e040fb', '#ea80fc'],
  rose: ['#fccddc', '#ff6b6b', '#f43f5e'],
  hotpink: ['#fc5681', '#ff1744', '#f50057'],

  // Yellow family
  yellow: ['#ffff94', '#ffff00', '#ffc107', '#ffeb3b', '#fff176', '#ffee58', '#fdd835'],
  gold: ['#ffd700', '#ffb300', '#ffa000'],
  amber: ['#ffbf00', '#ff8f00', '#ff6f00'],

  // Orange family
  orange: ['#fdc068', '#ff9124', '#ff9800', '#fb8c00', '#f57c00', '#ef6c00'],
  peach: ['#ffab91', '#ff8a65'],

  // Green family
  green: ['#82eda6', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7', '#00ff00'],
  lime: ['#d8e268', '#cddc39', '#c0ca33', '#afb42b', '#00ff00'],
  mint: ['#98ff98', '#00fa9a', '#3eb489'],
  sage: ['#89a9a1', '#9caf88', '#b2ac88'],

  // Blue family
  blue: ['#589af0', '#2196f3', '#1976d2', '#1565c0', '#0d47a1', '#3b82f6'],
  navy: ['#001f3f', '#0a1f44', '#1e3a5f'],
  sky: ['#87ceeb', '#00bfff', '#1e90ff'],

  // Purple family
  purple: ['#c88cfd', '#9c27b0', '#8e24aa', '#7b1fa2', '#6a1b9a', '#a855f7'],
  violet: ['#ee82ee', '#9400d3', '#8b00ff'],
  lavender: ['#e6e6fa', '#b57edc', '#9370db'],

  // Red family
  red: ['#ff0000', '#f44336', '#e53935', '#d32f2f', '#c62828', '#ef4444'],
  crimson: ['#dc143c', '#b22222', '#8b0000'],
  coral: ['#ff7f50', '#ff6347', '#fa8072'],

  // Neutral family
  white: ['#ffffff', '#fff', '#f9f8f4', '#fafafa', '#f5f5f5'],
  gray: ['#808080', '#9e9e9e', '#757575', '#616161', '#424242'],
  black: ['#000000', '#000', '#212121', '#1a1a1a'],
};

/**
 * Result of nth-child conversion
 */
export interface NthChildConversionResult {
  /** CSS with nth-child selectors converted to BEM modifier classes */
  convertedCss: string;
  /** Rules that couldn't be converted (complex patterns) */
  unconvertedCss: string;
  /** Mapping of base class -> position -> modifier class */
  htmlInjections: NthChildHtmlInjection[];
  /** First/last child injections */
  firstLastInjections: FirstLastChildHtmlInjection[];
  /** Odd/even child injections */
  oddEvenInjections: OddEvenHtmlInjection[];
  /** Simple an formula injections (every Nth) */
  anFormulaInjections: AnFormulaHtmlInjection[];
  /** an+b formula injections (cyclic slots) */
  anPlusBInjections: AnPlusBHtmlInjection[];
  /** nth-last-child injections (from end) */
  nthLastChildInjections: NthLastChildHtmlInjection[];
  /** Summary of conversions performed */
  report: NthChildConversionReport;
}

export interface NthChildHtmlInjection {
  /** The base class to look for (e.g., "step-card") */
  baseClass: string;
  /** Which child position (1-indexed) */
  position: number;
  /** The modifier class to add (e.g., "step-card-cyan") */
  modifierClass: string;
}

export interface NthChildConversionReport {
  /** Total nth-child rules found */
  totalFound: number;
  /** Rules converted to BEM */
  converted: number;
  /** Rules left in embed (complex patterns) */
  leftInEmbed: number;
  /** Details of conversions */
  conversions: Array<{
    original: string;
    converted: string;
    reason: string;
  }>;
  /** Reasons for unconverted rules */
  unconvertedReasons: string[];
}

/**
 * Parsed nth-child rule
 */
interface ParsedNthChildRule {
  /** Full original selector */
  originalSelector: string;
  /** Base class name (e.g., "step-card") */
  baseClass: string;
  /** The nth-child expression (e.g., "1", "2n+1", "odd") */
  nthExpression: string;
  /** CSS properties */
  properties: string;
  /** Full rule text */
  fullRule: string;
}

/**
 * Parsed first-child or last-child rule
 */
interface ParsedFirstLastChildRule {
  /** Full original selector */
  originalSelector: string;
  /** Base class name (e.g., "card") */
  baseClass: string;
  /** Whether it's first-child or last-child */
  type: 'first' | 'last';
  /** CSS properties */
  properties: string;
  /** Full rule text */
  fullRule: string;
}

/**
 * HTML injection for first/last child
 */
export interface FirstLastChildHtmlInjection {
  /** The base class to look for (e.g., "card") */
  baseClass: string;
  /** Whether to apply to first or last element */
  type: 'first' | 'last';
  /** The modifier class to add (e.g., "card-first") */
  modifierClass: string;
}

/**
 * HTML injection for odd/even patterns
 */
export interface OddEvenHtmlInjection {
  /** The base class to look for (e.g., "row") */
  baseClass: string;
  /** Whether to apply to odd or even positions */
  type: 'odd' | 'even';
  /** The modifier class to add (e.g., "row-odd") */
  modifierClass: string;
}

/**
 * HTML injection for simple an formulas (every Nth element)
 */
export interface AnFormulaHtmlInjection {
  /** The base class to look for (e.g., "item") */
  baseClass: string;
  /** The coefficient (e.g., 3 for 3n meaning every 3rd) */
  coefficient: number;
  /** The modifier class to add (e.g., "item-every-3rd") */
  modifierClass: string;
}

/**
 * HTML injection for an+b formulas (cyclic slot positions)
 */
export interface AnPlusBHtmlInjection {
  /** The base class to look for (e.g., "grid-item") */
  baseClass: string;
  /** The cycle length (e.g., 6 for 6n+1) */
  cycleLength: number;
  /** The slot position within the cycle (e.g., 1 for 6n+1) */
  slotPosition: number;
  /** The modifier class to add (e.g., "grid-item-slot-1") */
  modifierClass: string;
}

/**
 * HTML injection for nth-last-child (counting from end)
 */
export interface NthLastChildHtmlInjection {
  /** The base class to look for (e.g., "item") */
  baseClass: string;
  /** Position from the end (1 = last, 2 = second to last, etc.) */
  positionFromEnd: number;
  /** The modifier class to add (e.g., "item-from-end-2") */
  modifierClass: string;
}

/**
 * Parsed nth-last-child rule
 */
interface ParsedNthLastChildRule {
  /** Full original selector */
  originalSelector: string;
  /** Base class name (e.g., "item") */
  baseClass: string;
  /** The nth-last-child expression (e.g., "1", "2") */
  nthExpression: string;
  /** CSS properties */
  properties: string;
  /** Full rule text */
  fullRule: string;
}

/**
 * Try to get a semantic color name from a hex value
 */
function getSemanticColorName(hexValue: string): string | null {
  const normalizedHex = hexValue.toLowerCase().trim();

  for (const [colorName, hexValues] of Object.entries(COLOR_NAME_MAP)) {
    if (hexValues.some(hex => hex.toLowerCase() === normalizedHex)) {
      return colorName;
    }
  }

  return null;
}

/**
 * Extract the primary differentiating property value from CSS properties
 * Typically this is background-color for card variants
 */
function extractPrimaryValue(properties: string): { property: string; value: string } | null {
  // Priority order for naming: background/background-color, color, border-color
  const priorityProps = [
    /background(?:-color)?:\s*([^;]+)/i,
    /color:\s*([^;]+)/i,
    /border(?:-color)?:\s*([^;]+)/i,
  ];

  for (const regex of priorityProps) {
    const match = properties.match(regex);
    if (match) {
      const value = match[1].trim();
      // Check if it's a color value (hex, rgb, named color)
      if (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgb/i.test(value) || /^[a-z]+$/i.test(value)) {
        return { property: 'color', value };
      }
    }
  }

  return null;
}

/**
 * Parse CSS for nth-child rules
 */
function parseNthChildRules(css: string): ParsedNthChildRule[] {
  const rules: ParsedNthChildRule[] = [];

  // Match patterns like: .class:nth-child(N) { ... }
  // Also handles: .class:nth-child(N), .other-class:nth-child(M) { ... }
  const ruleRegex = /([^{}]+):nth-child\(([^)]+)\)\s*\{([^}]+)\}/gi;

  let match;
  while ((match = ruleRegex.exec(css)) !== null) {
    const selectorPart = match[1].trim();
    const nthExpression = match[2].trim();
    const properties = match[3].trim();

    // Extract base class from selector (handle compound selectors)
    const classMatch = selectorPart.match(/\.([a-zA-Z_-][\w-]*)(?:\.[a-zA-Z_-][\w-]*)*$/);
    if (classMatch) {
      rules.push({
        originalSelector: `${selectorPart}:nth-child(${nthExpression})`,
        baseClass: classMatch[1],
        nthExpression,
        properties,
        fullRule: match[0],
      });
    }
  }

  return rules;
}

/**
 * Parse CSS for :nth-last-child() rules
 */
function parseNthLastChildRules(css: string): ParsedNthLastChildRule[] {
  const rules: ParsedNthLastChildRule[] = [];

  // Match patterns like: .class:nth-last-child(N) { ... }
  const ruleRegex = /([^{}]+):nth-last-child\((\d+)\)\s*\{([^}]+)\}/gi;

  let match;
  while ((match = ruleRegex.exec(css)) !== null) {
    const selectorPart = match[1].trim();
    const nthExpression = match[2].trim();
    const properties = match[3].trim();

    // Only support simple numeric expressions for now
    if (!/^\d+$/.test(nthExpression)) continue;

    // Extract base class from selector
    const classMatch = selectorPart.match(/\.([a-zA-Z_-][\w-]*)(?:\.[a-zA-Z_-][\w-]*)*$/);
    if (classMatch) {
      rules.push({
        originalSelector: `${selectorPart}:nth-last-child(${nthExpression})`,
        baseClass: classMatch[1],
        nthExpression,
        properties,
        fullRule: match[0],
      });
    }
  }

  return rules;
}

/**
 * Parse CSS for :first-child and :last-child rules
 */
function parseFirstLastChildRules(css: string): ParsedFirstLastChildRule[] {
  const rules: ParsedFirstLastChildRule[] = [];

  // Match patterns like: .class:first-child { ... } or .class:last-child { ... }
  const ruleRegex = /([^{}]+):(first|last)-child\s*\{([^}]+)\}/gi;

  let match;
  while ((match = ruleRegex.exec(css)) !== null) {
    const selectorPart = match[1].trim();
    const type = match[2].toLowerCase() as 'first' | 'last';
    const properties = match[3].trim();

    // Extract base class from selector (handle compound selectors)
    const classMatch = selectorPart.match(/\.([a-zA-Z_-][\w-]*)(?:\.[a-zA-Z_-][\w-]*)*$/);
    if (classMatch) {
      rules.push({
        originalSelector: `${selectorPart}:${type}-child`,
        baseClass: classMatch[1],
        type,
        properties,
        fullRule: match[0],
      });
    }
  }

  return rules;
}

/**
 * Check if an nth-child expression is convertible (number, odd, even, an formula, or an+b formula)
 */
function isSimpleNthChild(expression: string): boolean {
  const trimmed = expression.trim().toLowerCase();
  // Simple number
  if (/^\d+$/.test(trimmed)) return true;
  // odd/even
  if (trimmed === 'odd' || trimmed === 'even') return true;
  // Simple an formula (2n, 3n, 4n, etc.) - coefficient between 2 and 12
  if (/^[2-9]n$|^1[0-2]n$/i.test(trimmed)) return true;
  // an+b formula (6n+1, 3n+2, etc.)
  if (isAnPlusBFormula(trimmed)) return true;
  return false;
}

/**
 * Check if an nth-child expression is odd/even
 */
function isOddEvenExpression(expression: string): boolean {
  const trimmed = expression.trim().toLowerCase();
  return trimmed === 'odd' || trimmed === 'even';
}

/**
 * Check if an nth-child expression is a simple an formula (every Nth)
 */
function isSimpleAnFormula(expression: string): boolean {
  const trimmed = expression.trim().toLowerCase();
  // Matches patterns like 2n, 3n, 4n, etc. (up to 12n for reasonable patterns)
  return /^[2-9]n$|^1[0-2]n$/i.test(trimmed);
}

/**
 * Parse the coefficient from a simple an formula
 */
function parseAnCoefficient(expression: string): number | null {
  const match = expression.trim().toLowerCase().match(/^(\d+)n$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;

  // Special cases for 11, 12, 13
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${n}th`;
  }

  switch (lastDigit) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/**
 * Check if an nth-child expression is an an+b formula (e.g., 6n+1, 3n+2)
 */
function isAnPlusBFormula(expression: string): boolean {
  const trimmed = expression.trim().toLowerCase();
  // Matches patterns like 2n+1, 3n-1, 6n+2, etc.
  // Only support small coefficients (2-12) for reasonable patterns
  return /^[2-9]n[+-]\d+$|^1[0-2]n[+-]\d+$/i.test(trimmed);
}

/**
 * Parse an an+b formula into coefficient and offset
 */
function parseAnPlusBFormula(expression: string): { coefficient: number; offset: number } | null {
  const match = expression.trim().toLowerCase().match(/^(\d+)n([+-])(\d+)$/);
  if (!match) return null;

  const coefficient = parseInt(match[1], 10);
  const sign = match[2] === '+' ? 1 : -1;
  const offsetValue = parseInt(match[3], 10);
  const offset = sign * offsetValue;

  // Validate reasonable ranges
  if (coefficient < 2 || coefficient > 12) return null;

  return { coefficient, offset };
}

/**
 * Group rules by base class and check if they form a convertible set
 * A convertible set has:
 * 1. All simple numeric nth-child expressions
 * 2. Consecutive or common positions (1, 2, 3 or odd/even)
 */
function groupConvertibleRules(rules: ParsedNthChildRule[]): Map<string, ParsedNthChildRule[]> {
  const groups = new Map<string, ParsedNthChildRule[]>();

  for (const rule of rules) {
    if (!groups.has(rule.baseClass)) {
      groups.set(rule.baseClass, []);
    }
    groups.get(rule.baseClass)!.push(rule);
  }

  // Filter to only groups where all rules are simple (numeric)
  const convertible = new Map<string, ParsedNthChildRule[]>();
  for (const [baseClass, classRules] of groups) {
    if (classRules.every(r => isSimpleNthChild(r.nthExpression))) {
      convertible.set(baseClass, classRules);
    }
  }

  return convertible;
}

/**
 * Generate a BEM modifier class name for an nth-child rule
 */
function generateModifierClassName(
  baseClass: string,
  position: number,
  properties: string,
  allPositionValues: Map<number, string>
): string {
  // Try to get a semantic color name
  const primaryValue = extractPrimaryValue(properties);
  if (primaryValue && primaryValue.property === 'color') {
    const colorName = getSemanticColorName(primaryValue.value);
    if (colorName) {
      // Check if this color name would be unique among the group
      const colorNames = new Map<number, string>();
      for (const [pos, props] of allPositionValues) {
        const pv = extractPrimaryValue(props);
        if (pv) {
          const cn = getSemanticColorName(pv.value);
          if (cn) colorNames.set(pos, cn);
        }
      }

      // Check for duplicates
      const allColorNames = Array.from(colorNames.values());
      const isUnique = allColorNames.filter(n => n === colorName).length === 1;

      if (isUnique) {
        return `${baseClass}-${colorName}`;
      }
    }
  }

  // Fallback to numbered modifier
  return `${baseClass}-${position}`;
}

/**
 * Convert nth-child CSS rules to BEM modifier classes
 */
export function convertNthChildToBem(css: string): NthChildConversionResult {
  const report: NthChildConversionReport = {
    totalFound: 0,
    converted: 0,
    leftInEmbed: 0,
    conversions: [],
    unconvertedReasons: [],
  };

  const htmlInjections: NthChildHtmlInjection[] = [];
  const firstLastInjections: FirstLastChildHtmlInjection[] = [];
  const oddEvenInjections: OddEvenHtmlInjection[] = [];
  const anFormulaInjections: AnFormulaHtmlInjection[] = [];
  const anPlusBInjections: AnPlusBHtmlInjection[] = [];
  const nthLastChildInjections: NthLastChildHtmlInjection[] = [];
  let convertedCss = '';
  let unconvertedCss = '';

  // Parse all nth-child rules
  const allRules = parseNthChildRules(css);

  // Parse first-child and last-child rules
  const firstLastRules = parseFirstLastChildRules(css);

  // Parse nth-last-child rules
  const nthLastChildRules = parseNthLastChildRules(css);

  report.totalFound = allRules.length + firstLastRules.length + nthLastChildRules.length;

  // Process first-child and last-child rules first
  for (const rule of firstLastRules) {
    const modifierClass = `${rule.baseClass}-${rule.type}`;

    // Generate converted CSS
    const convertedRule = `.${modifierClass} { ${rule.properties} }`;
    convertedCss += convertedRule + '\n';

    // Add first/last injection
    firstLastInjections.push({
      baseClass: rule.baseClass,
      type: rule.type,
      modifierClass,
    });

    report.converted++;
    report.conversions.push({
      original: rule.originalSelector,
      converted: `.${modifierClass}`,
      reason: `${rule.type}-child to BEM`,
    });
  }

  // Process nth-last-child rules
  for (const rule of nthLastChildRules) {
    const position = parseInt(rule.nthExpression, 10);
    const modifierClass = `${rule.baseClass}-from-end-${position}`;

    // Generate converted CSS
    const convertedRule = `.${modifierClass} { ${rule.properties} }`;
    convertedCss += convertedRule + '\n';

    // Add nth-last-child injection
    nthLastChildInjections.push({
      baseClass: rule.baseClass,
      positionFromEnd: position,
      modifierClass,
    });

    report.converted++;
    report.conversions.push({
      original: rule.originalSelector,
      converted: `.${modifierClass}`,
      reason: `nth-last-child(${position}) to BEM`,
    });
  }

  if (allRules.length === 0 && firstLastRules.length === 0 && nthLastChildRules.length === 0) {
    return {
      convertedCss: '',
      unconvertedCss: '',
      htmlInjections: [],
      firstLastInjections: [],
      oddEvenInjections: [],
      anFormulaInjections: [],
      anPlusBInjections: [],
      nthLastChildInjections: [],
      report,
    };
  }

  if (allRules.length === 0) {
    return {
      convertedCss: convertedCss.trim(),
      unconvertedCss: '',
      htmlInjections: [],
      firstLastInjections,
      oddEvenInjections: [],
      anFormulaInjections: [],
      anPlusBInjections: [],
      nthLastChildInjections,
      report,
    };
  }

  // Separate rules by type: odd/even, an formulas, an+b formulas, and pure numeric
  const oddEvenRules: ParsedNthChildRule[] = [];
  const anFormulaRules: ParsedNthChildRule[] = [];
  const anPlusBRules: ParsedNthChildRule[] = [];
  const numericRules: ParsedNthChildRule[] = [];

  for (const rule of allRules) {
    if (isOddEvenExpression(rule.nthExpression)) {
      oddEvenRules.push(rule);
    } else if (isSimpleAnFormula(rule.nthExpression)) {
      anFormulaRules.push(rule);
    } else if (isAnPlusBFormula(rule.nthExpression)) {
      anPlusBRules.push(rule);
    } else {
      numericRules.push(rule);
    }
  }

  // Track which rules we've converted
  const convertedRules = new Set<string>();

  // Process odd/even rules
  for (const rule of oddEvenRules) {
    const type = rule.nthExpression.toLowerCase() as 'odd' | 'even';
    const modifierClass = `${rule.baseClass}-${type}`;

    // Generate converted CSS
    const convertedRule = `.${modifierClass} { ${rule.properties} }`;
    convertedCss += convertedRule + '\n';

    // Add odd/even injection (only if not already added for this class+type)
    const existingInjection = oddEvenInjections.find(
      i => i.baseClass === rule.baseClass && i.type === type
    );
    if (!existingInjection) {
      oddEvenInjections.push({
        baseClass: rule.baseClass,
        type,
        modifierClass,
      });
    }

    // Track conversion
    convertedRules.add(rule.fullRule);
    report.converted++;
    report.conversions.push({
      original: rule.originalSelector,
      converted: `.${modifierClass}`,
      reason: `${type} to BEM`,
    });
  }

  // Process an formula rules (every Nth element)
  for (const rule of anFormulaRules) {
    const coefficient = parseAnCoefficient(rule.nthExpression);
    if (coefficient === null) continue;

    const ordinal = getOrdinalSuffix(coefficient);
    const modifierClass = `${rule.baseClass}-every-${ordinal}`;

    // Generate converted CSS
    const convertedRule = `.${modifierClass} { ${rule.properties} }`;
    convertedCss += convertedRule + '\n';

    // Add an formula injection (only if not already added for this class+coefficient)
    const existingInjection = anFormulaInjections.find(
      i => i.baseClass === rule.baseClass && i.coefficient === coefficient
    );
    if (!existingInjection) {
      anFormulaInjections.push({
        baseClass: rule.baseClass,
        coefficient,
        modifierClass,
      });
    }

    // Track conversion
    convertedRules.add(rule.fullRule);
    report.converted++;
    report.conversions.push({
      original: rule.originalSelector,
      converted: `.${modifierClass}`,
      reason: `every ${ordinal} to BEM`,
    });
  }

  // Process an+b formula rules (cyclic slot positions)
  for (const rule of anPlusBRules) {
    const formula = parseAnPlusBFormula(rule.nthExpression);
    if (formula === null) continue;

    const { coefficient, offset } = formula;
    // Calculate the effective slot position (1-indexed within the cycle)
    // For 6n+1: positions 1, 7, 13, etc. -> slot 1
    // For 6n+2: positions 2, 8, 14, etc. -> slot 2
    const slotPosition = ((offset % coefficient) + coefficient) % coefficient || coefficient;
    const modifierClass = `${rule.baseClass}-slot-${slotPosition}`;

    // Generate converted CSS
    const convertedRule = `.${modifierClass} { ${rule.properties} }`;
    convertedCss += convertedRule + '\n';

    // Add an+b injection (only if not already added for this class+cycle+slot)
    const existingInjection = anPlusBInjections.find(
      i => i.baseClass === rule.baseClass && i.cycleLength === coefficient && i.slotPosition === slotPosition
    );
    if (!existingInjection) {
      anPlusBInjections.push({
        baseClass: rule.baseClass,
        cycleLength: coefficient,
        slotPosition,
        modifierClass,
      });
    }

    // Track conversion
    convertedRules.add(rule.fullRule);
    report.converted++;
    report.conversions.push({
      original: rule.originalSelector,
      converted: `.${modifierClass}`,
      reason: `slot ${slotPosition} in ${coefficient}-cycle to BEM`,
    });
  }

  // Group numeric rules by base class and filter convertible ones
  const convertibleGroups = groupConvertibleRules(numericRules);

  // Process convertible groups (numeric nth-child)
  for (const [baseClass, rules] of convertibleGroups) {
    // Build a map of position -> properties for semantic naming
    const positionValues = new Map<number, string>();
    for (const rule of rules) {
      const position = parseInt(rule.nthExpression, 10);
      positionValues.set(position, rule.properties);
    }

    // Convert each rule
    for (const rule of rules) {
      const position = parseInt(rule.nthExpression, 10);
      const modifierClass = generateModifierClassName(
        baseClass,
        position,
        rule.properties,
        positionValues
      );

      // Generate converted CSS
      const convertedRule = `.${modifierClass} { ${rule.properties} }`;
      convertedCss += convertedRule + '\n';

      // Add HTML injection
      htmlInjections.push({
        baseClass,
        position,
        modifierClass,
      });

      // Track conversion
      convertedRules.add(rule.fullRule);
      report.converted++;
      report.conversions.push({
        original: rule.originalSelector,
        converted: `.${modifierClass}`,
        reason: modifierClass.includes('-') && !modifierClass.match(/-\d+$/)
          ? 'Semantic color name'
          : 'Numbered modifier',
      });
    }
  }

  // Collect unconverted rules
  for (const rule of allRules) {
    if (!convertedRules.has(rule.fullRule)) {
      unconvertedCss += rule.fullRule + '\n';
      report.leftInEmbed++;

      if (!isSimpleNthChild(rule.nthExpression)) {
        report.unconvertedReasons.push(
          `${rule.originalSelector}: Complex expression "${rule.nthExpression}" (only simple numbers supported)`
        );
      }
    }
  }

  return {
    convertedCss: convertedCss.trim(),
    unconvertedCss: unconvertedCss.trim(),
    htmlInjections,
    firstLastInjections,
    oddEvenInjections,
    anFormulaInjections,
    anPlusBInjections,
    nthLastChildInjections,
    report,
  };
}

/**
 * Apply nth-child modifier classes to HTML
 * This function modifies HTML to add the appropriate modifier class
 * based on element position within parent.
 */
export function applyNthChildModifiersToHtml(
  html: string,
  injections: NthChildHtmlInjection[]
): string {
  if (injections.length === 0) return html;

  // Group injections by base class
  const injectionsByClass = new Map<string, NthChildHtmlInjection[]>();
  for (const injection of injections) {
    if (!injectionsByClass.has(injection.baseClass)) {
      injectionsByClass.set(injection.baseClass, []);
    }
    injectionsByClass.get(injection.baseClass)!.push(injection);
  }

  // For each base class, find elements and add modifiers based on position
  let modifiedHtml = html;

  for (const [baseClass, classInjections] of injectionsByClass) {
    // Sort injections by position for consistent processing
    classInjections.sort((a, b) => a.position - b.position);

    // Create position -> modifierClass map
    const positionMap = new Map<number, string>();
    for (const inj of classInjections) {
      positionMap.set(inj.position, inj.modifierClass);
    }

    // Find all elements with this base class and track their position among siblings
    // This is a simplified approach - for more complex cases, use a DOM parser

    // Pattern to match elements with the base class
    const classPattern = new RegExp(
      `(<[^>]+class=["'][^"']*\\b${escapeRegExp(baseClass)}\\b[^"']*["'][^>]*>)`,
      'gi'
    );

    // Track parent context for position counting
    // For now, use a simpler approach: just number occurrences in document order
    let occurrence = 0;
    modifiedHtml = modifiedHtml.replace(classPattern, (match) => {
      occurrence++;
      const modifierClass = positionMap.get(occurrence);

      if (modifierClass && !match.includes(modifierClass)) {
        // Add modifier class to the element
        return match.replace(
          new RegExp(`(class=["'])([^"']*\\b${escapeRegExp(baseClass)}\\b)`, 'i'),
          `$1$2 ${modifierClass}`
        );
      }

      return match;
    });
  }

  return modifiedHtml;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply first-child and last-child modifier classes to HTML
 * This function modifies HTML to add the appropriate modifier class
 * based on first or last position among elements with the same class.
 */
export function applyFirstLastChildModifiersToHtml(
  html: string,
  injections: FirstLastChildHtmlInjection[]
): string {
  if (injections.length === 0) return html;

  // Group injections by base class
  const injectionsByClass = new Map<string, FirstLastChildHtmlInjection[]>();
  for (const injection of injections) {
    if (!injectionsByClass.has(injection.baseClass)) {
      injectionsByClass.set(injection.baseClass, []);
    }
    injectionsByClass.get(injection.baseClass)!.push(injection);
  }

  let modifiedHtml = html;

  for (const [baseClass, classInjections] of injectionsByClass) {
    // Find all elements with this base class
    const classPattern = new RegExp(
      `(<[^>]+class=["'][^"']*\\b${escapeRegExp(baseClass)}\\b[^"']*["'][^>]*>)`,
      'gi'
    );

    // Find all matches to count total elements
    const matches = Array.from(modifiedHtml.matchAll(classPattern));
    const totalElements = matches.length;

    if (totalElements === 0) continue;

    // Determine which modifiers to apply
    const firstModifier = classInjections.find(i => i.type === 'first');
    const lastModifier = classInjections.find(i => i.type === 'last');

    // Track current occurrence
    let occurrence = 0;
    modifiedHtml = modifiedHtml.replace(classPattern, (match) => {
      occurrence++;

      // Collect modifiers to add for this element
      const modifiersToAdd: string[] = [];

      // Apply first-child modifier to position 1
      if (firstModifier && occurrence === 1 && !match.includes(firstModifier.modifierClass)) {
        modifiersToAdd.push(firstModifier.modifierClass);
      }

      // Apply last-child modifier to the last position
      if (lastModifier && occurrence === totalElements && !match.includes(lastModifier.modifierClass)) {
        modifiersToAdd.push(lastModifier.modifierClass);
      }

      if (modifiersToAdd.length === 0) {
        return match;
      }

      // Add all modifiers at once to avoid replacement issues
      return match.replace(
        new RegExp(`(class=["'])([^"']*\\b${escapeRegExp(baseClass)}\\b)`, 'i'),
        `$1$2 ${modifiersToAdd.join(' ')}`
      );
    });
  }

  return modifiedHtml;
}

/**
 * Remove nth-child rules from CSS that have been converted
 * This prevents them from being routed to embed
 */
export function removeConvertedNthChildRules(
  css: string,
  injections: NthChildHtmlInjection[]
): string {
  if (injections.length === 0) return css;

  let result = css;

  // Group by base class
  const baseClasses = new Set(injections.map(i => i.baseClass));

  for (const baseClass of baseClasses) {
    // Get all positions for this class that were converted
    const positions = injections
      .filter(i => i.baseClass === baseClass)
      .map(i => i.position);

    // Remove the corresponding nth-child rules
    for (const position of positions) {
      const pattern = new RegExp(
        `\\.${escapeRegExp(baseClass)}:nth-child\\(${position}\\)\\s*\\{[^}]+\\}`,
        'gi'
      );
      result = result.replace(pattern, '');
    }
  }

  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n').trim();

  return result;
}

/**
 * Remove first-child and last-child rules from CSS that have been converted
 * This prevents them from being routed to embed
 */
export function removeConvertedFirstLastChildRules(
  css: string,
  injections: FirstLastChildHtmlInjection[]
): string {
  if (injections.length === 0) return css;

  let result = css;

  for (const injection of injections) {
    const pattern = new RegExp(
      `\\.${escapeRegExp(injection.baseClass)}:${injection.type}-child\\s*\\{[^}]+\\}`,
      'gi'
    );
    result = result.replace(pattern, '');
  }

  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n').trim();

  return result;
}

/**
 * Apply odd/even modifier classes to HTML
 * This function modifies HTML to add the appropriate modifier class
 * based on odd or even position among elements with the same class.
 */
export function applyOddEvenModifiersToHtml(
  html: string,
  injections: OddEvenHtmlInjection[]
): string {
  if (injections.length === 0) return html;

  // Group injections by base class
  const injectionsByClass = new Map<string, OddEvenHtmlInjection[]>();
  for (const injection of injections) {
    if (!injectionsByClass.has(injection.baseClass)) {
      injectionsByClass.set(injection.baseClass, []);
    }
    injectionsByClass.get(injection.baseClass)!.push(injection);
  }

  let modifiedHtml = html;

  for (const [baseClass, classInjections] of injectionsByClass) {
    // Find all elements with this base class
    const classPattern = new RegExp(
      `(<[^>]+class=["'][^"']*\\b${escapeRegExp(baseClass)}\\b[^"']*["'][^>]*>)`,
      'gi'
    );

    // Determine which modifiers to apply
    const oddModifier = classInjections.find(i => i.type === 'odd');
    const evenModifier = classInjections.find(i => i.type === 'even');

    // Track current occurrence
    let occurrence = 0;
    modifiedHtml = modifiedHtml.replace(classPattern, (match) => {
      occurrence++;

      // Determine if this is odd or even position (1-indexed)
      const isOdd = occurrence % 2 === 1;

      // Select the appropriate modifier
      const modifier = isOdd ? oddModifier : evenModifier;

      if (modifier && !match.includes(modifier.modifierClass)) {
        return match.replace(
          new RegExp(`(class=["'])([^"']*\\b${escapeRegExp(baseClass)}\\b)`, 'i'),
          `$1$2 ${modifier.modifierClass}`
        );
      }

      return match;
    });
  }

  return modifiedHtml;
}

/**
 * Remove odd/even nth-child rules from CSS that have been converted
 * This prevents them from being routed to embed
 */
export function removeConvertedOddEvenRules(
  css: string,
  injections: OddEvenHtmlInjection[]
): string {
  if (injections.length === 0) return css;

  let result = css;

  for (const injection of injections) {
    const pattern = new RegExp(
      `\\.${escapeRegExp(injection.baseClass)}:nth-child\\(${injection.type}\\)\\s*\\{[^}]+\\}`,
      'gi'
    );
    result = result.replace(pattern, '');
  }

  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n').trim();

  return result;
}

/**
 * Apply an formula (every Nth) modifier classes to HTML
 * This function modifies HTML to add the appropriate modifier class
 * based on position divisible by the coefficient.
 */
export function applyAnFormulaModifiersToHtml(
  html: string,
  injections: AnFormulaHtmlInjection[]
): string {
  if (injections.length === 0) return html;

  // Group injections by base class
  const injectionsByClass = new Map<string, AnFormulaHtmlInjection[]>();
  for (const injection of injections) {
    if (!injectionsByClass.has(injection.baseClass)) {
      injectionsByClass.set(injection.baseClass, []);
    }
    injectionsByClass.get(injection.baseClass)!.push(injection);
  }

  let modifiedHtml = html;

  for (const [baseClass, classInjections] of injectionsByClass) {
    // Find all elements with this base class
    const classPattern = new RegExp(
      `(<[^>]+class=["'][^"']*\\b${escapeRegExp(baseClass)}\\b[^"']*["'][^>]*>)`,
      'gi'
    );

    // Track current occurrence
    let occurrence = 0;
    modifiedHtml = modifiedHtml.replace(classPattern, (match) => {
      occurrence++;

      // Check if this position matches any an formula
      // For formula "Nn", position matches if position % N === 0
      const modifiersToAdd: string[] = [];

      for (const injection of classInjections) {
        if (occurrence % injection.coefficient === 0 && !match.includes(injection.modifierClass)) {
          modifiersToAdd.push(injection.modifierClass);
        }
      }

      if (modifiersToAdd.length === 0) {
        return match;
      }

      return match.replace(
        new RegExp(`(class=["'])([^"']*\\b${escapeRegExp(baseClass)}\\b)`, 'i'),
        `$1$2 ${modifiersToAdd.join(' ')}`
      );
    });
  }

  return modifiedHtml;
}

/**
 * Remove an formula nth-child rules from CSS that have been converted
 * This prevents them from being routed to embed
 */
export function removeConvertedAnFormulaRules(
  css: string,
  injections: AnFormulaHtmlInjection[]
): string {
  if (injections.length === 0) return css;

  let result = css;

  for (const injection of injections) {
    const pattern = new RegExp(
      `\\.${escapeRegExp(injection.baseClass)}:nth-child\\(${injection.coefficient}n\\)\\s*\\{[^}]+\\}`,
      'gi'
    );
    result = result.replace(pattern, '');
  }

  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n').trim();

  return result;
}

/**
 * Apply an+b formula (cyclic slot) modifier classes to HTML
 * This function modifies HTML to add the appropriate modifier class
 * based on position within a cyclic pattern.
 */
export function applyAnPlusBModifiersToHtml(
  html: string,
  injections: AnPlusBHtmlInjection[]
): string {
  if (injections.length === 0) return html;

  // Group injections by base class
  const injectionsByClass = new Map<string, AnPlusBHtmlInjection[]>();
  for (const injection of injections) {
    if (!injectionsByClass.has(injection.baseClass)) {
      injectionsByClass.set(injection.baseClass, []);
    }
    injectionsByClass.get(injection.baseClass)!.push(injection);
  }

  let modifiedHtml = html;

  for (const [baseClass, classInjections] of injectionsByClass) {
    // Find all elements with this base class
    const classPattern = new RegExp(
      `(<[^>]+class=["'][^"']*\\b${escapeRegExp(baseClass)}\\b[^"']*["'][^>]*>)`,
      'gi'
    );

    // Track current occurrence
    let occurrence = 0;
    modifiedHtml = modifiedHtml.replace(classPattern, (match) => {
      occurrence++;

      // Check if this position matches any an+b formula
      // For formula "Cn+B": position matches if (position - B) % C === 0 and position >= B (if B > 0)
      const modifiersToAdd: string[] = [];

      for (const injection of classInjections) {
        // Calculate if this position matches the slot
        // slotPosition 1 means positions 1, 1+C, 1+2C, etc.
        const positionInCycle = ((occurrence - 1) % injection.cycleLength) + 1;
        if (positionInCycle === injection.slotPosition && !match.includes(injection.modifierClass)) {
          modifiersToAdd.push(injection.modifierClass);
        }
      }

      if (modifiersToAdd.length === 0) {
        return match;
      }

      return match.replace(
        new RegExp(`(class=["'])([^"']*\\b${escapeRegExp(baseClass)}\\b)`, 'i'),
        `$1$2 ${modifiersToAdd.join(' ')}`
      );
    });
  }

  return modifiedHtml;
}

/**
 * Remove an+b formula nth-child rules from CSS that have been converted
 * This prevents them from being routed to embed
 */
export function removeConvertedAnPlusBRules(
  css: string,
  injections: AnPlusBHtmlInjection[]
): string {
  if (injections.length === 0) return css;

  let result = css;

  // Build set of unique cycleLength+slotPosition combinations
  const patterns = new Set<string>();
  for (const injection of injections) {
    patterns.add(`${injection.baseClass}:${injection.cycleLength}:${injection.slotPosition}`);
  }

  for (const injection of injections) {
    // Match both positive and wrapped offsets
    // For slot 1 in 6-cycle: matches 6n+1
    // For slot 6 in 6-cycle: matches 6n+6 or 6n (same thing mathematically)
    const pattern = new RegExp(
      `\\.${escapeRegExp(injection.baseClass)}:nth-child\\(${injection.cycleLength}n\\+${injection.slotPosition}\\)\\s*\\{[^}]+\\}`,
      'gi'
    );
    result = result.replace(pattern, '');

    // Also handle 6n-5 which is equivalent to 6n+1 for positions >= 1
    // We need to match Cn+(C-S) pattern where S is the inverse slot
    const inverseSlot = injection.cycleLength - injection.slotPosition;
    if (inverseSlot > 0) {
      const negativePattern = new RegExp(
        `\\.${escapeRegExp(injection.baseClass)}:nth-child\\(${injection.cycleLength}n-${inverseSlot}\\)\\s*\\{[^}]+\\}`,
        'gi'
      );
      result = result.replace(negativePattern, '');
    }
  }

  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n').trim();

  return result;
}

/**
 * Apply nth-last-child modifier classes to HTML
 * This function modifies HTML to add the appropriate modifier class
 * based on position from the end of elements with the same class.
 */
export function applyNthLastChildModifiersToHtml(
  html: string,
  injections: NthLastChildHtmlInjection[]
): string {
  if (injections.length === 0) return html;

  // Group injections by base class
  const injectionsByClass = new Map<string, NthLastChildHtmlInjection[]>();
  for (const injection of injections) {
    if (!injectionsByClass.has(injection.baseClass)) {
      injectionsByClass.set(injection.baseClass, []);
    }
    injectionsByClass.get(injection.baseClass)!.push(injection);
  }

  let modifiedHtml = html;

  for (const [baseClass, classInjections] of injectionsByClass) {
    // Find all elements with this base class
    const classPattern = new RegExp(
      `(<[^>]+class=["'][^"']*\\b${escapeRegExp(baseClass)}\\b[^"']*["'][^>]*>)`,
      'gi'
    );

    // Find all matches to count total elements
    const matches = Array.from(modifiedHtml.matchAll(classPattern));
    const totalElements = matches.length;

    if (totalElements === 0) continue;

    // Create a map of position-from-end -> modifierClass
    const positionFromEndMap = new Map<number, string>();
    for (const injection of classInjections) {
      positionFromEndMap.set(injection.positionFromEnd, injection.modifierClass);
    }

    // Track current occurrence
    let occurrence = 0;
    modifiedHtml = modifiedHtml.replace(classPattern, (match) => {
      occurrence++;

      // Calculate position from end (1 = last, 2 = second to last, etc.)
      const positionFromEnd = totalElements - occurrence + 1;

      // Check if this position matches any nth-last-child rule
      const modifierClass = positionFromEndMap.get(positionFromEnd);

      if (modifierClass && !match.includes(modifierClass)) {
        return match.replace(
          new RegExp(`(class=["'])([^"']*\\b${escapeRegExp(baseClass)}\\b)`, 'i'),
          `$1$2 ${modifierClass}`
        );
      }

      return match;
    });
  }

  return modifiedHtml;
}

/**
 * Remove nth-last-child rules from CSS that have been converted
 * This prevents them from being routed to embed
 */
export function removeConvertedNthLastChildRules(
  css: string,
  injections: NthLastChildHtmlInjection[]
): string {
  if (injections.length === 0) return css;

  let result = css;

  for (const injection of injections) {
    const pattern = new RegExp(
      `\\.${escapeRegExp(injection.baseClass)}:nth-last-child\\(${injection.positionFromEnd}\\)\\s*\\{[^}]+\\}`,
      'gi'
    );
    result = result.replace(pattern, '');
  }

  // Clean up extra whitespace
  result = result.replace(/\n\s*\n/g, '\n').trim();

  return result;
}

/**
 * Log conversion report for debugging
 */
export function logNthChildConversionReport(report: NthChildConversionReport): void {
  if (report.totalFound === 0) return;

  console.log(`[nth-child-converter] Found ${report.totalFound} :nth-child rules`);
  console.log(`[nth-child-converter] Converted ${report.converted} to BEM modifiers`);

  if (report.conversions.length > 0) {
    console.log('[nth-child-converter] Conversions:');
    for (const conv of report.conversions) {
      console.log(`  ${conv.original} → ${conv.converted} (${conv.reason})`);
    }
  }

  if (report.leftInEmbed > 0) {
    console.log(`[nth-child-converter] Left ${report.leftInEmbed} in embed (complex patterns)`);
    for (const reason of report.unconvertedReasons) {
      console.log(`  ${reason}`);
    }
  }
}
