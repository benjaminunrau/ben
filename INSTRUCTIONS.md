# Repository Instructions for AI Coding Agents

This file is the authoritative repository-level guidance for AI coding agents and human contributors. Read it before changing the project. More specific instruction files in subdirectories MAY override this file within their documented scope, but local instructions must not silently weaken repository-wide architectural constraints.

When instructions conflict, follow the most specific applicable instruction. If a local instruction appears to contradict a core principle here, stop and surface the conflict rather than choosing the most convenient interpretation.

## Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **MAY**, and **OPEN** describe the strength of a rule:

- **MUST / MUST NOT**: required architectural or quality constraint.
- **SHOULD / SHOULD NOT**: strong default; deviations require a concrete reason.
- **MAY**: permitted, not required.
- **OPEN**: an unresolved decision. Do not treat it as settled without recording the decision.

## 1. Project overview

This project is an Astro-based framework for creating content-driven showcase websites. It supports sites that present structured information, products, services, work, listings, or media and guide visitors toward contact or an external action.

Representative uses include:

- restaurant and café menus;
- product catalogues;
- creative, model, photographer, artist, designer, and developer portfolios;
- service businesses;
- hotels and accommodations;
- real-estate and vehicle listings;
- florists, craftspeople, contractors, trainers, tour operators, and wedding vendors;
- other portfolio, catalogue, menu, gallery, directory, or contact-first sites.

The framework serves developers and contractors assembling such sites, clients supplying structured content, and future tools that generate valid configuration and domain data.

### Contact-first philosophy

The normal visitor journey is browse, evaluate, and act through a configured channel:

```text
Browse content -> View details -> Contact, book, navigate, inquire, or purchase externally
```

The action might be WhatsApp, phone, email, directions, a booking service, an inquiry form, a social profile, or an external purchase URL. No single channel is assumed to be universal.

### Deliberate non-goals

The framework is not, by default:

- an ecommerce engine;
- a payment processor;
- a shopping-cart or checkout system;
- an order, warehouse, or inventory-management platform;
- a customer-account system;
- a general-purpose CMS;
- a runtime application platform for arbitrary executable user configuration.

Integrations MAY link to external systems that provide those capabilities. Adding one integration must not pull its transactional model into the core.

## 2. Architectural north star

The framework MUST share genuinely common infrastructure without erasing meaningful domain differences.

> Abstract aggressively enough that genuine shared concepts have one coherent representation, but never abstract so aggressively that distinct domain concepts lose their meaning.

> Reuse behavior and presentation without forcing domain equivalence.

> The purpose of abstraction is to preserve clarity across multiple domains, not to maximize the percentage of code that is generic.

When choosing between one giant flexible model and several precise models sharing explicit primitives and capabilities, prefer the precise models when semantics differ. The design SHOULD make incorrect states difficult to represent. Extensibility MUST NOT be achieved primarily through dozens of unrelated optional fields.

## 3. Ubiquitous language

Use these terms consistently in code, schemas, documentation, and discussion.

| Term | Meaning |
| --- | --- |
| **Domain** | The subject matter represented by a site, such as menus, property listings, or portfolios. |
| **Bounded context** | A boundary within which domain terms and rules have precise, internally consistent meanings. |
| **Domain entity** | A meaningful domain concept with identity or continuity, such as a `Property` or `PortfolioProject`. |
| **Value object** | A value defined by its attributes rather than identity, such as `Money`, `Address`, or `MediaAsset`. |
| **Canonical data** | The normalized, versioned, strictly serializable representation accepted by the framework. |
| **Configuration** | Data controlling site or framework behavior, such as locale, theme selection, and enabled capabilities. |
| **Content** | Domain data presented by the site, such as dishes, properties, projects, or services. |
| **Domain module** | The model, validation, rules, and mappings belonging to one bounded context. |
| **Capability** | A coherent, reusable semantic or behavioral feature, such as pricing, gallery, location, or inquiry. |
| **Preset** | Thin declarative metadata and defaults that select and configure domain modules and capabilities for a use case. |
| **Theme** | Presentation rules and design tokens. A theme does not own domain behavior. |
| **Action** | A serializable description of something a visitor can do, such as call, email, navigate, book, or inquire. |
| **Integration** | A boundary to an external service or platform. |
| **Adapter** | A mapper between models at different boundaries, especially domain models and presentation contracts. |
| **Renderer** | Presentation code that turns a presentation model into output. |
| **Schema** | A machine-checkable public contract for accepted data. |
| **Fixture site** | A complete representative site used to pressure-test architecture, schemas, builds, and rendering. |
| **Astro Content Collection** | Astro infrastructure for loading and validating content; it is not automatically the domain model. |

Avoid vague terms such as `Item`, `Thing`, `Data`, `Object`, or `Entry` when a precise domain term exists. A generic term is acceptable only at a genuinely generic boundary and SHOULD be qualified where possible.

## 4. Lightweight Domain-Driven Design

Use DDD to clarify language, ownership, and boundaries, not to impose ceremony. The project does not require elaborate aggregate hierarchies, repositories, factories, or service layers unless real domain behavior warrants them.

Before creating or changing a model, determine:

1. Which bounded context owns the concept?
2. What does the term mean inside that context?
3. Is its identity or value shared semantically, or does only its UI look similar?
4. Which rules belong with the domain and which belong to loading, orchestration, or presentation?
5. Where must translation occur?

Similar-looking data is not necessarily the same domain concept. Shared presentation does not imply shared domain semantics.

### Likely bounded contexts

Initial or future contexts may include:

- Menu;
- Catalogue;
- Portfolio;
- Property Listing;
- Services;
- Accommodation;
- Vehicle Listing.

They MAY share media, money, contact actions, navigation, localization, metadata, filtering mechanics, or SEO infrastructure. Their entities remain separate when their meanings and invariants differ.

## 5. Prevent the universal-`Item` problem

The domain MUST NOT be designed as one universal hierarchy in which every concept is a collection of `Item` values with unrelated optional fields.

