import { mutation } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { requireAdmin } from "./auth"
import { Id } from "./_generated/dataModel"
import { validateAndSanitizeWebflowJson } from "./webflow_validation"

/**
 * CRITICAL: Validate and sanitize Webflow JSON before storing.
 * This prevents corrupted payloads from reaching the database.
 *
 * @param webflowJson - The raw webflowJson string
 * @returns Object with sanitized JSON and validation info
 */
function safeWebflowJson(webflowJson: string | undefined): {
  json: string;
  warnings: string[];
  wasInvalid: boolean;
} {
  const placeholderJson = JSON.stringify({ placeholder: true });

  if (!webflowJson || webflowJson.trim() === "" || webflowJson.trim() === "{}") {
    return { json: placeholderJson, warnings: [], wasInvalid: false };
  }

  const result = validateAndSanitizeWebflowJson(webflowJson);

  // If validation completely failed, use placeholder
  if (!result.validation.canProceed && result.validation.issues.some(i => i.code === "INVALID_JSON" || i.code === "INVALID_STRUCTURE")) {
    console.warn("[import] Invalid webflowJson, using placeholder:", result.validation.summary);
    return { json: placeholderJson, warnings: [`Invalid payload: ${result.validation.summary}`], wasInvalid: true };
  }

  // Return sanitized JSON with any warnings
  return {
    json: result.sanitizedJson,
    warnings: result.changes,
    wasInvalid: result.sanitizationApplied,
  };
}

/**
 * Import sections from parsed HTML
 * Creates assets and payloads in bulk
 */
