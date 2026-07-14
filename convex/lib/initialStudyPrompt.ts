type InitialStudyPromptContext = {
  title: string;
  businessDecision: string;
};

export function buildInitialStudyPrompt(context: InitialStudyPromptContext): string {
  return [
    "Begin the strategy discussion for this newly created study.",
    `Study title: ${context.title}`,
    `Business decision: ${context.businessDecision}`,
    "Briefly acknowledge the decision the team needs to make, then ask up to three high-value questions needed to shape the study plan.",
  ].join("\n");
}
