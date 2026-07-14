import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { Button, Card, SectionHeader } from "@/components/meridian";

const packs = [
  { key: "credits_1m" as const, credits: 1_000_000, label: "Starter top-up" },
  { key: "credits_3m" as const, credits: 3_000_000, label: "Team top-up" },
  { key: "credits_10m" as const, credits: 10_000_000, label: "Hackathon scale" },
];

export function BillingPage() {
  const current = useQuery(api.users.current, {});
  const organizationId = current?.organization?._id;
  const wallet = useQuery(api.credits.getWallet, organizationId ? { organizationId } : "skip");
  const history = useQuery(api.credits.usageHistory, organizationId ? { organizationId } : "skip");
  const createCheckout = useAction(api.paymentActions.createTopUpCheckout);
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function buy(packKey: (typeof packs)[number]["key"]) {
    if (!organizationId) return;
    setBusy(packKey);
    setMessage(undefined);
    try {
      const checkout = await createCheckout({ organizationId, packKey, idempotencyKey: crypto.randomUUID() });
      if (!checkout?.checkoutUrl) throw new Error("Checkout URL is not available");
      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create checkout");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <main className="mx-auto max-w-[1120px] space-y-7 px-4 py-8 sm:px-6 lg:px-10">
      <SectionHeader eyebrow="Prepaid usage" title="Credits & billing" description="Fund a shared wallet, see every debit, and stop provider work before the balance reaches zero." />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Available" value={wallet?.available} />
        <Metric label="Reserved" value={wallet?.reserved} />
        <Metric label="Consumed" value={wallet?.consumed} />
        <Metric label="Granted" value={wallet?.granted} />
      </div>
      <section className="grid gap-4 md:grid-cols-3" aria-label="Credit top-ups">
        {packs.map((pack) => (
          <Card key={pack.key} className="p-5">
            <p className="text-sm font-semibold text-[var(--ink-strong)]">{pack.label}</p>
            <p className="mt-2 font-[var(--font-editorial)] text-3xl text-[var(--ink-strong)]">{pack.credits.toLocaleString()}</p>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">Meridian credits · Dodo Test Mode</p>
            <Button className="mt-5 w-full" disabled={Boolean(busy) || !organizationId} onClick={() => void buy(pack.key)}>{busy === pack.key ? "Opening…" : "Buy credits"}</Button>
          </Card>
        ))}
      </section>
      {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--line)] px-5 py-4"><h2 className="font-semibold">Recent usage</h2></div>
        <ul className="divide-y divide-[var(--line)]">
          {(history?.transactions ?? []).slice(0, 12).map((item) => <li key={item._id} className="flex justify-between gap-4 px-5 py-3 text-sm"><span className="capitalize">{item.reason?.replaceAll("_", " ") ?? item.type}</span><span className="font-mono">{item.amount.toLocaleString()}</span></li>)}
          {history && history.transactions.length === 0 ? <li className="px-5 py-6 text-sm text-[var(--ink-muted)]">No credit activity yet.</li> : null}
        </ul>
      </Card>
    </main>
  );
}

function Metric({ label, value }: { label: string; value?: number }) {
  return <Card className="p-4"><p className="text-xs uppercase tracking-[0.1em] text-[var(--ink-faint)]">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{value === undefined ? "—" : value.toLocaleString()}</p></Card>;
}
