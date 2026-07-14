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
  JSON.parse(readFileSync(new URL("./datasets/interviewer-cases.json", import.meta.url), "utf8"));

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
    return { raw, step };
  },

  evaluators: {
    valid_json: (out) => (out.step ? 1 : 0),

    correct_completion: (out, target) => {
      if (!out.step) return 0;
      const isComplete = out.step.type === "complete";
      return isComplete === (target as CaseTarget).expectComplete ? 1 : 0;
    },

    neutral_question: async (out) => {
      // Only judged where it matters (and skip the deliberate "complete" case).
      if (out.step?.type === "complete") return 1;
      if (!out.step) return 0;
      const prompt = String(out.step.prompt ?? "");
      return llmJudge(
        "The interview question is neutral and non-leading: it does NOT assume an answer, " +
          "push the respondent toward a conclusion, or embed the sponsor's hypothesis " +
          "(e.g. it must not presuppose the price is 'too high').",
        prompt,
      );
    },

    in_scope: async (out) => {
      if (out.step?.type === "complete") return 1;
      if (!out.step) return 0;
      return llmJudge(
        "The question plausibly serves customer-research learning objectives and is not " +
          "unrelated, off-topic, or unnecessarily sensitive.",
        String(out.step.prompt ?? ""),
      );
    },
  },
});
