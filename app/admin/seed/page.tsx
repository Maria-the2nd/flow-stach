"use client"

import { useState } from "react"
import Link from "next/link"
import { useUser, SignedIn, SignedOut, RedirectToSignIn } from "@clerk/nextjs"
import { useMutation } from "convex/react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Database01Icon, ArrowRight01Icon, Alert01Icon, CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"

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
  const seedDemoData = useMutation(api.admin.seedDemoData)
  const [isSeeding, setIsSeeding] = useState(false)
  const [result, setResult] = useState<{ assets: number; payloads: number } | null>(null)

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

  const handleSeed = async () => {
    setIsSeeding(true)
    setResult(null)

    try {
      const seedResult = await seedDemoData()
      setResult(seedResult)

      if (seedResult.assets > 0) {
        toast.success(`Seeded ${seedResult.assets} assets successfully!`)
      } else {
        toast.info("No new assets to seed - all demo data already exists.")
      }
    } catch (error) {
      console.error("Seed error:", error)
      toast.error("Failed to seed demo data. Check console for details.")
    } finally {
      setIsSeeding(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <HugeiconsIcon icon={Database01Icon} className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Seed Demo Data</CardTitle>
          <CardDescription>
            Populate the database with 18 demo assets for testing and development.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleSeed} disabled={isSeeding} className="w-full">
            {isSeeding ? "Seeding..." : "Seed Demo Data"}
          </Button>

          {result && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm">
                <HugeiconsIcon
                  icon={CheckmarkCircle01Icon}
                  className="h-4 w-4 text-emerald-500"
                />
                <span>
                  Created {result.assets} assets, {result.payloads} payloads
                </span>
              </div>
              <Link
                href="/assets"
                className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View Assets
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3" />
              </Link>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Signed in as {userEmail}
          </p>
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
