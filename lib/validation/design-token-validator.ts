/**
 * Design Token Validator
 *
 * Validates design token JSON to ensure Webflow compatibility
 * Design tokens must use simple, widely-supported CSS values
 */

export interface DesignTokens {
  colors?: Record<string, string>;
  typography?: Record<string, string | number>;
  spacing?: Record<string, string | number>;
  fonts?: {
    families?: string[];
    googleFonts?: string;
  };
  [key: string]: unknown;
}

export interface TokenValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Simple color formats that work in Webflow
 */
const SIMPLE_COLOR_PATTERNS = [
  /^#[0-9a-f]{3,8}$/i, // Hex: #fff, #ffffff, #ffffff80
  /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i, // rgb(255, 255, 255)
  /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/i, // rgba(255, 255, 255, 0.5)
  /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/i, // hsl(0, 0%, 100%)
  /^hsla\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*,\s*[\d.]+\s*\)$/i, // hsla(0, 0%, 100%, 0.5)
];

/**
 * Advanced color formats that need embeds
 */
const ADVANCED_COLOR_PATTERNS = [
  { pattern: /oklch\(/i, name: 'oklch()' },
  { pattern: /color-mix\(/i, name: 'color-mix()' },
  { pattern: /\blch\(/i, name: 'lch()' },
  { pattern: /\blab\(/i, name: 'lab()' },
];

/**
 * Simple spacing units that work in Webflow
 */
const SIMPLE_SPACING_PATTERNS = [
  /^\d+px$/i, // 16px
  /^\d+rem$/i, // 1rem
  /^\d+em$/i, // 1em
  /^\d+%$/i, // 50%
  /^\d+$/i, // 0 (unitless zero)
  /^auto$/i, // auto
];

/**
 * Advanced spacing that may need embeds
 */
const ADVANCED_SPACING_PATTERNS = [
  { pattern: /clamp\([^)]*v[wh]/i, name: 'clamp() with viewport units' },
  { pattern: /calc\([^)]*v[wh]/i, name: 'calc() with viewport units' },
  { pattern: /min\([^)]*v[wh]/i, name: 'min() with viewport units' },
  { pattern: /max\([^)]*v[wh]/i, name: 'max() with viewport units' },
];

/**
 * Validate a color value
 */
function validateColor(value: string): {
  valid: boolean;
  isSimple: boolean;
  warning?: string;
} {
  const trimmed = value.trim();

  // Check if it's a simple color
  const isSimple = SIMPLE_COLOR_PATTERNS.some((pattern) => pattern.test(trimmed));
  if (isSimple) {
    return { valid: true, isSimple: true };
  }

  // Check if it's an advanced color
  for (const { pattern, name } of ADVANCED_COLOR_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: true,
        isSimple: false,
        warning: `Color uses ${name} - requires custom code embed`,
      };
    }
  }

  // Unknown format
  return {
    valid: false,
    isSimple: false,
    warning: `Unknown color format: ${trimmed}`,
  };
}

/**
 * Validate a spacing value
 */
function validateSpacing(value: string | number): {
  valid: boolean;
  isSimple: boolean;
  warning?: string;
} {
  const stringValue = String(value).trim();

  // Check if it's a simple spacing
  const isSimple = SIMPLE_SPACING_PATTERNS.some((pattern) => pattern.test(stringValue));
  if (isSimple) {
    return { valid: true, isSimple: true };
  }

  // Check if it's an advanced spacing
  for (const { pattern, name } of ADVANCED_SPACING_PATTERNS) {
    if (pattern.test(stringValue)) {
      return {
        valid: true,
        isSimple: false,
        warning: `Spacing uses ${name} - may require custom code embed`,
      };
    }
  }

  // Unknown format
  return {
    valid: false,
    isSimple: false,
    warning: `Unknown spacing format: ${stringValue}`,
  };
}

/**
 * Validate typography value
 */
function validateTypography(value: string | number): {
  valid: boolean;
  warning?: string;
} {
  const stringValue = String(value).trim();

  // Font families should be strings
  if (stringValue.includes(',') || /^["']/.test(stringValue)) {
    return { valid: true };
  }

  // Font sizes should be numbers with units or unitless
  if (/^\d+(px|rem|em|%)?$/i.test(stringValue)) {
    return { valid: true };
  }

  // Font weights should be numbers or keywords
  if (/^(normal|bold|bolder|lighter|\d{3})$/i.test(stringValue)) {
    return { valid: true };
  }

  return {
    valid: false,
    warning: `Unrecognized typography value: ${stringValue}`,
  };
}

/**
 * Validate design tokens JSON
 */
export function validateDesignTokens(tokensJson: string): TokenValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Try to parse JSON
  let tokens: DesignTokens;
  try {
    tokens = JSON.parse(tokensJson);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON: ${error instanceof Error ? error.message : 'Parse error'}`],
      warnings: [],
    };
  }

  // Validate colors
  if (tokens.colors) {
    if (typeof tokens.colors !== 'object' || Array.isArray(tokens.colors)) {
      errors.push('colors must be an object (key-value pairs)');
    } else {
      for (const [key, value] of Object.entries(tokens.colors)) {
        if (typeof value !== 'string') {
          errors.push(`Color "${key}" must be a string, got ${typeof value}`);
          continue;
        }

        const colorValidation = validateColor(value);
        if (!colorValidation.valid) {
          errors.push(`Invalid color "${key}": ${colorValidation.warning || 'Unknown format'}`);
        } else if (colorValidation.warning) {
          warnings.push(`Color "${key}": ${colorValidation.warning}`);
        }
      }
    }
  }

  // Validate spacing
  if (tokens.spacing) {
    if (typeof tokens.spacing !== 'object' || Array.isArray(tokens.spacing)) {
      errors.push('spacing must be an object (key-value pairs)');
    } else {
      for (const [key, value] of Object.entries(tokens.spacing)) {
        if (typeof value !== 'string' && typeof value !== 'number') {
          errors.push(`Spacing "${key}" must be a string or number, got ${typeof value}`);
          continue;
        }

        const spacingValidation = validateSpacing(value);
        if (!spacingValidation.valid) {
          errors.push(`Invalid spacing "${key}": ${spacingValidation.warning || 'Unknown format'}`);
        } else if (spacingValidation.warning) {
          warnings.push(`Spacing "${key}": ${spacingValidation.warning}`);
        }
      }
    }
  }

  // Validate typography
  if (tokens.typography) {
    if (typeof tokens.typography !== 'object' || Array.isArray(tokens.typography)) {
      errors.push('typography must be an object (key-value pairs)');
    } else {
      for (const [key, value] of Object.entries(tokens.typography)) {
        if (typeof value !== 'string' && typeof value !== 'number') {
          errors.push(`Typography "${key}" must be a string or number, got ${typeof value}`);
          continue;
        }

        const typoValidation = validateTypography(value);
        if (!typoValidation.valid) {
          warnings.push(`Typography "${key}": ${typoValidation.warning || 'Unknown format'}`);
        }
      }
    }
  }

  // Validate fonts
  if (tokens.fonts) {
    if (typeof tokens.fonts !== 'object' || Array.isArray(tokens.fonts)) {
      errors.push('fonts must be an object');
    } else {
      if (tokens.fonts.families && !Array.isArray(tokens.fonts.families)) {
        errors.push('fonts.families must be an array of font family names');
      }
      if (tokens.fonts.googleFonts && typeof tokens.fonts.googleFonts !== 'string') {
        errors.push('fonts.googleFonts must be a string (Google Fonts URL)');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation results for display
 */
export function formatTokenValidation(result: TokenValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push('✅ Design tokens are valid');
  } else {
    lines.push('❌ Design token validation failed');
  }

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('ERRORS:');
    result.errors.forEach((err) => lines.push(`  • ${err}`));
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS:');
    result.warnings.forEach((warn) => lines.push(`  • ${warn}`));
  }

  return lines.join('\n');
}
