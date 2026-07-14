import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("@clerk/react", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  useUser: () => ({ isLoaded: true, isSignedIn: false }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => async () => null,
  useQuery: () => null,
}));

vi.mock("@rive-app/react-webgl2", () => ({
  Alignment: { Center: "center" },
  Fit: { Cover: "cover" },
  Layout: class Layout {},
  useRive: () => ({ RiveComponent: () => null }),
}));

describe("top-level routes", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => cleanup());

  it("renders the landing page", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeTruthy();
  });

  it("renders the signed-out portal gate", () => {
    window.history.replaceState({}, "", "/portal");
    render(<App />);
    expect(screen.getByRole("heading", { name: /sign in to open your workspace/i })).toBeTruthy();
  });

  it("renders an invalid participant invitation safely", () => {
    window.history.replaceState({}, "", "/interview/not-a-real-token");
    render(<App />);
    expect(screen.getByRole("heading", { name: /invite is not available/i })).toBeTruthy();
  });
});
