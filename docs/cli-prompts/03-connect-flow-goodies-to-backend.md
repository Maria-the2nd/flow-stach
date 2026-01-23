# CLI Prompt 03: Connect Flow-Goodies to Convex + Clerk

<role>
You are a senior developer adding backend integration to a Webflow Designer Extension. You understand Convex, Clerk auth, React, and Webpack bundling.
</role>

<context>
**Project**: Flow-Goodies-extension — A Webflow Designer Extension that runs INSIDE the Webflow Designer.

**Location**: `C:\Users\maria\Desktop\pessoal\FLOW_PARTY\Flow-Goodies-extension`

**Current state**:
- React + TypeScript + Webpack
- Uses hardcoded `sampleComponents` array
- Has working copy-to-clipboard logic
- NO Convex, NO Clerk

**Related project**: flow-stach (separate folder) has:
- Convex backend with user projects
- `convex/projects.ts` with queries: `listMine`, `getWithArtifacts`, `getArtifactContent`
- Clerk auth configured
- Users import HTML → converted to Webflow JSON → stored in `importArtifacts`

**Goal**: Flow-Goodies should fetch the CURRENT USER's projects from Convex and let them copy pre-converted Webflow JSON directly in the Designer.

**Webflow Designer Extensions run in an iframe** on the Webflow domain. Clerk's `syncHost` feature should work to share auth session from the user's flow-stach session.
</context>

<instructions>

## Part 1: Add Dependencies

Update `package.json` to add:
- `convex` — Convex client
- `@clerk/clerk-react` — Clerk auth for React
- `convex/react` — Convex React hooks

Run: `bun add convex @clerk/clerk-react`

## Part 2: Environment Configuration

Create a config file for environment variables. Webpack needs to inject these at build time.

**Create** `src/config/env.ts`:
```typescript
export const ENV = {
  CONVEX_URL: process.env.CONVEX_URL || 'https://your-convex-url.convex.cloud',
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || 'pk_test_...',
  SYNC_HOST: process.env.SYNC_HOST || 'http://localhost:3000',
};
```

**Update** `webpack.config.mjs` to use `DefinePlugin` for env vars:
```javascript
import webpack from 'webpack';

// In plugins array:
new webpack.DefinePlugin({
  'process.env.CONVEX_URL': JSON.stringify(process.env.CONVEX_URL),
  'process.env.CLERK_PUBLISHABLE_KEY': JSON.stringify(process.env.CLERK_PUBLISHABLE_KEY),
  'process.env.SYNC_HOST': JSON.stringify(process.env.SYNC_HOST),
})
```

## Part 3: Setup Providers

**Update** `src/index.tsx` to wrap App with Clerk and Convex providers:

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { App } from "./components/App";
import { ENV } from "./config/env";

const convex = new ConvexReactClient(ENV.CONVEX_URL);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <ClerkProvider 
    publishableKey={ENV.CLERK_PUBLISHABLE_KEY}
    syncHost={ENV.SYNC_HOST}
  >
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <App />
    </ConvexProviderWithClerk>
  </ClerkProvider>
);
```

## Part 4: Copy Convex API Types

The extension needs Convex's generated API types. 

**Option A (Recommended)**: Copy the `convex/_generated` folder from flow-stach to Flow-Goodies:
- Copy `flow-stach/convex/_generated/` to `Flow-Goodies-extension/src/convex/_generated/`

**Option B**: Create a shared package (more complex, skip for now)

Also copy `convex/projects.ts` type definitions or create matching types.

## Part 5: Update App Component

**Replace** `src/components/App.tsx` with authenticated project-based flow:

```typescript
import React, { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/clerk-react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { ProjectList } from './ProjectList';
import { ProjectDetail } from './ProjectDetail';
import './App.css';

export const App: React.FC = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Show loading while auth loads
  if (!isLoaded) {
    return (
      <div className="app">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isSignedIn) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">Flow Bridge</h1>
          <p className="app-subtitle">Import your AI-generated sites</p>
        </header>
        <div className="auth-prompt">
          <p>Sign in to access your projects</p>
          <p className="auth-hint">
            First, sign in at your Flow Bridge web app, then return here.
          </p>
          <SignInButton mode="redirect">
            <button className="sign-in-button">Sign In</button>
          </SignInButton>
        </div>
      </div>
    );
  }

  // If project selected, show detail view
  if (selectedProjectId) {
    return (
      <ProjectDetail 
        projectId={selectedProjectId} 
        onBack={() => setSelectedProjectId(null)} 
      />
    );
  }

  // Show project list
  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Flow Bridge</h1>
        <p className="app-subtitle">Your imported projects</p>
      </header>
      <ProjectList onSelectProject={setSelectedProjectId} />
    </div>
  );
};
```

## Part 6: Create ProjectList Component

**Create** `src/components/ProjectList.tsx`:

```typescript
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import './ProjectList.css';

