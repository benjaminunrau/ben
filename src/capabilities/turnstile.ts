/**
 * Cloudflare Turnstile server-side check, shared by every endpoint that protects something from
 * bots (ADR 0009, ADR 0010). Plain TypeScript, no Cloudflare imports: unit-tested with a fake fetch.
 */

export const turnstileVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const maxTurnstileTokenLength = 2048;

/**
 * Asks Cloudflare whether a Turnstile token is genuine and unused. Fails closed: a missing or
 * oversized token, a network error or any non-success answer counts as not verified.
 */
export async function verifyTurnstile(
  token: unknown,
  secret: string,
  remoteIp: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (typeof token !== "string" || token.length === 0 || token.length > maxTurnstileTokenLength) return false;
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);
  try {
    const response = await fetchImpl(turnstileVerifyUrl, { method: "POST", body: form });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
