"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, CheckCircle } from "lucide-react";
import { copyWebflowJson, copyText } from "@/lib/clipboard";

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
      <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[24px]">
        <CardHeader>
          <CardTitle>Extracted Components</CardTitle>
          <CardDescription>No extracted components available in this project.</CardDescription>
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
          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px]">
            CODE ONLY
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50/50 border border-blue-100/50 p-6 rounded-[24px]">
        <h3 className="text-xl font-bold text-slate-900 mb-1">Extracted Components</h3>
        <p className="text-sm text-slate-500 font-medium">
          Step 3: Copy components one by one and paste them into Webflow.
          Make sure you&apos;ve installed the Style Guide (Design Tokens) and fonts first.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {components.map(({ component, payload }) => (
          <Card key={component._id} className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[24px] overflow-hidden hover:border-blue-200 transition-all">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-xl text-slate-900">{component.title}</h4>
                    {getReliabilityBadge(component.pasteReliability)}
                  </div>

                  {component.description && (
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">{component.description}</p>
                  )}

                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">{component.category}</Badge>
                    {component.capabilityNotes && (
                      <p className="text-xs text-slate-400 font-medium italic">{component.capabilityNotes}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 min-w-[180px]">
                  <Button
                    onClick={() => handleCopyComponent(component, payload)}
                    disabled={!payload?.webflowJson || component.pasteReliability === "none"}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/40 font-bold h-12 rounded-xl"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy to Webflow
                  </Button>

                  {payload?.codePayload && (
                    <Button
                      onClick={() => handleCopyCode(component, payload)}
                      variant="outline"
                      className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold h-12 rounded-xl"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      View Code
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary */}
      <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50">
        <p className="text-sm text-blue-900 font-medium">
          <strong className="font-bold">Total Extracted Components:</strong> {components.length}
          {" | "}
          <strong className="font-bold">Ready to Paste:</strong>{" "}
          {components.filter((c) => c.component.pasteReliability === "full").length}
        </p>
      </div>
    </div>
  );
}
