import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { ConsentGate } from "./InterviewPrototype";

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

describe("participant consent", () => {
  afterEach(() => cleanup());

  it("requires an explicit agreement before the interview", () => {
    const onChoose = vi.fn(async () => undefined);
    render(
      <ConsentGate
        consentStatus="pending"
        error={null}
        isSaving={false}
        onChoose={onChoose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /agree and want to continue/i }));
    expect(onChoose).toHaveBeenCalledWith(true);
  });

  it("confirms that a declined participant will not be recorded", () => {
    render(
      <ConsentGate
        consentStatus="declined"
        error={null}
        isSaving={false}
        onChoose={vi.fn(async () => undefined)}
      />,
    );
    expect(screen.getByText(/no interview answers will be collected/i)).toBeTruthy();
  });
});
