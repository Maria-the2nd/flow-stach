"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AssetDetailMain } from "./AssetDetailMain";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Suspense } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileNotFoundIcon } from "@hugeicons/core-free-icons";
import { AssetsBanner } from "@/components/assets/AssetsBanner";

interface AssetDetailContentProps {
  slug: string;
}

function NotFoundState({ slug }: { slug: string }) {
  return (
    <AppShell
      banner={
        <AssetsBanner
          eyebrow="Component Library"
          title="Component Not Found"
          description="The component you're looking for is unavailable. Return to the library to pick a different template."
        />
      }
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
      context={null}
    />
  );
}

function LoadingMainSkeleton() {
  return (
    <div className="flex flex-1 flex-col p-6">
      {/* Preview placeholder skeleton */}
      <Skeleton className="aspect-video w-full rounded-lg" />

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

// Context panel skeleton removed - details now inline in main area

function LoadingState() {
  return (
    <AppShell
      banner={
        <AssetsBanner
          eyebrow="Component Library"
          title="Loading Component"
          description="Pulling the template context and component details."
        />
      }
      sidebar={
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      }
      main={<LoadingMainSkeleton />}
      context={null}
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

  return (
    <AppShell
      banner={
        <AssetsBanner
          eyebrow="Component Library"
          title={asset.title}
          description="This component is part of the selected template system. Copy it into Webflow or review the code snippets below."
          meta={`Template: ${asset.category}`}
        />
      }
      sidebar={
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      }
      main={<AssetDetailMain asset={asset} payload={payload} />}
      context={null}
    />
  );
}
