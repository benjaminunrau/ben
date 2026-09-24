import { z } from "astro/zod";
import { portfolioSectionId } from "./portfolio.ts";
import { safeExternalUrl, slug, withUniqueIds } from "./shared.ts";

export const siteConfigSchema = z.strictObject({
  schemaVersion: z.literal(1),
  /** Must equal the content's `site.id`, so config and content cannot be mismatched. */
  siteId: slug,
  /**
   * Public origin the site is deployed at, such as "https://example.com". Absent until the site
   * has a deployment; canonical and alternate-language links are only generated when it is set.
   */
  publicUrl: safeExternalUrl
    .refine((value) => {
      const url = new URL(value);
      return url.pathname === "/" && url.search === "" && url.hash === "" && url.username === "" && url.password === "";
    }, 'must be an origin only, such as "https://example.com" (no path, query, fragment or credentials)')
    .optional(),
  /** File name (without .json) of a theme in themes/. */
  theme: slug,
  colorMode: z.enum(["light", "dark"]),
  layout: z.strictObject({
    navigation: z
      .strictObject({ showLabels: z.boolean(), showIcons: z.boolean() })
      .refine((navigation) => navigation.showLabels || navigation.showIcons, "must show labels, icons, or both"),
    /** Rendered in this order; disabled sections are omitted. */
    sections: withUniqueIds(z.strictObject({ id: portfolioSectionId, enabled: z.boolean() })),
  }),
  navigation: withUniqueIds(
    z.strictObject({
      id: slug,
      /** ID of an entry in the content's `navigation` list; the link goes to that entry's section. */
      labelKey: slug,
      icon: slug,
    }),
  ),
});

export type SiteConfig = z.output<typeof siteConfigSchema>;
