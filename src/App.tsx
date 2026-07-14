import { SignInButton, useUser } from "@clerk/react";
import { InterviewClient } from "./InterviewPrototype";
import { Landing } from "./Landing";
import { Portal } from "./Portal";
import { getInterviewInvite } from "./lib/interview-prototype";
import { navigate, usePathname } from "./lib/navigation";

function PortalGate() {
  const { isSignedIn } = useUser();

  if (isSignedIn) {
    return <Portal />;
  }

  return (
    <main className="flex min-h-screen bg-[#FAF9F6]">
      <aside className="relative hidden w-2/5 lg:block" aria-hidden>
        <img
          src="/landing/auth-panel.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      </aside>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md">
          <p className="font-mono-ds text-[11px] uppercase tracking-[0.18em] text-[#A84A2F]">
            Meridian
          </p>
          <h1 className="font-display mt-4 text-3xl font-medium text-[#171612]">
            Sign in to open your workspace
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#57544C]">
            Your studies, interviews, and findings live here, protected by Clerk and synced to
            Convex.
          </p>
          <div className="mt-8 flex gap-3">
            <SignInButton mode="modal" forceRedirectUrl="/portal">
              <button className="rounded-full bg-[#C2593B] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A84A2F]">
                Sign in
              </button>
            </SignInButton>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-full border border-[#CFCBBF] px-5 py-2.5 text-sm font-medium text-[#171612] hover:bg-white"
            >
              Back home
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function App() {
  const pathname = usePathname();
  if (pathname.startsWith("/interview/")) {
    const inviteId = decodeURIComponent(pathname.split("/")[2] || "demo");
    return <InterviewClient invite={getInterviewInvite(inviteId)} />;
  }

  return pathname.startsWith("/portal") ? <PortalGate /> : <Landing />;
}
