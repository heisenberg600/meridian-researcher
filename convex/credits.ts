import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireOrganizationAccess } from "./lib/auth";
import {
  ACTIVE_RATE_CARD_VERSION,
  RATE_CARDS,
  assertWholeCredits,
  calculateBillableCredits,
  type BillableOperation,
} from "./lib/billing";

export const STARTER_CREDITS = 1_000_000;

export type CreditWallet = {
  organizationId: string;
  granted: number;
  available: number;
  reserved: number;
  consumed: number;
  updatedAt: number;
};

export type CreditTransactionType = "grant" | "reserve" | "debit" | "release";

export type CreditTransaction = {
  id: string;
  organizationId: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  idempotencyKey: string;
  rateCardVersion?: string;
  reservationId?: string;
  createdAt: number;
};

export type CreditReservation = {
  id: string;
  organizationId: string;
  operationId: string;
  operation: BillableOperation;
  amount: number;
  status: "active" | "finalized" | "released" | "expired";
  idempotencyKey: string;
  rateCardVersion: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  finalDebit?: number;
  measuredCredits?: number;
  shortfallCredits?: number;
  releaseReason?: string;
  finalizationIdempotencyKey?: string;
  releaseIdempotencyKey?: string;
};

export type UsageReconciliation = {
  id: string;
  organizationId: string;
  reservationId: string;
  operation: BillableOperation;
  model: string;
  provider: string;
  providerOperationId: string;
  nativeQuantity: number;
  nativeUnit: string;
  internalCostMicros: number;
  billedCredits: number;
  measuredCredits: number;
  shortfallCredits: number;
  creditTransactionId?: string;
  rateCardVersion: string;
  finalized: true;
  createdAt: number;
};

export type CreditAccount = {
  wallet?: CreditWallet;
  transactions: CreditTransaction[];
  reservations: CreditReservation[];
  usage: UsageReconciliation[];
};

export class InsufficientCreditsError extends Error {
  constructor(
    readonly available: number,
    readonly requested: number,
  ) {
    super(`Insufficient credits: ${available} available, ${requested} requested`);
    this.name = "InsufficientCreditsError";
  }
}

export function settleReservedCredits(args: {
  maximumCredits: number;
  measuredCredits: number;
  availableCredits: number;
}) {
  assertWholeCredits(args.maximumCredits, "maximum credits");
  assertWholeCredits(args.measuredCredits, "measured credits", true);
  assertWholeCredits(args.availableCredits, "available credits", true);
  const reservedDebit = Math.min(args.measuredCredits, args.maximumCredits);
  const releasedCredits = args.maximumCredits - reservedDebit;
  const remainingDebit = args.measuredCredits - reservedDebit;
  const availableDebit = Math.min(remainingDebit, args.availableCredits);
  const finalDebit = safeAdd(reservedDebit, availableDebit);
  return {
    availableDebit,
    finalDebit,
    releasedCredits,
    shortfallCredits: args.measuredCredits - finalDebit,
  };
}

export interface CreditsStore {
  atomic<T>(organizationId: string, operation: (account: CreditAccount) => T | Promise<T>): Promise<T>;
  read(organizationId: string): Promise<Readonly<CreditAccount>>;
}

export class MemoryCreditsStore implements CreditsStore {
  private readonly accounts = new Map<string, CreditAccount>();
  private readonly queues = new Map<string, Promise<void>>();

