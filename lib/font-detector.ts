/**
 * Font Detection and Webflow Compatibility Checker
 * Detects fonts from CSS and determines installation requirements
 */

export interface DetectedFont {
  family: string;           // "Inter", "Merriweather"
  source: 'google' | 'adobe' | 'custom' | 'system';
  url?: string;             // Google Fonts URL if applicable
  weights: number[];        // [400, 700]
  styles: string[];         // ['normal', 'italic']
  isWebflowCompatible: boolean;  // Can be added in Webflow UI
}

export interface FontChecklistItem {
  name: string;
  status: 'available' | 'missing' | 'unknown';
  warning?: boolean;
  installationGuide: string;
}

// System fonts that are available across platforms
const SYSTEM_FONTS = new Set([
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Times',
  'Courier New',
  'Courier',
  'Verdana',
  'Georgia',
  'Palatino',
  'Garamond',
  'Bookman',
  'Comic Sans MS',
  'Trebuchet MS',
  'Impact',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
]);

// Common Google Fonts (subset - Webflow has 1000+ Google Fonts available)
const GOOGLE_FONTS = new Set([
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Source Sans Pro',
  'Raleway',
  'PT Sans',
  'Merriweather',
  'Nunito',
  'Poppins',
  'Inter',
  'Playfair Display',
  'Ubuntu',
  'Rubik',
  'Work Sans',
  'Mukta',
  'Noto Sans',
  'Fira Sans',
  'Quicksand',
]);

/**
 * Parse CSS and detect all fonts used
 */
