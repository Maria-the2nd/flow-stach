"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Asset = Doc<"assets">;

interface AssetDetailMainProps {
  asset: Asset;
  hasPayload?: boolean;
}

export function AssetDetailMain({ asset, hasPayload }: AssetDetailMainProps) {
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
          <TabsTrigger value="webflow" disabled={!hasPayload}>
            Webflow
          </TabsTrigger>
          <TabsTrigger value="code" disabled={!hasPayload}>
            Code
          </TabsTrigger>
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="preview" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {asset.description ||
                "This is a placeholder for the preview description. The actual preview content will be displayed here with interactive examples."}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="webflow" className="mt-4">
          <div className="space-y-3">
            {hasPayload ? (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Webflow export data available. Copy functionality coming soon.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  No Webflow payload available for this asset.
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="code" className="mt-4">
          <div className="rounded-lg border border-border bg-zinc-950 p-4">
            {hasPayload ? (
              <pre className="text-xs text-zinc-400">
                <code>{`// Code payload available
// Copy functionality coming soon`}</code>
              </pre>
            ) : (
              <pre className="text-xs text-zinc-400">
                <code>{`// No code payload available for this asset`}</code>
              </pre>
            )}
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
