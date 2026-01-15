/**
 * Variable Manager
 * Creates and manages Webflow variables from token manifests
 */

import type { Variable, VariableCollection } from '../global';
import type { TokenManifest } from '../types';

/**
 * Find a variable collection by name
 */
async function findCollectionByName(name: string): Promise<VariableCollection | null> {
  if (typeof webflow === 'undefined' || !webflow.getAllVariableCollections) {
    return null;
  }

  const collections = await webflow.getAllVariableCollections();
  for (const col of collections) {
    if (col.getName() === name) {
      return col;
    }
  }
  return null;
}

/**
 * Find a variable by name within a collection
 */
async function findVariableByName(
  collection: VariableCollection,
  name: string
): Promise<Variable | null> {
  if (!collection.getVariables) {
    return null;
  }

  const variables = await collection.getVariables();
  for (const variable of variables) {
    if (variable.getName() === name) {
      return variable;
    }
  }
  return null;
}

/**
 * Ensure variables exist in Webflow from token manifest
 * Returns a map of CSS variable name -> Webflow variable UUID
 */
export async function ensureVariables(
  manifest: TokenManifest
): Promise<Map<string, string>> {
  const uuidMap = new Map<string, string>();

  if (typeof webflow === 'undefined') {
    console.warn('[Flow Stach] Webflow APIs not available');
    return uuidMap;
  }

  try {
    // 1. Determine collection name
    const collectionName = manifest.collectionName || 
      `${manifest.namespace.charAt(0).toUpperCase() + manifest.namespace.slice(1)} Tokens`;

    // 2. Find or create collection
    let collection = await findCollectionByName(collectionName);
    if (!collection) {
      if (webflow.createVariableCollection) {
        collection = await webflow.createVariableCollection({
          name: collectionName
        });
        console.log(`[Flow Stach] Created variable collection: ${collectionName}`);
      } else {
        console.error('[Flow Stach] createVariableCollection() not available');
        return uuidMap;
      }
    }

    // 3. Ensure modes exist
    if (collection.getModes) {
      const modes = await collection.getModes();
      const modeNames = new Set(
        modes.map((m: { getName: () => string }) => m.getName())
      );

      for (const modeName of manifest.modes) {
        if (!modeNames.has(modeName)) {
          if (collection.createMode) {
            await collection.createMode({ name: modeName });
            console.log(`[Flow Stach] Created mode: ${modeName}`);
          }
        }
      }
    }

    // 4. Create variables and build UUID map
    for (const varDef of manifest.variables) {
      // Determine variable name (use name from manifest, or derive from cssVar)
      const varName = varDef.name || varDef.cssVar.replace(/^--/, '').replace(/-/g, ' ');
      
      let variable = await findVariableByName(collection, varName);
      
      if (!variable) {
        // Determine variable type
        const varType = varDef.type === 'COLOR' || varDef.type === 'color' 
          ? 'COLOR' 
          : 'FONT_FAMILY';

        if (collection.createVariable) {
          variable = await collection.createVariable({
            name: varName,
            type: varType
          });
          console.log(`[Flow Stach] Created variable: ${varName}`);
        } else {
          console.error('[Flow Stach] createVariable() not available');
          continue;
        }
      }

      // Set values per mode
      if (variable.setValue) {
        const lightValue = varDef.values?.light || varDef.value || '';
        if (lightValue) {
          await variable.setValue('light', lightValue);
        }

        if (varDef.values?.dark) {
          await variable.setValue('dark', varDef.values.dark);
        }
      }

      // Map CSS variable name to Webflow variable UUID
      if (variable.getId) {
        const uuid = variable.getId();
        uuidMap.set(varDef.cssVar, uuid);
        console.log(`[Flow Stach] Mapped ${varDef.cssVar} -> ${uuid}`);
      }
    }
  } catch (error) {
    console.error('[Flow Stach] Error ensuring variables:', error);
  }

  return uuidMap;
}
