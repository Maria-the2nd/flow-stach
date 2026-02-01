import { UserNav } from "@/components/navigation/user-nav";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-transparent font-sans text-foreground">
            <UserNav />
            {children}
        </div>
    );
}
