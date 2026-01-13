import { ReactNode } from "react";

interface AppShellProps {
  sidebar: ReactNode;
  main: ReactNode;
  context: ReactNode;
  banner?: ReactNode;
}

export function AppShell({ sidebar, main, context, banner }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {banner ? <div className="px-6 pt-6 pb-6">{banner}</div> : null}
      <div className="grid h-screen grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_280px]">
        {/* Sidebar */}
        <aside className="hidden h-screen border-r border-border bg-transparent md:block">
          {sidebar}
        </aside>

        {/* Main content */}
        <main className="flex flex-col overflow-auto bg-background">
          {main}
        </main>

        {/* Context panel */}
        <aside className="hidden h-screen border-l border-border bg-transparent lg:block">
          {context}
        </aside>
      </div>
    </div>
  );
}
