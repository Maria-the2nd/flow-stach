import { extractCleanHtml, extractJsHooks, extractCssForSection, getClassesUsed } from "./html-parser"
import { extractTokens, type TokenExtraction } from "./token-extractor"
import { parseCSS, type ClassIndex } from "./css-parser"
import { componentizeHtml, type ComponentTree, type Component } from "./componentizer"
import { buildCssTokenPayload, buildComponentPayload } from "./webflow-converter"
import { normalizeHtmlCssForWebflow } from "./webflow-normalizer"
import { literalizeCssForWebflow } from "./webflow-literalizer"
import { diagnoseVisibilityIssues } from "./webflow-verifier"
import { extractImages, type ImageAsset } from "./image-extractor"
import { applyDeterministicComponentNames } from "./flowbridge-semantic"
import { applySemanticPatchResponse, buildSemanticPatchRequest, type FlowbridgeSemanticPatchResponse, type FlowbridgeSemanticPatchMeta } from "./flowbridge-semantic"
import { ensureWebflowPasteSafety } from "./webflow-safety-gate"

export type ProcessingStage = "parsing" | "extracting" | "componentizing" | "semantic" | "generating" | "complete" | "idle"

export interface EngineResult {
    projectName: string;
    projectSlug: string;
    artifacts: {
        tokensJson: string;
        tokensCss: string;
        stylesCss: string;
        classIndex: string;
        cleanHtml: string;
        scriptsJs: string;
        externalScripts: string[];
        jsHooks: string[];
    };
    components: Array<{
        id: string;
        name: string;
        slug: string;
        category: string;
        tags: string[];
        htmlContent: string;
        classesUsed: string[];
        jsHooks: string[];
        webflowJson: string;
        codePayload: string;
    }>;
    tokenWebflowJson: string;
    fonts: DetectedFont[];
    images: ImageAsset[];
    llmSummary?: LlmSummary;
}

export type DetectedFont = {
    name: string;
    source: string;
    url?: string;
    status: string;
    warning?: boolean;
    installationGuide: string;
};

export type LlmSummary = {
    mode: FlowbridgeSemanticPatchMeta["mode"];
    model?: string;
    renamedComponents: number;
    htmlMutations: number;
    cssMutations: number;
};

/**
 * The core engine for processing HTML/CSS into Webflow-ready project artifacts.
 * This is the same logic used in the Admin Import Wizard but decoupled from the UI.
 */
