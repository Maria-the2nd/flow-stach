/**
 * Collision Detector
 * Detects existing classes and variables in the target Webflow site
 */

import type { ClipboardPayload, CollisionReport, CollisionAction } from '../types';

/**
 * Extract variable references from styleLess strings
 */
function extractVariableReferences(payload: ClipboardPayload): string[] {
  const vars = new Set<string>();
  
  // Check all styles
  for (const style of payload.payload.styles) {
    // Extract from base styleLess
    const baseMatches = style.styleLess.match(/var\(\s*(--[\w-]+)\s*[,)]/g);
    if (baseMatches) {
      baseMatches.forEach(match => {
        const varMatch = match.match(/--([\w-]+)/);
        if (varMatch) {
          vars.add(`--${varMatch[1]}`);
        }
      });
    }
    
    // Extract from variants
    for (const variant of Object.values(style.variants)) {
      const variantMatches = variant.styleLess.match(/var\(\s*(--[\w-]+)\s*[,)]/g);
      if (variantMatches) {
        variantMatches.forEach(match => {
          const varMatch = match.match(/--([\w-]+)/);
          if (varMatch) {
            vars.add(`--${varMatch[1]}`);
          }
        });
      }
    }
  }
  
  return Array.from(vars);
}

/**
 * Detect collisions between payload and existing Webflow site
 */
export async function detectCollisions(
  payload: ClipboardPayload
): Promise<CollisionReport> {
  const existingClasses: string[] = [];
  const missingVariables: string[] = [];
  const suggestedActions: CollisionAction[] = [];

  try {
    // 1. Get all existing styles from Webflow
    if (typeof webflow !== 'undefined' && webflow.getAllStyles) {
      const existingStyles = await webflow.getAllStyles();
      const existingClassNames = new Set(
        existingStyles.map((s: { getName: () => string }) => s.getName())
      );

      // 2. Check payload classes against existing
      const payloadClasses = payload.payload.styles.map(s => s.name);
      for (const className of payloadClasses) {
        if (existingClassNames.has(className)) {
          existingClasses.push(className);
          suggestedActions.push({
            className,
            action: 'skip',
            reason: `Class "${className}" already exists in this site`
          });
        }
      }
    } else {
      console.warn('[Flow Stach] webflow.getAllStyles() not available');
    }

    // 3. Check variables
    if (typeof webflow !== 'undefined' && webflow.getAllVariableCollections) {
      const collections = await webflow.getAllVariableCollections();
      const existingVarNames = new Set<string>();
      
      for (const col of collections) {
        if (col.getVariables) {
          const vars = await col.getVariables();
          vars.forEach((v: { getName: () => string }) => {
            existingVarNames.add(v.getName());
          });
        }
      }

      // 4. Extract variable references from payload
      const referencedVars = extractVariableReferences(payload);
      for (const varName of referencedVars) {
        // Check if variable exists (by CSS var name or by variable name)
        const varNameWithoutPrefix = varName.replace(/^--/, '');
        let found = false;
        
        // Check exact match
        if (existingVarNames.has(varName) || existingVarNames.has(varNameWithoutPrefix)) {
          found = true;
        }
        
        // Check if any variable has this as a CSS custom property
        // (This would require iterating through variables, which may not be available)
        
        if (!found) {
          missingVariables.push(varName);
        }
      }
    } else {
      console.warn('[Flow Stach] webflow.getAllVariableCollections() not available');
    }
  } catch (error) {
    console.error('[Flow Stach] Error detecting collisions:', error);
    // Return partial report if there's an error
  }

  return {
    existingClasses,
    missingVariables,
    suggestedActions
  };
}
