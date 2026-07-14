import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requireOrganizationAccess } from "./lib/auth";
import { assertWholeCredits } from "./lib/billing";

export const TOP_UP_PACKS = {
  credits_1m: { credits: 1_000_000 },
  credits_3m: { credits: 3_000_000 },
  credits_10m: { credits: 10_000_000 },
} as const;

export type TopUpPackKey = keyof typeof TOP_UP_PACKS;

export type CheckoutRecord = {
  id: string;
  organizationId: string;
  packKey: TopUpPackKey;
  expectedGrant: number;
  idempotencyKey: string;
  status: "creating" | "created" | "paid" | "expired" | "failed";
  dodoSessionId?: string;
  dodoPaymentId?: string;
  checkoutUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export type CheckoutProviderRequest = {
  productId: string;
  quantity: 1;
  returnUrl: string;
  idempotencyKey: string;
  metadata: Record<string, string>;
};

export interface CheckoutProvider {
  createCheckout(request: CheckoutProviderRequest): Promise<{
    sessionId: string;
    checkoutUrl: string;
  }>;
}

export type CheckoutAccount = { checkouts: CheckoutRecord[] };

export interface CheckoutStore {
  atomic<T>(organizationId: string, operation: (account: CheckoutAccount) => T | Promise<T>): Promise<T>;
  read(organizationId: string): Promise<Readonly<CheckoutAccount>>;
}

export class MemoryCheckoutStore implements CheckoutStore {
  private readonly accounts = new Map<string, CheckoutAccount>();
  private readonly queues = new Map<string, Promise<void>>();

  async atomic<T>(organizationId: string, operation: (account: CheckoutAccount) => T | Promise<T>) {
    const previous = this.queues.get(organizationId) ?? Promise.resolve();
    let release!: () => void;
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => lock);
    this.queues.set(organizationId, queued);
    await previous;
    try {
      const account = structuredClone(
        this.accounts.get(organizationId) ?? { checkouts: [] },
      );
      const result = await operation(account);
      this.accounts.set(organizationId, account);
      return result;
    } finally {
      release();
      if (this.queues.get(organizationId) === queued) this.queues.delete(organizationId);
    }
  }

  async read(organizationId: string) {
    return this.accounts.get(organizationId) ?? { checkouts: [] };
  }
}

type PaymentsServiceOptions = {
  id?: () => string;
  now?: () => number;
  returnUrl: string;
  productIds: Partial<Record<TopUpPackKey, string>>;
  authorize?: (organizationId: string) => void | Promise<void>;
};

