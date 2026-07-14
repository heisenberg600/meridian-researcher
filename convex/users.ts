import { mutation, query } from "./_generated/server";

function displayNameFromIdentity(identity: { name?: string; email?: string }) {
  return identity.name ?? identity.email ?? "Hermes user";
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) return null;
    const organization = user.defaultOrganizationId
      ? await ctx.db.get(user.defaultOrganizationId)
      : null;

    return { user, organization };
  },
});

export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_token_identifier", (q) =>
        q.eq("authTokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    const values = {
      authTokenIdentifier: identity.tokenIdentifier,
      clerkUserId: identity.subject,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
      lastSeenAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, values);
      if (existing.defaultOrganizationId) {
        return {
          userId: existing._id,
          organizationId: existing.defaultOrganizationId,
        };
      }

      const now = Date.now();
      const organizationId = await ctx.db.insert("organizations", {
        name: `${displayNameFromIdentity(identity)}'s workspace`,
        createdBy: existing._id,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("memberships", {
        organizationId,
        userId: existing._id,
        role: "owner",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(existing._id, { defaultOrganizationId: organizationId });

      return { userId: existing._id, organizationId };
    }

    const userId = await ctx.db.insert("users", values);
    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: `${displayNameFromIdentity(identity)}'s workspace`,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("memberships", {
      organizationId,
      userId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(userId, { defaultOrganizationId: organizationId });

    return { userId, organizationId };
  },
});