export const importSections = mutation({
  args: {
    designSystemName: v.string(),
    designSystemSlug: v.string(),
    designSystemImageUrl: v.optional(v.string()),
    sections: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
        category: v.string(),
        tags: v.array(v.string()),
        codePayload: v.string(),
        webflowJson: v.optional(v.string()),
        dependencies: v.optional(v.array(v.string())),
      })
    ),
    tokenManifest: v.optional(v.string()),
    tokenWebflowJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const placeholderWebflowJson = JSON.stringify({ placeholder: true })
    const defaultCapabilityNotes = "Webflow payload not generated yet. Use Install Snippet."
    const normalizeWebflowJson = (value: string | undefined) => {
      if (!value || value.trim() === "" || value.trim() === "{}") {
        return placeholderWebflowJson
      }
      return value
    }
    const results = {
      assetsCreated: 0,
      assetsUpdated: 0,
      payloadsCreated: 0,
      payloadsUpdated: 0,
      errors: [] as string[],
      validationWarnings: [] as string[],
    }

    const existingTemplate = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", args.designSystemSlug))
      .unique()

    const templateId = existingTemplate
      ? existingTemplate._id
      : await ctx.db.insert("templates", {
        name: args.designSystemName,
        slug: args.designSystemSlug,
        imageUrl: args.designSystemImageUrl,
        createdAt: now,
        updatedAt: now,
      })

    if (existingTemplate) {
      await ctx.db.patch(existingTemplate._id, {
        name: args.designSystemName,
        imageUrl: args.designSystemImageUrl ?? existingTemplate.imageUrl,
        updatedAt: now,
      })
    }

    // First, create/update the design tokens asset if manifest provided
    if (args.tokenManifest) {
      const tokenSlug = `${args.designSystemSlug}-tokens`
      const existingTokenAsset = await ctx.db
        .query("assets")
        .withIndex("by_slug", (q) => q.eq("slug", tokenSlug))
        .unique()

      const hasTokenWebflowJson = !!args.tokenWebflowJson
      const tokenPasteReliability = hasTokenWebflowJson ? "full" : "none"
      const tokenCapabilityNotes = hasTokenWebflowJson
        ? "Webflow payload generated from tokens. Direct paste supported."
        : defaultCapabilityNotes

      if (existingTokenAsset) {
        // Update existing
        await ctx.db.patch(existingTokenAsset._id, {
          title: "Design Tokens",
          status: "published",
          pasteReliability: tokenPasteReliability,
          capabilityNotes: tokenCapabilityNotes,
          updatedAt: now,
        })

        // Update payload
        const existingPayload = await ctx.db
          .query("payloads")
          .withIndex("by_asset_id", (q) => q.eq("assetId", existingTokenAsset._id))
          .unique()

        if (existingPayload) {
          // CRITICAL: Validate and sanitize webflowJson before storing
          const tokenJsonToStore = args.tokenWebflowJson
            ? safeWebflowJson(args.tokenWebflowJson)
            : { json: normalizeWebflowJson(existingPayload.webflowJson), warnings: [], wasInvalid: false };

          if (tokenJsonToStore.warnings.length > 0) {
            results.validationWarnings.push(`Token payload: ${tokenJsonToStore.warnings.join(", ")}`);
          }

          await ctx.db.patch(existingPayload._id, {
            codePayload: `/* TOKEN MANIFEST */\n${args.tokenManifest}`,
            webflowJson: tokenJsonToStore.json,
            updatedAt: now,
          })
        }
        results.assetsUpdated++
      } else {
        // Create new token asset
        const tokenAssetId = await ctx.db.insert("assets", {
          slug: tokenSlug,
          title: "Design Tokens",
          category: "tokens",
          description: `Design tokens for ${args.designSystemName}`,
          tags: ["tokens", "design-system", args.designSystemSlug],
          templateId,
          isNew: true,
          status: "published",
          pasteReliability: tokenPasteReliability,
          capabilityNotes: tokenCapabilityNotes,
          supportsCodeCopy: true,
          createdAt: now,
          updatedAt: now,
        })

        // CRITICAL: Validate and sanitize webflowJson before storing
        const tokenJsonResult = safeWebflowJson(args.tokenWebflowJson);
        if (tokenJsonResult.warnings.length > 0) {
          results.validationWarnings.push(`Token payload: ${tokenJsonResult.warnings.join(", ")}`);
        }

        await ctx.db.insert("payloads", {
          assetId: tokenAssetId,
          webflowJson: tokenJsonResult.json,
          codePayload: `/* TOKEN MANIFEST */\n${args.tokenManifest}`,
          dependencies: [],
          createdAt: now,
          updatedAt: now,
        })

        results.assetsCreated++
        results.payloadsCreated++
      }
    }

    // Import each section
    for (const section of args.sections) {
      try {
        // Check if asset exists
        const existingAsset = await ctx.db
          .query("assets")
          .withIndex("by_slug", (q) => q.eq("slug", section.slug))
          .unique()

        let assetId: Id<"assets">

        // Determine paste reliability based on whether webflowJson is provided
        const hasWebflowJson = !!section.webflowJson
        const pasteReliability = hasWebflowJson ? "full" : "none"
        const capabilityNotes = hasWebflowJson
          ? "Webflow JSON generated from HTML/CSS. Direct paste supported."
          : defaultCapabilityNotes

        if (existingAsset) {
          // Update existing asset
          await ctx.db.patch(existingAsset._id, {
            title: section.name,
            category: section.category,
            tags: section.tags,
            templateId,
            status: "published",
            pasteReliability,
            capabilityNotes,
            updatedAt: now,
          })
          assetId = existingAsset._id
          results.assetsUpdated++
        } else {
          // Create new asset
          assetId = await ctx.db.insert("assets", {
            slug: section.slug,
            title: section.name,
            category: section.category,
            description: `${section.name} from ${args.designSystemName}`,
            tags: section.tags,
            templateId,
            isNew: true,
            status: "published",
            pasteReliability,
            capabilityNotes,
            supportsCodeCopy: true,
            createdAt: now,
            updatedAt: now,
          })
          results.assetsCreated++
        }

        // Check for existing payload
        const existingPayload = await ctx.db
          .query("payloads")
          .withIndex("by_asset_id", (q) => q.eq("assetId", assetId))
          .unique()

        if (existingPayload) {
          // Update payload - use provided webflowJson if available
          // CRITICAL: Validate and sanitize webflowJson before storing
          const dependencies = section.dependencies ?? existingPayload.dependencies ?? []
          const jsonResult = section.webflowJson
            ? safeWebflowJson(section.webflowJson)
            : { json: normalizeWebflowJson(existingPayload.webflowJson), warnings: [], wasInvalid: false };

          if (jsonResult.warnings.length > 0) {
            results.validationWarnings.push(`${section.name}: ${jsonResult.warnings.join(", ")}`);
          }

          await ctx.db.patch(existingPayload._id, {
            codePayload: section.codePayload,
            webflowJson: jsonResult.json,
            dependencies,
            updatedAt: now,
          })
          results.payloadsUpdated++
        } else {
          // Create payload - use provided webflowJson or placeholder
          // CRITICAL: Validate and sanitize webflowJson before storing
          const jsonResult = safeWebflowJson(section.webflowJson);
          if (jsonResult.warnings.length > 0) {
            results.validationWarnings.push(`${section.name}: ${jsonResult.warnings.join(", ")}`);
          }

          await ctx.db.insert("payloads", {
            assetId: assetId,
            webflowJson: jsonResult.json,
            codePayload: section.codePayload,
            dependencies: section.dependencies ?? [],
            createdAt: now,
            updatedAt: now,
          })
          results.payloadsCreated++
        }
      } catch (error) {
        results.errors.push(`Failed to import ${section.name}: ${error}`)
      }
    }

    return results
  },
})

