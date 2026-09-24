# ADR 0004: Client-side locale selection for Portfolio v1

## Status

Superseded by ADR 0005 — 2026-09-23.

## Context

The portfolio has complete English, Spanish, and German content. It is a single static page, and its existing selector stores the visitor's locale in `localStorage` and replaces localized text in place. Locale-specific routing and translated slugs remain open framework decisions.

## Decision

Keep one canonical route for Portfolio v1. The language selector derives its options from `site.supportedLocales`, restores the stored locale when it remains supported, and otherwise uses `site.defaultLocale`. Every localized content value must provide every configured locale, as enforced by the portfolio schema.

This decision was replaced when shareable, crawlable locale routes became a requirement.

## Consequences

- Locale selection is immediate and does not require duplicate pages or route state.
- The selected locale is device-local and is not part of a shareable URL.
- A future locale-routing design must preserve the same canonical locale codes and fallback rule, then add route and SEO tests before changing this behavior.
