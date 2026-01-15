"use client";

import { useState, useMemo } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, FavouriteIcon } from "@hugeicons/core-free-icons";
import { copyWebflowJson } from "@/lib/clipboard";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Asset = Doc<"assets">;
type Payload = Doc<"payloads">;

function isPlaceholderPayload(json: string | undefined): boolean {
  if (!json) return true;
  try {
    const parsed = JSON.parse(json) as {
      placeholder?: boolean;
      type?: string;
      payload?: { nodes?: unknown; styles?: unknown };
    };
    if (parsed?.placeholder === true) return true;
    if (parsed?.type !== "@webflow/XscpData") return true;
    if (!parsed.payload) return true;

    const hasNodes =
      Array.isArray(parsed.payload.nodes) && parsed.payload.nodes.length > 0;
    const hasStyles =
      Array.isArray(parsed.payload.styles) && parsed.payload.styles.length > 0;
    return !(hasNodes || hasStyles);
  } catch {
    return true;
  }
}

interface AssetDetailContextProps {
  asset: Asset;
  payload: Payload | null;
}

interface AssetActionsProps {
  asset: Asset;
  payload: Payload | null;
  layout?: "vertical" | "inline";
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AssetActions({ asset, payload, layout = "vertical" }: AssetActionsProps) {
  const { isFavorited, toggle } = useFavorites();
  const favorited = isFavorited(asset.slug);
  const [copyingWebflow, setCopyingWebflow] = useState(false);

  const hasWebflowPayload = useMemo(
    () => !!payload?.webflowJson && !isPlaceholderPayload(payload.webflowJson),
    [payload?.webflowJson]
  );

  const canPasteToWebflow = asset.pasteReliability === "full" || asset.pasteReliability === "partial";
  const webflowDisabled = !hasWebflowPayload || !canPasteToWebflow;

  const getWebflowTooltip = () => {
    if (!hasWebflowPayload) return "No Webflow payload available";
    if (asset.pasteReliability === "none") return asset.capabilityNotes || "Webflow paste not supported - use Install Snippet";
    if (asset.pasteReliability === "partial") return asset.capabilityNotes || "Paste works, but some features need manual setup";
    return null;
  };

  const handleCopyWebflow = async () => {
    if (!hasWebflowPayload) return;
    setCopyingWebflow(true);
    try {
      await copyWebflowJson(payload?.webflowJson);
    } finally {
      setCopyingWebflow(false);
    }
  };

  if (layout === "inline") {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyWebflow}
          disabled={copyingWebflow || webflowDisabled}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
          {copyingWebflow ? "Copying…" : "Copy to Webflow"}
        </Button>
        <Button
          variant={favorited ? "default" : "secondary"}
          size="sm"
          onClick={() => toggle(asset.slug)}
          className="gap-1.5"
        >
          <HugeiconsIcon
            icon={FavouriteIcon}
            data-icon="inline-start"
            className={favorited ? "fill-current text-red-500" : ""}
          />
          {favorited ? "Favorited" : "Add to Favorites"}
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="space-y-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleCopyWebflow}
                  disabled={copyingWebflow || webflowDisabled}
                >
                  <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
                  {copyingWebflow ? "Copying..." : "Copy to Webflow"}
                </Button>
              </div>
            </TooltipTrigger>
            {getWebflowTooltip() && (
              <TooltipContent side="left">
                <p className="max-w-[200px]">{getWebflowTooltip()}</p>
              </TooltipContent>
            )}
          </Tooltip>
          {webflowDisabled && (
            <p className="pl-1 text-xs text-muted-foreground">
              {!hasWebflowPayload ? "No payload yet" : "Use Install Snippet instead"}
            </p>
          )}
        </div>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => toggle(asset.slug)}
        >
          <HugeiconsIcon
            icon={FavouriteIcon}
            data-icon="inline-start"
            className={favorited ? "fill-current text-red-500" : ""}
          />
          {favorited ? "Remove from Favorites" : "Add to Favorites"}
        </Button>
      </div>
    </TooltipProvider>
  );
}

export function AssetDetailContext({ asset, payload }: AssetDetailContextProps) {

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Details Card */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <span className="text-xs text-muted-foreground">Category</span>
            <p className="text-sm font-medium capitalize">{asset.category}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Updated</span>
            <p className="text-sm font-medium">{formatDate(asset.updatedAt)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Tags</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {asset.tags.map((tag, index) => (
                <Badge key={`${tag}-${index}`} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions Card */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetActions asset={asset} payload={payload} layout="vertical" />
        </CardContent>
      </Card>
    </div>
  );
}
