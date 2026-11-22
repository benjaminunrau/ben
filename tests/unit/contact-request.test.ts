import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleContactRequest, perVisitor, siteWide, type ContactEnv } from "../../src/capabilities/contact-request.ts";
import type { CounterStore } from "../../src/capabilities/rate-limit.ts";

const now = Date.UTC(2026, 10, 22, 12, 0, 0);
const message = { name: "Ada Lovelace", email: "ada@example.com", message: "Hello, I would like to hire you.", locale: "en", token: "t" };

function setup(options: { turnstile?: "pass" | "fail" | "badSecret"; mailerStatus?: number } = {}) {
  const counters = new Map<string, string>();
  const store: CounterStore = {
    async get(key) {
      return counters.get(key) ?? null;
    },
    async put(key, value) {
      counters.set(key, value);
    },
  };
  const sent: unknown[] = [];
  const env: ContactEnv = {
    TURNSTILE_SECRET_KEY: "secret",
    RATE_LIMITS: store,
    MAILER: {
      async fetch(request) {
        sent.push(await request.json());
        return new Response(null, { status: options.mailerStatus ?? 204 });
      },
    },
  };
  const outcome = options.turnstile ?? "pass";
  const fetchImpl = (async () =>
    outcome === "badSecret"
      ? { ok: false, status: 400, json: async () => ({ success: false, "error-codes": ["invalid-input-secret"] }) }
      : { ok: true, json: async () => ({ success: outcome === "pass" }) }) as unknown as typeof fetch;
  const post = (body: unknown, init: { ip?: string; origin?: string | null; at?: number } = {}) => {
    const headers: Record<string, string> = { "content-type": "application/json", "cf-connecting-ip": init.ip ?? "203.0.113.9" };
    if (init.origin !== null) headers.origin = init.origin ?? "https://site.example";
    return handleContactRequest(new Request("https://site.example/api/contact", { method: "POST", headers, body: JSON.stringify(body) }), env, fetchImpl, init.at ?? now);
  };
  return { env, post, sent, counters };
}

describe("handleContactRequest", () => {
  it("sends a valid message once, without the token or any extra field", async () => {
    const { post, sent } = setup();
    const response = await post(message);
    assert.equal(response.status, 200);
    assert.deepEqual(sent, [{ name: "Ada Lovelace", email: "ada@example.com", message: "Hello, I would like to hire you.", locale: "en" }]);
  });

  it("answers a filled honeypot as if it worked, sending and counting nothing", async () => {
    const { post, sent, counters } = setup();
    assert.equal((await post({ ...message, website: "https://spam.example" })).status, 200);
    assert.equal(sent.length, 0);
    assert.equal(counters.size, 0);
  });

  it("refuses invalid input, foreign origins and failed checks without sending or counting", async () => {
    const { post, sent, counters } = setup();
    assert.equal((await post({ ...message, email: "nope" })).status, 400);
    assert.equal((await post(message, { origin: "https://evil.example" })).status, 403);
    assert.equal((await post(message, { origin: null })).status, 403);
    const failing = setup({ turnstile: "fail" });
    assert.equal((await failing.post(message)).status, 403);
    assert.equal(sent.length + failing.sent.length, 0);
    assert.equal(counters.size + failing.counters.size, 0, "attempts that fail the check must not use up an allowance");
  });

  it("limits one visitor to a few messages an hour, then answers 429 with Retry-After", async () => {
    const { post, sent } = setup();
    for (let i = 0; i < perVisitor.limit; i++) assert.equal((await post(message)).status, 200);
    const refused = await post(message);
    assert.equal(refused.status, 429);
    assert.deepEqual(await refused.json(), { error: "rate" });
    assert.ok(Number(refused.headers.get("retry-after")) > 0);
    assert.equal(sent.length, perVisitor.limit, "the refused message was not sent");
    assert.equal((await post(message, { at: now + 3_600_000 })).status, 200, "allowed again in the next hour");
  });

  it("does not let one visitor's limit block another", async () => {
    const { post } = setup();
    for (let i = 0; i < perVisitor.limit; i++) await post(message, { ip: "203.0.113.1" });
    assert.equal((await post(message, { ip: "203.0.113.1" })).status, 429);
    assert.equal((await post(message, { ip: "203.0.113.2" })).status, 200);
  });

  it("caps the whole site per day, however many visitors", async () => {
    const { post, sent } = setup();
    for (let i = 0; i < siteWide.limit; i++) assert.equal((await post(message, { ip: `198.51.100.${i}` })).status, 200, `message ${i}`);
    assert.equal((await post(message, { ip: "198.51.100.250" })).status, 429);
    assert.equal(sent.length, siteWide.limit);
  });

  it("stores no raw IP address", async () => {
    const { post, counters } = setup();
    await post(message, { ip: "203.0.113.9" });
    assert.ok([...counters.keys()].every((key) => !key.includes("203.0.113.9")));
  });

  it("reports a bad server secret as the site's failure, not as a failed spam check", async () => {
    const { post, sent } = setup({ turnstile: "badSecret" });
    const response = await post(message);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "failed" });
    assert.equal(sent.length, 0);
  });

  it("answers 502 when the mailer fails, and fails closed when its configuration is missing", async () => {
    assert.equal((await setup({ mailerStatus: 502 }).post(message)).status, 502);
    for (const missing of ["TURNSTILE_SECRET_KEY", "MAILER", "RATE_LIMITS"] as const) {
      const { env, post } = setup();
      delete env[missing];
      assert.equal((await post(message)).status, 500, `without ${missing}`);
    }
  });
});
