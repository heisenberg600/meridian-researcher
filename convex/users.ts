import { mutation, query } from "./_generated/server";

function workspaceNameFromIdentity(identity: { name?: string; email?: string }) {
  const displayName = identity.name ?? identity.email;
  return displayName ? `${displayName}'s workspace` : "Personal workspace";
}

function shouldRepairDefaultWorkspaceName(name: string) {
  return (
    name === "Hermes user's workspace" ||
    name === "Meridian user's workspace" ||
    name === "Hermes Researcher's workspace"
  );
}

function displayOrganizationName(name: string) {
  return shouldRepairDefaultWorkspaceName(name) ? "Personal workspace" : name;
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

    return {
      user,
      organization: organization
        ? { ...organization, name: displayOrganizationName(organization.name) }
        : null,
    };
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
        const organization = await ctx.db.get(existing.defaultOrganizationId);
        if (organization && shouldRepairDefaultWorkspaceName(organization.name)) {
          await ctx.db.patch(organization._id, {
            name: workspaceNameFromIdentity(identity),
            updatedAt: Date.now(),
          });
        }
        return {
          userId: existing._id,
          organizationId: existing.defaultOrganizationId,
        };
      }

      const now = Date.now();
      const organizationId = await ctx.db.insert("organizations", {
        name: workspaceNameFromIdentity(identity),
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
      name: workspaceNameFromIdentity(identity),
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
