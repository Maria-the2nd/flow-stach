/**
 * Preset Mapper - Maps HTML tags to Webflow element presets
 *
 * Webflow Designer Extension API uses elementPresets to create elements.
 * This module maps HTML tags and XscpData node types to the correct presets.
 *
 * @see https://docs.developers.webflow.com/v2.0.0/docs/designer-extension-api-reference#elementpresets
 */

// ============================================
// TYPES
// ============================================

export interface PresetMapping {
  /** The Webflow element preset to use */
  preset: string
  /** Whether we need to call setTag() after insertion to override the default tag */
  requiresTagOverride: boolean
  /** The tag to override with (only relevant if requiresTagOverride is true) */
  overrideTag?: string
}

// ============================================
// WEBFLOW ELEMENT PRESETS
// ============================================

/**
 * Available Webflow element presets.
 * These map to webflow.elementPresets.* in the Designer Extension API.
 *
 * Common presets:
 * - DivBlock: Generic div container
 * - Section: Full-width section container
 * - Container: Centered container with max-width
 * - Grid: CSS Grid container
 * - VFlex: Vertical flexbox
 * - HFlex: Horizontal flexbox
 * - Heading: H1-H6 heading element
 * - Paragraph: Paragraph text
 * - TextBlock: Inline text span
 * - Link: Anchor element
 * - LinkBlock: Block-level anchor
 * - Image: Image element
 * - Video: Video element
 * - List: UL/OL list
 * - ListItem: LI list item
 * - FormWrapper: Form element
 * - FormBlock: Form container
 * - FormInput: Input element
 * - FormButton: Submit button
 * - HtmlEmbed: Custom HTML embed
 * - Blockquote: Blockquote element
 * - Figure: Figure element
 * - FigCaption: Figure caption
 * - RichText: Rich text container
 */
export const WEBFLOW_PRESETS = {
  // Layout containers
  DivBlock: 'DivBlock',
  Section: 'Section',
  Container: 'Container',
  Grid: 'Grid',
  VFlex: 'VFlex',
  HFlex: 'HFlex',
  Columns: 'Columns',
  Column: 'Column',

  // Text elements
  Heading: 'Heading',
  Paragraph: 'Paragraph',
  TextBlock: 'TextBlock',
  RichText: 'RichText',
  Blockquote: 'Blockquote',

  // Links
  Link: 'Link',
  LinkBlock: 'LinkBlock',
  Button: 'Button',

  // Media
  Image: 'Image',
  Video: 'Video',
  BackgroundVideo: 'BackgroundVideo',

  // Lists
  List: 'List',
  ListItem: 'ListItem',

  // Forms
  FormWrapper: 'FormWrapper',
  FormBlock: 'FormBlock',
  FormInput: 'FormInput',
  FormTextarea: 'FormTextarea',
  FormSelect: 'FormSelect',
  FormCheckbox: 'FormCheckbox',
  FormRadio: 'FormRadio',
  FormButton: 'FormButton',

  // Special
  HtmlEmbed: 'HtmlEmbed',
  Figure: 'Figure',
  FigCaption: 'FigCaption',
  NavBar: 'NavBar',
  NavLink: 'NavLink',
  NavMenu: 'NavMenu',
  Dropdown: 'Dropdown',
  Tabs: 'Tabs',
  TabsMenu: 'TabsMenu',
  TabsContent: 'TabsContent',
  TabLink: 'TabLink',
  TabPane: 'TabPane',
  Slider: 'Slider',
  Lightbox: 'Lightbox',
} as const

// ============================================
// TAG TO PRESET MAPPING
// ============================================

/**
 * Maps HTML tags to their preferred Webflow preset.
 *
 * Note: Many HTML tags map to DivBlock with a tag override because Webflow
 * doesn't have specific presets for every HTML5 semantic element.
 */
