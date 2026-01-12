import { AssetDetailContent } from "@/components/asset-detail/AssetDetailContent";

interface AssetDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { slug } = await params;
  return <AssetDetailContent slug={slug} />;
}
