import { z } from "astro/zod";
import { emailAddress, safeExternalUrl, slug } from "./shared.ts";

/**
 * International phone number, stored in E.164 form ("+595981123456").
 * Spaces, dots, dashes and parentheses are accepted in input and removed.
 */
export const phoneNumber = z
  .string()
  .transform((value) => value.replaceAll(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, 'must be an international phone number starting with "+", such as "+595 981 123456"'));

/** Profile networks the framework can link to, with the host their URLs must use. */
export const profileNetworkHosts = {
  github: "github.com",
  linkedin: "linkedin.com",
} as const;
export type ProfileNetwork = keyof typeof profileNetworkHosts;

const profileNetwork = z.enum(Object.keys(profileNetworkHosts) as [ProfileNetwork, ...ProfileNetwork[]]);

const emailChannel = z.strictObject({ id: slug, type: z.literal("email"), address: emailAddress });
const whatsappChannel = z.strictObject({ id: slug, type: z.literal("whatsapp"), phone: phoneNumber });
const profileChannel = z
  .strictObject({ id: slug, type: z.literal("profile"), network: profileNetwork, url: safeExternalUrl })
  .refine(
    (channel) => {
      const host = new URL(channel.url).hostname;
      const expected = profileNetworkHosts[channel.network];
      return host === expected || host.endsWith(`.${expected}`);
    },
    { path: ["url"], message: "must be on the network's own domain" },
  );

/**
 * A way for a visitor to reach the site owner outside the site. Serializable data only;
 * links are built by `src/capabilities/contact-links.ts`.
 */
export const contactChannel = z.discriminatedUnion("type", [emailChannel, whatsappChannel, profileChannel]);

export type ContactChannel = z.output<typeof contactChannel>;
