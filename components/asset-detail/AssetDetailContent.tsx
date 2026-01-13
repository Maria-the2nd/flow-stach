"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AssetDetailMain } from "./AssetDetailMain";
import { AssetDetailContext } from "./AssetDetailContext";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileNotFoundIcon } from "@hugeicons/core-free-icons";

interface AssetDetailContentProps {
  slug: string;
}

function NotFoundState({ slug }: { slug: string }) {
  return (
    <AppShell
      sidebar={
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      }
      main={
        <div className="flex flex-1 flex-col items-center justify-center p-6">
          <div className="bg-muted/50 mb-4 rounded-full p-4 ring-1 ring-border">
            <HugeiconsIcon icon={FileNotFoundIcon} className="text-muted-foreground h-8 w-8" />
          </div>
          <h1 className="text-xl font-semibold">Asset Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-sm text-center">
            The asset &quot;{slug}&quot; could not be found. It may have been removed or the URL is incorrect.
          </p>
        </div>
      }
      context={<div className="p-4" />}
    />
  );
}

function LoadingMainSkeleton() {
  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Title skeleton */}
      <Skeleton className="h-8 w-2/3" />

      {/* Preview placeholder skeleton */}
      <Skeleton className="mt-6 aspect-video w-full rounded-lg" />

      {/* Tabs skeleton */}
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-20 rounded-md" />
        <Skeleton className="h-9 w-16 rounded-md" />
        <Skeleton className="h-9 w-14 rounded-md" />
      </div>

      {/* Content skeleton */}
      <div className="mt-4 rounded-lg border border-border bg-card p-4 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

function LoadingContextSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Details Card skeleton */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-16" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div>
            <Skeleton className="h-3 w-10 mb-2" />
            <div className="flex flex-wrap gap-1">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Card skeleton */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-16" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-9 w-full rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <AppShell
      sidebar={
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      }
      main={<LoadingMainSkeleton />}
      context={<LoadingContextSkeleton />}
    />
  );
}

export function AssetDetailContent({ slug }: AssetDetailContentProps) {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();

  // Skip query until auth is loaded
  const asset = useQuery(
    api.assets.bySlug,
    isAuthLoaded && isSignedIn ? { slug } : "skip"
  );

  // Check for payload existence
  const payload = useQuery(
    api.payloads.byAssetId,
    asset ? { assetId: asset._id } : "skip"
  );

  // Loading state (including auth loading)
  if (!isAuthLoaded || (isSignedIn && asset === undefined)) {
    return <LoadingState />;
  }

  // Not found state
  if (asset === null || asset === undefined) {
    return <NotFoundState slug={slug} />;
  }

  const hasPayload = payload !== undefined && payload !== null;

  return (
    <AppShell
      sidebar={
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      }
      main={<AssetDetailMain asset={asset} hasPayload={hasPayload} />}
      context={<AssetDetailContext asset={asset} payload={payload ?? null} />}
    />
  );
}