  async atomic<T>(organizationId: string, operation: (account: CreditAccount) => T | Promise<T>) {
    const previous = this.queues.get(organizationId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    this.queues.set(organizationId, queued);
    await previous;
    try {
      const account = structuredClone(this.accounts.get(organizationId) ?? {
        transactions: [],
        reservations: [],
        usage: [],
      });
      const result = await operation(account);
      this.accounts.set(organizationId, account);
      return result;
    } finally {
      release();
      if (this.queues.get(organizationId) === queued) this.queues.delete(organizationId);
    }
  }

  async read(organizationId: string) {
    return this.accounts.get(organizationId) ?? { transactions: [], reservations: [], usage: [] };
  }
}

type CreditsServiceOptions = {
  id?: () => string;
  now?: () => number;
  authorize?: (organizationId: string) => void | Promise<void>;
};

export function createCreditsService(store: CreditsStore, options: CreditsServiceOptions = {}) {
  const id = options.id ?? (() => crypto.randomUUID());
  const now = options.now ?? Date.now;
  const authorize = options.authorize ?? (() => undefined);

  return {
    async getWallet(args: { organizationId: string }): Promise<CreditWallet> {
      await authorize(args.organizationId);
      const account = await store.read(args.organizationId);
      return account.wallet ?? emptyWallet(args.organizationId, now());
    },

    async ensureStarterGrant(args: { organizationId: string }) {
      await authorize(args.organizationId);
      return store.atomic(args.organizationId, (account) => {
        const idempotencyKey = `starter:${args.organizationId}`;
        const existing = account.transactions.find(
          (transaction) => transaction.idempotencyKey === idempotencyKey,
        );
        if (existing) {
          if (
            existing.type !== "grant" ||
            existing.amount !== STARTER_CREDITS ||
            existing.rateCardVersion !== ACTIVE_RATE_CARD_VERSION
          ) {
            throw new Error("Idempotency key was already used with different starter grant inputs");
          }
          return { created: false, transaction: existing };
        }

        const timestamp = now();
        const wallet = account.wallet ?? emptyWallet(args.organizationId, timestamp);
        assertWholeCredits(STARTER_CREDITS, "starter credits");
        wallet.granted = safeAdd(wallet.granted, STARTER_CREDITS);
        wallet.available = safeAdd(wallet.available, STARTER_CREDITS);
        wallet.updatedAt = timestamp;
        account.wallet = wallet;
        const transaction: CreditTransaction = {
          id: id(),
          organizationId: args.organizationId,
          type: "grant",
          amount: STARTER_CREDITS,
          balanceAfter: wallet.available,
          idempotencyKey,
          rateCardVersion: ACTIVE_RATE_CARD_VERSION,
          createdAt: timestamp,
        };
        account.transactions.push(transaction);
        return { created: true, transaction };
      });
    },

    async grantCredits(args: {
      organizationId: string;
      amount: number;
      idempotencyKey: string;
      rateCardVersion?: string;
    }) {
      await authorize(args.organizationId);
      return store.atomic(args.organizationId, (account) => {
        assertWholeCredits(args.amount, "credit grant");
        const rateCardVersion = args.rateCardVersion ?? ACTIVE_RATE_CARD_VERSION;
        const existing = account.transactions.find(
          (transaction) => transaction.idempotencyKey === args.idempotencyKey,
        );
        if (existing) {
          if (
            existing.type !== "grant" ||
            existing.amount !== args.amount ||
            existing.rateCardVersion !== rateCardVersion
          ) {
            throw new Error("Idempotency key was already used with different grant inputs");
          }
          return { created: false, transaction: existing };
        }

        const timestamp = now();
        const wallet = account.wallet ?? emptyWallet(args.organizationId, timestamp);
        wallet.granted = safeAdd(wallet.granted, args.amount);
        wallet.available = safeAdd(wallet.available, args.amount);
        wallet.updatedAt = timestamp;
        account.wallet = wallet;
        const transaction: CreditTransaction = {
          id: id(),
          organizationId: args.organizationId,
          type: "grant",
          amount: args.amount,
          balanceAfter: wallet.available,
          idempotencyKey: args.idempotencyKey,
          rateCardVersion,
          createdAt: timestamp,
        };
        account.transactions.push(transaction);
        return { created: true, transaction };
      });
    },

    async reserveCredits(args: {
      organizationId: string;
      operationId: string;
      operation: BillableOperation;
      amount: number;
      idempotencyKey: string;
      expiresAt: number;
      rateCardVersion?: string;
    }) {
      await authorize(args.organizationId);
      return store.atomic(args.organizationId, (account) => {
        assertWholeCredits(args.amount, "reservation amount");
        const timestamp = now();
        if (!Number.isSafeInteger(args.expiresAt) || args.expiresAt <= timestamp) {
          throw new Error("Reservation expiry must be a future integer timestamp");
        }
        const existing = account.reservations.find(
          (reservation) => reservation.idempotencyKey === args.idempotencyKey,
        );
        if (existing) {
          if (
            existing.operationId !== args.operationId ||
            existing.operation !== args.operation ||
            existing.amount !== args.amount ||
            existing.expiresAt !== args.expiresAt ||
            existing.rateCardVersion !== (args.rateCardVersion ?? ACTIVE_RATE_CARD_VERSION)
          ) {
            throw new Error("Idempotency key was already used with different reservation inputs");
          }
          const transaction = account.transactions.find(
            (candidate) => candidate.type === "reserve" && candidate.reservationId === existing.id,
          );
          if (!transaction) throw new Error("Reservation transaction is missing");
          return { created: false, reservation: existing, transaction };
        }
        if (account.transactions.some(
          (transaction) => transaction.idempotencyKey === args.idempotencyKey,
        )) {
          throw new Error("Transaction idempotency key was already used");
        }
        const wallet = account.wallet ?? emptyWallet(args.organizationId, timestamp);
        if (wallet.available < args.amount) {
          throw new InsufficientCreditsError(wallet.available, args.amount);
        }
        wallet.available -= args.amount;
        wallet.reserved = safeAdd(wallet.reserved, args.amount);
        wallet.updatedAt = timestamp;
        account.wallet = wallet;
        const reservation: CreditReservation = {
          id: id(),
          organizationId: args.organizationId,
          operationId: args.operationId,
          operation: args.operation,
          amount: args.amount,
          status: "active",
          idempotencyKey: args.idempotencyKey,
          rateCardVersion: args.rateCardVersion ?? ACTIVE_RATE_CARD_VERSION,
          expiresAt: args.expiresAt,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        account.reservations.push(reservation);
        const transaction: CreditTransaction = {
          id: id(),
          organizationId: args.organizationId,
          type: "reserve",
          amount: args.amount,
          balanceAfter: wallet.available,
          idempotencyKey: args.idempotencyKey,
          rateCardVersion: reservation.rateCardVersion,
          reservationId: reservation.id,
          createdAt: timestamp,
        };
        appendTransaction(account, transaction);
        return { created: true, reservation, transaction };
      });
    },

    async finalizeReservation(args: {
      organizationId: string;
      reservationId: string;
      measuredCredits: number;
      idempotencyKey: string;
    }) {
      await authorize(args.organizationId);
      return store.atomic(args.organizationId, (account) => {
        assertWholeCredits(args.measuredCredits, "measured credits", true);
        const reservation = account.reservations.find(
          (candidate) => candidate.id === args.reservationId,
        );
        if (!reservation || reservation.organizationId !== args.organizationId) {
          throw new Error("Credit reservation not found");
        }
        if (
          reservation.status === "finalized" &&
          reservation.finalizationIdempotencyKey === args.idempotencyKey
        ) {
          if (reservation.measuredCredits !== args.measuredCredits) {
            throw new Error("Idempotency key was already used with different finalization inputs");
          }
          return {
            created: false,
            reservation,
            finalDebit: reservation.finalDebit ?? 0,
            releasedCredits: Math.max(reservation.amount - (reservation.measuredCredits ?? 0), 0),
            shortfallCredits: reservation.shortfallCredits ?? 0,
            debitTransaction: account.transactions.find(
              (candidate) =>
                candidate.type === "debit" &&
                candidate.reservationId === reservation.id &&
                candidate.idempotencyKey === args.idempotencyKey,
            ),
            releaseTransaction: account.transactions.find(
              (candidate) =>
                candidate.type === "release" &&
                candidate.reservationId === reservation.id &&
                candidate.idempotencyKey === `${args.idempotencyKey}:release`,
            ),
          };
        }
        if (reservation.status !== "active") {
          throw new Error(`Cannot finalize a ${reservation.status} reservation`);
        }
        const wallet = account.wallet;
        if (!wallet || wallet.reserved < reservation.amount) {
          throw new Error("Reserved wallet balance is inconsistent");
        }
        const timestamp = now();
        const settlement = settleReservedCredits({
          maximumCredits: reservation.amount,
          measuredCredits: args.measuredCredits,
          availableCredits: wallet.available,
        });
        const { finalDebit, releasedCredits } = settlement;
        wallet.reserved -= reservation.amount;
        wallet.available = safeAdd(wallet.available, releasedCredits) - settlement.availableDebit;
        wallet.consumed = safeAdd(wallet.consumed, finalDebit);
        wallet.updatedAt = timestamp;
        reservation.status = "finalized";
        reservation.finalDebit = finalDebit;
        reservation.measuredCredits = args.measuredCredits;
        reservation.shortfallCredits = settlement.shortfallCredits;
        reservation.finalizationIdempotencyKey = args.idempotencyKey;
        reservation.updatedAt = timestamp;

        const debitTransaction = finalDebit > 0
          ? appendTransaction(account, {
              id: id(),
              organizationId: args.organizationId,
              type: "debit",
              amount: finalDebit,
              balanceAfter: wallet.available,
              idempotencyKey: args.idempotencyKey,
              rateCardVersion: reservation.rateCardVersion,
              reservationId: reservation.id,
              createdAt: timestamp,
            })
          : undefined;
        const releaseTransaction = releasedCredits > 0
          ? appendTransaction(account, {
              id: id(),
              organizationId: args.organizationId,
              type: "release",
              amount: releasedCredits,
              balanceAfter: wallet.available,
              idempotencyKey: `${args.idempotencyKey}:release`,
              rateCardVersion: reservation.rateCardVersion,
              reservationId: reservation.id,
              createdAt: timestamp,
            })
          : undefined;
        return {
          created: true,
          reservation,
          finalDebit,
          releasedCredits,
          shortfallCredits: reservation.shortfallCredits,
          debitTransaction,
          releaseTransaction,
        };
      });
    },

    async releaseReservation(args: {
      organizationId: string;
      reservationId: string;
      idempotencyKey: string;
      reason: string;
      expired?: boolean;
    }) {
      await authorize(args.organizationId);
      return store.atomic(args.organizationId, (account) => {
        const reservation = account.reservations.find(
          (candidate) => candidate.id === args.reservationId,
        );
        if (!reservation || reservation.organizationId !== args.organizationId) {
          throw new Error("Credit reservation not found");
        }
        if (
          (reservation.status === "released" || reservation.status === "expired") &&
          reservation.releaseIdempotencyKey === args.idempotencyKey
        ) {
          if (reservation.releaseReason !== args.reason) {
            throw new Error("Idempotency key was already used with different release inputs");
          }
          const transaction = account.transactions.find(
            (candidate) =>
              candidate.type === "release" &&
              candidate.reservationId === reservation.id &&
              candidate.idempotencyKey === args.idempotencyKey,
          );
          if (!transaction) throw new Error("Release transaction is missing");
          return {
            created: false,
            reservation,
            releasedCredits: reservation.amount,
            transaction,
          };
        }
        if (reservation.status !== "active") {
          throw new Error(`Cannot release a ${reservation.status} reservation`);
        }
        const wallet = account.wallet;
        if (!wallet || wallet.reserved < reservation.amount) {
          throw new Error("Reserved wallet balance is inconsistent");
        }
        const timestamp = now();
        wallet.reserved -= reservation.amount;
        wallet.available = safeAdd(wallet.available, reservation.amount);
        wallet.updatedAt = timestamp;
        reservation.status = args.expired ? "expired" : "released";
        reservation.releaseReason = args.reason;
        reservation.releaseIdempotencyKey = args.idempotencyKey;
        reservation.updatedAt = timestamp;
        const transaction = appendTransaction(account, {
          id: id(),
          organizationId: args.organizationId,
          type: "release",
          amount: reservation.amount,
          balanceAfter: wallet.available,
          idempotencyKey: args.idempotencyKey,
          rateCardVersion: reservation.rateCardVersion,
          reservationId: reservation.id,
          createdAt: timestamp,
        });
        return {
          created: true,
          reservation,
          releasedCredits: reservation.amount,
          transaction,
        };
      });
    },

    async releaseExpiredReservations(args: { organizationId: string }) {
      await authorize(args.organizationId);
      return store.atomic(args.organizationId, (account) => {
        const timestamp = now();
        const wallet = account.wallet ?? emptyWallet(args.organizationId, timestamp);
        let expiredCount = 0;
        let releasedCredits = 0;
        for (const reservation of account.reservations) {
          if (reservation.status !== "active" || reservation.expiresAt > timestamp) continue;
          if (wallet.reserved < reservation.amount) {
            throw new Error("Reserved wallet balance is inconsistent");
          }
          wallet.reserved -= reservation.amount;
          wallet.available = safeAdd(wallet.available, reservation.amount);
          reservation.status = "expired";
          reservation.releaseReason = "reservation_expired";
          reservation.releaseIdempotencyKey = `expire:${reservation.id}:${reservation.expiresAt}`;
          reservation.updatedAt = timestamp;
          appendTransaction(account, {
            id: id(),
            organizationId: args.organizationId,
            type: "release",
            amount: reservation.amount,
            balanceAfter: wallet.available,
            idempotencyKey: reservation.releaseIdempotencyKey,
            rateCardVersion: reservation.rateCardVersion,
            reservationId: reservation.id,
            createdAt: timestamp,
          });
          expiredCount += 1;
          releasedCredits = safeAdd(releasedCredits, reservation.amount);
        }
        wallet.updatedAt = expiredCount > 0 ? timestamp : wallet.updatedAt;
        account.wallet = wallet;
        return { expiredCount, releasedCredits };
      });
    },

    async reconcileUsage(args: {
      organizationId: string;
      reservationId: string;
      provider: string;
      providerOperationId: string;
      nativeQuantity: number;
      internalCostMicros: number;
      model: string;
    }) {
      await authorize(args.organizationId);
      return store.atomic(args.organizationId, (account) => {
        const existing = account.usage.find(
          (usage) =>
            usage.provider === args.provider &&
            usage.providerOperationId === args.providerOperationId,
        );
        if (existing) {
          if (
            existing.reservationId !== args.reservationId ||
            existing.nativeQuantity !== args.nativeQuantity ||
            existing.internalCostMicros !== args.internalCostMicros ||
            existing.model !== args.model
          ) {
            throw new Error("Provider operation was already reconciled with different usage inputs");
          }
          const reservation = account.reservations.find(
            (candidate) => candidate.id === args.reservationId,
          );
          if (!reservation) throw new Error("Credit reservation not found");
          return {
            created: false,
            usage: existing,
            finalization: finalizationResult(account, reservation, false),
          };
        }

        assertWholeCredits(args.nativeQuantity, "native quantity", true);
        assertWholeCredits(args.internalCostMicros, "internal cost micros", true);
        const reservation = account.reservations.find(
          (candidate) => candidate.id === args.reservationId,
        );
        if (!reservation || reservation.organizationId !== args.organizationId) {
          throw new Error("Credit reservation not found");
        }
        if (reservation.status !== "active") {
          throw new Error(`Cannot reconcile a ${reservation.status} reservation`);
        }
        const charge = calculateBillableCredits({
          operation: reservation.operation,
          nativeQuantity: args.nativeQuantity,
          rateCardVersion: reservation.rateCardVersion,
        });
        const wallet = account.wallet;
        if (!wallet || wallet.reserved < reservation.amount) {
          throw new Error("Reserved wallet balance is inconsistent");
        }
        const timestamp = now();
        const settlement = settleReservedCredits({
          maximumCredits: reservation.amount,
          measuredCredits: charge.credits,
          availableCredits: wallet.available,
        });
        const { finalDebit, releasedCredits } = settlement;
        wallet.reserved -= reservation.amount;
        wallet.available = safeAdd(wallet.available, releasedCredits) - settlement.availableDebit;
        wallet.consumed = safeAdd(wallet.consumed, finalDebit);
        wallet.updatedAt = timestamp;
        reservation.status = "finalized";
        reservation.finalDebit = finalDebit;
        reservation.measuredCredits = charge.credits;
        reservation.shortfallCredits = settlement.shortfallCredits;
        reservation.finalizationIdempotencyKey = `usage:${args.provider}:${args.providerOperationId}`;
        reservation.updatedAt = timestamp;
        const debitTransaction = finalDebit > 0
          ? appendTransaction(account, {
              id: id(),
              organizationId: args.organizationId,
              type: "debit",
              amount: finalDebit,
              balanceAfter: wallet.available,
              idempotencyKey: reservation.finalizationIdempotencyKey,
              rateCardVersion: reservation.rateCardVersion,
              reservationId: reservation.id,
              createdAt: timestamp,
            })
          : undefined;
        const releaseTransaction = releasedCredits > 0
          ? appendTransaction(account, {
              id: id(),
              organizationId: args.organizationId,
              type: "release",
              amount: releasedCredits,
              balanceAfter: wallet.available,
              idempotencyKey: `${reservation.finalizationIdempotencyKey}:release`,
              rateCardVersion: reservation.rateCardVersion,
              reservationId: reservation.id,
              createdAt: timestamp,
            })
          : undefined;
        const usage: UsageReconciliation = {
          id: id(),
          organizationId: args.organizationId,
          reservationId: reservation.id,
          operation: reservation.operation,
          model: args.model,
          provider: args.provider,
          providerOperationId: args.providerOperationId,
          nativeQuantity: args.nativeQuantity,
          nativeUnit: charge.nativeUnit,
          internalCostMicros: args.internalCostMicros,
          billedCredits: finalDebit,
          measuredCredits: charge.credits,
          shortfallCredits: reservation.shortfallCredits,
          creditTransactionId: debitTransaction?.id,
          rateCardVersion: reservation.rateCardVersion,
          finalized: true,
          createdAt: timestamp,
        };
        account.usage.push(usage);
        return {
          created: true,
          usage,
          finalization: {
            created: true,
            reservation,
            finalDebit,
            releasedCredits,
            shortfallCredits: reservation.shortfallCredits,
            debitTransaction,
            releaseTransaction,
          },
        };
      });
    },
  };
}

function emptyWallet(organizationId: string, now: number): CreditWallet {
  return { organizationId, granted: 0, available: 0, reserved: 0, consumed: 0, updatedAt: now };
}

function safeAdd(left: number, right: number) {
  const result = left + right;
  assertWholeCredits(result, "credit balance", true);
  return result;
}

function appendTransaction(account: CreditAccount, transaction: CreditTransaction) {
  if (account.transactions.some(
    (candidate) => candidate.idempotencyKey === transaction.idempotencyKey,
  )) {
    throw new Error("Transaction idempotency key was already used");
  }
  account.transactions.push(transaction);
  return transaction;
}

function finalizationResult(
  account: CreditAccount,
  reservation: CreditReservation,
  created: boolean,
) {
  const idempotencyKey = reservation.finalizationIdempotencyKey;
  return {
    created,
    reservation,
    finalDebit: reservation.finalDebit ?? 0,
    releasedCredits: Math.max(reservation.amount - (reservation.measuredCredits ?? 0), 0),
    shortfallCredits: reservation.shortfallCredits ?? 0,
    debitTransaction: account.transactions.find(
      (transaction) =>
        transaction.type === "debit" &&
        transaction.reservationId === reservation.id &&
        transaction.idempotencyKey === idempotencyKey,
    ),
    releaseTransaction: account.transactions.find(
      (transaction) =>
        transaction.type === "release" &&
        transaction.reservationId === reservation.id &&
        transaction.idempotencyKey === `${idempotencyKey}:release`,
    ),
  };
}

const billableOperationValidator = v.union(
  v.literal("ai_chat"),
  v.literal("source_processing"),
  v.literal("email_delivery"),
  v.literal("connected_voice"),
  v.literal("analysis"),
  v.literal("report_generation"),
  v.literal("image_generation"),
);

export async function ensureStarterGrantForOrganization(
  ctx: Pick<MutationCtx, "db">,
  organizationId: Id<"organizations">,
  timestamp: number,
) {
  const idempotencyKey = `starter:${organizationId}`;
  const existing = await ctx.db
    .query("creditTransactions")
    .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey))
    .unique();
  if (existing) {
    if (
      existing.organizationId !== organizationId ||
      existing.type !== "grant" ||
      existing.amount !== STARTER_CREDITS
    ) {
      throw new Error("Starter grant idempotency conflict");
    }
    return { created: false, transactionId: existing._id };
  }

