"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, CheckCircle } from "lucide-react";
import { copyWebflowJson, copyText } from "@/lib/clipboard";
import { isPlaceholderPayload } from "@/lib/payload-utils";
import { ensureWebflowPasteSafety } from "@/lib/webflow-safety-gate";
import { SafetyReportPanel } from "@/components/validation/SafetyReportPanel";

interface Component {
  _id: string;
  slug: string;
  title: string;
  description?: string;
  category: string;
  pasteReliability?: "full" | "partial" | "none";
  capabilityNotes?: string;
}

interface Payload {
  webflowJson?: string;
  codePayload?: string;
  cssEmbed?: string;
  jsEmbed?: string;
}

interface ComponentsListProps {
  components: Array<{
    component: Component;
    payload: Payload | null;
  }>;
}

export function ComponentsList({ components }: ComponentsListProps) {
  if (!components || components.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-xl border-border shadow-xl shadow-background/50 rounded-[24px]">
        <CardHeader>
          <CardTitle className="text-foreground">Extracted Components</CardTitle>
          <CardDescription className="text-muted-foreground">No extracted components available in this project.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleCopyComponent = async (component: Component, payload: Payload | null) => {
    if (!payload?.webflowJson) {
      toast.error("No Webflow JSON available", {
        description: `${component.title} doesn't have a Webflow payload yet.`,
      });
      return;
    }

    try {
      // Copy using the proper Webflow clipboard utility with validation
      await copyWebflowJson(payload.webflowJson);
    } catch (error) {
      toast.error("Failed to copy component");
      console.error(error);
    }
  };

  const handleCopyCode = async (component: Component, payload: Payload | null) => {
    if (!payload?.codePayload) {
      toast.error("No code available", {
        description: `${component.title} doesn't have a code payload.`,
      });
      return;
    }

    const result = await copyText(payload.codePayload);
    if (result.success) {
      toast.success(`${component.title} code copied!`, {
        description: "Paste the code into your project",
      });
    }
    // copyText already shows error toast on failure
  };

  const getReliabilityBadge = (reliability?: "full" | "partial" | "none") => {
    switch (reliability) {
      case "full":
        return (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-none font-bold text-[10px]">
            <CheckCircle className="w-3 h-3 mr-1" />
            READY
          </Badge>
        );
      case "partial":
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-none font-bold text-[10px]">
            PARTIAL
          </Badge>
        );
      case "none":
        return (
          <Badge variant="secondary" className="bg-accent text-muted-foreground border-none font-bold text-[10px]">
            CODE ONLY
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/10 p-6 rounded-[24px]">
        <h3 className="text-xl font-bold text-foreground mb-1">Extracted Components</h3>
        <p className="text-sm text-muted-foreground font-medium">
          Step 3: Copy components one by one and paste them into Webflow.
          Make sure you&apos;ve installed the Style Guide (Design Tokens) and fonts first.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {components.map(({ component, payload }) => {
          const safetyReport = (() => {
            if (!payload?.webflowJson || isPlaceholderPayload(payload.webflowJson)) return null;
            try {
              return ensureWebflowPasteSafety({
                payload: payload.webflowJson,
              }).report;
            } catch {
              return null;
            }
          })();

          return (
            <Card key={component._id} className="bg-card backdrop-blur-xl border-border shadow-xl shadow-background/50 rounded-[24px] overflow-hidden hover:border-primary/30 transition-all">
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h4 className="font-bold text-lg sm:text-xl text-foreground break-words">{component.title}</h4>
                      {getReliabilityBadge(component.pasteReliability)}
                    </div>

                    {component.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed font-medium">{component.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <Badge variant="secondary" className="bg-accent text-muted-foreground border-none font-bold text-[10px] uppercase whitespace-nowrap">{component.category}</Badge>
                      {component.capabilityNotes && (
                        <p className="text-xs text-muted-foreground/60 font-medium italic break-words">{component.capabilityNotes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-3 w-full sm:w-auto sm:min-w-[180px]">
                    <Button
                      onClick={() => handleCopyComponent(component, payload)}
                      disabled={!payload?.webflowJson || component.pasteReliability === "none"}
                      className="bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20 font-bold h-12 rounded-xl flex-1 sm:flex-none"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Copy to Webflow</span>
                      <span className="sm:hidden">Copy</span>
                    </Button>

                    {payload?.codePayload && (
                      <Button
                        onClick={() => handleCopyCode(component, payload)}
                        variant="outline"
                        className="border-border text-foreground hover:bg-accent font-bold h-12 rounded-xl flex-1 sm:flex-none"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">View Code</span>
                        <span className="sm:hidden">Code</span>
                      </Button>
                    )}
                  </div>
                </div>
                {safetyReport && (
                  <details className="mt-5 rounded-xl border border-border/50 bg-accent/20 p-3 text-sm">
                    <summary className="cursor-pointer font-semibold text-muted-foreground/80">
                      Safety Report
                    </summary>
                    <div className="mt-3">
                      <SafetyReportPanel report={safetyReport} />
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary */}
      <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10">
        <p className="text-sm text-primary font-medium">
          <strong className="font-bold">Total Extracted Components:</strong> {components.length}
          {" | "}
          <strong className="font-bold">Ready to Paste:</strong>{" "}
          {components.filter((c) => c.component.pasteReliability === "full").length}
        </p>
      </div>
    </div>
  );
}
