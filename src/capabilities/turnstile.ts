/**
 * Cloudflare Turnstile server-side check, shared by every endpoint that protects something from
 * bots (ADR 0009, ADR 0010). Plain TypeScript, no Cloudflare imports: unit-tested with a fake fetch.
 */

export const turnstileVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
export const maxTurnstileTokenLength = 2048;

export interface TurnstileResult {
  readonly success: boolean;
  /** Cloudflare's reason codes ("invalid-input-secret", "timeout-or-duplicate", …); ours start with "local-". */
  readonly errorCodes: readonly string[];
  /** The hostname the challenge was solved on, as Cloudflare reports it. */
  readonly hostname?: string;
}

/**
 * Asks Cloudflare whether a Turnstile token is genuine and unused, and says why when it is not.
 * Fails closed: a missing or oversized token, a network error or any non-success answer counts as
 * not verified.
 */
export async function checkTurnstile(
  token: unknown,
  secret: string,
  remoteIp: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (typeof token !== "string" || token.length === 0) return { success: false, errorCodes: ["local-missing-token"] };
  if (token.length > maxTurnstileTokenLength) return { success: false, errorCodes: ["local-oversized-token"] };
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);
  try {
    const response = await fetchImpl(turnstileVerifyUrl, { method: "POST", body: form });
    if (!response.ok) return { success: false, errorCodes: [`local-siteverify-http-${response.status}`] };
    const result = (await response.json()) as { success?: unknown; "error-codes"?: unknown; hostname?: unknown };
    const codes = Array.isArray(result["error-codes"]) ? result["error-codes"].filter((code): code is string => typeof code === "string") : [];
    return {
      success: result.success === true,
      errorCodes: codes,
      hostname: typeof result.hostname === "string" ? result.hostname : undefined,
    };
  } catch {
    return { success: false, errorCodes: ["local-siteverify-unreachable"] };
  }
}

/** True when Cloudflare confirms the token. */
export async function verifyTurnstile(
  token: unknown,
  secret: string,
  remoteIp: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  return (await checkTurnstile(token, secret, remoteIp, fetchImpl)).success;
}
