# ADR 0002: Runtime validation with Zod (via `astro/zod`)

- Status: accepted
- Date: 2026-09-23

## Context

Canonical configuration and content are untrusted JSON. `INSTRUCTIONS.md` §13 asks for a schema-first TypeScript library with type inference, composition, descriptive errors and Astro compatibility, and left the choice OPEN. The previous loader cast parsed JSON with `as T`, so nothing was validated.

## Decision

Use Zod 4, imported from `astro/zod`. Astro already ships and re-exports it, so this adds no dependency and stays version-aligned with Astro's own content schemas.

- Schemas live in `src/schemas/`, one module per contract (`portfolio.ts`, `site-config.ts`, `theme.ts`), plus value objects in `shared.ts`.
- TypeScript types are inferred from the schemas (`z.output<…>`); no hand-written duplicate interfaces.
- Objects are strict: unknown keys are rejected, so typos and misplaced fields surface immediately.
- Localized fields are built from the supported locale list, so every translation is required and unknown locales are rejected.

## Alternatives considered

- **Valibot**: smaller bundles, but bundle size is irrelevant for build-time validation and it would be a new dependency.
- **JSON Schema + Ajv**: good for a future builder UI, but types would need generation. Zod 4 can emit JSON Schema (`z.toJSONSchema`) when that need arrives.

## Consequences

- Domain modules that validate data import `astro/zod`, a small, deliberate dependency on the `astro` package (not on Astro's runtime). If domain code must become Astro-free, depend on `zod` directly with the same version.
- Upgrading Astro may upgrade Zod; the schema tests catch behavioral changes.