  let wallet = await ctx.db
    .query("creditWallets")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  if (!wallet) {
    const walletId = await ctx.db.insert("creditWallets", {
      organizationId,
      granted: 0,
      available: 0,
      reserved: 0,
      consumed: 0,
      updatedAt: timestamp,
    });
    wallet = (await ctx.db.get(walletId))!;
  }
  validatePersistedWallet(wallet);
  const granted = safeAdd(wallet.granted, STARTER_CREDITS);
  const available = safeAdd(wallet.available, STARTER_CREDITS);
  await ctx.db.patch(wallet._id, { granted, available, updatedAt: timestamp });
  const transactionId = await ctx.db.insert("creditTransactions", {
    organizationId,
    type: "grant",
    amount: STARTER_CREDITS,
    balanceAfter: available,
    idempotencyKey,
    rateCardVersion: ACTIVE_RATE_CARD_VERSION,
    reason: "workspace_starter_grant",
    createdAt: timestamp,
  });
  return { created: true, transactionId };
}

export const getWallet = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId);
    const wallet = await ctx.db
      .query("creditWallets")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .unique();
    if (wallet) validatePersistedWallet(wallet);
    return wallet ?? {
      organizationId: args.organizationId,
      granted: 0,
      available: 0,
      reserved: 0,
      consumed: 0,
      updatedAt: 0,
    };
  },
});