/**
 * Delete all imported sections for a design system
 */
export const deleteDesignSystem = mutation({
  args: {
    designSystemSlug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Find all assets with this design system tag
    const assets = await ctx.db.query("assets").collect()
    const matchingAssets = assets.filter(
      (a) => a.tags.includes(args.designSystemSlug) || a.slug.startsWith(args.designSystemSlug)
    )

    let deleted = 0

    for (const asset of matchingAssets) {
      // Delete payload first
      const payload = await ctx.db
        .query("payloads")
        .withIndex("by_asset_id", (q) => q.eq("assetId", asset._id))
        .unique()

      if (payload) {
        await ctx.db.delete(payload._id)
      }

      // Delete asset
      await ctx.db.delete(asset._id)
      deleted++
    }

    return { deleted }
  },
})

/**
 * Get import stats
 */
export const getImportStats = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const assets = await ctx.db.query("assets").collect()
    const payloads = await ctx.db.query("payloads").collect()

    // Group by category
    const byCategory: Record<string, number> = {}
    for (const asset of assets) {
      byCategory[asset.category] = (byCategory[asset.category] || 0) + 1
    }

    // Count design systems (unique slug prefixes)
    const designSystems = new Set<string>()
    for (const asset of assets) {
      const parts = asset.slug.split("-")
      if (parts.length >= 2) {
        designSystems.add(parts.slice(0, 2).join("-"))
      }
    }

    return {
      totalAssets: assets.length,
      totalPayloads: payloads.length,
      byCategory,
      designSystemCount: designSystems.size,
    }
  },
})

// ============================================
// NEW: Project-based import with artifact storage
// ============================================

/**
 * Create or update an import project with extracted artifacts
 * This stores all 4 artifacts (tokens, CSS, clean HTML, JS) for reuse
 */
