// Component data structure
export interface Component {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail: string; // Base64 or URL
  html: string; // Raw HTML structure
  css: string; // CSS styles
  javascript?: string; // Optional JS code
  tags: string[]; // For search/filtering
  isPremium: boolean;
}

// Webflow-specific types
export interface WebflowNode {
  _id: string;
  type: string;
  tag: string;
  classes: string[];
  children: WebflowNode[];
  data?: {
    text?: string;
    attr?: Record<string, string>;
  };
}

export interface WebflowStyle {
  _id: string;
  name: string;
  styleLess: string;
  type: string;
}

export interface WebflowClipboardData {
  type: "@webflow/XscpData";
  payload: {
    nodes: WebflowNode[];
    styles: WebflowStyle[];
    assets: unknown[];
  };
}
