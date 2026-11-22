import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearanceCookie, clearanceSeconds, hasClearance, issueClearance } from "../../src/capabilities/clearance.ts";

const now = Date.UTC(2026, 10, 22, 12, 0, 0);
const cookieWith = (value: string) => `human=${value}`;

describe("clearance cookie", () => {
  it("accepts a freshly issued clearance, also among other cookies", async () => {
    const value = await issueClearance("secret", now);
    assert.equal(await hasClearance(cookieWith(value), "secret", now), true);
    assert.equal(await hasClearance(`theme=dark; human=${value}; other=1`, "secret", now), true);
  });

  it("expires after its lifetime, not before", async () => {
    const value = await issueClearance("secret", now);
    assert.equal(await hasClearance(cookieWith(value), "secret", now + (clearanceSeconds - 1) * 1000), true);
    assert.equal(await hasClearance(cookieWith(value), "secret", now + clearanceSeconds * 1000), false);
    assert.equal(await hasClearance(cookieWith(value), "secret", now + 86_400_000), false);
  });

  it("is rejected under any other secret, so rotating the secret ends every clearance", async () => {
    const value = await issueClearance("secret", now);
    assert.equal(await hasClearance(cookieWith(value), "another-secret", now), false);
  });

  it("is rejected when the expiry or the signature is altered", async () => {
    const [tag, expiry, signature] = (await issueClearance("secret", now)).split(".");
    const later = String(Number(expiry) + 86_400);
    assert.equal(await hasClearance(cookieWith(`${tag}.${later}.${signature}`), "secret", now), false);
    const flipped = signature!.startsWith("A") ? `B${signature!.slice(1)}` : `A${signature!.slice(1)}`;
    assert.equal(await hasClearance(cookieWith(`${tag}.${expiry}.${flipped}`), "secret", now), false);
    assert.equal(await hasClearance(cookieWith(`v2.${expiry}.${signature}`), "secret", now), false);
  });

  it("rejects missing, empty and malformed cookies without throwing", async () => {
    for (const header of [null, "", "theme=dark", "human=", "human=garbage", "human=v1..", "human=v1.abc.def", "human=v1.99999999999999.AAAA", "human=v1.1.2.3.4", `human=v1.${Math.floor(now / 1000) + 60}.%%%`]) {
      assert.equal(await hasClearance(header, "secret", now), false, String(header));
    }
  });

  it("is a cookie only the protected endpoint receives, unreadable by page scripts", () => {
    const attributes = clearanceCookie("v1.1.x", true).split("; ");
    assert.deepEqual(attributes.slice(1).sort(), ["HttpOnly", "Max-Age=600", "Path=/api/protected", "SameSite=Strict", "Secure"].sort());
    assert.ok(!clearanceCookie("v1.1.x", false).includes("Secure"), "Secure only over https");
  });
});
