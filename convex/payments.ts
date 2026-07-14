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