interface ProjectListProps {
  onSelectProject: (projectId: string) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject }) => {
  const projects = useQuery(api.projects.listMine);

  if (projects === undefined) {
    return <div className="loading">Loading projects...</div>;
  }

  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <p>No projects yet</p>
        <p className="empty-subtitle">
          Import HTML at your Flow Bridge web app to see projects here.
        </p>
      </div>
    );
  }

  return (
    <div className="project-list">
      {projects.map((project) => (
        <div 
          key={project._id} 
          className="project-card"
          onClick={() => onSelectProject(project._id)}
        >
          <h3 className="project-name">{project.name}</h3>
          <div className="project-meta">
            <span>{project.componentCount || 0} components</span>
            <span>{project.status}</span>
          </div>
          <div className="project-date">
            {new Date(project._creationTime).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
};
```

## Part 7: Create ProjectDetail Component

**Create** `src/components/ProjectDetail.tsx`:

```typescript
import React, { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { copyArtifactToClipboard } from '../utils/clipboardUtils';
import './ProjectDetail.css';

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectDetail: React.FC<ProjectDetailProps> = ({ projectId, onBack }) => {
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  const data = useQuery(api.projects.getWithArtifacts, { 
    projectId: projectId as Id<"importProjects"> 
  });

  if (data === undefined) {
    return <div className="loading">Loading project...</div>;
  }

  const { project, artifacts } = data;

  // Filter to only show copyable artifacts (webflow JSON, clean HTML, etc.)
  const copyableArtifacts = artifacts.filter(a => 
    ['token_webflow_json', 'clean_html', 'styles_css', 'scripts_js'].includes(a.type)
  );

  const handleCopy = async (artifactId: string, artifactType: string) => {
    setCopyingId(artifactId);
    setCopySuccess(null);
    
    try {
      await copyArtifactToClipboard(artifactId as Id<"importArtifacts">);
      setCopySuccess(artifactId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
      alert('Failed to copy. Please try again.');
    } finally {
      setCopyingId(null);
    }
  };

  const getArtifactLabel = (type: string): string => {
    const labels: Record<string, string> = {
      'token_webflow_json': 'Design Tokens (Webflow)',
      'clean_html': 'Clean HTML',
      'styles_css': 'Stylesheet (CSS)',
      'scripts_js': 'JavaScript',
      'tokens_json': 'Tokens (JSON)',
      'tokens_css': 'Tokens (CSS)',
      'class_index': 'Class Index',
      'js_hooks': 'JS Hooks',
      'external_scripts': 'External Scripts',
      'component_manifest': 'Component Manifest',
    };
    return labels[type] || type;
  };

  return (
    <div className="project-detail">
      <button className="back-button" onClick={onBack}>
        ← Back to projects
      </button>
      
      <header className="project-header">
        <h2>{project.name}</h2>
        <span className={`status status-${project.status}`}>{project.status}</span>
      </header>

      <div className="artifacts-section">
        <h3>Available Assets</h3>
        
        {copyableArtifacts.length === 0 ? (
          <p className="no-artifacts">No copyable assets in this project.</p>
        ) : (
          <div className="artifact-list">
            {copyableArtifacts.map((artifact) => (
              <div key={artifact._id} className="artifact-card">
                <span className="artifact-type">{getArtifactLabel(artifact.type)}</span>
                <button
                  className={`copy-button ${copySuccess === artifact._id ? 'success' : ''}`}
                  onClick={() => handleCopy(artifact._id, artifact.type)}
                  disabled={copyingId === artifact._id}
                >
                  {copyingId === artifact._id 
                    ? 'Copying...' 
                    : copySuccess === artifact._id 
                      ? '✓ Copied!' 
                      : 'Copy'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
```

## Part 8: Create Clipboard Utility

**Create** `src/utils/clipboardUtils.ts`:

```typescript
import { ConvexReactClient } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { ENV } from '../config/env';

// We need a standalone client for imperative calls (not hooks)
const convex = new ConvexReactClient(ENV.CONVEX_URL);

export async function copyArtifactToClipboard(artifactId: Id<"importArtifacts">): Promise<void> {
  // Fetch artifact content from Convex
  // Note: This requires auth token - may need adjustment based on how Convex handles this
  const result = await convex.query(api.projects.getArtifactContent, { artifactId });
  
  if (!result || !result.content) {
    throw new Error('Artifact content not found');
  }

  const { type, content } = result;

  // Determine MIME type based on artifact type
  if (type === 'token_webflow_json' || type.includes('webflow')) {
    // Webflow JSON - use application/json for Designer paste
    const blob = new Blob([content], { type: 'application/json' });
    const clipboardItem = new ClipboardItem({
      'application/json': blob,
      'text/plain': new Blob([content], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([clipboardItem]);
  } else {
    // Plain text (CSS, HTML, JS)
    await navigator.clipboard.writeText(content);
  }

  console.log(`✓ Copied ${type} to clipboard`);
}
```

## Part 9: Add CSS Styles

Create minimal CSS files for the new components:

**Create** `src/components/ProjectList.css`
**Create** `src/components/ProjectDetail.css`

(Use similar styling to existing App.css — dark theme, clean cards)

## Part 10: Update Types

**Create** `src/convex/_generated/dataModel.ts` (or copy from flow-stach):

Define the `Id` type at minimum:
```typescript
export type Id<T extends string> = string & { __tableName: T };
```

</instructions>

<output_format>
1. **Updated package.json** — show dependencies added
2. **New/modified files** — list all files created or changed
3. **webpack.config.mjs changes** — show the DefinePlugin addition
4. **Complete component code** — for App.tsx, ProjectList.tsx, ProjectDetail.tsx
5. **Clipboard utility** — complete clipboardUtils.ts
6. **Instructions for copying Convex types** — exact paths
7. **Environment variables needed** — list what needs to be set
8. **Build & test instructions** — how to verify it works
</output_format>

<constraints>
- DO NOT break existing functionality — keep the old sample-based flow as fallback or remove cleanly
- DO handle auth loading and error states gracefully
- DO use TypeScript properly — no `any` types
- DO handle the case where Convex returns undefined (loading state)
- The extension runs in an iframe — test that clipboard works in that context
- Environment variables must be injected at BUILD time (Webpack DefinePlugin), not runtime
- The Convex client needs auth token — verify the ClerkProvider + ConvexProviderWithClerk pattern works in Webflow iframe
</constraints>