export const importProject = mutation({
  args: {
    projectName: v.string(),
    projectSlug: v.string(),
    artifacts: v.object({
      tokensJson: v.optional(v.string()),
      tokensCss: v.optional(v.string()),
      stylesCss: v.string(),
      classIndex: v.string(),
      cleanHtml: v.string(),
      scriptsJs: v.optional(v.string()),
      externalScripts: v.optional(v.array(v.string())),
      jsHooks: v.optional(v.array(v.string())),
    }),
    components: v.array(
      v.object({
        id: v.string(),
        name: v.string(),
        slug: v.string(),
        category: v.string(),
        tags: v.array(v.string()),
        htmlContent: v.string(),
        classesUsed: v.array(v.string()),
        jsHooks: v.array(v.string()),
        webflowJson: v.optional(v.string()),
        codePayload: v.string(),
      })
    ),
    tokenWebflowJson: v.optional(v.string()),
    sourceHtml: v.optional(v.string()),
    fonts: v.optional(v.array(v.object({
      name: v.string(),
      source: v.string(),
      url: v.optional(v.string()),
      status: v.string(),
      warning: v.optional(v.boolean()),
      installationGuide: v.string(),
    }))),
    images: v.optional(v.array(v.object({
      url: v.string(),
      type: v.string(),
      estimatedSize: v.optional(v.number()),
      sizeWarning: v.boolean(),
      blocked: v.boolean(),
      classification: v.string(),
    }))),
  },
  handler: async (ctx, args) => {
    // REQUIRE authentication - no orphan projects allowed
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new ConvexError("Authentication required to import projects");
    }
    const clerkId = user.subject;

    const now = Date.now()
    const results = {
      projectId: "" as string,
      assetsCreated: 0,
      assetsUpdated: 0,
      payloadsCreated: 0,
      payloadsUpdated: 0,
      artifactsStored: 0,
      errors: [] as string[],
      validationWarnings: [] as string[],
    }

    // PHASE 2: Font Detection & Image Validation
    // Note: Font detection and image validation will be performed client-side
    // and passed as part of the artifacts in a future update.
    // For now, we store placeholder data that the client will populate.

    // Parse design tokens if available (including enhanced tokens: radius, shadows)
    let designTokensData = undefined;
    if (args.artifacts.tokensJson) {
      try {
        const parsedTokens = JSON.parse(args.artifacts.tokensJson);
        designTokensData = {
          colors: parsedTokens.colors || [],
          typography: parsedTokens.typography || [],
          spacing: parsedTokens.spacing || [],
          radius: parsedTokens.radius || [],
          shadows: parsedTokens.shadows || [],
        };
      } catch (e) {
        results.validationWarnings.push(`Failed to parse design tokens: ${e}`);
      }
    }



    // 1. Create or update import project
    const existingProject = await ctx.db
      .query("importProjects")
      .withIndex("by_slug", (q) => q.eq("slug", args.projectSlug))
      .unique()

    let projectId: Id<"importProjects">

    const fontData = args.fonts ?? [];
    const imageData = args.images ?? [];

    if (existingProject) {
      // Verify ownership - can only update your own projects
      if (existingProject.userId !== clerkId) {
        throw new ConvexError("Not authorized to update this project");
      }
      await ctx.db.patch(existingProject._id, {
        name: args.projectName,
        status: "complete",
        userId: clerkId,
        sourceHtml: args.sourceHtml,
        componentCount: args.components.length,
        classCount: Object.keys(JSON.parse(args.artifacts.classIndex).classes || {}).length,
        hasTokens: !!args.artifacts.tokensJson,
        fonts: fontData.length > 0 ? fontData : undefined,
        images: imageData.length > 0 ? imageData : undefined,
        designTokens: designTokensData,
        updatedAt: now,
      })
      projectId = existingProject._id
    } else {
      projectId = await ctx.db.insert("importProjects", {
        name: args.projectName,
        slug: args.projectSlug,
        userId: clerkId,
        status: "complete",
        sourceHtml: args.sourceHtml,
        componentCount: args.components.length,
        classCount: Object.keys(JSON.parse(args.artifacts.classIndex).classes || {}).length,
        hasTokens: !!args.artifacts.tokensJson,
        fonts: fontData.length > 0 ? fontData : undefined,
        images: imageData.length > 0 ? imageData : undefined,
        designTokens: designTokensData,
        createdAt: now,
        updatedAt: now,
      })
    }

    results.projectId = projectId

    // 2. Store artifacts (delete existing first if updating)
    if (existingProject) {
      const existingArtifacts = await ctx.db
        .query("importArtifacts")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect()

      for (const artifact of existingArtifacts) {
        await ctx.db.delete(artifact._id)
      }
    }

    // Store each artifact type
    const artifactTypes: Array<{
      type:
      | "tokens_json"
      | "tokens_css"
      | "styles_css"
      | "class_index"
      | "clean_html"
      | "scripts_js"
      | "external_scripts"
      | "js_hooks"
      | "token_webflow_json"
      | "component_manifest"
      content: string | undefined
    }> = [
        { type: "tokens_json", content: args.artifacts.tokensJson },
        { type: "tokens_css", content: args.artifacts.tokensCss },
        { type: "styles_css", content: args.artifacts.stylesCss },
        { type: "class_index", content: args.artifacts.classIndex },
        { type: "clean_html", content: args.artifacts.cleanHtml },
        { type: "scripts_js", content: args.artifacts.scriptsJs },
        {
          type: "external_scripts",
          content: args.artifacts.externalScripts ? JSON.stringify(args.artifacts.externalScripts) : undefined,
        },
        {
          type: "js_hooks",
          content: args.artifacts.jsHooks ? JSON.stringify(args.artifacts.jsHooks) : undefined,
        },
        { type: "token_webflow_json", content: args.tokenWebflowJson },
        {
          type: "component_manifest",
          content: JSON.stringify(
            args.components.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              category: c.category,
              classesUsed: c.classesUsed,
              jsHooks: c.jsHooks,
            }))
          ),
        },
      ]

    for (const { type, content } of artifactTypes) {
      if (content) {
        await ctx.db.insert("importArtifacts", {
          projectId,
          type,
          content,
          createdAt: now,
        })
        results.artifactsStored++
      }
    }

    // 3. Create or update template
    const templateSlug = args.projectSlug
    const existingTemplate = await ctx.db
      .query("templates")
      .withIndex("by_slug", (q) => q.eq("slug", templateSlug))
      .unique()

    const templateId = existingTemplate
      ? existingTemplate._id
      : await ctx.db.insert("templates", {
        name: args.projectName,
        slug: templateSlug,
        createdAt: now,
        updatedAt: now,
      })

    if (args.tokenWebflowJson) {
      const tokenSlug = `${args.projectSlug}-tokens`
      const existingTokenAsset = await ctx.db
        .query("assets")
        .withIndex("by_slug", (q) => q.eq("slug", tokenSlug))
        .unique()

      if (existingTokenAsset) {
        await ctx.db.patch(existingTokenAsset._id, {
          title: `${args.projectName} - Tokens`,
          status: "published",
          pasteReliability: "full",
          capabilityNotes: "CSS styles as Webflow classes. Paste FIRST before components.",
          updatedAt: now,
        })

        const existingPayload = await ctx.db
          .query("payloads")
          .withIndex("by_asset_id", (q) => q.eq("assetId", existingTokenAsset._id))
          .unique()

        if (existingPayload) {
          // CRITICAL: Validate and sanitize webflowJson before storing
          const tokenJsonResult = safeWebflowJson(args.tokenWebflowJson);
          if (tokenJsonResult.warnings.length > 0) {
            results.validationWarnings.push(`Token payload: ${tokenJsonResult.warnings.join(", ")}`);
          }

          await ctx.db.patch(existingPayload._id, {
            webflowJson: tokenJsonResult.json,
            codePayload: args.artifacts.tokensJson
              ? `/* TOKEN MANIFEST */\n${args.artifacts.tokensJson}`
              : `/* CSS */\n${args.artifacts.stylesCss}`,
            updatedAt: now,
          })
          results.payloadsUpdated++
        }
        results.assetsUpdated++
      } else {
        const tokenAssetId = await ctx.db.insert("assets", {
          slug: tokenSlug,
          title: `${args.projectName} - Tokens`,
          category: "tokens",
          description: `CSS classes for ${args.projectName}. Paste FIRST before components.`,
          tags: ["tokens", "css", args.projectSlug],
          templateId,
          isNew: true,
          status: "published",
          pasteReliability: "full",
          capabilityNotes: "CSS styles as Webflow classes. Paste FIRST before components.",
          supportsCodeCopy: true,
          createdAt: now,
          updatedAt: now,
        })

        // CRITICAL: Validate and sanitize webflowJson before storing
        const tokenJsonResult = safeWebflowJson(args.tokenWebflowJson);
        if (tokenJsonResult.warnings.length > 0) {
          results.validationWarnings.push(`Token payload: ${tokenJsonResult.warnings.join(", ")}`);
        }

        await ctx.db.insert("payloads", {
          assetId: tokenAssetId,
          webflowJson: tokenJsonResult.json,
          codePayload: args.artifacts.tokensJson
            ? `/* TOKEN MANIFEST */\n${args.artifacts.tokensJson}`
            : `/* CSS */\n${args.artifacts.stylesCss}`,
          dependencies: [],
          createdAt: now,
          updatedAt: now,
        })

        results.assetsCreated++
        results.payloadsCreated++
      }
    }

    // 5. Create component assets
    for (const component of args.components) {
      try {
        const existingAsset = await ctx.db
          .query("assets")
          .withIndex("by_slug", (q) => q.eq("slug", component.slug))
          .unique()

        const hasWebflowJson = !!component.webflowJson
        const pasteReliability = hasWebflowJson ? "full" : "partial"
        const capabilityNotes = hasWebflowJson
          ? "Webflow JSON ready. Paste AFTER tokens."
          : "Component ready. Some styles may need manual adjustment."

        let assetId: Id<"assets">

        if (existingAsset) {
          await ctx.db.patch(existingAsset._id, {
            title: component.name,
            category: component.category,
            tags: component.tags,
            templateId,
            status: "published",
            pasteReliability,
            capabilityNotes,
            updatedAt: now,
          })
          assetId = existingAsset._id
          results.assetsUpdated++
        } else {
          assetId = await ctx.db.insert("assets", {
            slug: component.slug,
            title: component.name,
            category: component.category,
            description: `${component.name} component`,
            tags: component.tags,
            templateId,
            isNew: true,
            status: "published",
            pasteReliability,
            capabilityNotes,
            supportsCodeCopy: true,
            createdAt: now,
            updatedAt: now,
          })
          results.assetsCreated++
        }

        // Create/update payload
        const existingPayload = await ctx.db
          .query("payloads")
          .withIndex("by_asset_id", (q) => q.eq("assetId", assetId))
          .unique()

        const tokenDep = args.tokenWebflowJson ? [`${args.projectSlug}-tokens`] : []

        // CRITICAL: Validate and sanitize webflowJson before storing
        const componentJsonResult = safeWebflowJson(component.webflowJson);
        if (componentJsonResult.warnings.length > 0) {
          results.validationWarnings.push(`${component.name}: ${componentJsonResult.warnings.join(", ")}`);
        }

        if (existingPayload) {
          await ctx.db.patch(existingPayload._id, {
            webflowJson: componentJsonResult.json,
            codePayload: component.codePayload,
            dependencies: tokenDep,
            updatedAt: now,
          })
          results.payloadsUpdated++
        } else {
          await ctx.db.insert("payloads", {
            assetId,
            webflowJson: componentJsonResult.json,
            codePayload: component.codePayload,
            dependencies: tokenDep,
            createdAt: now,
            updatedAt: now,
          })
          results.payloadsCreated++
        }
      } catch (error) {
        results.errors.push(`Failed to create ${component.name}: ${error}`)
      }
    }

    return results
  },
})

