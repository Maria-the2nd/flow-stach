/**
 * Shared types for Flow Stach Designer Extension
 */

export interface WebflowNode {
  _id: string;
  type?: "Block" | "Link" | "Image" | "Video" | "HtmlEmbed" | "Heading" | "Paragraph" | "Section" | "List" | "ListItem";
  tag?: string;
  classes?: string[];
  children?: string[];
  text?: boolean;
  v?: string;
  data?: {
    tag?: string;
    text?: boolean;
    xattr?: Array<{ name: string; value: string }>;
    link?: { mode: string; url: string; target?: string };
    attr?: { src?: string; alt?: string; loading?: string };
  };
}

export interface WebflowStyleVariant {
  styleLess: string;
}

export interface WebflowStyle {
  _id: string;
  fake: boolean;
  type: "class";
  name: string;
  namespace: string;
  comb: string;
  styleLess: string;
  variants: Record<string, WebflowStyleVariant>;
  children: string[];
}

export interface ClipboardPayload {
  type: "@webflow/XscpData";
  payload: {
    nodes: WebflowNode[];
    styles: WebflowStyle[];
    assets?: unknown[];
    ix1?: unknown[];
    ix2?: {
      interactions?: unknown[];
      events?: unknown[];
      actionLists?: unknown[];
    };
  };
  meta?: {
    unlinkedSymbolCount?: number;
    droppedLinks?: number;
    dynBindRemovedCount?: number;
    dynListBindRemovedCount?: number;
    paginationRemovedCount?: number;
    namespace?: string;
    tokenManifest?: TokenManifest;
  };
}

export interface TokenManifest {
  schemaVersion: string;
  namespace: string;
  collectionName?: string;
  modes: string[];
  variables: Array<{
    name: string;
    cssVar: string;
    type: "COLOR" | "FONT_FAMILY" | "color" | "fontFamily";
    values?: { light: string; dark?: string };
    value?: string;
    fallback?: string;
  }>;
}

export interface CollisionReport {
  existingClasses: string[];
  missingVariables: string[];
  suggestedActions: CollisionAction[];
}

export interface CollisionAction {
  className: string;
  action: 'skip' | 'rename' | 'create';
  reason: string;
}

export interface InstallResult {
  success: boolean;
  nodesCreated: number;
  classesCreated: number;
  classesSkipped: number;
  variablesCreated: number;
  errors?: string[];
}
