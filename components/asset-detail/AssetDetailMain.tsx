"use client";

import { useState } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

type Asset = Doc<"assets">;
type Payload = Doc<"payloads">;

interface AssetDetailMainProps {
  asset: Asset;
  payload?: Payload | null;
  hasPayload?: boolean;
}

// Parse code payload to extract HTML, CSS, and JS sections
function parseCodePayload(codePayload: string | undefined): { html: string; css: string; js: string } {
  if (!codePayload) return { html: "", css: "", js: "" };

  // Try to extract sections from comment blocks
  const sections = { html: "", css: "", js: "" };

  // Look for CSS section (between /* CSS */ or <style> markers)
  const cssMatch = codePayload.match(/\/\*\s*CSS\s*\*\/\s*([\s\S]*?)(?=\/\*\s*(?:HTML|JS|JavaScript)\s*\*\/|$)/i) ||
                   codePayload.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (cssMatch) sections.css = cssMatch[1].trim();

  // Look for HTML section
  const htmlMatch = codePayload.match(/\/\*\s*HTML\s*\*\/\s*([\s\S]*?)(?=\/\*\s*(?:CSS|JS|JavaScript)\s*\*\/|$)/i);
  if (htmlMatch) sections.html = htmlMatch[1].trim();

  // Look for JS section
  const jsMatch = codePayload.match(/\/\*\s*(?:JS|JavaScript)\s*\*\/\s*([\s\S]*?)(?=\/\*\s*(?:HTML|CSS)\s*\*\/|$)/i);
  if (jsMatch) sections.js = jsMatch[1].trim();

  // If no structured sections, try to intelligently split
  if (!sections.html && !sections.css && !sections.js) {
    // Check if it looks like CSS
    if (codePayload.includes("{") && codePayload.includes("}") &&
        (codePayload.includes(":") || codePayload.includes("@"))) {
      sections.css = codePayload;
    }
    // Check if it looks like JS
    else if (codePayload.includes("function") || codePayload.includes("const ") ||
             codePayload.includes("document.") || codePayload.includes("=>")) {
      sections.js = codePayload;
    }
    // Default to HTML
    else {
      sections.html = codePayload;
    }
  }

  return sections;
}

interface SnippetSectionProps {
  title: string;
  code: string;
  language: string;
  defaultExpanded?: boolean;
}

function SnippetSection({ title, code, language, defaultExpanded = false }: SnippetSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copying, setCopying] = useState(false);

  if (!code) return null;

  const handleCopy = async () => {
    setCopying(true);
    await copyText(code);
    setCopying(false);
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2 bg-muted/50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
            size={16}
            className="text-muted-foreground"
          />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">({language})</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          disabled={copying}
        >
          <HugeiconsIcon icon={Copy01Icon} size={14} />
          {copying ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div className={cn(
        "bg-zinc-950 overflow-hidden transition-all",
        expanded ? "max-h-[400px]" : "max-h-0"
      )}>
        <pre className="p-4 text-xs text-zinc-400 overflow-auto max-h-[380px]">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export function AssetDetailMain({ asset, payload, hasPayload }: AssetDetailMainProps) {
  // Check if this asset needs the Install Snippet tab
  const showInstallTab = asset.pasteReliability === "none" && asset.supportsCodeCopy === true;

  // Parse the code payload into sections
  const snippets = parseCodePayload(payload?.codePayload);
  const hasSnippets = snippets.html || snippets.css || snippets.js;

  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Title */}
      <h1 className="text-2xl font-semibold">{asset.title}</h1>

      {/* Preview */}
      <div className="mt-6 aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/30">
        {asset.previewVideoUrl ? (
          <video
            src={asset.previewVideoUrl}
            className="h-full w-full object-cover"
            controls
            muted
            loop
            playsInline
          />
        ) : asset.previewImageUrl ? (
          <img
            src={asset.previewImageUrl}
            alt={asset.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-sm text-muted-foreground">No preview available</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={showInstallTab ? "install" : "preview"} className="mt-6">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          {showInstallTab && (
            <TabsTrigger value="install">Install</TabsTrigger>
          )}
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

        {showInstallTab && (
          <TabsContent value="install" className="mt-4">
            <div className="space-y-4">
              {/* Instructions */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <h3 className="text-sm font-medium text-amber-200">Manual Installation Required</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {asset.capabilityNotes || "This component requires manual installation. Copy the snippets below into your Webflow project."}
                </p>
              </div>

              {/* Snippet Sections */}
              {hasSnippets ? (
                <div className="space-y-3">
                  <SnippetSection
                    title="HTML"
                    code={snippets.html}
                    language="Paste into Embed element"
                    defaultExpanded={!!snippets.html}
                  />
                  <SnippetSection
                    title="CSS"
                    code={snippets.css}
                    language="Add to page/site <head>"
                    defaultExpanded={!snippets.html && !!snippets.css}
                  />
                  <SnippetSection
                    title="JavaScript"
                    code={snippets.js}
                    language="Add before </body>"
                    defaultExpanded={!snippets.html && !snippets.css && !!snippets.js}
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground">
                    No install snippets available yet.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="webflow" className="mt-4">
          <div className="space-y-3">
            {hasPayload ? (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Webflow export data available. Use the "Copy to Webflow" button in the Actions panel.
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
            {hasPayload && payload?.codePayload ? (
              <pre className="text-xs text-zinc-400 overflow-auto max-h-[500px]">
                <code>{payload.codePayload}</code>
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
