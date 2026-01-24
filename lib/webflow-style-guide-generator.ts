/**
 * Webflow Style Guide Generator - Self-Contained Inline Styles Version
 * Generates a Webflow-pasteable payload with isolated inline styles
 * that won't conflict with imported project styles
 */

import type { WebflowPayload, WebflowNode, WebflowStyle } from "./webflow-converter";
import type { EnhancedTokenExtraction, TokenVariable, RadiusToken, ShadowToken } from "./token-extractor";

interface StyleGuideOptions {
  namespace?: string;
  includeTitle?: boolean;
}

type InlineStyleAttr = { name: string; value: string };
type StyleMap = typeof ISOLATED_STYLES;

// Self-contained, isolated styles that won't conflict
const ISOLATED_STYLES = {
  // Container and layout
  container: "box-sizing: border-box; width: 100%; max-width: 1200px; margin: 0 auto; padding: 48px 32px; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5;",
  section: "box-sizing: border-box; margin: 0 0 64px 0; padding: 0 0 48px 0; border-bottom: 2px solid #e2e8f0;",
  sectionLast: "box-sizing: border-box; margin: 0; padding: 0; border-bottom: none;",
  
  // Typography
  mainHeading: "box-sizing: border-box; font-size: 48px; line-height: 1.2; font-weight: 700; margin: 0 0 12px 0; padding: 0; color: #0f172a; letter-spacing: -0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  subtitle: "box-sizing: border-box; font-size: 18px; line-height: 1.6; font-weight: 400; margin: 0 0 48px 0; padding: 0; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  sectionHeading: "box-sizing: border-box; font-size: 32px; line-height: 1.3; font-weight: 700; margin: 0 0 24px 0; padding: 0; color: #1e293b; letter-spacing: -0.01em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  categoryHeading: "box-sizing: border-box; font-size: 20px; line-height: 1.4; font-weight: 600; margin: 32px 0 16px 0; padding: 0; color: #334155; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  text: "box-sizing: border-box; font-size: 16px; line-height: 1.6; font-weight: 400; margin: 0 0 8px 0; padding: 0; color: #475569; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  
  // Component styles
  grid: "box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; margin: 24px 0; padding: 0;",
  card: "box-sizing: border-box; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);",
  swatch: "box-sizing: border-box; width: 100%; height: 100px; border-radius: 8px; margin: 0 0 12px 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);",
  label: "box-sizing: border-box; font-size: 14px; line-height: 1.4; font-weight: 600; margin: 0 0 4px 0; padding: 0; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  value: "box-sizing: border-box; font-size: 13px; line-height: 1.4; font-weight: 400; margin: 0; padding: 0; color: #64748b; font-family: 'SF Mono', Monaco, 'Courier New', monospace;",
  
  // Visual examples
  typeSample: "box-sizing: border-box; font-size: 16px; line-height: 1.5; margin: 12px 0 0 0; padding: 0; color: #334155;",
  spacingBar: "box-sizing: border-box; height: 40px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 6px; margin: 8px 0;",
  radiusBox: "box-sizing: border-box; width: 100%; height: 80px; background: linear-gradient(135deg, #06b6d4, #3b82f6); margin: 8px 0;",
  shadowBox: "box-sizing: border-box; width: 100%; height: 100px; background: white; margin: 12px 0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 14px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  
  // UI Components
  componentGrid: "box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin: 24px 0;",
  exampleCard: "box-sizing: border-box; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);",
  exampleCardTitle: "box-sizing: border-box; font-size: 20px; line-height: 1.4; font-weight: 600; margin: 0 0 12px 0; padding: 0; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  exampleCardText: "box-sizing: border-box; font-size: 14px; line-height: 1.6; font-weight: 400; margin: 0; padding: 0; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  buttonPrimary: "box-sizing: border-box; display: inline-block; padding: 12px 24px; margin: 8px 8px 8px 0; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  buttonSecondary: "box-sizing: border-box; display: inline-block; padding: 12px 24px; margin: 8px 8px 8px 0; background: white; color: #3b82f6; border: 2px solid #3b82f6; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  buttonOutline: "box-sizing: border-box; display: inline-block; padding: 12px 24px; margin: 8px 8px 8px 0; background: transparent; color: #64748b; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  inputExample: "box-sizing: border-box; width: 100%; padding: 12px 16px; margin: 8px 0; background: white; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
  componentLabel: "box-sizing: border-box; font-size: 12px; line-height: 1.4; font-weight: 600; margin: 16px 0 8px 0; padding: 0; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"
};

