"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DesignTokensCardProps {
  tokens?: {
    colors: Array<{ name: string; value: string }>;
    typography: Array<{ name: string; value: string }>;
    spacing?: Array<{ name: string; value: string }>;
  } | null;
}

export function DesignTokensCard({ tokens }: DesignTokensCardProps) {
  if (!tokens || (tokens.colors.length === 0 && tokens.typography.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Style Guide (Design Tokens)</CardTitle>
          <CardDescription>No Style Guide (Design Tokens) data detected in this project.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleCopy = async () => {
    try {
      // Generate hidden DIV with inline styles
      const cssVars: string[] = [];

      // Add colors
      tokens.colors.forEach((c) => {
        cssVars.push(`--${c.name}: ${c.value}`);
      });

      // Add typography
      tokens.typography.forEach((t) => {
        cssVars.push(`--${t.name}: ${t.value}`);
      });

      // Add spacing if available
      if (tokens.spacing) {
        tokens.spacing.forEach((s) => {
          cssVars.push(`--${s.name}: ${s.value}`);
        });
      }

      const hiddenDiv = `<div style="${cssVars.join('; ')}; display: none;" data-flow-tokens="true"></div>`;

      await navigator.clipboard.writeText(hiddenDiv);
      toast.success("Style Guide (Design Tokens) copied to clipboard!", {
        description: "Paste this into the <body> tag in Webflow. You can delete the DIV after pasting.",
      });
    } catch (error) {
      toast.error("Failed to copy Style Guide (Design Tokens)");
      console.error(error);
    }
  };

  return (
    <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-slate-900">Style Guide (Design Tokens)</CardTitle>
            <CardDescription className="text-slate-500 font-medium max-w-xl leading-relaxed">
              Step 1: Copy the Style Guide (Design Tokens) and paste it into the body div on Webflow.
              After pasting, you can delete the created DIV element.
            </CardDescription>
          </div>
          <Button onClick={handleCopy} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/40 font-bold px-8 h-12 rounded-xl shrink-0">
            Copy Style Guide (Design Tokens)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-10 pt-6">
        {/* Colors and Typography sections... */}
        {/* Color swatches */}
        {tokens.colors.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Global Colors</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {tokens.colors.map((color, idx) => (
                <div key={idx} className="space-y-3 group cursor-default">
                  <div
                    className="h-16 rounded-[18px] shadow-sm border border-slate-100 transition-transform duration-300 group-hover:scale-[1.03]"
                    style={{ backgroundColor: color.value }}
                    title={color.value}
                  />
                  <div>
                    <p className="text-[11px] font-bold text-slate-700 truncate mb-0.5">
                      {color.name}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">{color.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Typography */}
        {tokens.typography.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Typography Styles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tokens.typography.map((type, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center bg-slate-50/50 p-4 rounded-2xl border border-slate-100 hover:bg-white transition-colors"
                >
                  <span className="font-bold text-slate-600 text-sm">{type.name}</span>
                  <span className="font-mono text-blue-600 text-[11px] bg-blue-50 px-3 py-1 rounded-full font-bold">
                    {type.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spacing (if available) */}
        {tokens.spacing && tokens.spacing.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Spacing Values</h4>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {tokens.spacing.map((space, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center justify-center p-3 bg-slate-50/50 rounded-xl border border-slate-100"
                >
                  <span className="font-bold text-slate-400 text-[10px] uppercase mb-1">{space.name}</span>
                  <span className="font-mono text-xs text-slate-700 font-bold">{space.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>

  );
}