/**
 * Get an import project with its artifacts
 */
export const getImportProject = mutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const project = await ctx.db
      .query("importProjects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()

    if (!project) {
      return null
    }

    const artifacts = await ctx.db
      .query("importArtifacts")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect()

    const artifactMap: Record<string, string> = {}
    for (const artifact of artifacts) {
      artifactMap[artifact.type] = artifact.content
    }

    return {
      project,
      artifacts: artifactMap,
    }
  },
})

/**
 * List all import projects
 */
export const listImportProjects = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const projects = await ctx.db.query("importProjects").order("desc").collect()

    return projects.map((p) => ({
      id: p._id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      componentCount: p.componentCount,
      classCount: p.classCount,
      hasTokens: p.hasTokens,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  },
})

/**
 * Delete an import project and its artifacts
 */
export const deleteImportProject = mutation({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const project = await ctx.db
      .query("importProjects")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique()

    if (!project) {
      return { deleted: false }
    }

    // Delete artifacts
    const artifacts = await ctx.db
      .query("importArtifacts")
      .withIndex("by_project", (q) => q.eq("projectId", project._id))
      .collect()

    for (const artifact of artifacts) {
      await ctx.db.delete(artifact._id)
    }

    // Delete project
    await ctx.db.delete(project._id)

    return { deleted: true, artifactsDeleted: artifacts.length }
  },
})
