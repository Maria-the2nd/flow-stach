
"use client";
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Folder, Library, Cuboid, Trash2 } from 'lucide-react';
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const deleteAllProjects = useMutation(api.projects.deleteAllMyProjects);
    const navItems = [
        { label: 'Projects', href: '/workspace/projects', icon: Folder },
        { label: 'Templates', href: '/workspace/library', icon: Library },
        { label: 'Components', href: '/workspace/components', icon: Cuboid },
        { label: 'Import', href: '/workspace/import', icon: Library },
    ];

    const handleClearAllData = () => {
        setShowClearConfirm(true);
    };

    const handleConfirmClear = async () => {
        setIsClearing(true);
        setShowClearConfirm(false);

        try {
            const result = await deleteAllProjects();
            const totalComponents = result.deletedAssets;
            toast.success(
                `Deleted ${result.deletedProjects} project${result.deletedProjects !== 1 ? "s" : ""}, ${totalComponents} component${totalComponents !== 1 ? "s" : ""}`
            );
        } catch (error) {
            console.error("Failed to delete all projects:", error);
            toast.error("Failed to delete projects");
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <>
            {/* Delete all confirmation modal */}
            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border">
                        <h3 className="text-xl font-bold text-foreground mb-2">Delete All Projects?</h3>
                        <p className="text-muted-foreground mb-6">
                            This will permanently delete all your imported projects, components, and templates.
                            This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setShowClearConfirm(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleConfirmClear}
                            >
                                Delete All Projects
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex h-[calc(100vh-64px)] overflow-hidden">
                <aside className="w-72 border-r border-border/50 bg-card/40 backdrop-blur-xl flex-shrink-0 flex flex-col transition-all duration-500">
                    <div className="p-6 space-y-1 flex-1">
                        <div className="px-2 py-2 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">
                            Workspace
                        </div>
                        {navItems.map(item => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.label}
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-black transition-all duration-300 ${isActive
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                        }`}
                                >
                                    <item.icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : 'opacity-60'}`} />
                                    {item.label}
                                </Link>
                            )
                        })}
                    </div>

                    {/* Workspace Actions */}
                    <div className="p-4 border-t border-border/50 mt-auto">
                        <button
                            type="button"
                            onClick={handleClearAllData}
                            disabled={isClearing}
                            className="group flex items-center justify-between w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-destructive/30 hover:bg-destructive/10 transition-all duration-300"
                        >
                            <span className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-muted-foreground group-hover:text-destructive transition-colors">
                                <Trash2 className="w-4 h-4 opacity-50 group-hover:opacity-100" />
                                {isClearing ? "Clearing..." : "Pure Purge"}
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-border group-hover:bg-destructive transition-colors" />
                        </button>
                    </div>
                </aside>
                <main className="flex-1 overflow-auto bg-transparent p-10">
                    <div className="max-w-6xl mx-auto space-y-8">
                        {children}
                    </div>
                </main>
            </div>
        </>
    )
}
