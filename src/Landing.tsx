import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { navigate } from "./lib/navigation";

const EASE = [0.22, 1, 0.36, 1] as const;

function useRise(delay = 0) {
  const reduced = useReducedMotion();
  return {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay },
  };
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Primary CTA: opens sign-up for visitors, goes straight to the portal when signed in. */
function StartStudyButton({ className }: { className?: string }) {
  const { isSignedIn } = useUser();
  const styles =
    className ??
    "rounded-full bg-[#C2593B] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#A84A2F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C2593B]";

  if (isSignedIn) {
    return (
      <button type="button" onClick={() => navigate("/portal")} className={styles}>
        Start a study
      </button>
    );
  }
  return (
    <SignUpButton mode="modal" forceRedirectUrl="/portal" signInForceRedirectUrl="/portal">
      <button className={styles}>Start a study</button>
    </SignUpButton>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Thin survey rule with tick marks — the section divider motif. */
function MeridianRule() {
  return (
    <svg aria-hidden className="mx-auto block w-full max-w-6xl px-6" height="14" role="presentation">
      <line x1="0" y1="7" x2="100%" y2="7" stroke="#E5E2D9" strokeWidth="1" />
      {[8, 24, 40, 56, 72, 88].map((pct) => (
        <line key={pct} x1={`${pct}%`} y1="2" x2={`${pct}%`} y2="12" stroke="#CFCBBF" strokeWidth="1" />
      ))}
      <line x1="50%" y1="0" x2="50%" y2="14" stroke="#C2593B" strokeWidth="1.5" />
    </svg>
  );
}

const stations = [
  {
    number: "01",
    title: "Strategist",
    body: "Turns your question into a study plan: who to talk to, what to ask, and what would change your decision.",
    checkpoint: false,
  },
  {
    number: "02",
    title: "Approval",
    body: "Nothing runs until you approve the plan. Edit the audience, the questions, or the scope first.",
    checkpoint: true,
  },
  {
    number: "03",
    title: "Interviewer",
    body: "Runs adaptive voice and text interviews with your customers, probing follow-ups without leading the witness.",
    checkpoint: false,
  },
  {
    number: "04",
    title: "Analyst",
    body: "Tests your hypotheses against the transcripts and writes findings that cite the interviews behind them.",
    checkpoint: false,
  },
];

const excerpts = [
  {
    ref: "INT-07 · 14:32",
    quote:
      "I had everything in the cart, then shipping showed up at the end and I just closed the tab. It felt sneaky.",
    tag: "Shipping-cost reveal",
  },
  {
    ref: "INT-11 · 08:05",
    quote:
      "Checkout itself was fine — two minutes, no problem. It's the surprise total that made me stop and compare elsewhere.",
    tag: "Shipping-cost reveal",
  },
];

export function Landing() {
  const { isSignedIn } = useUser();
  const heroEyebrow = useRise(0.05);
  const heroTitle = useRise(0.15);
  const heroSub = useRise(0.3);
  const heroCtas = useRise(0.45);
  const reduced = useReducedMotion();

  return (
    <main className="min-h-screen bg-[#FAF9F6] text-[#3B3A33]">
      {/* Navigation */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="font-display text-xl font-medium tracking-tight text-[#171612]"
        >
          Meridian<span className="ml-1 text-[#C2593B]">+</span>
        </button>
        <div className="flex items-center gap-2 sm:gap-5">
          <button
            type="button"
            onClick={() => scrollToId("how")}
            className="hidden text-sm text-[#57544C] hover:text-[#171612] sm:block"
          >
            How it works
          </button>
          <button
            type="button"
            onClick={() => scrollToId("evidence")}
            className="hidden text-sm text-[#57544C] hover:text-[#171612] sm:block"
          >
            Evidence
          </button>
          {!isSignedIn ? (
            <>
              <SignInButton mode="modal" forceRedirectUrl="/portal">
                <button className="rounded-full px-4 py-2 text-sm font-medium text-[#171612] hover:bg-black/5">
                  Sign in
                </button>
              </SignInButton>
              <StartStudyButton className="rounded-full bg-[#171612] px-4 py-2 text-sm font-medium text-white hover:bg-black" />
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("/portal")}
                className="rounded-full bg-[#171612] px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Open portal
              </button>
              <UserButton />
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden">
        <motion.img
          src="/landing/hero-contours.jpg"
          alt=""
          aria-hidden
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right"
        />
        {/* keeps the headline legible where the contours drift left on small screens */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#FAF9F6] via-[#FAF9F6]/85 to-transparent lg:via-[#FAF9F6]/40"
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-28 pt-20 sm:pt-28 lg:pb-36">
          <motion.p
            {...heroEyebrow}
            className="font-mono-ds text-[11px] uppercase tracking-[0.18em] text-[#A84A2F]"
          >
            Meridian · Consumer research agency
          </motion.p>
          <motion.h1
            {...heroTitle}
            className="font-display mt-6 max-w-2xl text-5xl font-medium leading-[1.06] tracking-[-0.015em] text-[#171612] sm:text-6xl lg:text-7xl"
          >
            From a business question to customer evidence.
          </motion.h1>
          <motion.p {...heroSub} className="mt-7 max-w-xl text-lg leading-8 text-[#57544C]">
            Tell Meridian what you need to decide. It designs the study, you approve the plan, it
            interviews your customers — and the findings arrive with the evidence attached.
          </motion.p>
          <motion.div {...heroCtas} className="mt-10 flex flex-wrap items-center gap-4">
            <StartStudyButton />
            <button
              type="button"
              onClick={() => scrollToId("how")}
              className="rounded-full border border-[#CFCBBF] px-6 py-3 text-sm font-medium text-[#171612] transition-colors hover:bg-white"
            >
              See how it works
            </button>
          </motion.div>
        </div>
      </header>

      <MeridianRule />

      {/* How it works — four stations along the route */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-6 py-24">
        <Reveal>
          <p className="font-mono-ds text-[11px] uppercase tracking-[0.18em] text-[#7A766B]">The route</p>
          <h2 className="font-display mt-4 max-w-xl text-3xl font-medium text-[#171612] sm:text-4xl">
            Four stations between your question and its answer.
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-10 border-t border-[#E5E2D9] sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {stations.map((station, i) => (
            <Reveal key={station.number} delay={i * 0.08} className="relative pt-8">
              <span aria-hidden className="absolute -top-px left-0 h-3 w-px bg-[#C2593B]" />
              <p className="font-mono-ds text-xs text-[#A84A2F]">{station.number}</p>
              <h3 className="mt-3 text-lg font-semibold text-[#171612]">{station.title}</h3>
              {station.checkpoint && (
                <span className="mt-2 inline-block rounded-full bg-[#F6E4DD] px-2.5 py-0.5 text-xs font-medium text-[#8C3D26]">
                  You approve here
                </span>
              )}
              <p className="mt-3 text-sm leading-6 text-[#57544C]">{station.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Evidence */}
      <section id="evidence" className="border-y border-[#E5E2D9] bg-[#F2F0EA] scroll-mt-16">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <p className="font-mono-ds text-[11px] uppercase tracking-[0.18em] text-[#7A766B]">
              Evidence-linked findings
            </p>
            <h2 className="font-display mt-4 max-w-xl text-3xl font-medium text-[#171612] sm:text-4xl">
              Findings stay pinned to their source.
            </h2>
            <p className="mt-4 max-w-xl leading-7 text-[#57544C]">
              Every claim in a Meridian report links back to the interview moments that support it,
              so your team debates the decision — not the data.
            </p>
          </Reveal>
          <div className="mt-14 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <article className="rounded-2xl border border-[#E5E2D9] border-l-[3px] border-l-[#C2593B] bg-white p-7 shadow-[0_20px_60px_rgba(23,22,18,0.06)]">
                <p className="font-mono-ds text-xs text-[#7A766B]">Finding 03</p>
                <h3 className="font-display mt-3 text-2xl font-medium leading-snug text-[#171612]">
                  Shoppers abandon at the shipping-cost reveal, not at checkout friction.
                </h3>
                <p className="mt-4 inline-block rounded-full bg-[#E2EEE5] px-3 py-1 text-xs font-medium text-[#3E7A54]">
                  Supported · 9 of 12 interviews
                </p>
              </article>
            </Reveal>
            <div className="space-y-6">
              {excerpts.map((excerpt, i) => (
                <Reveal key={excerpt.ref} delay={0.1 + i * 0.1}>
                  <blockquote className="rounded-2xl border border-[#E5E2D9] bg-white p-6">
                    <p className="font-mono-ds text-xs text-[#A84A2F]">{excerpt.ref}</p>
                    <p className="font-display mt-3 text-lg italic leading-7 text-[#3B3A33]">
                      “{excerpt.quote}”
                    </p>
                    <footer className="mt-4 text-xs font-medium uppercase tracking-[0.08em] text-[#7A766B]">
                      {excerpt.tag}
                    </footer>
                  </blockquote>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-10 sm:grid-cols-3">
          {[
            ["Voice and text interviews", "Adaptive conversations that ask the follow-up a good researcher would, by phone or chat."],
            ["Recruiting built in", "Meridian finds and reaches the customers your study needs — no panel wrangling."],
            ["A report in your brand", "The deliverable arrives styled for your team, ready to circulate the day fieldwork ends."],
          ].map(([title, body], i) => (
            <Reveal key={title} delay={i * 0.08}>
              <h3 className="text-base font-semibold text-[#171612]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#57544C]">{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="relative overflow-hidden bg-[#171612]">
        <img
          src="/landing/cta-dark.jpg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-28 text-center">
          <Reveal>
            <h2 className="font-display mx-auto max-w-2xl text-4xl font-medium leading-tight text-[#FAF9F6] sm:text-5xl">
              Put a research agency on your team.
            </h2>
            <p className="mx-auto mt-5 max-w-md leading-7 text-[#BFBAAC]">
              Start with one question. Approve the plan. Get customer evidence this week.
            </p>
            <div className="mt-9 flex justify-center">
              <StartStudyButton />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
        <p className="font-display text-lg font-medium text-[#171612]">
          Meridian<span className="ml-1 text-[#C2593B]">+</span>
        </p>
        <p className="text-xs text-[#7A766B]">Built at the Hermes Buildathon · 2026</p>
      </footer>
    </main>
  );
}
