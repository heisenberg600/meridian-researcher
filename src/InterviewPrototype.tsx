import { useAction } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import {
  getAnswerLabel,
  getNextInterviewStep,
  type InterviewAnswer,
  type InterviewInvite,
  type InterviewMode,
  type InterviewStep,
} from "./lib/interview-prototype";

type InterviewClientProps = {
  invite: InterviewInvite;
};

type GatewayState = {
  source: "local" | "scripted" | "gateway";
  model: string;
  warning?: string;
};

export function InterviewClient({ invite }: InterviewClientProps) {
  const getAiStep = useAction(api.interviews.nextStep);
  const [mode, setMode] = useState<InterviewMode | null>(null);
  const [answers, setAnswers] = useState<InterviewAnswer[]>([]);
  const [step, setStep] = useState<InterviewStep | null>(null);
  const [gateway, setGateway] = useState<GatewayState>({
    source: "local",
    model: "google/gemini-3.1-flash-lite",
  });
  const [isThinking, setIsThinking] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [multiChoice, setMultiChoice] = useState<string[]>([]);
  const [scaleValue, setScaleValue] = useState("3");

  const progress = step?.type === "complete" ? 100 : Math.round((answers.length / 5) * 100);
  const stepNumber = Math.min(answers.length + 1, 5);

  const loadStep = useCallback(
    async (nextAnswers: InterviewAnswer[]) => {
      try {
        const result = await getAiStep({
          invite,
          answers: nextAnswers,
        });
        return {
          step: result.step as InterviewStep,
          gateway: {
            source: result.source,
            model: result.model,
            warning: result.warning,
          } satisfies GatewayState,
        };
      } catch (error) {
        return {
          step: getNextInterviewStep(nextAnswers),
          gateway: {
            source: "local",
            model: "google/gemini-3.1-flash-lite",
            warning: error instanceof Error ? error.message : "AI gateway unavailable.",
          } satisfies GatewayState,
        };
      }
    },
    [getAiStep, invite],
  );

  useEffect(() => {
    let isActive = true;

    async function loadInitialStep() {
      setIsThinking(true);
      const result = await loadStep([]);

      if (isActive) {
        setStep(result.step);
        setGateway(result.gateway);
        setIsThinking(false);
      }
    }

    void loadInitialStep();

    return () => {
      isActive = false;
    };
  }, [loadStep]);

  async function submitAnswer(value: string | string[]) {
    if (!step || step.type === "complete" || isThinking) return;

    const nextAnswers = [
      ...answers,
      {
        stepId: step.id,
        label: getAnswerLabel(step, value),
        value,
      },
    ];

    setIsThinking(true);
    const result = await loadStep(nextAnswers);

    setAnswers(nextAnswers);
    setStep(result.step);
    setGateway(result.gateway);
    setDraftText("");
    setMultiChoice([]);
    setScaleValue("3");
    setIsThinking(false);
  }

  return (
    <main className="min-h-screen bg-[var(--bg-page)] text-[var(--ink-700)]">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-5 md:px-8">
        <header className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => window.history.length > 1 ? window.history.back() : undefined}
            className="text-left"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {invite.sponsor}
            </p>
            <h1 className="mt-1 text-lg font-semibold tracking-tight">{invite.studyTitle}</h1>
          </button>
          <div className="hidden items-center gap-3 text-sm text-[var(--text-secondary)] sm:flex">
            <span>{invite.respondentLabel}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--text-muted)]" />
            <span>{invite.estimatedMinutes} min</span>
          </div>
        </header>

        <div className="mt-5 h-1 rounded-full bg-[var(--ivory-300)]">
          <div
            className="h-1 rounded-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <section className="grid flex-1 gap-8 py-8 lg:grid-cols-[1fr_340px]">
          <div className="flex min-h-[620px] flex-col justify-center">
            {!mode ? (
              <ModeSelect invite={invite} setMode={setMode} />
            ) : mode === "voice" ? (
              <VoiceExperiment gateway={gateway} step={step} onUseChat={() => setMode("chat")} />
            ) : (
              <div className="mx-auto w-full max-w-3xl">
                <div className="mb-7 flex items-center gap-3">
                  <span className="font-mono text-sm text-[var(--accent)]">
                    {step?.type === "complete"
                      ? "done"
                      : `${stepNumber.toString().padStart(2, "0")}`}
                  </span>
                  <GatewayBadge gateway={gateway} isThinking={isThinking} />
                </div>

                <h2
                  className="text-[var(--text-heading)]"
                  style={{
                    font: "var(--text-display-lg)",
                    letterSpacing: "var(--tracking-display)",
                  }}
                >
                  {step?.prompt ?? "Preparing your first AI-generated question..."}
                </h2>
                {step && step.type !== "complete" && step.helper ? (
                  <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
                    {step.helper}
                  </p>
                ) : null}

                <div className="mt-10">
                  <StepInput
                    draftText={draftText}
                    isThinking={isThinking}
                    multiChoice={multiChoice}
                    scaleValue={scaleValue}
                    setDraftText={setDraftText}
                    setMultiChoice={setMultiChoice}
                    setScaleValue={setScaleValue}
                    step={step}
                    submitAnswer={submitAnswer}
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-xs)]">
            <h2 className="text-sm font-semibold">Response capture</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              These are the structured fields the backend will persist against the invite session.
            </p>

            <div className="mt-5 space-y-3">
              {answers.length === 0 ? (
                <p className="rounded-lg bg-[var(--bg-sunken)] p-3 text-sm leading-6 text-[var(--text-secondary)]">
                  No answers yet.
                </p>
              ) : (
                answers.map((answer, index) => (
                  <div key={`${answer.stepId}-${index}`} className="rounded-lg bg-[var(--bg-sunken)] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
                      {answer.stepId.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-sm leading-6">{answer.label}</p>
                  </div>
                ))
              )}
            </div>

            {gateway.warning ? (
              <p className="mt-5 rounded-lg bg-[var(--status-warning-bg)] p-3 text-xs leading-5 text-[var(--status-warning)]">
                {gateway.warning}
              </p>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}

function ModeSelect({
  invite,
  setMode,
}: {
  invite: InterviewInvite;
  setMode: (mode: InterviewMode) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
        Public invite
      </p>
      <h2
        className="mt-4 text-[var(--text-heading)]"
        style={{
          font: "var(--text-display-xl)",
          letterSpacing: "var(--tracking-display)",
        }}
      >
        Choose how you want to answer.
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
        This interview takes about {invite.estimatedMinutes} minutes. Each answer changes the next
        prompt and is captured as structured research data.
      </p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <ModeButton
          description="Fast Typeform-style interview with AI-generated follow-ups."
          label="Chat"
          onClick={() => setMode("chat")}
        />
        <ModeButton
          description="Same flow, ready for ElevenLabs voice handoff."
          label="Voice"
          onClick={() => setMode("voice")}
        />
      </div>
    </div>
  );
}

function GatewayBadge({
  gateway,
  isThinking,
}: {
  gateway: GatewayState;
  isThinking: boolean;
}) {
  const label = isThinking
    ? "AI thinking"
    : gateway.source === "gateway"
      ? `AI Gateway ${gateway.model}`
      : `${gateway.source} fallback`;

  return (
    <span className="rounded-full border border-[var(--border-default)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
      {label}
    </span>
  );
}

function ModeButton({
  description,
  label,
  onClick,
}: {
  description: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-h-[150px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 text-left shadow-[var(--shadow-xs)] transition hover:border-[var(--accent)] hover:bg-white"
    >
      <span className="block text-2xl font-semibold tracking-tight">{label}</span>
      <span className="mt-3 block text-sm leading-6 text-[var(--text-secondary)]">{description}</span>
      <span className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white transition group-hover:bg-[var(--accent)]">
        -&gt;
      </span>
    </button>
  );
}

function StepInput({
  draftText,
  isThinking,
  multiChoice,
  scaleValue,
  setDraftText,
  setMultiChoice,
  setScaleValue,
  step,
  submitAnswer,
}: {
  draftText: string;
  isThinking: boolean;
  multiChoice: string[];
  scaleValue: string;
  setDraftText: (value: string) => void;
  setMultiChoice: (value: string[]) => void;
  setScaleValue: (value: string) => void;
  step: InterviewStep | null;
  submitAnswer: (value: string | string[]) => void;
}) {
  if (isThinking) {
    return (
      <div className="flex items-center gap-3 text-sm font-medium text-[var(--text-secondary)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
        Preparing the next question...
      </div>
    );
  }

  if (!step) {
    return (
      <div className="flex items-center gap-3 text-sm font-medium text-[var(--text-secondary)]">
        <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
        Waiting for AI Gateway...
      </div>
    );
  }

  if (step.type === "complete") {
    return (
      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--accent-softer)] p-5">
        <p className="text-base leading-7 text-[var(--text-secondary)]">{step.summary}</p>
      </div>
    );
  }

  if (step.type === "text") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (draftText.trim()) submitAnswer(draftText.trim());
        }}
        className="space-y-4"
      >
        <textarea
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          placeholder={step.placeholder}
          rows={5}
          className="w-full resize-none border-0 border-b-2 border-[var(--border-strong)] bg-transparent px-0 py-4 text-2xl leading-9 outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
        />
        <ContinueButton disabled={!draftText.trim()} />
      </form>
    );
  }

  if (step.type === "scale") {
    return (
      <div>
        <input
          type="range"
          min={step.min}
          max={step.max}
          value={scaleValue}
          onChange={(event) => setScaleValue(event.target.value)}
          className="w-full accent-[var(--accent)]"
        />
        <div className="mt-4 flex items-center justify-between text-sm text-[var(--text-secondary)]">
          <span>{step.minLabel}</span>
          <span className="rounded-lg bg-white px-4 py-2 text-xl font-semibold text-[var(--accent-active)]">
            {scaleValue}
          </span>
          <span>{step.maxLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => submitAnswer(scaleValue)}
          className="mt-7 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]"
        >
          Continue
        </button>
      </div>
    );
  }

  if (step.type === "multi_select") {
    return (
      <div>
        <div className="grid gap-3">
          {step.options.map((option, index) => {
            const active = multiChoice.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setMultiChoice(
                    active
                      ? multiChoice.filter((value) => value !== option.value)
                      : [...multiChoice, option.value],
                  )
                }
                className={`flex items-start gap-4 rounded-lg border p-4 text-left transition ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-softer)]"
                    : "border-[var(--border-default)] bg-[var(--surface-card)] hover:border-[var(--accent)] hover:bg-white"
                }`}
              >
                <span className="font-mono text-sm text-[var(--accent)]">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-lg font-semibold">{option.label}</span>
                  {option.detail ? (
                    <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">
                      {option.detail}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <ContinueButton disabled={multiChoice.length === 0} onClick={() => submitAnswer(multiChoice)} />
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {step.options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          onClick={() => submitAnswer(option.value)}
          className="flex items-start gap-4 rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--accent)] hover:bg-white"
        >
          <span className="font-mono text-sm text-[var(--accent)]">
            {(index + 1).toString().padStart(2, "0")}
          </span>
          <span>
            <span className="block text-lg font-semibold">{option.label}</span>
            {option.detail ? (
              <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">{option.detail}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function ContinueButton({ disabled, onClick }: { disabled: boolean; onClick?: () => void }) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      disabled={disabled}
      onClick={onClick}
      className="mt-5 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
    >
      Continue
    </button>
  );
}

function VoiceExperiment({
  gateway,
  onUseChat,
  step,
}: {
  gateway: GatewayState;
  onUseChat: () => void;
  step: InterviewStep | null;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <GatewayBadge gateway={gateway} isThinking={false} />
      <h2 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">
        ElevenLabs will attach here.
      </h2>
      <p className="mt-5 text-base leading-7 text-[var(--text-secondary)]">
        The voice agent should call the same Convex gateway action as chat. It receives the invite
        id and current answers, then asks the returned prompt aloud.
      </p>
      <div className="mt-8 rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Current voice prompt
        </p>
        <p className="mt-2 text-lg leading-8">
          {step?.prompt ?? "Preparing your first AI-generated voice prompt..."}
        </p>
      </div>
      <button
        type="button"
        onClick={onUseChat}
        className="mt-7 rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]"
      >
        Try chat flow
      </button>
    </div>
  );
}
