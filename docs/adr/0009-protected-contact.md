# ADR 0009: Protecting contact details from scrapers

## Status

Accepted — 2026-11-20.

## Context

The site is static and public. An email address or phone number in the built HTML is harvested by scrapers that ignore `robots.txt`, and obfuscation (encoding, JavaScript assembly) only stops scrapers that do not run a browser. The owner wants to sell a service, so the address must stay out of the page and out of the repository's content.

## Decision

- A new contact channel, `form` (ADR 0008), holds only an ID. The page's Turnstile site key is public and lives in the site config (moved there by ADR 0010). The visitor writes a message on the page; no address is shown or linked.
- `POST /api/contact` (`functions/api/contact.ts`, a Cloudflare Pages Function) accepts same-origin JSON, validates it, verifies the Turnstile token with the secret key, and forwards the message over a service binding.
- `workers/contact-mailer` is a separate Worker with no public route. It alone has the `send_email` binding (Pages Functions do not support that binding). The destination inbox is its `CONTACT_INBOX` secret.
- Secrets (`TURNSTILE_SECRET_KEY`, `CONTACT_INBOX`) live in Cloudflare, set with `wrangler … secret put`; never in the repository or content. The Turnstile site key is public by design.
- Validation, the Turnstile check and mail composition live in `src/capabilities/contact-form.ts`, free of framework and Cloudflare imports, and are unit-tested. They treat all input as untrusted: header-injection characters are rejected, mail is plain text only, a honeypot field silently drops bots, and verification fails closed.
- Replies go from the owner's own inbox via `Reply-To`, so the visitor learns the owner's address only when the owner answers.
- The built-page tests assert that no `mailto:` or `tel:` link, `wa.me/<number>` link or email address appears in the HTML.

## Consequences

- The site is no longer purely static: one Function and one Worker run on Cloudflare. The page still ships static HTML; client JavaScript exists only for Turnstile and the form.
- A root `wrangler.jsonc` makes the file, not the dashboard, the source of the Pages project's bindings.
- The `email` and `whatsapp` channel types remain for sites that want public contacts. The WhatsApp reveal and the gated résumé are in ADR 0010.
