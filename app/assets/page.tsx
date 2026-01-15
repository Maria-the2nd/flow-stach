import { Suspense } from "react"

import { AppShell } from "@/components/layout/AppShell"
import { Sidebar } from "@/components/sidebar/Sidebar"
import { AssetsContent } from "@/components/assets/AssetsContent"
import { AssetsBannerContainer } from "@/components/assets/AssetsBannerContainer"

export default function AssetsPage() {
  return (
    <AppShell
      banner={
        <Suspense fallback={null}>
          <AssetsBannerContainer />
        </Suspense>
      }
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
      context={null}
    />
  )
}
