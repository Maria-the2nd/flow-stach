"use client";

import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function PublicNav() {
    const { isSignedIn } = useUser();

    return (
        <header className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                    <span className="text-white font-bold font-sans">B</span>
                </div>
                <span className="font-bold text-xl text-slate-900 tracking-tight font-sans">FLOW BRIDGE</span>
            </div>
            <div className="flex items-center gap-6">
                {isSignedIn ? (
                    <>
                        <Link href="/workspace/projects" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                            Go to Workspace
                        </Link>
                        <UserButton afterSignOutUrl="/explore" />
                    </>
                ) : (
                    <>
                        <SignInButton mode="modal">
                            <button className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                                Log In
                            </button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm px-5">
                                Sign Up
                            </Button>
                        </SignUpButton>
                    </>
                )}
            </div>
        </header>
    );
}
