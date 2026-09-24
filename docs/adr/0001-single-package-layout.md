# ADR 0001: Single package at the repository root

- Status: accepted
- Date: 2026-09-23

## Context

The Astro app lived in `astro/`, while its content (`content/`) and themes (`themes/`) sat beside it in the repository root. The loader reached them through `process.cwd()` + `"../content"`, so the site only built when run from inside `astro/`. `INSTRUCTIONS.md` §8 sketches a single package with `package.json` at the root, and there is no second package (library, builder, fixture runner) that would justify a monorepo.

## Decision

The repository root is the one Astro package: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/`, `public/` and `tests/` live at the root, next to `content/` and `themes/`. Source files are read relative to the project root, which is the working directory for every `npm run` script.

The package is named `port`; the previous name `astro` collided with its own `astro` dependency.

## Alternatives considered

- **Keep `astro/` and move `content/` and `themes/` into it.** Same amount of churn, but leaves the documentation's layout and the actual layout disagreeing.
- **Monorepo (workspaces).** Only worth it once there is a second package, such as a reusable framework package consumed by several sites.

## Consequences

- Commands run from the repository root.
- The legacy static site (`index.html`, `old/`) still sits at the root. Astro ignores it; move or delete it when it is no longer needed for reference.
- Revisit if the framework is split into a reusable package plus per-site packages.
