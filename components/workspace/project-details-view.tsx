"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from 'next/link';
import { useMemo } from "react";
import { DesignTokensCard } from "@/components/project/design-tokens-card";
import { FontChecklistCard } from "@/components/project/font-checklist-card";
import { ComponentsList } from "@/components/project/components-list";
import { ImagesGrid } from "@/components/project/images-grid";
import { StyleGuideView } from "@/components/project/style-guide/style-guide-view";
import { toast } from "sonner";
import { copyWebflowJson } from "@/lib/clipboard";
import { regenerateAllIds } from "@/lib/webflow-sanitizer";
import { extractEnhancedTokens, type EnhancedTokenExtraction } from "@/lib/token-extractor";
import { generateStyleGuidePayload } from "@/lib/webflow-style-guide-generator";
import type { WebflowPayload } from "@/lib/webflow-converter";
import { ensureWebflowPasteSafety } from "@/lib/webflow-safety-gate";
import { SafetyReportPanel } from "@/components/validation/SafetyReportPanel";

type ImportProject = Doc<"importProjects">;
type ImportArtifact = Doc<"importArtifacts">;
type AssetPayload = Doc<"payloads"> | null;
type ComponentEntry = { component: Doc<"assets">; payload: AssetPayload };
type TokenValue = { name: string; value: string };
type DesignTokens = {
    colors: TokenValue[];
    typography: TokenValue[];
    spacing?: TokenValue[];
};

export function ProjectDetailsView({ id }: { id: string }) {
    // Fetch project data from Convex
    const projectData = useQuery(
        api.projects.getProjectById,
        { projectId: id as Id<"importProjects"> }
    );

    // Loading state
    if (projectData === undefined) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    // Project not found
    if (projectData === null) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-4">
                    <p className="text-slate-500">Project not found</p>
                    <Link href="/workspace/projects">
                        <Button variant="outline">Back to Projects</Button>
                    </Link>
                </div>
            </div>
        );
    }

    const { project, artifacts, components } = projectData;
    return <ProjectContent project={project} components={components} artifacts={artifacts} />;
}

function StyleGuideTab({ cssArtifact, project }: { cssArtifact?: ImportArtifact; project: ImportProject }) {
    // Extract enhanced tokens from CSS
    const enhancedTokens: EnhancedTokenExtraction | null = (() => {
        if (!cssArtifact?.content) return null;

        try {
            return extractEnhancedTokens(
                cssArtifact.content,
                undefined, // no HTML needed for token extraction
                project.name || "Design System"
            );
        } catch (error) {
            console.error("Failed to extract enhanced tokens:", error);
            return null;
        }
    })();

    const handleCopyStyleGuidePayload = async () => {
        if (!enhancedTokens) {
            toast.error("No Style Guide (Design Tokens) data available");
            return;
        }

        try {
            const payload = generateStyleGuidePayload(enhancedTokens, {
                namespace: enhancedTokens.namespace,
                includeTitle: true,
            });

            await copyWebflowJson(JSON.stringify(payload));
            toast.success("Style Guide (Design Tokens) copied to clipboard!", {
                description: "Paste into Webflow to create your Style Guide (Design Tokens) page",
            });
        } catch (error) {
            toast.error("Failed to generate Style Guide (Design Tokens)");
            console.error(error);
        }
    };

    if (!enhancedTokens) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500 font-medium">
                    No Style Guide (Design Tokens) data found in this project
                </p>
            </div>
        );
    }

    return <StyleGuideView tokens={enhancedTokens} onCopyWebflowPayload={handleCopyStyleGuidePayload} />;
}

