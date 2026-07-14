import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Meridian tokens are stable app-owned semantics", async () => {
  const css = await readFile(new URL("./tokens.css", import.meta.url), "utf8").catch(() => "");

  assert.ok(css, "tokens.css should exist");
  assert.match(css, /--canvas:/);
  assert.match(css, /--paper:/);
  assert.match(css, /--ink-strong:/);
  assert.match(css, /--clay:/);
  assert.match(css, /--font-editorial:/);
  assert.match(css, /--focus-ring:/);
  for (const legacyToken of [
    "--ink-700",
    "--ink-900",
    "--ivory-50",
    "--ivory-100",
    "--ivory-200",
    "--ivory-300",
    "--clay-800",
    "--text-display-md",
    "--text-body-sm",
    "--text-caption",
    "--text-code",
    "--tracking-caps",
    "--tracking-display",
    "--radius-xl",
    "--shadow-md",
  ]) {
    assert.match(css, new RegExp(`${legacyToken}:`), `${legacyToken} should remain available during Portal migration`);
  }
  assert.doesNotMatch(css, /ui-estimates|c43e081f|_ds\//);
});

test("base styles preserve visible focus, reduced motion, and readable selection", async () => {
  const css = await readFile(new URL("./base.css", import.meta.url), "utf8").catch(() => "");

  assert.ok(css, "base.css should exist");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /::selection/);
  assert.match(css, /color-scheme:\s*light/);
  assert.doesNotMatch(css, /transition:\s*all/);
});
