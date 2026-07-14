import { v } from "convex/values";
import { action } from "./_generated/server";

type InterviewAnswer = {
  stepId: string;
  label: string;
  value: string | string[];
};

type InterviewStep =
  | {
      id: string;
      type: "single_select";
      prompt: string;
      helper?: string;
      required?: boolean;
      options: Array<{ value: string; label: string; detail?: string }>;
    }
  | {
      id: string;
      type: "multi_select";
      prompt: string;
      helper?: string;
      required?: boolean;
      options: Array<{ value: string; label: string; detail?: string }>;
    }
  | {
      id: string;
      type: "text";
      prompt: string;
      helper?: string;
      required?: boolean;
      placeholder: string;
    }
  | {
      id: string;
      type: "scale";
      prompt: string;
      helper?: string;
      required?: boolean;
      min: number;
      max: number;
      minLabel: string;
      maxLabel: string;
    }
  | {
      id: string;
      type: "complete";
      prompt: string;
      summary: string;
    };

const answerValidator = v.object({
  stepId: v.string(),
  label: v.string(),
  value: v.union(v.string(), v.array(v.string())),
});

const inviteValidator = v.object({
  id: v.string(),
  studyTitle: v.string(),
  researchGoal: v.string(),
  learningObjectives: v.array(v.string()),
  respondentLabel: v.string(),
  estimatedMinutes: v.number(),
  sponsor: v.string(),
});

const INTERVIEW_MODEL = "google/gemini-3.1-flash-lite";
const AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export const nextStep = action({
  args: {
    invite: inviteValidator,
    answers: v.array(answerValidator),
  },
  handler: async (_ctx, args) => {
    const fallbackStep = getScriptedStep(args.answers);
    const apiKey =
      process.env.AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_API_KEY ??
      process.env.VERCEL_AI_GATEWAY_KEY;
    const model = INTERVIEW_MODEL;

    if (args.answers.length >= 5) {
      return {
        step: {
          id: "complete",
          type: "complete" as const,
          prompt: "Thanks, that gives us a useful starting signal.",
          summary:
            "Your response has been captured. In the full study workflow, Meridian will save these answers with the invite session and route them into analysis.",
        },
        source: "gateway" as const,
        model,
      };
    }

    if (!apiKey) {
      return {
        step: fallbackStep,
        source: "scripted" as const,
        model,
        warning: "Missing AI_GATEWAY_API_KEY in Convex environment.",
      };
    }

    try {
      const response = await fetch(`${AI_GATEWAY_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: [
                "You are Meridian, a neutral customer research interviewer.",
                "Return only valid JSON for one next interview step. Do not include markdown.",
                "Keep the question short, concrete, and unbiased.",
                "Prefer answer controls over long free text.",
              ].join(" "),
            },
            {
              role: "user",
              content: buildPrompt(args.invite, args.answers),
            },
          ],
          temperature: 0.4,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AI Gateway request failed: ${response.status} ${errorText}`);
      }

      const payload = await response.json();
      const text = String(payload?.choices?.[0]?.message?.content ?? "");
      const step = parseStep(text);

      return {
        step,
        source: "gateway" as const,
        model,
      };
    } catch (error) {
      return {
        step: fallbackStep,
        source: "scripted" as const,
        model,
        warning: error instanceof Error ? error.message : "AI Gateway request failed.",
      };
    }
  },
});

