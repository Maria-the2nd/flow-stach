"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton, CategoryCopyButton } from "./copy-button";
import type { RadiusToken } from "@/lib/token-extractor";

interface RadiusSectionProps {
  tokens: RadiusToken[];
}

export function RadiusSection({ tokens }: RadiusSectionProps) {
  if (tokens.length === 0) return null;

  // Group by size
  const grouped = {
    small: tokens.filter(t => t.size === 'small'),
    medium: tokens.filter(t => t.size === 'medium'),
    large: tokens.filter(t => t.size === 'large'),
    xlarge: tokens.filter(t => t.size === 'xlarge'),
  };

  const allTokens = tokens.map(t => ({ name: t.name, value: t.value }));

  return (
    <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900">Border Radius</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Consistent corner rounding for UI elements
            </p>
          </div>
          <CategoryCopyButton tokens={allTokens} category="Radius" />
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {grouped.large.length > 0 && (
          <RadiusGroup
            title="Large"
            description="Applied to elements which are 1 or 2 columns in width"
            tokens={grouped.large}
            size={120}
          />
        )}
        {grouped.medium.length > 0 && (
          <RadiusGroup
            title="Medium"
            description="Applied to elements between 2 and 3 columns in width"
            tokens={grouped.medium}
            size={100}
          />
        )}
        {grouped.small.length > 0 && (
          <RadiusGroup
            title="Small"
            description="Applied to elements smaller than 4 columns in width"
            tokens={grouped.small}
            size={80}
          />
        )}
        {grouped.xlarge.length > 0 && (
          <RadiusGroup
            title="Extra Large"
            description="Applied to large containers and sections"
            tokens={grouped.xlarge}
            size={140}
          />
        )}
      </CardContent>
    </Card>
  );
}

function RadiusGroup({
  title,
  description,
  tokens,
  size,
}: {
  title: string;
  description: string;
  tokens: RadiusToken[];
  size: number;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-lg font-bold text-slate-900">{title}</h4>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="flex flex-wrap gap-6">
        {tokens.map((token, idx) => (
          <div key={idx} className="space-y-2 group">
            <div className="relative">
              <div
                className="bg-slate-100 border-2 border-slate-300 hover:border-blue-400 transition-colors"
                style={{
                  width: `${size}px`,
                  height: `${size}px`,
                  borderRadius: token.value,
                }}
              />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton value={token.value} label={token.name} variant="individual" />
              </div>
            </div>
            <div className="text-center max-w-[120px]">
              <p className="text-xs font-bold text-slate-700 truncate">{token.name}</p>
              <p className="text-[10px] font-mono text-slate-400">{token.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
