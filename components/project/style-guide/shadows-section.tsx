"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton, CategoryCopyButton } from "./copy-button";
import type { ShadowToken } from "@/lib/token-extractor";

interface ShadowsSectionProps {
  tokens: ShadowToken[];
}

const INTENSITY_ORDER = ['xxsmall', 'xsmall', 'small', 'medium', 'large', 'xlarge', 'xxlarge'];

export function ShadowsSection({ tokens }: ShadowsSectionProps) {
  if (tokens.length === 0) return null;

  // Sort tokens by intensity
  const sortedTokens = [...tokens].sort((a, b) => {
    const aIndex = INTENSITY_ORDER.indexOf(a.intensity);
    const bIndex = INTENSITY_ORDER.indexOf(b.intensity);
    return aIndex - bIndex;
  });

  const allTokens = sortedTokens.map(t => ({ name: t.name, value: t.value }));

  return (
    <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900">Shadows</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Elevation and depth effects for layered interfaces
            </p>
          </div>
          <CategoryCopyButton tokens={allTokens} category="Shadow" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6 justify-center">
          {sortedTokens.map((token, idx) => (
            <ShadowCard key={idx} token={token} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ShadowCard({ token }: { token: ShadowToken }) {
  return (
    <div className="space-y-3 group">
      <div className="relative">
        <div
          className="w-32 h-32 bg-white rounded-2xl transition-transform hover:scale-105"
          style={{ boxShadow: token.value }}
        />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton value={token.value} label={token.name} variant="individual" />
        </div>
      </div>
      <div className="text-center max-w-[128px]">
        <p className="text-xs font-bold text-slate-700 truncate capitalize">
          {token.intensity}
        </p>
        <p className="text-[10px] font-mono text-slate-400 truncate">{token.name}</p>
      </div>
    </div>
  );
}
