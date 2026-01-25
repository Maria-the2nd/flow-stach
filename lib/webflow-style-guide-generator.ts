/**
 * Webflow Style Guide Generator - Class-based styles
 * Generates a Webflow-pasteable payload with real class styles
 * so users can edit tokens in Webflow's Style panel.
 */

import type { WebflowPayload, WebflowNode, WebflowStyle } from "./webflow-converter";
import type { EnhancedTokenExtraction, TokenVariable, RadiusToken, ShadowToken } from "./token-extractor";

interface StyleGuideOptions {
  namespace?: string;
  includeTitle?: boolean;
}

type StyleMap = {
  container: string;
  section: string;
  sectionLast: string;
  mainHeading: string;
  subtitle: string;
  sectionHeading: string;
  text: string;
  grid: string;
  card: string;
  swatch: string;
  label: string;
  value: string;
  typeSample: string;
  spacingBar: string;
  radiusBox: string;
  shadowBox: string;
  componentGrid: string;
  exampleCard: string;
  exampleCardTitle: string;
  exampleCardText: string;
  buttonPrimary: string;
  buttonSecondary: string;
  buttonOutline: string;
  inputExample: string;
  componentLabel: string;
  buttonsContainer: string;
  headerSection: string;
  sectionTitleWrap: string;
};

function generateUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "style";
}

function parseVarExpression(value: string): { name: string; fallback?: string } | null {
  const match = value.match(/var\((--[^,\s)]+)(?:,\s*([^\)]+))?\)/i);
  if (!match) return null;
  return { name: match[1], fallback: match[2]?.trim() };
}

function resolveCssValue(value: string | undefined, tokenMap: Map<string, string>, depth: number = 0): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("var(--")) {
    return trimmed;
  }
  const expr = parseVarExpression(trimmed);
  if (!expr || depth > 4) return null;
  const resolved = tokenMap.get(expr.name);
  if (resolved && !resolved.includes("var(--")) {
    return resolved;
  }
  if (resolved) {
    return resolveCssValue(resolved, tokenMap, depth + 1);
  }
  if (expr.fallback && !expr.fallback.includes("var(--")) {
    return expr.fallback;
  }
  return null;
}

function ensureLiteralValue(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return value.includes("var(--") ? fallback : value;
}

function buildTokenValueMap(tokens: EnhancedTokenExtraction): Map<string, string> {
  const rawMap = new Map<string, string>();
  tokens.variables.forEach((token) => {
    const raw = token.values?.light || token.value;
    if (raw) rawMap.set(token.cssVar, raw);
  });

  const resolvedMap = new Map<string, string>();
  for (const [key, raw] of rawMap.entries()) {
    const resolved = resolveCssValue(raw, rawMap);
    if (resolved && !resolved.includes("var(--")) {
      resolvedMap.set(key, resolved);
    }
  }
  return resolvedMap;
}

function getTokenValue(token: TokenVariable, tokenMap: Map<string, string>, fallback: string): string {
  const raw = token.values?.light || token.value || "";
  const resolved = resolveCssValue(raw, tokenMap);
  return resolved || fallback;
}

function pickTokenByNeedle(tokens: TokenVariable[], tokenMap: Map<string, string>, needles: string[]): string | null {
  const lowered = needles.map((needle) => needle.toLowerCase());
  for (const token of tokens) {
    const path = token.path.toLowerCase();
    const varName = token.cssVar.toLowerCase();
    if (lowered.some((needle) => path.includes(needle) || varName.includes(needle))) {
      return getTokenValue(token, tokenMap, "");
    }
  }
  return null;
}

function pickSpacingValue(tokens: TokenVariable[], tokenMap: Map<string, string>, needles: string[], fallback: string): string {
  const value = pickTokenByNeedle(tokens, tokenMap, needles);
  return value || fallback;
}

function pickColorValue(
  tokens: TokenVariable[],
  tokenMap: Map<string, string>,
  needles: string[],
  fallback: string,
  options?: { exclude?: string[] }
): string {
  const excluded = options?.exclude?.map((item) => item.toLowerCase()) || [];
  const filtered = tokens.filter((token) => {
    const key = `${token.cssVar} ${token.path}`.toLowerCase();
    return !excluded.some((word) => key.includes(word));
  });
  const value = pickTokenByNeedle(filtered, tokenMap, needles) || pickTokenByNeedle(tokens, tokenMap, needles);
  return value || fallback;
}

