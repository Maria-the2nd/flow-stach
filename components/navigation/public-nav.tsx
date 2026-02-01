"use client";

import Link from 'next/link';
import { FlowPartyLogo } from './FlowPartyLogo';
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from './ThemeToggle';

export function PublicNav() {
    const { isSignedIn } = useUser();

    return (
        <header className="flex items-center justify-between px-10 py-6 border-b border-border/50 bg-card/40 backdrop-blur-xl sticky top-0 z-50 shadow-xl shadow-background/50">
            <Link href="/" className="flex items-center">
                <FlowPartyLogo
                    className="text-primary dark:text-white"
                    width={140}
                    height={32}
                />
            </Link>
            <div className="flex items-center gap-6">
                <ThemeToggle />
                {isSignedIn ? (
                    <>
                        <Link href="/workspace/projects" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                            Go to Workspace
                        </Link>
                        <UserButton afterSignOutUrl="/explore" />
                    </>
                ) : (
                    <>
                        <SignInButton mode="modal">
                            <button className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-all px-4 py-2 hover:bg-accent/30 rounded-xl">
                                Log In
                            </button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <Button size="sm" className="bg-primary text-primary-foreground hover:opacity-90 shadow-2xl shadow-primary/20 px-8 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest">
                                Join Beta
                            </Button>
                        </SignUpButton>
                    </>
                )}
            </div>
        </header>
    );
}
