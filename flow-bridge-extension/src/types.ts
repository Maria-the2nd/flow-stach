// Use string IDs to avoid direct dependency on Convex generated types
// The actual IDs are Convex ID strings

export interface Project {
  _id: string
  name: string
  slug: string
  status: 'draft' | 'complete'
  componentCount?: number
  classCount?: number
  _creationTime: number
}

export interface Artifact {
  _id: string
  type: ArtifactType
  createdAt: number
}

export type ArtifactType =
  | 'tokens_json'
  | 'tokens_css'
  | 'styles_css'
  | 'class_index'
  | 'clean_html'
  | 'scripts_js'
  | 'js_hooks'
  | 'external_scripts'
  | 'token_webflow_json'
  | 'component_manifest'

export interface ProjectWithArtifacts {
  project: Project
  artifacts: Artifact[]
}

export interface ArtifactContent {
  type: ArtifactType
  content: string
}

// Message types for background script communication
export type MessageType =
  | { type: 'COPY_WEBFLOW_JSON'; payload: string }
  | { type: 'COPY_TEXT'; payload: string }
  | { type: 'INSERT_WEBFLOW_JSON'; payload: string }

export type MessageResponse =
  | { success: true }
  | { success: false; error: string }

// Insertion result type
export interface InsertionResultMessage {
  success: boolean
  insertedCount: number
  stylesCreated: number
  errors: string[]
  warnings: string[]
  rootElementId?: string
}

// Artifact display configuration
export const ARTIFACT_CONFIG: Record<ArtifactType, { label: string; icon: string; copyable: boolean }> = {
  tokens_json: { label: 'Design Tokens (JSON)', icon: '🎨', copyable: true },
  tokens_css: { label: 'Design Tokens (CSS)', icon: '🎨', copyable: true },
  styles_css: { label: 'Styles CSS', icon: '📝', copyable: true },
  class_index: { label: 'Class Index', icon: '📋', copyable: false },
  clean_html: { label: 'Clean HTML', icon: '🌐', copyable: true },
  scripts_js: { label: 'Scripts', icon: '⚡', copyable: true },
  js_hooks: { label: 'JS Hooks', icon: '🪝', copyable: true },
  external_scripts: { label: 'External Scripts', icon: '🔗', copyable: false },
  token_webflow_json: { label: 'Webflow JSON', icon: '🚀', copyable: true },
  component_manifest: { label: 'Component Manifest', icon: '📦', copyable: false },
}