export async function processProjectImport(
    htmlInput: string,
    projectName: string,
    onProgress: (stage: ProcessingStage, progress: number) => void
): Promise<EngineResult> {
    let currentStage: ProcessingStage = "idle";
    const reportProgress = (stage: ProcessingStage, progress: number) => {
        currentStage = stage;
        onProgress(stage, progress);
    };

    try {
        // 1. PARSING
        reportProgress("parsing", 10);
        const cleanResult = extractCleanHtml(htmlInput);
        const normalization = normalizeHtmlCssForWebflow(cleanResult.cleanHtml, cleanResult.extractedStyles);
        const cssResult = parseCSS(normalization.css);

        // 2. EXTRACTING TOKENS
        reportProgress("extracting", 30);
        const name = projectName || "Imported Project";
        const tokens = extractTokens(normalization.css, htmlInput, name);

        const externalScriptComments = cleanResult.externalScripts.length > 0
            ? cleanResult.externalScripts.map(url => `// External Library: ${url}`).join('\n') + '\n\n'
            : '';
        const fullScriptsJs = externalScriptComments + cleanResult.extractedScripts;

        const tokensJson = JSON.stringify({
            name: tokens.name,
            namespace: tokens.namespace,
            variables: tokens.variables,
            fonts: tokens.fonts
        }, null, 2);

        // 3. COMPONENTIZING
        reportProgress("componentizing", 50);
        let componentsTree = componentizeHtml(normalization.html);
        const namingResult = applyDeterministicComponentNames(componentsTree);
        componentsTree = namingResult.componentTree;

        // 4. SEMANTIC PATCHING (AI)
        reportProgress("semantic", 70);
        let finalCss = normalization.css;
        let llmMeta: FlowbridgeSemanticPatchMeta | null = null;
        const patchCounts = { renamedComponents: 0, htmlMutations: 0, cssMutations: 0 };

        const semanticContext = buildSemanticPatchRequest(
            normalization.html,
            componentsTree,
            cssResult.classIndex,
            cssResult.cssVariables
        );

        // Deterministic check for LLM usage
        const preLiteral = literalizeCssForWebflow(normalization.css);
        const hasGenericNames = componentsTree.components.some(c =>
            /^(section|block|article|main content|sidebar|navigation|header|footer)\s*\d*$/i.test(c.name.trim())
        );
        const forceLlm = process.env.NEXT_PUBLIC_FLOWBRIDGE_FORCE_LLM === "1";
        const shouldInvokeLlm = forceLlm || preLiteral.remainingVarCount > 0 || semanticContext.warnings.length > 0 || hasGenericNames;

        if (shouldInvokeLlm) {
            try {
                const llmResponse = await fetch("/api/flowbridge/semantic", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        request: semanticContext.request,
                        model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL,
                    }),
                });

                if (llmResponse.ok) {
                    const data = await llmResponse.json();
                    if (data.ok && data.response) {
                        const applyResult = applySemanticPatchResponse({
                            componentTree: componentsTree,
                            patch: data.response,
                        });

                        if (applyResult.patchedHtml.trim() && !applyResult.componentTree.components.some(c => !c.htmlContent.trim())) {
                            componentsTree = applyResult.componentTree;
                            finalCss = data.response.cssPatches[data.response.cssPatches.length - 1]?.op === "replaceFinalCss"
                                ? data.response.cssPatches[data.response.cssPatches.length - 1].css
                                : finalCss;
                            patchCounts.renamedComponents = applyResult.applied.renames;
                            patchCounts.htmlMutations = applyResult.applied.htmlPatches;
                            patchCounts.cssMutations = data.response.cssPatches.length;
                            llmMeta = data.meta;
                        }
                    }
                }
            } catch (e) {
                console.warn("LLM Engine failed, falling back to deterministic", e);
            }
        }

        // 5. GENERATING FINAL ARTIFACTS
        reportProgress("generating", 90);
        const literalization = literalizeCssForWebflow(finalCss);
        const finalCssResult = parseCSS(literalization.css);
        const tokenPayloadResult = buildCssTokenPayload(literalization.css, { namespace: tokens.namespace, includePreview: true });
        const tokenSafety = ensureWebflowPasteSafety({ payload: tokenPayloadResult.webflowPayload });
        const tokenWebflowJson = tokenSafety.blocked
            ? JSON.stringify({ placeholder: true })
            : tokenSafety.webflowJson;

        const images = extractImages(normalization.html, literalization.css);
        const googleFontsUrl = tokens?.fonts?.googleFonts || "";
        const mappedFonts = (tokens?.fonts?.families || []).map(f => ({
            name: f,
            source: "Google Fonts",
            url: googleFontsUrl,
            status: "pending",
            warning: false,
            installationGuide: `Go to Site Settings -> Fonts and add ${f}`
        }));

        const finalComponents = componentsTree.components.map(c => {
            const payload = buildComponentPayload(c, finalCssResult.classIndex, tokenPayloadResult.establishedClasses, {
                skipEstablishedStyles: false
            });
            const safety = ensureWebflowPasteSafety({ payload: payload.webflowPayload });
            return {
                id: c.id,
                name: c.name,
                slug: `${tokens.slug}-${c.id}`,
                category: c.type || "section",
                tags: [tokens.slug, c.type],
                htmlContent: c.htmlContent,
                classesUsed: c.classesUsed,
                jsHooks: c.jsHooks,
                webflowJson: safety.blocked ? JSON.stringify({ placeholder: true }) : safety.webflowJson,
                codePayload: c.htmlContent
            };
        });

        reportProgress("complete", 100);

        return {
            projectName: tokens.name,
            projectSlug: tokens.slug,
            artifacts: {
                tokensJson,
                tokensCss: finalCssResult.tokensCss,
                stylesCss: literalization.css,
                classIndex: JSON.stringify(finalCssResult.classIndex),
                cleanHtml: normalization.html,
                scriptsJs: cleanResult.extractedScripts,
                externalScripts: cleanResult.externalScripts,
                jsHooks: extractJsHooks(normalization.html)
            },
            components: finalComponents,
            tokenWebflowJson,
            fonts: mappedFonts,
            images,
            llmSummary: llmMeta ? {
                mode: llmMeta.mode,
                model: llmMeta.model,
                ...patchCounts
            } : undefined
        };

    } catch (error) {
        console.error(`Engine failed at stage ${currentStage}:`, error);
        throw error;
    }
}
