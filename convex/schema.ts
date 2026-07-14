import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    authTokenIdentifier: v.string(),
    clerkUserId: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    defaultOrganizationId: v.optional(v.id("organizations")),
    lastSeenAt: v.number(),
  })
    .index("by_auth_token_identifier", ["authTokenIdentifier"])
    .index("by_clerk_user_id", ["clerkUserId"]),

  organizations: defineTable({
    name: v.string(),
    clerkOrganizationId: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_organization_id", ["clerkOrganizationId"]),

  waitlistSignups: defineTable({
    name: v.string(),
    email: v.string(),
    company: v.string(),
    role: v.string(),
    researchDecision: v.string(),
    targetAudience: v.optional(v.string()),
    timeline: v.union(
      v.literal("now"),
      v.literal("quarter"),
      v.literal("exploring"),
    ),
    source: v.string(),
    referrer: v.optional(v.string()),
    utmSource: v.optional(v.string()),
    utmCampaign: v.optional(v.string()),
    status: v.union(
      v.literal("new"),
      v.literal("contacted"),
      v.literal("pilot_qualified"),
      v.literal("pilot_started"),
      v.literal("closed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"]),

  memberships: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_user", ["organizationId", "userId"]),

  studies: defineTable({
    organizationId: v.id("organizations"),
    ownerId: v.id("users"),
    title: v.string(),
    businessDecision: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("awaiting_plan_approval"),
      v.literal("plan_approved"),
      v.literal("questionnaire_approved"),
      v.literal("participants_under_review"),
      v.literal("fieldwork_ready"),
      v.literal("fieldwork_running"),
      v.literal("analyzing"),
      v.literal("report_ready"),
      v.literal("completed"),
    ),
    currentStudyPlanVersionId: v.optional(v.id("studyPlanVersions")),
    currentInterviewBriefVersionId: v.optional(v.id("interviewBriefVersions")),
    currentApprovedParticipantBatchId: v.optional(v.id("participantImportBatches")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_status", ["organizationId", "status"]),

  chatSessions: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    title: v.string(),
    purpose: v.union(
      v.literal("general"),
      v.literal("strategy"),
      v.literal("study_design"),
      v.literal("fieldwork"),
      v.literal("analysis"),
      v.literal("report"),
    ),
    status: v.union(v.literal("active"), v.literal("archived")),
    activeSkillNames: v.optional(v.array(v.string())),
    activeAgentRunId: v.optional(v.id("agentRuns")),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_organization", ["organizationId"]),

  messages: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.optional(v.string()),
    parts: v.array(v.any()),
    status: v.union(
      v.literal("complete"),
      v.literal("streaming"),
      v.literal("error"),
    ),
    metadata: v.optional(v.string()),
    usage: v.optional(
      v.object({
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
      }),
    ),
    order: v.number(),
    agentRunId: v.optional(v.id("agentRuns")),
    createdAt: v.number(),
  })
    .index("by_chat", ["chatSessionId"])
    .index("by_chat_order", ["chatSessionId", "order"])
    .index("by_study", ["studyId"])
    .index("by_run", ["agentRunId"]),

  agentRuns: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    activeSkillNames: v.array(v.string()),
    model: v.optional(v.string()),
    laminarTraceId: v.optional(v.string()),
    startedBy: v.id("users"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    totalCostUsd: v.optional(v.number()),
  })
    .index("by_chat", ["chatSessionId"])
    .index("by_study", ["studyId"])
    .index("by_status", ["status"]),

  agentToolEvents: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    agentRunId: v.id("agentRuns"),
    toolName: v.string(),
    status: v.union(v.literal("started"), v.literal("completed"), v.literal("failed")),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_run", ["agentRunId"])
    .index("by_chat", ["chatSessionId"]),

  organizationMemories: defineTable({
    organizationId: v.id("organizations"),
    key: v.string(),
    value: v.string(),
    category: v.union(
      v.literal("company"),
      v.literal("product"),
      v.literal("customer"),
      v.literal("research"),
      v.literal("preference"),
      v.literal("constraint"),
      v.literal("other"),
    ),
    status: v.union(v.literal("active"), v.literal("archived")),
    importance: v.optional(v.number()),
    confidence: v.optional(v.number()),
    source: v.optional(v.union(v.literal("user"), v.literal("agent"), v.literal("import"))),
    sourceMessageId: v.optional(v.id("messages")),
    createdByAgentRunId: v.optional(v.id("agentRuns")),
    updatedByAgentRunId: v.optional(v.id("agentRuns")),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_and_status", ["organizationId", "status"])
    .index("by_organization_and_key", ["organizationId", "key"]),

  knowledgeSources: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.optional(v.id("studies")),
    kind: v.union(
      v.literal("website"),
      v.literal("document"),
      v.literal("spreadsheet"),
      v.literal("audio"),
      v.literal("video"),
      v.literal("public_media"),
    ),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    filename: v.optional(v.string()),
    contentType: v.optional(v.string()),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    extractedSummary: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_study", ["studyId"])
    .index("by_organization_status", ["organizationId", "status"]),

  studyMemories: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    key: v.string(),
    value: v.string(),
    category: v.union(
      v.literal("decision"),
      v.literal("audience"),
      v.literal("hypothesis"),
      v.literal("constraint"),
      v.literal("preference"),
      v.literal("other"),
    ),
    status: v.union(v.literal("active"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_study_status", ["studyId", "status"])
    .index("by_study_key", ["studyId", "key"]),

  brandProfiles: defineTable({
    organizationId: v.id("organizations"),
    displayName: v.string(),
    logoStorageId: v.optional(v.id("_storage")),
    logoName: v.optional(v.string()),
    primaryColor: v.string(),
    accentColor: v.string(),
    tone: v.optional(v.string()),
    reportTitle: v.optional(v.string()),
    reportFooter: v.optional(v.string()),
    headingFont: v.optional(v.union(v.literal("serif"), v.literal("sans"))),
    bodyFont: v.optional(v.union(v.literal("serif"), v.literal("sans"))),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  studyPlanVersions: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    version: v.number(),
    markdown: v.string(),
    status: v.union(v.literal("draft"), v.literal("awaiting_approval"), v.literal("approved"), v.literal("superseded")),
    createdByAgentRunId: v.optional(v.id("agentRuns")),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_study", ["studyId"]),

  interviewBriefVersions: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    studyPlanVersionId: v.id("studyPlanVersions"),
    version: v.number(),
    brief: v.object({
      title: v.string(),
      researchObjective: v.string(),
      respondentProfile: v.string(),
      estimatedMinutes: v.number(),
      openingScript: v.string(),
      topics: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          objective: v.string(),
          questions: v.array(v.string()),
          probes: v.array(v.string()),
        }),
      ),
      closingScript: v.string(),
      guardrails: v.array(v.string()),
    }),
    status: v.union(v.literal("draft"), v.literal("awaiting_approval"), v.literal("approved"), v.literal("superseded")),
    createdByAgentRunId: v.optional(v.id("agentRuns")),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_study", ["studyId"]),

  studyParticipants: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    segment: v.optional(v.string()),
    preferredMode: v.union(v.literal("form"), v.literal("voice"), v.literal("either")),
    consentStatus: v.union(
      v.literal("unknown"),
      v.literal("pending"),
      v.literal("granted"),
      v.literal("declined"),
    ),
    consentGrantedAt: v.optional(v.number()),
    importBatchId: v.optional(v.id("participantImportBatches")),
    status: v.union(
      v.literal("draft"),
      v.literal("invited"),
      v.literal("opened"),
      v.literal("started"),
      v.literal("completed"),
      v.literal("declined"),
      v.literal("archived"),
    ),
    notes: v.optional(v.string()),
    inviteToken: v.optional(v.string()),
    invitedAt: v.optional(v.number()),
    lastInviteEmailId: v.optional(v.string()),
    emailOutreachStatus: v.optional(
      v.union(v.literal("sent"), v.literal("failed")),
    ),
    emailOutreachError: v.optional(v.string()),
    callOutreachStatus: v.optional(
      v.union(v.literal("initiated"), v.literal("failed")),
    ),
    callOutreachError: v.optional(v.string()),
    elevenLabsConversationId: v.optional(v.string()),
    telephonyCallSid: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_study_status", ["studyId", "status"])
    .index("by_invite_token", ["inviteToken"]),

  participantImportBatches: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    filename: v.string(),
    storageId: v.optional(v.id("_storage")),
    mapping: v.any(),
    totalRows: v.number(),
    validRows: v.number(),
    invalidRows: v.number(),
    duplicateRows: v.number(),
    suppressedRows: v.number(),
    status: v.union(
      v.literal("uploaded"),
      v.literal("mapping"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("rejected"),
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_study_status", ["studyId", "status"]),

  participantImportRows: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    batchId: v.id("participantImportBatches"),
    rowNumber: v.number(),
    raw: v.any(),
    normalized: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      segment: v.optional(v.string()),
      preferredMode: v.optional(
        v.union(v.literal("form"), v.literal("voice"), v.literal("either")),
      ),
    }),
    issues: v.array(v.string()),
    duplicate: v.boolean(),
    suppressed: v.boolean(),
    disposition: v.union(
      v.literal("ready"),
      v.literal("needs_review"),
      v.literal("excluded"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batch", ["batchId"])
    .index("by_batch_disposition", ["batchId", "disposition"]),

  suppressionEntries: defineTable({
    organizationId: v.id("organizations"),
    normalizedEmail: v.optional(v.string()),
    normalizedPhone: v.optional(v.string()),
    reason: v.string(),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_email", ["organizationId", "normalizedEmail"])
    .index("by_organization_phone", ["organizationId", "normalizedPhone"]),

  outreachBatches: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    questionnaireVersionId: v.id("interviewBriefVersions"),
    participantBatchId: v.id("participantImportBatches"),
    participantIds: v.array(v.id("studyParticipants")),
    channels: v.array(v.union(v.literal("email"), v.literal("voice"))),
    status: v.union(
      v.literal("draft"),
      v.literal("awaiting_approval"),
      v.literal("approved"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    approvedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    launchedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_study_status", ["studyId", "status"]),

  interviewSessions: defineTable({
    organizationId: v.optional(v.id("organizations")),
    studyId: v.optional(v.id("studies")),
    participantId: v.optional(v.id("studyParticipants")),
    questionnaireVersionId: v.optional(v.id("interviewBriefVersions")),
    inviteId: v.string(),
    sessionKey: v.string(),
    studyTitle: v.string(),
    respondentLabel: v.string(),
    mode: v.optional(v.union(v.literal("chat"), v.literal("voice"))),
    answers: v.array(
      v.object({
        stepId: v.string(),
        label: v.string(),
        value: v.union(v.string(), v.array(v.string())),
      }),
    ),
    status: v.union(v.literal("started"), v.literal("completed")),
    startedAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_invite_session", ["inviteId", "sessionKey"])
    .index("by_study", ["studyId"]),

  interviewCallRecords: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    participantId: v.id("studyParticipants"),
    studyPlanVersionId: v.optional(v.id("studyPlanVersions")),
    questionnaireVersionId: v.optional(v.id("interviewBriefVersions")),
    conversationId: v.string(),
    callSid: v.optional(v.string()),
    status: v.union(
      v.literal("scheduled"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    transcript: v.optional(
      v.array(
        v.object({
          role: v.string(),
          message: v.string(),
          timeInCallSeconds: v.optional(v.number()),
        }),
      ),
    ),
    analysis: v.optional(
      v.object({
        summary: v.string(),
        themes: v.array(v.string()),
        notableQuotes: v.array(v.string()),
        completionAssessment: v.string(),
      }),
    ),
    qualityScores: v.optional(
      v.object({
        overall: v.number(),
        goalCoverage: v.number(),
        responseDepth: v.number(),
        specificity: v.number(),
        engagement: v.number(),
        interviewerQuality: v.number(),
      }),
    ),
    extractedMetrics: v.optional(
      v.object({
        sentiment: v.union(
          v.literal("positive"),
          v.literal("neutral"),
          v.literal("negative"),
          v.literal("mixed"),
        ),
        substantiveAnswerCount: v.number(),
        participantWordCount: v.number(),
        needs: v.array(v.string()),
        painPoints: v.array(v.string()),
        objections: v.array(v.string()),
        opportunities: v.array(v.string()),
      }),
    ),
    durationSeconds: v.optional(v.number()),
    terminationReason: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_study", ["studyId"])
    .index("by_participant", ["participantId"])
    .index("by_conversation", ["conversationId"]),

  responseEvidence: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    participantId: v.id("studyParticipants"),
    questionnaireVersionId: v.id("interviewBriefVersions"),
    sourceKey: v.optional(v.string()),
    channel: v.union(v.literal("form"), v.literal("voice")),
    interviewSessionId: v.optional(v.id("interviewSessions")),
    callRecordId: v.optional(v.id("interviewCallRecords")),
    questionId: v.optional(v.string()),
    questionLabel: v.optional(v.string()),
    topicId: v.optional(v.string()),
    excerpt: v.string(),
    responseValue: v.optional(v.union(v.string(), v.array(v.string()))),
    answerLocator: v.optional(v.string()),
    timestampSeconds: v.optional(v.number()),
    endTimestampSeconds: v.optional(v.number()),
    segment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_participant", ["participantId"])
    .index("by_source_key", ["sourceKey"]),

  analysisRuns: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    evidenceIds: v.array(v.id("responseEvidence")),
    snapshotKind: v.optional(v.union(v.literal("provisional"), v.literal("final"))),
    reservationId: v.optional(v.id("creditReservations")),
    model: v.optional(v.string()),
    provider: v.optional(v.string()),
    providerOperationId: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    totalTokens: v.optional(v.number()),
    finalizedCredits: v.optional(v.number()),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    summary: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_study", ["studyId"])
    .index("by_study_status", ["studyId", "status"]),

  findings: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    analysisRunId: v.id("analysisRuns"),
    viewType: v.optional(v.union(
      v.literal("question"),
      v.literal("segment"),
      v.literal("theme"),
      v.literal("contradiction"),
      v.literal("limitation"),
    )),
    title: v.string(),
    narrative: v.string(),
    findingType: v.union(
      v.literal("theme"),
      v.literal("opportunity"),
      v.literal("risk"),
      v.literal("recommendation"),
    ),
    strength: v.union(v.literal("emerging"), v.literal("supported"), v.literal("strong")),
    supportingEvidenceIds: v.array(v.id("responseEvidence")),
    conflictingEvidenceIds: v.array(v.id("responseEvidence")),
    questionId: v.optional(v.string()),
    segment: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_analysis", ["analysisRunId"]),

  reportVersions: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    analysisRunId: v.id("analysisRuns"),
    version: v.number(),
    brandSnapshot: v.any(),
    sections: v.array(v.any()),
    status: v.union(
      v.literal("draft"),
      v.literal("generating"),
      v.literal("ready"),
      v.literal("published"),
      v.literal("failed"),
    ),
    pdfStorageId: v.optional(v.id("_storage")),
    pptxStorageId: v.optional(v.id("_storage")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_study_version", ["studyId", "version"]),

  approvals: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    subjectType: v.union(
      v.literal("study_plan"),
      v.literal("interview_brief"),
      v.literal("outreach_campaign"),
      v.literal("material_change"),
    ),
    subjectId: v.string(),
    decision: v.union(v.literal("approved"), v.literal("rejected"), v.literal("changes_requested")),
    note: v.optional(v.string()),
    decidedBy: v.id("users"),
    decidedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_subject", ["subjectType", "subjectId"]),

  agentSkills: defineTable({
    organizationId: v.optional(v.id("organizations")),
    name: v.string(),
    description: v.string(),
    content: v.string(),
    scope: v.union(v.literal("global"), v.literal("organization"), v.literal("user")),
    ownerUserId: v.optional(v.id("users")),
    version: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_organization", ["organizationId"]),

  studySkillActivations: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    agentRunId: v.optional(v.id("agentRuns")),
    skillId: v.id("agentSkills"),
    skillName: v.string(),
    skillVersion: v.number(),
    activatedAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_run", ["agentRunId"]),

  workspaceSnapshots: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.id("chatSessions"),
    storageId: v.id("_storage"),
    compressedSizeBytes: v.number(),
    createdAt: v.number(),
  }).index("by_chat", ["chatSessionId"]),

  artifacts: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.id("studies"),
    chatSessionId: v.optional(v.id("chatSessions")),
    agentRunId: v.optional(v.id("agentRuns")),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    artifactType: v.union(
      v.literal("pdf"),
      v.literal("docx"),
      v.literal("xlsx"),
      v.literal("csv"),
      v.literal("html"),
      v.literal("image"),
      v.literal("other"),
    ),
    title: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_run", ["agentRunId"]),

  billingAccounts: defineTable({
    organizationId: v.id("organizations"),
    dodoCustomerId: v.optional(v.string()),
    mode: v.union(v.literal("test"), v.literal("live")),
    status: v.union(v.literal("active"), v.literal("suspended")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  creditWallets: defineTable({
    organizationId: v.id("organizations"),
    granted: v.number(),
    available: v.number(),
    reserved: v.number(),
    consumed: v.number(),
    updatedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  creditTransactions: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.optional(v.id("studies")),
    operationId: v.optional(v.string()),
    operation: v.optional(v.string()),
    type: v.union(
      v.literal("grant"),
      v.literal("reserve"),
      v.literal("debit"),
      v.literal("release"),
      v.literal("refund"),
      v.literal("adjustment"),
    ),
    amount: v.number(),
    balanceAfter: v.number(),
    idempotencyKey: v.string(),
    rateCardVersion: v.optional(v.string()),
    reservationId: v.optional(v.id("creditReservations")),
    reason: v.optional(v.string()),
    providerPaymentId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_reservation", ["reservationId"])
    .index("by_provider_payment", ["providerPaymentId"]),

  creditReservations: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.optional(v.id("studies")),
    operationId: v.string(),
    operation: v.string(),
    maximumCredits: v.number(),
    finalDebit: v.optional(v.number()),
    measuredCredits: v.optional(v.number()),
    shortfallCredits: v.optional(v.number()),
    status: v.union(
      v.literal("reserved"),
      v.literal("finalized"),
      v.literal("released"),
      v.literal("expired"),
    ),
    idempotencyKey: v.string(),
    finalizationIdempotencyKey: v.optional(v.string()),
    releaseIdempotencyKey: v.optional(v.string()),
    rateCardVersion: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_operation", ["operationId"])
    .index("by_idempotency_key", ["idempotencyKey"]),

  checkoutSessions: defineTable({
    organizationId: v.id("organizations"),
    checkoutIntentId: v.string(),
    idempotencyKey: v.string(),
    dodoSessionId: v.optional(v.string()),
    dodoPaymentId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    productId: v.string(),
    mode: v.union(v.literal("test"), v.literal("live")),
    packKey: v.string(),
    expectedGrant: v.number(),
    status: v.union(
      v.literal("creating"),
      v.literal("created"),
      v.literal("paid"),
      v.literal("expired"),
      v.literal("failed"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_organization_idempotency", ["organizationId", "idempotencyKey"])
    .index("by_checkout_intent", ["checkoutIntentId"])
    .index("by_dodo_session", ["dodoSessionId"])
    .index("by_dodo_payment", ["dodoPaymentId"]),

  paymentWebhookEvents: defineTable({
    dodoEventId: v.string(),
    eventType: v.string(),
    payloadHash: v.string(),
    organizationId: v.optional(v.id("organizations")),
    paymentId: v.optional(v.string()),
    checkoutSessionId: v.optional(v.string()),
    status: v.union(v.literal("received"), v.literal("processed"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_dodo_event", ["dodoEventId"])
    .index("by_payment", ["paymentId"]),

  rateCards: defineTable({
    version: v.string(),
    operation: v.string(),
    nativeUnit: v.string(),
    creditsPerUnit: v.optional(v.number()),
    nativeUnitsPerBlock: v.number(),
    creditsPerBlock: v.number(),
    activeAt: v.number(),
    retiredAt: v.optional(v.number()),
  })
    .index("by_version", ["version"])
    .index("by_operation_active", ["operation", "activeAt"]),

  usageLedger: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.optional(v.id("studies")),
    agentRunId: v.optional(v.id("agentRuns")),
    operation: v.string(),
    model: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    costUsd: v.optional(v.number()),
    provider: v.optional(v.string()),
    providerOperationId: v.optional(v.string()),
    nativeQuantity: v.optional(v.number()),
    nativeUnit: v.optional(v.string()),
    internalCostMicros: v.optional(v.number()),
    billedCredits: v.optional(v.number()),
    creditTransactionId: v.optional(v.id("creditTransactions")),
    rateCardVersion: v.optional(v.string()),
    finalized: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_run", ["agentRunId"]),

  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.optional(v.id("studies")),
    actorUserId: v.optional(v.id("users")),
    actorType: v.union(
      v.literal("user"),
      v.literal("agent"),
      v.literal("system"),
      v.literal("participant"),
    ),
    eventType: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_study", ["studyId"]),
});
