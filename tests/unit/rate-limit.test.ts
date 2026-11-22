import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pseudonym, takeOne, type CounterStore, type RateRule } from "../../src/capabilities/rate-limit.ts";

function fakeStore() {
  const data = new Map<string, { value: string; ttl: number }>();
  const store: CounterStore = {
    async get(key) {
      return data.get(key)?.value ?? null;
    },
    async put(key, value, options) {
      data.set(key, { value, ttl: options.expirationTtl });
    },
  };
  return { store, data };
}

const hour: RateRule = { name: "visitor", limit: 2, windowSeconds: 3600 };
const day: RateRule = { name: "site", limit: 3, windowSeconds: 86_400 };
const at = (hours: number) => Date.UTC(2026, 10, 22, 0, 0, 0) + hours * 3_600_000;

describe("takeOne", () => {
  it("allows up to the limit, then refuses with the time until the window ends", async () => {
    const { store } = fakeStore();
    const uses = [{ rule: hour, subject: "a" }];
    assert.deepEqual(await takeOne(store, uses, at(0)), { allowed: true });
    assert.deepEqual(await takeOne(store, uses, at(0) + 1000), { allowed: true });
    const refused = await takeOne(store, uses, at(0) + 30 * 60_000);
    assert.equal(refused.allowed, false);
    assert.equal(refused.blockedBy, "visitor");
    assert.equal(refused.retryAfterSeconds, 30 * 60);
  });

  it("starts a fresh allowance when the window rolls over", async () => {
    const { store } = fakeStore();
    const uses = [{ rule: hour, subject: "a" }];
    await takeOne(store, uses, at(0));
    await takeOne(store, uses, at(0));
    assert.equal((await takeOne(store, uses, at(0))).allowed, false);
    assert.equal((await takeOne(store, uses, at(1))).allowed, true);
  });

  it("keeps visitors apart", async () => {
    const { store } = fakeStore();
    for (let i = 0; i < 2; i++) await takeOne(store, [{ rule: hour, subject: "a" }], at(0));
    assert.equal((await takeOne(store, [{ rule: hour, subject: "a" }], at(0))).allowed, false);
    assert.equal((await takeOne(store, [{ rule: hour, subject: "b" }], at(0))).allowed, true);
  });

  it("refuses without counting anything when any rule is full, and says which", async () => {
    const { store, data } = fakeStore();
    for (const subject of ["a", "b", "c"]) await takeOne(store, [{ rule: hour, subject }, { rule: day, subject: "all" }], at(0));
    const before = new Map([...data].map(([key, entry]) => [key, entry.value]));
    const refused = await takeOne(store, [{ rule: hour, subject: "d" }, { rule: day, subject: "all" }], at(0));
    assert.deepEqual([refused.allowed, refused.blockedBy], [false, "site"]);
    assert.deepEqual(new Map([...data].map(([key, entry]) => [key, entry.value])), before, "a refused use must not be counted");
  });

  it("sets expiry on every counter so none outlive their window, never below KV's minimum", async () => {
    const { store, data } = fakeStore();
    await takeOne(store, [{ rule: hour, subject: "a" }, { rule: day, subject: "all" }], at(0) + 3_599_000);
    for (const { ttl } of data.values()) assert.ok(ttl >= 60, `ttl ${ttl}`);
    assert.ok(data.size === 2);
  });

  it("treats a corrupted counter as empty instead of failing", async () => {
    const { store, data } = fakeStore();
    data.set(`rl:visitor:a:${Math.floor(at(0) / 1000 / 3600)}`, { value: "not a number", ttl: 60 });
    assert.equal((await takeOne(store, [{ rule: hour, subject: "a" }], at(0))).allowed, true);
  });
});

describe("pseudonym", () => {
  it("is stable, distinct per visitor, and does not contain the address", async () => {
    const first = await pseudonym("203.0.113.9");
    assert.equal(first, await pseudonym("203.0.113.9"));
    assert.notEqual(first, await pseudonym("203.0.113.10"));
    assert.match(first, /^[0-9a-f]{24}$/);
    assert.ok(!first.includes("203"));
  });
});
