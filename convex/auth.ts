import { QueryCtx, MutationCtx } from "./_generated/server"
import { Doc } from "./_generated/dataModel"
import { ConvexError } from "convex/values"

// Get the current user from Clerk identity
export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) return null

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique()

  return user
}

// Require authentication - throws if not authenticated
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx)
  if (!user) {
    throw new ConvexError("Authentication required")
  }
  return user
}

// Require admin role - throws if not admin
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireAuth(ctx)
  if (user.role !== "admin") {
    throw new ConvexError("Admin access required")
  }
  return user
}

// Type for authenticated context
export type AuthenticatedCtx = {
  user: Doc<"users">
}
