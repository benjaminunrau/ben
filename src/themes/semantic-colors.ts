import type { ColorScheme } from "../schemas/theme.ts";

/** Maps a palette's named tokens onto the semantic roles components use. */
export function toSemanticColors(scheme: ColorScheme) {
  return {
    background: scheme.background,
    surface: scheme.surface,
    surfaceRaised: scheme["input-bg"],
    foreground: scheme.text,
    muted: scheme["text-muted"],
    primary: scheme.primary,
    accent: scheme.accent,
    accentForeground: scheme["on-primary"],
    border: scheme.border,
    focus: scheme["focus-ring"],
  };
}

export type SemanticColors = ReturnType<typeof toSemanticColors>;
