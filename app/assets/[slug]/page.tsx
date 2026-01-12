import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { getAssetBySlug } from "@/lib/fakeAssets";
import { AssetDetailMain } from "@/components/asset-detail/AssetDetailMain";
import { AssetDetailContext } from "@/components/asset-detail/AssetDetailContext";

interface AssetDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { slug } = await params;
  const asset = getAssetBySlug(slug);

  if (!asset) {
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

  return (
    <AppShell
      sidebar={
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      }
      main={<AssetDetailMain asset={asset} />}
      context={<AssetDetailContext asset={asset} />}
    />
  );
}
