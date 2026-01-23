/**
 * Webflow Designer Extension - Library exports
 *
 * Clipboard-free insertion pipeline for Webflow Designer Extension API.
 */

// Core insertion pipeline
export {
  insertXscpData,
  parseXscpJson,
  validateXscpData,
  type InsertionResult,
  type InsertionOptions,
} from './webflow-inserter'

// Preset mapping
export {
  mapTagToPreset,
  getAvailablePresets,
  isTagSupported,
  getDefaultPreset,
  WEBFLOW_PRESETS,
  type PresetMapping,
} from './preset-mapper'

// Style parsing
export {
  parseStyleLess,
  propertiesToStyleLess,
  propertiesToMap,
  isValidStyleLess,
  sanitizeStyleLess,
  type ParsedProperty,
  type ParseResult,
} from './style-parser'

// Types
export type {
  XscpData,
  XscpNode,
  XscpStyle,
  XscpPayload,
  XscpMeta,
  XscpNodeType,
  XscpNodeData,
  XscpLinkData,
  XscpImageAttr,
  XscpEmbedData,
  XscpAttribute,
  XscpStyleVariant,
} from './types/xscp-data'

export {
  isXscpData,
  isTextNode,
  isHtmlEmbed,
  getTextContent,
} from './types/xscp-data'
