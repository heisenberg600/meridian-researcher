import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";

function readHexToken(css: string, token: string): string {
  const match = css.match(new RegExp(`${token}:\\s*(?:[^;#]*)(#[0-9a-f]{6})`, "i"));
  assert.ok(match?.[1], `${token} should use an opaque six-digit hex color`);
  return match[1];
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
    const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };

  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

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
    "--clay-50",
    "--clay-100",
    "--clay-600",
    "--clay-700",
    "--red-100",
    "--red-600",
    "--text-display-md",
    "--text-body-sm",
    "--text-caption",
    "--text-code",
    "--tracking-caps",
    "--tracking-display",
    "--radius-xl",
    "--shadow-md",
    "--shadow-sm",
    "--shadow-lg",
  ]) {
    assert.match(css, new RegExp(`${legacyToken}:`), `${legacyToken} should remain available during Portal migration`);
  }
  assert.doesNotMatch(css, /ui-estimates|c43e081f|_ds\//);
});

test("functional text and visible focus tokens meet WCAG contrast thresholds", async () => {
  const css = await readFile(new URL("./tokens.css", import.meta.url), "utf8");
  const surfaces = [readHexToken(css, "--canvas"), readHexToken(css, "--paper-soft"), "#ffffff"];
  const functionalText = [readHexToken(css, "--ink-faint"), readHexToken(css, "--warning")];

  for (const textColor of functionalText) {
    for (const surface of surfaces) {
      assert.ok(
        contrastRatio(textColor, surface) >= 4.5,
        `${textColor} should have at least 4.5:1 contrast against ${surface}`,
      );
    }
  }

  const focusColor = readHexToken(css, "--focus-ring");
  for (const surface of surfaces) {
    assert.ok(
      contrastRatio(focusColor, surface) >= 3,
      `${focusColor} should have at least 3:1 contrast against ${surface}`,
    );
  }
});

test("the application imports app-owned Meridian styles", async () => {
  const css = await readFile(new URL("../index.css", import.meta.url), "utf8");

  assert.match(css, /@import\s+["']\.\/styles\/tokens\.css["']/);
  assert.match(css, /@import\s+["']\.\/styles\/base\.css["']/);
  assert.doesNotMatch(css, /ui-estimates|c43e081f|_ds\//);
  assert.doesNotMatch(css, /--(?:foreground|card-foreground|popover-foreground):\s*var\(--text-body\)/);
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
// @vitest-environment node