function buildBaseStyles(tokens: EnhancedTokenExtraction): StyleMap {
  const tokenMap = buildTokenValueMap(tokens);
  const colorTokens = tokens.variables.filter((token) => token.type === "color");
  const spacingTokens = tokens.variables.filter((token) => token.type === "spacing");
  const fontTokens = tokens.variables.filter((token) => token.type === "fontFamily");

  const bg = pickColorValue(colorTokens, tokenMap, ["background / base", "background", "bg"], "#ffffff", {
    exclude: ["dark", "footer"],
  });
  const cardBg = pickColorValue(colorTokens, tokenMap, ["background / card", "card", "surface"], "#f8fafc");
  const textStrong = pickColorValue(colorTokens, tokenMap, ["text / primary", "text / heading", "text-strong", "text"], "#0f172a");
  const textMuted = pickColorValue(colorTokens, tokenMap, ["text / muted", "muted"], "#64748b");
  const textBody = pickColorValue(colorTokens, tokenMap, ["text / body", "text"], "#334155");
  const border = pickColorValue(colorTokens, tokenMap, ["border"], "#e2e8f0");
  const borderStrong = pickColorValue(colorTokens, tokenMap, ["border", "outline"], "#cbd5e1");

  const spacingXl = pickSpacingValue(spacingTokens, tokenMap, ["xl", "xlarge"], "96px");
  const spacingLg = pickSpacingValue(spacingTokens, tokenMap, ["lg", "large"], "48px");
  const spacingMd = pickSpacingValue(spacingTokens, tokenMap, ["md", "medium"], "24px");
  const spacingSm = pickSpacingValue(spacingTokens, tokenMap, ["sm", "small"], "16px");
  const spacingXs = pickSpacingValue(spacingTokens, tokenMap, ["xs", "xsmall"], "8px");

  const fontFamilyPrimary =
    tokens.fonts?.families?.[0] ||
    (fontTokens.length > 0 ? getTokenValue(fontTokens[0], tokenMap, "") : "") ||
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const accentOne = pickColorValue(colorTokens, tokenMap, ["accent", "primary"], "#3b82f6");
  const accentTwo = pickColorValue(colorTokens, tokenMap, ["secondary", "accent-2"], "#8b5cf6");
  const accentThree = pickColorValue(colorTokens, tokenMap, ["accent-3", "tertiary"], "#06b6d4");

  return {
    container: `box-sizing: border-box; width: 100%; max-width: 1200px; margin: 0 auto; padding: ${spacingLg} ${spacingMd}; background: ${bg}; font-family: ${fontFamilyPrimary}; line-height: 1.5;`,
    section: `box-sizing: border-box; margin: 0 0 ${spacingLg} 0; padding: 0 0 ${spacingMd} 0; border-bottom: 2px solid ${border};`,
    sectionLast: "box-sizing: border-box; margin: 0; padding: 0; border-bottom: none;",
    mainHeading: `box-sizing: border-box; font-size: 48px; line-height: 1.2; font-weight: 700; margin: 0 0 ${spacingXs} 0; padding: 0; color: ${textStrong}; letter-spacing: -0.02em; font-family: ${fontFamilyPrimary};`,
    subtitle: `box-sizing: border-box; font-size: 18px; line-height: 1.6; font-weight: 400; margin: 0 0 ${spacingLg} 0; padding: 0; color: ${textMuted}; font-family: ${fontFamilyPrimary};`,
    sectionHeading: `box-sizing: border-box; font-size: 32px; line-height: 1.3; font-weight: 700; margin: 0 0 ${spacingSm} 0; padding: 0; color: ${textStrong}; letter-spacing: -0.01em; font-family: ${fontFamilyPrimary};`,
    text: `box-sizing: border-box; font-size: 16px; line-height: 1.6; font-weight: 400; margin: 0 0 ${spacingXs} 0; padding: 0; color: ${textBody}; font-family: ${fontFamilyPrimary};`,
    grid: `box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: ${spacingSm}; margin: ${spacingSm} 0; padding: 0;`,
    card: `box-sizing: border-box; background: ${cardBg}; border: 1px solid ${border}; border-radius: 12px; padding: ${spacingSm}; box-shadow: 0 1px 3px rgba(0,0,0,0.05);`,
    swatch: "box-sizing: border-box; width: 100%; height: 100px; border-radius: 8px; margin: 0 0 12px 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.1);",
    label: `box-sizing: border-box; font-size: 14px; line-height: 1.4; font-weight: 600; margin: 0 0 4px 0; padding: 0; color: ${textStrong}; font-family: ${fontFamilyPrimary};`,
    value: `box-sizing: border-box; font-size: 13px; line-height: 1.4; font-weight: 400; margin: 0; padding: 0; color: ${textMuted}; font-family: 'SF Mono', Monaco, 'Courier New', monospace;`,
    typeSample: `box-sizing: border-box; font-size: 16px; line-height: 1.5; margin: ${spacingXs} 0 0 0; padding: 0; color: ${textBody};`,
    spacingBar: `box-sizing: border-box; height: 40px; background: linear-gradient(135deg, ${accentOne}, ${accentTwo}); border-radius: 6px; margin: 8px 0;`,
    radiusBox: `box-sizing: border-box; width: 100%; height: 80px; background: linear-gradient(135deg, ${accentThree}, ${accentOne}); margin: 8px 0;`,
    shadowBox: `box-sizing: border-box; width: 100%; height: 100px; background: ${bg}; margin: 12px 0; display: flex; align-items: center; justify-content: center; color: ${textMuted}; font-size: 14px; font-family: ${fontFamilyPrimary};`,
    componentGrid: `box-sizing: border-box; display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: ${spacingSm}; margin: ${spacingSm} 0;`,
    exampleCard: `box-sizing: border-box; background: ${bg}; border: 1px solid ${border}; border-radius: 16px; padding: ${spacingMd}; box-shadow: 0 4px 6px rgba(0,0,0,0.05);`,
    exampleCardTitle: `box-sizing: border-box; font-size: 20px; line-height: 1.4; font-weight: 600; margin: 0 0 ${spacingXs} 0; padding: 0; color: ${textStrong}; font-family: ${fontFamilyPrimary};`,
    exampleCardText: `box-sizing: border-box; font-size: 14px; line-height: 1.6; font-weight: 400; margin: 0; padding: 0; color: ${textMuted}; font-family: ${fontFamilyPrimary};`,
    buttonPrimary: `box-sizing: border-box; display: inline-block; padding: 12px 24px; margin: 8px 8px 8px 0; background: ${accentOne}; color: ${bg}; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: ${fontFamilyPrimary};`,
    buttonSecondary: `box-sizing: border-box; display: inline-block; padding: 12px 24px; margin: 8px 8px 8px 0; background: ${bg}; color: ${accentOne}; border: 2px solid ${accentOne}; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: ${fontFamilyPrimary};`,
    buttonOutline: `box-sizing: border-box; display: inline-block; padding: 12px 24px; margin: 8px 8px 8px 0; background: transparent; color: ${textMuted}; border: 1px solid ${borderStrong}; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: ${fontFamilyPrimary};`,
    inputExample: `box-sizing: border-box; width: 100%; padding: 12px 16px; margin: 8px 0; background: ${bg}; border: 1px solid ${borderStrong}; border-radius: 8px; font-size: 14px; color: ${textStrong}; font-family: ${fontFamilyPrimary};`,
    componentLabel: `box-sizing: border-box; font-size: 12px; line-height: 1.4; font-weight: 600; margin: ${spacingXs} 0 8px 0; padding: 0; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.05em; font-family: ${fontFamilyPrimary};`,
    buttonsContainer: `box-sizing: border-box; margin: ${spacingXs} 0;`,
    headerSection: `box-sizing: border-box; margin: 0 0 ${spacingMd} 0;`,
    sectionTitleWrap: `box-sizing: border-box; margin: 0 0 ${spacingSm} 0;`,
  };
}

