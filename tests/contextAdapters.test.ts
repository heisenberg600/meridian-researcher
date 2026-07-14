import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrandAdapter,
  createKnowledgeAdapter,
  createMemoryAdapter,
  mapBrandProfile,
  mapKnowledgeSource,
  type BackendBrandProfile,
} from "../src/features/context/convexAdapters";
import { DEFAULT_BRAND_PROFILE, type BrandProfile } from "../src/features/context/contracts";

test("knowledge mapping translates persisted Convex kinds and status copy for the UI", () => {
  const source = mapKnowledgeSource({
    _id: "source-1",
    organizationId: "organization-1",
    studyId: "study-1",
    kind: "document",
    filename: "Research brief.pdf",
    contentType: "application/pdf",
    status: "ready",
    extractedSummary: "14 pages indexed",
    createdAt: 1,
    updatedAt: Date.UTC(2026, 6, 14),
  }, { kind: "study", studyId: "study-1", studyName: "Retention" });

  assert.deepEqual(source, {
    id: "source-1",
    name: "Research brief.pdf",
    kind: "pdf",
    scope: { kind: "study", studyId: "study-1", studyName: "Retention" },
    status: "ready",
    statusMessage: "14 pages indexed",
    error: undefined,
    updatedAt: "2026-07-14T00:00:00.000Z",
  });
});

test("knowledge adapter uploads through an injected transport and maps public media links", async () => {
  const documents: Array<Record<string, unknown>> = [];
  const calls: Array<{ operation: string; value?: unknown }> = [];
  const adapter = createKnowledgeAdapter({
    list: async () => documents as never,
    generateUploadUrl: async () => "https://upload.example.test/source",
    uploadFile: async (uploadUrl, file) => {
      calls.push({ operation: "upload", value: { uploadUrl, name: file.name } });
      return { storageId: "storage-1" };
    },
    submitLink: async (args) => {
      calls.push({ operation: "link", value: args });
      documents.push({ _id: "source-link", organizationId: "organization-1", kind: args.kind, url: args.url, status: "queued", createdAt: 1, updatedAt: 1 });
      return "source-link";
    },
    submitUpload: async (args) => {
      calls.push({ operation: "file", value: args });
      documents.push({ _id: "source-file", organizationId: "organization-1", kind: "spreadsheet", filename: args.filename, contentType: args.contentType, storageId: args.storageId, status: "queued", createdAt: 1, updatedAt: 1 });
      return "source-file";
    },
    retry: async (args) => { calls.push({ operation: "retry", value: args }); },
    remove: async (args) => { calls.push({ operation: "remove", value: args }); },
  });

  const link = await adapter.addLink({ kind: "company" }, { kind: "media_link", url: "https://youtube.com/watch?v=abc" });
  const [file] = await adapter.addFiles({ kind: "company" }, [new File(["a,b\n1,2"], "research.csv", { type: "text/csv" })]);

  assert.equal(link.kind, "media_link");
  assert.equal(file?.kind, "spreadsheet");
  assert.deepEqual(calls[0], { operation: "link", value: { kind: "public_media", url: "https://youtube.com/watch?v=abc", studyId: undefined } });
  assert.deepEqual(calls[1], { operation: "upload", value: { uploadUrl: "https://upload.example.test/source", name: "research.csv" } });
});

test("memory adapter maps category vocabularies and remembers which scoped API owns each row", async () => {
  const updates: Array<{ scope: string; value: unknown }> = [];
  const companyRows = [{ _id: "company-memory", key: "Audience", value: "10–200 seats", category: "customer" as const, status: "active" as const, createdAt: 1, updatedAt: 1 }];
  const studyRows = [{ _id: "study-memory", key: "Hypothesis", value: "Setup drives churn", category: "hypothesis" as const, status: "active" as const, createdAt: 1, updatedAt: 1 }];
  const adapter = createMemoryAdapter({
    listCompany: async () => companyRows,
    listStudy: async () => studyRows,
    createCompany: async () => "company-created",
    createStudy: async () => "study-created",
    updateCompany: async (value) => { updates.push({ scope: "company", value }); },
    updateStudy: async (value) => { updates.push({ scope: "study", value }); },
    archiveCompany: async () => undefined,
    archiveStudy: async () => undefined,
  });

  const company = await adapter.listMemory({ kind: "company" });
  const study = await adapter.listMemory({ kind: "study", studyId: "study-1", studyName: "Retention" });
  await adapter.updateMemory("company-memory", { category: "audience", value: "20–500 seats" });
  await adapter.updateMemory("study-memory", { category: "study", value: "Time-to-value drives churn" });

  assert.equal(company[0]?.category, "audience");
  assert.equal(study[0]?.category, "study");
  assert.deepEqual(updates, [
    { scope: "company", value: { memoryId: "company-memory", category: "customer", value: "20–500 seats" } },
    { scope: "study", value: { memoryId: "study-memory", category: "hypothesis", value: "Time-to-value drives churn" } },
  ]);
});

test("brand adapter persists every report preference", async () => {
  const backendProfile = {
    displayName: "Atlas Labs",
    primaryColor: "#35597E",
    accentColor: "#C2593B",
    tone: "direct" as const,
    reportFooter: "Atlas Labs · Confidential",
  };
  assert.deepEqual(mapBrandProfile(backendProfile), {
    ...DEFAULT_BRAND_PROFILE,
    ...backendProfile,
  });

  let updated: unknown;
  let currentBackend: BackendBrandProfile = { ...backendProfile, logoUrl: undefined };
  const adapter = createBrandAdapter({
    getProfile: async () => currentBackend,
    updateProfile: async (value) => { updated = value; currentBackend = { ...currentBackend, ...value }; },
    generateLogoUploadUrl: async () => "https://upload.example.test/logo",
    uploadFile: async () => ({ storageId: "logo-1" }),
    setLogo: async () => { currentBackend = { ...currentBackend, logoUrl: "https://cdn.example.test/logo-1" }; },
    removeLogo: async () => undefined,
  });
  const profile: BrandProfile = {
    ...DEFAULT_BRAND_PROFILE,
    ...backendProfile,
    reportTitle: "Customer evidence brief",
    headingFont: "sans",
  };
  const saved = await adapter.updateBrandProfile(profile);
  const logo = await adapter.uploadLogo(new File(["logo"], "atlas.svg", { type: "image/svg+xml" }));

  assert.deepEqual(updated, {
    ...backendProfile,
    reportTitle: "Customer evidence brief",
    headingFont: "sans",
    bodyFont: "sans",
  });
  assert.equal(saved.reportTitle, "Customer evidence brief");
  assert.equal(saved.headingFont, "sans");
  assert.deepEqual(logo, { logoUrl: "https://cdn.example.test/logo-1", logoName: "atlas.svg" });
});
