"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AssetDetailMain } from "./AssetDetailMain";
import { AssetDetailContext } from "./AssetDetailContext";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { Suspense } from "react";

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
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold">Asset Not Found</h1>
            <p className="mt-2 text-muted-foreground">
              The asset &quot;{slug}&quot; could not be found.
            </p>
          </div>
        </div>
      }
      context={<div className="p-4" />}
    />
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
      main={
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-muted-foreground">Loading asset...</p>
        </div>
      }
      context={<div className="p-4" />}
    />
  );
}

export function AssetDetailContent({ slug }: AssetDetailContentProps) {
  const asset = useQuery(api.assets.bySlug, { slug });

  // Check for payload existence
  const payload = useQuery(
    api.payloads.byAssetId,
    asset ? { assetId: asset._id } : "skip"
  );

  // Loading state
  if (asset === undefined) {
    return <LoadingState />;
  }

  // Not found state
  if (asset === null) {
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
      context={<AssetDetailContext asset={asset} />}
    />
  );
}
