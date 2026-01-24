import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define protected routes (require authentication)
const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/admin(.*)",
  "/workspace(.*)",
]);

// Temporarily disable auth for testing
const DISABLE_AUTH = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

export default DISABLE_AUTH
  ? () => NextResponse.next()
  : clerkMiddleware(async (auth, req) => {
      // Only protect specific routes, let everything else through
      if (isProtectedRoute(req)) {
        await auth.protect();
      }
    });

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
