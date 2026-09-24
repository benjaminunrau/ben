import { z } from "astro/zod";
import { slug } from "./shared.ts";

/** A single CSS value. Characters that could end a declaration or rule are rejected. */
const cssValue = z
  .string()
  .trim()
  .min(1, "must not be empty")
  .regex(/^[^;{}<>\\]+$/, "must be a plain CSS value without ; { } < > or \\");

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/, 'must be a hex color such as "#1A2B3C"');

export const themeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: slug,
  tokens: z.strictObject({
    /** File name (without .json) of a color palette in themes/. */
    colorPalette: slug,
    /** File name (without .json) of a typography scale in themes/. */
    typography: slug,
    spacing: z.strictObject({
      pagePadding: cssValue,
      section: cssValue,
      contentGap: cssValue,
    }),
    shape: z.strictObject({ cardRadius: cssValue, controlRadius: cssValue, borderWidth: cssValue }),
    layout: z.strictObject({ contentWidth: cssValue, heroWidth: cssValue, gridMinColumnWidth: cssValue }),
    /** Reduced-motion preferences are always honored, so they are not a theme setting. */
    motion: z.strictObject({ duration: cssValue }),
  }),
  /** Closed sets of presentation alternatives that tokens cannot express. */
  variants: z.strictObject({
    /** "brand": each logo in its own colors on a light tile. "monochrome": all logos in the primary color. */
    skillIcons: z.enum(["brand", "monochrome"]),
  }),
});

/** Palette tokens the semantic color mapping needs; a palette may define more. */
const colorScheme = z
  .object({
    background: hexColor,
    surface: hexColor,
    "input-bg": hexColor,
    text: hexColor,
    "text-muted": hexColor,
    primary: hexColor,
    "on-primary": hexColor,
    accent: hexColor,
    border: hexColor,
    "focus-ring": hexColor,
  })
  .catchall(hexColor);

export const colorPaletteSchema = z.strictObject({
  schemaVersion: z.literal(1),
  light: colorScheme,
  dark: colorScheme,
});

const typographyStyle = z.strictObject({
  fontFamily: cssValue,
  fontSize: cssValue,
  lineHeight: z.union([z.number().positive(), cssValue]),
  fontWeight: z.union([z.number().int().min(1).max(1000), cssValue]),
  letterSpacing: cssValue,
});

export const typographySchema = z.strictObject({
  schemaVersion: z.literal(1),
  h1: typographyStyle,
  h2: typographyStyle,
  h3: typographyStyle,
  body: typographyStyle,
  small: typographyStyle,
  buttonLabel: typographyStyle,
});

export type Theme = z.output<typeof themeSchema>;
export type ColorScheme = z.output<typeof colorScheme>;
export type Typography = z.output<typeof typographySchema>;
