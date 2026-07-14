export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: T };

export type KnowledgeScope =
  | { kind: "company" }
  | { kind: "study"; studyId: string; studyName?: string };

export type KnowledgeSourceKind =
  | "website"
  | "media_link"
  | "pdf"
  | "presentation"
  | "document"
  | "spreadsheet"
  | "audio"
  | "video";

export type KnowledgeSourceStatus = "queued" | "processing" | "ready" | "failed";

export interface KnowledgeSource {
  id: string;
  name: string;
  kind: KnowledgeSourceKind;
  scope: KnowledgeScope;
  status: KnowledgeSourceStatus;
  statusMessage: string;
  error?: string;
  updatedAt: string;
}

export interface KnowledgeLinkInput {
  kind: "website" | "media_link";
  url: string;
}

export interface KnowledgeAdapter {
  listSources(scope: KnowledgeScope): Promise<KnowledgeSource[]>;
  addLink(scope: KnowledgeScope, input: KnowledgeLinkInput): Promise<KnowledgeSource>;
  addFiles(scope: KnowledgeScope, files: readonly File[]): Promise<KnowledgeSource[]>;
  retrySource(sourceId: string): Promise<void>;
  removeSource(sourceId: string): Promise<void>;
}

const supportedExtensions = new Set([
  "pdf",
  "ppt",
  "pptx",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "mp3",
  "m4a",
  "wav",
  "ogg",
  "mp4",
  "mov",
  "webm",
]);

export function supportedKnowledgeFile(filename: string): boolean {
  const extension = filename.toLowerCase().split(".").pop();
  return Boolean(extension && supportedExtensions.has(extension));
}

export function normalizeKnowledgeLink(
  kind: KnowledgeLinkInput["kind"],
  rawUrl: string,
): KnowledgeLinkInput {
  const trimmed = rawUrl.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;

  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error("Enter a valid public URL.");
  }

  if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes(".")) {
    throw new Error("Enter a valid public URL.");
  }

  return { kind, url: parsed.href };
}

export type MemoryCategory =
  | "company"
  | "product"
  | "audience"
  | "market"
  | "decision"
  | "method"
  | "study"
  | "other";

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: MemoryCategory;
  active: boolean;
  updatedAt: string;
}

export type MemoryScope =
  | { kind: "company" }
  | { kind: "study"; studyId: string; studyName: string };

export type MemoryDraft = Pick<MemoryItem, "key" | "value" | "category">;

export interface MemoryAdapter {
  listMemory(scope: MemoryScope): Promise<MemoryItem[]>;
  createMemory(scope: MemoryScope, draft: MemoryDraft): Promise<MemoryItem>;
  updateMemory(itemId: string, patch: Partial<MemoryDraft>): Promise<MemoryItem>;
  removeMemory(itemId: string): Promise<void>;
}

export type BrandTone = "precise" | "warm" | "direct";
export type BrandFontPreference = "serif" | "sans";

export interface BrandProfile {
  displayName: string;
  logoUrl?: string;
  logoName?: string;
  primaryColor: string;
  accentColor: string;
  reportTitle: string;
  reportFooter: string;
  tone: BrandTone;
  headingFont: BrandFontPreference;
  bodyFont: BrandFontPreference;
}

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  displayName: "Meridian",
  primaryColor: "#171612",
  accentColor: "#C2593B",
  reportTitle: "Customer evidence report",
  reportFooter: "Confidential research",
  tone: "precise",
  headingFont: "serif",
  bodyFont: "sans",
};

export type BrandProfileErrors = Partial<Record<keyof BrandProfile, string>>;

export function validateBrandProfile(profile: BrandProfile): BrandProfileErrors {
  const errors: BrandProfileErrors = {};
  const hex = /^#[0-9A-F]{6}$/i;

  if (!profile.displayName.trim()) errors.displayName = "Enter a display name.";
  if (!hex.test(profile.primaryColor)) errors.primaryColor = "Use a six-digit hex color.";
  if (!hex.test(profile.accentColor)) errors.accentColor = "Use a six-digit hex color.";
  if (!profile.reportTitle.trim()) errors.reportTitle = "Enter a report title.";
  if (!profile.reportFooter.trim()) errors.reportFooter = "Enter a report footer.";

  return errors;
}

export interface BrandAdapter {
  getBrandProfile(): Promise<BrandProfile>;
  updateBrandProfile(profile: BrandProfile): Promise<BrandProfile>;
  uploadLogo(file: File): Promise<{ logoUrl: string; logoName: string }>;
  removeLogo(): Promise<void>;
}
