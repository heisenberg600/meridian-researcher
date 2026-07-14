import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/react";
import { useEffect, useState } from "react";
import { InterviewClient } from "./InterviewPrototype";
import { Portal } from "./Portal";
import { getInterviewInvite } from "./lib/interview-prototype";

function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return pathname;
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Home() {
  const { isSignedIn } = useUser();

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-6 py-8 text-[#1f211d]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-lg font-semibold tracking-tight"
        >
          Hermes Researcher
        </button>
        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <>
            <SignInButton mode="modal">
              <button className="rounded-full px-4 py-2 text-sm font-medium hover:bg-black/5">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-full bg-[#1f211d] px-4 py-2 text-sm font-medium text-white hover:bg-black">
                Create account
              </button>
            </SignUpButton>
            </>
          ) : (
            <>
            <button
              type="button"
              onClick={() => navigate("/portal")}
              className="rounded-full bg-[#1f211d] px-4 py-2 text-sm font-medium text-white hover:bg-black"
            >
              Open portal
            </button>
            <UserButton />
            </>
          )}
        </div>
      </nav>

      <section className="mx-auto grid min-h-[78vh] max-w-6xl items-center gap-12 py-20 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-[#66745b]">
            Supervised AI research
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-7xl">
            From a business question to customer evidence.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#62655e]">
            Design studies, approve the plan, run adaptive customer interviews,
            and receive findings that stay connected to their source evidence.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            {!isSignedIn ? (
              <SignUpButton mode="modal">
                <button className="rounded-full bg-[#46583c] px-6 py-3 font-medium text-white hover:bg-[#35452d]">
                  Start a study
                </button>
              </SignUpButton>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/portal")}
                className="rounded-full bg-[#46583c] px-6 py-3 font-medium text-white hover:bg-[#35452d]"
              >
                Start a study
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate("/portal")}
              className="rounded-full border border-black/15 px-6 py-3 font-medium hover:bg-white"
            >
              Open portal
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-black/10 bg-white p-7 shadow-[0_30px_80px_rgba(35,39,31,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7c8177]">
            Research workflow
          </p>
          <ol className="mt-6 space-y-5">
            {[
              ["01", "Strategist", "Clarifies the decision and drafts the study plan."],
              ["02", "Approval", "Your team reviews the plan before execution."],
              ["03", "Interviewer", "Collects evidence with neutral adaptive probes."],
              ["04", "Analyst", "Tests hypotheses and traces findings to evidence."],
            ].map(([number, title, description]) => (
              <li
                key={number}
                className="flex gap-4 border-t border-black/8 pt-5 first:border-0 first:pt-0"
              >
                <span className="font-mono text-xs text-[#87927d]">{number}</span>
                <div>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#6b6e67]">{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}

function PortalGate() {
  const { isSignedIn } = useUser();

  return (
    <>
      {isSignedIn ? (
        <Portal />
      ) : (
        <main className="flex min-h-screen items-center justify-center bg-[#f8f7f3] px-6">
          <div className="max-w-md rounded-xl border border-black/10 bg-white p-8 text-center">
            <h1 className="text-2xl font-semibold">Sign in to open Hermes</h1>
            <p className="mt-3 text-sm leading-6 text-[#686d63]">
              Your research workspace is protected by Clerk and synced to Convex.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <SignInButton mode="modal">
                <button className="rounded-lg bg-[#20231f] px-4 py-2 text-sm font-medium text-white">
                  Sign in
                </button>
              </SignInButton>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-lg border border-black/10 px-4 py-2 text-sm font-medium"
              >
                Back home
              </button>
            </div>
          </div>
        </main>
      )}
    </>
  );
}

export function App() {
  const pathname = usePathname();
  if (pathname.startsWith("/interview/")) {
    const inviteId = decodeURIComponent(pathname.split("/")[2] || "demo");
    return <InterviewClient invite={getInterviewInvite(inviteId)} />;
  }

  return pathname.startsWith("/portal") ? <PortalGate /> : <Home />;
}
