/** Path of a locale's page (ADR 0005). */
export function localeRoute(locale: string): string {
  return `/${locale}/`;
}

export interface AlternateLink {
  /** A locale code, or "x-default" for visitors whose language matches none. */
  readonly hreflang: string;
  readonly href: string;
}

export interface LocaleSeoLinks {
  readonly canonical: string;
  readonly alternates: readonly AlternateLink[];
}

/**
 * Canonical and alternate-language URLs for a page rendered in `locale`.
 * The root page renders the default locale, so its canonical URL is the default locale's route.
 */
export function localeSeoLinks(publicUrl: string, locale: string, supportedLocales: readonly string[], defaultLocale: string): LocaleSeoLinks {
  const absolute = (path: string) => new URL(path, publicUrl).href;
  return {
    canonical: absolute(localeRoute(locale)),
    alternates: [
      ...supportedLocales.map((hreflang) => ({ hreflang, href: absolute(localeRoute(hreflang)) })),
      { hreflang: "x-default", href: absolute(localeRoute(defaultLocale)) },
    ],
  };
}