function createStyleHelpers(namespace: string, styles: WebflowStyle[]) {
  const nameToId = new Map<string, string>();

  const addStyle = (name: string, styleLess: string, options?: { rawName?: boolean }): string => {
    const className = options?.rawName ? name : `${namespace}-${slugify(name)}`;
    const existingId = nameToId.get(className);
    if (existingId) return existingId;

    const id = generateUUID();
    styles.push({
      _id: id,
      fake: false,
      type: "class",
      name: className,
      namespace: "",
      comb: "",
      styleLess: styleLess.trim(),
      variants: {},
      children: [],
    });
    nameToId.set(className, id);
    return id;
  };

  return { addStyle };
}

function tokenClassNameFromVar(cssVar: string): string {
  return cssVar.replace(/^--/, "");
}

/**
 * Generate a complete Webflow payload that creates a visual style guide page
 */
export function generateStyleGuidePayload(
  tokens: EnhancedTokenExtraction,
  options: StyleGuideOptions = {}
): WebflowPayload {
  const { namespace = "sg", includeTitle = true } = options;

  const nodes: WebflowNode[] = [];
  const styles: WebflowStyle[] = [];
  let nodeIdCounter = 0;

  const { addStyle } = createStyleHelpers(namespace, styles);
  const baseStyles = buildBaseStyles(tokens);
  const tokenMap = buildTokenValueMap(tokens);

  // Helper to generate unique IDs
  const genId = (prefix: string = "node") => `${namespace}-${prefix}-${nodeIdCounter++}`;

  // Base style class IDs
  const containerClass = addStyle("container", baseStyles.container);
  const sectionClass = addStyle("section", baseStyles.section);
  const sectionLastClass = addStyle("section-last", baseStyles.sectionLast);
  const mainHeadingClass = addStyle("main-heading", baseStyles.mainHeading);
  const subtitleClass = addStyle("subtitle", baseStyles.subtitle);
  const sectionHeadingClass = addStyle("section-heading", baseStyles.sectionHeading);
  const textClass = addStyle("text", baseStyles.text);
  const gridClass = addStyle("grid", baseStyles.grid);
  const cardClass = addStyle("card", baseStyles.card);
  const swatchClass = addStyle("swatch", baseStyles.swatch);
  const labelClass = addStyle("label", baseStyles.label);
  const valueClass = addStyle("value", baseStyles.value);
  const typeSampleClass = addStyle("type-sample", baseStyles.typeSample);
  const spacingBarClass = addStyle("spacing-bar", baseStyles.spacingBar);
  const radiusBoxClass = addStyle("radius-box", baseStyles.radiusBox);
  const shadowBoxClass = addStyle("shadow-box", baseStyles.shadowBox);
  const componentGridClass = addStyle("component-grid", baseStyles.componentGrid);
  const exampleCardClass = addStyle("example-card", baseStyles.exampleCard);
  const exampleCardTitleClass = addStyle("example-card-title", baseStyles.exampleCardTitle);
  const exampleCardTextClass = addStyle("example-card-text", baseStyles.exampleCardText);
  const buttonPrimaryClass = addStyle("button-primary", baseStyles.buttonPrimary);
  const buttonSecondaryClass = addStyle("button-secondary", baseStyles.buttonSecondary);
  const buttonOutlineClass = addStyle("button-outline", baseStyles.buttonOutline);
  const inputExampleClass = addStyle("input-example", baseStyles.inputExample);
  const componentLabelClass = addStyle("component-label", baseStyles.componentLabel);
  const buttonsContainerClass = addStyle("buttons-container", baseStyles.buttonsContainer);
  const headerSectionClass = addStyle("header-section", baseStyles.headerSection);
  const sectionTitleWrapClass = addStyle("section-title-wrap", baseStyles.sectionTitleWrap);

  const childrenIds: string[] = [];

  // Title Section
  if (includeTitle) {
    const titleTextId = genId("title-text");
    nodes.push({ _id: titleTextId, text: true, v: "Design System Style Guide" });

    const titleId = genId("title");
    nodes.push({
      _id: titleId,
      type: "Heading",
      tag: "h1",
      classes: [mainHeadingClass],
      children: [titleTextId],
      data: { tag: "h1", text: false },
    });

    const descTextId = genId("desc-text");
    nodes.push({ _id: descTextId, text: true, v: "Complete documentation of design tokens and visual styles" });

    const descId = genId("desc");
    nodes.push({
      _id: descId,
      type: "Paragraph",
      tag: "p",
      classes: [subtitleClass],
      children: [descTextId],
      data: { tag: "p", text: false },
    });

    const headerSectionId = genId("header-section");
    nodes.push({
      _id: headerSectionId,
      type: "Block",
      tag: "div",
      classes: [headerSectionClass],
      children: [titleId, descId],
      data: { tag: "div", text: false },
    });

    childrenIds.push(headerSectionId);
  }

  // Colors Section
  const colorTokens = tokens.variables.filter((v) => v.type === "color");
  if (colorTokens.length > 0) {
    const colorSectionId = generateColorsSection(
      colorTokens,
      nodes,
      genId,
      {
        gridClass,
        cardClass,
        swatchClass,
        labelClass,
        valueClass,
        sectionClass,
        sectionHeadingClass,
        sectionTitleWrapClass,
      },
      addStyle,
      tokenMap
    );
    childrenIds.push(colorSectionId);
  }

  // Typography Section
  if (tokens.fonts?.families && tokens.fonts.families.length > 0) {
    const typographySectionId = generateTypographySection(
      tokens.fonts.families,
      nodes,
      genId,
      {
        sectionClass,
        sectionHeadingClass,
        typeSampleClass,
        sectionTitleWrapClass,
      },
      addStyle
    );
    childrenIds.push(typographySectionId);
  }

  // Spacing Section
  const spacingTokens = tokens.variables.filter((v) => v.type === "spacing");
  const spacingToShow = spacingTokens.length > 0 ? spacingTokens : [
    { cssVar: "--spacing-xs", value: "8px", type: "spacing" as const, path: "Spacing / xs" },
    { cssVar: "--spacing-sm", value: "16px", type: "spacing" as const, path: "Spacing / sm" },
    { cssVar: "--spacing-md", value: "24px", type: "spacing" as const, path: "Spacing / md" },
    { cssVar: "--spacing-lg", value: "48px", type: "spacing" as const, path: "Spacing / lg" },
    { cssVar: "--spacing-xl", value: "96px", type: "spacing" as const, path: "Spacing / xl" },
  ];
  const spacingSectionId = generateSpacingSection(
    spacingToShow,
    nodes,
    genId,
    {
      gridClass,
      cardClass,
      labelClass,
      valueClass,
      spacingBarClass,
      sectionClass,
      sectionHeadingClass,
      sectionTitleWrapClass,
    },
    addStyle,
    tokenMap
  );
  childrenIds.push(spacingSectionId);

  // Radius Section
  if (tokens.radius && tokens.radius.length > 0) {
    const radiusSectionId = generateRadiusSection(
      tokens.radius,
      nodes,
      genId,
      {
        gridClass,
        cardClass,
        labelClass,
        valueClass,
        radiusBoxClass,
        sectionClass,
        sectionHeadingClass,
        sectionTitleWrapClass,
      },
      addStyle
    );
    childrenIds.push(radiusSectionId);
  }

  // Shadows Section
  if (tokens.shadows && tokens.shadows.length > 0) {
    const shadowsSectionId = generateShadowsSection(
      tokens.shadows,
      nodes,
      genId,
      {
        gridClass,
        cardClass,
        labelClass,
        valueClass,
        shadowBoxClass,
        sectionClass,
        sectionHeadingClass,
        sectionTitleWrapClass,
      },
      addStyle
    );
    childrenIds.push(shadowsSectionId);
  }

  // UI Components Section
  const uiComponentsSectionId = generateUIComponentsSection(
    nodes,
    genId,
    {
      sectionClass,
      sectionHeadingClass,
      textClass,
      componentGridClass,
      exampleCardClass,
      exampleCardTitleClass,
      exampleCardTextClass,
      buttonPrimaryClass,
      buttonSecondaryClass,
      buttonOutlineClass,
      inputExampleClass,
      componentLabelClass,
      buttonsContainerClass,
      sectionTitleWrapClass,
    }
  );
  childrenIds.push(uiComponentsSectionId);

  // Mark last section
  if (childrenIds.length > 0) {
    const lastSectionNode = nodes.find((node) => node._id === childrenIds[childrenIds.length - 1]);
    if (lastSectionNode && Array.isArray(lastSectionNode.classes)) {
      lastSectionNode.classes = Array.from(new Set([...lastSectionNode.classes, sectionLastClass]));
    }
  }

  // Root container
  const containerId = genId("container");
  nodes.push({
    _id: containerId,
    type: "Block",
    tag: "div",
    classes: [containerClass],
    children: childrenIds,
    data: { tag: "div", text: false },
  });

  return {
    type: "@webflow/XscpData",
    payload: {
      nodes: nodes.reverse(),
      styles,
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

function generateSectionTitle(
  title: string,
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  sectionHeadingClass: string,
  sectionTitleWrapClass: string
): string {
  const titleTextId = genId("section-title-text");
  nodes.push({ _id: titleTextId, text: true, v: title });

  const titleId = genId("section-title");
  nodes.push({
    _id: titleId,
    type: "Heading",
    tag: "h2",
    classes: [sectionHeadingClass],
    children: [titleTextId],
    data: { tag: "h2", text: false },
  });

  const wrapId = genId("section-title-wrap");
  nodes.push({
    _id: wrapId,
    type: "Block",
    tag: "div",
    classes: [sectionTitleWrapClass],
    children: [titleId],
    data: { tag: "div", text: false },
  });

  return wrapId;
}

function generateColorsSection(
  colorTokens: TokenVariable[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  classes: {
    gridClass: string;
    cardClass: string;
    swatchClass: string;
    labelClass: string;
    valueClass: string;
    sectionClass: string;
    sectionHeadingClass: string;
    sectionTitleWrapClass: string;
  },
  addStyle: (name: string, styleLess: string, options?: { rawName?: boolean }) => string,
  tokenMap: Map<string, string>
): string {
  const sectionChildren: string[] = [];
  sectionChildren.push(
    generateSectionTitle("Colors", nodes, genId, classes.sectionHeadingClass, classes.sectionTitleWrapClass)
  );

  const swatchIds: string[] = [];
  colorTokens.forEach((token) => {
    const raw = token.values?.light || token.value || "";
    const resolved = resolveCssValue(raw, tokenMap);
    const safeValue = resolved || ensureLiteralValue(raw, "#ffffff");
    const displayValue = resolved || raw || safeValue;
    const name = tokenClassNameFromVar(token.cssVar);
    const tokenClassName = name || `color-${slugify(token.cssVar)}`;
    const tokenClass = addStyle(tokenClassName, `background-color: ${safeValue};`, { rawName: true });

    const swatchId = genId("color-swatch");
    nodes.push({
      _id: swatchId,
      type: "Block",
      tag: "div",
      classes: [classes.swatchClass, tokenClass],
      children: [],
      data: { tag: "div", text: false },
    });

    const nameLabelTextId = genId("color-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("color-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.labelClass],
      children: [nameLabelTextId],
      data: { tag: "div", text: false },
    });

    const valueLabelTextId = genId("color-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: displayValue });

    const valueLabelId = genId("color-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.valueClass],
      children: [valueLabelTextId],
      data: { tag: "div", text: false },
    });

    const cardId = genId("color-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [classes.cardClass],
      children: [swatchId, nameLabelId, valueLabelId],
      data: { tag: "div", text: false },
    });

    swatchIds.push(cardId);
  });

  const gridId = genId("colors-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [classes.gridClass],
    children: swatchIds,
    data: { tag: "div", text: false },
  });
  sectionChildren.push(gridId);

  const sectionId = genId("colors-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [classes.sectionClass],
    children: sectionChildren,
    data: { tag: "div", text: false },
  });

  return sectionId;
}

