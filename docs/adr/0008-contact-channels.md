# ADR 0008: Contact channels as a discriminated union

## Status

Accepted — 2026-09-24.

## Context

Every site this framework builds funnels visitors to an external action. The portfolio modeled contact as a fixed email field, a list that had to contain exactly one LinkedIn and one WhatsApp link, a separate `codingProfiles` list, and a contact sentence split into four translated fragments around those three links. Adding, removing or reordering a channel required schema, content and template changes, and phone numbers were embedded in pre-built `wa.me` URLs.

## Decision

- `src/schemas/contact.ts` defines `ContactChannel`, a discriminated union on `type`, each with a stable `id`:
  - `email` — `address`, validated as an email address.
  - `whatsapp` — `phone`, stored in E.164 form; spaces, dots, dashes and parentheses are accepted and removed.
  - `profile` — `network` (`github`, `linkedin`) and an https `url`, which must be on that network's domain.
- Content lists channels in display order under `contact.channels`, with one localized `contact.intro`. Other content references a channel by ID (the hero's primary action); the loader rejects unknown IDs.
- `src/capabilities/contact-links.ts` turns a channel into link attributes and a visible label. It owns the security rule: external channels open in a new tab with `rel="noopener noreferrer"`; `mailto:` stays in the same tab. Components never build contact URLs themselves.
- Icons are a presentation concern (`ContactChannelIcon.astro`); the schema holds no icon names.

## Consequences

- Channels are added, removed and reordered in content alone.
- A new channel type (phone call, booking link, external shop) is one union member plus one case in `contactLink`/`contactLabel`; the exhaustive `switch` makes TypeScript flag every place that must handle it. Add them when a site needs them, not speculatively.
- Brand names (`GitHub`, `WhatsApp`) are not translated. The email address is its own label.
