import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthContext = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export async function requireCurrentUser(ctx: AuthContext): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_token_identifier", (query) =>
      query.eq("authTokenIdentifier", identity.tokenIdentifier),
    )
    .unique();

  if (!user) throw new Error("User profile has not been initialized");
  if (!user.defaultOrganizationId) throw new Error("User workspace has not been initialized");
  return user;
}

export async function requireOrganizationAccess(
  ctx: AuthContext,
  organizationId: Id<"organizations">,
) {
  const user = await requireCurrentUser(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_organization_user", (query) =>
      query.eq("organizationId", organizationId).eq("userId", user._id),
    )
    .unique();
  if (!membership || user.defaultOrganizationId !== organizationId) {
    throw new Error("Workspace not found");
  }
  return { user, membership, organizationId };
}

export async function requireStudyAccess(ctx: AuthContext, studyId: Id<"studies">) {
  const study = await ctx.db.get(studyId);
  if (!study) throw new Error("Study not found");
  const access = await requireOrganizationAccess(ctx, study.organizationId);
  return { ...access, study };
}
