"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Copy, ExternalLink, Filter, Download, Info, Upload, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  extractFilename,
  fetchImageAsBlob,
  canFetchImage,
  isLocalPath,
  downloadImage,
  uploadImageToConvex,
  getMimeType,
  MAX_IMAGE_SIZE,
} from "@/lib/image-uploader";

interface ImageValidation {
  url: string;
  type: string;
  estimatedSize?: number;
  sizeWarning: boolean;
  blocked: boolean;
  classification: string;
  hostedUrl?: string;
  hostedFilename?: string;
  storageId?: string;
}

interface ImagesGridProps {
  images?: ImageValidation[];
  projectId?: Id<"importProjects">;
  onImagesUpdated?: () => void;
}

type FilterType = 'all' | 'absolute' | 'relative' | 'data-uri' | 'oversized';

function formatBytes(bytes?: number): string {
  if (!bytes) return 'Unknown';

  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function ImagesGrid({ images, projectId, onImagesUpdated }: ImagesGridProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [uploadingUrls, setUploadingUrls] = useState<Set<string>>(new Set());
  const [downloadingUrls, setDownloadingUrls] = useState<Set<string>>(new Set());
  const [pendingUploadUrl, setPendingUploadUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convex mutations
  const generateUploadUrl = useMutation(api.images.generateUploadUrl);
  const registerHostedImage = useMutation(api.images.registerHostedImage);
  const updateProjectImage = useMutation(api.images.updateProjectImage);

  // Only show images, filter out other artifact types
  const allImages = images?.filter(img => img.type.toLowerCase().includes('image')) || [];

  // Apply filter
  const imageAssets = allImages.filter(img => {
    if (filter === 'all') return true;
    if (filter === 'absolute') return img.classification === 'absolute';
    if (filter === 'relative') return img.classification === 'relative';
    if (filter === 'data-uri') return img.classification === 'data-uri';
    if (filter === 'oversized') return (img.estimatedSize || 0) > 1024 * 1024;
    return true;
  });

  const oversizedCount = allImages.filter(img => (img.estimatedSize || 0) > 1024 * 1024).length;

  if (allImages.length === 0) {
    return (
      <Card className="!bg-card/70 backdrop-blur-xl border-border">
        <CardHeader>
          <CardTitle>Images</CardTitle>
          <CardDescription>No images detected in this import.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Image URL copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy URL");
      console.error(error);
    }
  };

  const handleOpenImage = (url: string) => {
    // Only open if it's an absolute URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast.error("Cannot open relative or data URI images");
    }
  };

  const handleDownload = async (url: string, filename?: string) => {
    const downloadFilename = filename || extractFilename(url);
    setDownloadingUrls(prev => new Set(prev).add(url));

    try {
      const success = await downloadImage(url, downloadFilename);
      if (success) {
        toast.success(`Downloaded: ${downloadFilename}`);
      } else {
        toast.error("Failed to download image");
      }
    } catch (error) {
      toast.error("Failed to download image");
      console.error(error);
    } finally {
      setDownloadingUrls(prev => {
        const next = new Set(prev);
        next.delete(url);
        return next;
      });
    }
  };

  const handleUploadToCloud = async (image: ImageValidation) => {
    if (!projectId) {
      toast.error("Project ID required for upload");
      return;
    }

    if (!canFetchImage(image.url)) {
      toast.error("Cannot fetch this image type from browser");
      return;
    }

    setUploadingUrls(prev => new Set(prev).add(image.url));

    try {
      // Fetch the image as blob
      const blob = await fetchImageAsBlob(image.url);
      if (!blob) {
        toast.error("Failed to fetch image");
        return;
      }

      // Check file size
      if (blob.size > MAX_IMAGE_SIZE) {
        toast.error(`Image too large (${formatBytes(blob.size)}). Max: ${formatBytes(MAX_IMAGE_SIZE)}`);
        return;
      }

      // Upload to Convex
      const uploadResult = await uploadImageToConvex(blob, generateUploadUrl);
      if (!uploadResult) {
        toast.error("Failed to upload image");
        return;
      }

      const filename = extractFilename(image.url);
      const mimeType = getMimeType(image.url);

      // Register the hosted image
      const { hostedUrl } = await registerHostedImage({
        projectId,
        originalUrl: image.url,
        originalFilename: filename,
        storageId: uploadResult.storageId as Id<"_storage">,
        mimeType,
        sizeBytes: blob.size,
      });

      // Update the project's images array
      if (hostedUrl) {
        await updateProjectImage({
          projectId,
          originalUrl: image.url,
          hostedUrl,
          hostedFilename: filename,
          storageId: uploadResult.storageId as Id<"_storage">,
        });
      }

      toast.success(`Uploaded: ${filename}`);
      onImagesUpdated?.();
    } catch (error) {
      toast.error("Failed to upload image");
      console.error(error);
    } finally {
      setUploadingUrls(prev => {
        const next = new Set(prev);
        next.delete(image.url);
        return next;
      });
    }
  };

  // Handle manual file upload for local/relative path images
  const handleManualFileUpload = (originalUrl: string) => {
    setPendingUploadUrl(originalUrl);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadUrl || !projectId) {
      setPendingUploadUrl(null);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      setPendingUploadUrl(null);
      return;
    }

    // Check file size
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error(`Image too large (${formatBytes(file.size)}). Max: ${formatBytes(MAX_IMAGE_SIZE)}`);
      setPendingUploadUrl(null);
      return;
    }

    setUploadingUrls(prev => new Set(prev).add(pendingUploadUrl));

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

      // Use the original filename from the path, or the uploaded file name
      const originalFilename = extractFilename(pendingUploadUrl) || file.name;

      // Register the hosted image
      const { hostedUrl } = await registerHostedImage({
        projectId,
        originalUrl: pendingUploadUrl,
        originalFilename,
        storageId: storageId as Id<"_storage">,
        mimeType: file.type,
        sizeBytes: file.size,
      });

      // Update the project's images array
      if (hostedUrl) {
        await updateProjectImage({
          projectId,
          originalUrl: pendingUploadUrl,
          hostedUrl,
          hostedFilename: originalFilename,
          storageId: storageId as Id<"_storage">,
        });
      }

      toast.success(`Uploaded: ${originalFilename}`);
      onImagesUpdated?.();
    } catch (error) {
      toast.error("Failed to upload image");
      console.error(error);
    } finally {
      setUploadingUrls(prev => {
        const next = new Set(prev);
        next.delete(pendingUploadUrl);
        return next;
      });
      setPendingUploadUrl(null);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Count images that can be uploaded (fetchable and not yet hosted)
  const uploadableCount = allImages.filter(
    img => canFetchImage(img.url) && !img.hostedUrl && !img.blocked
  ).length;

  // Count images that are already hosted
  const hostedCount = allImages.filter(img => img.hostedUrl).length;

  return (
    <div className="space-y-4 text-foreground">
      {/* Hidden file input for manual uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1">Images</h3>
          <p className="text-sm text-muted-foreground font-medium">
            These images were detected in your import. Note that oversized images (&gt;1MB) are not imported automatically.
          </p>
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-muted-foreground/60" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="text-sm font-medium bg-card border border-border rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm"
          >
            <option value="all">All Images ({allImages.length})</option>
            <option value="absolute">Absolute URLs ({allImages.filter(i => i.classification === 'absolute').length})</option>
            <option value="relative">Relative Paths ({allImages.filter(i => i.classification === 'relative').length})</option>
            <option value="data-uri">Data URIs ({allImages.filter(i => i.classification === 'data-uri').length})</option>
            <option value="oversized">Oversized &gt;1MB ({oversizedCount})</option>
          </select>
        </div>
      </div>

      {/* Webflow workflow info */}
      <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 flex items-start gap-3">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-foreground">
            Download Images for Webflow
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <strong>Download</strong> images to upload them to your Webflow Asset Library with matching filenames.
            For local files, click <strong>Upload File</strong> first to host them, then download.
          </p>
          {hostedCount > 0 && (
            <p className="text-xs text-green-500 mt-2 font-medium">
              {hostedCount} image{hostedCount > 1 ? 's' : ''} saved to cloud
            </p>
          )}
        </div>
      </div>

      {/* Prominent warning for oversized images */}
      {oversizedCount > 0 && (
        <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-foreground">
              {oversizedCount} oversized image{oversizedCount > 1 ? 's' : ''} detected (&gt;1MB)
            </p>
            <p className="text-xs text-muted-foreground">
              These images will not be imported automatically. Consider compressing them before adding to Webflow.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {imageAssets.map((image, idx) => {
          const canDisplay = image.classification === 'absolute' || image.classification === 'data-uri';
          const isDataUri = image.classification === 'data-uri';
          const isRelative = image.classification === 'relative';
          const isLocalOrRelative = !canFetchImage(image.url);
          const displayUrl = image.url.length > 60 ? `${image.url.substring(0, 60)}...` : image.url;
          const isOversized = (image.estimatedSize || 0) > 1024 * 1024; // > 1MB
          // Can show preview if hosted or if original URL is displayable
          const hasHostedPreview = !!image.hostedUrl;
          const previewUrl = image.hostedUrl || (canDisplay && !isDataUri ? image.url : null);

          return (
            <Card key={idx} className={cn(
              "!bg-card/80 backdrop-blur-xl border-border shadow-xl shadow-background/50 overflow-hidden",
              (image.blocked || isOversized) && "border-amber-500/30",
              hasHostedPreview && "border-green-500/30"
            )}>
              <CardContent className="p-0 flex flex-col h-full">
                {/* Image Preview - Show hosted image or original if displayable */}
                {previewUrl ? (
                  <div className="relative aspect-video bg-accent/50 border-b border-border overflow-hidden group">
                    <Image
                      src={previewUrl}
                      alt={`Asset ${idx + 1}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                      unoptimized
                    />
                    {isOversized && !hasHostedPreview && (
                      <div className="absolute inset-0 bg-primary/30 backdrop-blur-md flex items-center justify-center p-4 transition-all group-hover:bg-primary/40">
                        <div className="bg-card/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-border">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Oversized - Not Imported</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-accent/30 border-b border-border flex flex-col items-center justify-center p-8 text-center gap-2">
                    <FolderOpen className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                      {isDataUri ? "Base64 Data URI" : "Local File"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">
                      Click &quot;Upload File&quot; to add this image
                    </p>
                  </div>
                )}

                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-[10px] uppercase px-2 py-0.5">
                        {image.type.replace('Image', '').trim() || 'Image'}
                      </Badge>
                      {image.hostedUrl && (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-none font-bold text-[10px] uppercase px-2 py-0.5">
                          Hosted
                        </Badge>
                      )}
                    </div>
                    {image.estimatedSize && (
                      <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums">
                        {formatBytes(image.estimatedSize)}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-full" title={image.url}>
                    {displayUrl}
                  </p>

                  <div className="flex flex-col gap-2">
                    {/* Primary action: Download for all downloadable images, Upload File for local paths */}
                    {image.hostedUrl ? (
                      // Hosted on Convex - download from there
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full text-xs h-9 rounded-xl font-bold bg-green-600 hover:bg-green-700"
                        onClick={() => handleDownload(image.hostedUrl!, image.hostedFilename)}
                        disabled={downloadingUrls.has(image.hostedUrl)}
                      >
                        {downloadingUrls.has(image.hostedUrl) ? (
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5 mr-2" />
                        )}
                        Download
                      </Button>
                    ) : canFetchImage(image.url) ? (
                      // External URL (Unsplash, etc.) - can download directly
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full text-xs h-9 rounded-xl font-bold"
                        onClick={() => handleDownload(image.url, extractFilename(image.url))}
                        disabled={downloadingUrls.has(image.url)}
                      >
                        {downloadingUrls.has(image.url) ? (
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5 mr-2" />
                        )}
                        Download
                      </Button>
                    ) : isLocalOrRelative && projectId ? (
                      // Local path - need to upload first
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full text-xs h-9 rounded-xl font-bold bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleManualFileUpload(image.url)}
                        disabled={uploadingUrls.has(image.url)}
                      >
                        {uploadingUrls.has(image.url) ? (
                          <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        ) : (
                          <FolderOpen className="w-3.5 h-3.5 mr-2" />
                        )}
                        Upload File
                      </Button>
                    ) : null}

                    {/* Secondary actions */}
                    <div className="flex gap-2">
                      {/* Save to Cloud - for external URLs not yet hosted */}
                      {canFetchImage(image.url) && !image.hostedUrl && !image.blocked && projectId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs h-9 rounded-xl border-border font-bold hover:bg-accent"
                          onClick={() => handleUploadToCloud(image)}
                          disabled={uploadingUrls.has(image.url)}
                        >
                          {uploadingUrls.has(image.url) ? (
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5 mr-2" />
                          )}
                          Save to Cloud
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs h-9 rounded-xl border-border font-bold hover:bg-accent"
                        onClick={() => handleCopyUrl(image.hostedUrl || image.url)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-2" />
                        URL
                      </Button>

                      {!isLocalOrRelative && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 text-xs h-9 rounded-xl font-bold bg-accent hover:bg-accent/80"
                          onClick={() => handleOpenImage(image.hostedUrl || image.url)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-2" />
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 mt-8">
        <p className="text-sm text-primary">
          {filter !== 'all' && (
            <span className="mr-2">
              <strong>Showing:</strong> {imageAssets.length} of {allImages.length} |
            </span>
          )}
          <strong>Total:</strong> {allImages.length}
          {" | "}
          <strong className="text-green-500">Hosted:</strong> <span className="text-green-500">{hostedCount}</span>
          {" | "}
          <strong>Warnings:</strong> {allImages.filter((i) => (i.estimatedSize || 0) > 1024 * 1024 || i.blocked).length}
          {" | "}
          <strong>Data URIs:</strong> {allImages.filter((i) => i.classification === 'data-uri').length}
          {" | "}
          <strong>Relative:</strong> {allImages.filter((i) => i.classification === 'relative').length}
        </p>
      </div>
    </div>
  );
}
