/**
 * Fixed-window counters over a key-value store, to cap how many contact messages one visitor, and
 * the whole site, can send (ADR 0009). Plain TypeScript with an injected store, so it runs on
 * Workers KV and is unit-tested with a fake. KV is eventually consistent, so two requests in the
 * same instant can both slip through; the limits are a brake on abuse, not an exact meter.
 */

/** The part of a Workers KV namespace this code uses. */
export interface CounterStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
}

export interface RateRule {
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export interface RateDecision {
  readonly allowed: boolean;
  /** When refused: the rule that refused, and how long until its window ends. */
  readonly blockedBy?: string;
  readonly retryAfterSeconds?: number;
}

/** KV refuses a time-to-live below a minute. */
const minimumTtlSeconds = 60;

/** A short, stable, non-reversible label for a visitor, so raw IP addresses are never stored. */
export async function pseudonym(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest).slice(0, 12)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Counts one use against every rule, or refuses without counting anything if any rule is full.
 * Each rule applies to its own subject (for example one visitor, or "all").
 */
export async function takeOne(
  store: CounterStore,
  uses: ReadonlyArray<{ readonly rule: RateRule; readonly subject: string }>,
  nowMs: number,
): Promise<RateDecision> {
  const nowSeconds = Math.floor(nowMs / 1000);
  const slots = uses.map(({ rule, subject }) => {
    const window = Math.floor(nowSeconds / rule.windowSeconds);
    return { rule, key: `rl:${rule.name}:${subject}:${window}`, endsInSeconds: (window + 1) * rule.windowSeconds - nowSeconds };
  });

  const counts = await Promise.all(slots.map(async (slot) => Number((await store.get(slot.key)) ?? 0) || 0));
  const full = slots.findIndex((slot, index) => counts[index]! >= slot.rule.limit);
  if (full !== -1) return { allowed: false, blockedBy: slots[full]!.rule.name, retryAfterSeconds: slots[full]!.endsInSeconds };

  await Promise.all(
    slots.map((slot, index) => store.put(slot.key, String(counts[index]! + 1), { expirationTtl: Math.max(minimumTtlSeconds, slot.endsInSeconds + minimumTtlSeconds) })),
  );
  return { allowed: true };
}
