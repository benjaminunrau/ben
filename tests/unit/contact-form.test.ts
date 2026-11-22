import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { composeMail, contactFormLimits, parseSubmission } from "../../src/capabilities/contact-form.ts";
import { checkTurnstile, maxTurnstileTokenLength, turnstileVerifyUrl, verifyTurnstile } from "../../src/capabilities/turnstile.ts";

const valid = { name: "Ada Lovelace", email: "ada@example.com", message: "Hello, I would like to hire you.", locale: "es" };

describe("parseSubmission", () => {
  it("accepts a normal message and trims it", () => {
    const result = parseSubmission({ ...valid, name: "  Ada Lovelace ", website: "" });
    assert.deepEqual(result, { kind: "valid", submission: valid });
  });

  it("defaults the locale to English", () => {
    const { locale: _locale, ...rest } = valid;
    assert.deepEqual(parseSubmission(rest), { kind: "valid", submission: { ...valid, locale: "en" } });
  });

  it("treats a filled honeypot as spam", () => {
    assert.deepEqual(parseSubmission({ ...valid, website: "https://spam.example" }), { kind: "spam" });
  });

  it("rejects anything that is not an object", () => {
    for (const input of [null, undefined, "text", 42, []]) assert.equal(parseSubmission(input).kind, "invalid");
  });

  it("rejects bad names, including line breaks that could inject mail headers", () => {
    for (const name of ["", "   ", "Ada\nBcc: victim@example.com", "x".repeat(contactFormLimits.name + 1), 7]) {
      assert.equal(parseSubmission({ ...valid, name }).kind, "invalid", JSON.stringify(name));
    }
  });

  it("rejects malformed email addresses", () => {
    for (const email of ["", "ada", "ada@", "@example.com", "ada@example", "a b@example.com", "ada@example.com\nBcc: x@y.z", "<ada@example.com>"]) {
      assert.equal(parseSubmission({ ...valid, email }).kind, "invalid", email);
    }
  });

  it("enforces message length bounds", () => {
    assert.equal(parseSubmission({ ...valid, message: "short" }).kind, "invalid");
    assert.equal(parseSubmission({ ...valid, message: "x".repeat(contactFormLimits.message + 1) }).kind, "invalid");
    assert.equal(parseSubmission({ ...valid, message: "x".repeat(contactFormLimits.message) }).kind, "valid");
  });

  it("rejects a locale that is not a language tag", () => {
    assert.equal(parseSubmission({ ...valid, locale: "en\nX: y" }).kind, "invalid");
  });
});

describe("composeMail", () => {
  it("builds a plain-text mail naming the visitor and carrying the message", () => {
    const mail = composeMail(valid);
    assert.equal(mail.subject, "Portfolio message from Ada Lovelace");
    assert.match(mail.text, /Email: ada@example\.com/);
    assert.match(mail.text, /Hello, I would like to hire you\./);
  });
});

describe("verifyTurnstile", () => {
  const answering = (body: unknown, ok = true): typeof fetch =>
    (async () => ({ ok, json: async () => body })) as unknown as typeof fetch;

  it("accepts a token Cloudflare confirms and posts the secret, token and IP", async () => {
    let seen: { url: string; form: FormData } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, form: init.body as FormData };
      return { ok: true, json: async () => ({ success: true }) };
    }) as unknown as typeof fetch;
    assert.equal(await verifyTurnstile("token", "secret", "203.0.113.9", fetchImpl), true);
    assert.equal(seen?.url, turnstileVerifyUrl);
    assert.equal(seen?.form.get("secret"), "secret");
    assert.equal(seen?.form.get("response"), "token");
    assert.equal(seen?.form.get("remoteip"), "203.0.113.9");
  });

  it("fails closed on a rejected token, an error status, bad JSON or a network failure", async () => {
    assert.equal(await verifyTurnstile("t", "s", undefined, answering({ success: false })), false);
    assert.equal(await verifyTurnstile("t", "s", undefined, answering({ success: true }, false)), false);
    assert.equal(await verifyTurnstile("t", "s", undefined, answering({})), false);
    assert.equal(await verifyTurnstile("t", "s", undefined, (async () => { throw new Error("offline"); }) as typeof fetch), false);
  });

  it("reports Cloudflare's reason codes and hostname when it refuses a token", async () => {
    const refusing = answering({ success: false, "error-codes": ["invalid-input-secret", 7], hostname: "site.example" });
    assert.deepEqual(await checkTurnstile("t", "s", undefined, refusing), { success: false, errorCodes: ["invalid-input-secret"], hostname: "site.example", serverFault: true });
  });

  it("names its own failures with a local- code", async () => {
    assert.deepEqual((await checkTurnstile("", "s", undefined)).errorCodes, ["local-missing-token"]);
    const unavailable = (async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
    assert.deepEqual((await checkTurnstile("t", "s", undefined, unavailable)).errorCodes, ["local-siteverify-http-503"]);
    assert.deepEqual((await checkTurnstile("t", "s", undefined, (async () => { throw new Error("offline"); }) as typeof fetch)).errorCodes, ["local-siteverify-unreachable"]);
  });

  it("reads Cloudflare's reason from an HTTP 400 body and treats a bad secret as the site's fault", async () => {
    const badSecret = (async () => ({ ok: false, status: 400, json: async () => ({ success: false, "error-codes": ["invalid-input-secret"] }) })) as unknown as typeof fetch;
    const result = await checkTurnstile("t", "wrong", undefined, badSecret);
    assert.deepEqual(result.errorCodes, ["invalid-input-secret"]);
    assert.equal(result.serverFault, true);
  });

  it("blames the visitor's token, not the site, for token problems", async () => {
    for (const codes of [["invalid-input-response"], ["timeout-or-duplicate"], []]) {
      const result = await checkTurnstile("t", "s", undefined, answering({ success: false, "error-codes": codes }));
      assert.equal(result.serverFault, false, JSON.stringify(codes));
    }
    assert.equal((await checkTurnstile("", "s", undefined)).serverFault, false);
  });

  it("blames the site when Cloudflare cannot be reached or errors", async () => {
    const down = (async () => { throw new Error("offline"); }) as typeof fetch;
    assert.equal((await checkTurnstile("t", "s", undefined, down)).serverFault, true);
    const broken = (async () => ({ ok: false, status: 503, json: async () => { throw new Error("html"); } })) as unknown as typeof fetch;
    assert.deepEqual((await checkTurnstile("t", "s", undefined, broken)).errorCodes, ["local-siteverify-http-503"]);
  });

  it("does not call Cloudflare for a missing or oversized token", async () => {
    const fetchImpl = (async () => { throw new Error("must not be called"); }) as typeof fetch;
    for (const token of [undefined, "", 5, "x".repeat(maxTurnstileTokenLength + 1)]) {
      assert.equal(await verifyTurnstile(token, "s", undefined, fetchImpl), false);
    }
  });
});
