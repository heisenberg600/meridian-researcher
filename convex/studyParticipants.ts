import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const preferredMode = v.union(v.literal("form"), v.literal("voice"), v.literal("either"));

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

async function requireStudyAccess(
  ctx: Pick<QueryCtx, "auth" | "db">,
  studyId: Id<"studies">,
) {
  const user = await requireUser(ctx);
  const study = await ctx.db.get(studyId);
  if (!study || study.organizationId !== user.defaultOrganizationId) {
    throw new Error("Study not found");
  }
  return { user, study };
}

export const listForStudy = query({
  args: { studyId: v.id("studies"), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    const participants = await ctx.db
      .query("studyParticipants")
      .withIndex("by_study", (q) => q.eq("studyId", args.studyId))
      .order("desc")
      .collect();
    return args.includeArchived
      ? participants
      : participants.filter((participant) => participant.status !== "archived");
  },
});

export const create = mutation({
  args: {
    studyId: v.id("studies"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    segment: v.optional(v.string()),
    preferredMode,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, study } = await requireStudyAccess(ctx, args.studyId);
    const fields = normalizeParticipantFields(args);
    if (!fields.name) throw new Error("Participant name is required");
    if (!fields.email && !fields.phone) throw new Error("Add an email address or phone number");

    await ensureUniqueContact(ctx, study._id, fields.email, fields.phone);
    const now = Date.now();
    const participantId = await ctx.db.insert("studyParticipants", {
      organizationId: study.organizationId,
      studyId: study._id,
      ...fields,
      preferredMode: args.preferredMode,
      consentStatus: "unknown",
      status: "draft",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit(ctx, study.organizationId, study._id, user._id, "participant.created", {
      participantId,
      name: fields.name,
    });
    return participantId;
  },
});

export const update = mutation({
  args: {
    participantId: v.id("studyParticipants"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    segment: v.optional(v.string()),
    preferredMode,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");
    const { user, study } = await requireStudyAccess(ctx, participant.studyId);
    const fields = normalizeParticipantFields(args);
    if (!fields.name) throw new Error("Participant name is required");
    if (!fields.email && !fields.phone) throw new Error("Add an email address or phone number");

    await ensureUniqueContact(ctx, study._id, fields.email, fields.phone, participant._id);
    await ctx.db.patch(participant._id, {
      ...fields,
      preferredMode: args.preferredMode,
      updatedAt: Date.now(),
    });
    await recordAudit(ctx, study.organizationId, study._id, user._id, "participant.updated", {
      participantId: participant._id,
      name: fields.name,
    });
  },
});

export const archive = mutation({
  args: { participantId: v.id("studyParticipants") },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");
    const { user, study } = await requireStudyAccess(ctx, participant.studyId);
    await ctx.db.patch(participant._id, { status: "archived", updatedAt: Date.now() });
    await recordAudit(ctx, study.organizationId, study._id, user._id, "participant.archived", {
      participantId: participant._id,
      name: participant.name,
    });
  },
});

function normalizeParticipantFields(args: {
  name: string;
  email?: string;
  phone?: string;
  segment?: string;
  notes?: string;
}) {
  const optional = (value?: string) => value?.trim() || undefined;
  return {
    name: args.name.trim(),
    email: optional(args.email)?.toLowerCase(),
    phone: optional(args.phone),
    segment: optional(args.segment),
    notes: optional(args.notes),
  };
}

async function ensureUniqueContact(
  ctx: MutationCtx,
  studyId: Id<"studies">,
  email?: string,
  phone?: string,
  exceptId?: Id<"studyParticipants">,
) {
  const participants = await ctx.db
    .query("studyParticipants")
    .withIndex("by_study", (q) => q.eq("studyId", studyId))
    .collect();
  const duplicate = participants.find(
    (participant) =>
      participant._id !== exceptId &&
      participant.status !== "archived" &&
      ((email && participant.email === email) || (phone && participant.phone === phone)),
  );
  if (duplicate) {
    throw new ConvexError({
      code: "DUPLICATE_PARTICIPANT_CONTACT",
      message: "A participant with this email or phone already exists",
    });
  }
}

async function recordAudit(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
  studyId: Id<"studies">,
  actorUserId: Id<"users">,
  eventType: string,
  metadata: Record<string, unknown>,
) {
  await ctx.db.insert("auditEvents", {
    organizationId,
    studyId,
    actorUserId,
    actorType: "user",
    eventType,
    summary: String(metadata.name ?? eventType),
    metadata,
    createdAt: Date.now(),
  });
}