function generateTypographySection(
  families: string[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  classes: {
    sectionClass: string;
    sectionHeadingClass: string;
    typeSampleClass: string;
    sectionTitleWrapClass: string;
  },
  addStyle: (name: string, styleLess: string, options?: { rawName?: boolean }) => string
): string {
  const sectionChildren: string[] = [];
  sectionChildren.push(
    generateSectionTitle("Typography", nodes, genId, classes.sectionHeadingClass, classes.sectionTitleWrapClass)
  );

  families.forEach((family) => {
    const familyClass = addStyle(`font-${slugify(family)}`, `font-family: ${family};`, { rawName: true });
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
      classes: [classes.typeSampleClass, familyClass],
      children: [familyTextId],
      data: { tag: "p", text: false },
    });

    sectionChildren.push(familyId);
  });

  const sectionId = genId("typo-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [classes.sectionClass],
    children: sectionChildren,
    data: { tag: "div", text: false },
  });

  return sectionId;
}

function generateSpacingSection(
  spacingTokens: TokenVariable[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  classes: {
    gridClass: string;
    cardClass: string;
    labelClass: string;
    valueClass: string;
    spacingBarClass: string;
    sectionClass: string;
    sectionHeadingClass: string;
    sectionTitleWrapClass: string;
  },
  addStyle: (name: string, styleLess: string, options?: { rawName?: boolean }) => string,
  tokenMap: Map<string, string>
): string {
  const sectionChildren: string[] = [];
  sectionChildren.push(
    generateSectionTitle("Spacing", nodes, genId, classes.sectionHeadingClass, classes.sectionTitleWrapClass)
  );

  const cardIds: string[] = [];
  spacingTokens.forEach((token) => {
    const name = tokenClassNameFromVar(token.cssVar);
    const rawValue = token.value || "";
    const resolved = resolveCssValue(rawValue, tokenMap);
    const safeValue = resolved || ensureLiteralValue(rawValue, "0px");
    const displayValue = resolved || rawValue || "0px";
    const tokenClassName = name || `spacing-${slugify(token.cssVar)}`;
    const tokenClass = addStyle(tokenClassName, `width: ${safeValue}; max-width: 100%;`, { rawName: true });

    const nameLabelTextId = genId("spacing-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("spacing-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.labelClass],
      children: [nameLabelTextId],
      data: { tag: "div", text: false },
    });

    const valueLabelTextId = genId("spacing-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: displayValue });

    const valueLabelId = genId("spacing-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.valueClass],
      children: [valueLabelTextId],
      data: { tag: "div", text: false },
    });

    const barId = genId("spacing-bar");
    nodes.push({
      _id: barId,
      type: "Block",
      tag: "div",
      classes: [classes.spacingBarClass, tokenClass],
      children: [],
      data: { tag: "div", text: false },
    });

    const cardId = genId("spacing-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [classes.cardClass],
      children: [nameLabelId, valueLabelId, barId],
      data: { tag: "div", text: false },
    });

    cardIds.push(cardId);
  });

  const gridId = genId("spacing-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [classes.gridClass],
    children: cardIds,
    data: { tag: "div", text: false },
  });
  sectionChildren.push(gridId);

  const sectionId = genId("spacing-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [classes.sectionClass],
    children: sectionChildren,
    data: { tag: "div", text: false },
  });

  return sectionId;
}

