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
    <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-2xl font-bold text-slate-900">About This Site</CardTitle>
            <CardDescription className="text-slate-500 font-medium max-w-xl leading-relaxed">
              Add a brief description of what this site is about. This helps you remember the project context.
            </CardDescription>
          </div>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="shrink-0 rounded-xl border-slate-200 hover:bg-slate-50"
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
              className="min-h-[120px] resize-none rounded-xl border-slate-200 focus:border-blue-300 focus:ring-blue-200"
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
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
                  className="rounded-xl bg-blue-600 hover:bg-blue-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5">
            {description ? (
              <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            ) : (
              <p className="text-slate-400 italic">
                No description yet. Click &quot;Edit&quot; to add one.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
