# ADR 0005: Locale-specific static routes

## Status

Accepted — 2026-09-23.

## Context

Portfolio v1 originally replaced localized text in the browser after loading a single page. That made the selected language device-local, left the initial HTML in the default locale, and gave search engines no locale-specific documents.

## Decision

Generate one static document for each `site.supportedLocales` value at `/:locale/`. The root page continues to render `site.defaultLocale` as a compatibility entry point. Rendering receives an explicit locale; it does not read locale state from `localStorage` or mutate localized content after load.

The language selector derives its options from `site.supportedLocales` and navigates to the chosen locale route while preserving the current fragment. Framework UI text is canonical localized content under `site.ui` and must contain every configured locale.

## Consequences

- Each language has a shareable, crawlable URL and correct server-rendered document language, title, and description.
- Adding a locale requires translated content and UI text; schema validation rejects incomplete locale maps.
- The theme preference remains device-local because it is visual state rather than content locale.
- Canonical and `hreflang` metadata require a configured public site URL and remain a follow-up.

## Update — 2026-09-24

The canonical and `hreflang` follow-up is implemented: when `content/site-config.json` sets `publicUrl`, every page links its canonical locale route and all alternates plus `x-default` (the default locale). The root page is canonical to the default locale route.
