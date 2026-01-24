
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';

export function UserNav() {
    const pathname = usePathname();

    const navItems = [
        { label: 'Workspace', href: '/workspace/projects', activePrefix: '/workspace' },
        { label: 'Import', href: '/workspace/import', activePrefix: '/workspace/import' },
        { label: 'Explore', href: '/explore', activePrefix: 'NONE' },
    ];

    return (
        <nav className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-8">
                <Link href="/workspace/projects" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">B</div>
                    <span className="font-bold text-slate-900 text-lg tracking-tight">FLOW BRIDGE</span>
                </Link>
                <div className="flex items-center gap-1">
                    {navItems.map(item => {
                        const active = item.activePrefix !== 'NONE' && pathname.startsWith(item.activePrefix);
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`text-sm font-medium transition-all px-3 py-1.5 rounded-md ${active
                                    ? 'text-slate-900 bg-slate-100'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Link href="/account">
                    <div className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${pathname.startsWith('/account') ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}>
                        <User className="w-4 h-4" />
                        <span>Account</span>
                    </div>
                </Link>
            </div>
        </nav>
    )
}
