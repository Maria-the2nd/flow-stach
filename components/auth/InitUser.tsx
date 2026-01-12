"use client";

import { useEnsureUser } from "@/hooks/useEnsureUser";

/**
 * Invisible component that ensures the authenticated user exists in Convex.
 * Place this inside ConvexClientProvider to run once per session.
 */
export function InitUser() {
  useEnsureUser();
  return null;
}
