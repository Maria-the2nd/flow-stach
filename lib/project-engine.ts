import { extractCleanHtml, extractJsHooks } from "./html-parser"
import { extractTokens } from "./token-extractor"
import { parseCSS } from "./css-parser"
import { componentizeHtml } from "./componentizer"
import { buildCssTokenPayload, buildComponentPayload } from "./webflow-converter"
import { normalizeHtmlCssForWebflow } from "./webflow-normalizer"
import { literalizeCssForWebflow } from "./webflow-literalizer"
import { extractImages, type ImageAsset } from "./image-extractor"
import { applyDeterministicComponentNames } from "./flowbridge-semantic"
import { applySemanticPatchResponse, buildSemanticPatchRequest, type FlowbridgeSemanticPatchMeta } from "./flowbridge-semantic"
import { ensureWebflowPasteSafety } from "./webflow-safety-gate"
import { renameClassesForProject, isBemRenamingEnabled, type ClassRenamingReport, type LlmClassContext } from "./bem-renamer"
import { detectFontsFromCSS, buildFontChecklist } from "./font-detector"
import { detectLibraries } from "./js-library-detector"

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
    /** Report from BEM class renaming stage */
    classRenamingReport?: ClassRenamingReport;
}

export type DetectedFont = {
    name: string;
    source: string;
    url?: string;
    weights?: number[];  // [400, 500, 700] for Webflow installation
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

        // 3b. BEM CLASS RENAMING
        let workingCss = normalization.css;
        let workingJs = cleanResult.extractedScripts;
        let classRenamingReport: ClassRenamingReport | undefined;
        let llmClassContext: LlmClassContext | undefined;

        // Get established classes (design tokens) for preservation
        const preTokenPayload = buildCssTokenPayload(normalization.css, { namespace: tokens.namespace, includePreview: false });
        const establishedClassesArray = Array.isArray(preTokenPayload.establishedClasses)
            ? preTokenPayload.establishedClasses
            : Array.from(preTokenPayload.establishedClasses);

        if (isBemRenamingEnabled()) {
            // Deterministic check for LLM usage (needed early to decide if we want LLM refinement)
            const preLiteralCheck = literalizeCssForWebflow(normalization.css);
            const hasGenericNamesCheck = componentsTree.components.some(c =>
                /^(section|block|article|main content|sidebar|navigation|header|footer)\s*\d*$/i.test(c.name.trim())
            );
            const forceLlmCheck = process.env.NEXT_PUBLIC_FLOWBRIDGE_FORCE_LLM === "1";
            const willInvokeLlm = forceLlmCheck || preLiteralCheck.remainingVarCount > 0 || hasGenericNamesCheck;

            const renameResult = renameClassesForProject({
                componentsTree,
                css: normalization.css,
                js: cleanResult.extractedScripts,
                establishedClasses: establishedClassesArray,
                options: {
                    projectSlug: tokens.slug,
                    enableLlmRefinement: willInvokeLlm,
                    preserveClasses: [],
                    updateJSReferences: true,
                },
            });

            // Update working variables with renamed content
            componentsTree = renameResult.updatedComponents;
            workingCss = renameResult.updatedCss;
            workingJs = renameResult.updatedJs;
            classRenamingReport = renameResult.report;
            llmClassContext = renameResult.llmContext;

            console.log(`[project-engine] BEM class renaming: ${renameResult.report.summary.renamed} classes renamed, ${renameResult.report.summary.highRiskNeutralized} high-risk neutralized`);
        }

        // 4. SEMANTIC PATCHING (AI)
        reportProgress("semantic", 70);
        let finalCss = workingCss;
        let llmMeta: FlowbridgeSemanticPatchMeta | null = null;
        const patchCounts = { renamedComponents: 0, htmlMutations: 0, cssMutations: 0 };

        // Re-parse CSS with renamed classes
        const renamedCssResult = parseCSS(workingCss);

        const semanticContext = buildSemanticPatchRequest(
            componentsTree.components.map(c => c.htmlContent).join(""),
            componentsTree,
            renamedCssResult.classIndex,
            renamedCssResult.cssVariables
        );

        // Attach class rename context for LLM
        if (llmClassContext) {
            semanticContext.request.classRenameContext = {
                proposedMapping: llmClassContext.proposedMapping,
                highRiskDetected: llmClassContext.highRiskDetected,
                ambiguousNames: llmClassContext.ambiguousNames,
            };
        }

        // Deterministic check for LLM usage
        const preLiteral = literalizeCssForWebflow(workingCss);
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

        // DEBUG: Check if :nth-child rules are present before literalization
        const hasNthChildBefore = finalCss.includes(':nth-child');
        console.log(`[project-engine] :nth-child in finalCss BEFORE literalize: ${hasNthChildBefore}`);
        if (hasNthChildBefore) {
            const nthChildRules = finalCss.match(/\.[^{]+:nth-child\([^)]+\)\s*\{[^}]+\}/g);
            console.log(`[project-engine] Found :nth-child rules:`, nthChildRules?.slice(0, 3));
        }

        const literalization = literalizeCssForWebflow(finalCss);

        // DEBUG: Check if :nth-child rules survived literalization
        const hasNthChildAfter = literalization.css.includes(':nth-child');
        console.log(`[project-engine] :nth-child in literalization.css AFTER literalize: ${hasNthChildAfter}`);
        if (hasNthChildAfter) {
            const nthChildRulesAfter = literalization.css.match(/\.[^{]+:nth-child\([^)]+\)\s*\{[^}]+\}/g);
            console.log(`[project-engine] :nth-child rules after literalize:`, nthChildRulesAfter?.slice(0, 3));
        }

        const finalCssResult = parseCSS(literalization.css);
        const tokenPayloadResult = buildCssTokenPayload(literalization.css, { namespace: tokens.namespace, includePreview: true });
        const tokenSafety = ensureWebflowPasteSafety({ payload: tokenPayloadResult.webflowPayload });
        const tokenWebflowJson = tokenSafety.blocked
            ? JSON.stringify({ placeholder: true })
            : tokenSafety.webflowJson;

        const images = extractImages(normalization.html, literalization.css);

        // Use font detector for proper weight detection
        const detectedFonts = detectFontsFromCSS(literalization.css);
        const fontChecklist = buildFontChecklist(detectedFonts);

        const mappedFonts = detectedFonts.map((font, idx) => {
            const checklist = fontChecklist[idx];
            return {
                name: font.family,
                source: font.source === 'google' ? 'Google Fonts' :
                        font.source === 'adobe' ? 'Adobe Fonts' :
                        font.source === 'system' ? 'System' : 'Custom',
                url: font.url,
                weights: font.weights.length > 0 ? font.weights : undefined,
                status: checklist.status === 'available' ? 'available' : 'missing',
                warning: checklist.warning || false,
                installationGuide: checklist.installationGuide,
            };
        });

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

        // Detect libraries from inline JavaScript and merge with external scripts
        const detectedLibraries = detectLibraries(workingJs);
        if (detectedLibraries.names.length > 0) {
            console.log(`[project-engine] Detected libraries from inline JS: ${detectedLibraries.displayNames.join(', ')}`);
        }

        // Combine: external scripts from HTML + detected library CDNs + external stylesheets
        const allExternalScripts = Array.from(new Set([
            ...cleanResult.externalScripts,
            ...detectedLibraries.scripts,  // CDN URLs for detected libraries (e.g., Three.js, GSAP)
            ...detectedLibraries.styles,   // CSS CDN URLs for libraries that need them
            ...cleanResult.externalStylesheets,
        ]));

        return {
            projectName: tokens.name,
            projectSlug: tokens.slug,
            artifacts: {
                tokensJson,
                tokensCss: finalCssResult.tokensCss,
                stylesCss: literalization.css,
                classIndex: JSON.stringify(finalCssResult.classIndex),
                cleanHtml: componentsTree.components.map(c => c.htmlContent).join(""),
                scriptsJs: workingJs,
                externalScripts: allExternalScripts,
                jsHooks: extractJsHooks(componentsTree.components.map(c => c.htmlContent).join(""))
            },
            components: finalComponents,
            tokenWebflowJson,
            fonts: mappedFonts,
            images,
            llmSummary: llmMeta ? {
                mode: llmMeta.mode,
                model: llmMeta.model,
                ...patchCounts
            } : undefined,
            classRenamingReport,
        };

    } catch (error) {
        console.error(`Engine failed at stage ${currentStage}:`, error);
        throw error;
    }
}
