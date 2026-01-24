
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
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Delete All Projects?</h3>
                        <p className="text-slate-500 mb-6">
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
                <aside className="w-64 border-r border-slate-200 bg-white flex-shrink-0 flex flex-col">
                <div className="p-4 space-y-1 flex-1">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Workspace
                    </div>
                    {navItems.map(item => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all ${isActive
                                    ? 'bg-blue-50/80 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50/50'
                                    }`}
                            >
                                <item.icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                                {item.label}
                            </Link>
                        )
                    })}
                </div>

                {/* Tools section at bottom */}
                <div className="p-4 border-t border-slate-200">
                    <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Tools
                    </div>
                    <button
                        type="button"
                        onClick={handleClearAllData}
                        disabled={isClearing}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold transition-all text-red-500 hover:text-red-600 hover:bg-red-50/50 disabled:opacity-50 disabled:cursor-not-allowed w-full"
                    >
                        <Trash2 className="w-4 h-4" />
                        {isClearing ? "Clearing..." : "Clear All Projects"}
                    </button>
                </div>
            </aside>
            <main className="flex-1 overflow-auto bg-slate-50/50 p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    {children}
                </div>
            </main>
            </div>
        </>
    )
}
