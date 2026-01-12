"use client";

import { Asset } from "@/lib/fakeAssets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AssetDetailMainProps {
  asset: Asset;
}

export function AssetDetailMain({ asset }: AssetDetailMainProps) {
  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Title */}
      <h1 className="text-2xl font-semibold">{asset.title}</h1>

      {/* Preview placeholder */}
      <div className="mt-6 flex aspect-video items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
        <span className="text-sm text-muted-foreground">Preview Placeholder</span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="mt-6">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="webflow">Webflow</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              This is a placeholder for the preview description. The actual preview
              content will be displayed here with interactive examples.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="webflow" className="mt-4">
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded bg-muted/60" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/3 rounded bg-muted/60" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="h-4 w-1/2 rounded bg-muted" />
              <div className="mt-2 h-3 w-2/5 rounded bg-muted/60" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="code" className="mt-4">
          <div className="rounded-lg border border-border bg-zinc-950 p-4">
            <pre className="text-xs text-zinc-400">
              <code>{`// Code placeholder
// The actual component code will be displayed here

function Component() {
  return (
    <div>
      {/* Component implementation */}
    </div>
  );
}`}</code>
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-medium">Overview</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Documentation placeholder. This section will contain detailed
                information about the component usage and configuration.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Props</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                List of available props and their descriptions will appear here.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Examples</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Usage examples and code snippets will be provided in this section.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
