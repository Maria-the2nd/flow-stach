"use client";

import { Button } from "@/components/ui/button";
import { VariablesSection } from "./variables-section";
import { TypographySection } from "./typography-section";
import { SpacingSection } from "./spacing-section";
import { RadiusSection } from "./radius-section";
import { ShadowsSection } from "./shadows-section";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { EnhancedTokenExtraction } from "@/lib/token-extractor";

interface StyleGuideViewProps {
  tokens: EnhancedTokenExtraction;
  onCopyWebflowPayload?: () => void;
}

export function StyleGuideView({ tokens, onCopyWebflowPayload }: StyleGuideViewProps) {
  // Extract color tokens
  const colorTokens = tokens.variables
    .filter(v => v.type === 'color')
    .map(v => ({
      name: v.cssVar.replace('--', ''),
      value: v.values?.light || v.value || '',
      description: v.path,
    }));

  // Extract typography tokens
  const typographyTokens = tokens.variables
    .filter(v => v.type === 'fontFamily')
    .map(v => ({
      name: v.cssVar.replace('--', ''),
      value: v.value || '',
    }));

  // Extract spacing tokens
  const spacingTokens = tokens.variables
    .filter(v => v.type === 'spacing')
    .map(v => ({
      name: v.cssVar.replace('--', ''),
      value: v.value || '',
    }));

  // Prepare typefaces
  const headingTypeface = tokens.fonts?.families[0] ? {
    family: tokens.fonts.families[0],
  } : undefined;

  const bodyTypeface = tokens.fonts?.families[1] ? {
    family: tokens.fonts.families[1],
  } : headingTypeface;

  // Prepare heading styles (default values for demonstration)
  const headings = [
    {
      level: 1 as const,
      desktop: { fontSize: '56px / 3.5rem', lineHeight: '120%' },
      mobile: { fontSize: '40px / 2.5rem', lineHeight: '120%' },
    },
    {
      level: 2 as const,
      desktop: { fontSize: '48px / 3rem', lineHeight: '120%' },
      mobile: { fontSize: '36px / 2.25rem', lineHeight: '120%' },
    },
    {
      level: 3 as const,
      desktop: { fontSize: '40px / 2.5rem', lineHeight: '120%' },
      mobile: { fontSize: '32px / 2rem', lineHeight: '120%' },
    },
    {
      level: 4 as const,
      desktop: { fontSize: '32px / 2rem', lineHeight: '130%' },
      mobile: { fontSize: '24px / 1.5rem', lineHeight: '140%' },
    },
    {
      level: 5 as const,
      desktop: { fontSize: '24px / 1.5rem', lineHeight: '140%' },
      mobile: { fontSize: '20px / 1.25rem', lineHeight: '140%' },
    },
    {
      level: 6 as const,
      desktop: { fontSize: '20px / 1.25rem', lineHeight: '140%' },
      mobile: { fontSize: '18px / 1.125rem', lineHeight: '140%' },
    },
  ];

  // Prepare body text styles
  const bodyText = [
    {
      size: 'large' as const,
      fontSize: '20px / 1.25rem',
      lineHeight: '150%',
      weights: [
        { name: 'extra-bold' as const, value: '800' },
        { name: 'bold' as const, value: '700' },
        { name: 'semi-bold' as const, value: '600' },
        { name: 'medium' as const, value: '500' },
        { name: 'normal' as const, value: '400' },
        { name: 'light' as const, value: '300' },
      ],
    },
    {
      size: 'medium' as const,
      fontSize: '18px / 1.125rem',
      lineHeight: '150%',
      weights: [
        { name: 'extra-bold' as const, value: '800' },
        { name: 'bold' as const, value: '700' },
        { name: 'semi-bold' as const, value: '600' },
        { name: 'medium' as const, value: '500' },
        { name: 'normal' as const, value: '400' },
        { name: 'light' as const, value: '300' },
      ],
    },
    {
      size: 'regular' as const,
      fontSize: '16px / 1rem',
      lineHeight: '150%',
      weights: [
        { name: 'extra-bold' as const, value: '800' },
        { name: 'bold' as const, value: '700' },
        { name: 'semi-bold' as const, value: '600' },
        { name: 'medium' as const, value: '500' },
        { name: 'normal' as const, value: '400' },
        { name: 'light' as const, value: '300' },
      ],
    },
    {
      size: 'small' as const,
      fontSize: '14px / 0.875rem',
      lineHeight: '150%',
      weights: [
        { name: 'extra-bold' as const, value: '800' },
        { name: 'bold' as const, value: '700' },
        { name: 'semi-bold' as const, value: '600' },
        { name: 'medium' as const, value: '500' },
        { name: 'normal' as const, value: '400' },
        { name: 'light' as const, value: '300' },
      ],
    },
    {
      size: 'tiny' as const,
      fontSize: '12px / 0.75rem',
      lineHeight: '150%',
      weights: [
        { name: 'extra-bold' as const, value: '800' },
        { name: 'bold' as const, value: '700' },
        { name: 'semi-bold' as const, value: '600' },
        { name: 'medium' as const, value: '500' },
        { name: 'normal' as const, value: '400' },
        { name: 'light' as const, value: '300' },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Webflow Export Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Style Guide (Design Tokens)</h2>
          <p className="text-slate-500 mt-1">
            Complete documentation of your visual system and styles
          </p>
        </div>
        {onCopyWebflowPayload && (
          <Button
            onClick={onCopyWebflowPayload}
            className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl shadow-blue-200/50 font-bold px-8 h-12 rounded-xl"
          >
            <HugeiconsIcon icon={Download01Icon} className="w-5 h-5" />
            Copy Style Guide (Design Tokens) to Webflow
          </Button>
        )}
      </div>

      {/* Variables (Colors) */}
      {colorTokens.length > 0 && (
        <VariablesSection primitiveColors={colorTokens} />
      )}

      {/* Typography */}
      {(typographyTokens.length > 0 || headingTypeface || bodyTypeface) && (
        <TypographySection
          headingTypeface={headingTypeface}
          bodyTypeface={bodyTypeface}
          headings={headings}
          bodyText={bodyText}
          allTypographyTokens={typographyTokens}
        />
      )}

      {/* Spacing */}
      {spacingTokens.length > 0 && (
        <SpacingSection tokens={spacingTokens} />
      )}

      {/* Radius */}
      {tokens.radius && tokens.radius.length > 0 && (
        <RadiusSection tokens={tokens.radius} />
      )}

      {/* Shadows */}
      {tokens.shadows && tokens.shadows.length > 0 && (
        <ShadowsSection tokens={tokens.shadows} />
      )}
    </div>
  );
}
