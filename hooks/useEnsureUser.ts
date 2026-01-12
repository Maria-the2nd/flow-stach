"use client";

import { useEffect, useRef } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Ensures the authenticated Clerk user exists in Convex.
 * Calls users.ensureFromClerk mutation once per session.
 */
export function useEnsureUser() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const ensureFromClerk = useMutation(api.users.ensureFromClerk);
  const hasCalledRef = useRef(false);

  useEffect(() => {
    if (isLoading || !isAuthenticated || hasCalledRef.current) {
      return;
    }

    hasCalledRef.current = true;
    ensureFromClerk().catch((error) => {
      console.error("Failed to ensure user:", error);
      hasCalledRef.current = false; // Allow retry on failure
    });
  }, [isAuthenticated, isLoading, ensureFromClerk]);
}
