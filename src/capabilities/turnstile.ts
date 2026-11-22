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
  /**
   * The refusal is the site's fault, not the visitor's: our secret is wrong or missing, or Cloudflare
   * could not be reached. Visitors should be told something went wrong, not that a spam check failed.
   */
  readonly serverFault: boolean;
}

/** Codes that mean the site's own configuration or Cloudflare is at fault, not the token. */
const serverFaultCodes = new Set(["invalid-input-secret", "missing-input-secret", "bad-request", "internal-error"]);

function refusal(errorCodes: readonly string[], hostname?: string): TurnstileResult {
  const serverFault = errorCodes.some((code) => serverFaultCodes.has(code) || code === "local-siteverify-unreachable" || code.startsWith("local-siteverify-http-5"));
  return { success: false, errorCodes, hostname, serverFault };
}

/**
 * Asks Cloudflare whether a Turnstile token is genuine and unused, and says why when it is not.
 * Fails closed: a missing or oversized token, a network error or any non-success answer counts as
 * not verified. Cloudflare answers a bad secret with HTTP 400 and the reason in the body, so the
 * body is read whatever the status.
 */
export async function checkTurnstile(
  token: unknown,
  secret: string,
  remoteIp: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (typeof token !== "string" || token.length === 0) return refusal(["local-missing-token"]);
  if (token.length > maxTurnstileTokenLength) return refusal(["local-oversized-token"]);
  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);
  try {
    const response = await fetchImpl(turnstileVerifyUrl, { method: "POST", body: form });
    let result: { success?: unknown; "error-codes"?: unknown; hostname?: unknown } = {};
    try {
      result = (await response.json()) as typeof result;
    } catch {
      return refusal([`local-siteverify-http-${response.status}`]);
    }
    const codes = Array.isArray(result["error-codes"]) ? result["error-codes"].filter((code): code is string => typeof code === "string") : [];
    const hostname = typeof result.hostname === "string" ? result.hostname : undefined;
    if (response.ok && result.success === true) return { success: true, errorCodes: codes, hostname, serverFault: false };
    return refusal(codes.length > 0 ? codes : [`local-siteverify-http-${response.status}`], hostname);
  } catch {
    return refusal(["local-siteverify-unreachable"]);
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
