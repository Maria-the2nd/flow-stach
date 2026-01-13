"use client"

import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  Copy01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

export default function ExtensionPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <HugeiconsIcon icon={Copy01Icon} className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Flow Stach Chrome Extension</h1>
          <p className="mt-2 text-muted-foreground">
            Required for copying components to Webflow Designer
          </p>
        </div>

        {/* Why needed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-amber-500" />
              Why is this needed?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Web browsers restrict how websites can write to the clipboard for security reasons.
              Custom data formats like Webflow&apos;s component JSON can only be written to
              the &quot;web clipboard&quot; - which other websites can read, but native apps cannot.
            </p>
            <p>
              <strong className="text-foreground">Webflow Designer is a native app</strong> (Electron-based),
              so it cannot read data copied from a website using standard web APIs.
            </p>
            <p>
              This Chrome extension has elevated permissions that allow it to write directly
              to your system clipboard in a format Webflow Designer can read.
            </p>
          </CardContent>
        </Card>

        {/* Installation */}
        <Card>
          <CardHeader>
            <CardTitle>Installation (Developer Mode)</CardTitle>
            <CardDescription>
              Until we publish to Chrome Web Store, install manually:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  1
                </span>
                <span>
                  Download the extension folder from the{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">flow-stach-extension</code>{" "}
                  directory in the project repo
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  2
                </span>
                <span>
                  Open Chrome and go to{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">chrome://extensions</code>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  3
                </span>
                <span>
                  Enable <strong>Developer mode</strong> using the toggle in the top right corner
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  4
                </span>
                <span>
                  Click <strong>Load unpacked</strong> and select the{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5">flow-stach-extension</code> folder
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  5
                </span>
                <span>
                  <strong>Refresh this page</strong> to activate the extension
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How to Use</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <span>Navigate to any component on Flow Stach</span>
              </li>
              <li className="flex items-start gap-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <span>Click <strong>Copy to Webflow</strong> in the Actions panel</span>
              </li>
              <li className="flex items-start gap-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <span>Open Webflow Designer and click on the canvas</span>
              </li>
              <li className="flex items-start gap-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <span>Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Cmd+V</kbd> (Mac) or <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs">Ctrl+V</kbd> (Windows)</span>
              </li>
              <li className="flex items-start gap-3">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <span>The component appears with all elements and styles!</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/assets">
              Browse Components
              <HugeiconsIcon icon={ArrowRight01Icon} className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground">
          The extension only activates on Flow Stach pages and requests minimal permissions
          (clipboard write only). Your browsing data is never collected.
        </p>
      </div>
    </div>
  )
}
