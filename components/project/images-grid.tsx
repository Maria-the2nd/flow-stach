"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Copy, ExternalLink, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageValidation {
  url: string;
  type: string;
  estimatedSize?: number;
  sizeWarning: boolean;
  blocked: boolean;
  classification: string;
}

interface ImagesGridProps {
  images?: ImageValidation[];
}

type FilterType = 'all' | 'absolute' | 'relative' | 'data-uri' | 'oversized';

function formatBytes(bytes?: number): string {
  if (!bytes) return 'Unknown';

  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function ImagesGrid({ images }: ImagesGridProps) {
  const [filter, setFilter] = useState<FilterType>('all');

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
      <Card className="!bg-white/70 backdrop-blur-xl border-slate-200">
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

  return (
    <div className="space-y-4 text-slate-900">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold mb-1">Images</h3>
          <p className="text-sm text-slate-500 font-medium">
            These images were detected in your import. Note that oversized images (&gt;1MB) are not imported automatically.
          </p>
        </div>

        {/* Filter dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="text-sm font-medium bg-white border border-slate-200 rounded-xl px-4 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 shadow-sm"
          >
            <option value="all">All Images ({allImages.length})</option>
            <option value="absolute">Absolute URLs ({allImages.filter(i => i.classification === 'absolute').length})</option>
            <option value="relative">Relative Paths ({allImages.filter(i => i.classification === 'relative').length})</option>
            <option value="data-uri">Data URIs ({allImages.filter(i => i.classification === 'data-uri').length})</option>
            <option value="oversized">Oversized &gt;1MB ({oversizedCount})</option>
          </select>
        </div>
      </div>

      {/* Prominent warning for oversized images */}
      {oversizedCount > 0 && (
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              {oversizedCount} oversized image{oversizedCount > 1 ? 's' : ''} detected (&gt;1MB)
            </p>
            <p className="text-xs text-amber-700">
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
          const displayUrl = image.url.length > 60 ? `${image.url.substring(0, 60)}...` : image.url;
          const isOversized = (image.estimatedSize || 0) > 1024 * 1024; // > 1MB

          return (
            <Card key={idx} className={cn(
              "!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden",
              (image.blocked || isOversized) && "border-amber-200/50"
            )}>
              <CardContent className="p-0 flex flex-col h-full">
                {/* Image Preview */}
                {canDisplay && !isDataUri ? (
                  <div className="relative aspect-video bg-slate-50 border-b border-slate-100 overflow-hidden group">
                    <Image
                      src={image.url}
                      alt={`Asset ${idx + 1}`}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(event) => {
                        (event.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                      unoptimized
                    />
                    {isOversized && (
                      <div className="absolute inset-0 bg-blue-600/30 backdrop-blur-md flex items-center justify-center p-4 transition-all group-hover:bg-blue-600/40">
                        <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 border border-white">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">Oversized - Not Imported</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-slate-50/50 border-b border-slate-100 flex items-center justify-center p-8 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {isDataUri ? "Base64 Data URI" : "Relative Path"}
                    </p>
                  </div>
                )}

                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none font-bold text-[10px] uppercase px-2 py-0.5">
                      {image.type.replace('Image', '').trim() || 'Image'}
                    </Badge>
                    {image.estimatedSize && (
                      <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                        {formatBytes(image.estimatedSize)}
                      </span>
                    )}
                  </div>

                  <p className="text-[10px] font-mono text-slate-400 truncate max-w-full" title={image.url}>
                    {displayUrl}
                  </p>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-9 rounded-xl border-slate-200 font-bold hover:bg-slate-50"
                      onClick={() => handleCopyUrl(image.url)}
                    >
                      <Copy className="w-3.5 h-3.5 mr-2" />
                      URL
                    </Button>

                    {!isRelative && !isDataUri && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 text-xs h-9 rounded-xl font-bold bg-slate-100 hover:bg-slate-200"
                        onClick={() => handleOpenImage(image.url)}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-2" />
                        Open
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mt-8">
        <p className="text-sm text-blue-900">
          {filter !== 'all' && (
            <span className="mr-2">
              <strong>Showing:</strong> {imageAssets.length} of {allImages.length} |
            </span>
          )}
          <strong>Total Images:</strong> {allImages.length}
          {" | "}
          <strong>Warnings:</strong> {allImages.filter((i) => (i.estimatedSize || 0) > 1024 * 1024 || i.blocked).length}
          {" | "}
          <strong>Data URIs:</strong> {allImages.filter((i) => i.classification === 'data-uri').length}
          {" | "}
          <strong>Relative Paths:</strong> {allImages.filter((i) => i.classification === 'relative').length}
        </p>
      </div>
    </div>
  );
}
