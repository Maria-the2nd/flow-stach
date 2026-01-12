"use client";

import { Asset } from "@/lib/fakeAssets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, FavouriteIcon } from "@hugeicons/core-free-icons";

interface AssetDetailContextProps {
  asset: Asset;
}

export function AssetDetailContext({ asset }: AssetDetailContextProps) {
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
            <p className="text-sm font-medium">{asset.updatedAt}</p>
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
          <Button variant="outline" className="w-full justify-start" disabled>
            <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
            Copy to Webflow
          </Button>
          <Button variant="outline" className="w-full justify-start" disabled>
            <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
            Copy Code
          </Button>
          <Button variant="outline" className="w-full justify-start" disabled>
            <HugeiconsIcon icon={FavouriteIcon} data-icon="inline-start" />
            Favorite
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
