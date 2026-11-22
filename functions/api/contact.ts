import { parseSubmission } from "../../src/capabilities/contact-form.ts";
import { jsonResponse, readSameOriginJson } from "../../src/capabilities/request-guard.ts";
import { checkTurnstile } from "../../src/capabilities/turnstile.ts";

/**
 * POST /api/contact — checks the request came from this site, validates the message, verifies the
 * Turnstile token, then hands the message to the mailer Worker over a service binding (ADR 0009).
 * The inbox address never reaches this code.
 */
interface Env {
  /** Turnstile secret key; set with `wrangler pages secret put TURNSTILE_SECRET_KEY`. */
  TURNSTILE_SECRET_KEY?: string;
  /** Service binding to the `ben-contact-mailer` Worker. */
  MAILER?: { fetch(request: Request): Promise<Response> };
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.TURNSTILE_SECRET_KEY || !env.MAILER) return jsonResponse({ error: "failed" }, 500);

  const read = await readSameOriginJson(request);
  if ("response" in read) return read.response;

  const parsed = parseSubmission(read.body);
  if (parsed.kind === "invalid") return jsonResponse({ error: "invalid" }, 400);
  // Bots that fill the hidden field are told it worked, and nothing is sent.
  if (parsed.kind === "spam") return jsonResponse({ ok: true }, 200);

  const token = (read.body as { token?: unknown }).token;
  const check = await checkTurnstile(token, env.TURNSTILE_SECRET_KEY, request.headers.get("cf-connecting-ip") ?? undefined);
  if (!check.success) {
    if (check.serverFault) {
      console.error("contact message failed: Turnstile could not verify (check TURNSTILE_SECRET_KEY)", JSON.stringify({ codes: check.errorCodes }));
      return jsonResponse({ error: "failed" }, 500);
    }
    console.warn("contact message refused by Turnstile", JSON.stringify({ codes: check.errorCodes, hostname: check.hostname }));
    return jsonResponse({ error: "verification" }, 403);
  }

  const sent = await env.MAILER.fetch(
    new Request("https://mailer.internal/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.submission),
    }),
  );
  return sent.ok ? jsonResponse({ ok: true }, 200) : jsonResponse({ error: "failed" }, 502);
};

export const onRequest = (): Response => jsonResponse({ error: "method" }, 405);
