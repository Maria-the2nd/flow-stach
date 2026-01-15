/**
 * DOM Injector
 * Injects nodes and styles into Webflow Designer
 */

import type { ClipboardPayload, InstallResult } from '../types';
import { ensureVariables } from '../variables/manager';
import { remapStyleVariables } from '../variables/remapper';

/**
 * Parse styleLess string into properties object
 */
function parseStyleLess(styleLess: string): Record<string, string> {
  const properties: Record<string, string> = {};
  
  if (!styleLess) return properties;
  
  const props = styleLess.split(';').map(p => p.trim()).filter(Boolean);
  for (const prop of props) {
    const colonIndex = prop.indexOf(':');
    if (colonIndex === -1) continue;
    
    const name = prop.substring(0, colonIndex).trim();
    const value = prop.substring(colonIndex + 1).trim();
    if (name && value) {
      properties[name] = value;
    }
  }
  
  return properties;
}

/**
 * Convert Webflow variants to breakpoint styles format
 */
function convertVariantsToBreakpoints(
  variants: Record<string, { styleLess: string }>
): Record<string, Record<string, string>> {
  const breakpointStyles: Record<string, Record<string, string>> = {};
  
  for (const [variant, entry] of Object.entries(variants)) {
    // Map variant names to breakpoints
    // Webflow breakpoints: tiny, small, medium, desktop
    if (['tiny', 'small', 'medium', 'desktop'].includes(variant)) {
      breakpointStyles[variant] = parseStyleLess(entry.styleLess);
    }
    // Handle pseudo-class variants (hover, focus, etc.)
    // These would need to be handled differently in Webflow API
  }
  
  return breakpointStyles;
}

/**
 * Check if a style exists in Webflow
 */
async function styleExists(className: string): Promise<boolean> {
  if (typeof webflow === 'undefined' || !webflow.getAllStyles) {
    return false;
  }
  
  try {
    const styles = await webflow.getAllStyles();
    return styles.some((s: { getName: () => string }) => s.getName() === className);
  } catch {
    return false;
  }
}

/**
 * Install payload into Webflow Designer
 */
export async function installPayload(
  payload: ClipboardPayload,
  skipClasses: string[]
): Promise<InstallResult> {
  const result: InstallResult = {
    success: false,
    nodesCreated: 0,
    classesCreated: 0,
    classesSkipped: 0,
    variablesCreated: 0,
    errors: []
  };

  if (typeof webflow === 'undefined') {
    result.errors?.push('Webflow APIs not available');
    return result;
  }

  const skipSet = new Set(skipClasses);

  try {
    // 1. Create variables (if manifest present)
    let uuidMap = new Map<string, string>();
    if (payload.meta?.tokenManifest) {
      uuidMap = await ensureVariables(payload.meta.tokenManifest);
      result.variablesCreated = uuidMap.size;
    }

    // 2. Filter and remap styles
    const stylesToCreate = payload.payload.styles.filter(
      s => !skipSet.has(s.name)
    );
    result.classesSkipped = payload.payload.styles.length - stylesToCreate.length;

    // Remap variable UUIDs in styles
    for (const style of stylesToCreate) {
      remapStyleVariables(style, uuidMap);
    }

    // 3. Create styles via Webflow API
    for (const style of stylesToCreate) {
      try {
        // Check if style already exists (shouldn't if collision detection worked)
        const exists = await styleExists(style.name);
        if (exists) {
          console.warn(`[Flow Stach] Style "${style.name}" already exists, skipping`);
          result.classesSkipped++;
          continue;
        }

        // Parse styleLess into properties
        const properties = parseStyleLess(style.styleLess);
        const breakpointStyles = convertVariantsToBreakpoints(style.variants);

        // Create style via Webflow API
        if (webflow.createStyle) {
          await webflow.createStyle({
            name: style.name,
            properties,
            breakpointStyles
          });
          result.classesCreated++;
        } else {
          result.errors?.push(`createStyle() not available`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors?.push(`Failed to create style "${style.name}": ${errorMsg}`);
        console.error(`[Flow Stach] Error creating style "${style.name}":`, error);
      }
    }

    // 4. Inject nodes
    let parentId: string | null = null;
    
    // Get selected element or use body
    if (webflow.getSelectedElement) {
      const selectedElement = await webflow.getSelectedElement();
      if (selectedElement && selectedElement.getId) {
        parentId = selectedElement.getId();
      }
    }
    
    if (!parentId) {
      // Fallback to body
      if (webflow.getBody) {
        const body = await webflow.getBody();
        if (body && body.getId) {
          parentId = body.getId();
        }
      }
    }

    if (!parentId) {
      result.errors?.push('Could not determine parent element for node injection');
      return result;
    }

    for (const node of payload.payload.nodes) {
      try {
        if (node.text && node.v !== undefined) {
          // Create text node
          if (webflow.createTextNode) {
            await webflow.createTextNode(parentId, node.v);
            result.nodesCreated++;
          } else {
            result.errors?.push('createTextNode() not available');
          }
        } else if (node.type || node.tag) {
          // Create element node
          // Filter classes to only include created + existing (not skipped-as-collision)
          const nodeClasses = node.classes || [];
          
          // Resolve all class existence checks
          const validClasses: string[] = [];
          for (const className of nodeClasses) {
            if (skipSet.has(className)) {
              // Check if it exists (user wants to use existing)
              const exists = await styleExists(className);
              if (exists) {
                validClasses.push(className);
              }
            } else {
              // Include if not skipped (will be created or already exists)
              validClasses.push(className);
            }
          }

          if (webflow.createElement) {
            await webflow.createElement(parentId, {
              tag: node.tag || 'div',
              classes: validClasses,
              attributes: node.data?.xattr || []
            });
            result.nodesCreated++;
          } else {
            result.errors?.push('createElement() not available');
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors?.push(`Failed to create node "${node._id}": ${errorMsg}`);
        console.error(`[Flow Stach] Error creating node "${node._id}":`, error);
      }
    }

    result.success = (result.errors?.length ?? 0) === 0;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors?.push(`Install failed: ${errorMsg}`);
    console.error('[Flow Stach] Install error:', error);
  }

  return result;
}
