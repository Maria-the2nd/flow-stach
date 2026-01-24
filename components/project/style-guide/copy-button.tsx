"use client";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  variant?: "individual" | "category";
  className?: string;
}

export function CopyButton({ value, label, variant = "individual", className }: CopyButtonProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(
        label ? `Copied ${label}` : "Copied to clipboard",
        {
          description: variant === "individual" ? value : `${value.split('\n').length} values copied`,
        }
      );
    } catch (error) {
      toast.error("Failed to copy");
      console.error(error);
    }
  };

  if (variant === "individual") {
    return (
      <button
        onClick={handleCopy}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors",
          className
        )}
        title="Copy value"
      >
        <HugeiconsIcon icon={Copy01Icon} className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <Button
      onClick={handleCopy}
      variant="outline"
      size="sm"
      className={cn(
        "gap-2 font-bold text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300",
        className
      )}
    >
      <HugeiconsIcon icon={Copy01Icon} className="w-4 h-4" />
      {label || "Copy All"}
    </Button>
  );
}

interface CategoryCopyButtonProps {
  tokens: Array<{ name: string; value: string }>;
  category: string;
  className?: string;
}

export function CategoryCopyButton({ tokens, category, className }: CategoryCopyButtonProps) {
  const handleCopy = async () => {
    try {
      // Format as CSS custom properties
      const cssVars = tokens.map(t => `  --${t.name}: ${t.value};`).join('\n');
      const formattedCSS = `:root {\n${cssVars}\n}`;
      
      await navigator.clipboard.writeText(formattedCSS);
      toast.success(`Copied ${tokens.length} ${category} values`, {
        description: "Paste into your CSS file",
      });
    } catch (error) {
      toast.error("Failed to copy values");
      console.error(error);
    }
  };

  return (
    <Button
      onClick={handleCopy}
      variant="outline"
      size="sm"
      className={cn(
        "gap-2 font-bold text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300",
        className
      )}
    >
      <HugeiconsIcon icon={Copy01Icon} className="w-4 h-4" />
      Copy All {category}
    </Button>
  );
}
