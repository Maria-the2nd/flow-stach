
"use client";

import { useState } from "react";
import { PUBLIC_TEMPLATES, PUBLIC_COMPONENTS, PUBLIC_TOOLS } from "./mock-data";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { Layers, Box, Wrench, ArrowRight } from "lucide-react";

export function ExploreView() {
    const [activeTab, setActiveTab] = useState<'templates' | 'components' | 'tools'>('templates');

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="text-center mb-16 space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                    Explore the Supply
                </h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    Discover high-quality templates, components, and tools to accelerate your workflow.
                    Everything you need to build better, faster.
                </p>
            </div>

            <div className="flex justify-center mb-12">
                <div className="bg-slate-100 p-1.5 rounded-xl inline-flex gap-1 shadow-inner">
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
                            <div key={item.id} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-slate-300 transition-all duration-300 flex flex-col h-full">
                                <div className="aspect-video bg-slate-50 relative overflow-hidden">
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-slate-900 px-3 py-1 rounded-full text-xs font-bold shadow-sm tracking-wider uppercase">
                                        {item.price}
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-grow">
                                    <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{item.name}</h3>
                                    <p className="text-slate-500 text-sm mb-6 flex-grow leading-relaxed">{item.description}</p>
                                    <Link href="/workspace/projects" className="mt-auto">
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white group-hover:shadow-lg shadow-blue-200/50 transition-all h-11 font-bold">
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
                            <div key={item.id} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-slate-300 transition-all duration-300 flex flex-col h-full">
                                <div className="aspect-video bg-slate-50 relative overflow-hidden">
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                    />
                                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur text-slate-900 px-3 py-1 rounded-full text-xs font-bold shadow-sm tracking-wider uppercase">
                                        {item.price}
                                    </div>
                                </div>
                                <div className="p-6 flex flex-col flex-grow">
                                    <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight group-hover:text-blue-600 transition-colors">{item.name}</h3>
                                    <p className="text-slate-500 text-sm mb-6 flex-grow leading-relaxed">{item.description}</p>
                                    <Link href="/workspace/projects" className="mt-auto">
                                        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white group-hover:shadow-lg shadow-blue-200/50 transition-all h-11 font-bold">
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
                            <div key={item.id} className="group bg-white rounded-2xl border border-slate-200 p-8 hover:shadow-xl hover:border-slate-300 transition-all duration-300 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Wrench className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 mb-3">{item.name}</h3>
                                <p className="text-slate-500 mb-8">{item.description}</p>
                                <Link href="/workspace/projects">
                                    <Button size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-200/50 font-bold">
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
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                }
            `}
        >
            {icon}
            {label}
        </button>
    )
}
