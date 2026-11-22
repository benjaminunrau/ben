/**
 * A short-lived "this browser passed a Turnstile check" cookie (ADR 0010), so one check covers the
 * WhatsApp reveal and the résumé download instead of one check per click.
 *
 * Stateless: the cookie carries its own expiry and an HMAC of it, keyed with the site's Turnstile
 * secret. Rotating that secret ends every clearance. It is not bound to an IP or device (mobile
 * networks change both), so it only ever relieves a visitor from repeating the check for a few
 * minutes; it never grants more than the endpoint would give after a fresh check. Uses only Web
 * Crypto, so it runs in Workers and Node and is unit-tested.
 */

export const clearanceCookieName = "human";
export const clearanceSeconds = 600;
/** The cookie is only sent to the endpoint that needs it. */
export const clearancePath = "/api/protected";

const encoder = new TextEncoder();
const version = "v1";

const messageFor = (expiry: number) => encoder.encode(`protected-clearance-${version}.${expiry}`);
const keyFor = (secret: string, usage: KeyUsage) =>
  crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | undefined {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(text)) return undefined;
  try {
    const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

/** A new clearance value, good for `ttlSeconds` from `nowMs`. */
export async function issueClearance(secret: string, nowMs: number, ttlSeconds = clearanceSeconds): Promise<string> {
  const expiry = Math.floor(nowMs / 1000) + ttlSeconds;
  const signature = await crypto.subtle.sign("HMAC", await keyFor(secret, "sign"), messageFor(expiry));
  return `${version}.${expiry}.${toBase64Url(signature)}`;
}

/** True when the request's `Cookie` header carries a clearance that is genuine and not expired. */
export async function hasClearance(cookieHeader: string | null, secret: string, nowMs: number): Promise<boolean> {
  const entry = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${clearanceCookieName}=`));
  if (!entry) return false;
  const [tag, expiryText, signatureText, ...extra] = entry.slice(clearanceCookieName.length + 1).split(".");
  if (tag !== version || extra.length > 0 || !expiryText || !signatureText || !/^\d{1,12}$/.test(expiryText)) return false;
  const expiry = Number(expiryText);
  if (expiry <= Math.floor(nowMs / 1000)) return false;
  const signature = fromBase64Url(signatureText);
  if (!signature) return false;
  // `verify` compares in constant time.
  return crypto.subtle.verify("HMAC", await keyFor(secret, "verify"), signature, messageFor(expiry));
}

/** The `Set-Cookie` value; `Secure` is set whenever the page is served over https. */
export function clearanceCookie(value: string, secure: boolean, maxAgeSeconds = clearanceSeconds): string {
  return [
    `${clearanceCookieName}=${value}`,
    `Max-Age=${maxAgeSeconds}`,
    `Path=${clearancePath}`,
    "HttpOnly",
    "SameSite=Strict",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
