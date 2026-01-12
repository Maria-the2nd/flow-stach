import { mutation } from "./_generated/server"
import { ConvexError } from "convex/values"

// Ensure user exists in database from Clerk identity
// Creates user if not exists, returns existing user if found
export const ensureFromClerk = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError("Not authenticated")
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique()

    if (existingUser) {
      return existingUser
    }

    // Create new user with default role
    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      role: "user",
      createdAt: Date.now(),
    })

    return await ctx.db.get(userId)
  },
})
