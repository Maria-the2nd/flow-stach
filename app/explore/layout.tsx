
import { PublicNav } from "@/components/navigation/public-nav";

export default function ExploreLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/30 selection:text-primary">
            <PublicNav />
            {children}
        </div>
    );
}
