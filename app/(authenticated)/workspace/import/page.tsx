
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
    History
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { useState, useRef, useEffect, Suspense } from "react";
import { Progress } from "@/components/ui/progress";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { processProjectImport } from "@/lib/project-engine";
import { toast } from "sonner";

// Main component with Suspense boundary
export default function ImportPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        }>
            <ImportForm />
        </Suspense>
    );
}

function ImportForm() {
    const searchParams = useSearchParams();
    const importMutation = useMutation(api.import.importProject);

    // Main Import Source: 'html' | 'codepen'
    const [importSource, setImportSource] = useState<'html' | 'codepen'>('html');

    // HTML Sub-types: 'single' | 'multi'
    const [importType, setImportType] = useState<'single' | 'multi'>('single');

    // CodePen States
    const [codepenUrl, setCodepenUrl] = useState("");
    const [isFetching, setIsFetching] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);

    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStageLabel, setCurrentStageLabel] = useState("INITIALIZING");
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

    const handleFetchCodePen = () => {
        if (!codepenUrl.includes('codepen.io')) {
            toast.error("Invalid URL", { description: "Please enter a valid CodePen URL" });
            return;
        }

        setIsFetching(true);
        toast.info("Fetch wiring next. UI first, chaos later.");

        // Stubbed population after 1.5s
        setTimeout(() => {
            setIsFetching(false);
            setHasFetched(true);
            setHtmlText("<!-- CodePen HTML will appear here -->\n<div class='pen-root'>\n  <h1>Imported from Pen</h1>\n</div>");
            setCssText("/* CodePen CSS */\n.pen-root {\n  color: #3b82f6;\n}");
            setJsText("// CodePen JS\nconsole.log('Pen loaded');");

            if (!projectName) {
                const parts = codepenUrl.split('/');
                const slug = parts[parts.length - 1] || "Pen";
                setProjectName(`[CodePen] ${slug}`);
            }
        }, 1500);
    };

    const handleImport = async () => {
        if (!projectName.trim()) {
            toast.error('Please enter a project name');
            return;
        }

        if (importSource === 'html' && importType === 'single' && !selectedFile) {
            toast.error('Please select a file to import');
            return;
        }

        if ((importSource === 'codepen' || (importSource === 'html' && importType === 'multi')) && !htmlText) {
            toast.error('HTML content is required');
            return;
        }

        setIsImporting(true);
        setError(null);
        setProgress(0);

        try {
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

            // Process with engine
            const result = await processProjectImport(
                finalHtml,
                projectName,
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
            <div className="max-w-2xl mx-auto py-24 px-6 text-center space-y-8">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100 animate-in zoom-in duration-500">
                    <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Import Successful</h1>
                    <p className="text-slate-500">Your project &ldquo;{projectName}&rdquo; is ready and converted.</p>
                </div>
                <Link href={`/workspace/projects/${newProjectId}`}>
                    <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200/50 premium-hover px-12 h-14 rounded-2xl font-bold text-lg">
                        View Project <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-12 px-6">
            <div className="mb-8 text-center space-y-4">
                <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Import Project</h1>
                <p className="text-slate-500 text-lg">
                    {importSource === 'html'
                        ? (importType === 'single' ? "Transform your legacy code into high-performance components." : "Import your HTML + CSS + JS (separately).")
                        : "Import your HTML + CSS + JS from CodePen."
                    }
                </p>
                {importSource === 'codepen' && (
                    <p className="text-slate-400 text-sm max-w-lg mx-auto italic">
                        Paste a public CodePen link. We&rsquo;ll pull HTML + CSS + JS + external resources (fetch wiring next).
                    </p>
                )}
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-[32px] border border-slate-200 overflow-hidden shadow-2xl p-8 relative">
                {isImporting && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
                        <div className="w-full max-w-sm space-y-8">
                            <div className="space-y-4">
                                <h3 className="text-2xl font-bold text-slate-900">Importing Project...</h3>
                                <p className="text-slate-500 text-sm">Analyzing code architecture and mapping semantic elements.</p>
                            </div>
                            <div className="space-y-2">
                                <Progress value={progress} className="h-3 bg-slate-100 [&>div]:bg-blue-600 rounded-full shadow-inner" />
                                <div className="flex justify-between text-xs font-bold text-blue-600 tracking-wider">
                                    <span>{Math.round(progress)}% COMPLETE</span>
                                    <span>{currentStageLabel}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-10">
                    {/* Top Source Toggle */}
                    <div className="flex justify-center">
                        <div className="bg-slate-100/80 backdrop-blur p-1.5 rounded-2xl inline-flex gap-1 shadow-inner">
                            <button
                                onClick={() => setImportSource('html')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${importSource === 'html' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <FileText className="w-4 h-4" /> HTML Bundle
                            </button>
                            <button
                                onClick={() => setImportSource('codepen')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${importSource === 'codepen' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <Files className="w-4 h-4" /> CodePen
                            </button>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {/* Project Name Field */}
                        <div className="space-y-3">
                            <Label htmlFor="projectName" className="text-slate-700 font-bold ml-1">Project Name</Label>
                            <Input
                                id="projectName"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="e.g. Osmo Loader, Client Site v2"
                                className="h-12 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 font-medium"
                            />
                            <p className="text-[10px] text-slate-400 font-medium ml-1">Give it a name you&rsquo;ll recognize later (e.g. &ldquo;Osmo Loader&rdquo;, &ldquo;Client Site v2&rdquo;).</p>
                        </div>

                        {importSource === 'html' ? (
                            <div className="space-y-8">
                                {/* HTML Sub-toggle */}
                                <div className="flex justify-center">
                                    <div className="bg-slate-50 border border-slate-100 p-1 rounded-xl flex gap-1">
                                        <button
                                            onClick={() => setImportType('single')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${importType === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Single File
                                        </button>
                                        <button
                                            onClick={() => setImportType('multi')}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${importType === 'multi' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
                                            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-16 text-center group hover:bg-slate-50/50 transition-all cursor-pointer ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-slate-50/50'}`}
                                        >
                                            <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm ${selectedFile ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {selectedFile ? <CheckCircle2 className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
                                            </div>
                                            <h4 className="text-xl font-bold text-slate-900 mb-2">{selectedFile ? selectedFile.name : 'Upload HTML Bundle'}</h4>
                                            <p className="text-slate-500 text-sm max-w-[280px]">Drag your single HTML file containing CSS and JS.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <MultiFileEditor
                                        htmlText={htmlText} setHtmlText={setHtmlText}
                                        cssText={cssText} setCssText={setCssText}
                                        jsText={jsText} setJsText={setJsText}
                                        cssUrls={cssUrls} setCssUrls={setCssUrls}
                                        jsUrls={jsUrls} setJsUrls={setJsUrls}
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                {/* CodePen URL Input */}
                                <div className="space-y-3">
                                    <Label className="text-slate-700 font-bold ml-1">CodePen URL</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={codepenUrl}
                                            onChange={(e) => setCodepenUrl(e.target.value)}
                                            placeholder="https://codepen.io/osmosupply/pen/RNaeYqp"
                                            className="h-12 rounded-xl border-slate-200 focus:ring-blue-500 font-medium"
                                        />
                                        <Button
                                            onClick={handleFetchCodePen}
                                            disabled={isFetching || !codepenUrl}
                                            className="h-12 px-8 bg-slate-900 text-white hover:bg-black rounded-xl font-bold disabled:opacity-50"
                                        >
                                            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                                        </Button>
                                    </div>
                                </div>

                                {/* Collapsed/Disabled Multi-File Editor as "Review & Edit" */}
                                <div className={`transition-all duration-500 ${hasFetched ? 'opacity-100 scale-100' : 'opacity-50 blur-[1px]'}`}>
                                    <div className="flex items-center gap-3 mb-6 px-1">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs shadow-inner">2</div>
                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Review & Edit (HTML + CSS + JS)</h3>
                                        <div className="h-px flex-1 bg-slate-100" />
                                    </div>

                                    <div className={!hasFetched ? "pointer-events-none" : ""}>
                                        <MultiFileEditor
                                            htmlText={htmlText} setHtmlText={setHtmlText}
                                            cssText={cssText} setCssText={setCssText}
                                            jsText={jsText} setJsText={setJsText}
                                            cssUrls={cssUrls} setCssUrls={setCssUrls}
                                            jsUrls={jsUrls} setJsUrls={setJsUrls}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in duration-300">
                            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-bold text-red-900">Import Failed</p>
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-6">
                        <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 text-sm text-blue-800 leading-relaxed font-medium">
                            <span className="font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4" /> Importer Scope:</span>
                            <div className="space-y-1">
                                <p>Supports static HTML + CSS + JavaScript (plus external libraries).</p>
                                <p className="opacity-70">Not supported (yet): React/Vue, build tools, TypeScript, server code.</p>
                                <p className="text-xs mt-2 text-blue-600/70 italic">Webflow limits still apply &mdash; if something can&rsquo;t be represented as native elements, it becomes custom code.</p>
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setImportSource('html');
                                    setImportType('single');
                                    setProjectName("");
                                    setSelectedFile(null);
                                    setHasFetched(false);
                                    setHtmlText("");
                                    setCssText("");
                                    setJsText("");
                                }}
                                className="text-slate-500 font-bold hover:bg-slate-50 rounded-xl px-8"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={isImporting || (importSource === 'codepen' && !hasFetched)}
                                className="bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-200/50 premium-hover px-12 h-14 rounded-2xl font-bold text-lg transition-transform active:scale-95 disabled:opacity-50"
                            >
                                {isImporting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <>Import Project <ArrowRight className="w-5 h-5 ml-2" /></>}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MultiFileEditor({ htmlText, setHtmlText, cssText, setCssText, jsText, setJsText, cssUrls, setCssUrls, jsUrls, setJsUrls }: any) {
    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* Libraries Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 px-1">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Libraries (external URLs)</h3>
                    <div className="h-px flex-1 bg-slate-100" />
                </div>
                <p className="text-xs text-slate-500 px-1 -mt-4">Paste the CDN links your project depends on. We&rsquo;ll keep them as external includes, not inline bloat.</p>

                <div className="space-y-6">
                    {/* CSS URLs */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-slate-700">CSS URLs</Label>
                                <p className="text-[10px] text-slate-400 font-medium tracking-tight">One per row. Example: Slater, Google Fonts, resets, frameworks.</p>
                            </div>
                            <div className="flex gap-2">
                                {cssUrls.length > 0 && <button onClick={() => setCssUrls([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500">Clear all</button>}
                                <button onClick={() => setCssUrls([...cssUrls, ""])} className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add CSS URL</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {cssUrls.map((url: string, idx: number) => (
                                <div key={idx} className="flex gap-2">
                                    <Input
                                        value={url}
                                        onChange={(e) => { const n = [...cssUrls]; n[idx] = e.target.value; setCssUrls(n); }}
                                        placeholder="https://slater.app/10324/23333.css"
                                        className="h-10 text-sm bg-slate-50/50"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => setCssUrls(cssUrls.filter((_: any, i: number) => i !== idx))}><X className="w-4 h-4" /></Button>
                                </div>
                            ))}
                            {cssUrls.length === 0 && <div className="border border-dashed rounded-xl py-3 text-center text-[10px] text-slate-400 italic">No external CSS links added</div>}
                        </div>
                    </div>
                    {/* JS URLs */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <div className="space-y-0.5">
                                <Label className="text-xs font-bold text-slate-700">JS URLs</Label>
                                <p className="text-[10px] text-slate-400 font-medium tracking-tight">One per row. Example: GSAP, SplitText, Lenis, Swiper.</p>
                            </div>
                            <div className="flex gap-2">
                                {jsUrls.length > 0 && <button onClick={() => setJsUrls([])} className="text-[10px] font-bold text-slate-400 hover:text-red-500">Clear all</button>}
                                <button onClick={() => setJsUrls([...jsUrls, ""])} className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Plus className="w-3 h-3" /> Add JS URL</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {jsUrls.map((url: string, idx: number) => (
                                <div key={idx} className="flex gap-2">
                                    <Input
                                        value={url}
                                        onChange={(e) => { const n = [...jsUrls]; n[idx] = e.target.value; setJsUrls(n); }}
                                        placeholder="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"
                                        className="h-10 text-sm bg-slate-50/50"
                                    />
                                    <Button variant="ghost" size="icon" onClick={() => setJsUrls(jsUrls.filter((_: any, i: number) => i !== idx))}><X className="w-4 h-4" /></Button>
                                </div>
                            ))}
                            {jsUrls.length === 0 && <div className="border border-dashed rounded-xl py-3 text-center text-[10px] text-slate-400 italic">No external JS links added</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Source Code Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-2 px-1">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Source Code</h3>
                    <div className="h-px flex-1 bg-slate-100" />
                </div>

                <Tabs defaultValue="html" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-slate-100/50 p-1 h-12 rounded-xl mb-4">
                        <TabsTrigger value="html" className="rounded-lg font-bold flex items-center gap-2"><Code2 className="w-3.5 h-3.5" /> HTML</TabsTrigger>
                        <TabsTrigger value="css" className="rounded-lg font-bold flex items-center gap-2"><Palette className="w-3.5 h-3.5" /> CSS</TabsTrigger>
                        <TabsTrigger value="js" className="rounded-lg font-bold flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> JavaScript</TabsTrigger>
                    </TabsList>

                    <TabsContent value="html" className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end px-1">
                                <Label className="text-sm font-bold text-slate-700">HTML (required)</Label>
                                <span className="text-[10px] font-bold text-slate-400">{htmlText.length.toLocaleString()} chars</span>
                            </div>
                            <Textarea value={htmlText} onChange={(e) => setHtmlText(e.target.value)} placeholder="<!-- Paste HTML here -->" className="min-h-[240px] font-mono text-xs bg-slate-50/50 rounded-xl" />
                        </div>
                    </TabsContent>
                    <TabsContent value="css" className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end px-1">
                                <Label className="text-sm font-bold text-slate-700">CSS (optional)</Label>
                                <span className="text-[10px] font-bold text-slate-400">{cssText.length.toLocaleString()} chars</span>
                            </div>
                            <Textarea value={cssText} onChange={(e) => setCssText(e.target.value)} placeholder="/* Paste CSS here */" className="min-h-[240px] font-mono text-xs bg-slate-50/50 rounded-xl" />
                        </div>
                    </TabsContent>
                    <TabsContent value="js" className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                            <div className="flex justify-between items-end px-1">
                                <Label className="text-sm font-bold text-slate-700">JavaScript (optional)</Label>
                                <span className="text-[10px] font-bold text-slate-400">{jsText.length.toLocaleString()} chars</span>
                            </div>
                            <Textarea value={jsText} onChange={(e) => setJsText(e.target.value)} placeholder="// Paste JS here" className="min-h-[240px] font-mono text-xs bg-slate-50/50 rounded-xl" />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
