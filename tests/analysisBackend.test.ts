import assert from "node:assert/strict";
import test from "node:test";

import {
  analysisMaximumCredits,
  normalizeProviderUsage,
  snapshotKindForStudyStatus,
} from "../convex/analysisActions";
import {
  normalizeTranscriptSpans,
  normalizeTypedAnswers,
} from "../convex/evidence";
import {
  validateAnalysisResponse,
  validateFindingDrafts,
} from "../convex/findings";
import schema from "../convex/schema";

test("typed answers normalize into stable response evidence without losing response shape", () => {
  const evidence = normalizeTypedAnswers({
    interviewSessionId: "session-1",
    organizationId: "organization-1",
    studyId: "study-1",
    participantId: "participant-1",
    questionnaireVersionId: "questionnaire-2",
    segment: "Operators",
    answers: [
      { stepId: "q-priority", label: "What matters most?", value: ["Speed", "Auditability"] },
      { stepId: "q-risk", label: "What would stop adoption?", value: "Unclear ownership" },
    ],
  });

  assert.deepEqual(evidence, [
    {
      sourceKey: "form:session-1:q-priority",
      organizationId: "organization-1",
      studyId: "study-1",
      participantId: "participant-1",
      questionnaireVersionId: "questionnaire-2",
      channel: "form",
      interviewSessionId: "session-1",
      questionId: "q-priority",
      questionLabel: "What matters most?",
      excerpt: "Speed · Auditability",
      responseValue: ["Speed", "Auditability"],
      answerLocator: "Answer to “What matters most?”",
      segment: "Operators",
    },
    {
      sourceKey: "form:session-1:q-risk",
      organizationId: "organization-1",
      studyId: "study-1",
      participantId: "participant-1",
      questionnaireVersionId: "questionnaire-2",
      channel: "form",
      interviewSessionId: "session-1",
      questionId: "q-risk",
      questionLabel: "What would stop adoption?",
      excerpt: "Unclear ownership",
      responseValue: "Unclear ownership",
      answerLocator: "Answer to “What would stop adoption?”",
      segment: "Operators",
    },
  ]);
});

test("voice transcript normalization keeps exact participant spans and preceding question", () => {
  const evidence = normalizeTranscriptSpans({
    callRecordId: "call-1",
    organizationId: "organization-1",
    studyId: "study-1",
    participantId: "participant-1",
    questionnaireVersionId: "questionnaire-2",
    segment: "Admins",
    durationSeconds: 48,
    transcript: [
      { role: "agent", message: "How do you reconcile invoices today?", timeInCallSeconds: 10 },
      { role: "user", message: "We export everything into a shared workbook.", timeInCallSeconds: 16 },
      { role: "agent", message: "Where does that break?", timeInCallSeconds: 29 },
      { role: "participant", message: "Ownership gets fuzzy at month end.", timeInCallSeconds: 34 },
    ],
  });

  assert.deepEqual(evidence.map((item) => ({
    sourceKey: item.sourceKey,
    questionLabel: item.questionLabel,
    excerpt: item.excerpt,
    timestampSeconds: item.timestampSeconds,
    endTimestampSeconds: item.endTimestampSeconds,
    answerLocator: item.answerLocator,
  })), [
    {
      sourceKey: "voice:call-1:1",
      questionLabel: "How do you reconcile invoices today?",
      excerpt: "We export everything into a shared workbook.",
      timestampSeconds: 16,
      endTimestampSeconds: 29,
      answerLocator: "00:16–00:29",
    },
    {
      sourceKey: "voice:call-1:3",
      questionLabel: "Where does that break?",
      excerpt: "Ownership gets fuzzy at month end.",
      timestampSeconds: 34,
      endTimestampSeconds: 48,
      answerLocator: "00:34–00:48",
    },
  ]);
});

test("every finding requires supporting evidence from the frozen response snapshot", () => {
  assert.throws(
    () => validateFindingDrafts([
      {
        viewType: "theme",
        title: "Auditability matters",
        narrative: "Teams need a visible decision trail.",
        strength: "supported",
        supportingEvidenceIds: [],
        conflictingEvidenceIds: [],
      },
    ], new Set(["evidence-1"])),
    /at least one supporting evidence ID/i,
  );

  assert.throws(
    () => validateFindingDrafts([
      {
        viewType: "theme",
        title: "Auditability matters",
        narrative: "Teams need a visible decision trail.",
        strength: "supported",
        supportingEvidenceIds: ["missing-evidence"],
        conflictingEvidenceIds: [],
      },
    ], new Set(["evidence-1"])),
    /outside the response snapshot/i,
  );
});

test("analysis response exposes question, segment, theme, contradiction, and limitation views from one snapshot", () => {
  const response = validateAnalysisResponse({
    summary: "Operators value auditability, but ownership remains unresolved.",
    findings: [
      finding("question", "Question signal"),
      finding("segment", "Operator signal"),
      finding("theme", "Audit trail"),
      { ...finding("contradiction", "Speed versus governance"), conflictingEvidenceIds: ["evidence-2"] },
      finding("limitation", "Early sample"),
    ],
  }, new Set(["evidence-1", "evidence-2"]));

  assert.deepEqual(new Set(response.findings.map((finding) => finding.viewType)), new Set([
    "question",
    "segment",
    "theme",
    "contradiction",
    "limitation",
  ]));
});

test("analysis snapshots are provisional only while fieldwork is running", () => {
  assert.equal(snapshotKindForStudyStatus("fieldwork_running"), "provisional");
  assert.equal(snapshotKindForStudyStatus("analyzing"), "final");
  assert.equal(snapshotKindForStudyStatus("report_ready"), "final");
});

test("analysis credit settlement uses exact provider token usage", () => {
  const usage = normalizeProviderUsage({
    prompt_tokens: 801,
    completion_tokens: 400,
    total_tokens: 1201,
  });

  assert.deepEqual(usage, { inputTokens: 801, outputTokens: 400, totalTokens: 1201 });
  assert.equal(analysisMaximumCredits(1201), 10);
  assert.throws(
    () => normalizeProviderUsage({ prompt_tokens: 801, completion_tokens: 400 }),
    /exact total_tokens/i,
  );
});

test("analysis persistence records immutable snapshots, source locators, and reconciled usage", () => {
  const evidenceFields = tableFields("responseEvidence");
  for (const field of ["sourceKey", "questionLabel", "responseValue", "endTimestampSeconds"]) {
    assert.ok(evidenceFields.has(field), `responseEvidence must persist ${field}`);
  }
  const runFields = tableFields("analysisRuns");
  for (const field of [
    "snapshotKind",
    "reservationId",
    "model",
    "providerOperationId",
    "inputTokens",
    "outputTokens",
    "totalTokens",
    "finalizedCredits",
  ]) {
    assert.ok(runFields.has(field), `analysisRuns must persist ${field}`);
  }
  const findingFields = tableFields("findings");
  for (const field of ["viewType", "questionId"]) {
    assert.ok(findingFields.has(field), `findings must persist ${field}`);
  }
});

function finding(viewType: "question" | "segment" | "theme" | "contradiction" | "limitation", title: string) {
  return {
    viewType,
    title,
    narrative: `${title} narrative`,
    strength: "emerging" as const,
    supportingEvidenceIds: ["evidence-1"],
    conflictingEvidenceIds: [],
  };
}

type TableContract = { validator: { json: { value: Record<string, unknown> } } };

function tableFields(tableName: string) {
  const table = (schema.tables as Record<string, unknown>)[tableName] as TableContract;
  return new Set(Object.keys(table.validator.json.value));
}
