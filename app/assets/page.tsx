import { redirect } from "next/navigation"

// Legacy route redirect - maintains backwards compatibility for old bookmarks
export default function AssetsPage() {
  redirect("/workspace/projects")
}
