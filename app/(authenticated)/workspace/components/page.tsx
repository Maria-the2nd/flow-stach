"use client";

import { Button } from "@/components/ui/button";
import { Cuboid, Search, ShoppingCart, ExternalLink, Box } from "lucide-react";
import Link from 'next/link';
import Image from "next/image";

const MOCK_COMPONENTS = [
    {
        id: 'c1',
        title: 'Premium Hero Section',
        category: 'Hero',
        description: 'Spline-integrated hero section with glassmorphism effects.',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=300&h=200',
        author: 'FlowBridge'
    },
    {
        id: 'c2',
        title: 'Glass Sticky Nav',
        category: 'Navigation',
        description: 'Advanced sticky navigation with blurred background and micro-interactions.',
        image: 'https://images.unsplash.com/photo-1614332287897-cdc485fa562d?auto=format&fit=crop&q=80&w=300&h=200',
        author: 'UI Labs'
    },
    {
        id: 'c3',
        title: 'Animated Card Grid',
        category: 'Grid',
        description: 'Hover-responsive card grid with subtle 3D transforms.',
        image: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&q=80&w=300&h=200',
        author: 'FlowBridge'
    }
];

export default function ComponentsPage() {
    return (
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-center sm:text-left">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Component Library</h1>
                    <p className="text-slate-500 mt-1 text-sm sm:text-base">Standalone premium components for your projects.</p>
                </div>
                <Link href="/explore" className="shrink-0">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 font-bold px-4 sm:px-6 h-11 rounded-xl transition-all w-full sm:w-auto">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Get More
                    </Button>
                </Link>
            </div>

            <div className="flex items-center gap-4 bg-white/50 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm">
                <Search className="w-5 h-5 text-slate-400 ml-2" />
                <input
                    type="text"
                    placeholder="Search components..."
                    className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-slate-400"
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                {MOCK_COMPONENTS.map((component) => (
                    <div key={component.id} className="group bg-white/90 backdrop-blur-xl rounded-3xl border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-slate-300 transition-all duration-500 flex flex-col sm:flex-row items-stretch shadow-xl shadow-slate-200/40">
                        <div className="w-full sm:w-64 h-48 sm:h-auto bg-slate-50 flex items-center justify-center sm:border-r border-b sm:border-b-0 border-slate-100 overflow-hidden relative">
                            <Image
                                src={component.image}
                                alt={component.title}
                                fill
                                sizes="(max-width: 640px) 100vw, 256px"
                                className="object-cover group-hover:scale-110 transition-transform duration-700"
                                unoptimized
                            />
                        </div>
                        <div className="flex-1 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 text-center sm:text-left">
                            <div className="space-y-3 flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                                    <h3 className="font-bold text-slate-900 text-lg sm:text-xl group-hover:text-blue-600 transition-colors break-words text-center sm:text-left">{component.title}</h3>
                                    <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0">{component.category}</span>
                                </div>
                                <p className="text-slate-500 text-sm leading-relaxed text-center sm:text-left">
                                    {component.description}
                                </p>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex flex-col sm:flex-row items-center gap-2 justify-center sm:justify-start">
                                    <Box className="w-3 h-3 shrink-0" />
                                    By {component.author}
                                </div>
                            </div>
                            <div className="flex flex-row sm:flex-col gap-3 sm:gap-4 shrink-0 w-full sm:w-auto">
                                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 font-bold h-11 px-4 sm:px-6 rounded-xl flex-1 sm:flex-none border-black/10 focus-visible:border-black/10">
                                    Preview
                                </Button>
                                <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200/50 font-bold h-11 px-4 sm:px-8 rounded-xl transition-all flex-1 sm:flex-none whitespace-nowrap">
                                    <span className="hidden sm:inline">Copy to Webflow</span>
                                    <span className="sm:hidden">Copy</span>
                                    <ExternalLink className="w-4 h-4 ml-2 shrink-0" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Marketplace Upsell */}
                <Link href="/explore" className="group border-2 border-dashed border-slate-200 rounded-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 p-6 sm:p-8 hover:!bg-white hover:border-blue-300 transition-all cursor-pointer !bg-white/40 backdrop-blur shadow-lg shadow-slate-200/30 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 flex-1 min-w-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Cuboid className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-slate-900 text-base sm:text-lg">Needs more parts?</h3>
                            <p className="text-xs sm:text-sm text-slate-500">Discover hundreds of pre-built sections ready for your projects.</p>
                        </div>
                    </div>
                    <Button variant="ghost" className="text-blue-600 font-bold hover:bg-blue-50 h-12 px-6 sm:px-8 rounded-2xl w-full sm:w-auto shrink-0">
                        Browse Components
                    </Button>
                </Link>
            </div>
        </div>
    );
}