const TAG_TO_PRESET: Record<string, PresetMapping> = {
  // Block containers - use DivBlock with tag override
  div: { preset: 'DivBlock', requiresTagOverride: false },
  section: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'section' },
  article: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'article' },
  aside: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'aside' },
  header: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'header' },
  footer: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'footer' },
  main: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'main' },
  nav: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'nav' },
  figure: { preset: 'Figure', requiresTagOverride: false },
  figcaption: { preset: 'FigCaption', requiresTagOverride: false },
  address: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'address' },

  // Text elements
  h1: { preset: 'Heading', requiresTagOverride: true, overrideTag: 'h1' },
  h2: { preset: 'Heading', requiresTagOverride: true, overrideTag: 'h2' },
  h3: { preset: 'Heading', requiresTagOverride: true, overrideTag: 'h3' },
  h4: { preset: 'Heading', requiresTagOverride: true, overrideTag: 'h4' },
  h5: { preset: 'Heading', requiresTagOverride: true, overrideTag: 'h5' },
  h6: { preset: 'Heading', requiresTagOverride: true, overrideTag: 'h6' },
  p: { preset: 'Paragraph', requiresTagOverride: false },
  span: { preset: 'TextBlock', requiresTagOverride: false },
  strong: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'strong' },
  b: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'strong' },
  em: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'em' },
  i: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'em' },
  u: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
  s: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
  small: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
  sub: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'sub' },
  sup: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'sup' },
  mark: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
  abbr: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
  code: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
  pre: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  blockquote: { preset: 'Blockquote', requiresTagOverride: false },

  // Links
  a: { preset: 'Link', requiresTagOverride: false },

  // Media
  img: { preset: 'Image', requiresTagOverride: false },
  video: { preset: 'Video', requiresTagOverride: false },
  picture: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  source: { preset: 'DivBlock', requiresTagOverride: false }, // Ignored in Webflow
  iframe: { preset: 'HtmlEmbed', requiresTagOverride: false },
  embed: { preset: 'HtmlEmbed', requiresTagOverride: false },
  object: { preset: 'HtmlEmbed', requiresTagOverride: false },

  // Lists
  ul: { preset: 'List', requiresTagOverride: false },
  ol: { preset: 'List', requiresTagOverride: true, overrideTag: 'ol' },
  li: { preset: 'ListItem', requiresTagOverride: false },
  dl: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'dl' },
  dt: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'dt' },
  dd: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'dd' },

  // Tables (use DivBlock as Webflow handles tables differently)
  table: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  thead: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  tbody: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  tfoot: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  tr: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  th: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  td: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },

  // Forms
  form: { preset: 'FormWrapper', requiresTagOverride: false },
  input: { preset: 'FormInput', requiresTagOverride: false },
  textarea: { preset: 'FormTextarea', requiresTagOverride: false },
  select: { preset: 'FormSelect', requiresTagOverride: false },
  option: { preset: 'DivBlock', requiresTagOverride: false }, // Handled by FormSelect
  optgroup: { preset: 'DivBlock', requiresTagOverride: false },
  button: { preset: 'Button', requiresTagOverride: false },
  label: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'label' },
  fieldset: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'fieldset' },
  legend: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'legend' },

  // Interactive
  details: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  summary: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  dialog: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  menu: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },

  // Other
  hr: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'div' },
  br: { preset: 'DivBlock', requiresTagOverride: false }, // Special handling needed
  wbr: { preset: 'DivBlock', requiresTagOverride: false },
  time: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
  data: { preset: 'TextBlock', requiresTagOverride: true, overrideTag: 'span' },
}

// ============================================
// XSCP TYPE TO PRESET MAPPING
// ============================================

/**
 * Maps XscpData node types to Webflow presets.
 * These types come from the payload.nodes[].type field.
 */
const TYPE_TO_PRESET: Record<string, PresetMapping> = {
  Block: { preset: 'DivBlock', requiresTagOverride: false },
  Section: { preset: 'DivBlock', requiresTagOverride: true, overrideTag: 'section' },
  Link: { preset: 'Link', requiresTagOverride: false },
  Image: { preset: 'Image', requiresTagOverride: false },
  Video: { preset: 'Video', requiresTagOverride: false },
  HtmlEmbed: { preset: 'HtmlEmbed', requiresTagOverride: false },
  Heading: { preset: 'Heading', requiresTagOverride: false },
  Paragraph: { preset: 'Paragraph', requiresTagOverride: false },
  List: { preset: 'List', requiresTagOverride: false },
  ListItem: { preset: 'ListItem', requiresTagOverride: false },
}

// ============================================
// EXPORTS
// ============================================

/**
 * Map an HTML tag to a Webflow element preset.
 *
 * @param tag - The HTML tag name (e.g., 'div', 'section', 'h1')
 * @param nodeType - Optional XscpData node type for more accurate mapping
 * @returns Preset mapping with preset name and override requirements
 */
export function mapTagToPreset(tag: string, nodeType?: string): PresetMapping {
  const normalizedTag = tag.toLowerCase()

  // If we have a node type, try that first
  if (nodeType && TYPE_TO_PRESET[nodeType]) {
    const typeMapping = TYPE_TO_PRESET[nodeType]

    // Check if tag differs from type's expected tag
    if (normalizedTag !== 'div' && typeMapping.preset === 'DivBlock') {
      return {
        preset: 'DivBlock',
        requiresTagOverride: true,
        overrideTag: normalizedTag,
      }
    }

    return typeMapping
  }

  // Try tag-based mapping
  if (TAG_TO_PRESET[normalizedTag]) {
    return TAG_TO_PRESET[normalizedTag]
  }

  // Default to DivBlock with tag override
  return {
    preset: 'DivBlock',
    requiresTagOverride: normalizedTag !== 'div',
    overrideTag: normalizedTag !== 'div' ? normalizedTag : undefined,
  }
}

/**
 * Get all available Webflow presets
 */
export function getAvailablePresets(): string[] {
  return Object.values(WEBFLOW_PRESETS)
}

/**
 * Check if a tag is supported for insertion
 */
export function isTagSupported(tag: string): boolean {
  const normalizedTag = tag.toLowerCase()
  return normalizedTag in TAG_TO_PRESET || normalizedTag === 'div'
}

/**
 * Get the default preset for unknown tags
 */
export function getDefaultPreset(): PresetMapping {
  return { preset: 'DivBlock', requiresTagOverride: false }
}
