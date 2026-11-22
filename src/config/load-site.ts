import type { z } from "astro/zod";
import { createPortfolioSchema, portfolioLocalesSchema, type Portfolio } from "../schemas/portfolio.ts";
import { siteConfigSchema, type SiteConfig } from "../schemas/site-config.ts";
import { colorPaletteSchema, themeSchema, typographySchema, type Theme, type Typography } from "../schemas/theme.ts";
import type { Locales } from "../schemas/shared.ts";
import { toSemanticColors, type SemanticColors } from "../themes/semantic-colors.ts";
import { SiteLoadError, formatPath, type SiteLoadIssue } from "./errors.ts";

/** Source of raw file contents, so loading can run without the file system (e.g. in tests). */
export interface SourceReader {
  /** Returns the file's text, or `undefined` when the file does not exist. */
  readText(relativePath: string): string | undefined;
  /** Returns whether a validated root-relative path has a corresponding public file. */
  hasPublicFile(sitePath: string): boolean;
  /** Returns whether a validated image path has a corresponding file below `src/assets/`. */
  hasAssetFile(imagePath: string): boolean;
}

export interface ResolvedTheme {
  readonly id: string;
  readonly colorMode: SiteConfig["colorMode"];
  /** Both validated palettes are exposed so the presentation layer can switch modes without reloading data. */
  readonly colorModes: Readonly<Record<SiteConfig["colorMode"], SemanticColors>>;
  readonly tokens: Omit<Theme["tokens"], "colorPalette" | "typography"> & {
    readonly typography: Typography;
  };
  readonly variants: Theme["variants"];
}

export interface SiteData {
  readonly portfolio: Portfolio;
  readonly siteConfig: SiteConfig;
  readonly theme: ResolvedTheme;
}

export const sourcePaths = {
  portfolio: "content/portfolio.json",
  siteConfig: "content/site-config.json",
  themeFile: (id: string) => `themes/${id}.json`,
} as const;

const supportedSchemaVersions: readonly number[] = [1];

/**
 * Loads and validates the site's configuration, content and theme.
 *
 * Each file goes through: read → parse JSON → check schemaVersion → validate schema.
 * Then theme IDs are resolved to files, cross-file references are checked, and the
 * result is deeply frozen. No migrations exist yet: only schemaVersion 1 is accepted.
 * Throws a {@link SiteLoadError} describing every problem found in the failing step.
 */
export function loadSite(reader: SourceReader): SiteData {
  const siteConfig = validate(sourcePaths.siteConfig, siteConfigSchema, readJson(reader, sourcePaths.siteConfig));

  const portfolioData = readJson(reader, sourcePaths.portfolio);
  const { site } = validate(sourcePaths.portfolio, portfolioLocalesSchema, portfolioData);
  const [firstLocale, ...otherLocales] = site.supportedLocales;
  const locales: Locales = [firstLocale, ...otherLocales];
  const portfolio = validate(sourcePaths.portfolio, createPortfolioSchema(locales), portfolioData);

  checkReferences(siteConfig, portfolio);
  checkPublicFiles(reader, portfolio);
  checkAssetFiles(reader, portfolio);

  const theme = loadReferenced(reader, "theme", siteConfig.theme, themeSchema, sourcePaths.siteConfig, "theme");
  const themePath = sourcePaths.themeFile(siteConfig.theme);
  const palette = loadReferenced(reader, "color palette", theme.tokens.colorPalette, colorPaletteSchema, themePath, "tokens.colorPalette");
  const typography = loadReferenced(reader, "typography", theme.tokens.typography, typographySchema, themePath, "tokens.typography");

  if (theme.id !== siteConfig.theme) {
    throw new SiteLoadError("resolution", [
      { file: themePath, path: "id", message: `is "${theme.id}" but the file is loaded as theme "${siteConfig.theme}"; they must match` },
    ]);
  }

  const colorModes = {
    light: toSemanticColors(palette.light),
    dark: toSemanticColors(palette.dark),
  } as const;
  const { colorPalette: _palette, typography: _typography, ...tokens } = theme.tokens;
  return deepFreeze({
    portfolio,
    siteConfig,
    theme: {
      id: theme.id,
      colorMode: siteConfig.colorMode,
      colorModes,
      tokens: { ...tokens, typography },
      variants: theme.variants,
    },
  });
}

function readJson(reader: SourceReader, file: string): unknown {
  const text = reader.readText(file);
  if (text === undefined) {
    throw new SiteLoadError("read", [{ file, path: "", message: "file not found" }]);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new SiteLoadError("parse", [{ file, path: "", message: (error as Error).message }]);
  }

  const version = typeof data === "object" && data !== null ? (data as { schemaVersion?: unknown }).schemaVersion : undefined;
  if (typeof version !== "number" || !supportedSchemaVersions.includes(version)) {
    const found = version === undefined ? "is missing" : `is ${JSON.stringify(version)}`;
    throw new SiteLoadError("unsupported-version", [
      { file, path: "schemaVersion", message: `${found}; supported versions: ${supportedSchemaVersions.join(", ")}` },
    ]);
  }
  return data;
}

