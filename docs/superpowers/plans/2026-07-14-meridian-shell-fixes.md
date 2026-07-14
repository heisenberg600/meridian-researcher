# Meridian Shell Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task.

**Goal:** Make the route-independent Meridian shell integration-safe, accessible, responsive, and fully covered by the normal test command.

**Architecture:** Keep App and route registration lead-owned. Make `src/components/meridian/` the only Meridian component module, preserve legacy APIs through its index, keep design semantics in app-owned styles, and exercise behavior through Vitest SSR/source-contract tests.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind CSS 4.

## Global Constraints

- Do not register App or routes.
- Write a failing regression test before every production behavior change.
- Preserve all existing Portal and Knowledge bare-import APIs.
- Normal `pnpm test` must run backend and shell tests.

---

### Task 1: Test runner and stylesheet ownership

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `src/index.css`
- Create: `vitest.config.ts`
- Modify: `src/styles/styles.test.ts`

- [ ] Convert source tests to Vitest and configure `pnpm test` to run both source and backend suites.
- [ ] Add failing assertions that `index.css` imports `styles/tokens.css` and `styles/base.css`, excludes the UUID docs stylesheet, and that required compatibility/accessibility tokens exist.
- [ ] Run focused tests and confirm expected failures.
- [ ] Import app-owned styles and add tokens with accessible values.
- [ ] Re-run focused tests to green.

### Task 2: Resolve Meridian module compatibility

**Files:**
- Delete: `src/components/meridian.tsx`
- Modify: `src/components/meridian/index.ts`, `src/components/meridian/Badge.tsx`, `src/components/meridian/compatibility.test.tsx`

- [ ] Add a failing bare-import test covering `Badge tone`, `SectionHeader`, form exports, and utility exports.
- [ ] Run the test and confirm the current basename collision/export behavior fails.
- [ ] Move compatibility behavior into the directory module and remove the colliding file.
- [ ] Re-run the test to green.

### Task 3: Accessible shared states and optional actions

**Files:**
- Create: `src/components/meridian/ErrorState.tsx`, `src/components/meridian/Toast.tsx`
- Modify: `src/components/meridian/index.ts`, `ApprovalCard.tsx`, `EvidenceLink.tsx`, `ToastRegion.tsx`
- Test: corresponding component tests and compatibility test

- [ ] Add failing tests for reusable error/toast exports, disabled missing approval callbacks, required evidence href, and interactive toast children.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement minimal accessible components and prop contracts.
- [ ] Re-run focused tests to green.

### Task 4: Shell responsive and lifecycle semantics

**Files:**
- Modify: `src/app/WorkspaceShell.tsx`, `src/app/StudyShell.tsx`
- Test: `src/app/WorkspaceShell.test.tsx`, `src/app/StudyShell.test.tsx`

- [ ] Add failing assertions for safe-area padding, bounded mobile-menu overflow, and unnumbered Memory navigation.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement the minimal class/markup changes and remove blur.
- [ ] Re-run focused tests to green.

### Task 5: Verification and commit

- [ ] Run `pnpm test`, `pnpm lint`, `pnpm build`, and `git diff --check` fresh.
- [ ] Review the full diff against every requirement and inspect worktree status.
- [ ] Commit the verified implementation and report the SHA.
