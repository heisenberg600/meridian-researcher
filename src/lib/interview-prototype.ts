export type InterviewMode = "chat" | "voice";

export type InterviewAnswer = {
  stepId: string;
  label: string;
  value: string | string[];
};

type BaseInterviewStep = {
  id: string;
  prompt: string;
  helper?: string;
  required?: boolean;
};

export type InterviewStep =
  | (BaseInterviewStep & {
      type: "single_select";
      options: Array<{ value: string; label: string; detail?: string }>;
    })
  | (BaseInterviewStep & {
      type: "multi_select";
      options: Array<{ value: string; label: string; detail?: string }>;
    })
  | (BaseInterviewStep & {
      type: "text";
      placeholder: string;
    })
  | (BaseInterviewStep & {
      type: "scale";
      min: number;
      max: number;
      minLabel: string;
      maxLabel: string;
    })
  | (BaseInterviewStep & {
      type: "complete";
      summary: string;
    });

export type InterviewInvite = {
  id: string;
  studyTitle: string;
  researchGoal: string;
  learningObjectives: string[];
  respondentLabel: string;
  estimatedMinutes: number;
  sponsor: string;
};

const invites: Record<string, InterviewInvite> = {
  demo: {
    id: "demo",
    studyTitle: "AI research workflow discovery",
    researchGoal:
      "Understand how product and research teams currently collect customer evidence, where their interview workflow breaks down, and what would make an AI interviewer trustworthy enough to use.",
    learningObjectives: [
      "Identify the respondent's role in research decisions.",
      "Learn what decision or workflow they most recently needed customer evidence for.",
      "Understand pain points across planning, recruiting, interviewing, and synthesis.",
      "Measure willingness to use AI-generated interview questions and structured responses.",
      "Capture openness to follow-up or deeper qualitative research.",
    ],
    respondentLabel: "Product and research leaders",
    estimatedMinutes: 7,
    sponsor: "Hermes Researcher",
  },
};

export function getInterviewInvite(inviteId: string): InterviewInvite {
  return (
    invites[inviteId] ?? {
      id: inviteId,
      studyTitle: "Customer discovery interview",
      researchGoal:
        "Collect structured customer discovery signal from an invited participant.",
      learningObjectives: [
        "Understand the participant's context.",
        "Identify their most important needs and constraints.",
        "Capture a clear next research direction.",
      ],
      respondentLabel: "Invited participant",
      estimatedMinutes: 8,
      sponsor: "Hermes Researcher",
    }
  );
}

export function getNextInterviewStep(answers: InterviewAnswer[]): InterviewStep {
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
    const placeholder =
      role === "research"
        ? "Tell us what usually slows down study design, recruitment, interviewing, or synthesis."
        : "Tell us about the decision you recently needed customer evidence for.";

    return {
      id: "context",
      type: "text",
      prompt: "What situation should we understand before asking more specific questions?",
      helper: "One or two sentences is enough. The live agent will probe based on your answer.",
      placeholder,
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
    const summary =
      selected.includes("recruiting")
        ? "If recruitment became reliable, how much would that change your willingness to run more studies?"
        : selected.includes("synthesis")
          ? "If every finding linked back to source evidence automatically, how valuable would that be?"
          : selected.includes("interviews")
            ? "If an adaptive interviewer handled neutral probing consistently, how valuable would that be?"
            : "If Hermes helped turn fuzzy stakeholder questions into a clear research plan, how valuable would that be?";

    return {
      id: "priority",
      type: "scale",
      prompt: summary,
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
      "In the real integration, this will save the transcript, structured answers, consent state, and completion status back to the study workspace.",
  };
}

export function getAnswerLabel(step: InterviewStep, value: string | string[]): string {
  if (step.type === "text") return String(value);
  if (step.type === "scale") return `${value} / ${step.max}`;
  if (step.type === "single_select") {
    return step.options.find((option) => option.value === value)?.label ?? String(value);
  }
  if (step.type === "multi_select") {
    const selected = Array.isArray(value) ? value : [String(value)];
    return selected
      .map((item) => step.options.find((option) => option.value === item)?.label ?? item)
      .join(", ");
  }
  return "";
}
