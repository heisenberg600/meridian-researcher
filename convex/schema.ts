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
      v.literal("fieldwork_ready"),
      v.literal("fieldwork_running"),
      v.literal("analyzing"),
      v.literal("completed"),
    ),
    currentStudyPlanVersionId: v.optional(v.id("studyPlanVersions")),
    currentInterviewBriefVersionId: v.optional(v.id("interviewBriefVersions")),
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
    importance: v.number(),
    confidence: v.number(),
    source: v.union(v.literal("user"), v.literal("agent"), v.literal("import")),
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

  interviewSessions: defineTable({
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
  }).index("by_invite_session", ["inviteId", "sessionKey"]),

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
    createdAt: v.number(),
  })
    .index("by_study", ["studyId"])
    .index("by_run", ["agentRunId"]),

  auditEvents: defineTable({
    organizationId: v.id("organizations"),
    studyId: v.optional(v.id("studies")),
    actorUserId: v.optional(v.id("users")),
    actorType: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),
    eventType: v.string(),
    summary: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_study", ["studyId"]),
});
