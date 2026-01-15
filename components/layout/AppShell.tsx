import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  context?: ReactNode | null;
  banner?: ReactNode;
}

export function AppShell({ sidebar, main, context, banner }: AppShellProps) {
  const hasContext = context !== null && context !== undefined;

  return (
    <div className="flex h-screen flex-col bg-background">
      {banner ? <div className="shrink-0 px-6 pt-6 pb-6">{banner}</div> : null}
      <div
        className={cn(
          "grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[240px_1fr]",
          hasContext && "lg:grid-cols-[240px_1fr_280px]"
        )}
      >
        {/* Sidebar */}
        <aside className="hidden h-full overflow-hidden border-r border-border bg-transparent md:block">
          {sidebar}
        </aside>

        {/* Main content */}
        <main className="flex flex-col overflow-auto bg-background">
          {main}
        </main>

        {/* Context panel - only render if provided */}
        {hasContext && (
          <aside className="hidden h-full overflow-hidden border-l border-border bg-transparent lg:block">
            {context}
          </aside>
        )}
      </div>
    </div>
  );
}
