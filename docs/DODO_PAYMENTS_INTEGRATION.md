# Dodo Payments — Checkout Integration Guide

> Status: **fully tested end-to-end in Test Mode on 12 Jul 2026** (product created via API,
> checkout session opened, test card paid, payment + invoice confirmed via API).
> Account: Sanyam's Dodo Payments account (business "Dodo Games", test mode).

## What Dodo Payments gives us

Dodo is a **Merchant of Record** — they handle payment collection, GST/tax, invoices,
and currency conversion for us. We don't touch card data at all. Checkout happens on
a page they host; we just send the customer there and get told when payment succeeds.

Verified in testing:
- Price set in USD is auto-shown in the buyer's currency (e.g. $10 → ₹992.16 + ₹178.59 GST).
- Checkout page collects name, email, billing address (Google-autocomplete) — we don't build any form.
- **Card and UPI** are both offered to Indian customers.
- Invoice is auto-generated after payment.
- Payment shows up instantly in the dashboard and via `GET /payments`.

## The three ways to integrate (easiest → most control)

### Option 1 — Payment link (zero code) ✅ easiest, great for the demo
Every product gets a shareable URL:

```
https://test.checkout.dodopayments.com/buy/<PRODUCT_ID>?quantity=1
```

Put this behind any button or send it in an email/WhatsApp. Done.
Our test product: `pdt_0Nj0hV4yzMvwsAkxDHEwZ`.

### Option 2 — Checkout session via API ✅ what we tested, recommended for the product
Backend creates a session, gets back a URL, redirects the customer there.
This lets us pre-fill the customer's name/email and set where they return after paying.

```bash
curl -X POST https://test.dodopayments.com/checkouts \
  -H "Authorization: Bearer $DODO_PAYMENTS_TEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "product_cart": [{ "product_id": "pdt_0Nj0hV4yzMvwsAkxDHEwZ", "quantity": 1 }],
    "customer": { "email": "buyer@example.com", "name": "Buyer Name" },
    "return_url": "https://ourapp.com/payment-success"
  }'
```

Response (instant):

```json
{ "session_id": "cks_...", "checkout_url": "https://test.checkout.dodopayments.com/session/cks_..." }
```

Redirect the browser to `checkout_url`. After payment Dodo sends the customer to `return_url`.

### Option 3 — Overlay checkout (button opens checkout on top of our page)
Dodo also has a JS SDK (`npm i dodopayments-checkout`) that opens the same checkout in an
overlay instead of redirecting. Nice-to-have polish later; Options 1–2 are enough for now.

## Step-by-step: adding it to Hermes (Vite + Convex)

1. **Keys** — create a **Test Mode** key in Dashboard → Developer → API Keys. Do **not** paste it
   into this repo. Keep it locally in `.env.local` (git-ignored) and set it on Convex:

   ```
   # Local only — .env.local (git-ignored). Never commit a key.
   DODO_PAYMENTS_TEST_API_KEY=<your-test-key>
   ```

   For the actual code, load it from an env var rather than pasting it inline. In Convex:
   `npx convex env set DODO_PAYMENTS_API_KEY <your-test-key>`

   > ⚠️ **No API keys live in this repo — test or live.** Every key (sandbox or real-money) goes only
   > into `.env.local` and Convex env. If a key is ever exposed, rotate it in the dashboard (takes
   > 10 seconds) and update `.env.local` / Convex env.

2. **Product** — created in the dashboard or via `POST /products`. Test product already exists:
   `Demo Product - Live Checkout Test` / `pdt_0Nj0hV4yzMvwsAkxDHEwZ` ($10 one-time).

3. **Backend (Convex action)** — the key must stay server-side, so create the session in an action:

   ```ts
   // convex/payments.ts
   "use node";
   import { action } from "./_generated/server";
   import { v } from "convex/values";

   export const createCheckout = action({
     args: { email: v.string(), name: v.string() },
     handler: async (_ctx, args) => {
       const res = await fetch("https://test.dodopayments.com/checkouts", {
         method: "POST",
         headers: {
           Authorization: `Bearer ${process.env.DODO_PAYMENTS_API_KEY}`,
           "Content-Type": "application/json",
         },
         body: JSON.stringify({
           product_cart: [{ product_id: "pdt_0Nj0hV4yzMvwsAkxDHEwZ", quantity: 1 }],
           customer: { email: args.email, name: args.name },
           return_url: "https://ourapp.com/payment-success",
         }),
       });
       const data = await res.json();
       return data.checkout_url as string;
     },
   });
   ```

4. **Frontend (the button)**:

   ```tsx
   const createCheckout = useAction(api.payments.createCheckout);

   <button
     onClick={async () => {
       const url = await createCheckout({ email: user.email, name: user.name });
       window.location.href = url;
     }}
   >
     Upgrade — $10
   </button>
   ```

5. **Knowing the payment succeeded** — two options:
   - Simple: on the `/payment-success` page, call `GET /payments` (server-side) and check
     the latest payment for that customer has `"status": "succeeded"`.
   - Proper: add a **webhook** (Dashboard → Developer → Webhooks) pointing at a Convex
     HTTP endpoint; Dodo posts `payment.succeeded` events there. Do this before real launch.

## Testing (what we did, reproducible)

- Test card (Indian customers): `4576 2389 1277 1450`, expiry `06/32`, CVV `123`
  — the test checkout page even shows an **Autofill** button for it.
- OTP screen (Cashfree simulator): enter `111000`, pick **SUCCESS**, submit.
- Result: "Payment Successful" page → auto-redirect to `return_url`;
  payment visible in dashboard + `GET /payments`, invoice auto-created.

## Going LIVE (before charging real money)

Currently everything is in **Test Mode**. To flip to Live:

1. Complete **business verification** in the dashboard (Verification tab).
2. Submit the **Product Information Form** — the dashboard shows
   "ACTION REQUIRED: PRODUCT INFORMATION FORM PENDING" until this is done.
3. Once approved, switch the dashboard to **Live Mode**, create a **live** API key,
   and change the base URL from `https://test.dodopayments.com` → `https://live.dodopayments.com`
   (checkout links change from `test.checkout.dodopayments.com` → `checkout.dodopayments.com`).

## What to show at the demo

1. Click "Upgrade" button in the app (or just open the payment link).
2. Dodo checkout opens — point out currency auto-conversion, GST handling, Card + UPI.
3. Pay with the test card (autofill button makes this smooth on stage).
4. Show the payment + auto-generated invoice appearing in the Dodo dashboard.

Docs: <https://docs.dodopayments.com>
