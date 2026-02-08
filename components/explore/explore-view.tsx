
"use client";

import { useState } from "react";
import { PUBLIC_TEMPLATES, PUBLIC_COMPONENTS, PUBLIC_TOOLS } from "./mock-data";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import Image from "next/image";
import { Layers, Box, Wrench, ArrowRight, CodepenIcon } from "lucide-react";

export function ExploreView() {
    const [activeTab, setActiveTab] = useState<'templates' | 'components' | 'tools'>('templates');

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="text-center mb-16 space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
                    Explore the Supply
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Discover high-quality templates, components, and tools to accelerate your workflow.
                    Everything you need to build better, faster.
                </p>
            </div>

            <div className="flex justify-center mb-12">
                <div className="bg-accent/50 p-1.5 rounded-xl inline-flex gap-1 shadow-inner border border-border">
                    <TabButton
                        active={activeTab === 'templates'}
                        onClick={() => setActiveTab('templates')}
                        icon={<Layers className="w-4 h-4" />}
                        label="Templates"
                    />
                    <TabButton
                        active={activeTab === 'components'}
                        onClick={() => setActiveTab('components')}
                        icon={<Box className="w-4 h-4" />}
                        label="Components"
                    />
                    <TabButton
                        active={activeTab === 'tools'}
                        onClick={() => setActiveTab('tools')}
                        icon={<Wrench className="w-4 h-4" />}
                        label="Tools"
                    />
                </div>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'templates' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {PUBLIC_TEMPLATES.map((item) => (
                            <div key={item.id} className="group bg-card rounded-2xl border border-white/20 ring-1 ring-white/10 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_-12px_rgba(168,85,247,0.15)] hover:border-primary/30 h-full shadow-lg shadow-primary/5">
                                <div className="aspect-video bg-accent/30 relative overflow-hidden">
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                                        unoptimized
                                    />
                                    <div className="absolute top-4 right-4 bg-card/90 backdrop-blur text-foreground px-3 py-1 rounded-full text-xs font-bold shadow-sm tracking-wider uppercase">
                                        {item.price}
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-grow">
                                    <h3 className="text-lg font-bold text-foreground mb-2 leading-tight group-hover:text-primary transition-colors">{item.name}</h3>
                                    <p className="text-muted-foreground text-sm mb-6 flex-grow leading-relaxed">{item.description}</p>
                                    <Link href="/workspace/projects" className="mt-auto">
                                        <Button className="w-full bg-primary hover:opacity-90 text-primary-foreground shadow-xl shadow-primary/20 transition-all h-11 font-bold hover:scale-[1.02] active:scale-[0.98]">
                                            Add to Workspace <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'components' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {PUBLIC_COMPONENTS.map((item) => (
                            <div key={item.id} className="group bg-card rounded-2xl border border-white/20 ring-1 ring-white/10 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_-12px_rgba(168,85,247,0.15)] hover:border-primary/30 h-full shadow-lg shadow-primary/5">
                                <div className="aspect-video bg-accent/30 relative overflow-hidden">
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        fill
                                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                                        unoptimized
                                    />
                                    <div className="absolute top-4 right-4 bg-card/90 backdrop-blur text-foreground px-3 py-1 rounded-full text-xs font-bold shadow-sm tracking-wider uppercase">
                                        {item.price}
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-grow">
                                    <h3 className="text-lg font-bold text-foreground mb-2 leading-tight group-hover:text-primary transition-colors">{item.name}</h3>
                                    <p className="text-muted-foreground text-sm mb-6 flex-grow leading-relaxed">{item.description}</p>
                                    <Link href="/workspace/projects" className="mt-auto">
                                        <Button className="w-full bg-primary hover:opacity-90 text-primary-foreground shadow-xl shadow-primary/20 transition-all h-11 font-bold hover:scale-[1.02] active:scale-[0.98]">
                                            Add to Workspace <ArrowRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'tools' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {PUBLIC_TOOLS.map((item) => (
                            <div key={item.id} className="group bg-card rounded-2xl border border-white/20 ring-1 ring-white/10 p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_25px_50px_-12px_rgba(168,85,247,0.15)] hover:border-primary/30 items-center text-center shadow-lg shadow-primary/5">
                                <div className="w-16 h-16 bg-primary/5 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    {item.icon === 'code' ? (
                                        <Wrench className="w-8 h-8" />
                                    ) : (
                                        <CodepenIcon className="w-8 h-8" />
                                    )}
                                </div>
                                <h3 className="text-2xl font-bold text-foreground mb-3">{item.name}</h3>
                                <p className="text-muted-foreground mb-8">{item.description}</p>
                                <Link href={`/workspace/import?source=${item.source}`} className="w-full">
                                    <Button size="lg" className="w-full bg-primary hover:opacity-90 text-primary-foreground shadow-xl shadow-primary/20 font-bold px-12 transition-all hover:scale-[1.02] active:scale-[0.98]">
                                        Use Tool <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }
            `}
        >
            {icon}
            {label}
        </button>
    )
}
