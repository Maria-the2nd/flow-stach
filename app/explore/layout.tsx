
import { PublicNav } from "@/components/navigation/public-nav";

export default function ExploreLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-blue-600 selection:text-white">
            <PublicNav />
            {children}
        </div>
    );
}
