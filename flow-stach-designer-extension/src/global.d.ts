/**
 * Global type declarations for Webflow Designer APIs
 */

declare global {
  interface Window {
    webflow?: WebflowAPI;
  }
  
  const webflow: WebflowAPI | undefined;
}

export interface WebflowAPI {
  getAllStyles?(): Promise<Array<{ getName: () => string }>>;
  createStyle?(options: {
    name: string;
    properties: Record<string, string>;
    breakpointStyles?: Record<string, Record<string, string>>;
  }): Promise<void>;
  
  getAllVariableCollections?(): Promise<Array<VariableCollection>>;
  createVariableCollection?(options: { name: string }): Promise<VariableCollection>;
  
  getSelectedElement?(): Promise<WebflowElement | null>;
  getBody?(): Promise<WebflowElement | null>;
  createElement?(parentId: string, options: {
    tag: string;
    classes: string[];
    attributes?: Array<{ name: string; value: string }>;
  }): Promise<void>;
  createTextNode?(parentId: string, text: string): Promise<void>;
}

export interface VariableCollection {
  getName(): string;
  getModes?(): Promise<Array<{ getName: () => string }>>;
  createMode?(options: { name: string }): Promise<void>;
  getVariables?(): Promise<Array<Variable>>;
  createVariable?(options: { name: string; type: 'COLOR' | 'FONT_FAMILY' }): Promise<Variable>;
}

export interface Variable {
  getName(): string;
  getId(): string;
  setValue?(mode: string, value: string): Promise<void>;
}

export interface WebflowElement {
  getId(): string;
}

export {};
