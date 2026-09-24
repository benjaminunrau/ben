
# AGENTS.md

Authoritative repo guidance. Local AGENTS.md files may add detail but not weaken these constraints; most-specific wins. A local rule contradicting a core principle here = stop and surface the conflict.

MUST/MUST NOT=required. SHOULD=default, deviate only with reason. MAY=permitted. OPEN=unresolved — don't silently settle; record the smallest reversible choice or write an ADR.

## Current state

Early implementation: one real site (a professional portfolio) and no other fixtures yet, so no shared abstraction is proven. Single Astro 7 package at the repo root (ADR 0001).

- `content/` (portfolio content, site config) and `themes/` (theme, palette, typography): canonical JSON, each with `schemaVersion: 1`. Every modeled field is rendered or checked; don't add fields nothing reads.
- `src/schemas/`: Zod schemas, the source of truth for accepted data and inferred types (ADR 0002). `shared.ts`: value objects (slug, locale code, localized text/lists, https URL, site path, email). `contact.ts`: `ContactChannel` union (ADR 0008).
- `src/config/load-site.ts`: loader. Per file: read → parse → check version → validate; then resolve theme IDs to files, check cross-file references (navigation labels, section headings, contact channel IDs, public files), deep-freeze. Errors are `SiteLoadError` with kind `read`/`parse`/`unsupported-version`/`schema`/`resolution` and per-issue file + path. No migrations exist yet.
- `src/application/`: `localize.ts` (locale lookup, no silent fallback), `locale-routes.ts` (locale routes, canonical/`hreflang` links).
- `src/capabilities/contact-links.ts`: channel → safe link attributes and label.
- `src/assets/`: build-time images, referenced from content by `imagePath` ("profile/face.png") and resolved by `src/adapters/astro-images.ts` for `<Picture>` (AVIF/WebP, responsive). `public/` is for files served as-is (PDFs, icons).
- `src/themes/`: `semantic-colors.ts` (palette → color roles), `theme-style-sheet.ts` (theme → CSS custom properties, ADR 0006).
- `src/pages/`: `/` (default locale) and `/[locale]/` (ADR 0005). `src/components/`: `PortfolioPage` and its parts, each owning its scoped styles (`SiteControls` is placed in the navbar above 62rem and above the content below; CSS shows one); reusable patterns `Timeline`/`TimelineEntry`; `icons.ts` is the single icon registry; `src/styles/global.css` holds base styles only.
- `tests/unit/`: loader, schema, and helper tests. `tests/site/`: checks on the built HTML (ADR 0007).
- `index.html`, `old/`: legacy static site kept for reference; not part of the build.

Verify paths before assuming a directory from the target layout exists.

## Commands

Run from the repo root: `npm run dev` (for a background server: `npx astro dev --background`, then `astro dev stop|status|logs`), `npm run check` (strict types), `npm test` (`test:unit`, then `test:site`, which builds first), `npm run build`. All of check, test and build must pass before a change is done. Astro docs: https://docs.astro.build.

## What this is

Astro framework for content-driven showcase sites (menus, catalogues, portfolios, real estate, services) funneling visitors to an external action — call, email, WhatsApp, booking, purchase link. Not ecommerce/CMS; integrations may link to those, but that model must not leak into core.

## North star

Share real common infra; never blur real domain differences. Prefer several precise models over one flexible universal model when semantics differ. Make incorrect states hard to represent.

## Ubiquitous language

Domain=subject matter. Bounded context=boundary of consistent meaning. Domain entity=has identity (`Property`). Value object=defined by attributes (`Money`, `MediaAsset`). Configuration=how the site behaves; Content=what it presents. Capability=reusable cross-domain behavior. Preset=thin declarative defaults. Theme=presentation tokens only. Avoid vague `Item`/`Thing`/`Entry`.

## Modeling: no universal `Item`

Never model everything as one `Item`/`Entry` with unrelated optional fields (`price?`, `bedrooms?`, `calories?`) — it permits nonsense combinations and blurs terminology. Use precise entities (`MenuItem`, `Property`, `PortfolioProject`) sharing value objects where truly shared, never merged just because all render as cards. Pick deliberately: value object, capability, distinct entity, discriminated union, adapter, or separate bounded context.

Distinguish domain abstraction (Money, Address), application abstraction (loading, filtering), and presentation abstraction (Card, Gallery) — never infer the first from the third. Rule of three, heuristic not ritual: 1 case→implement plainly; 2→document similarity; 3→consider extracting.

## Layering & repo shape

