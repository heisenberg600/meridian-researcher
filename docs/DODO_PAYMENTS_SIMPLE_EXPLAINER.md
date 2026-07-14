# Dodo Payments — Simple Explainer (plain English)

_Written 12 Jul 2026. This is the "explain like I'm not a developer" version.
The technical step-by-step is in `DODO_PAYMENTS_INTEGRATION.md`._

## Did we spend real money? NO.

We ran a **practice payment**, not a real one. Nothing was charged to anyone's real card.

How we know for sure (all from the actual payment record):

- It happened on **Test Mode** — Dodo's practice system, kept completely separate from real money.
- The card used ends in **1450** (`4576 2389 1277 1450`). This is **Dodo's fake practice card**,
  not anyone's real card. It only works in Test Mode; a real system would reject it.
- The buyer was a made-up person: **"Test User / testbuyer@example.com"**.
- The bank screen itself said: _"no actual debit occurs."_

Think of it like **Monopoly money on a practice machine**: everything looks real —
the checkout page, the OTP, the "Payment Successful" receipt, the invoice —
but zero real money moved.

To ever charge real money we must first switch the account from **Test Mode → Live Mode**,
which needs business verification + a product form (see the last section).

## What is the API key?

The **API key** is like a **password for our app to talk to Dodo**.
When our website says "create a checkout" or "did this payment go through?",
it shows this key so Dodo knows the request is really from us.

- We made a **test key** (works only in the practice world). Its nickname is `demo-checkout-test`.
- It is saved privately on Sanyam's Mac. **It is NOT written in this repo** — a key is a secret,
  like a password, so we never put it in shared code.
- There are two kinds: a **Test key** (practice) and a **Live key** (real money). We only have a Test key so far.

**Golden rule:** treat the key like a bank password. Never paste it into chat, screenshots,
or a public file. If it ever leaks, delete it in the dashboard and make a new one (takes 10 seconds).

### How the key is used (in one line)

Our **server** (never the customer's browser) puts the key in the request to Dodo:

```
Authorization: Bearer <the key>
```

That's it. The customer never sees the key. Our app uses it behind the scenes to:
1. create a checkout page for the customer, and
2. later ask Dodo "was this paid?".

## What payment modes can customers use?

On the checkout page we tested, Dodo showed Indian customers:

- **Card** — credit & debit cards (Visa, Mastercard, Amex, Discover). ✅ tested
- **UPI** — GPay / PhonePe / Paytm etc. ✅ shown as an option

Because Dodo is a "Merchant of Record", the **available methods change based on the customer's
country** — Dodo automatically shows the right ones (e.g. cards + local wallets abroad).
We don't have to build or manage any of this; Dodo handles it. It also **auto-converts the
price into the customer's currency** and adds the correct tax (we saw $10 shown as ₹992 + GST).

## The three ways we can add "pay" to our product

1. **Payment link (no code)** — a ready-made URL we can put behind any button or send in a message.
   Easiest. Great for the demo.
2. **Checkout session (recommended)** — our server asks Dodo for a checkout page and sends the
   customer there. Lets us pre-fill their name/email and control where they land after paying.
   This is the one we fully tested.
3. **Overlay (fancy)** — the checkout opens on top of our own page instead of redirecting. Polish for later.

## When we're ready for REAL money

Right now everything is practice-only. To go live:

1. Finish **business verification** in the Dodo dashboard.
2. Submit the **Product Information Form** (dashboard is currently nagging us to do this).
3. After approval: switch to **Live Mode**, create a **Live** key, and swap the web address
   from `test.dodopayments.com` to `live.dodopayments.com`. Then payments are real.

Only Sanyam can do steps 1–2 (they need real business details).
