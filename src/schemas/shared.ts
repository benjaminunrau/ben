import { z } from "astro/zod";

/** A locale list validated to be non-empty; the first entry has no special meaning. */
export type Locales = readonly [string, ...string[]];

export const nonEmptyText = z
  .string({ error: (issue) => (issue.input === undefined ? "is required" : "must be text") })
  .trim()
  .min(1, "must not be empty");

/** Stable, URL-safe identifier: lowercase letters/digits separated by single hyphens. */
export const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "must be a slug: lowercase letters and digits separated by single hyphens");

/** Canonical BCP 47 locale code such as "en" or "es-PY". */
export const localeCode = z.string().refine((value) => {
  try {
    return Intl.getCanonicalLocales(value)[0] === value;
  } catch {
    return false;
  }
}, 'must be a canonical BCP 47 locale code such as "en" or "es-PY"');

export const emailAddress = z.email("must be a valid email address");

/** Absolute https URL. Other schemes (http:, javascript:, data:, …) are rejected. */
export const safeExternalUrl = z.string().refine((value) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}, "must be an absolute https:// URL");

/** Root-relative path to a file served by this site, e.g. "/images/profile/face.png". */
export const sitePath = z
  .string()
  .regex(/^\/(?!\/)[^\s\\?#]*$/, 'must be a root-relative path such as "/images/photo.png" (no spaces, "?" or "#")')
  .refine((value) => !value.split("/").includes(".."), 'must not contain ".." segments');

/**
 * Image under `src/assets/`, such as "profile/face.png". Unlike `sitePath` files, these are
 * resized and converted at build time. Segments cannot start with "." so ".." is impossible.
 */
export const imagePath = z
  .string()
  .regex(
    /^[A-Za-z0-9_-][\w.-]*(?:\/[A-Za-z0-9_-][\w.-]*)*\.(?:png|jpe?g|webp|avif)$/i,
    'must be a path below src/assets/ to a .png, .jpg, .webp or .avif image, such as "profile/face.png"',
  );

/** Calendar month as "YYYY-MM". */
export const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'must be a month formatted as "YYYY-MM"');

/** Text translated into every supported locale. */
export function localizedText(locales: Locales) {
  return z.record(z.enum(locales), nonEmptyText);
}

/** Any value that must be provided once per supported locale. */
export function localized<T extends z.ZodType>(locales: Locales, value: T) {
  return z.record(z.enum(locales), value);
}

/** A translated list; every locale must have the same number of entries so entries correspond. */
export function localizedList(locales: Locales) {
  return z.record(z.enum(locales), z.array(nonEmptyText).min(1, "must contain at least one entry")).superRefine((value, ctx) => {
    const lengths = new Set(Object.values(value).map((entries) => entries.length));
    if (lengths.size > 1) {
      ctx.addIssue({
        code: "custom",
        message: `every locale must have the same number of entries (found ${Object.entries(value)
          .map(([locale, entries]) => `${locale}: ${entries.length}`)
          .join(", ")})`,
      });
    }
  });
}

/** An array whose entries carry an `id` that must be unique within the array. */
export function withUniqueIds<T extends z.ZodType<{ id: string }>>(entry: T) {
  return z.array(entry).superRefine((entries, ctx) => {
    const seen = new Set<string>();
    entries.forEach((value: { id: string }, index) => {
      if (seen.has(value.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: `duplicate id "${value.id}"` });
      }
      seen.add(value.id);
    });
  });
}
