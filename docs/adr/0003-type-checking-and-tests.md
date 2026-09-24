# ADR 0003: Type checking with `astro check`, tests with `node:test`

- Status: accepted
- Date: 2026-09-23

## Context

The definition of done requires strict TypeScript and passing tests, but the project had neither a type-check command nor a test runner. The first `astro check` run reported 46 errors.

## Decision

- `npm run check` runs `astro check` (dev dependencies: `@astrojs/check`, `typescript`, `@types/node`). TypeScript 6 no longer loads `@types/*` automatically, so `tsconfig.json` lists `"types": ["node"]`.
- `npm test` runs Node's built-in test runner on `tests/**/*.test.ts` with type stripping. It adds no test dependency. Because Node strips types without compiling, source files that tests import must use explicit `.ts` import extensions and only erasable syntax (no `enum`, no constructor parameter properties).

## Alternatives considered

- **Vitest**: richer watch mode and reporting, and Astro offers `getViteConfig`. Adopt it when tests need Vite features (for example, rendering Astro components); until then the built-in runner is sufficient.

## Consequences

- Requires Node ≥ 22.12 (already the `engines` floor).
- Component rendering tests will need a different runner or Astro's container API.
