// Laminar eval suite for the AI Interviewer (convex/interviews.ts -> nextStep).
//
// What we are checking, per test case:
//   valid_json        the interviewer returns a single parseable JSON step (deterministic)
//   correct_completion  it ends the interview after 5 answers, and only then (deterministic)
//   neutral_question  the next question is not leading / does not push a hypothesis (LLM judge)
//   in_scope          the question serves the study's learning objectives (LLM judge)
//
// Run with:  pnpm eval:interviewer   (see evals/README.md)

import { evaluate } from "@lmnr-ai/lmnr";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { callModel, llmJudge, parseStepLoose } from "./lib";

type Invite = {
  studyTitle: string;
  researchGoal: string;
  learningObjectives: string[];
  respondentLabel: string;
  estimatedMinutes: number;
  sponsor: string;
};
type Answer = { stepId: string; label: string; value: string | string[] };
type CaseData = { invite: Invite; answers: Answer[] };
type CaseTarget = { expectComplete: boolean; mustBeNeutral?: boolean };

const cases: Array<{ name: string; data: CaseData; target: CaseTarget }> =
  JSON.parse(readFileSync(resolve(process.cwd(), "evals/datasets/interviewer-cases.json"), "utf8"));

// Source of truth: convex/interviews.ts buildPrompt(). Kept in sync here so the
// eval exercises the exact instructions the app sends the interviewer model.
function buildPrompt(invite: Invite, answers: Answer[]): string {
  return [
    "Return only valid JSON for one next interview step. Do not include markdown.",
    "Generate both the next question and the possible answer controls from the research brief.",
    "Do not copy or depend on a predefined script.",
    "Keep the question short, concrete, and unbiased.",
    "Prefer single_select, multi_select, or scale controls when useful; use text only when the answer needs open context.",
    "Options must be mutually understandable, non-leading, and grounded in what the study wants to learn.",
    "Allowed step types: single_select, multi_select, text, scale, complete.",
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

evaluate({
  name: "interviewer",
  groupName: "meridian-week10",
  data: cases.map((c) => ({ data: c, target: c.target })),

  // Executor: run the real interviewer prompt through the model.
  executor: async (c: (typeof cases)[number]) => {
    const raw = await callModel([
      {
        role: "system",
        content:
          "You are Meridian, a neutral customer research interviewer. " +
          "Return only valid JSON for one next interview step. Do not include markdown. " +
          "Keep the question short, concrete, and unbiased. Prefer answer controls over long free text.",
      },
      { role: "user", content: buildPrompt(c.data.invite, c.data.answers) },
    ]);
    let step: Record<string, unknown> | null = null;
    try {
      step = parseStepLoose(raw);
    } catch {
      step = null;
    }
    // The question text may land under prompt / question / label depending on how
    // well the model follows the schema. We judge the *question* wherever it is,
    // and separately score schema-conformance below.
    const questionText = step
      ? String(step.prompt ?? step.question ?? step.label ?? "")
      : "";
    return { raw, step, questionText };
  },

  evaluators: {
    valid_json: (out) => (out.step ? 1 : 0),

    // The app's real contract (convex/interviews.ts normalizeStep): the step must
    // have an `id`, an allowed `type`, and a non-empty `prompt`. Anything else gets
    // silently replaced with a fallback question in production — so we score it.
    follows_step_schema: (out) => {
      const s = out.step;
      if (!s) return 0;
      const allowed = ["single_select", "multi_select", "text", "scale", "complete"];
      const hasId = typeof s.id === "string" && /^[a-z0-9]+(_[a-z0-9]+)*$/.test(s.id as string);
      const okType = typeof s.type === "string" && allowed.includes(s.type as string);
      const hasPrompt =
        s.type === "complete" ||
        (typeof s.prompt === "string" && (s.prompt as string).trim().length > 0);
      return hasId && okType && hasPrompt ? 1 : 0;
    },

    correct_completion: (out, target) => {
      if (!out.step) return 0;
      const isComplete = out.step.type === "complete";
      return isComplete === (target as CaseTarget).expectComplete ? 1 : 0;
    },

    neutral_question: async (out) => {
      // Skip the deliberate "complete" case; judge the actual question otherwise.
      if (out.step?.type === "complete") return 1;
      if (!out.questionText) return 0;
      return llmJudge(
        "The interview question is neutral and non-leading: it does NOT assume an answer, " +
          "push the respondent toward a conclusion, or embed the sponsor's hypothesis " +
          "(e.g. it must not presuppose the price is 'too high').",
        out.questionText,
      );
    },

    in_scope: async (out) => {
      if (out.step?.type === "complete") return 1;
      if (!out.questionText) return 0;
      return llmJudge(
        "The question plausibly serves customer-research learning objectives and is not " +
          "unrelated, off-topic, or unnecessarily sensitive.",
        out.questionText,
      );
    },

    one_question_at_a_time: async (out) => {
      if (out.step?.type === "complete") return 1;
      if (!out.questionText) return 0;
      return llmJudge(
        "The step asks a SINGLE question, not two or more bundled together " +
          "(not double-barreled, e.g. not asking about delivery speed AND packaging in one question).",
        out.questionText,
      );
    },
  },
});
