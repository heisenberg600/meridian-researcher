import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Mode, Status } from "@elevenlabs/client";
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

function getInterviewSessionKey(inviteId: string) {
  const storageKey = `meridian:interview-session:${inviteId}`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const next =
    typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(storageKey, next);
  return next;
}

export function InterviewClient({ invite }: InterviewClientProps) {
  const getAiStep = useAction(api.interviews.nextStep);
  const saveAnswer = useMutation(api.interviews.saveAnswer);
  const recordConsent = useMutation(api.interviews.recordConsent);
  const voiceConfig = useQuery(api.interviews.voiceConfig);
  const [sessionKey] = useState(() => getInterviewSessionKey(invite.id));
  const savedSession = useQuery(api.interviews.sessionForInvite, {
    inviteId: invite.id,
    sessionKey,
  });
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
  const [hasHydratedSession, setHasHydratedSession] = useState(false);
  const [consentStatus, setConsentStatus] = useState(invite.consentStatus ?? "pending");
  const [consentError, setConsentError] = useState<string | null>(null);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const hydrationStartedRef = useRef(false);

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
    if (savedSession === undefined || hydrationStartedRef.current) return;

    hydrationStartedRef.current = true;
    const savedAnswers = (savedSession?.answers ?? []) as InterviewAnswer[];
    setAnswers(savedAnswers);
    setMode(savedSession?.mode ?? (savedAnswers.length > 0 ? "chat" : null));
    setIsThinking(true);

    void loadStep(savedAnswers).then((result) => {
      setStep(result.step);
      setGateway(result.gateway);
      setHasHydratedSession(true);
      setIsThinking(false);
    });

  }, [loadStep, savedSession]);

  async function submitAnswer(value: string | string[]) {
    if (!mode || !step || step.type === "complete" || isThinking) return;

    const nextAnswers = [
      ...answers,
      {
        stepId: step.id,
        label: getAnswerLabel(step, value),
        value,
      },
    ];

    setIsThinking(true);
    setAnswers(nextAnswers);
    await saveAnswer({
      invite,
      sessionKey,
      mode,
      answer: nextAnswers[nextAnswers.length - 1],
    });
    const result = await loadStep(nextAnswers);

    setStep(result.step);
    setGateway(result.gateway);
    setDraftText("");
    setMultiChoice([]);
    setScaleValue("3");
    setIsThinking(false);
  }

  function recordVoiceAnswer(question: string, value: string) {
    setAnswers((current) => {
      const answer = {
        stepId: `voice-${current.length + 1}`,
        label: question,
        value,
      };
      void saveAnswer({
        invite,
        sessionKey,
        mode: "voice",
        answer,
      });
      return [...current, answer];
    });
  }

  async function chooseConsent(granted: boolean) {
    setIsSavingConsent(true);
    setConsentError(null);
    try {
      if (invite.id !== "demo") {
        await recordConsent({ inviteId: invite.id, granted });
      }
      setConsentStatus(granted ? "granted" : "declined");
    } catch (error) {
      setConsentError(error instanceof Error ? error.message : "Could not save your response");
    } finally {
      setIsSavingConsent(false);
    }
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
            {!hasHydratedSession ? (
              <div className="mx-auto w-full max-w-3xl">
                <p className="text-sm font-medium text-[var(--text-secondary)]">
                  Loading interview...
                </p>
              </div>
            ) : consentStatus !== "granted" ? (
              <ConsentGate
                consentStatus={consentStatus}
                error={consentError}
                isSaving={isSavingConsent}
                onChoose={chooseConsent}
              />
            ) : !mode ? (
              <ModeSelect
                invite={invite}
                isVoiceConfigured={voiceConfig?.enabled}
                setMode={setMode}
              />
            ) : mode === "voice" ? (
              <VoiceExperiment
                answers={answers}
                invite={invite}
                onUseChat={() => setMode("chat")}
                recordAnswer={recordVoiceAnswer}
              />
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

export function ConsentGate({
  consentStatus,
  error,
  isSaving,
  onChoose,
}: {
  consentStatus: "unknown" | "pending" | "granted" | "declined";
  error: string | null;
  isSaving: boolean;
  onChoose: (granted: boolean) => Promise<void>;
}) {
  if (consentStatus === "declined") {
    return (
      <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Your choice is saved</p>
        <h2 className="mt-3 text-2xl font-semibold text-[var(--text-heading)]">You declined this interview</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">No interview answers will be collected.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-[var(--border-default)] bg-[var(--surface-card)] p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Before we begin</p>
      <h2 className="mt-3 text-2xl font-semibold text-[var(--text-heading)]">Consent to take part</h2>
      <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
        Meridian will record your responses for this research study and share them with the study team for analysis. Participation is voluntary, and you may decline now.
      </p>
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onChoose(true)}
          className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "I agree and want to continue"}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void onChoose(false)}
          className="rounded-full border border-[var(--border-default)] px-5 py-2.5 text-sm font-medium text-[var(--text-heading)] disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}

function ModeSelect({
  invite,
  isVoiceConfigured,
  setMode,
}: {
  invite: InterviewInvite;
  isVoiceConfigured: boolean | undefined;
  setMode: (mode: InterviewMode) => void;
}) {
  const voiceAllowedByInvite = invite.preferredMode !== "form";
  const voiceDisabledLabel = !voiceAllowedByInvite
    ? "Chat only"
    : isVoiceConfigured === undefined
      ? "Checking"
      : "Unavailable";
  const voiceDisabledReason = !voiceAllowedByInvite
    ? "This invite is configured for chat responses."
    : isVoiceConfigured === undefined
      ? "Checking ElevenLabs voice availability..."
      : !isVoiceConfigured
        ? "Voice is temporarily unavailable while ElevenLabs is configured."
        : null;

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
          description={
            voiceDisabledReason ??
            "Live ElevenLabs interview with adaptive spoken follow-ups."
          }
          disabled={Boolean(voiceDisabledReason)}
          disabledLabel={voiceDisabledLabel}
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
      ? "AI generated"
      : `${gateway.source} fallback`;

  return (
    <span className="rounded-full border border-[var(--border-default)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
      {label}
    </span>
  );
}

function ModeButton({
  description,
  disabled,
  disabledLabel,
  label,
  onClick,
}: {
  description: string;
  disabled?: boolean;
  disabledLabel?: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group min-h-[150px] rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-card)] p-5 text-left shadow-[var(--shadow-xs)] transition ${
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:border-[var(--accent)] hover:bg-white"
      }`}
    >
      <span className="flex items-center justify-between gap-3 text-2xl font-semibold tracking-tight">
        {label}
        {disabled ? (
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            {disabledLabel ?? "Unavailable"}
          </span>
        ) : null}
      </span>
      <span className="mt-3 block text-sm leading-6 text-[var(--text-secondary)]">{description}</span>
      {!disabled ? (
        <span className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-white transition group-hover:bg-[var(--accent)]">
          -&gt;
        </span>
      ) : null}
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
        Preparing the next question...
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
  answers,
  invite,
  onUseChat,
  recordAnswer,
}: {
  answers: InterviewAnswer[];
  invite: InterviewInvite;
  onUseChat: () => void;
  recordAnswer: (question: string, value: string) => void;
}) {
  const createVoiceToken = useAction(api.interviews.voiceToken);
  const conversationRef = useRef<Conversation | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<Status>("disconnected");
  const [voiceMode, setVoiceMode] = useState<Mode>("listening");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ role: "agent" | "user"; message: string }>>([]);

  useEffect(() => {
    return () => {
      void conversationRef.current?.endSession();
      conversationRef.current = null;
    };
  }, []);

  async function startVoiceInterview() {
    if (voiceStatus === "connecting" || voiceStatus === "connected") return;

    setVoiceError(null);
    setVoiceStatus("connecting");

    try {
      const { Conversation } = await import("@elevenlabs/client");
      const session = await createVoiceToken({
        invite,
        answers,
      });

      const conversation = await Conversation.startSession({
        conversationToken: session.token,
        connectionType: "webrtc",
        dynamicVariables: session.dynamicVariables,
        clientTools: {
          record_interview_answer: async (parameters: unknown) => {
            const answer = normalizeVoiceToolAnswer(parameters);
            if (!answer) return "The question or answer was missing. Please try recording it again.";

            recordAnswer(answer.question, answer.value);
            return "Answer recorded. Decide whether a useful follow-up is needed, then continue naturally.";
          },
        },
        onConnect: ({ conversationId }) => {
          setConversationId(conversationId);
          setVoiceStatus("connected");
        },
        onDisconnect: (details) => {
          conversationRef.current = null;
          setVoiceStatus("disconnected");
          setIsMuted(false);
          if (details.reason === "error") {
            setVoiceError(getVoiceErrorMessage(details.message));
          }
        },
        onError: (message) => {
          setVoiceError(message);
          setVoiceStatus("disconnected");
        },
        onMessage: ({ role, message }) => {
          setMessages((current) => [...current.slice(-5), { role, message }]);
        },
        onModeChange: ({ mode }) => {
          setVoiceMode(mode);
        },
        onStatusChange: ({ status }) => {
          setVoiceStatus(status);
        },
      });

      conversationRef.current = conversation;
    } catch (error) {
      setVoiceStatus("disconnected");
      setVoiceError(getVoiceErrorMessage(error));
    }
  }

  async function stopVoiceInterview() {
    await conversationRef.current?.endSession();
    conversationRef.current = null;
    setVoiceStatus("disconnected");
    setIsMuted(false);
  }

  function toggleMute() {
    const nextMuted = !isMuted;
    conversationRef.current?.setMicMuted(nextMuted);
    setIsMuted(nextMuted);
  }

  const isConnected = voiceStatus === "connected";
  const isStarting = voiceStatus === "connecting";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-[var(--border-default)] bg-white px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          ElevenLabs {voiceStatus}
        </span>
        {isConnected ? (
          <span className="rounded-full bg-[var(--accent-softer)] px-3 py-1 text-xs font-medium text-[var(--accent-active)]">
            {voiceMode}
          </span>
        ) : null}
      </div>
      <h2 className="mt-5 text-[var(--text-heading)]" style={{ font: "var(--text-display-lg)" }}>
        Voice interview
      </h2>
      <p className="mt-5 text-base leading-7 text-[var(--text-secondary)]">
        The interviewer chooses its questions and follow-ups from the research goals and what you
        say. Speak naturally; there are no predetermined voice questions.
      </p>

      {voiceError ? (
        <p className="mt-5 rounded-lg bg-[var(--status-warning-bg)] p-3 text-sm leading-6 text-[var(--status-warning)]">
          {voiceError}
        </p>
      ) : null}

      {conversationId ? (
        <p className="mt-4 font-mono text-xs text-[var(--text-muted)]">Conversation {conversationId}</p>
      ) : null}

      {messages.length > 0 ? (
        <div className="mt-6 space-y-2">
          {messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              className="rounded-lg bg-[var(--bg-sunken)] px-3 py-2 text-sm leading-6 text-[var(--text-secondary)]"
            >
              <span className="font-medium text-[var(--text-heading)]">{message.role}: </span>
              {message.message}
            </p>
          ))}
        </div>
      ) : null}

      <div className="mt-7 flex flex-wrap gap-3">
        {isConnected ? (
          <>
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-lg border border-[var(--border-default)] bg-white px-5 py-3 text-sm font-semibold text-[var(--text-heading)] hover:border-[var(--accent)]"
            >
              {isMuted ? "Unmute mic" : "Mute mic"}
            </button>
            <button
              type="button"
              onClick={() => void stopVoiceInterview()}
              className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)]"
            >
              End voice
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isStarting}
            onClick={() => void startVoiceInterview()}
            className="rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isStarting ? "Starting voice..." : "Start voice"}
          </button>
        )}
        <button
          type="button"
          onClick={onUseChat}
          className="rounded-lg border border-[var(--border-default)] bg-white px-5 py-3 text-sm font-semibold text-[var(--text-heading)] hover:border-[var(--accent)]"
        >
          Use chat
        </button>
      </div>
    </div>
  );
}

function normalizeVoiceToolAnswer(parameters: unknown) {
  if (!parameters || typeof parameters !== "object") {
    return null;
  }

  const record = parameters as Record<string, unknown>;
  const question = record.question;
  const value = record.value ?? record.answer ?? record.response;

  if (
    typeof question === "string" &&
    question.trim().length > 0 &&
    typeof value === "string" &&
    value.trim().length > 0
  ) {
    return {
      question: question.trim(),
      value: value.trim(),
    };
  }

  return null;
}

function getVoiceErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unable to start ElevenLabs voice session.";

  if (message.includes("Missing ELEVENLABS_API_KEY") || message.includes("ELEVENLABS_AGENT_ID")) {
    return "ElevenLabs is not configured yet. Add ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to the Convex environment to enable voice.";
  }

  if (message.includes("Permission denied") || message.includes("Microphone")) {
    return "Microphone access was blocked. Allow microphone access in the browser to start the voice interview.";
  }

  return message;
}