function generateRadiusSection(
  radiusTokens: RadiusToken[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  classes: {
    gridClass: string;
    cardClass: string;
    labelClass: string;
    valueClass: string;
    radiusBoxClass: string;
    sectionClass: string;
    sectionHeadingClass: string;
    sectionTitleWrapClass: string;
  },
  addStyle: (name: string, styleLess: string, options?: { rawName?: boolean }) => string
): string {
  const sectionChildren: string[] = [];
  sectionChildren.push(
    generateSectionTitle("Border Radius", nodes, genId, classes.sectionHeadingClass, classes.sectionTitleWrapClass)
  );

  const cardIds: string[] = [];
  radiusTokens.forEach((token) => {
    const name = token.name;
    const value = ensureLiteralValue(token.value, "0px");
    const tokenClassName = `radius-${slugify(name)}`;
    const tokenClass = addStyle(tokenClassName, `border-radius: ${value};`, { rawName: true });

    const nameLabelTextId = genId("radius-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("radius-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.labelClass],
      children: [nameLabelTextId],
      data: { tag: "div", text: false },
    });

    const valueLabelTextId = genId("radius-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: value });

    const valueLabelId = genId("radius-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.valueClass],
      children: [valueLabelTextId],
      data: { tag: "div", text: false },
    });

    const boxId = genId("radius-box");
    nodes.push({
      _id: boxId,
      type: "Block",
      tag: "div",
      classes: [classes.radiusBoxClass, tokenClass],
      children: [],
      data: { tag: "div", text: false },
    });

    const cardId = genId("radius-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [classes.cardClass],
      children: [nameLabelId, valueLabelId, boxId],
      data: { tag: "div", text: false },
    });

    cardIds.push(cardId);
  });

  const gridId = genId("radius-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [classes.gridClass],
    children: cardIds,
    data: { tag: "div", text: false },
  });
  sectionChildren.push(gridId);

  const sectionId = genId("radius-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [classes.sectionClass],
    children: sectionChildren,
    data: { tag: "div", text: false },
  });

  return sectionId;
}

