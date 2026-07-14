import { SignInButton, useUser } from "@clerk/react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { InterviewClient } from "./InterviewPrototype";
import { Landing } from "./Landing";
import { Portal } from "./Portal";
import { getInterviewInvite } from "./lib/interview-prototype";
import { navigate, usePathname } from "./lib/navigation";

function PortalGate() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-6">
        <div className="w-full max-w-md">
          <p className="font-mono-ds text-[11px] uppercase tracking-[0.18em] text-[#A84A2F]">
            Meridian
          </p>
          <div className="mt-6 space-y-3">
            <div className="h-8 w-2/3 animate-pulse rounded bg-[#E7E0D2]" />
            <div className="h-4 w-full animate-pulse rounded bg-[#EEE9DD]" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-[#EEE9DD]" />
          </div>
        </div>
      </main>
    );
  }

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

function ParticipantInterviewRoute({ token }: { token: string }) {
  const invite = useQuery(api.participantInvites.getByToken, { token });
  if (invite === undefined) {
    return <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] text-sm text-[#706c63]">Loading invitation...</main>;
  }
  if (!invite) {
    return <InvalidInvite />;
  }
  return <InterviewClient invite={invite} />;
}

export function App() {
  const pathname = usePathname();
  if (pathname.startsWith("/interview/")) {
    const inviteId = decodeURIComponent(pathname.split("/")[2] || "demo");
    const invite = getInterviewInvite(inviteId);
    return invite ? <InterviewClient invite={invite} /> : <ParticipantInterviewRoute token={inviteId} />;
  }

  return pathname.startsWith("/portal") ? <PortalGate /> : <Landing />;
}

function InvalidInvite() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-6 text-[#171612]">
      <div className="w-full max-w-md">
        <p className="font-mono-ds text-[11px] uppercase tracking-[0.18em] text-[#A84A2F]">
          Meridian
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium">This invite is not available</h1>
        <p className="mt-3 text-sm leading-6 text-[#57544C]">
          The link may be expired, revoked, already completed, or mistyped.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-8 rounded-full bg-[#C2593B] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#A84A2F]"
        >
          Back to Meridian
        </button>
      </div>
    </main>
  );
}
