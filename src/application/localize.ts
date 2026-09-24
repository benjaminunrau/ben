/**
 * Reads one locale's value out of a localized content value.
 *
 * Schema validation guarantees every supported locale is present, so there is no fallback:
 * a missing value means the caller passed an unsupported locale, which is a bug to surface.
 */
export function localize<T>(value: Readonly<Record<string, T>>, locale: string): T {
  const localized = value[locale];
  if (localized === undefined) {
    throw new Error(`No value for locale "${locale}" (available: ${Object.keys(value).join(", ")}).`);
  }
  return localized;
}

/** Binds {@link localize} to one locale, for templates that read many values. */
export function localizer(locale: string) {
  return <T>(value: Readonly<Record<string, T>>) => localize(value, locale);
}
