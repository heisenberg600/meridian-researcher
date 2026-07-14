import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DEFAULT_BRAND_PROFILE,
  normalizeKnowledgeLink,
  supportedKnowledgeFile,
  validateBrandProfile,
  type BrandProfile,
  type KnowledgeSource,
  type MemoryItem,
} from "../src/features/context/contracts";
import { KnowledgePageView } from "../src/features/knowledge/KnowledgePage";
import { applyMemoryChange } from "../src/features/memory/memoryModel";
import { CompanyMemoryPageView } from "../src/features/memory/CompanyMemoryPage";
import { StudyMemoryPageView } from "../src/features/memory/StudyMemoryPage";
import { BrandPageView } from "../src/features/brand/BrandPage";

const noop = () => undefined;

const readySource: KnowledgeSource = {
  id: "source-ready",
  name: "Pricing one-pager.pdf",
  kind: "pdf",
  scope: { kind: "company" },
  status: "ready",
  statusMessage: "18 pages indexed",
  updatedAt: "2026-07-14T10:00:00.000Z",
};

test("knowledge contracts normalize public links and reject unsupported files", () => {
  assert.deepEqual(normalizeKnowledgeLink("website", "northbeam.co"), {
    kind: "website",
    url: "https://northbeam.co/",
  });
  assert.deepEqual(normalizeKnowledgeLink("media_link", "https://youtube.com/watch?v=abc"), {
    kind: "media_link",
    url: "https://youtube.com/watch?v=abc",
  });
  assert.equal(supportedKnowledgeFile("research.xlsx"), true);
  assert.equal(supportedKnowledgeFile("malware.exe"), false);
  assert.throws(() => normalizeKnowledgeLink("website", "not a website"), /valid public URL/i);
});

test("knowledge page renders genuine loading, error, and empty states", () => {
  const common = {
    scope: { kind: "company" } as const,
    onAddLink: noop,
    onAddFiles: noop,
    onRetry: noop,
    onRemove: noop,
    onReload: noop,
  };

  const loading = renderToStaticMarkup(createElement(KnowledgePageView, { ...common, state: { status: "loading" } }));
  assert.match(loading, /Loading company knowledge/i);
  assert.match(loading, /aria-busy="true"/);

  const failed = renderToStaticMarkup(createElement(KnowledgePageView, {
    ...common,
    state: { status: "error", message: "Knowledge could not be loaded." },
  }));
  assert.match(failed, /Knowledge could not be loaded/);
  assert.match(failed, />Try again</);

  const empty = renderToStaticMarkup(createElement(KnowledgePageView, {
    ...common,
    state: { status: "ready", data: [] },
  }));
  assert.match(empty, /Give every study a reliable starting point/i);
  assert.match(empty, /Add a website or public media link/i);
  assert.match(empty, /Upload source files/i);
});

test("knowledge page makes processing and failed source states actionable", () => {
  const sources: KnowledgeSource[] = [
    readySource,
    {
      id: "source-processing",
      name: "northbeam.co",
      kind: "website",
      scope: { kind: "company" },
      status: "processing",
      statusMessage: "Scanning page 8 of 14",
      updatedAt: "2026-07-14T10:02:00.000Z",
    },
    {
      id: "source-failed",
      name: "Customer calls.zip",
      kind: "document",
      scope: { kind: "company" },
      status: "failed",
      statusMessage: "We could not read this archive.",
      error: "Upload a supported document, spreadsheet, audio, or video file.",
      updatedAt: "2026-07-14T10:03:00.000Z",
    },
  ];

  const html = renderToStaticMarkup(createElement(KnowledgePageView, {
    scope: { kind: "company" },
    state: { status: "ready", data: sources },
    onAddLink: noop,
    onAddFiles: noop,
    onRetry: noop,
    onRemove: noop,
    onReload: noop,
  }));

  assert.match(html, /18 pages indexed/);
  assert.match(html, /Scanning page 8 of 14/);
  assert.match(html, /Upload a supported document/);
  assert.match(html, />Retry</);
  assert.match(html, /aria-label="Remove Pricing one-pager.pdf"/);
});

test("memory changes update one item without adding approval or citation state", () => {
  const items: MemoryItem[] = [
    { id: "audience", key: "Audience", value: "10–200 seat teams", category: "audience", active: true, updatedAt: "2026-07-14" },
    { id: "pricing", key: "Pricing change", value: "Changed in March", category: "company", active: true, updatedAt: "2026-07-14" },
  ];

  const next = applyMemoryChange(items, {
    type: "update",
    id: "pricing",
    patch: { value: "Changed in March 2026" },
  });

  assert.equal(next[0], items[0]);
  assert.equal(next[1]?.value, "Changed in March 2026");
  assert.deepEqual(Object.keys(next[1] ?? {}).sort(), ["active", "category", "id", "key", "updatedAt", "value"]);
});

test("company and study memory surfaces state their isolation and editing model", () => {
  const state = {
    status: "ready" as const,
    data: [{ id: "m1", key: "Decision", value: "Improve onboarding before Q3", category: "decision" as const, active: true, updatedAt: "2026-07-14" }],
  };
  const handlers = { onCreate: noop, onUpdate: noop, onRemove: noop, onReload: noop };

  const company = renderToStaticMarkup(createElement(CompanyMemoryPageView, { state, ...handlers }));
  assert.match(company, /Company memory/);
  assert.match(company, /shared with every study/i);
  assert.match(company, /Edit Decision/);

  const study = renderToStaticMarkup(createElement(StudyMemoryPageView, {
    studyName: "Churn study",
    state,
    ...handlers,
  }));
  assert.match(study, /Churn study memory/);
  assert.match(study, /only this study/i);
  assert.doesNotMatch(study, /approval|confidence|citation/i);
});

test("brand defaults validate and render a customer-owned report preview", () => {
  assert.equal(DEFAULT_BRAND_PROFILE.displayName, "Meridian");
  assert.deepEqual(validateBrandProfile(DEFAULT_BRAND_PROFILE), {});
  assert.equal(validateBrandProfile({ ...DEFAULT_BRAND_PROFILE, primaryColor: "red" }).primaryColor, "Use a six-digit hex color.");

  const profile: BrandProfile = {
    ...DEFAULT_BRAND_PROFILE,
    displayName: "Atlas Labs",
    primaryColor: "#35597E",
    accentColor: "#C2593B",
    reportTitle: "Customer evidence brief",
    reportFooter: "Atlas Labs · Confidential",
    tone: "direct",
  };
  const html = renderToStaticMarkup(createElement(BrandPageView, {
    state: { status: "ready", data: profile },
    onSave: noop,
    onUploadLogo: noop,
    onRemoveLogo: noop,
    onReload: noop,
  }));

  assert.match(html, /Customer evidence brief/);
  assert.match(html, /Atlas Labs · Confidential/);
  assert.match(html, /--brand-primary:#35597E/);
  assert.match(html, /Save brand profile/);
});

test("brand page renders recoverable loading and error states", () => {
  const handlers = {
    onSave: noop,
    onUploadLogo: noop,
    onRemoveLogo: noop,
    onReload: noop,
  };

  const loading = renderToStaticMarkup(createElement(BrandPageView, {
    state: { status: "loading" },
    ...handlers,
  }));
  assert.match(loading, /Loading brand profile/i);
  assert.match(loading, /aria-busy="true"/);

  const failed = renderToStaticMarkup(createElement(BrandPageView, {
    state: { status: "error", message: "Brand profile could not be loaded." },
    ...handlers,
  }));
  assert.match(failed, /Brand profile could not be loaded/);
  assert.match(failed, />Try again</);
});