Do not create this:

```ts
interface Item {
  name: string;
  price?: Money;
  bedrooms?: number;
  calories?: number;
  mileage?: number;
  ingredients?: string[];
  projectCredits?: string[];
  durationMinutes?: number;
}
```

This model permits meaningless combinations, weakens validation, obscures terminology, and makes every new domain pollute existing ones.

Prefer precise models:

```ts
interface MenuItem {
  id: MenuItemId;
  name: string;
  description?: string;
  price?: Money;
  dietaryInformation: DietaryAttribute[];
  availability?: Availability;
}

interface Property {
  id: PropertyId;
  title: string;
  askingPrice?: Money;
  location: Address;
  bedrooms?: number;
  area?: Area;
  status: PropertyStatus;
}

interface PortfolioProject {
  id: ProjectId;
  title: string;
  description?: string;
  media: MediaAsset[];
  credits: ProjectCredit[];
  completedOn?: string;
}
```

The models MAY share `Money` and `MediaAsset`. They MAY map into a shared card presentation model. They MUST NOT become the same entity simply because all three can be displayed in a grid.

### Choosing a reuse mechanism

Use:

- a **shared primitive/value object** when meaning and rules are genuinely the same;
- a **capability** when reusable semantics or behavior can be composed into multiple contexts;
- a **domain-specific entity** when meaning, required fields, or invariants differ;
- a **discriminated union** when a closed set of variants shares a meaningful contract;
- an **adapter** when several domain models need a common application or presentation shape;
- separate **bounded contexts** when the same word has materially different meanings or rules.

Do not add unrelated optional properties to an existing shared type merely to accommodate a new fixture.

## 6. Three kinds of abstraction

Agents MUST distinguish these forms of reuse:

### Domain abstraction

Represents genuinely shared meaning and invariants. Examples include `Money`, `Address`, `MediaAsset`, `ExternalUrl`, and perhaps `Availability` when its semantics are truly common.

### Application/framework abstraction

Represents shared orchestration or behavior: loading configuration, filtering, sorting, generating metadata, resolving actions, composing schemas, or selecting renderers.

### Presentation abstraction

Represents reusable UI structure: `Card`, `Gallery`, `Grid`, `Hero`, `Button`, or `Navigation`.

Do not infer a domain abstraction from a presentation abstraction. A `MenuItem`, `Property`, and `PortfolioProject` can all use `MediaCard` without sharing a parent `Item` entity.

### Evidence-based abstraction

Before introducing a major abstraction, seek cross-domain evidence:

- one case: implement it clearly;
- two cases: document the similarity and keep boundaries visible;
- three sufficiently different cases: consider extracting a stable abstraction.

This rule of three is a heuristic, not a ritual. Semantically obvious value objects such as `Money` or validated URLs need not be duplicated first. Conversely, three visually similar components do not prove shared domain semantics.

## 7. Architectural layers and dependency direction

The conceptual flow is:

```text
Canonical serialized data
        |
Loading and parsing
        |
Runtime schema validation
        |
Domain models
        |
Application/framework services
        |
Presentation adapters and view models
        |
Themes and components
        |
Astro pages and routes
```

Dependencies SHOULD point inward toward stable semantics:

- domain modules MUST NOT depend on Astro merely for convenience;
- domain models MUST NOT depend on components, themes, routes, or browser APIs;
- application services MAY depend on domain contracts, not concrete page layouts;
- adapters MAY depend on their source domain and target presentation contract;
- components SHOULD consume semantic props or presentation models;
- Astro pages compose loading, application behavior, adapters, and presentation;
- infrastructure implements contracts and performs technology-specific work.

Cross-layer imports that reverse this direction require justification and usually indicate misplaced code.

## 8. Proposed repository organization

Start with the smallest structure that expresses real responsibilities. Add directories only when their boundary is used.

```text
/
├── INSTRUCTIONS.md
├── README.md
├── astro.config.*
├── package.json
├── tsconfig.json
├── docs/
│   ├── architecture/
│   └── adr/
├── fixtures/
│   ├── restaurant/
│   ├── creative-portfolio/
│   ├── real-estate/
│   ├── services/
│   └── product-catalogue/
├── public/
├── src/
│   ├── domain/
│   │   ├── shared/
│   │   ├── menu/
│   │   ├── portfolio/
│   │   ├── property-listing/
│   │   ├── services/
│   │   └── catalogue/
│   ├── application/
│   ├── config/
│   ├── schemas/
│   ├── content/
│   ├── adapters/
│   ├── capabilities/
│   ├── presets/
│   ├── themes/
│   ├── integrations/
│   ├── components/
│   │   ├── primitives/
│   │   ├── patterns/
│   │   └── domain/
│   ├── layouts/
│   ├── pages/
│   ├── styles/
│   ├── assets/
│   ├── utils/
│   └── types/
└── tests/
    ├── unit/
    ├── integration/
    ├── accessibility/
    └── build/
```

Important boundaries:

- `domain/` owns terminology, entities, value objects, and domain validation independent of Astro.
- `domain/shared/` is deliberately small. Admission requires genuinely shared semantics, not convenience.
- `application/` coordinates use cases without owning rendering or infrastructure details.
- `config/` loads, normalizes, resolves defaults, and migrates canonical configuration.
- `schemas/` contains composable public data contracts. Organize by ownership rather than creating one schema dump.
- `content/` contains or loads domain content. Its storage layout is not itself a domain model.
- `adapters/` protects boundaries between domain, application, integrations, and presentation.
- `capabilities/` contains reusable behavior whose semantics span contexts. It is not a miscellaneous utilities folder.
- `presets/` contains thin declarative definitions only.
- `themes/` contains presentation tokens and variants, never business rules.
- `integrations/` isolates external services.
- `components/primitives/` contains low-level visual building blocks; `patterns/` contains composed UI patterns; `domain/` contains context-aware renderers.
- `fixtures/` contains complete divergent sites and their expected build behavior.

