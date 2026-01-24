"use client";

import { UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
    return (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Account Settings</h1>
                <p className="text-slate-500">Manage your profile and subscription.</p>
            </div>

            {/* Clerk's built-in UserProfile component handles everything */}
            <UserProfile
                appearance={{
                    elements: {
                        rootBox: "w-full",
                        card: "shadow-none border border-slate-200",
                    }
                }}
            />
        </div>
    );
}
