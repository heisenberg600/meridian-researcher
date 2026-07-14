import { SignInButton, useUser } from "@clerk/react";
import { useMutation } from "convex/react";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  MessageSquareText,
  Mic2,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type FormEvent, type ReactNode, useState } from "react";
import { api } from "../convex/_generated/api";
import { navigate } from "./lib/navigation";

const EASE = [0.22, 1, 0.36, 1] as const;

type WalkthroughStage = "plan" | "recruit" | "interview" | "decide";
type Timeline = "now" | "quarter" | "exploring";

const walkthroughStages: Array<{
  id: WalkthroughStage;
  number: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof FileText;
}> = [
  {
    id: "plan",
    number: "01",
    label: "Frame the decision",
    shortLabel: "Plan",
    description: "Meridian turns an open question into a research plan your team can inspect and approve.",
    icon: FileText,
  },
  {
    id: "recruit",
    number: "02",
    label: "Reach the right people",
    shortLabel: "Recruit",
    description: "Bring your own audience or ask Meridian to source participants against clear quotas.",
    icon: Users,
  },
  {
    id: "interview",
    number: "03",
    label: "Run adaptive interviews",
    shortLabel: "Interview",
    description: "AI-led phone and form interviews probe for specifics while staying inside the approved brief.",
    icon: Mic2,
  },
  {
    id: "decide",
    number: "04",
    label: "Get evidence, not summaries",
    shortLabel: "Decide",
    description: "Findings arrive with themes, counter-evidence, source quotes, and a recommendation.",
    icon: BarChart3,
  },
];

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

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function WaitlistButton({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => scrollToId("waitlist")}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C2593B]",
        compact ? "h-10 px-4 text-sm" : "h-12 px-5 text-sm",
        dark
          ? "bg-[#171612] text-white hover:bg-[#302E28]"
          : "bg-[#C2593B] text-white hover:bg-[#A84A2F]",
      ].join(" ")}
    >
      Join the waitlist
      <ArrowRight className="size-4" aria-hidden />
    </button>
  );
}

function MeridianRule() {
  return (
    <div className="mx-auto flex w-full max-w-6xl items-center px-6" aria-hidden>
      <span className="h-px flex-1 bg-[#E5E2D9]" />
      {[0, 1, 2, 3, 4].map((tick) => (
        <span key={tick} className={`h-3 w-px ${tick === 2 ? "bg-[#C2593B]" : "bg-[#CFCBBF]"}`} />
      ))}
      <span className="h-px flex-1 bg-[#E5E2D9]" />
    </div>
  );
}

