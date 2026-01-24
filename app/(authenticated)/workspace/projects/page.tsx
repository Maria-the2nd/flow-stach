"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Plus, Loader2, FolderOpen, Trash2, ImageIcon, Layers } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function getStatusDisplay(status: string): { label: string; color: string } {
    switch (status) {
        case 'complete':
            return { label: 'Ready', color: 'bg-green-500' };
        case 'draft':
            return { label: 'Draft', color: 'bg-amber-500' };
        default:
            return { label: status, color: 'bg-slate-400' };
    }
}

// Maximum file size: 2MB (Convex recommends keeping files small)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export default function ProjectsPage() {
    const projects = useQuery(api.projects.listMine);
    const generateUploadUrl = useMutation(api.projects.generateThumbnailUploadUrl);
    const updateThumbnail = useMutation(api.projects.updateThumbnail);
    const deleteProject = useMutation(api.projects.deleteProject);
    const deleteAllProjects = useMutation(api.projects.deleteAllMyProjects);

    const [uploadingProjectId, setUploadingProjectId] = useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
    const [isDeletingAll, setIsDeletingAll] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentProjectIdRef = useRef<string | null>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentProjectIdRef.current) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error("Please select an image file");
            return;
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            toast.error("Image too large", {
                description: "Please select an image smaller than 2MB"
            });
            return;
        }

        const projectId = currentProjectIdRef.current;
        setUploadingProjectId(projectId);

        try {
            // Get upload URL
            const uploadUrl = await generateUploadUrl();

            // Upload the file
            const response = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
            });

            if (!response.ok) {
                throw new Error("Upload failed");
            }

            const { storageId } = await response.json();

            // Save to project
            await updateThumbnail({
                projectId: projectId as Id<"importProjects">,
                storageId,
            });

            toast.success("Thumbnail uploaded!");
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to upload thumbnail");
        } finally {
            setUploadingProjectId(null);
            currentProjectIdRef.current = null;
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleUploadClick = (projectId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        currentProjectIdRef.current = projectId;
        fileInputRef.current?.click();
    };

    const handleDeleteClick = (projectId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowDeleteConfirm(projectId);
    };

    const handleConfirmDelete = async (projectId: string) => {
        setDeletingProjectId(projectId);
        setShowDeleteConfirm(null);

        try {
            await deleteProject({ projectId: projectId as Id<"importProjects"> });
            toast.success("Project deleted");
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete project");
        } finally {
            setDeletingProjectId(null);
        }
    };

    const handleClearAll = async () => {
        setIsDeletingAll(true);
        setShowClearAllConfirm(false);

        try {
            const result = await deleteAllProjects();
            toast.success(`Cleared all projects`, {
                description: `Deleted ${result.deletedProjects} projects, ${result.deletedAssets} components, and ${result.deletedArtifacts} artifacts`
            });
        } catch (error) {
            console.error("Clear all error:", error);
            toast.error("Failed to clear all projects");
        } finally {
            setIsDeletingAll(false);
        }
    };

    // Loading state
    if (projects === undefined) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
                    <Link href="/workspace/import">
                        <Button className="bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-lg shadow-blue-200/50">
                            <Plus className="w-4 h-4 mr-2" />
                            Import Project
                        </Button>
                    </Link>
                </div>
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            </div>
        );
    }

    // Empty state
    if (projects.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
                    <Link href="/workspace/import">
                        <Button className="bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-lg shadow-blue-200/50">
                            <Plus className="w-4 h-4 mr-2" />
                            Import Project
                        </Button>
                    </Link>
                </div>
                <div className="flex flex-col items-center justify-center h-64 bg-white/80 backdrop-blur-xl rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50">
                    <FolderOpen className="w-16 h-16 text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No projects yet</h3>
                    <p className="text-slate-500 mb-6 text-center max-w-md">
                        Import your first HTML project to get started with Webflow conversion.
                    </p>
                    <Link href="/workspace/import">
                        <Button className="bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-lg shadow-blue-200/50 px-8">
                            <Plus className="w-4 h-4 mr-2" />
                            Import Project
                        </Button>
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
            />

            {/* Delete confirmation modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Project?</h3>
                        <p className="text-slate-500 mb-6">
                            This will permanently delete the project, all its components, and associated data. This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setShowDeleteConfirm(null)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={() => handleConfirmDelete(showDeleteConfirm)}
                            >
                                Delete Project
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear all confirmation modal */}
            {showClearAllConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-red-600 mb-2">Clear All Projects?</h3>
                        <p className="text-slate-500 mb-4">
                            This will permanently delete <strong>ALL {projects?.length} projects</strong>, their components, artifacts, and associated data.
                        </p>
                        <p className="text-red-600 font-bold text-sm mb-6">
                            This action cannot be undone!
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setShowClearAllConfirm(false)}
                                disabled={isDeletingAll}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleClearAll}
                                disabled={isDeletingAll}
                            >
                                {isDeletingAll ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Clearing...
                                    </>
                                ) : (
                                    "Clear All Projects"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects</h1>
                <div className="flex gap-3">
                    {projects && projects.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={() => setShowClearAllConfirm(true)}
                            disabled={isDeletingAll}
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 font-bold"
                        >
                            {isDeletingAll ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Clearing...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Clear All
                                </>
                            )}
                        </Button>
                    )}
                    <Link href="/workspace/import">
                        <Button className="bg-blue-600 text-white hover:bg-blue-700 font-bold shadow-lg shadow-blue-200/50">
                            <Plus className="w-4 h-4 mr-2" />
                            Import Project
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {projects.map((project) => {
                    const statusDisplay = getStatusDisplay(project.status);
                    const isUploading = uploadingProjectId === project._id;
                    const isDeleting = deletingProjectId === project._id;

                    return (
                        <div key={project._id} className="relative group">
                            {/* Action buttons overlay */}
                            <div className="absolute top-4 left-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleUploadClick(project._id, e)}
                                    disabled={isUploading}
                                    className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur shadow-lg flex items-center justify-center hover:bg-white transition-colors disabled:opacity-50"
                                    title="Upload thumbnail"
                                >
                                    {isUploading ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    ) : (
                                        <ImageIcon className="w-4 h-4 text-slate-600" />
                                    )}
                                </button>
                                <button
                                    onClick={(e) => handleDeleteClick(project._id, e)}
                                    disabled={isDeleting}
                                    className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur shadow-lg flex items-center justify-center hover:bg-red-50 transition-colors disabled:opacity-50"
                                    title="Delete project"
                                >
                                    {isDeleting ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                                    ) : (
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    )}
                                </button>
                            </div>

                            <Link href={`/workspace/projects/${project._id}`} className="block">
                                <div className="!bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-slate-300 transition-all duration-300 flex flex-col h-full shadow-xl shadow-slate-200/50">
                                    <div className="aspect-video bg-gradient-to-br from-slate-50 to-slate-100 relative overflow-hidden flex items-center justify-center">
                                        {project.thumbnailUrl ? (
                                            <Image
                                                src={project.thumbnailUrl}
                                                alt={project.name}
                                                fill
                                                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="text-6xl font-bold text-slate-200 group-hover:scale-110 transition-transform duration-500">
                                                {project.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-slate-900 px-3 py-1 rounded-full text-[10px] font-bold shadow-sm tracking-wider uppercase flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusDisplay.color}`} />
                                            {statusDisplay.label}
                                        </div>
                                    </div>
                                    <div className="p-6 flex flex-col flex-grow">
                                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight mb-2">
                                            {project.name}
                                        </h3>
                                        <p className="text-slate-500 text-sm mb-6 flex-grow leading-relaxed">
                                            {project.classCount ? `${project.classCount} classes extracted` : 'HTML project ready for Webflow'}
                                        </p>

                                        <div className="space-y-2 mb-6 text-xs text-slate-400 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5" />
                                                Imported on {formatDate(project._creationTime)}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Layers className="w-3.5 h-3.5" />
                                                {project.componentCount || 0} Extracted Components
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-sm text-blue-600 font-bold group-hover:translate-x-1 transition-transform">
                                            <span>Inspect Project</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
