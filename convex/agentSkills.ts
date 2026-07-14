import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BUILTIN_SKILL_NAMES = new Set(["research-strategy"]);

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
  return { ...user, defaultOrganizationId: user.defaultOrganizationId };
}

async function requireChatAccess(
  ctx: Pick<QueryCtx, "auth" | "db">,
  chatSessionId: Id<"chatSessions">,
) {
  const user = await requireUser(ctx);
  const chatSession = await ctx.db.get(chatSessionId);
  if (!chatSession || chatSession.organizationId !== user.defaultOrganizationId) {
    throw new Error("Chat not found");
  }

  const study = await ctx.db.get(chatSession.studyId);
  if (!study || study.organizationId !== user.defaultOrganizationId) {
    throw new Error("Study not found");
  }

  return { user, study, chatSession };
}

export const listMine = query({
  args: {
    includeInactive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.defaultOrganizationId;
    const organizationSkills = await ctx.db
      .query("agentSkills")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const globalSkills = await ctx.db
      .query("agentSkills")
      .withIndex("by_organization", (q) => q.eq("organizationId", undefined))
      .collect();

    return [...organizationSkills, ...globalSkills]
      .filter((skill) => args.includeInactive || skill.isActive)
      .filter(
        (skill) =>
          skill.scope === "global" ||
          skill.organizationId === organizationId ||
          skill.ownerUserId === user._id,
      )
      .sort((a, b) => a.name.localeCompare(b.name) || b.version - a.version);
  },
});

export const upsertOrganizationSkill = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const organizationId = user.defaultOrganizationId;
    const name = normalizeSkillName(args.name);
    const description = args.description.trim();
    const content = args.content.trim();
    if (!description || description.length > 1024) {
      throw new Error("Skill description must be 1-1024 characters");
    }
    if (!content || content.length > 40_000) {
      throw new Error("Skill content must be 1-40000 characters");
    }

    const latest = await latestOrganizationSkill(ctx, organizationId, name);
    const now = Date.now();
    const skillId = await ctx.db.insert("agentSkills", {
      organizationId,
      name,
      description,
      content,
      scope: "organization",
      version: (latest?.version ?? 0) + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    if (latest?._id) {
      await ctx.db.patch(latest._id, {
        isActive: false,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditEvents", {
      organizationId,
      actorUserId: user._id,
      actorType: "user",
      eventType: "agent_skill.upserted",
      summary: `Saved agent skill "${name}"`,
      metadata: { skillId, name },
      createdAt: now,
    });

    return skillId;
  },
});

export const deactivateOrganizationSkill = mutation({
  args: {
    skillId: v.id("agentSkills"),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const skill = await ctx.db.get(args.skillId);
    if (!skill || skill.organizationId !== user.defaultOrganizationId) {
      throw new Error("Skill not found");
    }
    const organizationId = skill.organizationId;
    if (!organizationId) throw new Error("Skill not found");

    const now = Date.now();
    await ctx.db.patch(args.skillId, {
      isActive: false,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId,
      actorUserId: user._id,
      actorType: "user",
      eventType: "agent_skill.deactivated",
      summary: `Deactivated agent skill "${skill.name}"`,
      metadata: { skillId: args.skillId, name: skill.name },
      createdAt: now,
    });
  },
});

export const setChatActiveSkills = mutation({
  args: {
    chatSessionId: v.id("chatSessions"),
    skillNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, chatSession } = await requireChatAccess(ctx, args.chatSessionId);
    if (chatSession.activeAgentRunId) {
      throw new Error("Cannot change skills while Meridian is responding");
    }

    const skillNames = [...new Set(args.skillNames.map(normalizeSkillName))];
    if (skillNames.length === 0 || skillNames.length > 8) {
      throw new Error("Choose between 1 and 8 active skills");
    }
    await assertSkillsAvailable(ctx, {
      organizationId: chatSession.organizationId,
      userId: user._id,
      skillNames,
    });

    const now = Date.now();
    await ctx.db.patch(chatSession._id, {
      activeSkillNames: skillNames,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      organizationId: chatSession.organizationId,
      studyId: chatSession.studyId,
      actorUserId: user._id,
      actorType: "user",
      eventType: "chat_session.skills_updated",
      summary: `Updated active skills for "${chatSession.title}"`,
      metadata: { chatSessionId: chatSession._id, skillNames },
      createdAt: now,
    });
  },
});

async function latestOrganizationSkill(
  ctx: Pick<MutationCtx, "db">,
  organizationId: Id<"organizations">,
  name: string,
) {
  const rows = await ctx.db
    .query("agentSkills")
    .withIndex("by_name", (q) => q.eq("name", name))
    .collect();
  return rows
    .filter((skill) => skill.organizationId === organizationId)
    .sort((a, b) => b.version - a.version)[0];
}

async function assertSkillsAvailable(
  ctx: Pick<MutationCtx, "db">,
  args: {
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    skillNames: string[];
  },
) {
  for (const name of args.skillNames) {
    if (BUILTIN_SKILL_NAMES.has(name)) continue;

    const rows = await ctx.db
      .query("agentSkills")
      .withIndex("by_name", (q) => q.eq("name", name))
      .collect();
    const available = rows.some(
      (skill) =>
        skill.isActive &&
        (skill.scope === "global" ||
          skill.organizationId === args.organizationId ||
          skill.ownerUserId === args.userId),
    );
    if (!available) throw new Error(`Skill "${name}" is not available`);
  }
}

function normalizeSkillName(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!SKILL_NAME_PATTERN.test(normalized) || normalized.length > 64) {
    throw new Error("Skill name must be 1-64 lowercase letters, numbers, or single hyphens");
  }
  return normalized;
}