/**
 * Generate a complete Webflow payload that creates a visual style guide page
 */
export function generateStyleGuidePayload(
  tokens: EnhancedTokenExtraction,
  options: StyleGuideOptions = {}
): WebflowPayload {
  const { namespace = "sg", includeTitle = true } = options;
  
  const nodes: WebflowNode[] = [];
  let nodeIdCounter = 0;

  // Helper to generate unique IDs
  const genId = (prefix: string = "node") => `${namespace}-${prefix}-${nodeIdCounter++}`;

  // Helper to create inline style attribute
  const inlineStyle = (styles: string) => ({
    name: "style",
    value: styles
  });

  const childrenIds: string[] = [];

  // Title Section with inline styles
  if (includeTitle) {
    const titleTextId = genId("title-text");
    nodes.push({
      _id: titleTextId,
      text: true,
      v: "Design System Style Guide",
    });

    const titleId = genId("title");
    nodes.push({
      _id: titleId,
      type: "Heading",
      tag: "h1",
      classes: [],
      children: [titleTextId],
      data: { 
        tag: "h1", 
        text: false,
        xattr: [inlineStyle(ISOLATED_STYLES.mainHeading)]
      },
    });

    const descTextId = genId("desc-text");
    nodes.push({
      _id: descTextId,
      text: true,
      v: "Complete documentation of design tokens and visual styles",
    });

    const descId = genId("desc");
    nodes.push({
      _id: descId,
      type: "Paragraph",
      tag: "p",
      classes: [],
      children: [descTextId],
      data: { 
        tag: "p", 
        text: false,
        xattr: [inlineStyle(ISOLATED_STYLES.subtitle)]
      },
    });

    const headerSectionId = genId("header-section");
    nodes.push({
      _id: headerSectionId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [titleId, descId],
      data: { 
        tag: "div", 
        text: false,
        xattr: [inlineStyle("box-sizing: border-box; margin: 0 0 48px 0;")]
      },
    });

    childrenIds.push(headerSectionId);
  }

  let sectionCount = 0;
  
  // Colors Section
  const colorTokens = tokens.variables.filter(v => v.type === 'color');
  if (colorTokens.length > 0) {
    const colorSectionId = generateColorsSection(colorTokens, nodes, genId, ISOLATED_STYLES, inlineStyle);
    childrenIds.push(colorSectionId);
    sectionCount++;
  }

  // Typography Section
  const typographyTokens = tokens.variables.filter(v => v.type === 'fontFamily');
  if (typographyTokens.length > 0 || tokens.fonts?.families) {
    const typographySectionId = generateTypographySection(tokens, nodes, genId, ISOLATED_STYLES, inlineStyle);
    childrenIds.push(typographySectionId);
    sectionCount++;
  }

  // Spacing Section - Show if tokens exist OR show defaults
  const spacingTokens = tokens.variables.filter(v => v.type === 'spacing');
  const spacingToShow = spacingTokens.length > 0 ? spacingTokens : [
    { cssVar: '--spacing-xs', value: '8px', type: 'spacing' as const, path: 'Spacing / xs' },
    { cssVar: '--spacing-sm', value: '16px', type: 'spacing' as const, path: 'Spacing / sm' },
    { cssVar: '--spacing-md', value: '24px', type: 'spacing' as const, path: 'Spacing / md' },
    { cssVar: '--spacing-lg', value: '48px', type: 'spacing' as const, path: 'Spacing / lg' },
    { cssVar: '--spacing-xl', value: '96px', type: 'spacing' as const, path: 'Spacing / xl' },
  ];
  const spacingSectionId = generateSpacingSection(spacingToShow, nodes, genId, ISOLATED_STYLES, inlineStyle);
  childrenIds.push(spacingSectionId);
  sectionCount++;

  // Radius Section
  if (tokens.radius && tokens.radius.length > 0) {
    const radiusSectionId = generateRadiusSection(tokens.radius, nodes, genId, ISOLATED_STYLES, inlineStyle);
    childrenIds.push(radiusSectionId);
    sectionCount++;
  }

  // Shadows Section
  if (tokens.shadows && tokens.shadows.length > 0) {
    const shadowsSectionId = generateShadowsSection(tokens.shadows, nodes, genId, ISOLATED_STYLES, inlineStyle);
    childrenIds.push(shadowsSectionId);
    sectionCount++;
  }

  // UI Components Section - ALWAYS show this with examples
  const uiComponentsSectionId = generateUIComponentsSection(tokens, nodes, genId, ISOLATED_STYLES, inlineStyle);
  childrenIds.push(uiComponentsSectionId);
  sectionCount++;

  // Mark last section to remove bottom border
  if (childrenIds.length > 0) {
    const lastSectionNode = nodes.find(n => n._id === childrenIds[childrenIds.length - 1]);
    if (lastSectionNode && lastSectionNode.data && lastSectionNode.data.xattr) {
      lastSectionNode.data.xattr = [inlineStyle(ISOLATED_STYLES.sectionLast)];
    }
  }

  // Root container with inline styles
  const containerId = genId("container");
  nodes.push({
    _id: containerId,
    type: "Block",
    tag: "div",
    classes: [],
    children: childrenIds,
    data: { 
      tag: "div", 
      text: false,
      xattr: [inlineStyle(ISOLATED_STYLES.container)]
    },
  });

  return {
    type: "@webflow/XscpData",
    payload: {
      nodes: nodes.reverse(),
      styles: [], // No class styles needed - all inline!
      assets: [],
      ix1: [],
      ix2: { interactions: [], events: [], actionLists: [] },
    },
    meta: {
      unlinkedSymbolCount: 0,
      droppedLinks: 0,
      dynBindRemovedCount: 0,
      dynListBindRemovedCount: 0,
      paginationRemovedCount: 0,
      hasEmbedCSS: false,
      hasEmbedJS: false,
      embedCSSSize: 0,
      embedJSSize: 0,
    },
  };
}

