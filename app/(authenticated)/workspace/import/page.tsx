
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadCloud, ArrowRight } from "lucide-react";
import Link from 'next/link';

import { useState, useEffect, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, FileText, Files, CheckCircle2, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { processProjectImport, ProcessingStage } from "@/lib/project-engine";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ImportPage() {
    const router = useRouter();
    const importMutation = useMutation(api.import.importProject);

    const [importType, setImportType] = useState<'single' | 'multi'>('single');
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentStageLabel, setCurrentStageLabel] = useState("INITIALIZING");
    const [error, setError] = useState<string | null>(null);
    const [isDone, setIsDone] = useState(false);
    const [newProjectId, setNewProjectId] = useState<string | null>(null);
    const [projectName, setProjectName] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (file: File) => {
        const validTypes = ['text/html', 'application/zip', 'application/x-zip-compressed'];
        const isValidType = validTypes.includes(file.type) || file.name.endsWith('.html') || file.name.endsWith('.zip');

        if (!isValidType) {
            setError('Please upload an HTML file or ZIP archive');
            setSelectedFile(null);
            return;
        }

        setSelectedFile(file);
        // Auto-populate project name if empty
        if (!projectName && file.name) {
            setProjectName(file.name.replace(/\.html$/i, '').replace(/[-_]/g, ' '));
        }
        setError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleImport = async () => {
        if (!selectedFile) {
            setError('Please select a file to import');
            return;
        }

        if (selectedFile.type.includes("zip") || selectedFile.name.toLowerCase().endsWith(".zip")) {
            setError("ZIP archives are not supported yet. Please upload a single HTML file.");
            return;
        }

        if (!projectName.trim()) {
            setError('Please enter a project name');
            return;
        }

        setIsImporting(true);
        setError(null);
        setProgress(0);

        try {
            // Read file content
            const reader = new FileReader();
            const fileContent = await new Promise<string>((resolve, reject) => {
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = (e) => reject(new Error("Failed to read file"));
                reader.readAsText(selectedFile);
            });

            // Process with engine
            const result = await processProjectImport(
                fileContent,
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
                sourceHtml: fileContent,
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
        } catch (err: any) {
            console.error("Import error:", err);
            setError(err.message || "An unexpected error occurred during import");
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
                    <p className="text-slate-500">Your project "{projectName}" is ready and converted.</p>
                </div>
                <Link href={`/workspace/projects/${newProjectId}`}>
                    <Button className="bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200/50 px-12 h-14 rounded-2xl font-bold text-lg">
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
                <p className="text-slate-500 text-lg">Transform your legacy code into high-performance components.</p>
            </div>

            <div className="bg-white/90 backdrop-blur-xl rounded-[32px] border border-slate-200 overflow-hidden shadow-2xl p-8 relative">
                {isImporting && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-12 text-center animate-in fade-in duration-300">
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
                    <div className="flex justify-center">
                        <div className="bg-slate-100/80 backdrop-blur p-1.5 rounded-2xl inline-flex gap-1 shadow-inner">
                            <button
                                onClick={() => setImportType('single')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${importType === 'single' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <FileText className="w-4 h-4" /> Single File
                            </button>
                            <button
                                onClick={() => setImportType('multi')}
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${importType === 'multi' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <Files className="w-4 h-4" /> Multi-File
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                        <div className="space-y-3">
                            <Label htmlFor="projectName" className="text-slate-700 font-bold ml-1">Project Name</Label>
                            <Input
                                id="projectName"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                placeholder="e.g. Marketing Site Q1"
                                className="h-12 rounded-xl border-slate-200 focus:ring-blue-500 focus:border-blue-500 font-medium"
                            />
                        </div>

                        {importType === 'single' ? (
                            <div className="space-y-4">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".html,.zip"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div
                                    onClick={handleUploadClick}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-16 text-center group hover:shadow-xl transition-all cursor-pointer ${isDragging
                                            ? 'border-blue-500 bg-blue-50/50'
                                            : selectedFile
                                                ? 'border-emerald-300 bg-emerald-50/50'
                                                : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-400'
                                        }`}
                                >
                                    <div className={`w-20 h-20 rounded-[24px] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm ${selectedFile ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                                        }`}>
                                        {selectedFile ? (
                                            <CheckCircle2 className="w-10 h-10" />
                                        ) : (
                                            <UploadCloud className="w-10 h-10" />
                                        )}
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-900 mb-2">
                                        {selectedFile ? selectedFile.name : 'Upload HTML Bundle'}
                                    </h4>
                                    <p className="text-slate-500 text-sm max-w-[280px] leading-relaxed">
                                        {selectedFile
                                            ? `${(selectedFile.size / 1024).toFixed(1)} KB • Click to change`
                                            : 'Drag your single HTML file containing CSS and JS, or a ZIP archive.'
                                        }
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 opacity-75">
                                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center bg-slate-50/50">
                                    <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-[24px] flex items-center justify-center mb-6 shadow-inner">
                                        <Files className="w-10 h-10" />
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-400 mb-2">Multi-File Coming Soon</h4>
                                    <p className="text-slate-400 text-sm max-w-[280px] leading-relaxed italic">
                                        Currently only supporting single-file bundles. Full project support is in the roadmap.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
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
                            <p className="mb-3">Supports single-page HTML with CSS & JavaScript only. No React, TypeScript, or Tailwind elements currently allowed.</p>
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                            <Button
                                variant="ghost"
                                onClick={() => {
                                    setSelectedFile(null);
                                    setProjectName("");
                                    setError(null);
                                }}
                                className="text-slate-500 font-bold hover:bg-slate-50 rounded-xl px-8"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={importType === 'multi' || !selectedFile || isImporting}
                                className="bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-200/50 px-12 h-14 rounded-2xl font-bold text-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isImporting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        Import Project <ArrowRight className="w-5 h-5 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
