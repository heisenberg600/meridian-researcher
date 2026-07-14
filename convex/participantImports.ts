import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireStudyAccess } from "./lib/auth";
import { assertStudyCan, transitionStudy } from "./lib/workflow";

const preferredModeValidator = v.union(
  v.literal("form"),
  v.literal("voice"),
  v.literal("either"),
);

export const PARTICIPANT_FIELDS = [
  "name",
  "email",
  "phone",
  "segment",
  "preferredMode",
  "notes",
] as const;

export type ParticipantField = (typeof PARTICIPANT_FIELDS)[number];
export type ParticipantMapping = Partial<Record<ParticipantField, string[]>>;

export type MappingSuggestion = {
  field: ParticipantField;
  sourceColumns: string[];
  confidence: "high" | "ambiguous";
  source: "deterministic" | "assistant";
  reason: string;
};

export type MappingAssistant = {
  suggest(input: {
    headers: string[];
    sampleRows: Array<Record<string, string>>;
    context: { companyMemory: string[]; studyMemory: string[] };
  }): Promise<Array<{
    field: ParticipantField;
    sourceColumns: string[];
    reason: string;
  }>>;
};

const headerAliases: Record<ParticipantField, ReadonlySet<string>> = {
  name: new Set(["name", "full name", "participant", "participant name", "contact name"]),
  email: new Set(["email", "email address", "work email", "business email"]),
  phone: new Set(["phone", "phone number", "mobile", "mobile number", "telephone"]),
  segment: new Set(["segment", "cohort", "group", "audience segment"]),
  preferredMode: new Set([
    "preferred mode",
    "interview mode",
    "contact method",
    "preferred contact method",
  ]),
  notes: new Set(["notes", "research notes", "participant notes", "comments"]),
};

export async function inferMappingSuggestions(
  headers: string[],
  options: {
    sampleRows?: Array<Record<string, string>>;
    context?: { companyMemory: string[]; studyMemory: string[] };
    assistant?: MappingAssistant;
  } = {},
) {
  const mapping: ParticipantMapping = {};
  const suggestions: MappingSuggestion[] = [];
  const usedHeaders = new Set<string>();

  for (const field of PARTICIPANT_FIELDS) {
    const candidates = headers.filter((header) => headerAliases[field].has(normalizeHeader(header)));
    if (candidates.length === 1) {
      mapping[field] = candidates;
      usedHeaders.add(candidates[0]);
      suggestions.push({
        field,
        sourceColumns: candidates,
        confidence: "high",
        source: "deterministic",
        reason: `${candidates[0]} is a recognized ${field} header`,
      });
    } else if (candidates.length > 1) {
      suggestions.push({
        field,
        sourceColumns: candidates,
        confidence: "ambiguous",
        source: "deterministic",
        reason: `Multiple columns could contain ${field}`,
      });
    }
  }

  if (options.assistant) {
    const assistantSuggestions = await options.assistant.suggest({
      headers: [...headers],
      sampleRows: options.sampleRows ?? [],
      context: options.context ?? { companyMemory: [], studyMemory: [] },
    });
    for (const suggestion of assistantSuggestions) {
      if (
        !PARTICIPANT_FIELDS.includes(suggestion.field) ||
        mapping[suggestion.field] ||
        suggestion.sourceColumns.length === 0 ||
        suggestion.sourceColumns.some((column) => !headers.includes(column))
      ) {
        continue;
      }
      suggestions.push({
        ...suggestion,
        confidence: "ambiguous",
        source: "assistant",
      });
    }
  }

  return {
    mapping,
    suggestions,
    unmappedHeaders: headers.filter((header) => !usedHeaders.has(header)),
    requiresReview: suggestions.some((suggestion) => suggestion.confidence === "ambiguous") ||
      !mapping.name || (!mapping.email && !mapping.phone),
  };
}

export const inferMapping = query({
  args: {
    studyId: v.id("studies"),
    headers: v.array(v.string()),
    sampleRows: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args) => {
    await requireStudyAccess(ctx, args.studyId);
    if (args.headers.length === 0 || args.headers.length > 100) {
      throw new Error("Mapping requires between 1 and 100 columns");
    }
    if ((args.sampleRows?.length ?? 0) > 20) {
      throw new Error("Mapping samples are limited to 20 rows");
    }
    return inferMappingSuggestions(args.headers, {
      sampleRows: (args.sampleRows ?? []).map(assertRawRow),
    });
  },
});