function generateColorsSection(
  colorTokens: TokenVariable[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  STYLES: StyleMap,
  inlineStyle: (styles: string) => InlineStyleAttr
): string {
  const sectionChildren: string[] = [];

  // Section title
  const titleTextId = genId("colors-title-text");
  nodes.push({ _id: titleTextId, text: true, v: "Colors" });

  const titleId = genId("colors-title");
  nodes.push({
    _id: titleId,
    type: "Heading",
    tag: "h2",
    classes: [],
    children: [titleTextId],
    data: { tag: "h2", text: false, xattr: [inlineStyle(STYLES.sectionHeading)] },
  });
  sectionChildren.push(titleId);

  // Color swatches grid
  const swatchIds: string[] = [];
  colorTokens.forEach((token) => {
    const value = token.values?.light || token.value || '';
    const name = token.cssVar.replace('--', '');

    // Swatch
    const swatchId = genId("color-swatch");
    nodes.push({
      _id: swatchId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [],
      data: { tag: "div", text: false, xattr: [inlineStyle(`${STYLES.swatch}background-color: ${value};`)] },
    });

    // Name label
    const nameLabelTextId = genId("color-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("color-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [nameLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.label)] },
    });

    // Value label
    const valueLabelTextId = genId("color-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: value });

    const valueLabelId = genId("color-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [valueLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.value)] },
    });

    // Card container
    const cardId = genId("color-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [swatchId, nameLabelId, valueLabelId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.card)] },
    });

    swatchIds.push(cardId);
  });

  // Grid container
  const gridId = genId("colors-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [],
    children: swatchIds,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.grid)] },
  });
  sectionChildren.push(gridId);

  // Section container
  const sectionId = genId("colors-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [],
    children: sectionChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.section)] },
  });

  return sectionId;
}