export const voiceToken = action({
  args: {
    invite: inviteValidator,
    answers: v.array(answerValidator),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      throw new Error("Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID in Convex environment.");
    }

    const url = new URL(`${ELEVENLABS_BASE_URL}/convai/conversation/token`);
    url.searchParams.set("agent_id", agentId);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs token request failed: ${response.status} ${errorText}`);
    }

    const payload = await response.json();
    const token = payload?.token;

    if (typeof token !== "string" || token.length === 0) {
      throw new Error("ElevenLabs token response did not include a token.");
    }

    return {
      token,
      agentId,
      dynamicVariables: {
        invite_id: args.invite.id,
        study_title: args.invite.studyTitle,
        research_goal: args.invite.researchGoal,
        learning_objectives: args.invite.learningObjectives.join("; "),
        respondent_label: args.invite.respondentLabel,
        estimated_minutes: args.invite.estimatedMinutes,
        answer_count: args.answers.length,
        answers_json: JSON.stringify(args.answers),
      },
    };
  },
});

function buildPrompt(
  invite: {
    studyTitle: string;
    researchGoal: string;
    learningObjectives: string[];
    respondentLabel: string;
    estimatedMinutes: number;
  },
  answers: InterviewAnswer[],
) {
  return [
    "Return only valid JSON for one next interview step. Do not include markdown.",
    "Generate both the next question and the possible answer controls from the research brief.",
    "Do not copy or depend on a predefined script.",
    "Keep the question short, concrete, and unbiased.",
    "Prefer single_select, multi_select, or scale controls when useful; use text only when the answer needs open context.",
    "Options must be mutually understandable, non-leading, and grounded in what the study wants to learn.",
    "Allowed step types:",
    "- single_select: id, type, prompt, optional helper, options[{value,label,detail}]",
    "- multi_select: id, type, prompt, optional helper, options[{value,label,detail}]",
    "- text: id, type, prompt, optional helper, placeholder",
    "- scale: id, type, prompt, optional helper, min, max, minLabel, maxLabel",
    "- complete: id, type, prompt, summary",
    "Use snake_case ids. Option values must be short snake_case strings.",
    "After 5 respondent answers, return a complete step.",
    "Output shape must be a single JSON object, not wrapped in another field.",
    "",
    `Study title: ${invite.studyTitle}`,
    `Research goal: ${invite.researchGoal}`,
    `Learning objectives: ${JSON.stringify(invite.learningObjectives)}`,
    `Respondent group: ${invite.respondentLabel}`,
    `Target duration: ${invite.estimatedMinutes} minutes`,
    `Answers so far: ${JSON.stringify(answers)}`,
    "Choose the next question that will maximize useful research signal while keeping the interview easy to answer.",
  ].join("\n");
}

function parseStep(text: string): InterviewStep {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return normalizeStep(parsed);
}

function normalizeStep(value: unknown): InterviewStep {
  if (!value || typeof value !== "object") {
    throw new Error("Gemini returned a non-object step.");
  }

  const record = value as Record<string, unknown>;
  const id = stringOr(record.id, "next_question");
  const prompt = stringOr(record.prompt, "Could you tell us a little more?");
  const helper = optionalString(record.helper);
  const required = typeof record.required === "boolean" ? record.required : undefined;

  if (record.type === "complete") {
    return {
      id,
      type: "complete",
      prompt,
      summary: stringOr(record.summary, "Your response has been captured."),
    };
  }

  if (record.type === "text") {
    return {
      id,
      type: "text",
      prompt,
      helper,
      required,
      placeholder: stringOr(record.placeholder, "Type your answer..."),
    };
  }

  if (record.type === "scale") {
    return {
      id,
      type: "scale",
      prompt,
      helper,
      required,
      min: numberOr(record.min, 1),
      max: numberOr(record.max, 5),
      minLabel: stringOr(record.minLabel, "Low"),
      maxLabel: stringOr(record.maxLabel, "High"),
    };
  }

  if (record.type === "single_select" || record.type === "multi_select") {
    const options = normalizeOptions(record.options);
    if (record.type === "single_select") {
      return { id, type: "single_select", prompt, helper, required, options };
    }
    return { id, type: "multi_select", prompt, helper, required, options };
  }

  throw new Error("Gemini returned an unsupported step type.");
}

function normalizeOptions(value: unknown) {
  const options = Array.isArray(value) ? value : [];
  const normalized = options
    .flatMap((option, index) => {
      if (!option || typeof option !== "object") return [];
      const record = option as Record<string, unknown>;
      return {
        value: stringOr(record.value, `option_${index + 1}`),
        label: stringOr(record.label, `Option ${index + 1}`),
        detail: optionalString(record.detail),
      };
    })
    .slice(0, 6);

  if (normalized.length < 2) {
    throw new Error("Gemini returned too few options.");
  }

  return normalized;
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getScriptedStep(answers: InterviewAnswer[]): InterviewStep {
  const values = new Map(answers.map((answer) => [answer.stepId, answer.value]));
  const role = String(values.get("role") ?? "");
  const painPoints = values.get("pain_points");

  if (!values.has("role")) {
    return {
      id: "role",
      type: "single_select",
      prompt: "Which role best matches how you make or influence research decisions?",
      helper: "This helps the interviewer adapt probes and examples.",
      required: true,
      options: [
        {
          value: "founder",
          label: "Founder or operator",
          detail: "I need fast evidence for product or go-to-market decisions.",
        },
        {
          value: "product",
          label: "Product leader",
          detail: "I shape roadmap, discovery, or prioritization choices.",
        },
        {
          value: "research",
          label: "Researcher",
          detail: "I design studies and synthesize customer evidence.",
        },
        {
          value: "growth",
          label: "Growth or sales",
          detail: "I need buyer, competitor, or messaging signal.",
        },
      ],
    };
  }

  if (!values.has("context")) {
    return {
      id: "context",
      type: "text",
      prompt: "What situation should we understand before asking more specific questions?",
      helper: "One or two sentences is enough. The live agent will probe based on your answer.",
      placeholder:
        role === "research"
          ? "Tell us what usually slows down study design, recruitment, interviewing, or synthesis."
          : "Tell us about the decision you recently needed customer evidence for.",
      required: true,
    };
  }

  if (!values.has("pain_points")) {
    return {
      id: "pain_points",
      type: "multi_select",
      prompt: "Where does the current research process lose the most momentum?",
      helper: "Choose all that apply. The next question changes based on this.",
      options: [
        {
          value: "brief",
          label: "Getting to a clear brief",
          detail: "Stakeholders disagree on what needs to be learned.",
        },
        {
          value: "recruiting",
          label: "Finding the right people",
          detail: "Recruiting or outreach takes too long.",
        },
        {
          value: "interviews",
          label: "Running interviews",
          detail: "Quality varies or interviewers miss good follow-ups.",
        },
        {
          value: "synthesis",
          label: "Turning raw notes into evidence",
          detail: "Findings are slow, subjective, or hard to trace.",
        },
      ],
    };
  }

  if (!values.has("priority")) {
    const selected = Array.isArray(painPoints) ? painPoints : [];
    const prompt = selected.includes("recruiting")
      ? "If recruitment became reliable, how much would that change your willingness to run more studies?"
      : selected.includes("synthesis")
        ? "If every finding linked back to source evidence automatically, how valuable would that be?"
        : selected.includes("interviews")
          ? "If an adaptive interviewer handled neutral probing consistently, how valuable would that be?"
          : "If Meridian helped turn fuzzy stakeholder questions into a clear research plan, how valuable would that be?";

    return {
      id: "priority",
      type: "scale",
      prompt,
      helper: "Use your first instinct.",
      min: 1,
      max: 5,
      minLabel: "Nice to have",
      maxLabel: "Very valuable",
    };
  }

  if (!values.has("follow_up")) {
    return {
      id: "follow_up",
      type: "single_select",
      prompt: "Would you be open to a deeper follow-up if this study needs more detail?",
      options: [
        { value: "yes", label: "Yes", detail: "You can contact me for a short follow-up." },
        { value: "maybe", label: "Maybe", detail: "Ask me after I see the topic." },
        { value: "no", label: "No", detail: "Use only this response." },
      ],
    };
  }

  return {
    id: "complete",
    type: "complete",
    prompt: "Thanks, that gives us a useful starting signal.",
    summary:
      "Your structured response is ready to save against the study once persistence is connected.",
  };
}
