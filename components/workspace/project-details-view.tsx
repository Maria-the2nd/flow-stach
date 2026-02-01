"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Id } from "@/convex/_generated/dataModel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Image as ImageIcon, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagesGrid } from "@/components/project/images-grid";
import { toast } from "sonner";
import { copyText, copyWebflowJson } from "@/lib/clipboard";
import * as sanitizer from "@/lib/webflow-sanitizer";
import type { WebflowPayload } from "@/lib/webflow-converter";
import { ensureWebflowPasteSafety } from "@/lib/webflow-safety-gate";
import type { ClassRenamingReport } from "@/lib/validation-types";
import { routeCSS, wrapEmbedCSSInStyleTag } from "@/lib/css-embed-router";

type ImportProject = Doc<"importProjects"> & { thumbnailUrl?: string | null };
type ImportArtifact = Doc<"importArtifacts">;
type AssetPayload = Doc<"payloads"> | null;
type ComponentEntry = { component: Doc<"assets">; payload: AssetPayload };
type FontChecklistStatus = "available" | "missing" | "unknown";
type FontChecklistEntry = {
    name: string;
    weights?: number[];
    source: string;
    installationGuide: string;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

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
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Project not found
    if (projectData === null) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center space-y-4">
                    <p className="text-muted-foreground">Project not found</p>
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

function ProjectContent({
    project,
    components,
    artifacts,
}: {
    project: ImportProject;
    components: ComponentEntry[];
    artifacts: ImportArtifact[];
}) {
    const [expandedEmbeds, setExpandedEmbeds] = useState<Record<number, boolean>>({});
    const [copiedEmbed, setCopiedEmbed] = useState<number | null>(null);
    const [isAttemptingFix, setIsAttemptingFix] = useState(false);
    const [fixedPayload, setFixedPayload] = useState<WebflowPayload | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const generateUploadUrl = useMutation(api.projects.generateThumbnailUploadUrl);
    const updateThumbnail = useMutation(api.projects.updateThumbnail);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Global paste handler
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        await handleUpload(file);
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, []);

    const handleUpload = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file");
            return;
        }

        if (file.size > MAX_FILE_SIZE) {
            toast.error("Image too large", {
                description: "Please select an image smaller than 2MB"
            });
            return;
        }

        setIsUploading(true);
        const loadingToast = toast.loading("Uploading thumbnail...");

        try {
            const uploadUrl = await generateUploadUrl();
            const response = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });

            if (!response.ok) throw new Error("Upload failed");

            const { storageId } = await response.json();
            await updateThumbnail({
                projectId: project._id,
                storageId,
            });

            toast.success("Thumbnail updated!", { id: loadingToast });
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to upload thumbnail", { id: loadingToast });
        } finally {
            setIsUploading(false);
        }
    };

    // Extract all relevant artifacts
    const cssArtifact = artifacts.find((a) => a.type === "styles_css");
    const jsArtifact = artifacts.find((a) => a.type === "scripts_js");
    const tokenWebflowJsonArtifact = artifacts.find((a) => a.type === "token_webflow_json");
    const jsHooksArtifact = artifacts.find((a) => a.type === "js_hooks");
    const externalScriptsArtifact = artifacts.find((a) => a.type === "external_scripts");
    // Note: class_renaming_report is a newer artifact type that may not be in all projects
    const classRenamingArtifact = artifacts.find((a) => (a.type as string) === "class_renaming_report");

    // Parse class renaming report if available
    const classRenamingReport: ClassRenamingReport | null = useMemo(() => {
        if (!classRenamingArtifact?.content) return null;
        try {
            return JSON.parse(classRenamingArtifact.content) as ClassRenamingReport;
        } catch {
            return null;
        }
    }, [classRenamingArtifact?.content]);

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

    // Build comprehensive embeds array with all extracted content
    const embeds: Array<{ type: string; label: string; content: string; description: string }> = [];

    // CSS Styles - Route to only show embed-worthy CSS (not duplicating native Webflow styles)
    if (cssArtifact?.content) {
        // DEBUG: Check if :nth-child rules are in stored CSS
        const hasNthChildStored = cssArtifact.content.includes(':nth-child');
        console.log(`[project-details] :nth-child in stored CSS: ${hasNthChildStored}`);
        if (hasNthChildStored) {
            const nthChildRulesStored = cssArtifact.content.match(/\.[^{]+:nth-child\([^)]+\)\s*\{[^}]+\}/g);
            console.log(`[project-details] :nth-child rules in stored CSS:`, nthChildRulesStored?.slice(0, 3));
        }

        // Route the CSS to separate native Webflow styles from embed-required CSS
        const cssRouting = routeCSS(cssArtifact.content);

        // DEBUG: Check if :nth-child rules are in embed CSS
        const hasNthChildEmbed = cssRouting.embed?.includes(':nth-child');
        console.log(`[project-details] :nth-child in embed CSS: ${hasNthChildEmbed}`);
        if (hasNthChildEmbed) {
            const nthChildRulesEmbed = cssRouting.embed.match(/\.[^{]+:nth-child\([^)]+\)\{[^}]+\}/g);
            console.log(`[project-details] :nth-child rules in embed CSS:`, nthChildRulesEmbed?.slice(0, 3));
        }

        // Only add embed CSS if there's content that can't be in native Webflow styles
        // This includes: :root variables, @media queries, complex selectors, pseudo-elements
        if (cssRouting.embed && cssRouting.embed.trim()) {
            embeds.push({
                type: 'CSS',
                label: 'Embed Styles',
                content: wrapEmbedCSSInStyleTag(cssRouting.embed),
                description: 'CSS that Webflow cannot handle natively (variables, media queries, complex selectors). Add to page <head> embed or before </body>.'
            });
        }

        // Log routing stats for debugging
        if (cssRouting.stats.totalRules > 0) {
            console.log(`[CSS Routing] ${cssRouting.stats.nativeRules} native, ${cssRouting.stats.embedRules} embed, ${cssRouting.stats.atRulesExtracted} at-rules`);
        }
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

    const hasImages = project.images && project.images.length > 0;
    const hasEmbeds = externalLibraries.length > 0 || embeds.length > 0;

    const siteStructurePayload = useMemo<WebflowPayload | null>(() => {
        try {
            const allNodes: WebflowPayload["payload"]["nodes"] = [];
            const allStyles: WebflowPayload["payload"]["styles"] = [];

            // Maps style NAME to canonical style ID (first seen wins)
            const canonicalStyleIdByName = new Map<string, string>();
            // Maps old style ID -> canonical style ID or class name (for remapping node.classes)
            const styleIdRemap = new Map<string, string>();
            // Track token style names AND their IDs for proper remapping
            const tokenStyleNames = new Set<string>();
            const tokenStyleIdByName = new Map<string, string>(); // name -> _id
            const unresolvedClassRefs: Array<{ nodeId: string; classRef: string }> = [];

            if (tokenWebflowJsonArtifact?.content) {
                try {
                    const tokenPayload = JSON.parse(tokenWebflowJsonArtifact.content) as {
                        payload?: { styles?: Array<{ name?: string; _id?: string; styleLess?: Record<string, string>; variants?: Record<string, unknown> }> };
                    };
                    if (Array.isArray(tokenPayload.payload?.styles)) {
                        tokenPayload.payload.styles.forEach((style) => {
                            const styleName = style?.name;
                            const styleId = style?._id;
                            if (styleName && styleId) {
                                tokenStyleNames.add(styleName);
                                tokenStyleIdByName.set(styleName, styleId);
                                // Add token styles to allStyles so they're available for node.classes validation
                                // This ensures nodes referencing token styles pass the orphan check
                                allStyles.push(style as unknown as WebflowPayload["payload"]["styles"][number]);
                                canonicalStyleIdByName.set(styleName, styleId);
                            }
                        });
                    }
                } catch (e) {
                    console.error("Failed to parse token_webflow_json artifact:", e);
                }
            }

            components.forEach(({ payload }) => {
                if (payload?.webflowJson) {
                    try {
                        const parsed = JSON.parse(payload.webflowJson) as WebflowPayload & { placeholder?: boolean };
                        if (parsed.placeholder) {
                            return;
                        }
                        // Regenerate IDs for this component to avoid conflicts
                        const regenerated = sanitizer.regenerateAllIds(parsed);

                        // Build style ID remap for this component
                        // When we skip a style due to deduplication, we need to remap nodes to use the canonical ID
                        const componentStyleById = new Map<string, WebflowPayload["payload"]["styles"][number]>();
                        if (Array.isArray(regenerated.payload?.styles)) {
                            regenerated.payload.styles.forEach((style) => {
                                const styleName = style?.name || style?._id;
                                const styleId = style?._id;
                                if (!styleName || !styleId) return;
                                componentStyleById.set(styleId, style);

                                // Skip token styles - but remap to canonical token style ID, not name
                                if (tokenStyleNames.has(styleName)) {
                                    const canonicalTokenId = tokenStyleIdByName.get(styleName);
                                    if (canonicalTokenId) {
                                        styleIdRemap.set(styleId, canonicalTokenId);
                                    }
                                    return;
                                }

                                // Check if we already have a canonical style for this name
                                const existingCanonicalId = canonicalStyleIdByName.get(styleName);
                                if (existingCanonicalId) {
                                    // Duplicate style name - remap to canonical style ID
                                    styleIdRemap.set(styleId, existingCanonicalId);
                                } else {
                                    // First style with this name
                                    canonicalStyleIdByName.set(styleName, styleId);
                                    allStyles.push(style);
                                    styleIdRemap.set(styleId, styleId);
                                }
                            });
                        }

                        // Add nodes with remapped class references
                        if (regenerated.payload?.nodes) {
                            regenerated.payload.nodes.forEach((node) => {
                                // Remap node.classes to use canonical style IDs
                                if (Array.isArray(node.classes) && node.classes.length > 0) {
                                    node.classes = node.classes.map((classId) => {
                                        const remappedId = styleIdRemap.get(classId);
                                        if (remappedId) return remappedId;

                                        const style = componentStyleById.get(classId);
                                        if (style) {
                                            const styleName = style?.name || style?._id;
                                            if (!styleName) return classId;

                                            if (tokenStyleNames.has(styleName)) {
                                                const canonicalTokenId = tokenStyleIdByName.get(styleName);
                                                if (canonicalTokenId) {
                                                    styleIdRemap.set(classId, canonicalTokenId);
                                                    return canonicalTokenId;
                                                }
                                            }

                                            const canonicalId = canonicalStyleIdByName.get(styleName);
                                            if (canonicalId) {
                                                styleIdRemap.set(classId, canonicalId);
                                                return canonicalId;
                                            }

                                            // New style not seen yet - add it now
                                            canonicalStyleIdByName.set(styleName, style._id);
                                            allStyles.push(style);
                                            styleIdRemap.set(classId, style._id);
                                            return style._id;
                                        }

                                        unresolvedClassRefs.push({ nodeId: node._id, classRef: classId });
                                        return classId;
                                    });
                                }
                                allNodes.push(node);
                            });
                        }
                    } catch (e) {
                        console.error("Failed to parse component payload:", e);
                    }
                }
            });

            if (unresolvedClassRefs.length > 0) {
                console.warn("Unresolved class references in Site Structure payload:", unresolvedClassRefs.slice(0, 10));
            }

            if (allNodes.length === 0) {
                return null;
            }

            // P0.3: Validation gate - ensure all node.classes reference valid style IDs
            const allStyleIds = new Set(allStyles.map((s) => s._id));
            const orphanClassIds: Array<{ nodeId: string; classId: string }> = [];

            for (const node of allNodes) {
                if (Array.isArray(node.classes)) {
                    for (const classId of node.classes) {
                        if (!allStyleIds.has(classId)) {
                            orphanClassIds.push({ nodeId: node._id, classId });
                        }
                    }
                }
            }

            // Create placeholder styles for orphan class IDs
            // This ensures all node.classes UUIDs have matching style entries
            if (orphanClassIds.length > 0) {
                console.warn(
                    `[Site Structure] Creating ${orphanClassIds.length} placeholder styles for orphan class IDs`
                );

                // Get unique orphan class IDs (deduplicate)
                const uniqueOrphanIds = new Set(orphanClassIds.map((o) => o.classId));

                // Create placeholder style for each orphan UUID
                for (const orphanId of uniqueOrphanIds) {
                    // Skip if this is a Webflow reserved class (w-*, wf-*)
                    // These shouldn't have UUIDs but just in case
                    if (orphanId.startsWith('w-') || orphanId.startsWith('wf-')) {
                        continue;
                    }

                    // Use first 8 chars of UUID for a readable placeholder name
                    const shortId = orphanId.slice(0, 8);
                    const placeholderName = `placeholder-${shortId}`;

                    allStyles.push({
                        _id: orphanId,
                        fake: false,
                        type: "class",
                        name: placeholderName,
                        namespace: "",
                        comb: "",
                        styleLess: "",  // Empty - no styles, just a placeholder
                        variants: {},
                        children: [],
                    });

                    // Update tracking set
                    allStyleIds.add(orphanId);
                }
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

    // Use fixed payload if available, otherwise use the original
    const effectivePayload = fixedPayload ?? siteStructurePayload;

    const siteSafetyReport = useMemo(() => {
        if (!effectivePayload) return null;
        try {
            return ensureWebflowPasteSafety({ payload: effectivePayload }).report;
        } catch {
            return null;
        }
    }, [effectivePayload]);

    const isWarn = siteSafetyReport?.status === "warn";
    const isBlocked = siteSafetyReport?.status === "block";

    // Handler for attempting to fix remaining safety issues
    const handleAttemptFix = async (): Promise<{ fixed: number; remaining: number }> => {
        if (!siteStructurePayload) {
            return { fixed: 0, remaining: 0 };
        }

        setIsAttemptingFix(true);

        try {
            // Get the current warning/error count before fix
            const currentPayload = fixedPayload ?? siteStructurePayload;
            const beforeReport = ensureWebflowPasteSafety({ payload: currentPayload });
            const beforeIssues = beforeReport.report.warnings.length + beforeReport.report.fatalIssues.length;

            // Apply the safety gate's auto-fixes by using the sanitized payload it returns
            // The safety gate returns the payload with auto-fixes applied
            const safetyResult = ensureWebflowPasteSafety({ payload: siteStructurePayload });

            // The safety gate's returned `payload` includes all auto-fixes
            if (safetyResult.sanitizationApplied || safetyResult.report.autoFixes.length > 0) {
                setFixedPayload(safetyResult.payload);

                // Get new issue count after fix
                const afterReport = ensureWebflowPasteSafety({ payload: safetyResult.payload });
                const afterIssues = afterReport.report.warnings.length + afterReport.report.fatalIssues.length;

                const fixed = Math.max(0, beforeIssues - afterIssues);
                if (safetyResult.report.autoFixes.length > 0) {
                    toast.success(`Applied ${safetyResult.report.autoFixes.length} auto-fix(es)`);
                } else {
                    toast.info("No additional fixes could be applied");
                }
                return { fixed, remaining: afterIssues };
            }

            // No fixable issues found
            toast.info("No additional fixes available - remaining issues may need manual resolution in Webflow");
            return { fixed: 0, remaining: beforeIssues };
        } catch (error) {
            console.error("Fix attempt failed:", error);
            toast.error("Failed to apply fixes");
            return { fixed: 0, remaining: siteSafetyReport?.warnings.length ?? 0 };
        } finally {
            setIsAttemptingFix(false);
        }
    };

    const normalizedFonts = useMemo<FontChecklistEntry[] | undefined>(() => {
        if (!project.fonts) return undefined;
        return project.fonts.map((font) => ({
            name: font.name,
            weights: font.weights,
            source: font.source,
            installationGuide: font.installationGuide,
        }));
    }, [project.fonts]);

    const handleCopySiteStructure = async () => {
        try {
            // Use fixed payload if available (after user clicked "Try Fix")
            const payloadToCopy = fixedPayload ?? siteStructurePayload;
            if (!payloadToCopy) {
                toast.error("No extracted components available to copy");
                return;
            }
            await copyWebflowJson(JSON.stringify(payloadToCopy));
        } catch (error) {
            toast.error("Failed to copy site structure");
            console.error(error);
        }
    };

    const secondaryTabItems = [
        { label: "Assets & Images", value: "images" },
        { label: "Custom Embeds", value: "embeds" },
    ];

    return (
        <div className="space-y-10">
            {/* Clean Header */}
            <div className="flex items-center gap-4 sm:gap-6 mb-10">
                <Link href="/workspace/projects" className="shrink-0">
                    <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-accent text-muted-foreground hover:text-foreground rounded-xl transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate">{project.name}</h1>
                </div>
            </div>

            {/* Hero & Overview Side-by-Side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Hero Image - 2/3 */}
                <div className="lg:col-span-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(file);
                        }}
                    />
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`bg-card/80 backdrop-blur-xl rounded-[32px] border border-white/20 ring-1 ring-white/10 overflow-hidden shadow-2xl shadow-primary/5 h-full relative group cursor-pointer transition-all ${isUploading ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50'}`}
                    >
                        <div className="aspect-[16/9] w-full h-full relative">
                            {project.thumbnailUrl ? (
                                <Image
                                    src={project.thumbnailUrl}
                                    alt={project.name}
                                    fill
                                    sizes="(min-width: 1024px) 66vw, 100vw"
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                    priority
                                />
                            ) : (
                                <div className="w-full h-full bg-accent/30 flex flex-col items-center justify-center text-muted-foreground/40 min-h-[300px]">
                                    <ImageIcon className="w-16 h-16 stroke-1 mb-4" />
                                    <span className="text-sm font-black uppercase tracking-widest opacity-40">Paste image</span>
                                </div>
                            )}
                        </div>
                        {isUploading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </div>

                {/* Overview Sidebar - 1/3 */}
                <div className="flex">
                    <div className="bg-card/90 backdrop-blur-xl rounded-[32px] border border-white/20 ring-1 ring-white/10 p-8 shadow-2xl shadow-primary/5 h-full flex flex-col w-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-widest">Overview</h3>
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-bold text-[10px] uppercase">Ready to Import</Badge>
                        </div>

                        <div className="space-y-8 flex-1">
                            {/* Simplified Description - Only show if exists and not placeholder */}
                            {project.description && project.description.trim() !== "" && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</h4>
                                    <p className="text-muted-foreground/80 text-sm leading-relaxed italic">
                                        {project.description}
                                    </p>
                                </div>
                            )}

                            {/* Font Checklist - Compact */}
                            {normalizedFonts && normalizedFonts.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Add to Webflow Fonts</h4>
                                    <div className="space-y-2">
                                        {normalizedFonts.map((font, idx) => (
                                            <div key={idx} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-foreground">{font.name}</span>
                                                    {font.weights && font.weights.length > 0 && (
                                                        <span className="text-[10px] text-muted-foreground/60">
                                                            Weights: {font.weights.sort((a, b) => a - b).join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                                <Badge variant="outline" className="text-[9px] border-primary/20 text-primary font-bold uppercase shrink-0">
                                                    {font.source === 'Google Fonts' ? 'Google' : font.source === 'Adobe Fonts' ? 'Adobe' : 'Custom'}
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/60 italic">
                                        Go to Site Settings &rarr; Fonts to add these fonts
                                    </p>
                                </div>
                            )}

                            {/* Safety Report Sidebar Version */}
                            {siteSafetyReport && (
                                <div className="space-y-3 p-5 bg-white/5 rounded-[24px] border border-white/10 ring-1 ring-white/5 shadow-inner">
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                                        Safety Check
                                        {siteSafetyReport.status === 'pass' ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                                    </h4>
                                    <p className="text-[11px] text-muted-foreground font-medium leading-tight">
                                        {siteSafetyReport.status === 'pass' ? 'Payload is safe to paste.' : 'Export contains minor warnings.'}
                                    </p>

                                    <div className="flex flex-col gap-2 mt-2">
                                        {(isWarn || isBlocked) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleAttemptFix}
                                                disabled={isAttemptingFix}
                                                className="w-full bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-widest h-10 rounded-xl transition-all"
                                            >
                                                {isAttemptingFix ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-2" />}
                                                Neutralize Risks
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="w-full text-[10px] font-black uppercase tracking-widest h-10 rounded-xl hover:bg-white/5 border border-border/50 text-muted-foreground/80"
                                            onClick={async () => {
                                                const lines: string[] = [
                                                    `Safety Report: ${siteSafetyReport.status.toUpperCase()}`,
                                                    `---`,
                                                ];

                                                if (siteSafetyReport.fatalIssues.length > 0) {
                                                    lines.push("Fatal Issues:");
                                                    lines.push(...siteSafetyReport.fatalIssues.map((issue) => `- ${issue}`));
                                                }

                                                if (siteSafetyReport.warnings.length > 0) {
                                                    lines.push("Warnings:");
                                                    lines.push(...siteSafetyReport.warnings.map((warning) => `- ${warning}`));
                                                }

                                                if (siteSafetyReport.autoFixes.length > 0) {
                                                    lines.push("Auto Fixes:");
                                                    lines.push(...siteSafetyReport.autoFixes.map((fix) => `- ${fix}`));
                                                }

                                                if (siteSafetyReport.embedSize.errors.length > 0 || siteSafetyReport.embedSize.warnings.length > 0) {
                                                    lines.push("Embed Size:");
                                                    lines.push(...siteSafetyReport.embedSize.errors.map((issue) => `- ${issue}`));
                                                    lines.push(...siteSafetyReport.embedSize.warnings.map((issue) => `- ${issue}`));
                                                }

                                                if (siteSafetyReport.extractedToEmbeds?.warnings?.length) {
                                                    lines.push("Embed Extraction:");
                                                    lines.push(...siteSafetyReport.extractedToEmbeds.warnings.map((warning) => `- ${warning}`));
                                                }

                                                if (siteSafetyReport.htmlSanitization.warnings.length > 0 || siteSafetyReport.htmlSanitization.errors.length > 0) {
                                                    lines.push("HTML Sanitization:");
                                                    lines.push(...siteSafetyReport.htmlSanitization.errors.map((issue) => `- ${issue}`));
                                                    lines.push(...siteSafetyReport.htmlSanitization.warnings.map((issue) => `- ${issue}`));
                                                }

                                                if (lines.length === 2) {
                                                    lines.push("No warnings reported.");
                                                }
                                                await copyText(lines.join('\n'));
                                                toast.success("Full report copied");
                                            }}
                                        >
                                            Copy Full Report
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Site Structure - Main Feature */}
            <div className="bg-card/80 backdrop-blur-xl rounded-[32px] border border-white/20 ring-1 ring-white/10 p-10 shadow-2xl shadow-primary/5 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-50 pointer-events-none" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Site Structure</h3>
                            <Badge className="bg-primary/20 text-primary border border-primary/20 font-bold text-[10px] uppercase backdrop-blur-md">Base Layout + Styles</Badge>
                        </div>
                        <p className="text-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                            Webflow natively understands this structure. Copy the full payload and paste it directly into your Webflow Canvas.
                        </p>
                    </div>

                    <div className="flex items-center shrink-0">
                        <Button
                            onClick={handleCopySiteStructure}
                            className="bg-primary hover:opacity-90 text-primary-foreground shadow-2xl shadow-primary/20 font-black px-12 h-16 rounded-2xl transition-all text-xl premium-hover hover:scale-[1.02] active:scale-[0.98] btn-premium"
                            disabled={!siteStructurePayload}
                        >
                            Copy to Webflow
                        </Button>
                    </div>
                </div>
            </div>

            {/* Assets & Extras Tabs */}
            <div className="space-y-6 pt-6 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-bold text-foreground tracking-tight">Assets & Code</h3>
                    <p className="text-sm font-medium text-muted-foreground/60">Extra resources for your project</p>
                </div>

                <Tabs defaultValue="images" className="w-full">
                    <div className="mb-8">
                        <TabsList className="p-1.5 bg-accent/40 backdrop-blur-xl rounded-[20px] h-auto inline-flex gap-1.5 shadow-inner border border-border/50">
                            {secondaryTabItems.map(tab => (
                                <TabsTrigger
                                    key={tab.value}
                                    value={tab.value}
                                    className="rounded-[14px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg px-8 py-3.5 text-muted-foreground hover:text-foreground transition-all font-bold text-sm whitespace-nowrap"
                                >
                                    {tab.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <TabsContent value="images" className="mt-0">
                            {hasImages ? (
                                <ImagesGrid
                                    images={project.images}
                                    projectId={project._id}
                                />
                            ) : (
                                <div className="bg-card/50 backdrop-blur rounded-[32px] border border-dashed border-white/10 p-20 text-center text-muted-foreground/60 italic">
                                    No images detected in this import.
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="embeds" className="space-y-8 mt-0">
                            {hasEmbeds ? (
                                <>
                                    {/* Bug 4 Fix: Libraries Section */}
                                    {externalLibraries.length > 0 && (
                                        <div className="bg-card/80 backdrop-blur-xl rounded-[32px] border border-white/20 ring-1 ring-white/10 p-8 shadow-2xl shadow-primary/5 space-y-6">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-2xl font-bold text-foreground">External Libraries</h3>
                                                    <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-none font-bold text-[10px] uppercase">
                                                        {externalLibraries.length} {externalLibraries.length === 1 ? 'library' : 'libraries'}
                                                    </Badge>
                                                </div>
                                                <p className="text-muted-foreground font-medium leading-relaxed">
                                                    Add these CDN links to your Webflow project settings to enable third-party functionalites.
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                {externalLibraries.map((lib, idx) => {
                                                    const tag = lib.type === 'script'
                                                        ? `<script src="${lib.url}"></script>`
                                                        : `<link rel="stylesheet" href="${lib.url}">`;

                                                    return (
                                                        <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 ring-1 ring-white/5 hover:bg-white/10 transition-all group">
                                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                <Badge className={lib.type === 'script' ? "bg-yellow-500/10 text-yellow-500 border-none font-bold text-[10px] uppercase shrink-0" : "bg-purple-500/10 text-purple-400 border-none font-bold text-[10px] uppercase shrink-0"}>
                                                                    {lib.type === 'script' ? 'JS' : 'CSS'}
                                                                </Badge>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-foreground text-sm">{lib.name}</p>
                                                                    <code className="text-[10px] text-muted-foreground font-mono truncate block mt-0.5">
                                                                        {tag}
                                                                    </code>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-primary font-bold hover:bg-primary/5 shrink-0 ml-4 h-9 px-4 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={async (e) => {
                                                                    e.preventDefault();
                                                                    await copyText(tag);
                                                                    toast.success("Tag copied");
                                                                }}
                                                            >
                                                                Copy Tag
                                                            </Button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Embeds Section */}
                                    <div className="bg-card/80 backdrop-blur-xl rounded-[32px] border border-white/20 ring-1 ring-white/10 p-8 shadow-2xl shadow-primary/5 space-y-8">
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-bold text-foreground">Custom Embeds</h3>
                                            <p className="text-muted-foreground font-medium leading-relaxed">
                                                Complex CSS and functional JavaScript that Webflow cannot handle natively. Paste these into individual Embed blocks.
                                            </p>
                                        </div>

                                        <div className="space-y-6">
                                            {embeds.length > 0 ? (
                                                embeds.map((embed, idx) => {
                                                    const isExpanded = !!expandedEmbeds[idx];
                                                    const shouldClamp = embed.content.length > 1200;

                                                    return (
                                                        <div key={idx} className="p-8 bg-white/5 rounded-[28px] border border-white/10 ring-1 ring-white/5 space-y-6 transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-primary/5">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <Badge className={embed.type === 'CSS' ? "bg-purple-500/10 text-purple-400 border-none font-bold uppercase text-[10px]" : "bg-yellow-500/10 text-yellow-500 border-none font-bold uppercase text-[10px]"}>
                                                                        {embed.type}
                                                                    </Badge>
                                                                    <span className="text-lg font-black text-foreground tracking-tight">{embed.label}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {shouldClamp && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="text-muted-foreground font-bold hover:bg-white/5 rounded-lg h-9 px-4"
                                                                            onClick={() => {
                                                                                setExpandedEmbeds((prev) => ({
                                                                                    ...prev,
                                                                                    [idx]: !isExpanded,
                                                                                }));
                                                                            }}
                                                                        >
                                                                            {isExpanded ? "Show Less" : "Show More"}
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className={copiedEmbed === idx ? "text-emerald-500 font-bold hover:bg-emerald-500/10 rounded-lg h-9 px-4" : "text-primary font-bold hover:bg-primary/5 rounded-lg h-9 px-4"}
                                                                        onClick={async (e) => {
                                                                            e.preventDefault();
                                                                            const result = await copyText(embed.content);
                                                                            if (result.success) {
                                                                                setCopiedEmbed(idx);
                                                                                setTimeout(() => setCopiedEmbed(null), 2000);
                                                                            }
                                                                        }}
                                                                    >
                                                                        {copiedEmbed === idx ? "Copied!" : "Copy Code"}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            <p className="text-sm text-muted-foreground font-medium">{embed.description}</p>
                                                            <pre
                                                                className={`text-xs font-mono bg-zinc-50 dark:bg-black/30 p-6 rounded-2xl border border-zinc-200 dark:border-white/5 ring-1 ring-zinc-200 dark:ring-white/5 overflow-x-auto text-zinc-600 dark:text-muted-foreground/80 leading-relaxed shadow-inner ${isExpanded ? "max-h-[60vh]" : "max-h-64"}`}
                                                            >
                                                                {embed.content}
                                                            </pre>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-12 text-muted-foreground/40 font-medium italic">
                                                    No special embeds needed for this project.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-white/50 backdrop-blur rounded-[32px] border border-dashed border-slate-200 p-20 text-center text-slate-400 italic">
                                    No external dependencies or custom embeds for this project.
                                </div>
                            )}
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
}
