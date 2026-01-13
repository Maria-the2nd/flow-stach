"use client"

import { useState } from "react"
import Link from "next/link"
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Database01Icon, ArrowRight01Icon, Alert01Icon, Delete01Icon } from "@hugeicons/core-free-icons"

import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

function getAdminEmails(): string[] {
  const envValue = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ""
  return envValue
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function AdminSeedContent() {
  const { isLoaded: isUserLoaded, user } = useUser()
  const clearAllAssets = useMutation(api.admin.clearAllAssets)
  const [isClearing, setIsClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{
    deletedAssets: number
    deletedPayloads: number
    deletedFavorites: number
  } | null>(null)

  if (!isUserLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const userEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || ""
  const adminEmails = getAdminEmails()
  const isAdmin = adminEmails.includes(userEmail)

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <HugeiconsIcon icon={Alert01Icon} className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Not Authorized</CardTitle>
            <CardDescription>
              You don&apos;t have permission to access this page. Contact an administrator if you
              believe this is a mistake.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="w-full">
              <Link href="/assets">
                Return to Assets
                <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <HugeiconsIcon icon={Database01Icon} className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Database Management</CardTitle>
          <CardDescription>
            Clear all assets from the database. Use the Import tool to add new assets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={async () => {
              if (
                !confirm(
                  "Are you sure you want to delete ALL assets, payloads, and favorites? This cannot be undone."
                )
              ) {
                return
              }
              setIsClearing(true)
              setClearResult(null)
              try {
                const res = await clearAllAssets()
                setClearResult(res)
                toast.success(
                  `Cleared ${res.deletedAssets} assets, ${res.deletedPayloads} payloads, ${res.deletedFavorites} favorites`
                )
              } catch (error) {
                console.error("Clear error:", error)
                toast.error("Failed to clear assets. Check console.")
              } finally {
                setIsClearing(false)
              }
            }}
            disabled={isClearing}
            variant="destructive"
            className="w-full"
          >
            {isClearing ? "Clearing..." : "Clear All Assets"}
          </Button>

          {clearResult && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-center gap-2 text-sm">
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4 text-destructive" />
                <span>
                  Deleted {clearResult.deletedAssets} assets, {clearResult.deletedPayloads}{" "}
                  payloads, {clearResult.deletedFavorites} favorites
                </span>
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <Button variant="outline" asChild className="w-full">
              <Link href="/admin/import">
                Go to Import Tool
                <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">Signed in as {userEmail}</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminSeedPage() {
  return (
    <>
      <SignedIn>
        <AdminSeedContent />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  )
}