export const usageHistory = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId);
    const [transactions, usage] = await Promise.all([
      ctx.db
        .query("creditTransactions")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .order("desc")
        .take(100),
      ctx.db
        .query("usageLedger")
        .filter((q) => q.eq(q.field("organizationId"), args.organizationId))
        .order("desc")
        .take(100),
    ]);
    return { transactions, usage };
  },
});

export const reserveCredits = mutation({
  args: {
    organizationId: v.id("organizations"),
    studyId: v.optional(v.id("studies")),
    operationId: v.string(),
    operation: billableOperationValidator,
    maximumCredits: v.number(),
    idempotencyKey: v.string(),
    expiresAt: v.number(),
    rateCardVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireOrganizationAccess(ctx, args.organizationId);
    assertWholeCredits(args.maximumCredits, "maximum credits");
    assertNonEmpty(args.operationId, "operation ID");
    assertNonEmpty(args.idempotencyKey, "idempotency key");
    const timestamp = Date.now();
    if (!Number.isSafeInteger(args.expiresAt) || args.expiresAt <= timestamp) {
      throw new Error("Reservation expiry must be a future safe integer timestamp");
    }
    const rateCardVersion = args.rateCardVersion ?? ACTIVE_RATE_CARD_VERSION;
    if (!RATE_CARDS[rateCardVersion]?.some((rate) => rate.operation === args.operation)) {
      throw new Error(`No rate configured for ${args.operation} on ${rateCardVersion}`);
    }
    await expireReservationsForOrganization(ctx, args.organizationId, timestamp);
    const storedKey = scopedKey("reservation", args.organizationId, args.idempotencyKey);
    const existing = await ctx.db
      .query("creditReservations")
      .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", storedKey))
      .unique();
    if (existing) {
      if (
        existing.organizationId !== args.organizationId ||
        existing.operationId !== args.operationId ||
        existing.operation !== args.operation ||
        existing.maximumCredits !== args.maximumCredits ||
        existing.expiresAt !== args.expiresAt ||
        existing.rateCardVersion !== rateCardVersion
      ) {
        throw new Error("Idempotency key was already used with different reservation inputs");
      }
      return { created: false, reservationId: existing._id, status: existing.status };
    }
    const wallet = await requireWallet(ctx, args.organizationId);
    if (wallet.available < args.maximumCredits) {
      throw new InsufficientCreditsError(wallet.available, args.maximumCredits);
    }
    const reservationId = await ctx.db.insert("creditReservations", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      operationId: args.operationId,
      operation: args.operation,
      maximumCredits: args.maximumCredits,
      status: "reserved",
      idempotencyKey: storedKey,
      rateCardVersion,
      expiresAt: args.expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const available = wallet.available - args.maximumCredits;
    const reserved = safeAdd(wallet.reserved, args.maximumCredits);
    await ctx.db.patch(wallet._id, { available, reserved, updatedAt: timestamp });
    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      studyId: args.studyId,
      operationId: args.operationId,
      operation: args.operation,
      type: "reserve",
      amount: args.maximumCredits,
      balanceAfter: available,
      idempotencyKey: storedKey,
      rateCardVersion,
      reservationId,
      createdAt: timestamp,
    });
    return { created: true, reservationId, status: "reserved" as const };
  },
});