The repository is a single package at the root (ADR 0001, `docs/adr/0001-single-package-layout.md`); canonical data currently lives in root-level `content/` and `themes/`. The directory structure inside `src/` stays **OPEN** until implementation pressure confirms it. Do not create every directory in advance. Preserve the responsibility boundaries even if a smaller repository initially co-locates files.

## 9. Canonical configuration

Canonical configuration MUST be strictly serializable data. JSON is the preferred initial interchange format.

```json
{
  "version": 1,
  "site": {
    "name": "Example Studio",
    "locale": "es-PY",
    "canonicalUrl": "https://example.test"
  },
  "preset": "creative-portfolio",
  "theme": {
    "id": "editorial",
    "variant": "light"
  },
  "features": {
    "gallery": true
  },
  "actions": [
    {
      "id": "primary-contact",
      "type": "email",
      "address": "hello@example.test"
    }
  ]
}
```

Canonical configuration MUST NOT contain:

- functions, closures, callbacks, or arbitrary expressions;
- class instances, symbols, or cyclic objects;
- imported components or modules;
- dates or other runtime objects that lose meaning in JSON;
- executable JavaScript or TypeScript;
- secrets.

Behavior MUST be selected through validated declarative identifiers. For example, `{ "type": "whatsapp", "phone": "+595..." }` is allowed; `action: () => window.open(...)` is not.

### Loading and normalization

The loader SHOULD perform this sequence:

1. Parse the authoring format.
2. Validate the declared configuration version.
3. Migrate supported older versions when necessary.
4. Validate structure and values.
5. Apply documented defaults.
6. Resolve identifiers against known presets, themes, capabilities, and integrations.
7. Produce an immutable or treated-as-immutable normalized configuration.

Parsing errors, schema errors, migration errors, and unknown identifiers MUST be distinguishable and actionable.

### Required and optional fields

- Required fields MUST represent information without which behavior would be ambiguous or invalid.
- Optional fields SHOULD have a documented default or clearly documented absence behavior.
- Defaults SHOULD be applied in one normalization boundary, not scattered across components.
- A field MUST NOT become optional solely to allow unrelated domain shapes into one schema.

### Versioning and migration

- Canonical configuration MUST carry an explicit schema version.
- Breaking changes MUST define a migration path or clearly reject unsupported versions.
- Migrations MUST be deterministic, testable, and operate on serializable data.
- Deprecations SHOULD be documented before removal when practical.
- Silent reinterpretation of existing fields is prohibited.

### Environment-specific values and secrets

Environment variables MAY supply deployment-specific or secret values, but canonical configuration SHOULD refer to them through explicit, validated mechanisms if needed. Do not interpolate arbitrary environment values throughout the domain or component layers. Secrets MUST NOT be serialized into public site data or committed.

### JSON and future YAML support

JSON is canonical. YAML MAY later be supported as an authoring or interchange format only if it normalizes to the same canonical data, preserves semantics, and disables unsafe executable features or custom object construction.

## 10. Configuration is not domain content

Configuration describes how the site behaves. Domain content describes what the site presents.

Examples of configuration:

- locale and currency defaults;
- selected theme and variant;
- enabled filters;
- default action placement;
- selected preset and capabilities;
- navigation behavior.

Examples of domain content:

- a dish and its dietary properties;
- a property and its location;
- a portfolio project and credits;
- a service package;
- a catalogue product and specifications.

Do not place all content into one enormous site configuration merely because JSON can contain it. Content MAY live in JSON, Markdown, a database, or another source, but it MUST cross validation and mapping boundaries before application use.

## 11. Content and domain models

Each bounded context SHOULD model concepts in its own language and enforce useful invariants.

### Identity and slugs

- Persistent domain identifiers SHOULD be stable and independent of display titles.
- Slugs SHOULD be URL-safe, deterministic where generated, and unique within their routing scope.
- Do not use array positions as identity.
- A slug MAY differ from a domain ID; document the relationship.

### Optional data

Optionality must reflect real domain absence. A portfolio project and a property listing MAY have no price. Do not fabricate zero prices or empty values to satisfy a presentation contract.

### Relationships and ordering

- References between entities MUST be validated.
- Category membership SHOULD use stable IDs rather than display labels.
- Ordering SHOULD be explicit when editorial order matters; otherwise define a deterministic fallback.
- Featured status, availability, and publication status SHOULD be modeled according to the owning context rather than forced into a universal flag set.

### Structured values

Preserve semantics in data and format near presentation boundaries. Prefer:

```json
{ "amount": 18000, "currency": "PYG" }
```

over:

```json
{ "price": "Gs. 18.000" }
```

when the value participates in sorting, filtering, structured data, or locale-aware display. Human-authored display strings MAY be appropriate when exact editorial text matters; make that decision explicit.

## 12. Astro Content Collections boundary

Astro Content Collections are infrastructure for discovering, parsing, and initially validating content. They MUST NOT automatically define the domain model.

The intended relationship is:

```text
Markdown, JSON, CMS, or Astro collection entry
                    |
        source-specific parsing/schema
                    |
             adapter/mapper
                    |
         domain entity or value object
```

Astro collection schemas and domain schemas MAY overlap, but equivalence must be deliberate. Source schemas may include frontmatter, file paths, loader metadata, or Astro-specific representations that do not belong in domain code.

Rules:

- Domain modules MUST NOT import Astro types unless a documented exception is unavoidable.
- Astro-specific objects SHOULD be converted at the infrastructure boundary.
- Application tests SHOULD be able to construct domain objects without initializing Astro.
- Alternative content sources SHOULD be possible through new adapters without rewriting domain behavior.
- Route conventions and filesystem paths MUST NOT become accidental domain invariants.

## 13. Schema strategy

Schemas are a public contract. Treat a schema change with the same care as an API change.

### Single source of truth

