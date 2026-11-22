import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileSystemReader } from "../../src/config/file-system-reader.ts";
import { SiteLoadError, type SiteLoadErrorKind } from "../../src/config/errors.ts";
import { loadSite, sourcePaths, type SourceReader } from "../../src/config/load-site.ts";

const repositoryReader = fileSystemReader(new URL("../..", import.meta.url).pathname);

type Json = Record<string, any>;

/** Reads the real repository files, letting a test replace or edit individual files. */
function readerWith(
  overrides: Record<string, string | null | ((data: Json) => void)>,
  missingPublicFiles: readonly string[] = [],
  missingAssetFiles: readonly string[] = [],
): SourceReader {
  return {
    readText(path) {
      const override = overrides[path];
      if (override === undefined) return repositoryReader.readText(path);
      if (override === null) return undefined;
      if (typeof override === "string") return override;
      const data = JSON.parse(repositoryReader.readText(path) ?? "null");
      override(data);
      return JSON.stringify(data);
    },
    hasPublicFile(sitePath) {
      return !missingPublicFiles.includes(sitePath) && repositoryReader.hasPublicFile(sitePath);
    },
    hasAssetFile(imagePath) {
      return !missingAssetFiles.includes(imagePath) && repositoryReader.hasAssetFile(imagePath);
    },
  };
}

function assertLoadError(reader: SourceReader, kind: SiteLoadErrorKind, expected: { file: string; path: string; message?: RegExp }) {
  assert.throws(
    () => loadSite(reader),
    (error: unknown) => {
      assert.ok(error instanceof SiteLoadError, `expected SiteLoadError, got ${String(error)}`);
      assert.equal(error.kind, kind, error.message);
      const issue = error.issues.find((candidate) => candidate.file === expected.file && candidate.path === expected.path);
      assert.ok(issue, `no issue at ${expected.file} → ${expected.path}:\n${error.message}`);
      if (expected.message) assert.match(issue.message, expected.message);
      return true;
    },
  );
}

const portfolio = sourcePaths.portfolio;
const siteConfig = sourcePaths.siteConfig;

describe("loadSite with the repository's content", () => {
  const site = loadSite(repositoryReader);

  it("loads and resolves the theme", () => {
    assert.equal(site.portfolio.site.id, site.siteConfig.siteId);
    assert.equal(site.theme.id, "minimal-dark");
    assert.match(site.theme.colorModes.light.background, /^#[0-9A-F]{6}$/i);
    assert.match(site.theme.colorModes.dark.background, /^#[0-9A-F]{6}$/i);
    assert.equal(site.theme.tokens.typography.h1.fontFamily, "Rubik Mono One");
  });

  it("returns deeply frozen data", () => {
    assert.ok(Object.isFrozen(site));
    assert.ok(Object.isFrozen(site.portfolio.skills[0]?.items));
    assert.ok(Object.isFrozen(site.theme.colorModes.dark));
    assert.ok(Object.isFrozen(site.theme.colorModes));
  });

  it("survives a JSON round trip without loss", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(site)), site);
  });
});

