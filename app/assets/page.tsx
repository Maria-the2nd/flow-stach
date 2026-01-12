import { Suspense } from "react"

import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { ContextPanel } from "@/components/context/ContextPanel"
import { AssetsContent } from "@/components/assets/AssetsContent"

export default function AssetsPage() {
  return (
    <AppShell
      sidebar={
        <Suspense fallback={null}>
          <Sidebar />
        </Suspense>
      }
      main={
        <Suspense fallback={<div className="flex flex-1 items-center justify-center p-6">Loading...</div>}>
          <AssetsContent />
        </Suspense>
      }
      context={<ContextPanel />}
    />
  )
}
