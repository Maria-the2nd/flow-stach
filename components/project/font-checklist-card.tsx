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
    warning?: boolean;
    installationGuide: string;
  }>;
}

export function FontChecklistCard({ fonts }: FontChecklistCardProps) {
  const [openIndexes, setOpenIndexes] = useState<number[]>([]);

  if (!fonts || fonts.length === 0) {
    return (
      <Card className="!bg-white/80 backdrop-blur-xl border-slate-200">
        <CardHeader>
          <CardTitle>Font Checklist</CardTitle>
          <CardDescription>No custom fonts detected in this project.</CardDescription>
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
    <Card className="!bg-white/80 backdrop-blur-xl border-slate-200 shadow-xl shadow-slate-200/50 rounded-[32px] overflow-hidden">
      <CardHeader className="pb-6">
        <CardTitle className="text-2xl font-bold text-slate-900">Font Checklist</CardTitle>
        <CardDescription className="text-slate-500 font-medium max-w-xl leading-relaxed">
          Step 2: You must install these fonts bellow on webflow. Go to Site Settings → Fonts in Webflow, upload the custom font or search for it if its a google font.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          {fonts.map((font, idx) => {
            const isOpen = openIndexes.includes(idx);

            return (
              <div key={idx} className="bg-slate-50/50 border border-slate-100 rounded-2xl overflow-hidden transition-all hover:bg-white hover:border-blue-100 group">
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
                      <span className="font-bold text-slate-900">{font.name}</span>
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
                          "w-4 h-4 text-slate-400 transition-transform duration-300",
                          isOpen && "rotate-180"
                        )}
                      />
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 bg-white/50 border-t border-slate-100 animate-in fade-in duration-300">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                      <p className="text-sm text-slate-500 font-medium leading-relaxed">
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
        <div className="p-4 bg-blue-50/50 rounded-[20px] border border-blue-100/50">
          <p className="text-sm text-blue-900 font-medium flex items-center gap-2">
            <span className="font-bold uppercase text-[10px] bg-blue-100 px-2 py-0.5 rounded-md">Summary</span>
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