- Runtime schemas SHOULD be the source from which TypeScript input types are derived when the selected validation library supports reliable inference.
- Domain types MAY be distinct from input types when normalization, branding, or richer invariants justify the distinction.
- Do not hand-maintain duplicate schema and type definitions that can drift.
- Do not conflate raw input, normalized canonical data, and validated domain objects merely to reduce the number of names.

### Composition

Compose schemas from genuine value objects and bounded-context contracts. Avoid a shared base schema that accumulates unrelated optional fields. Discriminated unions SHOULD use an explicit discriminator and validate each variant precisely.

### Errors

Validation errors MUST identify, where available:

- source file or record;
- JSON path or field;
- expected constraint;
- received value category, without leaking secrets;
- bounded context or schema version;
- suggested remediation.

### Compatibility

- Additive optional fields are usually compatible but still require defaults and fixture coverage.
- New required fields, changed meanings, removed variants, and stricter constraints are potentially breaking.
- Breaking changes require versioning and a migration or an explicit unsupported-version error.

### Validation library

**Decided (ADR 0002):** Zod 4, imported from `astro/zod`. Schemas live in `src/schemas/` and are the source of inferred TypeScript types. Objects are strict (unknown keys are rejected), and localized fields require every supported locale.

## 14. Presets are thin declarative metadata

A preset makes a common use case convenient by selecting and configuring existing domain modules, capabilities, terminology, defaults, suggested layouts, actions, and structured-data strategies.

Example shape:

```json
{
  "id": "restaurant",
  "label": "Restaurant",
  "domainModules": ["menu"],
  "defaultCapabilities": ["pricing", "availability", "opening-hours"],
  "suggestedActions": ["directions", "phone", "whatsapp"],
  "terminology": {
    "primaryCollection": "Menu",
    "primaryEntity": "Dish"
  },
  "suggestedLayout": "catalogue"
}
```

Presets MAY provide:

- identifiers, labels, and terminology;
- declarative defaults;
- recommended domain modules and capabilities;
- schema-composition references;
- suggested layouts and actions;
- default SEO or structured-data mappings.

Presets MUST NOT own:

- duplicated routing systems;
- private application architectures;
- entire copies of shared components;
- hidden domain logic;
- hooks, services, and state that make them independent mini-apps;
- executable configuration.

If a preset needs substantial domain behavior, create or extend an explicit bounded-context domain module. If it needs an external service, use an integration. If it changes visuals, use a theme or presentation variant.

### Adding a preset

1. Identify the bounded contexts and capabilities it composes.
2. Confirm those modules have appropriate schemas and adapters.
3. Add only declarative metadata and defaults.
4. Add or extend a divergent fixture site.
5. Verify that the preset did not duplicate components or push domain-specific fields into the core.
6. Document terminology and any deliberate deviations.

## 15. Capability model

A capability represents reusable semantics or behavior that can be composed into more than one domain without erasing domain ownership. Candidates include pricing, availability, gallery, location, booking, inquiry, filtering, opening hours, or external purchase.

A capability SHOULD have:

- a precise definition;
- an owner and boundary;
- a small contract;
- documented participating contexts;
- validation and behavior that remain coherent across those contexts;
- adapters where domain-specific representations differ.

A capability MUST NOT become another universal dumping ground. For example, `availability` for a restaurant dish, hotel room, and real-estate listing may have different meanings. Share only the common part that remains truthful; otherwise use context-specific models and presentation adapters.

## 16. Adapter strategy

Adapters translate between boundaries so that reuse does not reshape domain models.

```text
Property          -> ListingCardModel
MenuItem          -> MenuCardModel
PortfolioProject  -> GalleryCardModel
```

These view models may in turn compose shared visual primitives. If several adapters target a small common contract, that contract belongs to the presentation layer, not automatically to the domain.

Adapters SHOULD:

- be explicit and easy to test;
- avoid hidden I/O;
- preserve meaningful absence rather than inventing placeholder domain data;
- perform formatting only when targeting presentation;
- isolate external and Astro-specific representations;
- fail clearly when required mapping information is missing.

Do not create adapters whose only purpose is hiding an incoherent core model. Fix the owning model when the problem is within one boundary.

## 17. Theme system

Themes primarily control presentation.

Themes MAY define:

- typography and font stacks;
- spacing, radii, borders, and shadows;
- colors and contrast-safe palettes;
- card, navigation, gallery, and hero variants;
- design tokens and CSS custom properties;
- responsive presentation behavior;
- motion preferences and visual density.

Themes MUST NOT contain:

- domain entities or validation rules;
- business decisions such as whether a property is available;
- content-loading logic;
- preset selection;
- integration credentials or network calls;
- routing rules based on business state.

Theme contracts SHOULD be expressed through stable semantic tokens such as `--color-accent` rather than domain-specific tokens such as `--restaurant-red`. Content and preset changes should not require rewriting a theme.

## 18. Astro component architecture

Components SHOULD be small enough to have one coherent responsibility and large enough to express a useful unit. Do not split markup into abstractions without reuse or conceptual value.

### Props and composition

- Props MUST be typed.
- Props SHOULD express semantic intent, not expose internal implementation details.
- Prefer composition and slots to enormous option bags.
- Use explicit variants for a small, closed set of visual differences.
- Do not add domain fields to a generic component solely because one context needs them.
- Context-specific components MAY adapt domain entities into shared primitives.

### Reusable cards do not imply reusable entities

`PropertyCard`, `MenuCard`, and `ProjectCard` may share `Card`, `MediaFrame`, or `ActionGroup`. They need not consume one domain `Item` type. The adapter or domain renderer decides how each entity maps to presentation.

### Hydration and interactivity

- Favor Astro's static and server-rendered output.
- Client-side JavaScript MUST have a concrete user benefit.
- Use the least costly hydration directive that satisfies the interaction.
- Do not hydrate static navigation, cards, accordions, or galleries merely because a library component exists; prefer HTML and CSS when sufficient.
- Keep interactive islands narrow and independent.
- Server-only and browser-only code MUST remain clearly separated.

### Accessibility