Dependencies point inward: canonical data → parsing → schema validation → domain models → application services → presentation adapters → themes/components → Astro pages. Domain code MUST NOT depend on Astro/components/themes/browser APIs; Content Collection entries are loading infra, never models. Target layout: `domain/`, `application/`, `config/`, `schemas/`, `content/`, `adapters/`, `capabilities/`, `presets/`, `themes/`, `integrations/`, `components/{primitives,patterns,domain}/`, `fixtures/`, `tests/`.

## Configuration & data modeling

Canonical config: strictly serializable JSON — no functions/class instances/cycles/executable code/secrets; behavior via declarative identifiers, never callbacks. Load order: parse→validate version→migrate→validate structure→apply defaults→resolve IDs→freeze. Explicit schema version required; breaking changes need migration or rejection.

IDs stable, independent of titles; slugs URL-safe/deterministic/unique, never array-position. Optionality reflects real absence, never a fabricated placeholder. References validated; category membership by ID not label. Prefer `{amount,currency}` over pre-formatted strings when sortable/filterable.

## Internationalization

i18n is a core requirement, not a later presentation feature. Model it at the content/domain boundary with explicit locale codes, typed localized values (for example `LocalizedText`), a default locale, and a documented fallback policy. Decide which fields require translations and whether slugs, SEO metadata, actions, units, dates, currencies, sorting, and filtering are localized. Model locale-specific facts such as prices, availability, ingredients, or legal text explicitly rather than mixing them silently with translations. Validate locale references and required translations; keep translation keys stable and independent of displayed text.

## Presets, capabilities, adapters, themes

Presets = thin declarative metadata only, no routing/component copies/hidden logic/state; behavior belongs in a domain module, capability, or integration. Capabilities = reusable cross-domain behavior (pricing, availability, gallery), sharing only the truthful common part. Adapters = explicit, testable, no hidden I/O. Themes = tokens/variants only, never business state; semantic tokens, not domain-named ones.

## Components, actions, media, baseline quality

Typed semantic props, composition/slots over option bags, explicit variants for closed sets; cards may share presentation primitives without a universal `Item`. Favor static output; client JS needs concrete benefit. Actions = a discriminated serializable model (call/email/WhatsApp/booking/purchase/etc.) with validated URLs, normalized phone numbers, secure link attrs. Media: optimized responsive images with real alt text; required media fails the build, optional media degrades gracefully.

Accessibility (keyboard/focus, contrast, alt text, reduced motion, touch targets, ARIA only when needed) and mobile-first responsive design apply to every component. Security: never commit secrets, treat config/content as untrusted, reject unsafe URL schemes, sanitize raw HTML, never leak server-only env vars.

## Fixtures and feature placement

Maintain divergent fixtures (Restaurant, Creative portfolio, Real estate, Service business, Product catalogue) with edge cases — missing media, long titles, multi-currency, empty categories. A fixture forcing an unrelated optional field onto a shared entity is a modeling bug. Core schema/primitive/capability/adapter changes MUST be checked against relevant fixtures; one green fixture proves nothing.

Placement: stable cross-domain meaning→core primitive; one context's rules→bounded-context module; reusable behavior→capability; model translation→adapter; declarative defaults→preset; presentation-only→theme; external service→integration.

## Agent workflow

Before changing: identify bounded context + layer, classify the change, and check for a genuine existing abstraction. Prefer the smallest coherent change. Before done: run available type/test/build/schema/fixture checks; state exactly what could not run.

## Anti-patterns

Universal `Item` entity · optional-field explosion · Astro-collection-as-domain-entity · executable canonical config · preset mini-apps · presentation-driven modeling · theme owning business logic · speculative abstraction before real cases · hydrating static content by default · silent breaking schema changes · `utils`/`shared` as ownerless dumping grounds.

## OPEN decisions & definition of done

DECIDED (see `docs/adr/`): single package at repo root, npm (0001) · Zod via `astro/zod` (0002) · `astro check` + `node:test` (0003) · static route per locale, canonical/`hreflang` from `publicUrl` (0005, supersedes 0004) · scoped CSS over generated theme custom properties (0006) · tests against built HTML (0007) · contact channels as a discriminated union (0008).

OPEN: config schema/file org · content storage strategy · YAML support · theme/preset packaging · builder architecture · perf budgets · translated slugs · deployment target (`publicUrl` unset).

Done: strict-TS passes · Astro builds · tests pass · schemas validate accept+reject cases · config serializable+versioned · bounded contexts intact · presets thin/themes presentation-only · abstractions have fixture evidence · a11y/security considered · no needless client JS/deps · open decisions documented · skipped verification disclosed.