function normalizeHeader(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type PreferredMode = "form" | "voice" | "either";

export type NormalizedParticipantRow = {
  name?: string;
  email?: string;
  phone?: string;
  segment?: string;
  preferredMode?: PreferredMode;
  notes?: string;
};

export type ReviewedParticipantRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: NormalizedParticipantRow;
  issues: string[];
  duplicate: boolean;
  suppressed: boolean;
  disposition: "ready" | "needs_review" | "excluded";
};

export type ContactMatchSet = { emails: string[]; phones: string[] };

export interface ContactPolicyAdapter {
  findExisting(contacts: ContactMatchSet): Promise<ContactMatchSet>;
  findSuppressed(contacts: ContactMatchSet): Promise<ContactMatchSet>;
}

export async function validateRows(args: {
  rows: Array<Record<string, string>>;
  mapping: ParticipantMapping;
  policy: ContactPolicyAdapter;
}): Promise<ReviewedParticipantRow[]> {
  const reviewed = args.rows.map((raw, index) => normalizeAndValidateRow(raw, args.mapping, index + 1));
  const validContacts = collectValidContacts(reviewed);
  const [existing, suppressed] = await Promise.all([
    args.policy.findExisting(validContacts),
    args.policy.findSuppressed(validContacts),
  ]);
  const emailCounts = contactCounts(reviewed.flatMap((row) =>
    row.normalized.email && isValidEmail(row.normalized.email) ? [row.normalized.email] : []
  ));
  const phoneCounts = contactCounts(reviewed.flatMap((row) =>
    row.normalized.phone && isValidPhone(row.normalized.phone) ? [row.normalized.phone] : []
  ));
  const existingEmails = new Set(existing.emails.map((email) => email.trim().toLowerCase()));
  const existingPhones = new Set(existing.phones.map(normalizePhone));
  const suppressedEmails = new Set(suppressed.emails.map((email) => email.trim().toLowerCase()));
  const suppressedPhones = new Set(suppressed.phones.map(normalizePhone));

  for (const row of reviewed) {
    const email = row.normalized.email;
    const phone = row.normalized.phone;
    const withinFileDuplicate = Boolean(
      (email && (emailCounts.get(email) ?? 0) > 1) ||
      (phone && (phoneCounts.get(phone) ?? 0) > 1),
    );
    const existingDuplicate = Boolean(
      (email && existingEmails.has(email)) || (phone && existingPhones.has(phone)),
    );
    row.duplicate = withinFileDuplicate || existingDuplicate;
    if (withinFileDuplicate) row.issues.push("Duplicate contact in this import");
    if (existingDuplicate) row.issues.push("Contact already exists in this study");
    row.suppressed = Boolean(
      (email && suppressedEmails.has(email)) || (phone && suppressedPhones.has(phone)),
    );
    if (row.suppressed) row.issues.push("Contact is suppressed for this workspace");
    row.disposition = row.suppressed
      ? "excluded"
      : row.issues.length > 0
        ? "needs_review"
        : "ready";
  }
  return reviewed;
}

function normalizeAndValidateRow(
  raw: Record<string, string>,
  mapping: ParticipantMapping,
  rowNumber: number,
): ReviewedParticipantRow {
  const normalized: NormalizedParticipantRow = {};
  const name = mappedValue(raw, mapping.name, " ");
  const email = mappedValue(raw, mapping.email).toLowerCase();
  const phone = normalizePhone(mappedValue(raw, mapping.phone));
  const segment = mappedValue(raw, mapping.segment, " ");
  const modeSource = mappedValue(raw, mapping.preferredMode);
  const notes = mappedValue(raw, mapping.notes, " ");

  if (name) normalized.name = name;
  if (email) normalized.email = email;
  if (phone) normalized.phone = phone;
  if (segment) normalized.segment = segment;
  if (notes) normalized.notes = notes;

  const validEmail = !email || isValidEmail(email);
  const validPhone = !phone || isValidPhone(phone);
  const mode = normalizePreferredMode(modeSource, validEmail && Boolean(email), validPhone && Boolean(phone));
  if (mode) normalized.preferredMode = mode;

  const issues: string[] = [];
  if (!name) issues.push("Participant name is required");
  if (email && !validEmail) issues.push("Email address is invalid");
  if (phone && !validPhone) issues.push("Phone number is invalid");
  if (modeSource && !mode) issues.push("Preferred mode is invalid");
  if (!(email && validEmail) && !(phone && validPhone)) {
    issues.push("Add a valid email address or phone number");
  }

  return {
    rowNumber,
    raw,
    normalized,
    issues,
    duplicate: false,
    suppressed: false,
    disposition: issues.length === 0 ? "ready" : "needs_review",
  };
}

