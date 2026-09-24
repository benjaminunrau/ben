import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { localeRoute, localeSeoLinks } from "../../src/application/locale-routes.ts";
import { siteConfigSchema } from "../../src/schemas/site-config.ts";

describe("localeSeoLinks", () => {
  const links = localeSeoLinks("https://example.com", "es", ["en", "es", "de"], "en");

  it("makes the page's own locale route canonical", () => {
    assert.equal(localeRoute("es"), "/es/");
    assert.equal(links.canonical, "https://example.com/es/");
  });

  it("lists every locale plus an x-default pointing at the default locale", () => {
    assert.deepEqual(links.alternates, [
      { hreflang: "en", href: "https://example.com/en/" },
      { hreflang: "es", href: "https://example.com/es/" },
      { hreflang: "de", href: "https://example.com/de/" },
      { hreflang: "x-default", href: "https://example.com/en/" },
    ]);
  });
});

describe("siteConfig publicUrl", () => {
  const publicUrl = siteConfigSchema.shape.publicUrl;

  it("accepts an https origin, with or without a trailing slash", () => {
    assert.equal(publicUrl.safeParse("https://example.com").success, true);
    assert.equal(publicUrl.safeParse("https://example.com/").success, true);
  });

  it("rejects anything that is not a bare https origin", () => {
    for (const value of ["http://example.com", "https://example.com/portfolio/", "https://example.com/?ref=x", "https://user@example.com"]) {
      assert.equal(publicUrl.safeParse(value).success, false, value);
    }
  });
});