function generateShadowsSection(
  shadowTokens: ShadowToken[],
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  classes: {
    gridClass: string;
    cardClass: string;
    labelClass: string;
    valueClass: string;
    shadowBoxClass: string;
    sectionClass: string;
    sectionHeadingClass: string;
    sectionTitleWrapClass: string;
  },
  addStyle: (name: string, styleLess: string, options?: { rawName?: boolean }) => string
): string {
  const sectionChildren: string[] = [];
  sectionChildren.push(
    generateSectionTitle("Shadows", nodes, genId, classes.sectionHeadingClass, classes.sectionTitleWrapClass)
  );

  const cardIds: string[] = [];
  shadowTokens.forEach((token) => {
    const name = token.name;
    const value = ensureLiteralValue(token.value, "none");
    const tokenClassName = `shadow-${slugify(name)}`;
    const tokenClass = addStyle(tokenClassName, `box-shadow: ${value};`, { rawName: true });

    const nameLabelTextId = genId("shadow-name-text");
    nodes.push({ _id: nameLabelTextId, text: true, v: name });

    const nameLabelId = genId("shadow-name");
    nodes.push({
      _id: nameLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.labelClass],
      children: [nameLabelTextId],
      data: { tag: "div", text: false },
    });

    const valueLabelTextId = genId("shadow-value-text");
    nodes.push({ _id: valueLabelTextId, text: true, v: value });

    const valueLabelId = genId("shadow-value");
    nodes.push({
      _id: valueLabelId,
      type: "Block",
      tag: "div",
      classes: [classes.valueClass],
      children: [valueLabelTextId],
      data: { tag: "div", text: false },
    });

    const boxTextId = genId("shadow-box-text");
    nodes.push({ _id: boxTextId, text: true, v: "Preview" });

    const boxId = genId("shadow-box");
    nodes.push({
      _id: boxId,
      type: "Block",
      tag: "div",
      classes: [classes.shadowBoxClass, tokenClass],
      children: [boxTextId],
      data: { tag: "div", text: false },
    });

    const cardId = genId("shadow-card");
    nodes.push({
      _id: cardId,
      type: "Block",
      tag: "div",
      classes: [classes.cardClass],
      children: [nameLabelId, valueLabelId, boxId],
      data: { tag: "div", text: false },
    });

    cardIds.push(cardId);
  });

  const gridId = genId("shadows-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [classes.gridClass],
    children: cardIds,
    data: { tag: "div", text: false },
  });
  sectionChildren.push(gridId);

  const sectionId = genId("shadows-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [classes.sectionClass],
    children: sectionChildren,
    data: { tag: "div", text: false },
  });

  return sectionId;
}