describe("loadSite rejects", () => {
  it("a missing content file", () => {
    assertLoadError(readerWith({ [portfolio]: null }), "read", { file: portfolio, path: "" });
  });

  it("invalid JSON", () => {
    assertLoadError(readerWith({ [siteConfig]: "{ not json" }), "parse", { file: siteConfig, path: "" });
  });

  it("a missing schemaVersion", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => delete data.schemaVersion }), "unsupported-version", {
      file: portfolio,
      path: "schemaVersion",
      message: /missing/,
    });
  });

  it("an unsupported schemaVersion", () => {
    assertLoadError(readerWith({ [siteConfig]: (data) => (data.schemaVersion = 2) }), "unsupported-version", {
      file: siteConfig,
      path: "schemaVersion",
      message: /is 2/,
    });
  });

  it("an unknown field", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.site.theme = "default") }), "schema", {
      file: portfolio,
      path: "site",
    });
  });

  it("a missing translation", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => delete data.site.title.es }), "schema", {
      file: portfolio,
      path: "site.title.es",
    });
  });

  it("a missing framework UI translation", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => delete data.site.ui.viewCertificate.de }), "schema", {
      file: portfolio,
      path: "site.ui.viewCertificate.de",
    });
  });

  it("a translation for an unsupported locale", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.site.title.fr = "Portfolio") }), "schema", {
      file: portfolio,
      path: "site.title",
    });
  });

  it("a default locale that is not supported", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.site.defaultLocale = "fr") }), "schema", {
      file: portfolio,
      path: "site.defaultLocale",
    });
  });

  it("translated lists of different lengths", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => data.profile.about.shortBio.de.pop() }), "schema", {
      file: portfolio,
      path: "profile.about.shortBio",
      message: /same number of entries/,
    });
  });

  it("an invalid email address", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.contact.channels[0] = { id: "message", type: "email", address: "not-an-email" }) }), "schema", {
      file: portfolio,
      path: "contact.channels[0].address",
    });
  });

  it("an unsafe external URL", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.contact.channels[1].url = "javascript:alert(1)") }), "schema", {
      file: portfolio,
      path: "contact.channels[1].url",
      message: /https/,
    });
  });

  it("a site path that escapes the site root", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.certifications[0].items[0].preview = "/assets/../../secret.pdf") }), "schema", {
      file: portfolio,
      path: "certifications[0].items[0].preview",
    });
  });

  it("a required public file that is missing", () => {
    assertLoadError(readerWith({}, ["/images/certifications/Certificados.pdf"]), "resolution", {
      file: portfolio,
      path: "certifications[0].items[0].preview",
      message: /missing public file/,
    });
  });

  it("a résumé file that is not a private file ID", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.resume.files.en = "/assets/resume.pdf") }), "schema", {
      file: portfolio,
      path: "resume.files.en",
    });
  });

  it("a malformed Turnstile site key", () => {
    assertLoadError(readerWith({ [siteConfig]: (data) => (data.turnstileSiteKey = "short") }), "schema", {
      file: siteConfig,
      path: "turnstileSiteKey",
    });
  });

  it("an image path that could leave src/assets", () => {
    for (const src of ["../secret.png", "/profile/face.png", "profile/../../x.png", "profile/face.svg"]) {
      assertLoadError(readerWith({ [portfolio]: (data) => (data.profile.avatar.src = src) }), "schema", {
        file: portfolio,
        path: "profile.avatar.src",
      });
    }
  });

  it("a required image that is missing", () => {
    assertLoadError(readerWith({}, [], ["profile/face.png"]), "resolution", {
      file: portfolio,
      path: "profile.avatar.src",
      message: /missing image/,
    });
  });

  it("an unknown action type", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.profile.hero.secondaryActions[0].type = "teleport") }), "schema", {
      file: portfolio,
      path: "profile.hero.secondaryActions[0].type",
    });
  });

  it("a primary action for a contact channel that does not exist", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.profile.hero.primaryAction.channel = "fax") }), "resolution", {
      file: portfolio,
      path: "profile.hero.primaryAction.channel",
      message: /"fax" is not a channel/,
    });
  });

  it("a date range that ends before it starts", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.workExperience[0].dates.end = "2020-01") }), "schema", {
      file: portfolio,
      path: "workExperience[0].dates.end",
    });
  });

  it("duplicate IDs", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.skills[1].id = data.skills[0].id) }), "schema", {
      file: portfolio,
      path: "skills[1].id",
      message: /duplicate/,
    });
  });

  it("a certification group without certifications", () => {
    assertLoadError(readerWith({ [portfolio]: (data) => (data.certifications[0].items = []) }), "schema", {
      file: portfolio,
      path: "certifications[0].items",
    });
  });

  it("a missing certificate file inside a certification group", () => {
    assertLoadError(readerWith({}, ["/images/certifications/istqb.pdf"]), "resolution", {
      file: portfolio,
      path: "certifications[0].items[1].preview",
      message: /missing public file/,
    });
  });

  it("a section the renderer does not know", () => {
    assertLoadError(readerWith({ [siteConfig]: (data) => data.layout.sections.push({ id: "projects", enabled: false }) }), "schema", {
      file: siteConfig,
      path: "layout.sections[7].id",
    });
  });

  it("navigation that shows neither labels nor icons", () => {
    assertLoadError(
      readerWith({ [siteConfig]: (data) => Object.assign(data.layout.navigation, { showLabels: false, showIcons: false }) }),
      "schema",
      { file: siteConfig, path: "layout.navigation" },
    );
  });

  it("a theme ID that is not a slug", () => {
    assertLoadError(readerWith({ [siteConfig]: (data) => (data.theme = "../content/portfolio") }), "schema", {
      file: siteConfig,
      path: "theme",
    });
  });

  it("an unsafe CSS value in a theme", () => {
    const theme = sourcePaths.themeFile("minimal-dark");
    assertLoadError(readerWith({ [theme]: (data) => (data.tokens.shape.cardRadius = "1rem; } body { display: none") }), "schema", {
      file: theme,
      path: "tokens.shape.cardRadius",
    });
  });

  it("an unknown theme variant", () => {
    const theme = sourcePaths.themeFile("minimal-dark");
    assertLoadError(readerWith({ [theme]: (data) => (data.variants.skillIcons = "rainbow") }), "schema", {
      file: theme,
      path: "variants.skillIcons",
    });
  });

  it("an unknown theme", () => {
    assertLoadError(readerWith({ [siteConfig]: (data) => (data.theme = "does-not-exist") }), "resolution", {
      file: siteConfig,
      path: "theme",
      message: /unknown theme "does-not-exist"/,
    });
  });

  it("a theme whose id does not match its file", () => {
    const theme = sourcePaths.themeFile("minimal-dark");
    assertLoadError(readerWith({ [theme]: (data) => (data.id = "other") }), "resolution", { file: theme, path: "id" });
  });

  it("config and content for different sites", () => {
    assertLoadError(readerWith({ [siteConfig]: (data) => (data.siteId = "someone-else") }), "resolution", {
      file: siteConfig,
      path: "siteId",
    });
  });

  it("a navigation label that does not exist", () => {
    assertLoadError(readerWith({ [siteConfig]: (data) => (data.navigation[0].labelKey = "missing") }), "resolution", {
      file: siteConfig,
      path: "navigation[0].labelKey",
    });
  });

  it("navigation to a disabled section", () => {
    const reader = readerWith({
      [siteConfig]: (data) => {
        data.layout.sections.find((section: Json) => section.id === "contact").enabled = false;
      },
    });
    const contactIndex = JSON.parse(repositoryReader.readText(siteConfig) ?? "{}").navigation.findIndex(
      (entry: Json) => entry.labelKey === "contact",
    );
    assertLoadError(reader, "resolution", {
      file: siteConfig,
      path: `navigation[${contactIndex}].labelKey`,
      message: /not enabled/,
    });
  });

  it("an enabled section without a heading", () => {
    const reader = readerWith({
      [portfolio]: (data) => {
        data.navigation = data.navigation.filter((entry: Json) => entry.target !== "languages");
      },
    });
    assertLoadError(reader, "resolution", { file: portfolio, path: "navigation", message: /"languages"/ });
  });

  it("two headings for the same section", () => {
    const reader = readerWith({
      [portfolio]: (data) => {
        data.navigation.find((entry: Json) => entry.id === "languages").target = "about";
      },
    });
    assertLoadError(reader, "resolution", { file: portfolio, path: "navigation[1].target", message: /already targeted/ });
  });
});
