import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileSystemReader } from "../../src/config/file-system-reader.ts";
import { loadSite } from "../../src/config/load-site.ts";

/** Checks the built site in dist/; `npm run test:site` builds it first. */
const root = new URL("../..", import.meta.url).pathname;
const { portfolio, siteConfig } = loadSite(fileSystemReader(root));
const { defaultLocale, supportedLocales } = portfolio.site;

function page(route: string): string {
  const file = `${root}dist${route}index.html`;
  assert.ok(existsSync(file), `${file} was not built; run npm run test:site`);
  return readFileSync(file, "utf8");
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" };
/** First capture group of `pattern`, with the HTML entities Astro escapes decoded. */
const attribute = (html: string, pattern: RegExp) =>
  html.match(pattern)?.[1]?.replaceAll(/&(amp|lt|gt|quot|#39);/g, (_, name: string) => entities[name] ?? "");

describe("built pages", () => {
  for (const locale of supportedLocales) {
    describe(`/${locale}/`, () => {
      const html = page(`/${locale}/`);

      it("declares its language and localized metadata", () => {
        assert.equal(attribute(html, /<html[^>]*\slang="([^"]+)"/), locale);
        assert.equal(attribute(html, /<title>([^<]*)<\/title>/), portfolio.site.title[locale]);
        assert.equal(attribute(html, /<meta name="description" content="([^"]*)"/), portfolio.site.description[locale]);
      });

      it("links to every locale and marks the current one", () => {
        for (const other of supportedLocales) assert.match(html, new RegExp(`href="/${other}/"`));
        assert.match(html, new RegExp(`href="/${locale}/"[^>]*aria-current="page"`));
      });

      it("has canonical and alternate-language links exactly when a public URL is configured", () => {
        const canonical = attribute(html, /<link rel="canonical" href="([^"]+)"/);
        const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)"/g)].map((match) => match[1]);
        if (siteConfig.publicUrl) {
          assert.equal(canonical, new URL(`/${locale}/`, siteConfig.publicUrl).href);
          assert.deepEqual(alternates, [...supportedLocales, "x-default"]);
        } else {
          assert.equal(canonical, undefined);
          assert.deepEqual(alternates, []);
        }
      });

      it("has no in-page link to a missing target", () => {
        const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
        const missing = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]).filter((id) => !ids.has(id));
        assert.deepEqual(missing, []);
      });

      it("scrolls back-to-top links to the start of the page, above the hero and site controls", () => {
        const target = html.indexOf(' id="top"');
        assert.ok(target !== -1, "no #top target");
        assert.ok(target < html.indexOf("<header"), "#top must come before the navbar and hero");
      });

      it("opens new tabs without giving them access to this page", () => {
        for (const [link] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(link, /rel="[^"]*noopener/, link);
      });
    });
  }

  it("serves the default locale at the root, canonical to the default locale's route", () => {
    const html = page("/");
    assert.equal(attribute(html, /<html[^>]*\slang="([^"]+)"/), defaultLocale);
    if (siteConfig.publicUrl) {
      assert.equal(attribute(html, /<link rel="canonical" href="([^"]+)"/), new URL(`/${defaultLocale}/`, siteConfig.publicUrl).href);
    }
  });
});
