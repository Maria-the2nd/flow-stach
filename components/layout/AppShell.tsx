import { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  context: ReactNode;
}

export function AppShell({ sidebar, main, context }: AppShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_280px]">
      {/* Sidebar */}
      <aside className="hidden border-r border-border bg-sidebar md:block">
        {sidebar}
      </aside>

      {/* Main content */}
      <main className="flex flex-col overflow-auto bg-background">
        {main}
      </main>

      {/* Context panel */}
      <aside className="hidden border-l border-border bg-background lg:block">
        {context}
      </aside>
    </div>
  );
}
