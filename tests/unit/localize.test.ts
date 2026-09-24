import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localize, localizer } from "../../src/application/localize.ts";

describe("localize", () => {
  const title = { en: "Portfolio", es: "Portafolio" };

  it("returns the value for the requested locale", () => {
    assert.equal(localize(title, "es"), "Portafolio");
    assert.deepEqual(localizer("en")({ en: ["a", "b"], es: ["c", "d"] }), ["a", "b"]);
  });

  it("throws instead of silently falling back when the locale is missing", () => {
    assert.throws(() => localize(title, "de"), /No value for locale "de" \(available: en, es\)/);
  });
});
