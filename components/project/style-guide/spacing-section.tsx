"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton, CategoryCopyButton } from "./copy-button";

interface SpacingToken {
  name: string;
  value: string;
}

interface SpacingSectionProps {
  tokens: SpacingToken[];
}

export function SpacingSection({ tokens }: SpacingSectionProps) {
  if (tokens.length === 0) return null;

  return (
    <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900">Spacing Scale</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Consistent spacing values for margins, padding, and gaps
            </p>
          </div>
          <CategoryCopyButton tokens={tokens} category="Spacing" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tokens.map((token, idx) => (
            <SpacingTokenRow key={idx} token={token} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SpacingTokenRow({ token }: { token: SpacingToken }) {
  // Parse numeric value for visualization
  const numericValue = parseFloat(token.value);
  const maxWidth = 300; // Max width in pixels for visualization
  const visualWidth = Math.min(numericValue * 16, maxWidth); // Convert rem to px (assuming 1rem = 16px)

  return (
    <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-xl hover:bg-white transition-colors group">
      <div className="flex-1 flex items-center gap-4">
        <div className="w-32">
          <p className="text-sm font-bold text-slate-700">{token.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-xs font-mono text-slate-400">{token.value}</p>
            <CopyButton value={token.value} label={token.name} variant="individual" />
          </div>
        </div>
        <div className="flex-1">
          <div
            className="h-8 bg-blue-500 rounded transition-all"
            style={{ width: `${visualWidth}px`, maxWidth: '100%' }}
            title={token.value}
          />
        </div>
      </div>
    </div>
  );
}
