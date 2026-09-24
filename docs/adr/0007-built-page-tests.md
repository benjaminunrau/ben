# ADR 0007: Tests against the built site

## Status

Accepted — 2026-09-24. Extends ADR 0003.

## Context

ADR 0004 required route and SEO tests before locale behavior changed, and ADR 0003 left component rendering tests open. Rendering `.astro` components needs Vite (Vitest or Astro's container API), which would add a runner and dependencies.

## Decision

`npm run test:site` builds the site and runs `node:test` suites in `tests/site/` against the static HTML in `dist/`. They check document-level facts that must hold for every generated route: document language, localized title and description, locale links, in-page link targets, and link security attributes. `npm test` runs `test:unit`, then `test:site`.

## Consequences

- No new dependency; tests exercise exactly what is deployed.
- `npm test` includes a production build (a few seconds).
- Assertions use regular expressions over HTML, which suits document-level facts but not component internals. Adopt Vitest with the container API if component-level rendering tests become necessary.
