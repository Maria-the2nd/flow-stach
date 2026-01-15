"use client";

import { useState } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, ArrowDown01Icon, ArrowUp01Icon } from "@hugeicons/core-free-icons";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { AssetActions } from "./AssetDetailContext";
import { extractJsHooks } from "@/lib/html-parser";
import { parseTokenManifest } from "@/lib/token-extractor";

type Asset = Doc<"assets">;
type Payload = Doc<"payloads">;

interface AssetDetailMainProps {
  asset: Asset;
  payload?: Payload | null;
}

interface CodeTabPanelProps {
  label: string;
  description: string;
  code: string;
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

function CodeTabPanel({ label, description, code }: CodeTabPanelProps) {
  const [copying, setCopying] = useState(false);

  const handleCopy = async () => {
    if (!code) return;
    setCopying(true);
    await copyText(code);
    setCopying(false);
  };

  if (!code) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          No {label.toLowerCase()} snippet available for this component.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          disabled={copying}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={Copy01Icon} size={14} />
          {copying ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div className="bg-zinc-950">
        <pre className="max-h-[500px] overflow-auto p-4 text-xs text-zinc-200 font-mono leading-relaxed whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
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
      <div
        className={cn(
          "bg-zinc-950 overflow-hidden transition-all",
          expanded ? "max-h-[400px]" : "max-h-0"
        )}
      >
        <pre className="max-h-[380px] overflow-auto p-4 text-xs text-zinc-200 font-mono leading-relaxed whitespace-pre">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Generate combined embed code for use in Webflow HTML Embed
function generateEmbedCode(snippets: { html: string; css: string; js: string }): string {
  const parts: string[] = [];

  if (snippets.css) {
    parts.push(`<style>\n${snippets.css}\n</style>`);
  }

  if (snippets.html) {
    parts.push(snippets.html);
  }

  if (snippets.js) {
    parts.push(`<script>\n${snippets.js}\n</script>`);
  }

  return parts.join("\n\n");
}

interface CopyAllButtonProps {
  snippets: { html: string; css: string; js: string };
}

function CopyAllButton({ snippets }: CopyAllButtonProps) {
  const [copying, setCopying] = useState(false);
  const embedCode = generateEmbedCode(snippets);

  const handleCopyAll = async () => {
    setCopying(true);
    await copyText(embedCode);
    setCopying(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopyAll}
      disabled={copying}
      className="gap-1.5"
    >
      <HugeiconsIcon icon={Copy01Icon} size={14} />
      {copying ? "Copied!" : "Copy All for Embed"}
    </Button>
  );
}

export function AssetDetailMain({ asset, payload }: AssetDetailMainProps) {
  // Check if this asset needs the Install Snippet tab
  const showInstallTab = asset.pasteReliability === "none" && asset.supportsCodeCopy === true;

  // Parse the code payload into sections
  const snippets = parseCodePayload(payload?.codePayload);
  const hasSnippets = snippets.html || snippets.css || snippets.js;

  const jsHooks = snippets.html ? extractJsHooks(snippets.html) : [];
  const dependencies = payload?.dependencies ?? [];

  let fontUrl: string | null = null;
  if (payload?.codePayload && payload.codePayload.startsWith("/* TOKEN MANIFEST */")) {
    const manifestJson = payload.codePayload.replace("/* TOKEN MANIFEST */", "").trim();
    const manifest = parseTokenManifest(manifestJson);
    if (manifest?.fonts?.googleFonts) {
      fontUrl = manifest.fonts.googleFonts;
    }
  }

  const initialTab = hasSnippets
    ? snippets.html
      ? "html"
      : snippets.css
        ? "css"
        : "js"
    : showInstallTab
      ? "install"
      : "docs";

  return (
    <div className="flex flex-1 flex-col p-6">
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-[linear-gradient(45deg,#ED9A00,#FD6F01,#FFB000)]">
        <div className="absolute right-4 top-4">
          <AssetActions asset={asset} payload={payload ?? null} layout="inline" />
        </div>
        <div className="flex h-full w-full items-end justify-start p-6">
          <span className="rounded-full bg-white/80 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-black/80">
            Component Preview
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Dependencies
          </h3>
          {dependencies.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {dependencies.map((dep, index) => (
                <li key={`${dep}-${index}`}>{dep}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No external dependencies declared.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Google Fonts
          </h3>
          {fontUrl ? (
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p className="break-all">{fontUrl}</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No Google Fonts URL specified in this payload.
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            JS Hooks & Selectors
          </h3>
          {jsHooks.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {jsHooks.map((hook) => (
                <li key={hook}>{hook}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              No data-* attributes or IDs detected in HTML snippet.
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="html" disabled={!snippets.html}>
            HTML
          </TabsTrigger>
          <TabsTrigger value="css" disabled={!snippets.css}>
            CSS
          </TabsTrigger>
          <TabsTrigger value="js" disabled={!snippets.js}>
            JavaScript
          </TabsTrigger>
          {showInstallTab && (
            <TabsTrigger value="install">Install</TabsTrigger>
          )}
          <TabsTrigger value="docs">Docs</TabsTrigger>
        </TabsList>

        <TabsContent value="html" className="mt-4">
          <CodeTabPanel
            label="HTML"
            description="Paste into a Webflow Embed element inside your layout."
            code={snippets.html}
          />
        </TabsContent>

        <TabsContent value="css" className="mt-4">
          <CodeTabPanel
            label="CSS"
            description="Add to your page or site <head> styles."
            code={snippets.css}
          />
        </TabsContent>

        <TabsContent value="js" className="mt-4">
          <CodeTabPanel
            label="JavaScript"
            description="Place before </body>. Ensure it runs once per page."
            code={snippets.js}
          />
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
                  {/* Copy All Button */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Copy individual sections or use &quot;Copy All&quot; for a single embed.
                    </p>
                    <CopyAllButton snippets={snippets} />
                  </div>

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

        <TabsContent value="docs" className="mt-4">
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div>
              <h3 className="text-sm font-medium">Overview</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {asset.description ||
                  "This component is part of the current template system. Use the notes below to install it safely in Webflow."}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Examples</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Paste the HTML into a Webflow Embed, connect the CSS and JavaScript, and
                ensure any required fonts or data attributes are present.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Usage notes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {dependencies.length > 0 ? (
                  <li>
                    Requires the following external libraries: {dependencies.join(", ")}. Make
                    sure they are loaded before the JavaScript snippet.
                  </li>
                ) : (
                  <li>No third-party JavaScript libraries are required for this component.</li>
                )}
                {fontUrl ? (
                  <li>
                    Include the Google Fonts stylesheet in your site head:
                    <span className="block break-all text-xs text-foreground">
                      {fontUrl}
                    </span>
                  </li>
                ) : (
                  <li>
                    This component does not declare a Google Fonts URL in its payload. Use your
                    existing typography setup.
                  </li>
                )}
                {jsHooks.length > 0 ? (
                  <li>
                    Keep the following IDs and data attributes intact so the JavaScript can
                    attach correctly: {jsHooks.join(", ")}.
                  </li>
                ) : (
                  <li>
                    No required data attributes or IDs were detected in the HTML snippet for
                    JavaScript hooks.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
