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
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Component Library</h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">Standalone premium components for your projects.</p>
                </div>
                <Link href="/explore" className="shrink-0">
                    <Button className="bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20 font-bold px-4 sm:px-6 h-11 rounded-xl transition-all w-full sm:w-auto">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Get More
                    </Button>
                </Link>
            </div>

            <div className="flex items-center gap-4 bg-accent/20 backdrop-blur border border-border/50 rounded-2xl p-4 shadow-sm">
                <Search className="w-5 h-5 text-muted-foreground ml-2" />
                <input
                    type="text"
                    placeholder="Search components..."
                    className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-muted-foreground/60 text-foreground"
                />
            </div>

            <div className="grid grid-cols-1 gap-6">
                {MOCK_COMPONENTS.map((component) => (
                    <div key={component.id} className="group bg-card/80 backdrop-blur-xl rounded-3xl border border-white/20 ring-1 ring-white/10 overflow-hidden hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500 flex flex-col sm:flex-row shadow-xl shadow-primary/5">
                        <div className="w-full sm:w-72 h-56 sm:h-auto bg-accent/30 relative shrink-0 group/image border-b sm:border-b-0 sm:border-r border-white/10">
                            <Image
                                src={component.image}
                                alt={component.title}
                                fill
                                sizes="(max-width: 640px) 100vw, 300px"
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                unoptimized
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                                <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white hover:border-white/40 font-bold tracking-wide uppercase text-[10px] h-8 rounded-lg backdrop-blur-md">
                                    Change Cover
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 text-center sm:text-left">
                            <div className="space-y-3 flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-center sm:justify-start">
                                    <h3 className="font-bold text-foreground text-lg sm:text-2xl group-hover:text-primary transition-colors break-words text-center sm:text-left tracking-tight">{component.title}</h3>
                                    <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap shrink-0 ring-1 ring-primary/20">{component.category}</span>
                                </div>
                                <p className="text-muted-foreground text-sm leading-relaxed text-center sm:text-left font-medium max-w-xl">
                                    {component.description}
                                </p>
                                <div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest flex flex-col sm:flex-row items-center gap-2 justify-center sm:justify-start pt-2">
                                    <Box className="w-3 h-3 shrink-0" />
                                    By {component.author}
                                </div>
                            </div>
                            <div className="flex flex-row sm:flex-col gap-3 sm:gap-4 shrink-0 w-full sm:w-auto">
                                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground font-bold h-11 px-4 sm:px-6 rounded-xl flex-1 sm:flex-none border border-transparent hover:border-white/10 hover:bg-white/5">
                                    Preview
                                </Button>
                                <Button className="bg-primary hover:opacity-90 text-primary-foreground shadow-xl shadow-primary/20 font-black h-11 px-6 sm:px-8 rounded-xl transition-all flex-1 sm:flex-none whitespace-nowrap hover:scale-[1.02] active:scale-[0.98]">
                                    <span className="hidden sm:inline">Copy to Webflow</span>
                                    <span className="sm:hidden">Copy</span>
                                    <ExternalLink className="w-4 h-4 ml-2 shrink-0" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Marketplace Upsell */}
                <Link href="/explore" className="group relative border-2 border-dashed border-white/10 rounded-[40px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 p-8 sm:p-12 hover:bg-white/[0.04] hover:border-primary/50 transition-all duration-500 cursor-pointer bg-white/[0.02] backdrop-blur-xl shadow-2xl shadow-primary/5 text-center sm:text-left overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 flex-1 min-w-0 relative z-10">
                        <div className="w-20 h-20 rounded-[28px] bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-primary/10">
                            <Cuboid className="w-10 h-10 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-black text-foreground text-2xl tracking-tight mb-2">Needs more parts?</h3>
                            <p className="text-sm text-muted-foreground font-medium max-w-lg leading-relaxed">Discover hundreds of pre-built sections ready for your projects.</p>
                        </div>
                    </div>
                    <Button variant="ghost" className="relative z-10 text-primary font-black uppercase tracking-[0.2em] text-[10px] hover:bg-primary hover:text-primary-foreground h-14 px-10 rounded-2xl w-full sm:w-auto shrink-0 border border-primary/20 transition-all duration-300">
                        Browse Components
                    </Button>
                </Link>
            </div>
        </div>
    );
}
