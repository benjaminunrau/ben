# ADR 0006: Scoped component styles over generated theme custom properties

## Status

Accepted — 2026-09-24. Settles the OPEN "styling approach" decision.

## Context

The portfolio page carried every style in one component, partly duplicated as `:global(...)` copies because Astro's scoped styles do not reach markup rendered by child components. Only one copy of each rule actually applied, and the two had started to differ. Theme tokens reached CSS through a hand-maintained list of about fifty custom properties, so a token added to a theme could silently go unused.

## Decision

- Plain CSS, no CSS framework or preprocessor.
- `src/themes/theme-style-sheet.ts` generates the theme's custom properties from the resolved theme: every token becomes `--<group>-<name>` from its path (for example `--typography-h1-font-size`, `--spacing-section`), and semantic colors become `--color-<role>` inside one rule per color mode, selected by `data-color-mode` on `<html>`. The page inlines this stylesheet.
- `src/styles/global.css` holds document-wide base styles only (element defaults, typography by element, `.muted`, `.icon`, `.sr-only`, view transitions).
- Every other rule lives in a scoped `<style>` in the component that renders the markup. Where a rule targets markup rendered by a child component (icon SVGs, for example), it uses a narrow `:global(...)` inside a scoped selector.
- Components reference only generated properties. A unit test fails when a component uses a `var(--…)` the theme does not define.

## Consequences

- Adding a token to a theme schema makes it available to CSS without further wiring; removing one fails the test for any component still using it.
- Theme values are inserted into a `<style>` element, so the theme schema's CSS value validation (no `;`, `{`, `}`, `<`, `>`, `\`) is a security boundary and must not be loosened.
- A second theme only needs different token files; a component that needs a new visual variant should expose an explicit prop, not read theme files.

## Update — 2026-09-24

Presentation choices that tokens cannot express live under the theme's `variants`, each a closed enum (first: `skillIcons: "brand" | "monochrome"`). Components read them from `theme.variants`; they are not turned into custom properties. Reusable visual patterns (`Timeline`, `TimelineEntry`) may define component custom properties such as `--timeline-marker` for their children.
