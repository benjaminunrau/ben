# ADR 0010: Protected resources — WhatsApp reveal and gated résumé

## Status

Accepted — 2026-11-22. Extends ADR 0009.

## Context

ADR 0009 keeps the email address out of the page. Two other things still leaked to scrapers that ignore `robots.txt`: the WhatsApp number (a `wa.me` link) and the résumé PDFs, which contain the owner's phone number and email address and sat in `public/`, at guessable paths and in the public repository. The owner applies to local markets, where WhatsApp and a full résumé are expected, so both must stay available to real visitors, not be removed.

## Decision

- **One endpoint, two kinds of request.** `POST /api/protected` (`functions/api/protected.ts`) accepts same-origin JSON `{ request: "whatsapp" | "file", file?, token }`. It decides what is asked for, verifies the Turnstile token, then releases the thing. All logic is in `src/capabilities/protected-access.ts`, with the Turnstile check in `turnstile.ts` and same-origin/JSON handling in `request-guard.ts`; all three are free of Cloudflare imports and unit-tested.
- **WhatsApp.** The channel `whatsapp-reveal` (ADR 0008) holds only an ID. The page shows a "Show WhatsApp" button; after Turnstile the endpoint returns `https://wa.me/<number>` from the `WHATSAPP_NUMBER` Pages secret, and the button becomes a real link. The client only follows links that start with `https://wa.me/`. The footer icon links to the contact section instead of exposing the number.
- **Résumé.** `resume.files` maps each locale to a **private file ID** (`resume-en`), not a site path. Files live in a Workers KV namespace (`PRIVATE_FILES`, keys `file:<id>`, value the PDF, metadata `{ "filename": … }`), not in `public/`, the build output or git. The hero and footer buttons request the file by ID; the endpoint streams it with `Content-Disposition: attachment`, `Cache-Control: no-store` and `X-Robots-Tag: noindex`. File IDs must match the slug pattern, so a request cannot name a path or another key family; the namespace holds only files meant to be gated.
- **Turnstile site key in site config.** Three features on every page share one widget key, so `turnstileSiteKey` moved from the `form` channel into `content/site-config.json` (public by design). The page runs one invisible, on-demand widget for the buttons (`ProtectedActions.astro`) and the visible one in the contact form.
- **KV, not R2.** R2 needs enabling and billing details on the account; KV is free, binds to Pages Functions the same way, and is enough for a few small PDFs. Moving to R2 later changes the store behind `PrivateFileStore`, nothing else.
- **Source files stay out of git.** The PDFs to upload live in the git-ignored `private/` folder; uploading is a manual `wrangler kv key put … --remote` step.
- Built-page tests now assert there is no email, `mailto:`, `tel:`, `wa.me/<number>` or résumé link in the HTML.

## Consequences

- A visitor needs JavaScript and a passing Turnstile check to get the WhatsApp link or the résumé; a bot that runs a real browser may still pass the check. This raises the cost of scraping; it does not make it impossible.
- The résumé is no longer a plain link, so "save link as" and some download managers do not work; the download is a normal browser file save.
- The old résumé files are still in the public repository's **git history**. Gating protects the live site from now on; only rewriting history would remove them, which is not planned.
- Every site built on this framework must set `turnstileSiteKey`; a site that needs no protection is not supported yet (rule of three: not abstracted).
- The résumé PDFs are in KV, not the repo, so changing one is an upload, not a commit; the build cannot verify the files exist. A missing file answers 404 and the page tells the visitor it is unavailable.
- Certificates remain public: they contain no contact details (checked 2026-11-22), and gating them would hide credentials from the people who need to verify them.