function generateTypographySection(
  tokens: EnhancedTokenExtraction,
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  STYLES: StyleMap,
  inlineStyle: (styles: string) => InlineStyleAttr
): string {
  const sectionChildren: string[] = [];

  // Section title
  const titleTextId = genId("typo-title-text");
  nodes.push({ _id: titleTextId, text: true, v: "Typography" });

  const titleId = genId("typo-title");
  nodes.push({
    _id: titleId,
    type: "Heading",
    tag: "h2",
    classes: [],
    children: [titleTextId],
    data: { tag: "h2", text: false, xattr: [inlineStyle(STYLES.sectionHeading)] },
  });
  sectionChildren.push(titleId);

  // Font families
  if (tokens.fonts?.families && tokens.fonts.families.length > 0) {
    tokens.fonts.families.forEach((family) => {
      const familyTextId = genId("font-family-text");
      nodes.push({
        _id: familyTextId,
        text: true,
        v: `${family}: The quick brown fox jumps over the lazy dog 0123456789`,
      });

      const familyId = genId("font-family");
      nodes.push({
        _id: familyId,
        type: "Paragraph",
        tag: "p",
        classes: [],
        children: [familyTextId],
        data: { 
          tag: "p", 
          text: false, 
          xattr: [inlineStyle(`${STYLES.typeSample}font-family: ${family};`)] 
        },
      });

      sectionChildren.push(familyId);
    });
  }

  // Section container
  const sectionId = genId("typo-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [],
    children: sectionChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.section)] },
  });

  return sectionId;
}

function generateSpacingSection(
  spacingTokens: TokenVariable[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  STYLES: StyleMap,
  inlineStyle: (styles: string) => InlineStyleAttr
): string {
  const sectionChildren: string[] = [];

  // Section title
  const titleTextId = genId("spacing-title-text");
  nodes.push({ _id: titleTextId, text: true, v: "Spacing" });

  const titleId = genId("spacing-title");
  nodes.push({
    _id: titleId,
    type: "Heading",
    tag: "h2",
    classes: [],
    children: [titleTextId],
    data: { tag: "h2", text: false, xattr: [inlineStyle(STYLES.sectionHeading)] },
  });
  sectionChildren.push(titleId);

  // Spacing tokens
  const cardIds: string[] = [];
  spacingTokens.forEach((token) => {
    const name = token.cssVar.replace('--', '');
    const value = token.value || '';
    
    // Parse value to number for visual bar
    const numericValue = parseFloat(value);
    const widthPercent = Math.min((numericValue / 120) * 100, 100); // Scale to 120px max

    // Name label
    const nameLabelTextId = genId("spacing-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("spacing-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [nameLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.label)] },
    });

    // Value label
    const valueLabelTextId = genId("spacing-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: value });

    const valueLabelId = genId("spacing-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [valueLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.value)] },
    });

    // Visual bar
    const barId = genId("spacing-bar");
    nodes.push({
      _id: barId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [],
      data: { tag: "div", text: false, xattr: [inlineStyle(`${STYLES.spacingBar}width: ${widthPercent}%;`)] },
    });

    // Card container
    const cardId = genId("spacing-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [nameLabelId, valueLabelId, barId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.card)] },
    });

    cardIds.push(cardId);
  });

  // Grid container
  const gridId = genId("spacing-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [],
    children: cardIds,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.grid)] },
  });
  sectionChildren.push(gridId);

  // Section container
  const sectionId = genId("spacing-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [],
    children: sectionChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.section)] },
  });

  return sectionId;
}

