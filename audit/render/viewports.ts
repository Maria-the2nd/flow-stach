/**
 * Viewport Definitions
 *
 * Standard viewport sizes for responsive testing.
 */

import type { ViewportDimensions } from '../types';

/**
 * Default viewport configurations matching common device sizes
 */
export const VIEWPORT_PRESETS: Record<string, ViewportDimensions> = {
  // Desktop
  desktop: { width: 1440, height: 900 },
  desktopLarge: { width: 1920, height: 1080 },
  desktopSmall: { width: 1280, height: 800 },

  // Tablet
  tablet: { width: 834, height: 1112 }, // iPad Pro 11"
  tabletLandscape: { width: 1112, height: 834 },
  tabletMini: { width: 768, height: 1024 }, // iPad Mini

  // Mobile
  mobile: { width: 390, height: 844 }, // iPhone 14
  mobileLarge: { width: 428, height: 926 }, // iPhone 14 Pro Max
  mobileSmall: { width: 375, height: 667 }, // iPhone SE
};

/**
 * Get viewport dimensions by name
 */
export function getViewport(name: string): ViewportDimensions | undefined {
  return VIEWPORT_PRESETS[name];
}

/**
 * Get all viewport names
 */
export function getViewportNames(): string[] {
  return Object.keys(VIEWPORT_PRESETS);
}

/**
 * Merge custom viewports with defaults
 */
export function mergeViewports(
  custom?: Record<string, ViewportDimensions>
): Record<string, ViewportDimensions> {
  if (!custom) {
    return {
      desktop: VIEWPORT_PRESETS.desktop,
      tablet: VIEWPORT_PRESETS.tablet,
      mobile: VIEWPORT_PRESETS.mobile,
    };
  }

  return {
    desktop: custom.desktop || VIEWPORT_PRESETS.desktop,
    tablet: custom.tablet || VIEWPORT_PRESETS.tablet,
    mobile: custom.mobile || VIEWPORT_PRESETS.mobile,
    ...custom,
  };
}