function mappedValue(
  raw: Record<string, string>,
  columns: string[] | undefined,
  separator = "",
) {
  return (columns ?? [])
    .map((column) => raw[column] ?? "")
    .map(collapseWhitespace)
    .filter(Boolean)
    .join(separator)
    .trim();
}

function collapseWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePhone(value: string) {
  const collapsed = value.trim();
  if (!collapsed) return "";
  const digits = collapsed.replace(/\D/g, "");
  if (collapsed.startsWith("00")) return `+${digits.slice(2)}`;
  if (collapsed.startsWith("+")) return `+${digits}`;
  return digits;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function normalizePreferredMode(
  value: string,
  hasEmail: boolean,
  hasPhone: boolean,
): PreferredMode | undefined {
  if (!value) {
    if (hasEmail && hasPhone) return "either";
    if (hasEmail) return "form";
    if (hasPhone) return "voice";
    return undefined;
  }
  const normalized = value.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (["form", "email", "survey", "text", "written"].includes(normalized)) return "form";
  if (["voice", "phone", "call", "telephone"].includes(normalized)) return "voice";
  if (["either", "both", "any"].includes(normalized)) return "either";
  return undefined;
}

function collectValidContacts(rows: ReviewedParticipantRow[]): ContactMatchSet {
  return {
    emails: [...new Set(rows.flatMap((row) =>
      row.normalized.email && isValidEmail(row.normalized.email) ? [row.normalized.email] : []
    ))],
    phones: [...new Set(rows.flatMap((row) =>
      row.normalized.phone && isValidPhone(row.normalized.phone) ? [row.normalized.phone] : []
    ))],
  };
}

function contactCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export const createImport = mutation({
  args: {
    studyId: v.id("studies"),
    filename: v.string(),
    mapping: v.any(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const { study, user } = await requireStudyAccess(ctx, args.studyId);
    assertStudyCan(study.status, "review_participants");
    const filename = args.filename.trim();
    if (!filename) throw new Error("Import filename is required");
    if (args.rows.length === 0) throw new Error("Import at least one participant row");
    if (args.rows.length > 5_000) throw new Error("Participant imports are limited to 5,000 rows");
    const mapping = assertMapping(args.mapping);
    const rawRows = args.rows.map(assertRawRow);
    const participants = await ctx.db
      .query("studyParticipants")
      .withIndex("by_study", (query) => query.eq("studyId", study._id))
      .collect();
    const suppressions = await ctx.db
      .query("suppressionEntries")
      .withIndex("by_organization", (query) => query.eq("organizationId", study.organizationId))
      .collect();
    const reviewed = await validateRows({
      rows: rawRows,
      mapping,
      policy: makeContactPolicy(participants, suppressions),
    });
    const counts = summarizeRows(reviewed);
    const now = Date.now();
    const batchId = await ctx.db.insert("participantImportBatches", {
      organizationId: study.organizationId,
      studyId: study._id,
      filename,
      mapping,
      ...counts,
      status: "under_review",
      createdAt: now,
      updatedAt: now,
    });
    for (const row of reviewed) {
      await ctx.db.insert("participantImportRows", {
        organizationId: study.organizationId,
        studyId: study._id,
        batchId,
        rowNumber: row.rowNumber,
        raw: row.raw,
        normalized: persistedNormalized(row.normalized),
        issues: row.issues,
        duplicate: row.duplicate,
        suppressed: row.suppressed,
        disposition: row.disposition,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (study.status === "questionnaire_approved") {
      await transitionStudy(ctx, study._id, "participants_under_review");
    }
    await ctx.db.insert("auditEvents", {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      actorType: "user",
      eventType: "participant_import.created",
      summary: `${counts.totalRows} participant rows uploaded for review`,
      metadata: { batchId, filename, ...counts },
      createdAt: now,
    });
    return { batchId, counts };
  },
});

export const updateRow = mutation({
  args: {
    rowId: v.id("participantImportRows"),
    normalized: v.object({
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      segment: v.optional(v.string()),
      preferredMode: v.optional(preferredModeValidator),
    }),
    exclude: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.rowId);
    if (!target) throw new Error("Participant import row not found");
    const { study, user } = await requireStudyAccess(ctx, target.studyId);
    assertStudyCan(study.status, "review_participants");
    const batch = await ctx.db.get(target.batchId);
    if (!batch || batch.studyId !== study._id) throw new Error("Participant import batch not found");
    if (batch.status !== "under_review") throw new Error("Only imports under review can be edited");
    const storedRows = await ctx.db
      .query("participantImportRows")
      .withIndex("by_batch", (query) => query.eq("batchId", batch._id))
      .collect();
    const participants = await ctx.db
      .query("studyParticipants")
      .withIndex("by_study", (query) => query.eq("studyId", study._id))
      .collect();
    const suppressions = await ctx.db
      .query("suppressionEntries")
      .withIndex("by_organization", (query) => query.eq("organizationId", study.organizationId))
      .collect();
    const excludedIds = new Set(
      storedRows.filter((row) => row.disposition === "excluded").map((row) => row._id),
    );
    if (args.exclude === true) excludedIds.add(target._id);
    if (args.exclude === false) excludedIds.delete(target._id);
    const effectiveNormalized = storedRows.map((row) =>
      row._id === target._id ? args.normalized : row.normalized
    );
    const activeIndexes = storedRows.flatMap((row, index) =>
      excludedIds.has(row._id) ? [] : [index]
    );
    const activeReviewed = await validateRows({
      rows: activeIndexes.map((index) => normalizedToCanonicalRaw(effectiveNormalized[index])),
      mapping: canonicalMapping,
      policy: makeContactPolicy(participants, suppressions),
    });
    let activeIndex = 0;
    const reviewed = storedRows.map((row, index) => {
      if (!excludedIds.has(row._id)) return activeReviewed[activeIndex++];
      const excluded = normalizeAndValidateRow(
        normalizedToCanonicalRaw(effectiveNormalized[index]),
        canonicalMapping,
        row.rowNumber,
      );
      excluded.disposition = "excluded";
      excluded.suppressed = row.suppressed;
      if (row.suppressed && !excluded.issues.includes("Contact is suppressed for this workspace")) {
        excluded.issues.push("Contact is suppressed for this workspace");
      }
      return excluded;
    });
    const targetIndex = storedRows.findIndex((row) => row._id === target._id);
    const now = Date.now();
    for (let index = 0; index < storedRows.length; index += 1) {
      const stored = storedRows[index];
      const row = reviewed[index];
      await ctx.db.patch(stored._id, {
        normalized: persistedNormalized(row.normalized),
        issues: row.issues,
        duplicate: row.duplicate,
        suppressed: row.suppressed,
        disposition: row.disposition,
        updatedAt: now,
      });
    }
    const counts = summarizeRows(reviewed);
    await ctx.db.patch(batch._id, { ...counts, updatedAt: now });
    await ctx.db.insert("auditEvents", {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      actorType: "user",
      eventType: "participant_import.row_updated",
      summary: `Participant import row ${target.rowNumber} updated`,
      metadata: { batchId: batch._id, rowId: target._id, rowNumber: target.rowNumber },
      createdAt: now,
    });
    return reviewed[targetIndex];
  },
});

export const approveImport = mutation({
  args: { batchId: v.id("participantImportBatches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Participant import batch not found");
    const { study, user } = await requireStudyAccess(ctx, batch.studyId);
    const participants = await ctx.db
      .query("studyParticipants")
      .withIndex("by_study", (query) => query.eq("studyId", study._id))
      .collect();
    if (batch.status === "approved") {
      return {
        created: false,
        participantIds: participants
          .filter((participant) => participant.importBatchId === batch._id)
          .map((participant) => participant._id),
      };
    }
    assertStudyCan(study.status, "review_participants");
    if (batch.status !== "under_review") throw new Error("Only imports under review can be approved");
    const storedRows = await ctx.db
      .query("participantImportRows")
      .withIndex("by_batch", (query) => query.eq("batchId", batch._id))
      .collect();
    if (storedRows.some((row) => row.disposition === "needs_review")) {
      throw new Error("Resolve or exclude every row that needs review before approval");
    }
    const readyRows = storedRows.filter((row) => row.disposition === "ready");
    if (readyRows.length === 0) throw new Error("The import has no participants ready for approval");
    const suppressions = await ctx.db
      .query("suppressionEntries")
      .withIndex("by_organization", (query) => query.eq("organizationId", study.organizationId))
      .collect();
    const revalidated = await validateRows({
      rows: readyRows.map((row) => normalizedToCanonicalRaw(row.normalized)),
      mapping: canonicalMapping,
      policy: makeContactPolicy(participants, suppressions),
    });
    if (revalidated.some((row) => row.disposition !== "ready")) {
      throw new Error("Participant contacts changed since review; review the import again");
    }

    const now = Date.now();
    const participantIds = [];
    const batchMapping = assertMapping(batch.mapping);
    for (let index = 0; index < revalidated.length; index += 1) {
      const row = revalidated[index];
      if (!row.normalized.name || !row.normalized.preferredMode) {
        throw new Error("A ready participant row is incomplete");
      }
      const notes = mappedValue(assertRawRow(readyRows[index].raw), batchMapping.notes, " ") || undefined;
      const participantId = await ctx.db.insert("studyParticipants", {
        organizationId: study.organizationId,
        studyId: study._id,
        name: row.normalized.name,
        email: row.normalized.email,
        phone: row.normalized.phone,
        segment: row.normalized.segment,
        notes,
        preferredMode: row.normalized.preferredMode,
        consentStatus: "unknown",
        importBatchId: batch._id,
        status: "draft",
        createdBy: user._id,
        createdAt: now,
        updatedAt: now,
      });
      participantIds.push(participantId);
    }
    await ctx.db.patch(batch._id, {
      status: "approved",
      approvedBy: user._id,
      approvedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(study._id, {
      currentApprovedParticipantBatchId: batch._id,
      updatedAt: now,
    });
    if (study.status === "questionnaire_approved") {
      await transitionStudy(ctx, study._id, "participants_under_review");
    }
    await transitionStudy(ctx, study._id, "fieldwork_ready");
    await ctx.db.insert("auditEvents", {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      actorType: "user",
      eventType: "participant_import.approved",
      summary: `${participantIds.length} reviewed participants approved`,
      metadata: { batchId: batch._id, participantIds },
      createdAt: now,
    });
    return { created: true, participantIds };
  },
});

export const approveManualSelection = mutation({
  args: {
    studyId: v.id("studies"),
    participantIds: v.array(v.id("studyParticipants")),
  },
  handler: async (ctx, args) => {
    const { study, user } = await requireStudyAccess(ctx, args.studyId);
    assertStudyCan(study.status, "review_participants");
    if (args.participantIds.length === 0) {
      throw new Error("Select at least one manual participant for approval");
    }
    if (new Set(args.participantIds).size !== args.participantIds.length) {
      throw new Error("Manual participant selection contains duplicate IDs");
    }
    const participants = await Promise.all(args.participantIds.map((id) => ctx.db.get(id)));
    for (const participant of participants) {
      if (!participant || participant.studyId !== study._id ||
        participant.organizationId !== study.organizationId) {
        throw new Error("Manual participant selection contains an inaccessible participant");
      }
      if (participant.status === "archived") {
        throw new Error("Archived participants cannot be approved");
      }
      if (participant.importBatchId) {
        throw new Error("A selected participant already belongs to an approved import batch");
      }
      const email = participant.email?.trim().toLowerCase();
      const phone = participant.phone ? normalizePhone(participant.phone) : "";
      if (!participant.name.trim() ||
        (!(email && isValidEmail(email)) && !(phone && isValidPhone(phone)))) {
        throw new Error("Every selected participant needs a name and valid contact method");
      }
    }
    const suppressions = await ctx.db
      .query("suppressionEntries")
      .withIndex("by_organization", (query) => query.eq("organizationId", study.organizationId))
      .collect();
    const suppressedEmails = new Set(
      suppressions.flatMap((entry) => entry.normalizedEmail ? [entry.normalizedEmail.toLowerCase()] : []),
    );
    const suppressedPhones = new Set(
      suppressions.flatMap((entry) => entry.normalizedPhone ? [normalizePhone(entry.normalizedPhone)] : []),
    );
    if (participants.some((participant) =>
      (participant?.email && suppressedEmails.has(participant.email.toLowerCase())) ||
      (participant?.phone && suppressedPhones.has(normalizePhone(participant.phone)))
    )) {
      throw new Error("A selected participant is suppressed for this workspace");
    }
    const contactKeys = participants.flatMap((participant) => {
      if (!participant) return [];
      return [
        ...(participant.email ? [`email:${participant.email.toLowerCase()}`] : []),
        ...(participant.phone ? [`phone:${normalizePhone(participant.phone)}`] : []),
      ];
    });
    if (new Set(contactKeys).size !== contactKeys.length) {
      throw new Error("Manual participant selection contains duplicate contacts");
    }

    const now = Date.now();
    const batchId = await ctx.db.insert("participantImportBatches", {
      organizationId: study.organizationId,
      studyId: study._id,
      filename: "Manual selection",
      mapping: { source: "manual_selection" },
      totalRows: participants.length,
      validRows: participants.length,
      invalidRows: 0,
      duplicateRows: 0,
      suppressedRows: 0,
      status: "approved",
      approvedBy: user._id,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    for (const participant of participants) {
      if (participant) await ctx.db.patch(participant._id, { importBatchId: batchId, updatedAt: now });
    }
    await ctx.db.patch(study._id, {
      currentApprovedParticipantBatchId: batchId,
      updatedAt: now,
    });
    if (study.status === "questionnaire_approved") {
      await transitionStudy(ctx, study._id, "participants_under_review");
    }
    await transitionStudy(ctx, study._id, "fieldwork_ready");
    await ctx.db.insert("auditEvents", {
      organizationId: study.organizationId,
      studyId: study._id,
      actorUserId: user._id,
      actorType: "user",
      eventType: "participant_manual_selection.approved",
      summary: `${participants.length} manually added participants approved`,
      metadata: { batchId, participantIds: args.participantIds },
      createdAt: now,
    });
    return { created: true, batchId, participantIds: args.participantIds };
  },
});

const canonicalMapping: ParticipantMapping = {
  name: ["name"],
  email: ["email"],
  phone: ["phone"],
  segment: ["segment"],
  preferredMode: ["preferredMode"],
};

function normalizedToCanonicalRaw(normalized: NormalizedParticipantRow) {
  return {
    name: normalized.name ?? "",
    email: normalized.email ?? "",
    phone: normalized.phone ?? "",
    segment: normalized.segment ?? "",
    preferredMode: normalized.preferredMode ?? "",
  };
}

function assertMapping(value: unknown): ParticipantMapping {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Participant mapping is invalid");
  }
  const mapping: ParticipantMapping = {};
  for (const field of PARTICIPANT_FIELDS) {
    const columns = (value as Record<string, unknown>)[field];
    if (columns === undefined) continue;
    if (!Array.isArray(columns) || columns.length === 0 ||
      columns.some((column) => typeof column !== "string" || !column.trim())) {
      throw new Error(`Mapping for ${field} is invalid`);
    }
    mapping[field] = columns.map((column) => column.trim());
  }
  return mapping;
}

function assertRawRow(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Participant import row is invalid");
  }
  const row: Record<string, string> = {};
  for (const [key, cell] of Object.entries(value)) {
    if (typeof cell !== "string") throw new Error(`Cell ${key} must be text`);
    row[key] = cell;
  }
  return row;
}

function summarizeRows(rows: ReviewedParticipantRow[]) {
  return {
    totalRows: rows.length,
    validRows: rows.filter((row) => row.disposition === "ready").length,
    invalidRows: rows.filter((row) => row.disposition === "needs_review").length,
    duplicateRows: rows.filter((row) => row.duplicate).length,
    suppressedRows: rows.filter((row) => row.suppressed).length,
  };
}

function makeContactPolicy(
  participants: Array<{ status: string; email?: string; phone?: string }>,
  suppressions: Array<{ normalizedEmail?: string; normalizedPhone?: string }>,
): ContactPolicyAdapter {
  return {
    async findExisting(contacts) {
      const active = participants.filter((participant) => participant.status !== "archived");
      return {
        emails: contacts.emails.filter((email) =>
          active.some((participant) => participant.email?.toLowerCase() === email)
        ),
        phones: contacts.phones.filter((phone) =>
          active.some((participant) => participant.phone && normalizePhone(participant.phone) === phone)
        ),
      };
    },
    async findSuppressed(contacts) {
      return {
        emails: contacts.emails.filter((email) =>
          suppressions.some((entry) => entry.normalizedEmail?.toLowerCase() === email)
        ),
        phones: contacts.phones.filter((phone) =>
          suppressions.some((entry) =>
            entry.normalizedPhone && normalizePhone(entry.normalizedPhone) === phone
          )
        ),
      };
    },
  };
}

function persistedNormalized(normalized: NormalizedParticipantRow) {
  return {
    name: normalized.name,
    email: normalized.email,
    phone: normalized.phone,
    segment: normalized.segment,
    preferredMode: normalized.preferredMode,
  };
}
