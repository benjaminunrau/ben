import type { ResolvedTheme } from "../config/load-site.ts";

/** "surfaceRaised" → "surface-raised" */
function kebab(name: string): string {
  return name.replaceAll(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** Flattens nested tokens into custom properties named by their path, e.g. `--typography-h1-font-size`. */
function flatten(value: unknown, prefix: string, into: Map<string, string>): Map<string, string> {
  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) flatten(child, `${prefix}-${kebab(key)}`, into);
  } else {
    into.set(prefix, String(value));
  }
  return into;
}

function declarations(properties: Map<string, string>): string {
  return [...properties].map(([name, value]) => `${name}: ${value};`).join(" ");
}

/**
 * The theme as CSS custom properties.
 *
 * Every token becomes `--<group>-<name>`; colors become `--color-<role>` inside a rule for each
 * color mode, selected by `data-color-mode` on the root element. Theme values are validated to
 * contain no characters that could end a declaration, rule, or the enclosing style element.
 */
export function themeStyleSheet(theme: ResolvedTheme): string {
  const tokens = flatten(theme.tokens, "-", new Map());
  const modes = Object.entries(theme.colorModes).map(
    ([mode, colors]) =>
      `:root[data-color-mode="${mode}"] { color-scheme: ${mode}; ${declarations(flatten(colors, "--color", new Map()))} }`,
  );
  return [`:root { ${declarations(tokens)} }`, ...modes].join("\n");
}

/** Names of every custom property {@link themeStyleSheet} defines. */
export function themePropertyNames(theme: ResolvedTheme): Set<string> {
  return new Set(themeStyleSheet(theme).match(/--[a-z0-9-]+(?=:)/g));
}