export const ensureStarterGrant = internalMutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) =>
    await ensureStarterGrantForOrganization(ctx, args.organizationId, Date.now()),
});

export const reconcileUsage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    reservationId: v.id("creditReservations"),
    provider: v.string(),
    providerOperationId: v.string(),
    nativeQuantity: v.number(),
    internalCostMicros: v.number(),
    model: v.string(),
    agentRunId: v.optional(v.id("agentRuns")),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertNonEmpty(args.provider, "provider");
    assertNonEmpty(args.providerOperationId, "provider operation ID");
    assertNonEmpty(args.model, "model");
    assertWholeCredits(args.nativeQuantity, "native quantity", true);
    assertWholeCredits(args.internalCostMicros, "internal cost micros", true);
    const finalizationKey = compoundKey("usage", args.provider, args.providerOperationId);
    const existingUsage = await ctx.db
      .query("usageLedger")
      .filter((q) =>
        q.and(
          q.eq(q.field("provider"), args.provider),
          q.eq(q.field("providerOperationId"), args.providerOperationId),
        ),
      )
      .unique();
    if (existingUsage) {
      if (existingUsage.organizationId !== args.organizationId) {
        throw new Error("Provider operation was already reconciled for another organization");
      }
      return { created: false, usageId: existingUsage._id };
    }
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.organizationId !== args.organizationId) {
      throw new Error("Credit reservation not found");
    }
    if (reservation.status !== "reserved") {
      throw new Error(`Cannot reconcile a ${reservation.status} reservation`);
    }
    const charge = calculateBillableCredits({
      operation: reservation.operation as BillableOperation,
      nativeQuantity: args.nativeQuantity,
      rateCardVersion: reservation.rateCardVersion,
    });
    const wallet = await requireWallet(ctx, args.organizationId);
    if (wallet.reserved < reservation.maximumCredits) {
      throw new Error("Reserved wallet balance is inconsistent");
    }
    const settlement = settleReservedCredits({
      maximumCredits: reservation.maximumCredits,
      measuredCredits: charge.credits,
      availableCredits: wallet.available,
    });
    const available = safeAdd(wallet.available, settlement.releasedCredits) - settlement.availableDebit;
    const reserved = wallet.reserved - reservation.maximumCredits;
    const consumed = safeAdd(wallet.consumed, settlement.finalDebit);
    const timestamp = Date.now();
    await ctx.db.patch(wallet._id, { available, reserved, consumed, updatedAt: timestamp });
    await ctx.db.patch(reservation._id, {
      status: "finalized",
      finalDebit: settlement.finalDebit,
      measuredCredits: charge.credits,
      shortfallCredits: settlement.shortfallCredits,
      finalizationIdempotencyKey: finalizationKey,
      updatedAt: timestamp,
    });
    let debitTransactionId: Id<"creditTransactions"> | undefined;
    if (settlement.finalDebit > 0) {
      debitTransactionId = await ctx.db.insert("creditTransactions", {
        organizationId: args.organizationId,
        studyId: reservation.studyId,
        operationId: reservation.operationId,
        operation: reservation.operation,
        type: "debit",
        amount: settlement.finalDebit,
        balanceAfter: available,
        idempotencyKey: finalizationKey,
        rateCardVersion: reservation.rateCardVersion,
        reservationId: reservation._id,
        reason: "measured_provider_usage",
        createdAt: timestamp,
      });
    }
    if (settlement.releasedCredits > 0) {
      await ctx.db.insert("creditTransactions", {
        organizationId: args.organizationId,
        studyId: reservation.studyId,
        operationId: reservation.operationId,
        operation: reservation.operation,
        type: "release",
        amount: settlement.releasedCredits,
        balanceAfter: available,
        idempotencyKey: `${finalizationKey}:release`,
        rateCardVersion: reservation.rateCardVersion,
        reservationId: reservation._id,
        reason: "unused_reservation",
        createdAt: timestamp,
      });
    }
    if (settlement.shortfallCredits > 0) {
      await ctx.db.insert("creditTransactions", {
        organizationId: args.organizationId,
        studyId: reservation.studyId,
        operationId: reservation.operationId,
        operation: reservation.operation,
        type: "adjustment",
        amount: settlement.shortfallCredits,
        balanceAfter: available,
        idempotencyKey: `${finalizationKey}:shortfall`,
        rateCardVersion: reservation.rateCardVersion,
        reservationId: reservation._id,
        reason: "uncollectible_usage_shortfall",
        createdAt: timestamp,
      });
    }
    const inputTokens = args.inputTokens ?? 0;
    const outputTokens = args.outputTokens ?? 0;
    const totalTokens = args.totalTokens ?? safeAdd(inputTokens, outputTokens);
    for (const [name, value] of Object.entries({ inputTokens, outputTokens, totalTokens })) {
      assertWholeCredits(value, name, true);
    }
    const usageId = await ctx.db.insert("usageLedger", {
      organizationId: args.organizationId,
      studyId: reservation.studyId,
      agentRunId: args.agentRunId,
      operation: reservation.operation,
      model: args.model,
      inputTokens,
      outputTokens,
      totalTokens,
      provider: args.provider,
      providerOperationId: args.providerOperationId,
      nativeQuantity: args.nativeQuantity,
      nativeUnit: charge.nativeUnit,
      internalCostMicros: args.internalCostMicros,
      billedCredits: settlement.finalDebit,
      creditTransactionId: debitTransactionId,
      rateCardVersion: reservation.rateCardVersion,
      finalized: true,
      createdAt: timestamp,
    });
    return {
      created: true,
      usageId,
      finalDebit: settlement.finalDebit,
      releasedCredits: settlement.releasedCredits,
      shortfallCredits: settlement.shortfallCredits,
    };
  },
});

