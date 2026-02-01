"use client";

import { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Search, Loader2, Trash2, ImageIcon } from "lucide-react";
import Link from 'next/link';
import Image from "next/image";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";

// Maximum file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export default function TemplatesPage() {
    const assets = useQuery(api.assets.list, { category: "templates" });
    const generateUploadUrl = useMutation(api.assets.generateThumbnailUploadUrl);
    const updateThumbnail = useMutation(api.assets.updateThumbnail);
    const deleteAsset = useMutation(api.assets.deleteById);

    const [searchQuery, setSearchQuery] = useState("");
    const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null);
    const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const currentAssetIdRef = useRef<string | null>(null);

    // Filter assets by search query
    const filteredAssets = assets?.filter((asset) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            asset.title.toLowerCase().includes(query) ||
            asset.description?.toLowerCase().includes(query) ||
            asset.tags?.some((tag) => tag.toLowerCase().includes(query))
        );
    });

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentAssetIdRef.current) return;

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

        const assetId = currentAssetIdRef.current;
        setUploadingAssetId(assetId);

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

            // Save to asset
            await updateThumbnail({
                assetId: assetId as Id<"assets">,
                storageId,
            });

            toast.success("Thumbnail uploaded!");
        } catch (error) {
            console.error("Upload error:", error);
            toast.error("Failed to upload thumbnail");
        } finally {
            setUploadingAssetId(null);
            currentAssetIdRef.current = null;
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleUploadClick = (assetId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        currentAssetIdRef.current = assetId;
        fileInputRef.current?.click();
    };

    const handleDeleteClick = (assetId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setShowDeleteConfirm(assetId);
    };

    const handleConfirmDelete = async (assetId: string) => {
        setDeletingAssetId(assetId);
        setShowDeleteConfirm(null);

        try {
            await deleteAsset({ assetId: assetId as Id<"assets"> });
            toast.success("Template deleted");
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Failed to delete template");
        } finally {
            setDeletingAssetId(null);
        }
    };

    return (
        <div className="space-y-8">
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
                    <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border">
                        <h3 className="text-xl font-bold text-foreground mb-2">Delete Template?</h3>
                        <p className="text-muted-foreground mb-6">
                            This will permanently delete the template and its associated data. This action cannot be undone.
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
                                Delete Template
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Templates Library</h1>
                    <p className="text-muted-foreground mt-1">Your imported templates ready to copy to Webflow.</p>
                </div>
            </div>

            <div className="flex items-center gap-4 bg-accent/20 backdrop-blur border border-border/50 rounded-2xl p-4 shadow-sm">
                <Search className="w-5 h-5 text-muted-foreground ml-2" />
                <input
                    type="text"
                    placeholder="Search your library..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full placeholder:text-muted-foreground/60 text-foreground"
                />
            </div>

            {/* Loading State */}
            {assets === undefined && (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            )}

            {/* Templates Grid */}
            {assets !== undefined && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredAssets?.map((asset) => {
                        const isUploading = uploadingAssetId === asset._id;
                        const isDeleting = deletingAssetId === asset._id;

                        return (
                            <div key={asset._id} className="relative group">
                                {/* Action buttons overlay */}
                                <div className="absolute top-4 left-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handleUploadClick(asset._id, e)}
                                        disabled={isUploading}
                                        className="w-8 h-8 rounded-lg bg-card/90 backdrop-blur shadow-lg flex items-center justify-center hover:bg-card transition-colors disabled:opacity-50"
                                        title="Upload thumbnail"
                                    >
                                        {isUploading ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        ) : (
                                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteClick(asset._id, e)}
                                        disabled={isDeleting}
                                        className="w-8 h-8 rounded-lg bg-card/90 backdrop-blur shadow-lg flex items-center justify-center hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                        title="Delete template"
                                    >
                                        {isDeleting ? (
                                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                                        ) : (
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        )}
                                    </button>
                                </div>

                                <div className="bg-card/80 backdrop-blur-xl rounded-[28px] border border-white/20 ring-1 ring-white/10 overflow-hidden hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500 flex flex-col h-full shadow-xl shadow-primary/5">
                                    <div className="aspect-video bg-accent/30 relative overflow-hidden">
                                        {asset.thumbnailUrl ? (
                                            <Image
                                                src={asset.thumbnailUrl}
                                                alt={asset.title}
                                                fill
                                                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <LayoutTemplate className="w-16 h-16 text-muted-foreground/30" />
                                            </div>
                                        )}
                                        {asset.isNew && (
                                            <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm tracking-wider uppercase">
                                                New
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-7 flex flex-col flex-grow">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors leading-tight">{asset.title}</h3>
                                        </div>
                                        <p className="text-muted-foreground text-sm mb-4 flex-grow leading-relaxed line-clamp-2">
                                            {asset.description || 'Imported from Webflow export'}
                                        </p>
                                        {asset.tags && asset.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                {asset.tags.slice(0, 3).map((tag) => (
                                                    <span key={tag} className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-accent/50 text-muted-foreground">
                                                        {tag}
                                                    </span>
                                                ))}
                                                {asset.tags.length > 3 && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-accent/50 text-muted-foreground">
                                                        +{asset.tags.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div className="pt-5 border-t border-border/50 flex items-center justify-between mt-auto">
                                            <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">{asset.category}</span>
                                            <Link href={`/workspace/projects/${asset._id}`}>
                                                <Button className="bg-primary hover:opacity-90 text-primary-foreground shadow-xl shadow-primary/20 font-bold px-6 h-10 rounded-xl transition-all text-xs btn-premium">
                                                    Use Template
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Empty State */}
                    {filteredAssets?.length === 0 && searchQuery && (
                        <div className="col-span-full text-center py-16">
                            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-foreground mb-2">No templates found</h3>
                            <p className="text-muted-foreground text-sm">Try adjusting your search query.</p>
                        </div>
                    )}

                    {/* Empty library state - no templates at all */}
                    {filteredAssets?.length === 0 && !searchQuery && (
                        <div className="col-span-full text-center py-16">
                            <LayoutTemplate className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-foreground mb-2">No templates yet</h3>
                            <p className="text-muted-foreground text-sm mb-4">Import a Webflow template to get started.</p>
                            <Link href="/workspace/import">
                                <Button className="bg-primary text-primary-foreground">
                                    Import Template
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
