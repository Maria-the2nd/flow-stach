import { UserNav } from "@/components/navigation/user-nav";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
            <UserNav />
            {children}
        </div>
    );
}