function ProjectContent({
    project,
    components,
    artifacts,
}: {
    project: ImportProject;
    components: ComponentEntry[];
    artifacts: ImportArtifact[];
}) {
    // Extract all relevant artifacts
    const cssArtifact = artifacts.find((a) => a.type === "styles_css");
    const jsArtifact = artifacts.find((a) => a.type === "scripts_js");
    const tokensJsonArtifact = artifacts.find((a) => a.type === "tokens_json");
    const tokensCssArtifact = artifacts.find((a) => a.type === "tokens_css");
    const tokenWebflowJsonArtifact = artifacts.find((a) => a.type === "token_webflow_json");
    const jsHooksArtifact = artifacts.find((a) => a.type === "js_hooks");
    const externalScriptsArtifact = artifacts.find((a) => a.type === "external_scripts");

    // Bug 4 Fix: Parse external libraries/dependencies
    const externalLibraries: Array<{ url: string; name: string; type: 'script' | 'style' }> = [];
    if (externalScriptsArtifact?.content) {
        try {
            const urls = JSON.parse(externalScriptsArtifact.content) as unknown;
            if (Array.isArray(urls)) {
                urls.forEach((url) => {
                    if (typeof url !== "string") return;
                    // Detect library name from URL
                    const urlLower = url.toLowerCase();
                    let name = 'External Library';
                    if (urlLower.includes('gsap')) name = 'GSAP';
                    else if (urlLower.includes('scrolltrigger')) name = 'ScrollTrigger';
                    else if (urlLower.includes('lenis')) name = 'Lenis Smooth Scroll';
                    else if (urlLower.includes('swiper')) name = 'Swiper';
                    else if (urlLower.includes('locomotive')) name = 'Locomotive Scroll';
                    else if (urlLower.includes('splitting')) name = 'Splitting.js';
                    else if (urlLower.includes('typed')) name = 'Typed.js';
                    else if (urlLower.includes('anime')) name = 'Anime.js';
                    else if (urlLower.includes('three')) name = 'Three.js';
                    else if (urlLower.includes('barba')) name = 'Barba.js';
                    else if (urlLower.includes('jquery')) name = 'jQuery';
                    else if (urlLower.includes('finsweet')) name = 'Finsweet Attributes';
                    else {
                        // Extract name from URL path
                        const match = url.match(/\/([^\/]+)\.(min\.)?js$/i);
                        if (match) name = match[1];
                    }
                    const type = url.endsWith('.css') ? 'style' : 'script';
                    externalLibraries.push({ url, name, type });
                });
            }
        } catch (e) {
            console.error("Failed to parse external_scripts:", e);
        }
    }

    // Bug 3 Fix: Build comprehensive embeds array with all extracted content
    const embeds: Array<{ type: string; label: string; content: string; description: string }> = [];

    // CSS Tokens (variables)
    if (tokensCssArtifact?.content) {
        embeds.push({
            type: 'CSS',
            label: 'CSS Variables',
            content: `<style>\n${tokensCssArtifact.content}\n</style>`,
            description: 'Style Guide (Design Tokens) CSS variables. Add to page <head> or embed element.'
        });
    }

    // Full CSS Styles
    if (cssArtifact?.content) {
        embeds.push({
            type: 'CSS',
            label: 'Styles',
            content: `<style>\n${cssArtifact.content}\n</style>`,
            description: 'Component styles. Add to page <head> or embed element.'
        });
    }

    // JavaScript
    if (jsArtifact?.content) {
        embeds.push({
            type: 'JavaScript',
            label: 'Scripts',
            content: `<script>\n${jsArtifact.content}\n</script>`,
            description: 'Component scripts. Add to page footer before </body>.'
        });
    }

    // JS Hooks (event handlers, interactions)
    if (jsHooksArtifact?.content) {
        try {
            const hooks = JSON.parse(jsHooksArtifact.content) as unknown;
            if (Array.isArray(hooks) && hooks.length > 0 && hooks.every((hook) => typeof hook === "string")) {
                embeds.push({
                    type: 'JavaScript',
                    label: 'Event Hooks',
                    content: `<script>\n// Event Handlers & Interactions\n${hooks.join('\n\n')}\n</script>`,
                    description: 'Interactive behaviors. Add after main scripts.'
                });
            }
        } catch (e) {
            console.error("Failed to parse js_hooks:", e);
        }
    }

    // Bug 1 Fix: Resolve design tokens from project OR artifact fallback
    const resolvedTokens: DesignTokens | null = (() => {
        // First, try project.designTokens
        if (project.designTokens &&
            (project.designTokens.colors?.length > 0 || project.designTokens.typography?.length > 0)) {
            return project.designTokens as DesignTokens;
        }
        // Fallback: parse from tokens_json artifact
        if (tokensJsonArtifact?.content) {
            try {
                const parsed = JSON.parse(tokensJsonArtifact.content) as Partial<DesignTokens>;
                if (parsed.colors?.length || parsed.typography?.length) {
                    return {
                        colors: parsed.colors || [],
                        typography: parsed.typography || [],
                        spacing: parsed.spacing || [],
                    };
                }
            } catch (e) {
                console.error("Failed to parse tokens_json artifact:", e);
            }
        }
        return null;
    })();

    const siteStructurePayload = useMemo<WebflowPayload | null>(() => {
        try {
            const allNodes: WebflowPayload["payload"]["nodes"] = [];
            const allStyles: WebflowPayload["payload"]["styles"] = [];
            const seenStyleNames = new Set<string>();
            const tokenStyleNames = new Set<string>();

            if (tokenWebflowJsonArtifact?.content) {
                try {
                    const tokenPayload = JSON.parse(tokenWebflowJsonArtifact.content) as {
                        payload?: { styles?: Array<{ name?: string; _id?: string }> };
                    };
                    if (Array.isArray(tokenPayload.payload?.styles)) {
                        tokenPayload.payload.styles.forEach((style) => {
                            const styleName = style?.name || style?._id;
                            if (styleName) tokenStyleNames.add(styleName);
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse token_webflow_json artifact:", e);
                }
            }

            components.forEach(({ payload }) => {
                if (payload?.webflowJson) {
                    try {
                        const parsed = JSON.parse(payload.webflowJson) as { placeholder?: boolean };
                        if (parsed.placeholder) {
                            return;
                        }
                        const regenerated = regenerateAllIds(parsed);

                        if (regenerated.payload?.nodes) {
                            allNodes.push(...regenerated.payload.nodes);
                        }

                        if (Array.isArray(regenerated.payload?.styles)) {
                            regenerated.payload.styles.forEach((style) => {
                                const styleName = style?.name || style?._id;
                                if (!styleName) return;
                                if (tokenStyleNames.has(styleName)) return;
                                if (seenStyleNames.has(styleName)) return;
                                seenStyleNames.add(styleName);
                                allStyles.push(style);
                            });
                        }
                    } catch (e) {
                        console.error("Failed to parse component payload:", e);
                    }
                }
            });

            if (allNodes.length === 0) {
                return null;
            }

            const payload: WebflowPayload = {
                type: "@webflow/XscpData",
                payload: {
                    nodes: allNodes,
                    styles: allStyles,
                    assets: [],
                    ix1: [],
                    ix2: { interactions: [], events: [], actionLists: [] },
                },
                meta: {
                    unlinkedSymbolCount: 0,
                    droppedLinks: 0,
                    dynBindRemovedCount: 0,
                    dynListBindRemovedCount: 0,
                    paginationRemovedCount: 0,
                    hasEmbedCSS: false,
                    hasEmbedJS: false,
                    embedCSSSize: 0,
                    embedJSSize: 0,
                },
            };
            return payload;
        } catch (error) {
            console.error("Failed to build site structure payload:", error);
            return null;
        }
    }, [components, tokenWebflowJsonArtifact?.content]);

    const siteSafetyReport = useMemo(() => {
        if (!siteStructurePayload) return null;
        try {
            return ensureWebflowPasteSafety({ payload: siteStructurePayload }).report;
        } catch {
            return null;
        }
    }, [siteStructurePayload]);

    const handleCopySiteStructure = async () => {
        try {
            if (!siteStructurePayload) {
                toast.error("No extracted components available to copy");
                return;
            }
            await copyWebflowJson(JSON.stringify(siteStructurePayload));
        } catch (error) {
            toast.error("Failed to copy site structure");
            console.error(error);
        }
    };

    const tabItems = [
        { label: "Overview", value: "overview" },
        { label: "Style Guide (Design Tokens)", value: "styleguide" },
        { label: "Site", value: "site" },
        { label: "Images", value: "images" },
        { label: "Embeds", value: "embeds" },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-6 mb-8">
                <Link href="/workspace/projects">
                    <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{project.name}</h1>
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-500 mt-1">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                            {project.componentCount || 0} Extracted Components
                        </span>
                        {project.hasTokens && (
                            <>
                                <span>•</span>
                                <span className="bg-blue-100 px-2 py-0.5 rounded text-[10px] text-blue-700 font-bold uppercase tracking-wider">
                                    Style Guide Ready
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div className="ml-auto flex gap-3">
                    <Button
                        onClick={handleCopySiteStructure}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200/50 font-bold px-8 h-11 rounded-xl transition-all"
                        disabled={!siteStructurePayload}
                    >
                        Copy Site Structure (Base Styles)
                    </Button>
                </div>
            </div>
            {siteSafetyReport && (
                <div className="mb-6">
                    <SafetyReportPanel report={siteSafetyReport} />
                </div>
            )}

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full justify-start p-1 bg-slate-100/80 backdrop-blur rounded-[20px] h-auto inline-flex gap-1 mb-10 shadow-inner">
                    {tabItems.map(tab => (
                        <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="rounded-[14px] data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md px-8 py-2.5 text-slate-500 hover:text-slate-900 transition-all font-bold text-sm"
                        >
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <TabsContent value="overview" className="space-y-6">
                        <DesignTokensCard tokens={resolvedTokens} />
                        <FontChecklistCard fonts={project.fonts} />
                    </TabsContent>

                    <TabsContent value="styleguide" className="space-y-6">
                        <StyleGuideTab 
                            cssArtifact={cssArtifact}
                            project={project}
                        />
                    </TabsContent>

                    <TabsContent value="site" className="space-y-10">
                        {/* Section 1: Style Guide (Design Tokens) */}
                        {resolvedTokens && (
                            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-slate-200 p-8 shadow-xl shadow-slate-200/50">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-2xl font-bold text-slate-900">1. Style Guide (Design Tokens)</h3>
                                            <Badge className="bg-blue-100 text-blue-700 border-none font-bold text-[10px] uppercase">Paste First</Badge>
                                        </div>
                                        <p className="text-slate-500 font-medium max-w-xl">
                                            CSS variables and styles as a hidden DIV. Paste this FIRST into your Webflow page body, then delete the DIV element.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={async () => {
                                            try {
                                                const cssVars: string[] = [];
                                                resolvedTokens.colors?.forEach((c) => cssVars.push(`--${c.name}: ${c.value}`));
                                                resolvedTokens.typography?.forEach((t) => cssVars.push(`--${t.name}: ${t.value}`));
                                                resolvedTokens.spacing?.forEach((s) => cssVars.push(`--${s.name}: ${s.value}`));
                                                const hiddenDiv = `<div style="${cssVars.join('; ')}; display: none;" data-flow-tokens="true"></div>`;
                                                await navigator.clipboard.writeText(hiddenDiv);
                                                toast.success("Style Guide (Design Tokens) copied!", { description: "Paste into Webflow body, then delete the DIV." });
                                            } catch {
                                                toast.error("Failed to copy Style Guide (Design Tokens)");
                                            }
                                        }}
                                        className="bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200/50 font-bold px-10 h-14 rounded-2xl transition-all text-lg shrink-0"
                                    >
                                        Copy Style Guide (Design Tokens)
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Section 2: Site Structure Payload */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-slate-200 p-8 shadow-xl shadow-slate-200/50">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-bold text-slate-900">2. Site Structure Payload</h3>
                                        <Badge className="bg-green-100 text-green-700 border-none font-bold text-[10px] uppercase">Structure + Base Styles</Badge>
                                    </div>
                                    <p className="text-slate-500 font-medium max-w-xl">
                                        Copy the full site layout structure with base layout styles only.
                                        Styles covered by the Style Guide (Design Tokens) or Embeds are excluded.
                                        Best for rebuilding the page structure in Webflow.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleCopySiteStructure}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200/50 font-bold px-10 h-14 rounded-2xl transition-all text-lg shrink-0"
                                    disabled={components.length === 0}
                                >
                                    Copy Site Structure (Base Styles)
                                </Button>
                            </div>
                        </div>

                        {/* Section 3: Extracted Components */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 px-2">
                                <h3 className="text-xl font-bold text-slate-900">3. Extracted Components</h3>
                                <Badge className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] uppercase">{components.length} items</Badge>
                            </div>
                            <ComponentsList components={components} />
                        </div>
                    </TabsContent>

                    <TabsContent value="images">
                        <ImagesGrid images={project.images} />
                    </TabsContent>

                    <TabsContent value="embeds" className="space-y-8">
                        {/* Bug 4 Fix: Libraries Section */}
                        {externalLibraries.length > 0 && (
                            <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 space-y-6">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-2xl font-bold text-slate-900">External Libraries</h3>
                                        <Badge className="bg-orange-100 text-orange-700 border-none font-bold text-[10px] uppercase">
                                            {externalLibraries.length} {externalLibraries.length === 1 ? 'library' : 'libraries'}
                                        </Badge>
                                    </div>
                                    <p className="text-slate-500 font-medium">
                                        These external CDN resources must be added to your Webflow project&apos;s custom code settings.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {externalLibraries.map((lib, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Badge className={lib.type === 'script' ? "bg-yellow-50 text-yellow-700 border-none font-bold text-[10px] uppercase" : "bg-purple-50 text-purple-600 border-none font-bold text-[10px] uppercase"}>
                                                    {lib.type === 'script' ? 'JS' : 'CSS'}
                                                </Badge>
                                                <div>
                                                    <p className="font-bold text-slate-700 text-sm">{lib.name}</p>
                                                    <p className="text-xs text-slate-400 font-mono truncate max-w-md">{lib.url}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-600 font-bold hover:bg-blue-50"
                                                onClick={() => {
                                                    const tag = lib.type === 'script'
                                                        ? `<script src="${lib.url}"></script>`
                                                        : `<link rel="stylesheet" href="${lib.url}">`;
                                                    navigator.clipboard.writeText(tag);
                                                    toast.success(`${lib.name} tag copied!`);
                                                }}
                                            >
                                                Copy Tag
                                            </Button>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                                    <p className="text-sm text-amber-800 font-medium">
                                        <strong>How to add:</strong> Go to Project Settings → Custom Code → Head Code (for CSS) or Footer Code (for JS).
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Custom Embeds Section */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-[32px] border border-slate-200 p-8 shadow-xl shadow-slate-200/50 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-slate-900">Custom Embeds</h3>
                                <p className="text-slate-500 font-medium">
                                    These custom code fragments (JS/CSS) must be pasted into Webflow Embed elements because they aren&apos;t supported natively.
                                </p>
                            </div>

                            <div className="space-y-4">
                                {embeds.length > 0 ? (
                                    embeds.map((embed, idx) => (
                                        <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge className={embed.type === 'CSS' ? "bg-purple-50 text-purple-600 border-none font-bold uppercase text-[10px]" : "bg-yellow-50 text-yellow-700 border-none font-bold uppercase text-[10px]"}>
                                                        {embed.type}
                                                    </Badge>
                                                    <span className="text-sm font-bold text-slate-700">{embed.label}</span>
                                                </div>
                                                <Button variant="ghost" size="sm" className="text-blue-600 font-bold hover:bg-white" onClick={() => {
                                                    navigator.clipboard.writeText(embed.content);
                                                    toast.success(`${embed.label} copied!`);
                                                }}>Copy Code</Button>
                                            </div>
                                            <p className="text-xs text-slate-500">{embed.description}</p>
                                            <pre className="text-xs font-mono bg-white p-4 rounded-xl border border-slate-100 overflow-x-auto text-slate-600 max-h-64 overflow-y-auto">
                                                {embed.content.length > 1000 ? `${embed.content.substring(0, 1000)}...` : embed.content}
                                            </pre>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 text-slate-400 font-medium italic">
                                        No special embeds needed for this project.
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
