import { parseSubmission } from "./contact-form.ts";
import { pseudonym, takeOne, type CounterStore, type RateRule } from "./rate-limit.ts";
import { jsonResponse, readSameOriginJson } from "./request-guard.ts";
import { checkTurnstile } from "./turnstile.ts";

/**
 * Handles a contact-form submission (ADR 0009): same-origin JSON, validation, Turnstile, a rate
 * limit, then the mailer Worker over a service binding. The inbox address never reaches this code.
 */

export interface ContactEnv {
  /** Turnstile secret key (Pages secret). */
  TURNSTILE_SECRET_KEY?: string;
  /** Service binding to the `ben-contact-mailer` Worker. */
  MAILER?: { fetch(request: Request): Promise<Response> };
  /** KV namespace for rate-limit counters. */
  RATE_LIMITS?: CounterStore;
}

/** One visitor can send a few messages an hour, and the whole site a few dozen a day. */
export const perVisitor: RateRule = { name: "contact-visitor", limit: 3, windowSeconds: 3600 };
export const siteWide: RateRule = { name: "contact-site", limit: 20, windowSeconds: 86_400 };

export async function handleContactRequest(
  request: Request,
  env: ContactEnv,
  fetchImpl: typeof fetch = fetch,
  nowMs: number = Date.now(),
): Promise<Response> {
  if (!env.TURNSTILE_SECRET_KEY || !env.MAILER || !env.RATE_LIMITS) return jsonResponse({ error: "failed" }, 500);

  const read = await readSameOriginJson(request);
  if ("response" in read) return read.response;

  const parsed = parseSubmission(read.body);
  if (parsed.kind === "invalid") return jsonResponse({ error: "invalid" }, 400);
  // Bots that fill the hidden field are told it worked, and nothing is sent.
  if (parsed.kind === "spam") return jsonResponse({ ok: true }, 200);

  const ip = request.headers.get("cf-connecting-ip") ?? undefined;
  const check = await checkTurnstile((read.body as { token?: unknown }).token, env.TURNSTILE_SECRET_KEY, ip, fetchImpl);
  if (!check.success) {
    if (check.serverFault) {
      console.error("contact message failed: Turnstile could not verify (check TURNSTILE_SECRET_KEY)", JSON.stringify({ codes: check.errorCodes }));
      return jsonResponse({ error: "failed" }, 500);
    }
    console.warn("contact message refused by Turnstile", JSON.stringify({ codes: check.errorCodes, hostname: check.hostname }));
    return jsonResponse({ error: "verification" }, 403);
  }

  // Only a message that passed the check counts, so failed attempts cannot use up anyone's allowance.
  const decision = await takeOne(
    env.RATE_LIMITS,
    [
      { rule: perVisitor, subject: await pseudonym(ip ?? "unknown") },
      { rule: siteWide, subject: "all" },
    ],
    nowMs,
  );
  if (!decision.allowed) {
    console.warn("contact message refused by rate limit", JSON.stringify({ rule: decision.blockedBy }));
    return jsonResponse({ error: "rate" }, 429, { "retry-after": String(decision.retryAfterSeconds ?? 3600) });
  }

  const sent = await env.MAILER.fetch(
    new Request("https://mailer.internal/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.submission),
    }),
  );
  return sent.ok ? jsonResponse({ ok: true }, 200) : jsonResponse({ error: "failed" }, 502);
}
