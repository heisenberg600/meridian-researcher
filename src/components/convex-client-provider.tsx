"use client";

import { useAuth } from "@clerk/react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: React.ReactNode }) {
  if (!convex) {
    return <ConfigurationError missing="VITE_CONVEX_URL" />;
  }
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export function ConfigurationError({ missing }: { missing: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF9F6] px-6 text-[#171612]">
      <div className="w-full max-w-lg rounded-2xl border border-[#DDD7CA] bg-white p-8 shadow-sm">
        <p className="font-mono-ds text-[11px] uppercase tracking-[0.18em] text-[#A84A2F]">
          Meridian setup
        </p>
        <h1 className="font-display mt-4 text-3xl font-medium">Workspace configuration is missing</h1>
        <p className="mt-3 text-sm leading-6 text-[#57544C]">
          Add <code className="rounded bg-[#F3EFE6] px-1.5 py-0.5">{missing}</code> to the
          deployment environment, then rebuild the application.
        </p>
      </div>
    </main>
  );
}
