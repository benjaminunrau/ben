/** Checks shared by the site's server endpoints (ADR 0009, ADR 0010). Treats every request as untrusted. */

export const maxBodyBytes = 16_384;

export function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

/**
 * Accepts only a JSON POST sent by a page of this site: browsers always send `Origin` on
 * cross-site POSTs, so any other origin (or none) is refused before the body is read.
 */
export async function readSameOriginJson(request: Request): Promise<{ body: unknown } | { response: Response }> {
  const origin = request.headers.get("origin");
  let originHost: string | undefined;
  try {
    originHost = origin ? new URL(origin).host : undefined;
  } catch {
    originHost = undefined;
  }
  if (!originHost || originHost !== new URL(request.url).host) return { response: jsonResponse({ error: "forbidden" }, 403) };
  if (!request.headers.get("content-type")?.startsWith("application/json")) return { response: jsonResponse({ error: "invalid" }, 415) };

  const raw = await request.text();
  if (raw.length > maxBodyBytes) return { response: jsonResponse({ error: "invalid" }, 413) };
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { response: jsonResponse({ error: "invalid" }, 400) };
  }
}
