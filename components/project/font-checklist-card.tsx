"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface FontChecklistCardProps {
  fonts?: Array<{
    name: string;
    status: 'available' | 'missing' | 'unknown';
    weights?: number[];  // [400, 500, 700] for Webflow installation
    warning?: boolean;
    installationGuide: string;
  }>;
}

export function FontChecklistCard({ fonts }: FontChecklistCardProps) {
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);

  if (!fonts || fonts.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-xl border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Font Checklist</CardTitle>
          <CardDescription className="text-muted-foreground">No custom fonts detected in this project.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const toggleOpen = (index: number) => {
    setOpenIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <Card className="bg-card/50 backdrop-blur-xl border-border shadow-xl shadow-background/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl font-bold text-foreground">Font Checklist</CardTitle>
        <CardDescription className="text-muted-foreground font-medium max-w-xl leading-relaxed">
          Step 2: You must install these fonts bellow on webflow. Go to Site Settings → Fonts in Webflow, upload the custom font or search for it if its a google font.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          {fonts.map((font, idx) => {
            const isOpen = openIndexes.includes(idx);

            return (
              <div key={idx} className="bg-accent/20 border border-border/50 rounded-2xl overflow-hidden transition-all hover:bg-accent/40 hover:border-primary/20 group">
                <button
                  onClick={() => toggleOpen(idx)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                        font.status === 'available' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {font.status === 'available' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                      </div>
                      <span className="font-bold text-foreground">
                        {font.name}
                        {font.weights && font.weights.length > 0 && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({font.weights.sort((a, b) => a - b).join(', ')})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={cn(
                        "border-none font-bold text-[10px] uppercase px-3 py-1",
                        font.status === 'available' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {font.status === 'available' ? 'Available' : 'Missing'}
                      </Badge>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform duration-300",
                          isOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 bg-accent/20 border-t border-border/50 animate-in fade-in duration-300">
                    <div className="bg-background/50 p-4 rounded-xl border border-border/50 shadow-sm">
                      <p className="text-sm text-muted-foreground font-medium leading-relaxed italic">
                        {font.installationGuide}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="p-4 bg-primary/5 rounded-[20px] border border-primary/10">
          <p className="text-sm text-primary font-medium flex items-center gap-2">
            <span className="font-bold uppercase text-[10px] bg-primary/10 px-2 py-0.5 rounded-md">Summary</span>
            <span>
              {fonts.filter((f) => f.status === 'available').length} of {fonts.length} fonts ready.
              {fonts.filter((f) => f.status !== 'available').length > 0 && ` Action required for ${fonts.filter((f) => f.status !== 'available').length} font(s).`}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
