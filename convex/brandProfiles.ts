import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireCurrentUser, requireOrganizationAccess } from "./lib/auth";

export const DEFAULT_BRAND_PROFILE = {
  displayName: "Meridian",
  primaryColor: "#171612",
  accentColor: "#C2593B",
  tone: "precise",
  reportTitle: "Customer evidence report",
  reportFooter: "Confidential research",
  headingFont: "serif",
  bodyFont: "sans",
} as const;

const toneValidator = v.union(v.literal("precise"), v.literal("warm"), v.literal("direct"));
type BrandTone = "precise" | "warm" | "direct";

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const profile = await findProfile(ctx);
    if (!profile) return { ...DEFAULT_BRAND_PROFILE };
    const logoUrl = profile.logoStorageId
      ? (await ctx.storage.getUrl(profile.logoStorageId)) ?? undefined
      : undefined;
    return {
      displayName: profile.displayName,
      primaryColor: profile.primaryColor,
      accentColor: profile.accentColor,
      tone: normalizeTone(profile.tone),
      reportTitle: profile.reportTitle?.trim() || DEFAULT_BRAND_PROFILE.reportTitle,
      reportFooter: profile.reportFooter?.trim() || DEFAULT_BRAND_PROFILE.reportFooter,
      headingFont: profile.headingFont ?? DEFAULT_BRAND_PROFILE.headingFont,
      bodyFont: profile.bodyFont ?? DEFAULT_BRAND_PROFILE.bodyFont,
      logoName: profile.logoName,
      logoUrl,
    };
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.string(),
    primaryColor: v.string(),
    accentColor: v.string(),
    tone: toneValidator,
    reportTitle: v.string(),
    reportFooter: v.string(),
    headingFont: v.union(v.literal("serif"), v.literal("sans")),
    bodyFont: v.union(v.literal("serif"), v.literal("sans")),
  },
  handler: async (ctx, args) => {
    const access = await requireDefaultOrganizationAccess(ctx);
    const profile = await findProfileForOrganization(ctx, access.organizationId);
    const fields = normalizeProfile(args);
    const now = Date.now();
    if (profile) {
      await ctx.db.patch(profile._id, { ...fields, updatedAt: now });
      return profile._id;
    }
    return await ctx.db.insert("brandProfiles", {
      organizationId: access.organizationId,
      ...fields,
      updatedAt: now,
    });
  },
});

export const generateLogoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireDefaultOrganizationAccess(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setLogo = mutation({
  args: { storageId: v.id("_storage"), logoName: v.string() },
  handler: async (ctx, args) => {
    const access = await requireDefaultOrganizationAccess(ctx);
    const profile = await findProfileForOrganization(ctx, access.organizationId);
    const now = Date.now();
    if (profile) {
      await ctx.db.patch(profile._id, { logoStorageId: args.storageId, logoName: args.logoName.trim(), updatedAt: now });
      if (profile.logoStorageId && profile.logoStorageId !== args.storageId) {
        await ctx.storage.delete(profile.logoStorageId);
      }
      return profile._id;
    }
    return await ctx.db.insert("brandProfiles", {
      organizationId: access.organizationId,
      ...DEFAULT_BRAND_PROFILE,
      logoStorageId: args.storageId,
      logoName: args.logoName.trim(),
      updatedAt: now,
    });
  },
});

export const removeLogo = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireDefaultOrganizationAccess(ctx);
    const profile = await findProfileForOrganization(ctx, access.organizationId);
    if (!profile?.logoStorageId) return;
    const storageId = profile.logoStorageId;
    await ctx.db.patch(profile._id, { logoStorageId: undefined, logoName: undefined, updatedAt: Date.now() });
    await ctx.storage.delete(storageId);
  },
});

async function findProfile(ctx: QueryCtx) {
  const access = await requireDefaultOrganizationAccess(ctx);
  return await findProfileForOrganization(ctx, access.organizationId);
}

async function requireDefaultOrganizationAccess(ctx: QueryCtx | MutationCtx) {
  const user = await requireCurrentUser(ctx);
  return await requireOrganizationAccess(ctx, user.defaultOrganizationId!);
}

async function findProfileForOrganization(
  ctx: QueryCtx | MutationCtx,
  organizationId: Doc<"brandProfiles">["organizationId"],
) {
  const profile = await ctx.db
    .query("brandProfiles")
    .withIndex("by_organization", (index) => index.eq("organizationId", organizationId))
    .unique();
  return profile?.organizationId === organizationId ? profile : null;
}

function normalizeProfile(profile: {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  tone: BrandTone;
  reportTitle: string;
  reportFooter: string;
  headingFont: "serif" | "sans";
  bodyFont: "serif" | "sans";
}) {
  const displayName = profile.displayName.trim();
  if (!displayName) throw new Error("Enter a display name");
  return {
    displayName,
    primaryColor: normalizeColor(profile.primaryColor),
    accentColor: normalizeColor(profile.accentColor),
    tone: profile.tone,
    reportTitle: profile.reportTitle.trim() || DEFAULT_BRAND_PROFILE.reportTitle,
    reportFooter: profile.reportFooter.trim() || DEFAULT_BRAND_PROFILE.reportFooter,
    headingFont: profile.headingFont,
    bodyFont: profile.bodyFont,
  };
}

function normalizeColor(color: string) {
  const normalized = color.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) throw new Error("Use a six-digit hex color");
  return normalized;
}

function normalizeTone(tone?: string): BrandTone {
  return tone === "warm" || tone === "direct" || tone === "precise" ? tone : "precise";
}
