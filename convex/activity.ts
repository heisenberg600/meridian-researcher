import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";

async function requireUser(ctx: Pick<QueryCtx, "auth" | "db">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_token_identifier", (q) =>
      q.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user?.defaultOrganizationId) throw new Error("User workspace has not been initialized");
  return user;
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const organizationId = user.defaultOrganizationId;
    if (!organizationId) throw new Error("User workspace has not been initialized");

    return await ctx.db
      .query("auditEvents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .order("desc")
      .take(50);
  },
});