function generateRadiusSection(
  radiusTokens: RadiusToken[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  STYLES: StyleMap,
  inlineStyle: (styles: string) => InlineStyleAttr
): string {
  const sectionChildren: string[] = [];

  // Section title
  const titleTextId = genId("radius-title-text");
  nodes.push({ _id: titleTextId, text: true, v: "Border Radius" });

  const titleId = genId("radius-title");
  nodes.push({
    _id: titleId,
    type: "Heading",
    tag: "h2",
    classes: [],
    children: [titleTextId],
    data: { tag: "h2", text: false, xattr: [inlineStyle(STYLES.sectionHeading)] },
  });
  sectionChildren.push(titleId);

  // Radius tokens
  const cardIds: string[] = [];
  radiusTokens.forEach((token) => {
    const name = token.name;
    const value = token.value;

    // Name label
    const nameLabelTextId = genId("radius-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("radius-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [nameLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.label)] },
    });

    // Value label
    const valueLabelTextId = genId("radius-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: value });

    const valueLabelId = genId("radius-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [valueLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.value)] },
    });

    // Visual box with radius
    const boxId = genId("radius-box");
    nodes.push({
      _id: boxId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [],
      data: { tag: "div", text: false, xattr: [inlineStyle(`${STYLES.radiusBox}border-radius: ${value};`)] },
    });

    // Card container
    const cardId = genId("radius-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [nameLabelId, valueLabelId, boxId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.card)] },
    });

    cardIds.push(cardId);
  });

  // Grid container
  const gridId = genId("radius-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [],
    children: cardIds,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.grid)] },
  });
  sectionChildren.push(gridId);

  // Section container
  const sectionId = genId("radius-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [],
    children: sectionChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.section)] },
  });

  return sectionId;
}

function generateShadowsSection(
  shadowTokens: ShadowToken[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  STYLES: StyleMap,
  inlineStyle: (styles: string) => InlineStyleAttr
): string {
  const sectionChildren: string[] = [];

  // Section title
  const titleTextId = genId("shadows-title-text");
  nodes.push({ _id: titleTextId, text: true, v: "Shadows" });

  const titleId = genId("shadows-title");
  nodes.push({
    _id: titleId,
    type: "Heading",
    tag: "h2",
    classes: [],
    children: [titleTextId],
    data: { tag: "h2", text: false, xattr: [inlineStyle(STYLES.sectionHeading)] },
  });
  sectionChildren.push(titleId);

  // Shadow tokens
  const cardIds: string[] = [];
  shadowTokens.forEach((token) => {
    const name = token.name;
    const value = token.value;

    // Name label
    const nameLabelTextId = genId("shadow-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("shadow-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [nameLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.label)] },
    });

    // Value label
    const valueLabelTextId = genId("shadow-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: value });

    const valueLabelId = genId("shadow-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [valueLabelTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.value)] },
    });

    // Visual box with shadow
    const boxTextId = genId("shadow-box-text");
    nodes.push({ _id: boxTextId, text: true, v: "Preview" });

    const boxId = genId("shadow-box");
    nodes.push({
      _id: boxId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [boxTextId],
      data: { tag: "div", text: false, xattr: [inlineStyle(`${STYLES.shadowBox}box-shadow: ${value};`)] },
    });

    // Card container
    const cardId = genId("shadow-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [],
      children: [nameLabelId, valueLabelId, boxId],
      data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.card)] },
    });

    cardIds.push(cardId);
  });

  // Grid container
  const gridId = genId("shadows-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [],
    children: cardIds,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.grid)] },
  });
  sectionChildren.push(gridId);

  // Section container
  const sectionId = genId("shadows-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [],
    children: sectionChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.section)] },
  });

  return sectionId;
}

