import { z } from "astro/zod";
import { contactChannel } from "./contact.ts";
import {
  imagePath,
  localeCode,
  localized,
  localizedList,
  localizedText,
  nonEmptyText,
  sitePath,
  slug,
  withUniqueIds,
  yearMonth,
  type Locales,
} from "./shared.ts";

/** Page sections the portfolio renderer knows how to place. */
export const portfolioSectionIds = [
  "about",
  "skills",
  "experience",
  "education",
  "certifications",
  "languages",
  "contact",
] as const;
export const portfolioSectionId = z.enum(portfolioSectionIds);

/**
 * Read before the full schema: the full schema needs the supported locales to know which
 * translations are required.
 */
export const portfolioLocalesSchema = z.object({
  site: z.object({
    defaultLocale: localeCode,
    supportedLocales: z
      .array(localeCode)
      .min(1, "must list at least one locale")
      .refine((locales) => new Set(locales).size === locales.length, "must not repeat a locale"),
  }),
}).refine((value) => value.site.supportedLocales.includes(value.site.defaultLocale), {
  path: ["site", "defaultLocale"],
  message: "must be one of site.supportedLocales",
});

export function createPortfolioSchema(locales: Locales) {
  const text = localizedText(locales);
  const list = localizedList(locales);

  /** `end: null` means ongoing. `display` is editorial text shown as written. */
  const dateRange = z
    .strictObject({ start: yearMonth, end: yearMonth.nullable(), display: text })
    .refine((range) => range.end === null || range.end >= range.start, {
      path: ["end"],
      message: "must not be earlier than start",
    });

  /** Opens one of `contact.channels`, referenced by its ID. */
  const contactAction = z.strictObject({ type: z.literal("contact"), label: text, channel: slug });
  const sectionAction = z.strictObject({ type: z.literal("section"), label: text, target: portfolioSectionId });
  /** Downloads the visitor's-locale file from `resume.files`. */
  const resumeAction = z.strictObject({ type: z.literal("resume"), label: text });
  const footerCopyright = localized(
    locales,
    nonEmptyText.refine(
      (value) => value.includes("{year}") && value.includes("{author}"),
      'must include both "{year}" and "{author}" placeholders',
    ),
  );

  return z.strictObject({
    schemaVersion: z.literal(1),
    site: z.strictObject({
      id: slug,
      type: z.literal("professional-portfolio"),
      defaultLocale: localeCode,
      supportedLocales: z.array(localeCode),
      title: text,
      description: text,
      ui: z.strictObject({
        languageSelector: text,
        primaryNavigation: text,
        siteControls: text,
        viewCertificate: text,
        backToTop: text,
        technologies: text,
        coursework: text,
        switchToLightTheme: text,
        switchToDarkTheme: text,
        footer: z.strictObject({
          socialLinks: text,
          sendEmail: text,
          downloadResume: text,
          builtBy: text,
          copyright: footerCopyright,
        }),
        proficiency: z.strictObject({ native: text, fluent: text, professional: text }),
      }),
      author: nonEmptyText,
    }),
    profile: z.strictObject({
      fullName: nonEmptyText,
      /** Portrait shown beside the name and as the back-to-top button. */
      avatar: z.strictObject({ src: imagePath, alt: text }),
      hero: z.strictObject({
        role: text,
        valueProposition: text,
        availability: text,
        primaryAction: contactAction,
        secondaryActions: z.array(z.discriminatedUnion("type", [sectionAction, resumeAction])),
      }),
      about: z.strictObject({ shortBio: list }),
    }),
    skills: withUniqueIds(
      z.strictObject({
        id: slug,
        category: text,
        items: z.array(z.strictObject({ name: nonEmptyText, icon: slug })).min(1, "must contain at least one skill"),
      }),
    ),
    workExperience: withUniqueIds(
      z.strictObject({
        id: slug,
        company: nonEmptyText,
        role: text,
        dates: dateRange,
        description: text,
        responsibilities: list,
        technologies: list,
      }),
    ),
    education: withUniqueIds(
      z.strictObject({
        id: slug,
        institution: nonEmptyText,
        degree: text,
        dates: dateRange,
        description: list,
        coursework: list,
      }),
    ),
    languages: withUniqueIds(
      z.strictObject({
        id: slug,
        nativeName: nonEmptyText,
        level: z.enum(["native", "fluent", "professional"]),
      }),
    ),
    certifications: withUniqueIds(
      z.strictObject({
        id: slug,
        category: text,
        items: withUniqueIds(
          z.strictObject({ id: slug, name: text, issuer: nonEmptyText, preview: sitePath }),
        ).min(1, "must contain at least one certification"),
      }),
    ),
    contact: z.strictObject({
      intro: text,
      /** Listed in this order wherever channels are shown. */
      channels: withUniqueIds(contactChannel).min(1, "must list at least one channel"),
    }),
    resume: z.strictObject({ files: localized(locales, sitePath) }),
    /** Section names: each is the heading of its `target` section and can be referenced by navigation. */
    navigation: withUniqueIds(z.strictObject({ id: slug, label: text, target: portfolioSectionId })),
  });
}

export type Portfolio = z.output<ReturnType<typeof createPortfolioSchema>>;
