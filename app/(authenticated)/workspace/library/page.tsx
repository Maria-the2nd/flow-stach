"use client";

import { Button } from "@/components/ui/button";
import { LayoutTemplate, Search, ShoppingCart } from "lucide-react";
import Link from 'next/link';

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
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Templates Library</h1>
                    <p className="text-slate-500 mt-1">Manage your purchased premium templates.</p>
                </div>
                <Link href="/explore">
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200/50 font-bold px-6 h-11 rounded-xl transition-all">
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Explore Store
                    </Button>
                </Link>
            </div>

            <div className="flex items-center gap-4 bg-white/50 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-sm">
                <Search className="w-5 h-5 text-slate-400 ml-2" />
                <input
                    type="text"
                    placeholder="Search your library..."
                    className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-slate-400"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {MOCK_TEMPLATES.map((template) => (
                    <div key={template.id} className="group bg-white/90 backdrop-blur-xl rounded-[28px] border border-slate-200 overflow-hidden hover:shadow-2xl hover:border-slate-300 transition-all duration-500 flex flex-col h-full shadow-xl shadow-slate-200/50 relative">
                        <div className="aspect-video bg-slate-100 relative overflow-hidden">
                            <img
                                src={template.image}
                                alt={template.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                            <div className="absolute top-4 right-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm tracking-wider uppercase">
                                {template.price}
                            </div>
                        </div>
                        <div className="p-7 flex flex-col flex-grow">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">{template.name}</h3>
                            </div>
                            <p className="text-slate-500 text-sm mb-6 flex-grow leading-relaxed">
                                {template.description}
                            </p>
                            <div className="pt-5 border-t border-slate-100 flex items-center justify-between mt-auto">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{template.author}</span>
                                <Button className="bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200/50 font-bold px-6 h-10 rounded-xl transition-all text-xs">
                                    Use Template
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Marketplace Upsell */}
                <Link href="/explore" className="group border-2 border-dashed border-slate-200 rounded-[28px] flex flex-col items-center justify-center p-10 text-center !bg-white/40 backdrop-blur hover:!bg-white hover:border-blue-300 hover:shadow-2xl transition-all cursor-pointer shadow-lg shadow-slate-200/30">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                        <LayoutTemplate className="w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-lg">Purchase Templates</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">Find high-conversion layouts designed by experts in our marketplace.</p>
                </Link>
            </div>
        </div>
    );
}
