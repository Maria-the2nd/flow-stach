"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";

interface SiteDescriptionCardProps {
  projectId: Id<"importProjects">;
  description?: string;
}

export function SiteDescriptionCard({ projectId, description }: SiteDescriptionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(description || "");
  const [isSaving, setIsSaving] = useState(false);

  const updateDescription = useMutation(api.projects.updateDescription);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDescription({ projectId, description: value });
      toast.success("Description saved");
      setIsEditing(false);
    } catch (error) {
      toast.error("Failed to save description");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setValue(description || "");
    setIsEditing(false);
  };

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border shadow-xl shadow-background/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-2xl font-bold text-foreground">About This Site</CardTitle>
            <CardDescription className="text-muted-foreground font-medium max-w-xl leading-relaxed">
              Add a brief description of what this site is about. This helps you remember the project context.
            </CardDescription>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="shrink-0 rounded-xl border-border hover:bg-accent"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Describe what this site is about..."
              className="min-h-[120px] resize-none rounded-xl border-border focus:border-primary/50 focus:ring-primary/20 bg-background"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {value.length}/500 characters
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="rounded-xl"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-xl bg-primary hover:opacity-90 text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-accent/30 border border-border/50 rounded-2xl p-5">
            {description ? (
              <p className="text-foreground font-medium leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            ) : (
              <p className="text-muted-foreground italic text-sm">
                No description yet. Click &quot;Edit&quot; to add one.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
