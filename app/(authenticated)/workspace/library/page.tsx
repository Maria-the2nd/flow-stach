"use client";

import { Button } from "@/components/ui/button";
import { LayoutTemplate, Search, ShoppingCart } from "lucide-react";
import Link from 'next/link';
import Image from "next/image";

const MOCK_TEMPLATES = [
    {
        id: 't1',
        name: 'Nexus SaaS Dashboard',
        description: 'Modern dashboard with 20+ pages and custom dark mode.',
        price: 'Purchased',
        image: 'https://images.unsplash.com/photo-1551288049-bbbda536639a?auto=format&fit=crop&q=80&w=400&h=250',
        author: 'FlowDesign'
    },
    {
        id: 't2',
        name: 'Vura Multi-Purpose',
        description: 'Clean marketing site for tech companies.',
        price: 'Purchased',
        image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400&h=250',
        author: 'Minimalist'
    }
];

export default function TemplatesPage() {
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Templates Library</h1>
                    <p className="text-muted-foreground mt-1">Manage your purchased premium templates.</p>
                </div>
                <Link href="/explore">
                    <Button className="bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20 font-bold px-6 h-11 rounded-xl transition-all btn-premium">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Explore Store
                    </Button>
                </Link>
            </div>

            <div className="flex items-center gap-4 bg-accent/20 backdrop-blur border border-border/50 rounded-2xl p-4 shadow-sm">
                <Search className="w-5 h-5 text-muted-foreground ml-2" />
                <input
                    type="text"
                    placeholder="Search your library..."
                    className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-muted-foreground/60 text-foreground"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {MOCK_TEMPLATES.map((template) => (
                    <div key={template.id} className="group bg-card/80 backdrop-blur-xl rounded-[28px] border border-white/20 ring-1 ring-white/10 overflow-hidden hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500 flex flex-col h-full shadow-xl shadow-primary/5 relative">
                        <div className="aspect-video bg-accent/30 relative overflow-hidden">
                            <Image
                                src={template.image}
                                alt={template.name}
                                fill
                                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                unoptimized
                            />
                            <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm tracking-wider uppercase">
                                {template.price}
                            </div>
                        </div>
                        <div className="p-7 flex flex-col flex-grow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors leading-tight">{template.name}</h3>
                            </div>
                            <p className="text-muted-foreground text-sm mb-6 flex-grow leading-relaxed">
                                {template.description}
                            </p>
                            <div className="pt-5 border-t border-border/50 flex items-center justify-between mt-auto">
                                <span className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">{template.author}</span>
                                <Button className="bg-primary hover:opacity-90 text-primary-foreground shadow-xl shadow-primary/20 font-bold px-6 h-10 rounded-xl transition-all text-xs btn-premium">
                                    Use Template
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Marketplace Upsell */}
                <Link href="/explore" className="group relative border-2 border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center p-12 text-center bg-white/[0.02] backdrop-blur-xl hover:bg-white/[0.05] hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 cursor-pointer shadow-xl shadow-primary/5 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <div className="w-20 h-20 rounded-[24px] bg-primary/10 border border-primary/20 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-2xl shadow-primary/10">
                        <LayoutTemplate className="w-10 h-10 text-primary" />
                    </div>
                    <h3 className="font-black text-foreground text-2xl tracking-tight mb-3">Purchase Templates</h3>
                    <p className="text-sm text-muted-foreground max-w-xs leading-relaxed font-medium">Find high-conversion layouts designed by experts in our marketplace.</p>
                    <div className="mt-8 px-8 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-500">
                        Explore Store
                    </div>
                </Link>
            </div>
        </div>
    );
}