export const releaseReservation = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    reservationId: v.id("creditReservations"),
    idempotencyKey: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    assertNonEmpty(args.idempotencyKey, "idempotency key");
    assertNonEmpty(args.reason, "release reason");
    const reservation = await ctx.db.get(args.reservationId);
    if (!reservation || reservation.organizationId !== args.organizationId) {
      throw new Error("Credit reservation not found");
    }
    const storedKey = scopedKey("release", args.organizationId, args.idempotencyKey);
    if (reservation.status === "released" && reservation.releaseIdempotencyKey === storedKey) {
      return { created: false, releasedCredits: reservation.maximumCredits };
    }
    if (reservation.status !== "reserved") {
      throw new Error(`Cannot release a ${reservation.status} reservation`);
    }
    const wallet = await requireWallet(ctx, args.organizationId);
    if (wallet.reserved < reservation.maximumCredits) {
      throw new Error("Reserved wallet balance is inconsistent");
    }
    const timestamp = Date.now();
    const available = safeAdd(wallet.available, reservation.maximumCredits);
    await ctx.db.patch(wallet._id, {
      available,
      reserved: wallet.reserved - reservation.maximumCredits,
      updatedAt: timestamp,
    });
    await ctx.db.patch(reservation._id, {
      status: "released",
      releaseIdempotencyKey: storedKey,
      updatedAt: timestamp,
    });
    await ctx.db.insert("creditTransactions", {
      organizationId: args.organizationId,
      studyId: reservation.studyId,
      operationId: reservation.operationId,
      operation: reservation.operation,
      type: "release",
      amount: reservation.maximumCredits,
      balanceAfter: available,
      idempotencyKey: storedKey,
      rateCardVersion: reservation.rateCardVersion,
      reservationId: reservation._id,
      reason: args.reason,
      createdAt: timestamp,
    });
    return { created: true, releasedCredits: reservation.maximumCredits };
  },
});

