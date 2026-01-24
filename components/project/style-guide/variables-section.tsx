"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton, CategoryCopyButton } from "./copy-button";

interface ColorToken {
  name: string;
  value: string;
  description?: string;
}

interface VariablesSectionProps {
  primitiveColors: ColorToken[];
  semanticColors?: {
    text?: string;
    background?: string;
    foreground?: string;
    border?: string;
    accent?: string;
  };
}

export function VariablesSection({ primitiveColors, semanticColors }: VariablesSectionProps) {
  return (
    <div className="space-y-8">
      {/* Primitive Colors */}
      <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">Color Primitives</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Foundational building blocks of the color palette
              </p>
            </div>
            <CategoryCopyButton tokens={primitiveColors} category="Color" />
          </div>
        </CardHeader>
        <CardContent>
          {/* Neutrals Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {primitiveColors.map((color, idx) => (
              <div key={idx} className="space-y-3 group">
                <div className="relative">
                  <div
                    className="h-20 rounded-2xl shadow-sm border border-slate-200 transition-transform duration-300 group-hover:scale-105"
                    style={{ backgroundColor: color.value }}
                    title={color.value}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CopyButton value={color.value} label={color.name} variant="individual" />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700 truncate mb-1">
                    {color.name}
                  </p>
                  <p className="text-[10px] font-mono text-slate-400 uppercase tracking-tight">
                    {color.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Semantic Color Scheme */}
      {semanticColors && (
        <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">Color Scheme</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Semantic color roles for common UI elements
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {semanticColors.text && (
                <ColorRoleCard
                  role="Text"
                  color={semanticColors.text}
                  icon="Aa"
                />
              )}
              {semanticColors.background && (
                <ColorRoleCard
                  role="Background"
                  color={semanticColors.background}
                />
              )}
              {semanticColors.foreground && (
                <ColorRoleCard
                  role="Foreground"
                  color={semanticColors.foreground}
                />
              )}
              {semanticColors.border && (
                <ColorRoleCard
                  role="Border"
                  color={semanticColors.border}
                />
              )}
              {semanticColors.accent && (
                <ColorRoleCard
                  role="Accent"
                  color={semanticColors.accent}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ColorRoleCard({ role, color, icon }: { role: string; color: string; icon?: string }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100 hover:bg-white transition-colors group">
      <div className="flex items-center gap-3 flex-1">
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white border border-slate-200 font-bold text-slate-700">
            {icon}
          </div>
        )}
        <div
          className="w-12 h-12 rounded-xl shadow-sm border border-slate-200"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1">
          <p className="font-bold text-slate-700 text-sm">{role}</p>
          <p className="text-[11px] font-mono text-slate-400">{color}</p>
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton value={color} label={role} variant="individual" />
      </div>
    </div>
  );
}
