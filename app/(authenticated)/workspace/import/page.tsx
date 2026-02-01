
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ArrowRight,
    AlertCircle,
    FileText,
    Files,
    CheckCircle2,
    Loader2,
    UploadCloud,
    Plus,
    X,
    Code2,
    Palette,
    Zap,
    Download,
    History,
    LayoutTemplate,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

import { useState, useRef, useEffect, Suspense } from "react";
import { WebflowTemplateImport, type WebflowTemplateImportHandle } from "@/components/admin/WebflowTemplateImport";
import { Progress } from "@/components/ui/progress";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { processProjectImport } from "@/lib/project-engine";
import { resolveCodePen, type CodePenMeta, type ImportInput, type ValidationMessage } from "@/lib/codepen-resolver";
import { runCodePenPreflight, type CodePenPreflightResult } from "@/lib/validation/codepen-preflight";
import { toast } from "sonner";

function getAdminEmails(): string[] {
    const envValue = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
    return envValue
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);
}

// Main component with Suspense boundary
export default function ImportPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        }>
            <ImportForm />
        </Suspense>
    );
}

function ImportForm() {
    const searchParams = useSearchParams();
    const importMutation = useMutation(api.import.importProject);
    const { user } = useUser();

    // Admin check
    const isAdmin = getAdminEmails().includes(
        user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? ''
    );

    // Main Import Source: 'html' | 'codepen' | 'webflow' (webflow is admin-only)
    const [importSource, setImportSource] = useState<'html' | 'codepen' | 'webflow'>('html');

    // HTML Sub-types: 'single' | 'multi'
    const [importType, setImportType] = useState<'single' | 'multi'>('single');

    // CodePen States
    const [codepenUrl, setCodepenUrl] = useState("");
    const [codepenMeta, setCodepenMeta] = useState<CodePenMeta | null>(null);
    const [codepenPreflight, setCodepenPreflight] = useState<CodePenPreflightResult | null>(null);

    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStageLabel, setCurrentStageLabel] = useState("INITIALIZING");
    const webflowImportRef = useRef<WebflowTemplateImportHandle>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDone, setIsDone] = useState(false);
    const [newProjectId, setNewProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Shared Code Editor State
    const [htmlText, setHtmlText] = useState("");
    const [cssText, setCssText] = useState("");
    const [jsText, setJsText] = useState("");
    const [cssUrls, setCssUrls] = useState<string[]>([]);
    const [jsUrls, setJsUrls] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const healthPanelRef = useRef<HTMLDivElement>(null);

    const buildCodePenInput = (overrides?: Partial<ImportInput>): ImportInput => ({
        projectName: overrides?.projectName ?? (projectName.trim() || "CodePen Import"),
        htmlText: overrides?.htmlText ?? htmlText,
        cssText: overrides?.cssText ?? cssText,
        jsText: overrides?.jsText ?? jsText,
        cssUrls: overrides?.cssUrls ?? cssUrls,
        jsUrls: overrides?.jsUrls ?? jsUrls,
        provenance: 'codepen',
    });

    const runPreflightAndStore = (input: ImportInput, meta?: CodePenMeta) => {
        const result = runCodePenPreflight(input, meta);
        setCodepenPreflight(result);
        return result;
    };

    const getFieldMessages = (field: ValidationMessage['field']) => {
        if (!codepenPreflight) {
            return [] as ValidationMessage[];
        }
        return [
            ...codepenPreflight.blockers,
            ...codepenPreflight.warnings,
            ...codepenPreflight.infos,
        ].filter((message) => message.field === field);
    };

    // Sync search params with state
    useEffect(() => {
        const source = searchParams.get('source');
        if (source === 'codepen') {
            setImportSource('codepen');
        } else if (source === 'html') {
            setImportSource('html');
        }
    }, [searchParams]);

    const handleFileSelect = (file: File) => {
        if (file.type.includes('zip') || file.name.toLowerCase().endsWith('.zip')) {
            toast.error('ZIP Import Not Supported', {
                description: 'Please extract your ZIP file and upload individual HTML files.',
            });
            setSelectedFile(null);
            return;
        }

        const isValidType = file.type === 'text/html' || file.name.endsWith('.html');
        if (!isValidType) {
            toast.error('Please upload an HTML file');
            return;
        }

        setSelectedFile(file);
        if (!projectName && file.name) {
            setProjectName(file.name.replace(/\.html$/i, '').replace(/[-_]/g, ' '));
        }
    };

    const buildMultiFileHtmlFromParts = (parts: {
        htmlText: string;
        cssText: string;
        jsText: string;
        cssUrls: string[];
        jsUrls: string[];
    }) => {
        const normalizedCssUrls = parts.cssUrls.map((url) => url.trim()).filter(Boolean);
        const normalizedJsUrls = parts.jsUrls.map((url) => url.trim()).filter(Boolean);

        const cssLinks = normalizedCssUrls
            .map((url) => `<link rel="stylesheet" href="${url}">`)
            .join("\n");
        const jsLinks = normalizedJsUrls
            .map((url) => `<script src="${url}"></script>`)
            .join("\n");

        const cssBlock = parts.cssText.trim() ? `<style>\n${parts.cssText.trim()}\n</style>` : "";
        const jsBlock = parts.jsText.trim() ? `<script>\n${parts.jsText.trim()}\n</script>` : "";

        return [cssLinks, cssBlock, parts.htmlText, jsLinks, jsBlock]
            .filter((block) => block && block.trim().length > 0)
            .join("\n\n");
    };

    const buildMultiFileHtml = () => buildMultiFileHtmlFromParts({
        htmlText,
        cssText,
        jsText,
        cssUrls,
        jsUrls,
    });

    const handleImport = async () => {
        const hasCodepenUrl = codepenUrl.trim().length > 0;
        if (!projectName.trim() && !(importSource === 'codepen' && hasCodepenUrl)) {
            toast.error('Please enter a project name');
            return;
        }

        if (importSource === 'html' && importType === 'single' && !selectedFile) {
            toast.error('Please select a file to import');
            return;
        }

        if ((importSource === 'codepen' || (importSource === 'html' && importType === 'multi')) && !htmlText && !hasCodepenUrl) {
            toast.error('HTML content is required');
            return;
        }

        setIsImporting(true);
        setError(null);
        setProgress(5);
        setCurrentStageLabel("PARSING");

        try {
            let resolvedInput: ImportInput | null = null;
            let resolvedMeta: CodePenMeta | null = null;
            let effectiveProjectName = projectName.trim();

            if (importSource === 'codepen' && hasCodepenUrl) {
                setCurrentStageLabel("FETCHING CODEPEN");
                setProgress(2);

                const resolved = await resolveCodePen(codepenUrl.trim());
                resolvedInput = resolved.input;
                resolvedMeta = resolved.meta ?? null;

                setHtmlText(resolved.input.htmlText);
                setCssText(resolved.input.cssText);
                setJsText(resolved.input.jsText);
                setCssUrls(resolved.input.cssUrls);
                setJsUrls(resolved.input.jsUrls);
                setCodepenMeta(resolvedMeta);

                if (!effectiveProjectName) {
                    effectiveProjectName = resolved.input.projectName;
                    setProjectName(resolved.input.projectName);
                }

                const preflight = runPreflightAndStore(resolved.input, resolved.meta);
                if (preflight.blockers.length > 0) {
                    toast.error('Fix blockers before importing.');
                    healthPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setIsImporting(false);
                    return;
                }
            } else if (importSource === 'codepen') {
                const preflight = runPreflightAndStore(buildCodePenInput(), codepenMeta ?? undefined);
                if (preflight.blockers.length > 0) {
                    toast.error('Fix blockers before importing.');
                    healthPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    setIsImporting(false);
                    return;
                }
            }

            let finalHtml = htmlText;

            // If single file, read it first
            if (importSource === 'html' && importType === 'single' && selectedFile) {
                const reader = new FileReader();
                finalHtml = await new Promise<string>((resolve, reject) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.onerror = () => reject(new Error("Failed to read file"));
                    reader.readAsText(selectedFile);
                });
            }

            if (importSource === 'codepen' || (importSource === 'html' && importType === 'multi')) {
                if (resolvedInput) {
                    finalHtml = buildMultiFileHtmlFromParts(resolvedInput);
                } else {
                    finalHtml = buildMultiFileHtml();
                }
            }

            // Process with engine
            const result = await processProjectImport(
                finalHtml,
                effectiveProjectName,
                (stage, prog) => {
                    setProgress(prog);
                    setCurrentStageLabel(stage.toUpperCase());
                }
            );

            // Store in database
            setCurrentStageLabel("SAVING TO DATABASE");
            const importResponse = await importMutation({
                projectName: result.projectName,
                projectSlug: result.projectSlug,
                artifacts: result.artifacts,
                components: result.components,
                tokenWebflowJson: result.tokenWebflowJson,
                sourceHtml: finalHtml,
                fonts: result.fonts,
                images: result.images.map(img => ({
                    ...img,
                    sizeWarning: img.sizeWarning || false,
                    blocked: img.blocked || false,
                    classification: img.classification || 'absolute',
                })),
            });

            if (importResponse.projectId) {
                setNewProjectId(importResponse.projectId);
                setIsDone(true);
                toast.success("Project imported successfully!");
            } else {
                throw new Error("Failed to create project record");
            }
        } catch (err: unknown) {
            console.error("Import error:", err);
            const message = err instanceof Error ? err.message : "An unexpected error occurred during import";
            setError(message);
            setIsImporting(false);
        }
    };

    if (isDone) {
        return (
            <div className="max-w-6xl mx-auto py-24 px-6 text-center space-y-8">
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-in zoom-in duration-500 border border-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-foreground mb-2">Import Successful</h1>
                    <p className="text-muted-foreground font-medium">Your project &ldquo;{projectName}&rdquo; is ready and converted.</p>
                </div>
                <Link href={`/workspace/projects/${newProjectId}`}>
                    <Button className="bg-primary text-primary-foreground hover:opacity-90 shadow-xl shadow-primary/20 premium-hover px-12 h-14 rounded-2xl font-black text-lg btn-premium">
                        View Project <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1700px] mx-auto py-12 px-8">
            <div className="mb-12 text-center space-y-4">
                <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tight">Import Project</h1>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
                    {importSource === 'html'
                        ? (importType === 'single' ? "Transform your legacy code into high-performance components." : "Import your HTML + CSS + JS (separately).")
                        : "Import your HTML + CSS + JS from CodePen."
                    }
                </p>
                {importSource === 'codepen' && (
                    <p className="text-muted-foreground/60 text-sm max-w-lg mx-auto italic font-medium">
                        Paste a public CodePen link or paste the HTML + CSS + JS manually below.
                    </p>
                )}
            </div>

            <div className="bg-card/80 backdrop-blur-xl rounded-[32px] border border-white/20 ring-1 ring-white/10 overflow-hidden shadow-2xl shadow-primary/5 p-10 relative">
                {isImporting && (
                    <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
                        <div className="w-full max-w-sm space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-2xl font-bold text-foreground">Importing Project...</h3>
                                <p className="text-muted-foreground text-sm">Analyzing code architecture and mapping semantic elements.</p>
                            </div>
                            <div className="space-y-2">
                                <Progress value={progress} className="h-3 bg-accent [&>div]:bg-primary rounded-full shadow-inner" />
                                <div className="flex justify-between text-xs font-bold text-primary tracking-wider">
                                    <span>{Math.round(progress)}% COMPLETE</span>
                                    <span>{currentStageLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-12">
                    {/* Top Action Bar */}
                    <div className="flex justify-between items-center pb-8 border-b border-white/10">
                        <div className="bg-slate-500/10 p-1.5 rounded-2xl inline-flex gap-1 shadow-inner border border-white/10 ring-1 ring-white/5 h-fit">
                            <button
                                onClick={() => setImportSource('html')}
                                className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${importSource === 'html' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                            >
                                <FileText className="w-4 h-4" /> HTML Bundle
                            </button>
                            <button
                                onClick={() => setImportSource('codepen')}
                                className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${importSource === 'codepen' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                            >
                                <Files className="w-4 h-4" /> CodePen
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => setImportSource('webflow')}
                                    className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all duration-300 ${importSource === 'webflow' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                                >
                                    <LayoutTemplate className="w-4 h-4" /> Import Template
                                </button>
                            )}
                        </div>

                        <Button
                            onClick={() => {
                                if (importSource === 'webflow') {
                                    webflowImportRef.current?.handleImport();
                                } else {
                                    handleImport();
                                }
                            }}
                            disabled={isImporting || webflowImportRef.current?.isImporting}
                            className="bg-primary text-primary-foreground hover:opacity-90 shadow-xl shadow-primary/20 premium-hover px-10 h-14 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-50 btn-premium"
                        >
                            {isImporting ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <>{importSource === 'webflow' ? 'Import Template' : 'Import Project'} <ArrowRight className="w-6 h-6 ml-3" /></>}
                        </Button>
                    </div>

                    {importSource === 'webflow' ? (
                        <WebflowTemplateImport ref={webflowImportRef} />
                    ) : (
                    <div className="space-y-10">
                        {/* Project Name Field */}
                        <div className="space-y-3 max-w-xl">
                            <Label htmlFor="projectName" className="text-foreground font-bold ml-1">Project Name</Label>
                            <Input
                                id="projectName"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="e.g. Osmo Loader, Client Site v2"
                                className="h-14 rounded-2xl border-border focus:ring-primary focus:border-primary font-bold bg-slate-500/5 backdrop-blur-sm shadow-inner px-6 text-lg"
                            />
                            <p className="text-[10px] text-muted-foreground font-medium ml-1">Give it a name you&rsquo;ll recognize later (e.g. &ldquo;Osmo Loader&rdquo;, &ldquo;Client Site v2&rdquo;).</p>
                        </div>


                        {importSource === 'html' ? (
                            <div className="space-y-12">
                                {/* HTML Sub-toggle */}
                                <div className="flex justify-start">
                                    <div className="bg-slate-500/5 border border-white/10 ring-1 ring-white/5 p-1 rounded-xl flex gap-1">
                                        <button
                                            onClick={() => setImportType('single')}
                                            className={`px-6 py-2 rounded-lg text-xs uppercase tracking-widest font-black transition-all ${importType === 'single' ? 'bg-white text-black shadow-lg' : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'}`}
                                        >
                                            Single File
                                        </button>
                                        <button
                                            onClick={() => setImportType('multi')}
                                            className={`px-6 py-2 rounded-lg text-xs uppercase tracking-widest font-black transition-all ${importType === 'multi' ? 'bg-white text-black shadow-lg' : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'}`}
                                        >
                                            Multi-File
                                        </button>
                                    </div>
                                </div>

                                {importType === 'single' ? (
                                    <div className="space-y-4">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".html,.zip"
                                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                            className="hidden"
                                        />
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                            onDragLeave={() => setIsDragging(false)}
                                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); e.dataTransfer.files?.[0] && handleFileSelect(e.dataTransfer.files[0]); }}
                                            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-[40px] p-24 text-center group hover:bg-white/[0.02] transition-all cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-white/10 bg-slate-500/5 ring-1 ring-white/5 shadow-inner'}`}
                                        >
                                            <div className={`w-32 h-32 rounded-[40px] flex items-center justify-center mb-8 group-hover:scale-110 transition-transform shadow-2xl ${selectedFile ? 'bg-emerald-500/10 text-emerald-500 shadow-emerald-500/10' : 'bg-primary/10 text-primary shadow-primary/10'}`}>
                                                {selectedFile ? <CheckCircle2 className="w-16 h-16" /> : <UploadCloud className="w-16 h-16" />}
                                            </div>
                                            <h4 className="text-3xl font-black text-foreground mb-3 tracking-tight">{selectedFile ? selectedFile.name : 'Upload HTML Bundle'}</h4>
                                            <p className="text-muted-foreground font-medium text-lg max-w-[400px] leading-relaxed">Drag your single HTML file containing CSS and JS.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-12 animate-in fade-in duration-500">
                                        <LibrariesEditor
                                            cssUrls={cssUrls} setCssUrls={setCssUrls}
                                            jsUrls={jsUrls} setJsUrls={setJsUrls}
                                        />
                                        <MultiFileEditor
                                            htmlText={htmlText} setHtmlText={setHtmlText}
                                            cssText={cssText} setCssText={setCssText}
                                            jsText={jsText} setJsText={setJsText}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-12 animate-in slide-in-from-right-4 duration-500">
                                {/* CodePen URL Input */}
                                <div className="space-y-3 max-w-2xl">
                                    <Label className="text-foreground font-bold ml-1">CodePen URL</Label>
                                    <Input
                                        value={codepenUrl}
                                        onChange={(e) => setCodepenUrl(e.target.value)}
                                        placeholder="https://codepen.io/osmosupply/pen/RNaeYqp"
                                        className="h-14 rounded-2xl border-white/10 ring-1 ring-white/5 focus:ring-primary font-bold bg-slate-500/5 backdrop-blur-sm px-6 shadow-inner"
                                    />
                                    <div className="flex items-center gap-3 ml-1" />
                                </div>

                                {/* Libraries Section */}
                                <LibrariesEditor
                                    cssUrls={cssUrls} setCssUrls={setCssUrls}
                                    jsUrls={jsUrls} setJsUrls={setJsUrls}
                                    libraryMessages={getFieldMessages('libraries')}
                                />

                                {/* CodePen Health Panel */}
                                {codepenPreflight && (
                                    <div ref={healthPanelRef} className="rounded-2xl border border-white/10 bg-slate-500/5 p-6 space-y-4 shadow-inner">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground font-bold text-xs shadow-inner">Health Panel</div>
                                                <h3 className="text-xs font-black text-foreground uppercase tracking-widest">Pre-flight Check</h3>
                                            </div>
                                            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                <span className={codepenPreflight.blockers.length > 0 ? "text-red-500" : ""}>Blockers: {codepenPreflight.blockers.length}</span>
                                                <span className={codepenPreflight.warnings.length > 0 ? "text-amber-500" : ""}>Warnings: {codepenPreflight.warnings.length}</span>
                                                <span>Info: {codepenPreflight.infos.length}</span>
                                            </div>
                                        </div>
                                        <details className="text-xs text-muted-foreground">
                                            <summary className="cursor-pointer font-semibold text-foreground/80">View health details</summary>
                                            <div className="mt-4 space-y-4">
                                                {codepenPreflight.blockers.length > 0 && (
                                                    <div>
                                                        <p className="text-red-500 font-bold uppercase tracking-widest text-[10px] mb-2">Blockers</p>
                                                        <div className="space-y-2">
                                                            {codepenPreflight.blockers.map((item) => (
                                                                <div key={`${item.code}-${item.title}`} className="text-red-500/90 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                                                                    <div className="font-bold">{item.title}</div>
                                                                    <div className="text-[11px] text-red-500/70">{item.detail}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {codepenPreflight.warnings.length > 0 && (
                                                    <div>
                                                        <p className="text-amber-500 font-bold uppercase tracking-widest text-[10px] mb-2">Warnings</p>
                                                        <div className="space-y-2">
                                                            {codepenPreflight.warnings.map((item) => (
                                                                <div key={`${item.code}-${item.title}`} className="text-amber-500/90 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                                                                    <div className="font-bold">{item.title}</div>
                                                                    <div className="text-[11px] text-amber-500/70">{item.detail}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {codepenPreflight.infos.length > 0 && (
                                                    <div>
                                                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mb-2">Info</p>
                                                        <div className="space-y-2">
                                                            {codepenPreflight.infos.map((item) => (
                                                                <div key={`${item.code}-${item.title}`} className="text-muted-foreground/80 bg-white/5 p-3 rounded-xl border border-white/10">
                                                                    <div className="font-bold">{item.title}</div>
                                                                    <div className="text-[11px] text-muted-foreground/70">{item.detail}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </details>
                                    </div>
                                )}

                                <div className={`transition-all duration-500 ${importSource === 'codepen' ? 'opacity-100' : 'opacity-50 blur-[1px]'}`}>
                                    <div className="flex items-center gap-3 mb-8 px-1">
                                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-muted-foreground font-bold text-xs shadow-inner">2</div>
                                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Review & Edit</h3>
                                        <div className="h-px flex-1 bg-white/10" />
                                    </div>

                                    <div className={importSource === 'codepen' ? "" : "pointer-events-none"}>
                                        <MultiFileEditor
                                            htmlText={htmlText} setHtmlText={setHtmlText}
                                            cssText={cssText} setCssText={setCssText}
                                            jsText={jsText} setJsText={setJsText}
                                            htmlMessages={getFieldMessages('html')}
                                            cssMessages={getFieldMessages('css')}
                                            jsMessages={getFieldMessages('js')}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 flex items-start gap-4 animate-in fade-in duration-300">
                                <AlertCircle className="w-6 h-6 text-red-500 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-lg font-black text-red-500 leading-none">Import Failed</p>
                                    <p className="text-sm text-red-500/70 font-medium">{error}</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-10 pt-12 border-t border-white/10">
                            <div className="bg-primary/5 border border-primary/10 rounded-3xl p-8 text-primary/80 leading-relaxed font-medium">
                                <span className="font-black flex items-center gap-3 mb-4 text-primary"><AlertCircle className="w-5 h-5" /> Importer Scope:</span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                    <div className="space-y-2">
                                        <p className="font-bold text-primary">• Static HTML + CSS + JS</p>
                                        <p className="font-bold text-primary">• External CDN Libraries</p>
                                        <p className="font-bold text-primary">• Google Fonts & Icons</p>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="font-bold text-primary">Not Supported (yet):</p>
                                        <p>• React, Vue, Svelte</p>
                                        <p>• TypeScript/SCSS (raw only)</p>
                                        <p>• Server-side code</p>
                                    </div>
                                </div>
                                <p className="text-xs mt-6 opacity-60 italic">Webflow limits still apply &mdash; complex logic remains as custom code.</p>
                            </div>

                            <div className="flex justify-between items-center">
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        setImportSource('html');
                                        setImportType('single');
                                        setProjectName("");
                                        setSelectedFile(null);
                                        setHtmlText("");
                                        setCssText("");
                                        setJsText("");
                                    }}
                                    className="text-muted-foreground font-black hover:bg-slate-500/5 rounded-2xl px-12 h-16 text-lg"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className="bg-primary text-primary-foreground hover:opacity-90 shadow-2xl shadow-primary/20 premium-hover px-16 h-20 rounded-2xl font-black text-2xl transition-all active:scale-95 disabled:opacity-50 btn-premium"
                                >
                                    {isImporting ? <Loader2 className="w-8 h-8 mr-4 animate-spin" /> : <>Import Project <ArrowRight className="w-8 h-8 ml-4" /></>}
                                </Button>
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function LibrariesEditor({
    cssUrls,
    setCssUrls,
    jsUrls,
    setJsUrls,
    libraryMessages = [],
}: {
    cssUrls: string[];
    setCssUrls: (value: string[]) => void;
    jsUrls: string[];
    setJsUrls: (value: string[]) => void;
    libraryMessages?: ValidationMessage[];
}) {
    const renderMessages = (messages: ValidationMessage[]) => {
        if (messages.length === 0) return null;
        return (
            <div className="space-y-1 mb-4">
                {messages.map((message) => (
                    <div key={`${message.code}-${message.title}`} className="text-[11px] font-semibold text-muted-foreground">
                        <span className={message.severity === 'block' ? 'text-red-500' : message.severity === 'warn' ? 'text-amber-500' : 'text-foreground/70'}>
                            {message.title}
                        </span>
                        {message.detail ? <span className="text-muted-foreground/70"> — {message.detail}</span> : null}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 px-1">
                <h3 className="text-sm font-black text-foreground uppercase tracking-[0.2em]">Libraries (external URLs)</h3>
                <div className="h-px flex-1 bg-white/10" />
            </div>
            <p className="text-xs text-muted-foreground px-1 -mt-4 font-medium leading-relaxed">Paste the CDN links your project depends on. These stay as external includes.</p>
            {renderMessages(libraryMessages)}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* CSS URLs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black text-foreground uppercase tracking-wider">CSS URLs</Label>
                            <p className="text-[10px] text-muted-foreground font-medium tracking-tight">Example: Google Fonts, resets, frameworks.</p>
                        </div>
                        <div className="flex gap-3">
                            {cssUrls.length > 0 && <button onClick={() => setCssUrls([])} className="text-[10px] font-black text-muted-foreground/40 hover:text-destructive transition-colors uppercase tracking-widest">Clear</button>}
                            <button onClick={() => setCssUrls([...cssUrls, ""])} className="text-[10px] font-black text-primary flex items-center gap-1 uppercase tracking-widest hover:opacity-80 transition-all"><Plus className="w-3 h-3" /> Add URL</button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {cssUrls.map((url: string, idx: number) => (
                            <div key={idx} className="flex gap-2 group">
                                <Input
                                    value={url}
                                    onChange={(e) => { const n = [...cssUrls]; n[idx] = e.target.value; setCssUrls(n); }}
                                    placeholder="https://fonts.googleapis.com/css2?..."
                                    className="h-11 text-xs font-mono bg-slate-500/5 border-white/10 ring-1 ring-white/5 rounded-xl px-4 focus:ring-primary shadow-inner"
                                />
                                <Button variant="ghost" size="icon" className="shrink-0 hover:bg-destructive/10 hover:text-destructive rounded-xl w-11 h-11" onClick={() => setCssUrls(cssUrls.filter((_, i) => i !== idx))}><X className="w-4 h-4" /></Button>
                            </div>
                        ))}
                        {cssUrls.length === 0 && <div className="border border-dashed border-white/10 rounded-2xl py-6 text-center text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest backdrop-blur-sm bg-white/[0.02]">No external CSS</div>}
                    </div>
                </div>
                {/* JS URLs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black text-foreground uppercase tracking-wider">JS URLs</Label>
                            <p className="text-[10px] text-muted-foreground font-medium tracking-tight">Example: GSAP, SplitText, Swiper.</p>
                        </div>
                        <div className="flex gap-3">
                            {jsUrls.length > 0 && <button onClick={() => setJsUrls([])} className="text-[10px] font-black text-muted-foreground/40 hover:text-destructive transition-colors uppercase tracking-widest">Clear</button>}
                            <button onClick={() => setJsUrls([...jsUrls, ""])} className="text-[10px] font-black text-primary flex items-center gap-1 uppercase tracking-widest hover:opacity-80 transition-all"><Plus className="w-3 h-3" /> Add URL</button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {jsUrls.map((url: string, idx: number) => (
                            <div key={idx} className="flex gap-2 group">
                                <Input
                                    value={url}
                                    onChange={(e) => { const n = [...jsUrls]; n[idx] = e.target.value; setJsUrls(n); }}
                                    placeholder="https://cdn.jsdelivr.net/npm/gsap@3/..."
                                    className="h-11 text-xs font-mono bg-slate-500/5 border-white/10 ring-1 ring-white/5 rounded-xl px-4 focus:ring-primary shadow-inner"
                                />
                                <Button variant="ghost" size="icon" className="shrink-0 hover:bg-destructive/10 hover:text-destructive rounded-xl w-11 h-11" onClick={() => setJsUrls(jsUrls.filter((_, i) => i !== idx))}><X className="w-4 h-4" /></Button>
                            </div>
                        ))}
                        {jsUrls.length === 0 && <div className="border border-dashed border-white/10 rounded-2xl py-6 text-center text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest backdrop-blur-sm bg-white/[0.02]">No external JS</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MultiFileEditor({
    htmlText,
    setHtmlText,
    cssText,
    setCssText,
    jsText,
    setJsText,
    htmlMessages = [],
    cssMessages = [],
    jsMessages = [],
}: {
    htmlText: string;
    setHtmlText: (value: string) => void;
    cssText: string;
    setCssText: (value: string) => void;
    jsText: string;
    setJsText: (value: string) => void;
    htmlMessages?: ValidationMessage[];
    cssMessages?: ValidationMessage[];
    jsMessages?: ValidationMessage[];
}) {
    const renderMessages = (messages: ValidationMessage[]) => {
        if (messages.length === 0) return null;
        return (
            <div className="space-y-1">
                {messages.map((message) => (
                    <div key={`${message.code}-${message.title}`} className="text-[11px] font-semibold text-muted-foreground">
                        <span className={message.severity === 'block' ? 'text-red-500' : message.severity === 'warn' ? 'text-amber-500' : 'text-foreground/70'}>
                            {message.title}
                        </span>
                        {message.detail ? <span className="text-muted-foreground/70"> — {message.detail}</span> : null}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 px-1">
                <h3 className="text-sm font-black text-foreground uppercase tracking-[0.2em]">Live Editor</h3>
                <div className="h-px flex-1 bg-white/10" />
            </div>

            <Tabs defaultValue="html" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-slate-500/5 border border-white/10 ring-1 ring-white/5 p-1 h-16 rounded-2xl mb-8 max-w-4xl mx-auto shadow-inner">
                    <TabsTrigger value="html" className="rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20"><Code2 className="w-5 h-5" /> HTML</TabsTrigger>
                    <TabsTrigger value="css" className="rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20"><Palette className="w-5 h-5" /> CSS</TabsTrigger>
                    <TabsTrigger value="js" className="rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg shadow-primary/20"><Zap className="w-5 h-5" /> JavaScript</TabsTrigger>
                </TabsList>

                <TabsContent value="html" className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                            <Label className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                <Code2 className="w-4 h-4 text-primary" /> HTML
                            </Label>
                            <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest">{htmlText.length.toLocaleString()} CHARS</span>
                        </div>
                        {renderMessages(htmlMessages)}
                        <Textarea
                            value={htmlText}
                            onChange={(e) => setHtmlText(e.target.value)}
                            placeholder="<!-- Paste HTML here -->"
                            className="min-h-[700px] font-mono text-base bg-slate-500/5 text-foreground border-white/10 ring-1 ring-white/5 rounded-[40px] p-10 leading-relaxed focus:ring-primary/20 shadow-inner resize-none w-full"
                        />
                    </div>
                </TabsContent>

                <TabsContent value="css" className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                            <Label className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                <Palette className="w-4 h-4 text-primary" /> CSS
                            </Label>
                            <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest">{cssText.length.toLocaleString()} CHARS</span>
                        </div>
                        {renderMessages(cssMessages)}
                        <Textarea
                            value={cssText}
                            onChange={(e) => setCssText(e.target.value)}
                            placeholder="/* Paste CSS here */"
                            className="min-h-[700px] font-mono text-base bg-slate-500/5 text-foreground border-white/10 ring-1 ring-white/5 rounded-[40px] p-10 leading-relaxed focus:ring-primary/20 shadow-inner resize-none w-full"
                        />
                    </div>
                </TabsContent>

                <TabsContent value="js" className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="space-y-3">
                        <div className="flex justify-between items-end px-1">
                            <Label className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                <Zap className="w-4 h-4 text-primary" /> JavaScript
                            </Label>
                            <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest">{jsText.length.toLocaleString()} CHARS</span>
                        </div>
                        {renderMessages(jsMessages)}
                        <Textarea
                            value={jsText}
                            onChange={(e) => setJsText(e.target.value)}
                            placeholder="// Paste JS here"
                            className="min-h-[700px] font-mono text-base bg-slate-500/5 text-foreground border-white/10 ring-1 ring-white/5 rounded-[40px] p-10 leading-relaxed focus:ring-primary/20 shadow-inner resize-none w-full"
                        />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