Every component is responsible for its accessible semantics, states, and keyboard behavior. Accessibility is not a final wrapper or optional audit.

## 19. Contact and action model

Actions MUST use a generic, serializable, discriminated model rather than hard-coded channel assumptions throughout components.

Illustrative input:

```ts
type Action =
  | { id: string; type: 'whatsapp'; phone: string; message?: string }
  | { id: string; type: 'phone'; phone: string }
  | { id: string; type: 'email'; address: string; subject?: string }
  | { id: string; type: 'directions'; url: SafeExternalUrl }
  | { id: string; type: 'booking'; url: SafeExternalUrl }
  | { id: string; type: 'purchase'; url: SafeExternalUrl }
  | { id: string; type: 'social'; platform?: string; url: SafeExternalUrl }
  | { id: string; type: 'inquiry'; target: string }
  | { id: string; type: 'external-link'; label: string; url: SafeExternalUrl };
```

The final contract may differ, but it MUST remain serializable, validate each variant, and use declarative identifiers. Rendering MAY vary by context: the same action can appear as a primary button, icon link, card action, or contact list entry.

Rules:

- Normalize phone numbers while preserving appropriate display formatting.
- Validate URL schemes and reject dangerous protocols.
- Encode prefilled messages and query parameters safely.
- External links opening a new browsing context MUST use appropriate security attributes.
- Labels MUST remain localizable and meaningful without relying only on icons.
- Channel-specific behavior SHOULD be isolated in resolvers or adapters.

## 20. Integrations

An integration isolates an external platform or service. It SHOULD expose a narrow internal contract and keep vendor concepts at the edge.

- Integration identifiers and public settings MAY appear in serializable configuration.
- Credentials MUST come from secure environment-specific storage.
- Network failures SHOULD degrade predictably when the integration is optional.
- Build-time integrations SHOULD support deterministic failure messages and, where appropriate, caching.
- Third-party scripts MUST be justified for privacy, performance, accessibility, and user value.
- Removing an integration SHOULD not require rewriting unrelated domain models.

## 21. Media and images

Media is a first-class concern because showcase sites are often image-heavy. `MediaAsset` is a candidate shared value object, subject to cross-domain validation.

A media model SHOULD capture only meaningful shared data, potentially:

- source or asset identifier;
- media kind;
- intrinsic dimensions or aspect ratio;
- alt text or explicit decorative intent;
- caption and credit;
- focal point where supported;
- local versus approved external source;
- derived thumbnail or responsive variants at infrastructure boundaries.

Requirements:

- Use Astro image optimization for eligible local assets.
- Provide responsive `srcset`/sizes appropriate to layout.
- Reserve intrinsic space to prevent layout shift.
- Lazy-load below-the-fold images; do not defer the likely largest contentful image without reason.
- Avoid downloading oversized originals for thumbnails.
- Galleries MUST be keyboard-accessible if interactive.
- Every informative image MUST have meaningful alt text; decorative images MUST be marked appropriately.
- Do not repeat adjacent visible captions verbatim as alt text when it adds no value.
- External image hosts require explicit configuration and safe handling.

Missing required media SHOULD produce an actionable build or validation error. Optional media SHOULD have a deliberate presentation fallback rather than a broken image.

## 22. Money, locale, addresses, and formatting

`Money`, `Locale`, `Address`, and `ContactMethod` may be shared value objects when their semantics and validation are stable.

- Store money as amount plus ISO currency when semantic operations are required.
- Define whether monetary amounts use major or minor units; never leave this implicit.
- Use locale-aware number, currency, and date formatting near presentation boundaries.
- Do not parse formatted display strings back into domain values.
- Preserve address structure only to the level justified by supported locales and actions.
- Treat phone numbers, postal addresses, and names as international data; avoid country-specific assumptions in core primitives.

## 23. Accessibility requirements

All public components and fixture sites MUST consider:

- semantic landmarks and heading hierarchy;
- keyboard navigation and logical focus order;
- visible focus states;
- skip navigation where repeated navigation warrants it;
- accessible names for controls and icon-only links;
- form labels, descriptions, errors, and status messages;
- sufficient color contrast in every supported theme;
- meaningful alt text and decorative-image handling;
- reduced-motion preferences;
- touch target size and spacing;
- navigation menus that expose state correctly;
- non-color cues for meaning;
- language metadata;
- ARIA only when native HTML cannot provide the semantics.

Interactive components SHOULD be tested with keyboard-only use and automated accessibility checks. Automated checks do not replace semantic review.

## 24. Responsive design

Use a mobile-first approach. Restaurant menus, catalogues, portfolios, and contact-first experiences are often opened on phones.

- Navigation MUST remain operable on small screens and with long translated labels.
- Grids SHOULD adapt based on available space rather than device names alone.
- Typography SHOULD use readable fluid or stepped scales with controlled line length.
- Images MUST not overflow their containers.
- Touch targets SHOULD remain comfortably operable.
- Primary actions SHOULD remain discoverable without obscuring content.
- Long names, prices, descriptions, URLs, and unbroken text MUST wrap or truncate deliberately.
- Do not rely on hover for essential information.
- Test narrow, medium, and wide layouts, including content expansion rather than only ideal sample strings.

## 25. Performance

Performance is a design constraint, not a late optimization.

- Prefer static HTML and CSS.
- Ship no client JavaScript for static behavior.
- Keep Astro islands small and hydrate only when needed.
- Optimize image dimensions, formats, priority, and loading.
- Limit font families, weights, and blocking requests; prefer robust fallbacks.
- Avoid broad client frameworks or component libraries for isolated interactions.
- Scope CSS and remove unused global rules without fragmenting shared tokens.
- Audit third-party scripts for necessity, privacy, loading strategy, and failure behavior.
- Avoid layout shifts and long main-thread work.
- Establish measurable performance budgets once representative fixtures exist.

**OPEN:** exact bundle, image, font, and Core Web Vitals budgets.

## 26. SEO and structured data

Every public page SHOULD support:

- a unique, meaningful title;
- a useful meta description;
- a canonical URL where appropriate;
- Open Graph and relevant social-preview metadata;
- index/noindex intent;
- sitemap inclusion rules;
- accessible, crawlable navigation;
- stable item or category URLs when those pages exist.

Structured data SHOULD map from validated domain models through context-specific adapters. Do not bloat the core with every Schema.org type. A restaurant, property, service, and creative-work mapping may share metadata infrastructure while retaining separate domain-specific mappings.

Metadata generation MUST escape content correctly and avoid emitting false or incomplete claims. Missing optional metadata should degrade deliberately.

## 27. Internationalization

The first release need not implement a full translation platform, but architecture MUST prevent hard-coded language and locale assumptions from spreading.

- Configuration SHOULD declare a locale and MAY declare fallback locales.
- User-facing framework labels SHOULD come from a centralized, typed vocabulary or translation boundary.
- Domain-authored content and framework UI labels SHOULD remain distinguishable.
- Use locale-aware currency, number, and date formatting.
- Multi-locale routing is decided: one static route per locale (ADR 0005). Slug localization remains **OPEN**.
- CSS and layout SHOULD avoid assumptions that block future right-to-left support.
- Do not build a complex translation workflow until real requirements establish content ownership and fallback behavior.

## 28. Styling conventions

**Decided (ADR 0006):** plain CSS; scoped styles in the component that renders the markup, document-wide foundations in `src/styles/global.css`, and theme tokens exposed as CSS custom properties generated from the resolved theme. These requirements still apply:

- Define design tokens centrally, preferably through semantic CSS custom properties.
- Separate global foundations from component-specific styles.
- Use responsive units where appropriate.
- Avoid hard-coded colors and spacing scattered through components.
- Avoid unexplained magic numbers; local, purposeful values are acceptable.
- Theme overrides SHOULD operate through documented tokens or variants.
- Styles MUST preserve focus visibility, reduced-motion preferences, contrast, and content reflow.
- Avoid styling APIs that require domain models to contain visual implementation details.

## 29. TypeScript conventions

- Enable and preserve strict TypeScript checking.
- Avoid `any`; use `unknown` plus validation or narrowing at untrusted boundaries.
- Derive input types from runtime schemas where reliable.
- Keep raw input types, normalized configuration types, domain types, and presentation models distinct when their contracts differ.
- Use discriminated unions for meaningful closed variants.
- Handle `null` and `undefined` intentionally; do not use both interchangeably without a convention.
- Export only types that form a supported boundary.
- Prefer readonly data for normalized configuration and immutable value objects where practical.
- Avoid unsafe type assertions that bypass validation.
- Branded IDs MAY prevent cross-context identity mistakes if the benefit exceeds complexity.

## 30. Naming conventions

- Astro component files: `PascalCase.astro`.
- TypeScript modules: use the repository's established convention; until established, prefer descriptive `kebab-case.ts` filenames.
- Types, interfaces, components, and classes: `PascalCase`.
- Variables and functions: `camelCase`.
- Constants: use `camelCase` unless a true process-wide constant is clearer as `UPPER_SNAKE_CASE`.
- Schema values: suffix with `Schema` when it prevents ambiguity, such as `propertySchema`.
- Domain entities: use precise singular nouns such as `Property` or `MenuItem`.
- Collections: use precise plural nouns such as `properties` or `menuItems`.
- IDs: qualify by context in types and external contracts where confusion is possible.
- Slugs: lowercase, URL-safe, stable, and hyphen-separated by default.
- CSS custom properties: semantic, lowercase, and hyphenated, such as `--space-section`.

Names SHOULD describe domain meaning rather than one current visual arrangement. Avoid `LeftCardThing` and also avoid overgeneric `ItemData` when `PropertySummary` is accurate.

## 31. Error handling

Distinguish error categories so developers know where to act:

- **Parse error:** source is not valid JSON, YAML, Markdown, or other accepted syntax.
- **Schema error:** parsed input violates its declared data contract.
- **Domain validation error:** structurally valid input violates a domain invariant.
- **Resolution error:** preset, theme, capability, integration, or reference is unknown.
- **Migration error:** a version cannot be upgraded deterministically.
- **Integration error:** an external boundary failed.
- **Rendering error:** valid application data cannot be rendered as expected.

Errors intended for developers MUST identify the relevant file or record, field path, context, and corrective action where possible.

Behavior guidelines:

- Invalid required configuration MUST fail early.
- Unknown presets and themes MUST fail with available alternatives when practical.
- Broken references MUST identify both source and target IDs.
- Malformed or unsafe URLs MUST be rejected before rendering.
- Optional missing content SHOULD produce a documented fallback or omission.
- Missing required images or renderers SHOULD fail during validation or build rather than silently producing broken output.
- Do not catch and discard errors merely to keep a build green.

## 32. Testing philosophy

Tests should provide confidence in public contracts, domain rules, boundaries, and representative output. Avoid tests coupled to incidental markup or internal implementation when they do not protect behavior.

Priorities:

1. Schema acceptance and rejection tests.
2. Configuration parsing, defaulting, migration, and strict-serialization tests.
3. Domain invariant tests.
4. Adapter mapping tests, especially absence and formatting edge cases.
5. Fixture-site build tests.
6. Accessibility checks for shared and interactive components.
7. Integration contract tests at external boundaries.
8. Focused component tests where behavior is nontrivial.
9. Regression tests for reproduced defects.

At least one test SHOULD confirm that canonical configuration survives a JSON round trip without semantic loss. Tests SHOULD include invalid references, unknown discriminators, missing required fields, and representative optional content.

## 33. Fixture sites are architecture tests

Fixture sites are not merely demos or marketing examples. They are pressure tests that prevent the first use case from defining the whole framework.

Maintain several deliberately different fixtures:

| Fixture | Architectural pressure |
| --- | --- |
| Restaurant/café | Categories, prices, dietary data, opening hours, availability, contact-first ordering. |
| Creative portfolio | Media-heavy projects, galleries, credits, editorial layouts, little or no pricing. |
| Real estate | Strongly structured attributes, location, price, status, filtering, inquiry. |
| Service business | Services, packages, optional pricing, booking/contact actions, long-form descriptions. |
| Product catalogue | Categories, variants/specifications, optional availability, external inquiry or purchase. |

Fixtures SHOULD contain realistic edge cases: missing optional media, long titles, multiple currencies or locales where supported, empty categories, varied action sets, and enough content to exercise navigation and pagination/filtering decisions.

If adding a fixture requires unrelated optional fields on a universal entity, that discomfort is architectural evidence. Reconsider the model rather than hiding the problem.

### Requirements for core changes

An agent changing a core schema, shared primitive, capability, configuration contract, adapter contract, or major UI primitive MUST inspect and run the relevant divergent fixtures. A single green restaurant fixture is not evidence of a universal abstraction.

## 34. Schema and core stability criteria

Do not declare a core schema or abstraction stable until it has survived multiple meaningfully different fixtures.

Before stabilization:

1. Implement or model at least the restaurant, creative portfolio, real-estate, service, and product-catalogue fixtures, unless an ADR justifies a different divergent set.
2. Identify which fields and behavior are genuinely universal.
3. Move context-specific concepts out of the core.
4. Confirm that no domain carries irrelevant optional fields for another domain.
5. Confirm canonical data remains understandable without Astro knowledge.
6. Confirm Astro can be replaced at the content-loading boundary without rewriting domain semantics.
7. Confirm presets remain thin.
8. Validate serialization, migrations, types, builds, and representative accessibility.

Stability is earned through cross-domain evidence, not elapsed time or use by one example.

## 35. Feature placement decision framework

Before implementing a feature, classify it:

```text
Does it express stable meaning shared across domains?
  -> Core domain primitive or shared value object

Does it express rules of one business context?
  -> Bounded-context domain module

Does it provide coherent reusable behavior?
  -> Capability or application service

Does it translate between models?
  -> Adapter

Does it provide declarative defaults for a use case?
  -> Preset

Does it change presentation only?
  -> Theme or component

Does it connect to an external service?
  -> Integration

Does it load content, define routes, or use Astro APIs?
  -> Astro infrastructure
```

Then ask:

- What exactly is being abstracted?
- Is the similarity semantic, behavioral, or merely visual?
- Which bounded contexts use it today?
- Would it still make sense if the UI changed?
- Would it add irrelevant fields or states to another domain?
- Could an adapter preserve domain boundaries better?
- Does it truly require client-side JavaScript?
- Is the need demonstrated by fixtures or only imagined?
- Would this choice make another supported use case harder?
- Does the feature belong in this framework at all?

## 36. Dependency policy

Do not add dependencies casually. A meaningful new dependency requires a brief justification in the change description or ADR.

Evaluate:

- whether the capability is necessary;
- maintenance activity and project health;
- security history and supply-chain risk;
- Astro and current runtime compatibility;
- browser and server bundle impact;
- transitive dependency cost;
- accessibility and privacy implications;
- whether a small internal implementation would be clearer and safer;
- whether the dependency would constrain future architecture.

Avoid implementing security-sensitive standards, complex parsers, or mature accessibility behavior internally merely to avoid a dependency. Conversely, do not add a large library for trivial formatting or static UI.

## 37. Security

- Never commit secrets, tokens, private keys, or credentials.
- Keep secrets in approved environment-specific storage.
- Treat configuration and content as untrusted input at their boundaries.
- Validate and safely encode external URLs, query strings, and contact-action payloads.
- Allow only intended URL schemes; reject `javascript:` and other unsafe protocols.
- Sanitize user-controlled HTML when raw HTML is supported; prefer structured content and safe rendering.
- Canonical configuration is data, never arbitrary executable code.
- Restrict remote media and integrations to documented hosts or policies where appropriate.
- Minimize third-party scripts and review their privacy impact.
- Keep dependencies current through deliberate maintenance and investigate relevant advisories.
- Do not expose server-only environment values in client bundles.
- Avoid logging secrets or sensitive personal content in validation errors.

## 38. Future builder compatibility

A future builder should produce valid structured data without understanding Astro internals or modifying components for ordinary content changes.

```text
Client or developer input
          |
Serializable structured data
          |
Schema validation and migration
          |
Domain models
          |
Application/framework behavior
          |
Presentation adapters
          |
Astro rendering
```

This requires:

- strictly serializable, versioned configuration;
- schemas that expose required fields, constraints, variants, and defaults;
- domain terminology suitable for user-facing forms;
- separation of configuration from domain content;
- stable IDs instead of component references;
- no requirement to edit Astro components for routine content;
- deterministic validation errors that a builder can associate with fields;
- adapters that keep source formats and Astro out of domain semantics.

A client intake experience MAY expose only business language and essential choices. A contractor/developer experience MAY expose advanced themes, features, integrations, SEO, layouts, and migration tools. Both should converge on the same canonical contracts.

## 39. AI-agent workflow

Before changing the repository, an AI coding agent MUST:

1. Read this file and any more specific applicable instructions.
2. Inspect the relevant implementation, tests, schemas, fixtures, and recent conventions.
3. Identify the affected bounded context.
4. Classify the change as domain, application, infrastructure, adapter, preset, capability, theme, integration, or presentation.
5. Check whether a genuine abstraction already exists.
6. Decide whether reuse belongs in domain, behavior, or presentation.
7. Avoid introducing a universal entity merely to reuse UI.
8. Preserve canonical configuration serializability.
9. Keep Astro dependencies outside domain code where practical.
10. Ensure presets remain thin.
11. Determine affected schemas, versions, migrations, docs, and fixtures.

While implementing, the agent SHOULD:

- make the smallest coherent change;
- extend an existing appropriate abstraction rather than creating a parallel system;
- preserve backwards compatibility where practical;
- add explicit adapters instead of leaking representations across boundaries;
- update tests with behavior, not implementation details;
- avoid rewriting working architecture merely because another style is preferred;
- document meaningful deviations from these defaults.

Before completion, the agent MUST run the relevant type, test, build, schema, and fixture checks available in the repository. If a check cannot run, report exactly what was not verified and why.

## 40. Anti-patterns

Avoid these architecture smells:

### Universal entity

One `Item` or `Entry` with dozens of optional properties for unrelated domains.

### Optional-field explosion

Extending a shared model with fields irrelevant to most consumers instead of creating a precise domain model or capability.

### Astro-as-domain

Treating an Astro Content Collection entry, frontmatter layout, or route convention as the canonical domain entity.

### Executable canonical configuration

Using TypeScript functions, component imports, closures, or class instances in the canonical representation.

### Preset mini-app

Giving each preset its own routing, services, component copies, state, and schemas rather than composing shared modules.

### Presentation-driven domain modeling

Changing domain entities solely so one generic card component can accept them.

### Theme business logic

Allowing a theme to decide availability, pricing, actions, validation, or domain behavior.

### Core pollution

Adding restaurant-, property-, or portfolio-specific rules to generic infrastructure.

### Speculative abstraction

Building elaborate generic systems before multiple real use cases demonstrate a stable concept.

### Domain duplication

Reimplementing genuinely shared value semantics such as validated money or safe external URLs in every context.

### Client JavaScript by default

Hydrating components whose behavior is static or can be expressed accessibly with HTML and CSS.

### Configuration monolith

Mixing global behavior, large volumes of domain content, secrets, and presentation details into one unbounded file.

### Silent schema breakage

Changing required fields or meanings without versioning, migration, fixture coverage, or clear errors.

### Miscellaneous-layer dumping grounds

Using `utils`, `shared`, `common`, or `capabilities` as places for code whose owner has not been determined.

## 41. Open architectural decisions

The following remain **OPEN** unless existing repository code or an ADR resolves them:

- final canonical configuration schema and file organization;
- domain-module package boundaries;
- extent and shape of Astro Content Collection usage;
- content storage and authoring strategy;
- YAML import/export support;
- theme and preset packaging;
- migration tooling and support window;
- builder architecture and schema introspection format;
- plugin/integration API;
- deployment assumptions;
- performance budgets;
- translated slugs.

Settled so far (see `docs/adr/`): single package at the repository root with npm (0001), runtime validation with Zod via `astro/zod` (0002), type checking with `astro check` and tests with `node:test` (0003), one static route per locale with canonical and `hreflang` links (0005, superseding 0004), scoped CSS over generated theme custom properties (0006), tests against the built site (0007), and contact channels as a discriminated union (0008). Localization fallback is settled by the schemas: every localized value must provide every supported locale, so there is no runtime fallback.

Do not silently settle an open decision as a side effect of an unrelated task. If implementation requires a choice, document the smallest reversible choice or write an ADR.

## 42. Architectural Decision Records

Use lightweight ADRs in `docs/adr/` for decisions that are expensive to reverse, establish a public contract, affect multiple bounded contexts, or intentionally deviate from this guidance.

An ADR SHOULD record:

- context and problem;
- decision;
- alternatives considered;
- consequences and tradeoffs;
- migration or compatibility impact;
- status and date.

Good initial ADR candidates include:

- why canonical configuration is strictly serializable;
- why Astro Content Collections remain infrastructure;
- why presets remain thin;
- why the framework rejects a universal `Item` entity;
- stabilization of the first canonical schema version.

Do not create an ADR for routine implementation details that are easy to change locally.

## 43. Definition of done

A change is generally complete when all applicable statements are true:

- code compiles and strict TypeScript passes;
- Astro builds successfully;
- relevant unit, integration, accessibility, and regression tests pass;
- changed schemas validate accepted and rejected cases;
- canonical configuration remains strictly serializable;
- versioning and migration effects are handled;
- bounded-context boundaries remain intact;
- domain code has not gained unnecessary Astro dependencies;
- presets remain thin and themes remain presentation-only;
- shared abstractions are supported by semantic evidence;
- core changes are validated against multiple divergent fixtures;
- responsive behavior and accessibility are considered;
- no unnecessary client JavaScript or dependency was introduced;
- security and safe external URL handling are considered;
- public behavior, examples, and configuration are documented;
- open decisions or architectural changes are recorded where warranted;
- any skipped verification is disclosed.

## AI-agent pre-change checklist

- [ ] I read all applicable instruction files.
- [ ] I inspected the implementation, schemas, tests, and relevant fixtures.
- [ ] I identified the bounded context and architectural layer.
- [ ] I classified reuse as domain, application, or presentation reuse.
- [ ] I checked for an existing genuine abstraction or adapter.
- [ ] I identified compatibility, migration, security, and documentation impact.

## AI-agent completion checklist

- [ ] Types, tests, schemas, and the Astro build pass where applicable.
- [ ] Configuration remains serializable and version-aware.
- [ ] Domain models remain independent from Astro infrastructure.
- [ ] Presets remain thin; themes contain no business logic.
- [ ] Core changes work across substantially different fixtures.
- [ ] Accessibility, responsiveness, performance, and safe URLs were considered.
- [ ] Public changes and unresolved decisions are documented.
- [ ] I reported any checks I could not run.

## Architecture smell checklist

- [ ] Did I add an unrelated optional field to a generic type?
- [ ] Did I make a domain type depend on Astro unnecessarily?
- [ ] Did a preset gain application or domain logic?
- [ ] Did I introduce executable canonical configuration?
- [ ] Am I abstracting shared semantics, or merely similar-looking code?
- [ ] Would an adapter preserve the domain boundary better?
- [ ] Did presentation reuse force false domain equivalence?
- [ ] Did I test a core change against substantially different fixtures?
- [ ] Did I add client JavaScript or a dependency without concrete value?
- [ ] Did I silently decide an open architectural question?