export function detectFontsFromCSS(css: string): DetectedFont[] {
  const fonts = new Map<string, DetectedFont>();

  // 1. Detect Google Fonts imports
  const googleImportRegex = /@import\s+url\(['"]?https?:\/\/fonts\.googleapis\.com\/css\?family=([^'"]+)['"]?\)/gi;
  let match;
  while ((match = googleImportRegex.exec(css)) !== null) {
    const urlParams = match[1];
    const families = parseGoogleFontsUrl(urlParams);
    families.forEach(font => {
      fonts.set(font.family, font);
    });
  }

  // 2. Detect Google Fonts imports (CSS2 API)
  const googleImport2Regex = /@import\s+url\(['"]?https?:\/\/fonts\.googleapis\.com\/css2\?family=([^'"]+)['"]?\)/gi;
  while ((match = googleImport2Regex.exec(css)) !== null) {
    const urlParams = match[1];
    const families = parseGoogleFontsUrl2(urlParams);
    families.forEach(font => {
      fonts.set(font.family, font);
    });
  }

  // 3. Detect Adobe Fonts imports
  const adobeImportRegex = /@import\s+url\(['"]?https?:\/\/use\.typekit\.net\/([^'"]+)\.css['"]?\)/gi;
  while ((match = adobeImportRegex.exec(css)) !== null) {
    // Adobe fonts require the kit ID, but we can't extract family names from it
    // Add placeholder
    fonts.set('Adobe Fonts Kit', {
      family: 'Adobe Fonts (Custom Kit)',
      source: 'adobe',
      url: match[0],
      weights: [],
      styles: [],
      isWebflowCompatible: false,
    });
  }

  // 4. Detect @font-face custom fonts
  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi;
  while ((match = fontFaceRegex.exec(css)) !== null) {
    const fontFaceBody = match[1];
    const familyMatch = fontFaceBody.match(/font-family:\s*['"]?([^'";]+)['"]?/i);
    const weightMatch = fontFaceBody.match(/font-weight:\s*(\d+|normal|bold)/i);
    const styleMatch = fontFaceBody.match(/font-style:\s*(normal|italic|oblique)/i);

    if (familyMatch) {
      const family = familyMatch[1].trim();
      const weight = weightMatch ? parseWeight(weightMatch[1]) : 400;
      const style = styleMatch ? styleMatch[1] : 'normal';

      if (!fonts.has(family)) {
        fonts.set(family, {
          family,
          source: 'custom',
          weights: [weight],
          styles: [style],
          isWebflowCompatible: false,
        });
      } else {
        const existing = fonts.get(family)!;
        if (!existing.weights.includes(weight)) {
          existing.weights.push(weight);
        }
        if (!existing.styles.includes(style)) {
          existing.styles.push(style);
        }
      }
    }
  }

  // 5. Detect font-family declarations
  const fontFamilyRegex = /font-family:\s*([^;{}]+)/gi;
  while ((match = fontFamilyRegex.exec(css)) !== null) {
    const familiesStr = match[1];
    const families = familiesStr.split(',').map(f => f.trim().replace(/['"]/g, ''));

    families.forEach(family => {
      if (!fonts.has(family) && !SYSTEM_FONTS.has(family)) {
        // Determine source
        let source: DetectedFont['source'] = 'custom';
        let isWebflowCompatible = false;

        if (GOOGLE_FONTS.has(family)) {
          source = 'google';
          isWebflowCompatible = true;
        } else if (SYSTEM_FONTS.has(family)) {
          source = 'system';
          isWebflowCompatible = true;
        }

        fonts.set(family, {
          family,
          source,
          weights: [400], // Default weight
          styles: ['normal'],
          isWebflowCompatible,
        });
      }
    });
  }

  return Array.from(fonts.values());
}

/**
 * Parse Google Fonts URL (old API)
 * Example: family=Roboto:400,700|Open+Sans:300,400
 */
function parseGoogleFontsUrl(urlParams: string): DetectedFont[] {
  const fonts: DetectedFont[] = [];
  const families = urlParams.split('|');

  families.forEach(familyStr => {
    const [name, weightsStr] = familyStr.split(':');
    const family = name.replace(/\+/g, ' ').trim();
    const weights = weightsStr
      ? weightsStr.split(',').map(w => {
          const weight = w.replace(/italic/g, '').trim();
          return weight ? parseInt(weight, 10) : 400;
        })
      : [400];

    fonts.push({
      family,
      source: 'google',
      url: `https://fonts.googleapis.com/css?family=${familyStr}`,
      weights,
      styles: weightsStr?.includes('italic') ? ['normal', 'italic'] : ['normal'],
      isWebflowCompatible: true,
    });
  });

  return fonts;
}

/**
 * Parse Google Fonts URL (CSS2 API)
 * Example: family=Roboto:wght@400;700&family=Open+Sans:wght@300;400
 */
function parseGoogleFontsUrl2(urlParams: string): DetectedFont[] {
  const fonts: DetectedFont[] = [];
  const decodedParams = decodeURIComponent(urlParams);
  const familyMatches = decodedParams.matchAll(/family=([^&:]+)(?::wght@([^&]+))?/g);

  for (const match of familyMatches) {
    const family = match[1].replace(/\+/g, ' ').trim();
    const weightsStr = match[2];
    const weights = weightsStr
      ? weightsStr.split(';').map(w => parseInt(w, 10))
      : [400];

    fonts.push({
      family,
      source: 'google',
      url: `https://fonts.googleapis.com/css2?family=${match[0]}`,
      weights,
      styles: ['normal'],
      isWebflowCompatible: true,
    });
  }

  return fonts;
}

/**
 * Convert CSS font-weight to numeric value
 */
function parseWeight(weight: string): number {
  if (weight === 'normal') return 400;
  if (weight === 'bold') return 700;
  return parseInt(weight, 10) || 400;
}

/**
 * Build checklist for Webflow compatibility
 */
export function buildFontChecklist(fonts: DetectedFont[]): FontChecklistItem[] {
  return fonts.map(font => {
    let status: FontChecklistItem['status'] = 'unknown';
    let warning = false;
    let installationGuide = '';

    switch (font.source) {
      case 'google':
        status = 'available';
        installationGuide = `This Google Font is available in Webflow. Go to Site Settings → Fonts → Add Font → Search for "${font.family}" and add it to your project.`;
        break;

      case 'system':
        status = 'available';
        installationGuide = `This is a system font and is already available in Webflow. No installation required.`;
        break;

      case 'adobe':
        status = 'missing';
        warning = true;
        installationGuide = `Adobe Fonts require custom code integration. Copy the @import statement from the original CSS and add it to your Webflow project's Custom Code (in Site Settings → Custom Code → Head Code).`;
        break;

      case 'custom':
        status = 'missing';
        warning = true;
        installationGuide = `This custom font must be uploaded to Webflow. Go to Site Settings → Fonts → Upload Font, then upload the font files (.woff, .woff2, .ttf) for "${font.family}". Make sure to upload all weights: ${font.weights.join(', ')}.`;
        break;

      default:
        status = 'unknown';
        installationGuide = `Unable to determine font source. Please verify this font is available in your Webflow project.`;
    }

    return {
      name: font.family,
      status,
      warning,
      installationGuide,
    };
  });
}

/**
 * Get a summary of font requirements
 */
export function getFontSummary(fonts: DetectedFont[]): {
  total: number;
  available: number;
  missing: number;
  googleFonts: number;
  customFonts: number;
} {
  return {
    total: fonts.length,
    available: fonts.filter(f => f.isWebflowCompatible).length,
    missing: fonts.filter(f => !f.isWebflowCompatible).length,
    googleFonts: fonts.filter(f => f.source === 'google').length,
    customFonts: fonts.filter(f => f.source === 'custom').length,
  };
}
