
"use client";
import Link from 'next/link';
import { FlowPartyLogo } from './FlowPartyLogo';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

export function UserNav() {
    const pathname = usePathname();

    const navItems = [
        { label: 'Workspace', href: '/workspace/projects', activePrefix: '/workspace' },
        { label: 'Explore', href: '/explore', activePrefix: 'NONE' },
    ];

    return (
        <nav className="h-16 border-b border-border/50 bg-card/60 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40 shadow-lg shadow-background/50">
            <div className="flex items-center gap-6">
                <Link href="/" className="flex items-center px-2">
                    <FlowPartyLogo
                        className="text-primary dark:text-white"
                        width={130}
                        height={30}
                    />
                </Link>
                <div className="flex items-center gap-1">
                    {navItems.map(item => {
                        const active = item.activePrefix !== 'NONE' && pathname.startsWith(item.activePrefix);
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`text-sm font-black transition-all px-4 py-2 rounded-xl uppercase tracking-widest text-[10px] ${active
                                    ? 'text-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                    }`}
                            >
                                {item.label}
                            </Link>
                        )
                    })}
                </div>
            </div>
            <div className="flex items-center gap-4 px-2">
                <ThemeToggle />
                <Link href="/account">
                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${pathname.startsWith('/account') ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}>
                        <User className="w-3.5 h-3.5" />
                        <span>Account</span>
                    </div>
                </Link>
            </div>
        </nav>
    )
}