function WalkthroughPanel({ stage }: { stage: WalkthroughStage }) {
  return (
    <div className="min-h-[520px] overflow-hidden rounded-lg border border-[#D9D5CA] bg-white shadow-[0_24px_70px_rgba(23,22,18,0.08)]">
      <div className="flex h-12 items-center justify-between border-b border-[#E5E2D9] px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="size-2 shrink-0 rounded-full bg-[#4C8A61]" />
          <span className="truncate text-sm font-medium text-[#171612]">Nova Hydration Launch</span>
        </div>
        <span className="font-mono-ds text-[10px] uppercase text-[#7A766B]">Study workspace</span>
      </div>
      <div className="grid min-h-[472px] sm:grid-cols-[164px_1fr]">
        <aside className="hidden border-r border-[#E5E2D9] bg-[#F8F7F3] p-3 sm:block">
          {["Plan", "Participants", "Interviews", "Findings"].map((item, index) => {
            const activeIndex = walkthroughStages.findIndex((entry) => entry.id === stage);
            const active = index === activeIndex;
            return (
              <div
                key={item}
                className={`mb-1 flex h-9 items-center gap-2 rounded-md px-3 text-xs ${
                  active ? "bg-[#EDEAE2] font-medium text-[#171612]" : "text-[#7A766B]"
                }`}
              >
                {index === 0 && <FileText className="size-3.5" />}
                {index === 1 && <Users className="size-3.5" />}
                {index === 2 && <Mic2 className="size-3.5" />}
                {index === 3 && <BarChart3 className="size-3.5" />}
                {item}
              </div>
            );
          })}
        </aside>
        <div className="min-w-0 p-5 sm:p-7">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {stage === "plan" && <PlanPreview />}
            {stage === "recruit" && <RecruitPreview />}
            {stage === "interview" && <InterviewPreview />}
            {stage === "decide" && <DecisionPreview />}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PreviewHeader({ eyebrow, title, status }: { eyebrow: string; title: string; status: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E2D9] pb-5">
      <div>
        <p className="font-mono-ds text-[10px] uppercase text-[#A84A2F]">{eyebrow}</p>
        <h3 className="mt-2 max-w-lg text-xl font-semibold text-[#171612]">{title}</h3>
      </div>
      <span className="rounded-full bg-[#E2EEE5] px-3 py-1 text-xs font-medium text-[#3E7A54]">{status}</span>
    </div>
  );
}

function PlanPreview() {
  return (
    <>
      <PreviewHeader eyebrow="Study plan · v1" title="Should Nova launch a low-sugar hydration line?" status="Ready to review" />
      <div className="grid gap-7 pt-6 lg:grid-cols-[1fr_180px]">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase text-[#7A766B]">Decision to inform</p>
            <p className="mt-2 text-sm leading-6 text-[#3B3A33]">
              Decide whether to launch, reposition, or pause before committing the next production run.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-[#7A766B]">Working hypotheses</p>
            <div className="mt-3 space-y-3">
              {["Sugar content is the primary purchase barrier.", "Trust matters more than flavor novelty."].map((item, index) => (
                <div key={item} className="flex items-start gap-3 border-l-2 border-[#D07355] pl-3">
                  <span className="font-mono-ds text-[10px] text-[#A84A2F]">H{index + 1}</span>
                  <span className="text-sm leading-5 text-[#57544C]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-5 border-t border-[#E5E2D9] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <Metric label="Participants" value="24" />
          <Metric label="Interview length" value="18 min" />
          <Metric label="Cohorts" value="3" />
        </div>
      </div>
    </>
  );
}

function RecruitPreview() {
  return (
    <>
      <PreviewHeader eyebrow="Recruitment" title="24 target consumers across three cohorts" status="12 qualified" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-[#C2593B] bg-[#FFF9F6] p-4">
          <div className="flex items-center justify-between">
            <Users className="size-5 text-[#A84A2F]" />
            <CheckCircle2 className="size-4 text-[#4C8A61]" />
          </div>
          <p className="mt-5 text-sm font-semibold text-[#171612]">Use your audience</p>
          <p className="mt-1 text-xs leading-5 text-[#706C63]">Upload customers and let Meridian screen, invite, and track them.</p>
        </div>
        <div className="rounded-lg border border-[#D9D5CA] p-4">
          <Search className="size-5 text-[#A84A2F]" />
          <p className="mt-5 text-sm font-semibold text-[#171612]">Source participants</p>
          <p className="mt-1 text-xs leading-5 text-[#706C63]">Define the audience and let Meridian manage recruitment for the study.</p>
        </div>
      </div>
      <div className="mt-7 space-y-4">
        <QuotaRow label="Existing category buyers" value={6} total={8} />
        <QuotaRow label="Competitor customers" value={4} total={8} />
        <QuotaRow label="Category considerers" value={2} total={8} />
      </div>
    </>
  );
}

function InterviewPreview() {
  return (
    <>
      <PreviewHeader eyebrow="Live interview · 08:42" title="Meridian is probing a purchase decision" status="In progress" />
      <div className="mt-6 space-y-5">
        <div className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#171612] text-white">
            <Mic2 className="size-3.5" />
          </span>
          <div>
            <p className="font-mono-ds text-[10px] uppercase text-[#7A766B]">Meridian</p>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[#3B3A33]">What made you put the bottle back after reading the label?</p>
          </div>
        </div>
        <div className="ml-0 border-l border-[#D9D5CA] pl-5 sm:ml-11">
          <p className="font-mono-ds text-[10px] uppercase text-[#A84A2F]">Participant</p>
          <p className="mt-1 text-sm leading-6 text-[#57544C]">
            It said healthy on the front, but the sugar number looked almost the same as the sports drink I already avoid.
          </p>
        </div>
        <div className="ml-0 flex gap-3 border-t border-[#E5E2D9] pt-5 sm:ml-11">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-[#C2593B]" />
          <div>
            <p className="text-xs font-semibold text-[#171612]">Adaptive probe</p>
            <p className="mt-1 text-xs leading-5 text-[#706C63]">
              Ask for the sugar threshold they consider acceptable before moving to flavor and price.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function DecisionPreview() {
  return (
    <>
      <PreviewHeader eyebrow="Decision report" title="Reformulate before launch; do not lead with flavor" status="High confidence" />
      <div className="mt-6 grid grid-cols-3 divide-x divide-[#E5E2D9] border-y border-[#E5E2D9] py-5">
        <Metric label="Interviews" value="24" />
        <Metric label="Evidence items" value="87" centered />
        <Metric label="Segments" value="3" centered />
      </div>
      <div className="mt-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#4C8A61]" />
          <div>
            <p className="text-sm font-semibold text-[#171612]">Sugar credibility is the launch gate.</p>
            <p className="mt-2 text-sm leading-6 text-[#57544C]">
              17 of 24 participants compared the label with mainstream sports drinks before discussing taste or price.
            </p>
          </div>
        </div>
        <blockquote className="mt-6 border-l-2 border-[#C2593B] pl-4 font-display text-lg italic leading-7 text-[#3B3A33]">
          “If the sugar is still that high, calling it everyday hydration does not make sense to me.”
          <footer className="mt-2 font-sans text-xs not-italic text-[#7A766B]">INT-18 · 11:06 · Existing category buyer</footer>
        </blockquote>
      </div>
    </>
  );
}

function Metric({ label, value, centered = false }: { label: string; value: string; centered?: boolean }) {
  return (
    <div className={centered ? "px-3 text-center" : ""}>
      <p className="font-display text-2xl font-medium text-[#171612]">{value}</p>
      <p className="mt-1 text-[11px] text-[#7A766B]">{label}</p>
    </div>
  );
}

function QuotaRow({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between gap-4 text-xs">
        <span className="text-[#57544C]">{label}</span>
        <span className="font-mono-ds text-[#7A766B]">{value}/{total}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#EDEAE2]">
        <div className="h-full rounded-full bg-[#C2593B]" style={{ width: `${(value / total) * 100}%` }} />
      </div>
    </div>
  );
}

function WaitlistForm() {
  const joinWaitlist = useMutation(api.waitlist.join);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [timeline, setTimeline] = useState<Timeline>("quarter");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams(window.location.search);

    try {
      await joinWaitlist({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        company: String(form.get("company") ?? ""),
        role: String(form.get("role") ?? ""),
        researchDecision: String(form.get("researchDecision") ?? ""),
        targetAudience: String(form.get("targetAudience") ?? "") || undefined,
        timeline,
        source: "landing",
        referrer: document.referrer || undefined,
        utmSource: params.get("utm_source") || undefined,
        utmCampaign: params.get("utm_campaign") || undefined,
        website: String(form.get("website") ?? "") || undefined,
      });
      setSubmitted(true);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "We could not save your details.";
      setError(message.includes("valid work email") ? "Enter a valid work email." : "We could not save your details. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-[440px] flex-col justify-center border-y border-white/15 py-10">
        <span className="flex size-11 items-center justify-center rounded-full bg-[#C2593B] text-white">
          <Check className="size-5" />
        </span>
        <p className="font-mono-ds mt-7 text-[11px] uppercase text-[#D58A72]">You are on the list</p>
        <h3 className="font-display mt-3 max-w-lg text-3xl font-medium text-white">Thanks. We will read your research question, not just your email.</h3>
        <p className="mt-4 max-w-lg text-sm leading-6 text-[#C8C2B5]">
          We are inviting a small number of teams into early research sprints and will reach out when there is a strong fit.
        </p>
      </div>
    );
  }

  const inputClass =
    "h-11 w-full rounded-md border border-white/20 bg-white/8 px-3 text-sm text-white outline-none transition placeholder:text-[#8F8A80] focus:border-[#D58A72] focus:ring-2 focus:ring-[#D58A72]/20";
  const textareaClass = `${inputClass} h-24 resize-none py-3`;

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-[#D7D1C4]">Name</span>
        <input className={inputClass} name="name" autoComplete="name" required maxLength={120} placeholder="Your name" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-[#D7D1C4]">Work email</span>
        <input className={inputClass} name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-[#D7D1C4]">Company</span>
        <input className={inputClass} name="company" autoComplete="organization" required maxLength={160} placeholder="Company name" />
      </label>
      <label className="block">
        <span className="mb-2 block text-xs font-medium text-[#D7D1C4]">Your role</span>
        <input className={inputClass} name="role" autoComplete="organization-title" required maxLength={120} placeholder="Product, insights, brand..." />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-xs font-medium text-[#D7D1C4]">What decision do you need customer evidence for?</span>
        <textarea
          className={textareaClass}
          name="researchDecision"
          required
          maxLength={1200}
          placeholder="For example: whether to launch a new pricing tier, reposition a product, or enter a market."
        />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-xs font-medium text-[#D7D1C4]">Who would you want to speak with? <span className="text-[#8F8A80]">Optional</span></span>
        <input className={inputClass} name="targetAudience" maxLength={500} placeholder="Existing customers, churned users, category buyers..." />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-xs font-medium text-[#D7D1C4]">When might you run this research?</legend>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["now", "This month"],
            ["quarter", "This quarter"],
            ["exploring", "Exploring"],
          ] as Array<[Timeline, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTimeline(value)}
              aria-pressed={timeline === value}
              className={`min-h-11 rounded-md border px-2 text-xs font-medium transition-colors ${
                timeline === value
                  ? "border-[#D58A72] bg-[#C2593B] text-white"
                  : "border-white/20 bg-white/5 text-[#C8C2B5] hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="absolute -left-[9999px]" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-5 text-[#8F8A80]">No newsletter noise. We will use this to understand demand and contact you about early access or a pilot.</p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#C2593B] px-5 text-sm font-medium text-white transition-colors hover:bg-[#D0694A] disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          {submitting ? "Joining..." : "Request early access"}
        </button>
      </div>
      {error && <p className="text-sm text-[#F0A68F] sm:col-span-2" role="alert">{error}</p>}
    </form>
  );
}

export function Landing() {
  const { isSignedIn } = useUser();
  const [walkthroughStage, setWalkthroughStage] = useState<WalkthroughStage>("plan");
  const heroEyebrow = useRise(0.05);
  const heroTitle = useRise(0.15);
  const heroSub = useRise(0.3);
  const heroCtas = useRise(0.45);
  const heroFoot = useRise(0.58);
  const reduced = useReducedMotion();

  return (
    <main className="landing-paper min-h-screen overflow-x-hidden text-[#3B3A33]">
      <div className="relative overflow-hidden border-b border-[#E5E2D9]">
        <motion.img
          src="/landing/hero-waitlist-v2.webp"
          alt="Topographic lines converging toward a measured signal"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: EASE }}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <nav className="relative z-20 mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <button type="button" onClick={() => navigate("/")} className="font-display text-xl font-medium text-[#171612]">
            Meridian<span className="ml-1 text-[#C2593B]">+</span>
          </button>
          <div className="flex items-center gap-2 sm:gap-5">
            <button type="button" onClick={() => scrollToId("walkthrough")} className="hidden text-sm text-[#57544C] hover:text-[#171612] sm:block">
              Walkthrough
            </button>
            {!isSignedIn ? (
              <SignInButton mode="modal" forceRedirectUrl="/portal">
                <button className="h-10 rounded-lg px-3 text-sm font-medium text-[#171612] hover:bg-black/5">Sign in</button>
              </SignInButton>
            ) : (
              <button type="button" onClick={() => navigate("/portal")} className="h-10 rounded-lg px-3 text-sm font-medium text-[#171612] hover:bg-black/5">
                Open workspace
              </button>
            )}
            {!isSignedIn && <WaitlistButton dark compact />}
          </div>
        </nav>

        <header className="relative h-[calc(100svh-112px)] min-h-[620px] max-h-[760px]">
          <div className="relative mx-auto flex h-full max-w-6xl items-center px-6 pb-10">
            <div className="max-w-[680px]">
              <motion.p {...heroEyebrow} className="font-mono-ds text-[11px] uppercase text-[#A84A2F]">
                Research strategy · recruitment · interviews · evidence
              </motion.p>
              <motion.h1 {...heroTitle} className="font-display mt-6 text-5xl font-medium leading-[1.04] text-[#171612] sm:text-6xl lg:text-7xl">
                Consumer research in days, not weeks.
              </motion.h1>
              <motion.p {...heroSub} className="mt-7 max-w-xl text-lg leading-8 text-[#57544C]">
                Meridian turns a business decision into a study, reaches the right customers, runs adaptive interviews, and delivers findings your team can trace back to evidence.
              </motion.p>
              <motion.div {...heroCtas} className="mt-9 flex flex-wrap items-center gap-3">
                <WaitlistButton />
                <button
                  type="button"
                  onClick={() => scrollToId("walkthrough")}
                  className="inline-flex h-12 items-center gap-2 rounded-lg border border-[#BEB9AD] bg-[#FAF9F6]/70 px-5 text-sm font-medium text-[#171612] backdrop-blur-sm hover:bg-white"
                >
                  Watch the walkthrough
                  <ArrowRight className="size-4 rotate-90" />
                </button>
              </motion.div>
              <motion.p {...heroFoot} className="mt-5 text-xs text-[#7A766B]">
                Early access for product, insights, and brand teams.
              </motion.p>
            </div>
          </div>
        </header>
      </div>

      <section className="mx-auto grid max-w-6xl grid-cols-2 border-x border-b border-[#E5E2D9] sm:grid-cols-4">
        {["Study design", "Participant recruitment", "AI-led interviews", "Evidence-linked findings"].map((item, index) => (
          <div key={item} className={`flex h-20 items-center gap-3 px-4 text-xs font-medium text-[#57544C] sm:px-5 ${index > 0 ? "border-l border-[#E5E2D9]" : ""}`}>
            <span className="font-mono-ds text-[10px] text-[#C2593B]">0{index + 1}</span>
            <span>{item}</span>
          </div>
        ))}
      </section>

      <section id="walkthrough" className="scroll-mt-10 py-24 sm:py-28">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal>
            <p className="font-mono-ds text-[11px] uppercase text-[#A84A2F]">Inside a Meridian study</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
              <h2 className="font-display max-w-2xl text-4xl font-medium leading-tight text-[#171612] sm:text-5xl">
                One question in. A defensible decision out.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-[#57544C] lg:pb-1">
                The agent does the operational work, while approvals, source evidence, and research boundaries remain visible to your team.
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-8 lg:grid-cols-[290px_1fr] lg:gap-12">
            <div className="grid grid-cols-2 gap-2 lg:block">
              {walkthroughStages.map((item) => {
                const Icon = item.icon;
                const active = walkthroughStage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setWalkthroughStage(item.id)}
                    className={`w-full border-l-2 p-4 text-left transition-colors lg:mb-2 ${
                      active ? "border-[#C2593B] bg-[#F2F0EA]" : "border-[#E5E2D9] hover:bg-[#F6F4EF]"
                    }`}
                    aria-pressed={active}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`size-4 ${active ? "text-[#A84A2F]" : "text-[#7A766B]"}`} />
                      <span className="font-mono-ds text-[10px] text-[#A84A2F]">{item.number}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#171612] lg:text-base">{item.label}</p>
                    <p className="mt-2 hidden text-xs leading-5 text-[#706C63] lg:block">{item.description}</p>
                  </button>
                );
              })}
            </div>
            <WalkthroughPanel stage={walkthroughStage} />
          </div>
        </div>
      </section>

      <MeridianRule />

      <section className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <Reveal>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-mono-ds text-[11px] uppercase text-[#A84A2F]">Why teams use Meridian</p>
              <h2 className="font-display mt-4 text-4xl font-medium leading-tight text-[#171612]">The report is not the product. Confidence is.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-[#57544C]">
                Meridian keeps the chain from business question to participant evidence intact, so a recommendation can survive the room where the decision gets made.
              </p>
            </div>
            <div className="divide-y divide-[#D9D5CA] border-y border-[#D9D5CA]">
              {[
                [ClipboardCheck, "Human-approved research plans", "Review the audience, method, questions, and decision criteria before fieldwork starts."],
                [MessageSquareText, "Adaptive conversations", "Go beyond fixed surveys with neutral follow-ups that ask for behavior, context, and examples."],
                [Search, "Inspectable evidence", "Open the transcript moment behind a finding and see supporting, conflicting, and minority views."],
              ].map(([Icon, title, body]) => (
                <div key={String(title)} className="grid gap-4 py-6 sm:grid-cols-[40px_190px_1fr] sm:items-start">
                  <Icon className="size-5 text-[#C2593B]" />
                  <h3 className="text-sm font-semibold text-[#171612]">{String(title)}</h3>
                  <p className="text-sm leading-6 text-[#57544C]">{String(body)}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      <section id="waitlist" className="relative scroll-mt-0 overflow-hidden bg-[#171612]">
        <img src="/landing/cta-dark.jpg" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-24 sm:py-28 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <Reveal>
            <p className="font-mono-ds text-[11px] uppercase text-[#D58A72]">Early access</p>
            <h2 className="font-display mt-4 text-4xl font-medium leading-tight text-white sm:text-5xl">Bring us the decision you cannot afford to guess.</h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#C8C2B5]">
              Join the waitlist and tell us what you need to learn. We are selecting a small group of teams for early Meridian research sprints.
            </p>
            <div className="mt-8 space-y-3 text-sm text-[#D7D1C4]">
              {["Use your customer list or ask Meridian to source participants", "Run phone and form interviews from one study", "Receive findings with the underlying evidence attached"].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-[#D58A72]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <WaitlistForm />
          </Reveal>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
        <p className="font-display text-lg font-medium text-[#171612]">Meridian<span className="ml-1 text-[#C2593B]">+</span></p>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => scrollToId("walkthrough")} className="text-xs text-[#7A766B] hover:text-[#171612]">Walkthrough</button>
          <button type="button" onClick={() => scrollToId("waitlist")} className="text-xs text-[#7A766B] hover:text-[#171612]">Waitlist</button>
          <span className="text-xs text-[#7A766B]">© 2026 Meridian</span>
        </div>
      </footer>
    </main>
  );
}
