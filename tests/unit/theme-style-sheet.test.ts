import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileSystemReader } from "../../src/config/file-system-reader.ts";
import { loadSite } from "../../src/config/load-site.ts";
import { themePropertyNames, themeStyleSheet } from "../../src/themes/theme-style-sheet.ts";

const root = new URL("../..", import.meta.url).pathname;
const { theme } = loadSite(fileSystemReader(root));

/** Custom properties set at runtime by scripts rather than by the theme. */
const runtimeProperties = new Set(["--theme-transition-x", "--theme-transition-y", "--avatar-progress"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(astro|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("themeStyleSheet", () => {
  const css = themeStyleSheet(theme);

  it("names tokens by their path", () => {
    assert.match(css, /--spacing-section: 3rem;/);
    assert.match(css, /--typography-button-label-font-family: [^;]+;/);
    assert.match(css, /--motion-duration: 180ms;/);
  });

  it("defines the semantic colors once per color mode", () => {
    for (const mode of ["light", "dark"] as const) {
      const rule = css.match(new RegExp(`:root\\[data-color-mode="${mode}"\\] \\{([^}]*)\\}`))?.[1];
      assert.ok(rule, `no rule for ${mode}`);
      assert.match(rule, new RegExp(`color-scheme: ${mode};`));
      assert.match(rule, new RegExp(`--color-surface-raised: ${theme.colorModes[mode].surfaceRaised};`));
    }
  });

  it("stays inside its style element", () => {
    assert.doesNotMatch(css, /[<>]/);
  });

  it("defines every custom property the components use", () => {
    const defined = themePropertyNames(theme);
    const sources = new Map(sourceFiles(join(root, "src")).map((file) => [file, readFileSync(file, "utf8")]));
    // Component properties (e.g. Timeline's `--timeline-marker: …;`) are defined in a component and
    // may be used by that component's children.
    const componentDefined = new Set([...sources.values()].flatMap((source) => [...source.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1])));
    const undefinedUses = [...sources].flatMap(([file, source]) =>
      [...source.matchAll(/var\((--[a-z0-9-]+)/g)]
        .map((match) => match[1] ?? "")
        .filter((name) => !defined.has(name) && !runtimeProperties.has(name) && !componentDefined.has(name))
        .map((name) => `${name} in ${file.slice(root.length)}`),
    );
    assert.deepEqual(undefinedUses, []);
  });
});