function generateUIComponentsSection(
  tokens: EnhancedTokenExtraction,
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  STYLES: StyleMap,
  inlineStyle: (styles: string) => InlineStyleAttr
): string {
  const sectionChildren: string[] = [];

  // Section title
  const titleTextId = genId("ui-title-text");
  nodes.push({ _id: titleTextId, text: true, v: "UI Components" });

  const titleId = genId("ui-title");
  nodes.push({
    _id: titleId,
    type: "Heading",
    tag: "h2",
    classes: [],
    children: [titleTextId],
    data: { tag: "h2", text: false, xattr: [inlineStyle(STYLES.sectionHeading)] },
  });
  sectionChildren.push(titleId);

  // Description
  const descTextId = genId("ui-desc-text");
  nodes.push({ _id: descTextId, text: true, v: "Example components using your design tokens" });

  const descId = genId("ui-desc");
  nodes.push({
    _id: descId,
    type: "Paragraph",
    tag: "p",
    classes: [],
    children: [descTextId],
    data: { tag: "p", text: false, xattr: [inlineStyle(STYLES.text)] },
  });
  sectionChildren.push(descId);

  const componentCards: string[] = [];

  // === BUTTONS EXAMPLE ===
  const buttonsCardChildren: string[] = [];

  // Buttons label
  const buttonsLabelTextId = genId("buttons-label-text");
  nodes.push({ _id: buttonsLabelTextId, text: true, v: "Buttons" });

  const buttonsLabelId = genId("buttons-label");
  nodes.push({
    _id: buttonsLabelId,
    type: "Block",
    tag: "div",
    classes: [],
    children: [buttonsLabelTextId],
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.componentLabel)] },
  });
  buttonsCardChildren.push(buttonsLabelId);

  // Button container
  const buttonIds: string[] = [];

  // Primary button
  const btnPrimaryTextId = genId("btn-primary-text");
  nodes.push({ _id: btnPrimaryTextId, text: true, v: "Primary" });

  const btnPrimaryId = genId("btn-primary");
  nodes.push({
    _id: btnPrimaryId,
    type: "Block",
    tag: "button",
    classes: [],
    children: [btnPrimaryTextId],
    data: { tag: "button", text: false, xattr: [inlineStyle(STYLES.buttonPrimary)] },
  });
  buttonIds.push(btnPrimaryId);

  // Secondary button
  const btnSecondaryTextId = genId("btn-secondary-text");
  nodes.push({ _id: btnSecondaryTextId, text: true, v: "Secondary" });

  const btnSecondaryId = genId("btn-secondary");
  nodes.push({
    _id: btnSecondaryId,
    type: "Block",
    tag: "button",
    classes: [],
    children: [btnSecondaryTextId],
    data: { tag: "button", text: false, xattr: [inlineStyle(STYLES.buttonSecondary)] },
  });
  buttonIds.push(btnSecondaryId);

  // Outline button
  const btnOutlineTextId = genId("btn-outline-text");
  nodes.push({ _id: btnOutlineTextId, text: true, v: "Outline" });

  const btnOutlineId = genId("btn-outline");
  nodes.push({
    _id: btnOutlineId,
    type: "Block",
    tag: "button",
    classes: [],
    children: [btnOutlineTextId],
    data: { tag: "button", text: false, xattr: [inlineStyle(STYLES.buttonOutline)] },
  });
  buttonIds.push(btnOutlineId);

  // Buttons container
  const buttonsContainerId = genId("buttons-container");
  nodes.push({
    _id: buttonsContainerId,
    type: "Block",
    tag: "div",
    classes: [],
    children: buttonIds,
    data: { tag: "div", text: false, xattr: [inlineStyle("box-sizing: border-box; margin: 12px 0;")] },
  });
  buttonsCardChildren.push(buttonsContainerId);

  // Buttons card
  const buttonsCardId = genId("buttons-card");
  nodes.push({
    _id: buttonsCardId,
    type: "Block",
    tag: "div",
    classes: [],
    children: buttonsCardChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.exampleCard)] },
  });
  componentCards.push(buttonsCardId);

  // === CARD EXAMPLE ===
  const cardExampleChildren: string[] = [];

  // Card label
  const cardLabelTextId = genId("card-label-text");
  nodes.push({ _id: cardLabelTextId, text: true, v: "Card" });

  const cardLabelId = genId("card-label");
  nodes.push({
    _id: cardLabelId,
    type: "Block",
    tag: "div",
    classes: [],
    children: [cardLabelTextId],
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.componentLabel)] },
  });
  cardExampleChildren.push(cardLabelId);

  // Example card title
  const exampleCardTitleTextId = genId("example-card-title-text");
  nodes.push({ _id: exampleCardTitleTextId, text: true, v: "Card Title" });

  const exampleCardTitleId = genId("example-card-title");
  nodes.push({
    _id: exampleCardTitleId,
    type: "Heading",
    tag: "h3",
    classes: [],
    children: [exampleCardTitleTextId],
    data: { tag: "h3", text: false, xattr: [inlineStyle(STYLES.exampleCardTitle)] },
  });

  // Example card text
  const exampleCardTextTextId = genId("example-card-text-text");
  nodes.push({ _id: exampleCardTextTextId, text: true, v: "This is an example card component showing how your design tokens work together." });

  const exampleCardTextId = genId("example-card-text");
  nodes.push({
    _id: exampleCardTextId,
    type: "Paragraph",
    tag: "p",
    classes: [],
    children: [exampleCardTextTextId],
    data: { tag: "p", text: false, xattr: [inlineStyle(STYLES.exampleCardText)] },
  });

  // Nested example card
  const nestedCardId = genId("nested-example-card");
  nodes.push({
    _id: nestedCardId,
    type: "Block",
    tag: "div",
    classes: [],
    children: [exampleCardTitleId, exampleCardTextId],
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.exampleCard)] },
  });
  cardExampleChildren.push(nestedCardId);

  // Card example container
  const cardExampleId = genId("card-example");
  nodes.push({
    _id: cardExampleId,
    type: "Block",
    tag: "div",
    classes: [],
    children: cardExampleChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.exampleCard)] },
  });
  componentCards.push(cardExampleId);

  // === INPUT EXAMPLE ===
  const inputExampleChildren: string[] = [];

  // Input label
  const inputLabelTextId = genId("input-label-text");
  nodes.push({ _id: inputLabelTextId, text: true, v: "Input" });

  const inputLabelId = genId("input-label");
  nodes.push({
    _id: inputLabelId,
    type: "Block",
    tag: "div",
    classes: [],
    children: [inputLabelTextId],
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.componentLabel)] },
  });
  inputExampleChildren.push(inputLabelId);

  // Input field (using div as Webflow doesn't support input in clipboard)
  const inputFieldTextId = genId("input-field-text");
  nodes.push({ _id: inputFieldTextId, text: true, v: "Email address" });

  const inputFieldId = genId("input-field");
  nodes.push({
    _id: inputFieldId,
    type: "Block",
    tag: "div",
    classes: [],
    children: [inputFieldTextId],
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.inputExample)] },
  });
  inputExampleChildren.push(inputFieldId);

  // Input example card
  const inputExampleId = genId("input-example");
  nodes.push({
    _id: inputExampleId,
    type: "Block",
    tag: "div",
    classes: [],
    children: inputExampleChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.exampleCard)] },
  });
  componentCards.push(inputExampleId);

  // Grid container for all component examples
  const gridId = genId("ui-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [],
    children: componentCards,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.componentGrid)] },
  });
  sectionChildren.push(gridId);

  // Section container
  const sectionId = genId("ui-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [],
    children: sectionChildren,
    data: { tag: "div", text: false, xattr: [inlineStyle(STYLES.section)] },
  });

  return sectionId;
}
