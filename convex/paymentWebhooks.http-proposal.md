# Dodo webhook integration adapter proposal

The billing modules deliberately stop at injected storage, provider, authorization, and raw-body
verification ports. The shared HTTP router and schema remain lead-owned integration points.

## HTTP adapter

1. Register one `httpAction` in `convex/http.ts` for the configured Dodo webhook path.
2. Read `await request.text()` exactly once and retain that exact string. Do not parse or
   reserialize it before signature verification.
3. Require and forward the `webhook-id`, `webhook-signature`, and `webhook-timestamp` headers to a
   `RawWebhookVerifier` adapter backed by Dodo's official webhook verifier (Standard Webhooks).
4. After verification, normalize only the event ID/type, payment ID, checkout session ID, and the
   server-created Meridian checkout intent identifiers. Call an internal action/mutation that uses
   the `processDodoWebhook` policy.
5. Return `200` for processed, duplicate, or intentionally ignored events. Return a retryable error
   only when verified processing failed. Invalid signatures must never create an event or grant.

The adapter must not grant from a return URL, browser callback, product metadata amount, or
client-supplied pack. The persisted checkout intent is the authority for `expectedGrant`.

## Shared schema requirements before persistence wiring

- `checkoutSessions` needs a server-generated intent ID (or its document ID used explicitly), a
  globally unique idempotency key, `creating` status, and optional `dodoSessionId`/`checkoutUrl`.
  Persisting the intent before the provider call is otherwise impossible because the current schema
  requires `dodoSessionId` and only permits `created | paid | expired | failed`.
- `creditTransactions` needs a reservation reference (or a documented use of `operationId`) so a
  reserve/debit/release chain can be reconciled without string conventions. Its global
  `by_idempotency_key` index should either be documented as globally unique or include organization.
- `creditReservations` needs measured credits, shortfall credits, release reason, and separate
  finalization/release idempotency keys if those audit values must survive restarts.
- `rateCards` needs integer block semantics (`blockSize` and `creditsPerBlock`). A single
  `creditsPerUnit` number cannot safely represent rates such as 1 credit per 1,000 tokens without
  fractional credit arithmetic.
- `usageLedger` needs an index that can enforce provider + provider-operation idempotency. It also
  needs a reservation reference and measured/shortfall credit fields if those values are expected
  to be queried independently of the reservation.

After these contract changes, add Convex `CheckoutStore`, `CreditsStore`, and `WebhookEventStore`
adapters using mutations with indexed reads. Regenerate Convex types in the shared integration lane,
then wire organization authorization with `requireOrganizationAccess`. Webhook-internal mutations
must not depend on end-user auth, but must only accept normalized results from the verified action.
