import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon, Rocket01Icon, StarIcon } from "@hugeicons/core-free-icons";

export function ContextPanel() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* Quick Tips */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={InformationCircleIcon} size={14} className="text-primary" />
            Quick Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Click any card to view details and copy options.</p>
          <p>Use the heart icon to save favorites for quick access.</p>
          <p>Filter by category using the sidebar navigation.</p>
        </CardContent>
      </Card>

      {/* Getting Started */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Rocket01Icon} size={14} className="text-primary" />
            Getting Started
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Browse assets by category or search for specific components.</p>
          <p>Copy code directly to your project or export to Webflow.</p>
        </CardContent>
      </Card>

      {/* Pro Tip */}
      <Card size="sm" className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <HugeiconsIcon icon={StarIcon} size={14} />
            Pro Tip
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          <p>New assets are marked with a green badge. Check back often for updates!</p>
        </CardContent>
      </Card>
    </div>
  );
}
