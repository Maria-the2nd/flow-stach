"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton, CategoryCopyButton } from "./copy-button";

interface Typeface {
  family: string;
  sample?: string;
}

interface HeadingStyle {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  desktop: { fontSize: string; lineHeight: string };
  mobile: { fontSize: string; lineHeight: string };
}

interface BodyTextStyle {
  size: 'large' | 'medium' | 'regular' | 'small' | 'tiny';
  fontSize: string;
  lineHeight: string;
  weights: Array<{
    name: 'extra-bold' | 'bold' | 'semi-bold' | 'medium' | 'normal' | 'light';
    value: string;
  }>;
}

interface TypographySectionProps {
  headingTypeface?: Typeface;
  bodyTypeface?: Typeface;
  headings?: HeadingStyle[];
  bodyText?: BodyTextStyle[];
  allTypographyTokens?: Array<{ name: string; value: string }>;
}

const SAMPLE_TEXT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SAMPLE_LOWER = "abcdefghijklmnopqrstuvwxyz";
const SAMPLE_NUMBERS = "1234567890";
const SAMPLE_SPECIAL = "!@#$%^&*()";

export function TypographySection({
  headingTypeface,
  bodyTypeface,
  headings = [],
  bodyText = [],
  allTypographyTokens = [],
}: TypographySectionProps) {
  return (
    <div className="space-y-8">
      {/* Typefaces */}
      {(headingTypeface || bodyTypeface) && (
        <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-slate-900">Typefaces</CardTitle>
              {allTypographyTokens.length > 0 && (
                <CategoryCopyButton tokens={allTypographyTokens} category="Typography" />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {headingTypeface && (
              <TypefaceCard
                title="Heading Typeface"
                family={headingTypeface.family}
              />
            )}
            {bodyTypeface && (
              <TypefaceCard
                title="Body Typeface"
                family={bodyTypeface.family}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Heading Styles */}
      {headings.length > 0 && (
        <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-slate-900">Heading Styles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {headings.map((heading) => (
                <HeadingStyleCard key={heading.level} heading={heading} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Body Text Styles */}
      {bodyText.length > 0 && (
        <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold text-slate-900">Body Text Styles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {bodyText.map((style) => (
                <BodyTextStyleGrid key={style.size} style={style} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TypefaceCard({ title, family }: { title: string; family: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-600">{title}</h4>
        <CopyButton value={family} label={title} variant="individual" />
      </div>
      <div className="p-6 bg-slate-50 rounded-2xl space-y-2" style={{ fontFamily: family }}>
        <p className="text-sm text-slate-700">{SAMPLE_TEXT}</p>
        <p className="text-sm text-slate-700">{SAMPLE_LOWER}</p>
        <p className="text-sm text-slate-700">{SAMPLE_NUMBERS}</p>
        <p className="text-sm text-slate-700">{SAMPLE_SPECIAL}</p>
      </div>
      <p className="text-xs font-mono text-slate-400">{family}</p>
    </div>
  );
}

function HeadingStyleCard({ heading }: { heading: HeadingStyle }) {
  const { level, desktop, mobile } = heading;
  const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

  return (
    <div className="space-y-3 pb-6 border-b border-slate-100 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="text-lg font-bold text-slate-900 mb-3">Heading {level}</h4>
          <HeadingTag className="text-slate-700 mb-4" style={{ fontSize: desktop.fontSize, lineHeight: desktop.lineHeight }}>
            The quick brown fox jumps over the lazy dog
          </HeadingTag>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <StyleSpec
          label="Desktop"
          fontSize={desktop.fontSize}
          lineHeight={desktop.lineHeight}
        />
        <StyleSpec
          label="Mobile"
          fontSize={mobile.fontSize}
          lineHeight={mobile.lineHeight}
        />
      </div>
    </div>
  );
}

function StyleSpec({ label, fontSize, lineHeight }: { label: string; fontSize: string; lineHeight: string }) {
  return (
    <div className="p-3 bg-slate-50 rounded-xl space-y-1">
      <p className="text-xs font-bold text-slate-400 uppercase">{label}</p>
      <div className="flex items-baseline gap-2">
        <CopyButton value={fontSize} variant="individual" />
        <p className="text-sm font-mono text-slate-700">
          <span className="font-bold">Font size:</span> {fontSize}
        </p>
      </div>
      <div className="flex items-baseline gap-2">
        <CopyButton value={lineHeight} variant="individual" />
        <p className="text-sm font-mono text-slate-700">
          <span className="font-bold">Line height:</span> {lineHeight}
        </p>
      </div>
    </div>
  );
}

function BodyTextStyleGrid({ style }: { style: BodyTextStyle }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-lg font-bold text-slate-900 capitalize">Text {style.size}</h4>
          <p className="text-sm font-mono text-slate-500">
            Font size: {style.fontSize} | Line height: {style.lineHeight}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {style.weights.map((weight) => (
          <div key={weight.name} className="p-4 bg-slate-50 rounded-xl space-y-2 group">
            <p
              className="text-slate-700 capitalize"
              style={{
                fontSize: style.fontSize,
                lineHeight: style.lineHeight,
                fontWeight: weight.value,
              }}
            >
              {weight.name.replace('-', ' ')}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs font-mono text-slate-400">{weight.value}</p>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton value={weight.value} variant="individual" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
