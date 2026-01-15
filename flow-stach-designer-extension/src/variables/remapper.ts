/**
 * UUID Remapper
 * Remaps CSS variable references to Webflow variable UUIDs
 */

/**
 * Remap variable references in styleLess strings
 * Converts: var(--token-name, fallback) -> var(--uuid-xxx)
 */
export function remapVariableReferences(
  styleLess: string,
  uuidMap: Map<string, string>
): string {
  if (!styleLess || uuidMap.size === 0) {
    return styleLess;
  }

  // Pattern: var(--token-name, fallback) -> var(--uuid-xxx)
  return styleLess.replace(
    /var\(\s*(--[\w-]+)\s*,\s*[^)]+\)/g,
    (match, cssVar) => {
      const uuid = uuidMap.get(cssVar);
      if (uuid) {
        return `var(--${uuid})`;
      }
      return match; // Keep original if no UUID mapping found
    }
  );
}

/**
 * Remap all variable references in a style object
 */
export function remapStyleVariables(
  style: { styleLess: string; variants?: Record<string, { styleLess: string }> },
  uuidMap: Map<string, string>
): void {
  style.styleLess = remapVariableReferences(style.styleLess, uuidMap);
  
  if (style.variants) {
    for (const [variant, entry] of Object.entries(style.variants)) {
      style.variants[variant] = {
        styleLess: remapVariableReferences(entry.styleLess, uuidMap)
      };
    }
  }
}
