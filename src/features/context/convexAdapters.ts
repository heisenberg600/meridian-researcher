import {
  DEFAULT_BRAND_PROFILE,
  type BrandAdapter,
  type BrandFontPreference,
  type BrandProfile,
  type BrandTone,
  type KnowledgeAdapter,
  type KnowledgeScope,
  type KnowledgeSource,
  type KnowledgeSourceKind,
  type KnowledgeSourceStatus,
  type MemoryAdapter,
  type MemoryCategory,
  type MemoryDraft,
  type MemoryItem,
  type MemoryScope,
} from "./contracts";

type BackendSourceKind = "website" | "document" | "spreadsheet" | "audio" | "video" | "public_media";

export interface BackendKnowledgeSource {
  _id: string;
  organizationId: string;
  studyId?: string;
  kind: BackendSourceKind;
  url?: string;
  storageId?: string;
  filename?: string;
  contentType?: string;
  status: KnowledgeSourceStatus;
  extractedSummary?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeTransport {
  list(args: { studyId?: string }): Promise<readonly BackendKnowledgeSource[]>;
  generateUploadUrl(args: { studyId?: string }): Promise<string>;
  uploadFile(uploadUrl: string, file: File): Promise<{ storageId: string }>;
  submitLink(args: { studyId?: string; kind: "website" | "public_media"; url: string }): Promise<string>;
  submitUpload(args: { studyId?: string; storageId: string; filename: string; contentType: string }): Promise<string>;
  retry(args: { sourceId: string }): Promise<void>;
  remove(args: { sourceId: string }): Promise<void>;
}

export function mapKnowledgeSource(source: BackendKnowledgeSource, scope: KnowledgeScope): KnowledgeSource {
  return {
    id: source._id,
    name: source.filename ?? source.url ?? "Untitled source",
    kind: mapSourceKind(source),
    scope,
    status: source.status,
    statusMessage: sourceStatusMessage(source),
    error: source.error,
    updatedAt: new Date(source.updatedAt).toISOString(),
  };
}

export function createKnowledgeAdapter(transport: KnowledgeTransport): KnowledgeAdapter {
  async function listMapped(scope: KnowledgeScope) {
    const sources = await transport.list(scopeArgs(scope));
    return sources.map((source) => mapKnowledgeSource(source, scope));
  }

  async function findCreated(scope: KnowledgeScope, sourceIds: readonly string[]) {
    const sources = await listMapped(scope);
    const byId = new Map(sources.map((source) => [source.id, source]));
    return sourceIds.map((sourceId) => {
      const source = byId.get(sourceId);
      if (!source) throw new Error("The created source could not be loaded");
      return source;
    });
  }

  return {
    listSources: listMapped,
    async addLink(scope, input) {
      const sourceId = await transport.submitLink({
        ...scopeArgs(scope),
        kind: input.kind === "media_link" ? "public_media" : "website",
        url: input.url,
      });
      return (await findCreated(scope, [sourceId]))[0]!;
    },
    async addFiles(scope, files) {
      const sourceIds: string[] = [];
      for (const file of files) {
        const uploadUrl = await transport.generateUploadUrl(scopeArgs(scope));
        const { storageId } = await transport.uploadFile(uploadUrl, file);
        sourceIds.push(await transport.submitUpload({
          ...scopeArgs(scope),
          storageId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
        }));
      }
      return await findCreated(scope, sourceIds);
    },
    retrySource: (sourceId) => transport.retry({ sourceId }),
    removeSource: (sourceId) => transport.remove({ sourceId }),
  };
}

type CompanyMemoryCategory = "company" | "product" | "customer" | "research" | "preference" | "constraint" | "other";
type StudyMemoryCategory = "decision" | "audience" | "hypothesis" | "constraint" | "preference" | "other";

interface BackendMemory<TCategory extends string> {
  _id: string;
  key: string;
  value: string;
  category: TCategory;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
}

type CompanyMemoryRow = BackendMemory<CompanyMemoryCategory>;
type StudyMemoryRow = BackendMemory<StudyMemoryCategory>;

export interface MemoryTransport {
  listCompany(): Promise<readonly CompanyMemoryRow[]>;
  listStudy(args: { studyId: string }): Promise<readonly StudyMemoryRow[]>;
  createCompany(args: { key: string; value: string; category: CompanyMemoryCategory }): Promise<string>;
  createStudy(args: { studyId: string; key: string; value: string; category: StudyMemoryCategory }): Promise<string>;
  updateCompany(args: { memoryId: string; key?: string; value?: string; category?: CompanyMemoryCategory }): Promise<void>;
  updateStudy(args: { memoryId: string; key?: string; value?: string; category?: StudyMemoryCategory }): Promise<void>;
  archiveCompany(args: { memoryId: string }): Promise<void>;
  archiveStudy(args: { memoryId: string }): Promise<void>;
}

export function createMemoryAdapter(transport: MemoryTransport): MemoryAdapter {
  const ownerById = new Map<string, MemoryScope>();

  async function listMapped(scope: MemoryScope) {
    const rows = scope.kind === "company"
      ? await transport.listCompany()
      : await transport.listStudy({ studyId: scope.studyId });
    const mapped = rows.map((row) => mapMemory(row, scope.kind));
    for (const item of mapped) ownerById.set(item.id, scope);
    return mapped;
  }

  async function findAfterWrite(scope: MemoryScope, memoryId: string) {
    const item = (await listMapped(scope)).find((candidate) => candidate.id === memoryId);
    if (!item) throw new Error("The saved memory could not be loaded");
    return item;
  }

  return {
    listMemory: listMapped,
    async createMemory(scope, draft) {
      const memoryId = scope.kind === "company"
        ? await transport.createCompany(mapCompanyDraft(draft))
        : await transport.createStudy({ studyId: scope.studyId, ...mapStudyDraft(draft) });
      ownerById.set(memoryId, scope);
      return await findAfterWrite(scope, memoryId);
    },
    async updateMemory(memoryId, patch) {
      const scope = ownerById.get(memoryId);
      if (!scope) throw new Error("Load memory before editing it");
      if (scope.kind === "company") {
        await transport.updateCompany({ memoryId, ...mapCompanyPatch(patch) });
      } else {
        await transport.updateStudy({ memoryId, ...mapStudyPatch(patch) });
      }
      return await findAfterWrite(scope, memoryId);
    },
    async removeMemory(memoryId) {
      const scope = ownerById.get(memoryId);
      if (!scope) throw new Error("Load memory before removing it");
      if (scope.kind === "company") await transport.archiveCompany({ memoryId });
      else await transport.archiveStudy({ memoryId });
      ownerById.delete(memoryId);
    },
  };
}

export interface BackendBrandProfile {
  displayName: string;
  primaryColor: string;
  accentColor: string;
  tone?: string;
  reportTitle?: string;
  reportFooter?: string;
  headingFont?: BrandFontPreference;
  bodyFont?: BrandFontPreference;
  logoUrl?: string;
  logoName?: string;
}

export interface BrandTransport {
  getProfile(): Promise<BackendBrandProfile>;
  updateProfile(profile: { displayName: string; primaryColor: string; accentColor: string; tone: BrandTone; reportTitle: string; reportFooter: string; headingFont: BrandFontPreference; bodyFont: BrandFontPreference }): Promise<void>;
  generateLogoUploadUrl(): Promise<string>;
  uploadFile(uploadUrl: string, file: File): Promise<{ storageId: string }>;
  setLogo(args: { storageId: string; logoName: string }): Promise<void>;
  removeLogo(): Promise<void>;
}

export function mapBrandProfile(profile: BackendBrandProfile): BrandProfile {
  return {
    ...DEFAULT_BRAND_PROFILE,
    displayName: profile.displayName,
    primaryColor: profile.primaryColor,
    accentColor: profile.accentColor,
    tone: isBrandTone(profile.tone) ? profile.tone : DEFAULT_BRAND_PROFILE.tone,
    reportTitle: profile.reportTitle?.trim() || DEFAULT_BRAND_PROFILE.reportTitle,
    reportFooter: profile.reportFooter?.trim() || DEFAULT_BRAND_PROFILE.reportFooter,
    headingFont: profile.headingFont ?? DEFAULT_BRAND_PROFILE.headingFont,
    bodyFont: profile.bodyFont ?? DEFAULT_BRAND_PROFILE.bodyFont,
    ...(profile.logoName ? { logoName: profile.logoName } : {}),
    ...(profile.logoUrl ? { logoUrl: profile.logoUrl } : {}),
  };
}

export function createBrandAdapter(transport: BrandTransport): BrandAdapter {
  return {
    async getBrandProfile() {
      return mapBrandProfile(await transport.getProfile());
    },
    async updateBrandProfile(profile) {
      await transport.updateProfile(schemaBackedBrandFields(profile));
      const persisted = mapBrandProfile(await transport.getProfile());
      return persisted;
    },
    async uploadLogo(file) {
      const uploadUrl = await transport.generateLogoUploadUrl();
      const { storageId } = await transport.uploadFile(uploadUrl, file);
      await transport.setLogo({ storageId, logoName: file.name });
      const profile = await transport.getProfile();
      if (!profile.logoUrl) throw new Error("The uploaded logo could not be loaded");
      return { logoUrl: profile.logoUrl, logoName: file.name };
    },
    removeLogo: () => transport.removeLogo(),
  };
}

function scopeArgs(scope: KnowledgeScope) {
  return { studyId: scope.kind === "study" ? scope.studyId : undefined };
}

function mapSourceKind(source: BackendKnowledgeSource): KnowledgeSourceKind {
  if (source.kind === "public_media") return "media_link";
  if (source.kind !== "document") return source.kind;
  const extension = source.filename?.toLowerCase().split(".").pop();
  if (extension === "pdf") return "pdf";
  if (extension === "ppt" || extension === "pptx") return "presentation";
  return "document";
}

function sourceStatusMessage(source: BackendKnowledgeSource) {
  if (source.status === "ready") return source.extractedSummary?.trim() || "Source is ready";
  if (source.status === "failed") return source.error?.trim() || "Source processing failed";
  if (source.status === "processing") return "Source processing is in progress";
  return "Waiting to be processed";
}

function mapMemory(row: CompanyMemoryRow | StudyMemoryRow, scope: MemoryScope["kind"]): MemoryItem {
  return {
    id: row._id,
    key: row.key,
    value: row.value,
    category: scope === "company"
      ? mapCompanyCategory(row.category as CompanyMemoryCategory)
      : mapStudyCategory(row.category as StudyMemoryCategory),
    active: row.status === "active",
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function mapCompanyCategory(category: CompanyMemoryCategory): MemoryCategory {
  if (category === "customer") return "audience";
  if (category === "research") return "market";
  if (category === "preference") return "method";
  if (category === "constraint") return "other";
  return category;
}

function mapStudyCategory(category: StudyMemoryCategory): MemoryCategory {
  if (category === "hypothesis") return "study";
  if (category === "preference") return "method";
  if (category === "constraint") return "other";
  return category;
}

function mapCompanyDraft(draft: MemoryDraft) {
  return { key: draft.key, value: draft.value, category: toCompanyCategory(draft.category) };
}

function mapStudyDraft(draft: MemoryDraft) {
  return { key: draft.key, value: draft.value, category: toStudyCategory(draft.category) };
}

function mapCompanyPatch(patch: Partial<MemoryDraft>) {
  return {
    ...(patch.key === undefined ? {} : { key: patch.key }),
    ...(patch.value === undefined ? {} : { value: patch.value }),
    ...(patch.category === undefined ? {} : { category: toCompanyCategory(patch.category) }),
  };
}

function mapStudyPatch(patch: Partial<MemoryDraft>) {
  return {
    ...(patch.key === undefined ? {} : { key: patch.key }),
    ...(patch.value === undefined ? {} : { value: patch.value }),
    ...(patch.category === undefined ? {} : { category: toStudyCategory(patch.category) }),
  };
}

function toCompanyCategory(category: MemoryCategory): CompanyMemoryCategory {
  if (category === "audience") return "customer";
  if (category === "market") return "research";
  if (category === "method") return "preference";
  if (category === "company" || category === "product" || category === "other") return category;
  return "other";
}

function toStudyCategory(category: MemoryCategory): StudyMemoryCategory {
  if (category === "audience" || category === "decision" || category === "other") return category;
  if (category === "study") return "hypothesis";
  if (category === "method") return "preference";
  return "other";
}

function schemaBackedBrandFields(profile: BrandProfile) {
  return {
    displayName: profile.displayName,
    primaryColor: profile.primaryColor,
    accentColor: profile.accentColor,
    tone: profile.tone,
    reportTitle: profile.reportTitle,
    reportFooter: profile.reportFooter,
    headingFont: profile.headingFont,
    bodyFont: profile.bodyFont,
  };
}

function isBrandTone(tone?: string): tone is BrandTone {
  return tone === "precise" || tone === "warm" || tone === "direct";
}
