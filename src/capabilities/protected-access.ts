import { jsonResponse, readSameOriginJson } from "./request-guard.ts";
import { verifyTurnstile } from "./turnstile.ts";

/**
 * Hands out things the site keeps away from scrapers (ADR 0010): the WhatsApp number and private
 * files such as the résumé. Each is released only to a same-origin request carrying a Turnstile
 * token Cloudflare confirms. Nothing here is in the built pages or the repository.
 */

/** The part of a Workers KV namespace this code uses; the namespace holds only files meant to be gated. */
export interface PrivateFileStore {
  getWithMetadata(key: string, type: "arrayBuffer"): Promise<{ value: ArrayBuffer | null; metadata: unknown }>;
}

export interface ProtectedEnv {
  /** Turnstile secret key (Pages secret). */
  TURNSTILE_SECRET_KEY?: string;
  /** International number, digits with an optional leading "+" (Pages secret). */
  WHATSAPP_NUMBER?: string;
  /** KV namespace whose keys are `file:<id>`; the value is the PDF, metadata `{ "filename": "…pdf" }`. */
  PRIVATE_FILES?: PrivateFileStore;
}

/** Same shape as the schema's `slug`; file IDs come from the content, never a path. */
const fileId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeFilename = /^[\w.-]{1,100}\.pdf$/;

export function whatsappUrl(number: string | undefined): string | undefined {
  const digits = number?.trim().replace(/^\+/, "").replaceAll(/[\s().-]/g, "");
  return digits && /^[1-9]\d{6,14}$/.test(digits) ? `https://wa.me/${digits}` : undefined;
}

export async function handleProtectedRequest(
  request: Request,
  env: ProtectedEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!env.TURNSTILE_SECRET_KEY) return jsonResponse({ error: "failed" }, 500);

  const read = await readSameOriginJson(request);
  if ("response" in read) return read.response;
  const body = typeof read.body === "object" && read.body !== null ? (read.body as Record<string, unknown>) : {};

  // Decide what is being asked for before spending a Turnstile verification on it.
  const wanted = body.request;
  const file = typeof body.file === "string" ? body.file : undefined;
  if (wanted !== "whatsapp" && !(wanted === "file" && file !== undefined && file.length <= 64 && fileId.test(file))) {
    return jsonResponse({ error: "invalid" }, 400);
  }

  const verified = await verifyTurnstile(body.token, env.TURNSTILE_SECRET_KEY, request.headers.get("cf-connecting-ip") ?? undefined, fetchImpl);
  if (!verified) return jsonResponse({ error: "verification" }, 403);

  if (wanted === "whatsapp") {
    const url = whatsappUrl(env.WHATSAPP_NUMBER);
    return url ? jsonResponse({ url }, 200) : jsonResponse({ error: "failed" }, 500);
  }

  if (!env.PRIVATE_FILES) return jsonResponse({ error: "failed" }, 500);
  const stored = await env.PRIVATE_FILES.getWithMetadata(`file:${file}`, "arrayBuffer");
  if (!stored.value) return jsonResponse({ error: "unavailable" }, 404);
  const named = (stored.metadata as { filename?: unknown } | null)?.filename;
  const filename = typeof named === "string" && safeFilename.test(named) ? named : `${file}.pdf`;
  return new Response(stored.value, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