function generateUIComponentsSection(
  nodes: WebflowNode[],
  genId: (prefix?: string) => string,
  classes: {
    sectionClass: string;
    sectionHeadingClass: string;
    textClass: string;
    componentGridClass: string;
    exampleCardClass: string;
    exampleCardTitleClass: string;
    exampleCardTextClass: string;
    buttonPrimaryClass: string;
    buttonSecondaryClass: string;
    buttonOutlineClass: string;
    inputExampleClass: string;
    componentLabelClass: string;
    buttonsContainerClass: string;
    sectionTitleWrapClass: string;
  }
): string {
  const sectionChildren: string[] = [];
  sectionChildren.push(
    generateSectionTitle("UI Components", nodes, genId, classes.sectionHeadingClass, classes.sectionTitleWrapClass)
  );

  const descTextId = genId("ui-desc-text");
  nodes.push({ _id: descTextId, text: true, v: "Example components using your design tokens" });

  const descId = genId("ui-desc");
  nodes.push({
    _id: descId,
    type: "Paragraph",
    tag: "p",
    classes: [classes.textClass],
    children: [descTextId],
    data: { tag: "p", text: false },
  });
  sectionChildren.push(descId);

  const componentCards: string[] = [];

  // Buttons
  const buttonsCardChildren: string[] = [];
  const buttonsLabelTextId = genId("buttons-label-text");
  nodes.push({ _id: buttonsLabelTextId, text: true, v: "Buttons" });

  const buttonsLabelId = genId("buttons-label");
  nodes.push({
    _id: buttonsLabelId,
    type: "Block",
    tag: "div",
    classes: [classes.componentLabelClass],
    children: [buttonsLabelTextId],
    data: { tag: "div", text: false },
  });
  buttonsCardChildren.push(buttonsLabelId);

  const buttonIds: string[] = [];
  const btnPrimaryTextId = genId("btn-primary-text");
  nodes.push({ _id: btnPrimaryTextId, text: true, v: "Primary" });

  const btnPrimaryId = genId("btn-primary");
  nodes.push({
    _id: btnPrimaryId,
    type: "Block",
    tag: "button",
    classes: [classes.buttonPrimaryClass],
    children: [btnPrimaryTextId],
    data: { tag: "button", text: false },
  });
  buttonIds.push(btnPrimaryId);

  const btnSecondaryTextId = genId("btn-secondary-text");
  nodes.push({ _id: btnSecondaryTextId, text: true, v: "Secondary" });

  const btnSecondaryId = genId("btn-secondary");
  nodes.push({
    _id: btnSecondaryId,
    type: "Block",
    tag: "button",
    classes: [classes.buttonSecondaryClass],
    children: [btnSecondaryTextId],
    data: { tag: "button", text: false },
  });
  buttonIds.push(btnSecondaryId);

  const btnOutlineTextId = genId("btn-outline-text");
  nodes.push({ _id: btnOutlineTextId, text: true, v: "Outline" });

  const btnOutlineId = genId("btn-outline");
  nodes.push({
    _id: btnOutlineId,
    type: "Block",
    tag: "button",
    classes: [classes.buttonOutlineClass],
    children: [btnOutlineTextId],
    data: { tag: "button", text: false },
  });
  buttonIds.push(btnOutlineId);

  const buttonsContainerId = genId("buttons-container");
  nodes.push({
    _id: buttonsContainerId,
    type: "Block",
    tag: "div",
    classes: [classes.buttonsContainerClass],
    children: buttonIds,
    data: { tag: "div", text: false },
  });
  buttonsCardChildren.push(buttonsContainerId);

  const buttonsCardId = genId("buttons-card");
  nodes.push({
    _id: buttonsCardId,
    type: "Block",
    tag: "div",
    classes: [classes.exampleCardClass],
    children: buttonsCardChildren,
    data: { tag: "div", text: false },
  });
  componentCards.push(buttonsCardId);

  // Card Example
  const cardExampleChildren: string[] = [];
  const cardLabelTextId = genId("card-label-text");
  nodes.push({ _id: cardLabelTextId, text: true, v: "Card" });

  const cardLabelId = genId("card-label");
  nodes.push({
    _id: cardLabelId,
    type: "Block",
    tag: "div",
    classes: [classes.componentLabelClass],
    children: [cardLabelTextId],
    data: { tag: "div", text: false },
  });
  cardExampleChildren.push(cardLabelId);

  const exampleCardTitleTextId = genId("example-card-title-text");
  nodes.push({ _id: exampleCardTitleTextId, text: true, v: "Card Title" });

  const exampleCardTitleId = genId("example-card-title");
  nodes.push({
    _id: exampleCardTitleId,
    type: "Heading",
    tag: "h3",
    classes: [classes.exampleCardTitleClass],
    children: [exampleCardTitleTextId],
    data: { tag: "h3", text: false },
  });

  const exampleCardTextTextId = genId("example-card-text-text");
  nodes.push({ _id: exampleCardTextTextId, text: true, v: "This is an example card component showing how your design tokens work together." });

  const exampleCardTextId = genId("example-card-text");
  nodes.push({
    _id: exampleCardTextId,
    type: "Paragraph",
    tag: "p",
    classes: [classes.exampleCardTextClass],
    children: [exampleCardTextTextId],
    data: { tag: "p", text: false },
  });

  const nestedCardId = genId("nested-example-card");
  nodes.push({
    _id: nestedCardId,
    type: "Block",
    tag: "div",
    classes: [classes.exampleCardClass],
    children: [exampleCardTitleId, exampleCardTextId],
    data: { tag: "div", text: false },
  });
  cardExampleChildren.push(nestedCardId);

  const cardExampleId = genId("card-example");
  nodes.push({
    _id: cardExampleId,
    type: "Block",
    tag: "div",
    classes: [classes.exampleCardClass],
    children: cardExampleChildren,
    data: { tag: "div", text: false },
  });
  componentCards.push(cardExampleId);

  // Input Example
  const inputExampleChildren: string[] = [];
  const inputLabelTextId = genId("input-label-text");
  nodes.push({ _id: inputLabelTextId, text: true, v: "Input" });

  const inputLabelId = genId("input-label");
  nodes.push({
    _id: inputLabelId,
    type: "Block",
    tag: "div",
    classes: [classes.componentLabelClass],
    children: [inputLabelTextId],
    data: { tag: "div", text: false },
  });
  inputExampleChildren.push(inputLabelId);

  const inputFieldTextId = genId("input-field-text");
  nodes.push({ _id: inputFieldTextId, text: true, v: "Email address" });

  const inputFieldId = genId("input-field");
  nodes.push({
    _id: inputFieldId,
    type: "Block",
    tag: "div",
    classes: [classes.inputExampleClass],
    children: [inputFieldTextId],
    data: { tag: "div", text: false },
  });
  inputExampleChildren.push(inputFieldId);

  const inputExampleId = genId("input-example");
  nodes.push({
    _id: inputExampleId,
    type: "Block",
    tag: "div",
    classes: [classes.exampleCardClass],
    children: inputExampleChildren,
    data: { tag: "div", text: false },
  });
  componentCards.push(inputExampleId);

  const gridId = genId("ui-grid");
  nodes.push({
    _id: gridId,
    type: "Block",
    tag: "div",
    classes: [classes.componentGridClass],
    children: componentCards,
    data: { tag: "div", text: false },
  });
  sectionChildren.push(gridId);

  const sectionId = genId("ui-section");
  nodes.push({
    _id: sectionId,
    type: "Block",
    tag: "div",
    classes: [classes.sectionClass],
    children: sectionChildren,
    data: { tag: "div", text: false },
  });

  return sectionId;
}
