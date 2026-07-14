import { v } from "convex/values";
import { mutation } from "./_generated/server";

const timelineValidator = v.union(
  v.literal("now"),
  v.literal("quarter"),
  v.literal("exploring"),
);

function clean(value: string, maxLength: number) {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export const join = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    company: v.string(),
    role: v.string(),
    researchDecision: v.string(),
    targetAudience: v.optional(v.string()),
    timeline: timelineValidator,
    source: v.string(),
    referrer: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website) {
      return { created: false };
    }

    const email = clean(args.email, 254).toLowerCase();
    const name = clean(args.name, 120);
    const company = clean(args.company, 160);
    const role = clean(args.role, 120);
    const researchDecision = clean(args.researchDecision, 1200);
    const targetAudience = args.targetAudience
      ? clean(args.targetAudience, 500)
      : undefined;

    if (!name || !company || !role || !researchDecision) {
      throw new Error("Please complete the required fields.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid work email.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("waitlistSignups")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    const details = {
      name,
      email,
      company,
      role,
      researchDecision,
      targetAudience,
      timeline: args.timeline,
      source: clean(args.source, 120) || "landing",
      referrer: args.referrer ? clean(args.referrer, 500) : undefined,
      utmSource: args.utmSource ? clean(args.utmSource, 120) : undefined,
      utmCampaign: args.utmCampaign ? clean(args.utmCampaign, 160) : undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, details);
      return { created: false };
    }

    await ctx.db.insert("waitlistSignups", {
      ...details,
      status: "new",
      createdAt: now,
    });
    return { created: true };
  },
});