export function createPaymentsService(
  store: CheckoutStore,
  provider: CheckoutProvider,
  options: PaymentsServiceOptions,
) {
  const id = options.id ?? (() => crypto.randomUUID());
  const now = options.now ?? Date.now;
  const authorize = options.authorize ?? (() => undefined);

  return {
    async createTopUpCheckout(args: {
      organizationId: string;
      packKey: TopUpPackKey;
      idempotencyKey: string;
    }) {
      await authorize(args.organizationId);
      const pack = TOP_UP_PACKS[args.packKey];
      const productId = options.productIds[args.packKey];
      if (!pack || !productId) throw new Error(`Top-up pack ${args.packKey} is not configured`);
      assertSecureUrl(options.returnUrl, "checkout return URL");
      assertWholeCredits(pack.credits, "expected credit grant");
      const timestamp = now();
      const intent = await store.atomic(args.organizationId, (account) => {
        const existing = account.checkouts.find(
          (checkout) => checkout.idempotencyKey === args.idempotencyKey,
        );
        if (existing) {
          if (existing.packKey !== args.packKey) {
            throw new Error("Idempotency key was already used with a different checkout pack");
          }
          if (existing.status === "creating" || existing.status === "failed") {
            existing.status = "creating";
            existing.error = undefined;
            existing.updatedAt = timestamp;
            return { created: true, checkout: existing };
          }
          return { created: false, checkout: existing };
        }
        const checkout: CheckoutRecord = {
          id: id(),
          organizationId: args.organizationId,
          packKey: args.packKey,
          expectedGrant: pack.credits,
          idempotencyKey: args.idempotencyKey,
          status: "creating",
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        account.checkouts.push(checkout);
        return { created: true, checkout };
      });

      if (!intent.created) {
        return intent.checkout.status === "created"
          ? { status: "created" as const, checkout: intent.checkout }
          : { status: "processing" as const, checkout: intent.checkout };
      }

      try {
        const providerCheckout = await provider.createCheckout({
          productId,
          quantity: 1,
          returnUrl: options.returnUrl,
          idempotencyKey: args.idempotencyKey,
          metadata: {
            meridian_checkout_intent_id: intent.checkout.id,
            meridian_organization_id: args.organizationId,
            meridian_pack_key: args.packKey,
            meridian_expected_grant: String(pack.credits),
          },
        });
        if (!providerCheckout.sessionId.trim()) {
          throw new Error("Checkout provider returned an empty session ID");
        }
        assertSecureUrl(providerCheckout.checkoutUrl, "provider checkout URL");
        const checkout = await store.atomic(args.organizationId, (account) => {
          const current = account.checkouts.find((candidate) => candidate.id === intent.checkout.id);
          if (!current) throw new Error("Checkout intent disappeared before provider completion");
          current.status = "created";
          current.dodoSessionId = providerCheckout.sessionId;
          current.checkoutUrl = providerCheckout.checkoutUrl;
          current.updatedAt = now();
          return current;
        });
        return { status: "created" as const, checkout };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Checkout provider failed";
        await store.atomic(args.organizationId, (account) => {
          const current = account.checkouts.find((candidate) => candidate.id === intent.checkout.id);
          if (!current) return;
          current.status = "failed";
          current.error = message;
          current.updatedAt = now();
        });
        throw cause;
      }
    },

    async getCheckout(args: { organizationId: string; checkoutId: string }) {
      await authorize(args.organizationId);
      const account = await store.read(args.organizationId);
      return account.checkouts.find((checkout) => checkout.id === args.checkoutId) ?? null;
    },

    async markCheckoutPaidFromWebhook(args: {
      organizationId: string;
      checkoutIntentId: string;
      dodoSessionId: string;
      dodoPaymentId: string;
    }) {
      return store.atomic(args.organizationId, (account) => {
        const checkout = account.checkouts.find(
          (candidate) => candidate.id === args.checkoutIntentId,
        );
        if (!checkout || checkout.organizationId !== args.organizationId) {
          throw new Error("Checkout intent not found");
        }
        if (!checkout.dodoSessionId || checkout.dodoSessionId !== args.dodoSessionId) {
          throw new Error("Webhook checkout session does not match the persisted intent");
        }
        if (checkout.status === "paid") {
          if (checkout.dodoPaymentId !== args.dodoPaymentId) {
            throw new Error("Checkout intent was already paid by a different payment");
          }
          return { created: false, checkout };
        }
        if (checkout.status !== "created") {
          throw new Error(`Cannot pay a ${checkout.status} checkout intent`);
        }
        checkout.status = "paid";
        checkout.dodoPaymentId = args.dodoPaymentId;
        checkout.updatedAt = now();
        return { created: true, checkout };
      });
    },
  };
}

function assertSecureUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a secure HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${label} must be a secure HTTPS URL`);
  }
}

const topUpPackValidator = v.union(
  v.literal("credits_1m"),
  v.literal("credits_3m"),
  v.literal("credits_10m"),
);

export const authorizeCheckout = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId);
    return { authorized: true as const };
  },
});

export const getCheckout = query({
  args: {
    organizationId: v.id("organizations"),
    checkoutIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId);
    assertNonEmpty(args.checkoutIntentId, "checkout intent ID");
    const checkout = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_checkout_intent", (q) => q.eq("checkoutIntentId", args.checkoutIntentId))
      .unique();
    if (!checkout || checkout.organizationId !== args.organizationId) return null;
    return checkout;
  },
});

export const prepareCheckout = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    packKey: topUpPackValidator,
    callerIdempotencyKey: v.string(),
    proposedCheckoutIntentId: v.string(),
    productId: v.string(),
  },
  handler: async (ctx, args) => {
    assertNonEmpty(args.callerIdempotencyKey, "checkout idempotency key");
    assertNonEmpty(args.proposedCheckoutIntentId, "checkout intent ID");
    assertNonEmpty(args.productId, "Dodo product ID");
    const expectedGrant = TOP_UP_PACKS[args.packKey].credits;
    assertWholeCredits(expectedGrant, "expected credit grant");
    const timestamp = Date.now();

    const account = await ctx.db
      .query("billingAccounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    if (account?.status === "suspended") throw new Error("Billing account is suspended");
    if (account?.mode === "live") {
      throw new Error("Live Mode billing is disabled for this Test Mode deployment");
    }
    if (!account) {
      await ctx.db.insert("billingAccounts", {
        organizationId: args.organizationId,
        mode: "test",
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }

    const idempotencyKey = scopedCheckoutKey(args.organizationId, args.callerIdempotencyKey);
    const existing = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_organization_idempotency", (q) =>
        q.eq("organizationId", args.organizationId).eq("idempotencyKey", idempotencyKey),
      )
      .unique();
    if (existing) {
      if (
        existing.packKey !== args.packKey ||
        existing.expectedGrant !== expectedGrant ||
        existing.productId !== args.productId ||
        existing.mode !== "test"
      ) {
        throw new Error("Idempotency key was already used with different checkout inputs");
      }
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, { status: "creating", updatedAt: timestamp });
        return { ...existing, status: "creating" as const, updatedAt: timestamp };
      }
      return existing;
    }

    await ctx.db.insert("checkoutSessions", {
      organizationId: args.organizationId,
      checkoutIntentId: args.proposedCheckoutIntentId,
      idempotencyKey,
      productId: args.productId,
      mode: "test",
      packKey: args.packKey,
      expectedGrant,
      status: "creating",
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return await ctx.db
      .query("checkoutSessions")
      .withIndex("by_checkout_intent", (q) =>
        q.eq("checkoutIntentId", args.proposedCheckoutIntentId),
      )
      .unique();
  },
});

export const completeCheckout = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    checkoutIntentId: v.string(),
    productId: v.string(),
    dodoSessionId: v.string(),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, args) => {
    assertNonEmpty(args.dodoSessionId, "Dodo checkout session ID");
    assertSecureUrl(args.checkoutUrl, "provider checkout URL");
    const checkout = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_checkout_intent", (q) => q.eq("checkoutIntentId", args.checkoutIntentId))
      .unique();
    if (!checkout || checkout.organizationId !== args.organizationId) {
      throw new Error("Checkout intent not found");
    }
    if (checkout.productId !== args.productId || checkout.mode !== "test") {
      throw new Error("Provider checkout does not match the persisted Test Mode intent");
    }
    const sessionOwner = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_dodo_session", (q) => q.eq("dodoSessionId", args.dodoSessionId))
      .unique();
    if (sessionOwner && sessionOwner._id !== checkout._id) {
      throw new Error("Dodo checkout session is already attached to another intent");
    }
    if (checkout.status === "created") {
      if (
        checkout.dodoSessionId !== args.dodoSessionId ||
        checkout.checkoutUrl !== args.checkoutUrl
      ) {
        throw new Error("Checkout intent was already completed with different provider data");
      }
      return checkout;
    }
    if (checkout.status !== "creating" && checkout.status !== "failed") {
      throw new Error(`Cannot complete a ${checkout.status} checkout intent`);
    }
    await ctx.db.patch(checkout._id, {
      dodoSessionId: args.dodoSessionId,
      checkoutUrl: args.checkoutUrl,
      status: "created",
      updatedAt: Date.now(),
    });
    return await ctx.db.get(checkout._id);
  },
});

export const failCheckout = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    checkoutIntentId: v.string(),
  },
  handler: async (ctx, args) => {
    const checkout = await ctx.db
      .query("checkoutSessions")
      .withIndex("by_checkout_intent", (q) => q.eq("checkoutIntentId", args.checkoutIntentId))
      .unique();
    if (!checkout || checkout.organizationId !== args.organizationId) return null;
    if (checkout.status === "creating") {
      await ctx.db.patch(checkout._id, { status: "failed", updatedAt: Date.now() });
    }
    return await ctx.db.get(checkout._id);
  },
});

function scopedCheckoutKey(organizationId: string, callerKey: string) {
  return `checkout:${organizationId}:${callerKey}`;
}

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} must not be empty`);
}
