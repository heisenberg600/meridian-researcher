import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BRAND_PROFILE,
  generateLogoUploadUrl,
  getProfile,
  removeLogo,
  setLogo,
  updateProfile,
} from "../convex/brandProfiles";

const handler = <TArgs, TResult>(value: unknown) =>
  (value as { _handler: (ctx: unknown, args: TArgs) => Promise<TResult> })._handler;

function brandContext({ membership = true } = {}) {
  const profiles = new Map<string, Record<string, unknown>>();
  const inserted: Array<Record<string, unknown>> = [];
  const patched: Array<{ id: string; value: Record<string, unknown> }> = [];
  const deletedStorage: string[] = [];
  const ctx = {
    auth: { getUserIdentity: async () => ({ tokenIdentifier: "clerk|user-1" }) },
    storage: {
      generateUploadUrl: async () => "https://upload.example.test/logo",
      getUrl: async (storageId: string) => `https://cdn.example.test/${storageId}`,
      delete: async (storageId: string) => { deletedStorage.push(storageId); },
    },
    db: {
      get: async (id: string) => profiles.get(id) ?? null,
      insert: async (_table: string, value: Record<string, unknown>) => {
        const id = `brand-${inserted.length + 1}`;
        profiles.set(id, { _id: id, ...value });
        inserted.push(value);
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        profiles.set(id, { ...profiles.get(id), ...value });
        patched.push({ id, value });
      },
      query: (table: string) => ({
        withIndex: (_index: string, apply?: (query: { eq: (field: string, value: unknown) => unknown }) => unknown) => {
          apply?.({ eq: () => ({ eq: () => undefined }) });
          return {
            unique: async () => {
              if (table === "users") return { _id: "user-1", defaultOrganizationId: "organization-1" };
              if (table === "memberships") return membership ? { _id: "membership-1", organizationId: "organization-1", userId: "user-1" } : null;
              return Array.from(profiles.values()).find((profile) => profile.organizationId === "organization-1") ?? null;
            },
          };
        },
      }),
    },
  };
  return { ctx, profiles, inserted, patched, deletedStorage };
}

test("brand profile returns stable workspace defaults before the first save", async () => {
  const { ctx } = brandContext();
  const profile = await handler<Record<string, never>, typeof DEFAULT_BRAND_PROFILE & { logoUrl?: string }>(getProfile)(ctx, {});

  assert.deepEqual(profile, DEFAULT_BRAND_PROFILE);
  assert.equal(profile.logoUrl, undefined);
});

test("brand profiles require an active membership in the default workspace", async () => {
  const { ctx } = brandContext({ membership: false });
  await assert.rejects(
    () => handler<Record<string, never>, unknown>(getProfile)(ctx, {}),
    /Workspace not found/,
  );
});

test("brand profile update creates once, validates inputs, and patches thereafter", async () => {
  const { ctx, inserted, patched, profiles } = brandContext();
  const input = {
    displayName: " Atlas Labs ",
    primaryColor: "#35597e",
    accentColor: "#c2593b",
    tone: "direct" as const,
    reportFooter: " Atlas Labs · Confidential ",
  };
  const createdId = await handler<typeof input, string>(updateProfile)(ctx, input);
  const updatedId = await handler<typeof input, string>(updateProfile)(ctx, {
    ...input,
    primaryColor: "#243B53",
  });

  assert.equal(createdId, "brand-1");
  assert.equal(updatedId, "brand-1");
  assert.equal(inserted.length, 1);
  assert.equal(patched.length, 1);
  assert.equal(profiles.get("brand-1")?.displayName, "Atlas Labs");
  assert.equal(profiles.get("brand-1")?.primaryColor, "#243B53");
  await assert.rejects(
    () => handler<typeof input, unknown>(updateProfile)(ctx, { ...input, primaryColor: "blue" }),
    /six-digit hex color/i,
  );
  await assert.rejects(
    () => handler<typeof input, unknown>(updateProfile)(ctx, { ...input, displayName: " " }),
    /display name/i,
  );
});

test("brand logo operations generate uploads, replace old storage, resolve URLs, and remove cleanly", async () => {
  const { ctx, profiles, deletedStorage } = brandContext();
  profiles.set("brand-1", {
    _id: "brand-1",
    organizationId: "organization-1",
    ...DEFAULT_BRAND_PROFILE,
    logoStorageId: "logo-old",
    updatedAt: 1,
  });

  const uploadUrl = await handler<Record<string, never>, string>(generateLogoUploadUrl)(ctx, {});
  await handler<{ storageId: string }, void>(setLogo)(ctx, { storageId: "logo-new" });
  const withLogo = await handler<Record<string, never>, typeof DEFAULT_BRAND_PROFILE & { logoUrl?: string }>(getProfile)(ctx, {});
  await handler<Record<string, never>, void>(removeLogo)(ctx, {});

  assert.equal(uploadUrl, "https://upload.example.test/logo");
  assert.equal(withLogo.logoUrl, "https://cdn.example.test/logo-new");
  assert.deepEqual(deletedStorage, ["logo-old", "logo-new"]);
  assert.equal(profiles.get("brand-1")?.logoStorageId, undefined);
});
