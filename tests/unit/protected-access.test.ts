import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleProtectedRequest, whatsappUrl, type PrivateFileStore, type ProtectedEnv } from "../../src/capabilities/protected-access.ts";

const pdf = new TextEncoder().encode("%PDF-1.4 fake").buffer as ArrayBuffer;
const store = (files: Record<string, { value: ArrayBuffer; metadata?: unknown }>): PrivateFileStore => ({
  async getWithMetadata(key) {
    const file = files[key];
    return { value: file?.value ?? null, metadata: file?.metadata ?? null };
  },
});
const turnstile = (success: boolean): typeof fetch => (async () => ({ ok: true, json: async () => ({ success }) })) as unknown as typeof fetch;

const env = (overrides: Partial<ProtectedEnv> = {}): ProtectedEnv => ({
  TURNSTILE_SECRET_KEY: "secret",
  WHATSAPP_NUMBER: "+595 981 000 111",
  PRIVATE_FILES: store({ "file:resume-en": { value: pdf, metadata: { filename: "Benjamin_Unrau_EN.pdf" } }, "file:resume-es": { value: pdf } }),
  ...overrides,
});

const post = (body: unknown, init: { origin?: string | null; contentType?: string } = {}) => {
  const headers: Record<string, string> = { "content-type": init.contentType ?? "application/json" };
  if (init.origin !== null) headers.origin = init.origin ?? "https://site.example";
  return new Request("https://site.example/api/protected", { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
};
const ask = (body: unknown, environment = env(), pass = true, init?: Parameters<typeof post>[1]) =>
  handleProtectedRequest(post(body, init), environment, turnstile(pass));

describe("whatsappUrl", () => {
  it("builds a wa.me link from digits, accepting a leading plus and separators", () => {
    assert.equal(whatsappUrl("+595 981 000 111"), "https://wa.me/595981000111");
    assert.equal(whatsappUrl("595981000111"), "https://wa.me/595981000111");
  });
  it("refuses anything that is not an international number", () => {
    for (const value of [undefined, "", "0981 000111", "+0 123456789", "abc", "+595981000111 ; evil", "+12"]) assert.equal(whatsappUrl(value), undefined, String(value));
  });
});

describe("handleProtectedRequest", () => {
  it("releases the WhatsApp link after Turnstile passes", async () => {
    const response = await ask({ request: "whatsapp", token: "t" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { url: "https://wa.me/595981000111" });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("releases a private file with a download name, never cached or indexed", async () => {
    const response = await ask({ request: "file", file: "resume-en", token: "t" });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("content-disposition"), 'attachment; filename="Benjamin_Unrau_EN.pdf"');
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.arrayBuffer()).byteLength, pdf.byteLength);
  });

  it("names the download after the file ID when the stored name is missing or unsafe", async () => {
    const plain = await ask({ request: "file", file: "resume-es", token: "t" });
    assert.equal(plain.headers.get("content-disposition"), 'attachment; filename="resume-es.pdf"');
    const unsafe = await ask(
      { request: "file", file: "resume-en", token: "t" },
      env({ PRIVATE_FILES: store({ "file:resume-en": { value: pdf, metadata: { filename: 'x"; evil=1.pdf' } } }) }),
    );
    assert.equal(unsafe.headers.get("content-disposition"), 'attachment; filename="resume-en.pdf"');
  });

  it("releases nothing when Turnstile fails", async () => {
    for (const body of [{ request: "whatsapp", token: "t" }, { request: "file", file: "resume-en", token: "t" }]) {
      const response = await ask(body, env(), false);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), { error: "verification" });
    }
  });

  it("releases nothing without a token", async () => {
    assert.equal((await ask({ request: "whatsapp" })).status, 403);
  });

  it("refuses requests that are not same-origin JSON", async () => {
    assert.equal((await ask({ request: "whatsapp", token: "t" }, env(), true, { origin: null })).status, 403);
    assert.equal((await ask({ request: "whatsapp", token: "t" }, env(), true, { origin: "https://evil.example" })).status, 403);
    assert.equal((await ask({ request: "whatsapp", token: "t" }, env(), true, { origin: "not a url" })).status, 403);
    assert.equal((await ask({ request: "whatsapp", token: "t" }, env(), true, { contentType: "text/plain" })).status, 415);
    assert.equal((await ask("{ not json", env())).status, 400);
    assert.equal((await ask({ request: "whatsapp", token: "x".repeat(20_000) })).status, 413);
  });

  it("rejects unknown requests and file IDs that could be paths, before checking Turnstile", async () => {
    let called = false;
    const spy = (async () => ((called = true), { ok: true, json: async () => ({ success: true }) })) as unknown as typeof fetch;
    for (const body of [
      {},
      [],
      { request: "everything", token: "t" },
      { request: "file", token: "t" },
      { request: "file", file: "../secret", token: "t" },
      { request: "file", file: "resume-en/../../x", token: "t" },
      { request: "file", file: "Resume", token: "t" },
      { request: "file", file: "a".repeat(65), token: "t" },
    ]) {
      const response = await handleProtectedRequest(post(body), env(), spy);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
    assert.equal(called, false);
  });

  it("answers 404 for a file that is not stored, and does not reach other namespaces' keys", async () => {
    const response = await ask({ request: "file", file: "resume-de", token: "t" });
    assert.equal(response.status, 404);
  });

  it("fails closed when its configuration is missing", async () => {
    assert.equal((await ask({ request: "whatsapp", token: "t" }, env({ TURNSTILE_SECRET_KEY: undefined }))).status, 500);
    assert.equal((await ask({ request: "whatsapp", token: "t" }, env({ WHATSAPP_NUMBER: undefined }))).status, 500);
    assert.equal((await ask({ request: "whatsapp", token: "t" }, env({ WHATSAPP_NUMBER: "call me" }))).status, 500);
    assert.equal((await ask({ request: "file", file: "resume-en", token: "t" }, env({ PRIVATE_FILES: undefined }))).status, 500);
  });
});

describe("clearance cookie in handleProtectedRequest", () => {
  const now = Date.UTC(2026, 10, 22, 12, 0, 0);
  const call = (body: unknown, options: { cookie?: string; pass?: boolean; at?: number; url?: string; fetchImpl?: typeof fetch; environment?: ProtectedEnv } = {}) => {
    const request = new Request(options.url ?? "https://site.example/api/protected", {
      method: "POST",
      headers: { "content-type": "application/json", origin: new URL(options.url ?? "https://site.example").origin, ...(options.cookie ? { cookie: options.cookie } : {}) },
      body: JSON.stringify(body),
    });
    return handleProtectedRequest(request, options.environment ?? env(), options.fetchImpl ?? turnstile(options.pass ?? true), options.at ?? now);
  };
  const cookieFrom = (response: Response) => response.headers.get("set-cookie")?.split(";")[0] ?? "";
  const neverCalled = (async () => { throw new Error("Turnstile must not be asked"); }) as typeof fetch;

  it("sets a clearance cookie after a passed check, and only then", async () => {
    const passed = await call({ request: "whatsapp", token: "t" });
    assert.match(passed.headers.get("set-cookie") ?? "", /^human=v1\.\d+\.[\w-]+; Max-Age=600; Path=\/api\/protected; HttpOnly; SameSite=Strict; Secure$/);
    assert.equal((await call({ request: "whatsapp", token: "t" }, { pass: false })).headers.get("set-cookie"), null);
    assert.equal((await call({ request: "file", file: "resume-de", token: "t" })).headers.get("set-cookie"), null, "no cookie on a 404");
    assert.ok(!(await call({ request: "whatsapp", token: "t" }, { url: "http://localhost:8788/api/protected" })).headers.get("set-cookie")?.includes("Secure"));
  });

  it("lets the same browser fetch several things with one check, without asking Turnstile again", async () => {
    const cookie = cookieFrom(await call({ request: "whatsapp", token: "t" }));
    const whatsapp = await call({ request: "whatsapp" }, { cookie, fetchImpl: neverCalled });
    assert.equal(whatsapp.status, 200);
    assert.equal(whatsapp.headers.get("set-cookie"), null, "an existing clearance is not extended");
    const resume = await call({ request: "file", file: "resume-en" }, { cookie, fetchImpl: neverCalled });
    assert.equal(resume.status, 200);
    assert.equal(resume.headers.get("content-type"), "application/pdf");
  });

  it("still validates the request itself when cleared", async () => {
    const cookie = cookieFrom(await call({ request: "whatsapp", token: "t" }));
    assert.equal((await call({ request: "file", file: "../x" }, { cookie, fetchImpl: neverCalled })).status, 400);
    assert.equal((await call({ request: "file", file: "resume-de" }, { cookie, fetchImpl: neverCalled })).status, 404);
  });

  it("asks for a fresh check once the clearance has expired", async () => {
    const cookie = cookieFrom(await call({ request: "whatsapp", token: "t" }));
    const later = now + 11 * 60 * 1000;
    assert.equal((await call({ request: "whatsapp" }, { cookie, at: later, pass: false })).status, 403);
    assert.equal((await call({ request: "whatsapp", token: "t" }, { cookie, at: later })).status, 200);
  });

  it("does not accept a clearance made under another secret or a forged one", async () => {
    const cookie = cookieFrom(await call({ request: "whatsapp", token: "t" }, { environment: env({ TURNSTILE_SECRET_KEY: "other" }) }));
    assert.equal((await call({ request: "whatsapp" }, { cookie, pass: false })).status, 403);
    assert.equal((await call({ request: "whatsapp" }, { cookie: "human=v1.9999999999.AAAA", pass: false })).status, 403);
  });

  it("reports a bad server secret as the site's failure, with no cookie, not as a failed spam check", async () => {
    const badSecret = (async () => ({ ok: false, status: 400, json: async () => ({ success: false, "error-codes": ["invalid-input-secret"] }) })) as unknown as typeof fetch;
    const response = await call({ request: "whatsapp", token: "t" }, { fetchImpl: badSecret });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "failed" });
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

