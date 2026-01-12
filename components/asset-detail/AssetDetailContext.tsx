"use client";

import { useState, useMemo } from "react";
import { Doc } from "@/convex/_generated/dataModel";
import { useFavorites } from "@/components/favorites/FavoritesProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, FavouriteIcon } from "@hugeicons/core-free-icons";
import { copyText, copyWebflowJson } from "@/lib/clipboard";

type Asset = Doc<"assets">;
type Payload = Doc<"payloads">;

function isPlaceholderPayload(json: string | undefined): boolean {
  if (!json) return true;
  try {
    const parsed = JSON.parse(json);
    return parsed?.placeholder === true;
  } catch {
    return false;
  }
}

interface AssetDetailContextProps {
  asset: Asset;
  payload: Payload | null;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AssetDetailContext({ asset, payload }: AssetDetailContextProps) {
  const { isFavorited, toggle } = useFavorites();
  const favorited = isFavorited(asset.slug);
  const [copyingWebflow, setCopyingWebflow] = useState(false);
  const [copyingCode, setCopyingCode] = useState(false);

  const hasWebflowPayload = useMemo(
    () => !!payload?.webflowJson && !isPlaceholderPayload(payload.webflowJson),
    [payload?.webflowJson]
  );

  const hasCodePayload = useMemo(
    () => !!payload?.codePayload && !payload.codePayload.includes("// TODO: Add implementation"),
    [payload?.codePayload]
  );

  const handleCopyWebflow = async () => {
    if (!hasWebflowPayload) return;
    setCopyingWebflow(true);
    try {
      await copyWebflowJson(payload?.webflowJson);
    } finally {
      setCopyingWebflow(false);
    }
  };

  const handleCopyCode = async () => {
    if (!hasCodePayload) return;
    setCopyingCode(true);
    try {
      await copyText(payload?.codePayload ?? "");
    } finally {
      setCopyingCode(false);
    }
  };

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
              {asset.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
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
        <CardContent className="space-y-2">
          <div className="space-y-1">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCopyWebflow}
              disabled={copyingWebflow || !hasWebflowPayload}
            >
              <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
              {copyingWebflow ? "Copying..." : "Copy to Webflow"}
            </Button>
            {!hasWebflowPayload && (
              <p className="text-xs text-muted-foreground pl-1">No payload yet</p>
            )}
          </div>
          <div className="space-y-1">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCopyCode}
              disabled={copyingCode || !hasCodePayload}
            >
              <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
              {copyingCode ? "Copying..." : "Copy Code"}
            </Button>
            {!hasCodePayload && (
              <p className="text-xs text-muted-foreground pl-1">No payload yet</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