export const expireReservations = internalMutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) =>
    await expireReservationsForOrganization(ctx, args.organizationId, Date.now()),
});

async function requireWallet(ctx: Pick<MutationCtx, "db">, organizationId: Id<"organizations">) {
  const wallet = await ctx.db
    .query("creditWallets")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
  if (!wallet) throw new Error("Credit wallet has not been provisioned");
  validatePersistedWallet(wallet);
  return wallet;
}

async function expireReservationsForOrganization(
  ctx: Pick<MutationCtx, "db">,
  organizationId: Id<"organizations">,
  timestamp: number,
) {
  const reservations = await ctx.db
    .query("creditReservations")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  const expired = reservations.filter(
    (reservation) => reservation.status === "reserved" && reservation.expiresAt <= timestamp,
  );
  if (expired.length === 0) return { expiredCount: 0, releasedCredits: 0 };
  const wallet = await requireWallet(ctx, organizationId);
  let available = wallet.available;
  let reserved = wallet.reserved;
  let releasedCredits = 0;
  for (const reservation of expired) {
    if (reserved < reservation.maximumCredits) throw new Error("Reserved wallet balance is inconsistent");
    reserved -= reservation.maximumCredits;
    available = safeAdd(available, reservation.maximumCredits);
    releasedCredits = safeAdd(releasedCredits, reservation.maximumCredits);
    const idempotencyKey = `expire:${reservation._id}:${reservation.expiresAt}`;
    await ctx.db.patch(reservation._id, {
      status: "expired",
      releaseIdempotencyKey: idempotencyKey,
      updatedAt: timestamp,
    });
    await ctx.db.insert("creditTransactions", {
      organizationId,
      studyId: reservation.studyId,
      operationId: reservation.operationId,
      operation: reservation.operation,
      type: "release",
      amount: reservation.maximumCredits,
      balanceAfter: available,
      idempotencyKey,
      rateCardVersion: reservation.rateCardVersion,
      reservationId: reservation._id,
      reason: "reservation_expired",
      createdAt: timestamp,
    });
  }
  await ctx.db.patch(wallet._id, { available, reserved, updatedAt: timestamp });
  return { expiredCount: expired.length, releasedCredits };
}

function validatePersistedWallet(wallet: {
  granted: number;
  available: number;
  reserved: number;
  consumed: number;
}) {
  assertWholeCredits(wallet.granted, "wallet granted", true);
  assertWholeCredits(wallet.available, "wallet available", true);
  assertWholeCredits(wallet.reserved, "wallet reserved", true);
  assertWholeCredits(wallet.consumed, "wallet consumed", true);
}

function assertNonEmpty(value: string, name: string) {
  if (!value.trim() || value.length > 256) throw new Error(`${name} must be between 1 and 256 characters`);
}

function scopedKey(prefix: string, organizationId: string, key: string) {
  return compoundKey(prefix, organizationId, key);
}

function compoundKey(prefix: string, ...parts: string[]) {
  return `${prefix}:${parts.map((part) => `${part.length}:${part}`).join(":")}`;
}