function validate<S extends z.ZodType>(file: string, schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new SiteLoadError(
      "schema",
      result.error.issues.map((issue) => ({ file, path: formatPath(issue.path), message: issue.message })),
    );
  }
  return result.data;
}

/** Loads a file named by an ID in another file; a missing file is reported against the referencing field. */
function loadReferenced<S extends z.ZodType>(
  reader: SourceReader,
  kind: string,
  id: string,
  schema: S,
  referencedFrom: string,
  referencingPath: string,
): z.output<S> {
  const file = sourcePaths.themeFile(id);
  if (reader.readText(file) === undefined) {
    throw new SiteLoadError("resolution", [
      { file: referencedFrom, path: referencingPath, message: `unknown ${kind} "${id}": ${file} does not exist` },
    ]);
  }
  return validate(file, schema, readJson(reader, file));
}

function checkReferences(siteConfig: SiteConfig, portfolio: Portfolio): void {
  const issues: SiteLoadIssue[] = [];
  const configFile = sourcePaths.siteConfig;

  if (siteConfig.siteId !== portfolio.site.id) {
    issues.push({
      file: configFile,
      path: "siteId",
      message: `is "${siteConfig.siteId}" but ${sourcePaths.portfolio} has site.id "${portfolio.site.id}"`,
    });
  }

  const enabledSections = new Set(siteConfig.layout.sections.filter((section) => section.enabled).map((section) => section.id));
  const labels = new Map(portfolio.navigation.map((entry) => [entry.id, entry]));

  siteConfig.navigation.forEach((entry, index) => {
    const label = labels.get(entry.labelKey);
    if (!label) {
      issues.push({
        file: configFile,
        path: `navigation[${index}].labelKey`,
        message: `"${entry.labelKey}" has no label in ${sourcePaths.portfolio} navigation (known: ${[...labels.keys()].join(", ")})`,
      });
    } else if (!enabledSections.has(label.target)) {
      issues.push({
        file: configFile,
        path: `navigation[${index}].labelKey`,
        message: `"${entry.labelKey}" links to section "${label.target}", which is not enabled in layout.sections`,
      });
    }
  });

  // Each enabled section takes its heading from the one label that targets it.
  const headingTargets = new Set<string>();
  portfolio.navigation.forEach((entry, index) => {
    if (headingTargets.has(entry.target)) {
      issues.push({
        file: sourcePaths.portfolio,
        path: `navigation[${index}].target`,
        message: `section "${entry.target}" is already targeted by another entry; each section has one heading`,
      });
    }
    headingTargets.add(entry.target);
  });
  for (const sectionId of enabledSections) {
    if (!headingTargets.has(sectionId)) {
      issues.push({ file: sourcePaths.portfolio, path: "navigation", message: `has no entry targeting enabled section "${sectionId}"` });
    }
  }

  const channelIds = new Set(portfolio.contact.channels.map((channel) => channel.id));
  if (!channelIds.has(portfolio.profile.hero.primaryAction.channel)) {
    issues.push({
      file: sourcePaths.portfolio,
      path: "profile.hero.primaryAction.channel",
      message: `"${portfolio.profile.hero.primaryAction.channel}" is not a channel in contact.channels (known: ${[...channelIds].join(", ")})`,
    });
  }

  portfolio.profile.hero.secondaryActions.forEach((action, index) => {
    if (action.type === "section" && !enabledSections.has(action.target)) {
      issues.push({
        file: sourcePaths.portfolio,
        path: `profile.hero.secondaryActions[${index}].target`,
        message: `section "${action.target}" is not enabled in ${configFile} layout.sections`,
      });
    }
  });

  if (issues.length > 0) throw new SiteLoadError("resolution", issues);
}

/** Ensures every required local media/download path has a file below the public directory. */
function checkPublicFiles(reader: SourceReader, portfolio: Portfolio): void {
  const references: Array<{ path: string; sitePath: string }> = [
    ...portfolio.certifications.flatMap((group, groupIndex) =>
      group.items.map((certification, index) => ({
        path: `certifications[${groupIndex}].items[${index}].preview`,
        sitePath: certification.preview,
      })),
    ),
  ];
  const issues = references
    .filter((reference) => !reader.hasPublicFile(reference.sitePath))
    .map((reference) => ({
      file: sourcePaths.portfolio,
      path: reference.path,
      message: `references missing public file "${reference.sitePath}"`,
    }));

  if (issues.length > 0) throw new SiteLoadError("resolution", issues);
}

/** Ensures every referenced build-time image exists below src/assets/. */
function checkAssetFiles(reader: SourceReader, portfolio: Portfolio): void {
  const { src } = portfolio.profile.avatar;
  if (!reader.hasAssetFile(src)) {
    throw new SiteLoadError("resolution", [
      { file: sourcePaths.portfolio, path: "profile.avatar.src", message: `references missing image "src/assets/${src}"` },
    ]);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
