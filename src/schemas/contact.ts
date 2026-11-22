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
/**
 * A message form on the site itself. It holds no address: the message goes to `/api/contact`, which
 * checks Turnstile and forwards it to an inbox kept in server-side secrets (ADR 0009). The page's
 * Turnstile site key is in the site config.
 */
const formChannel = z.strictObject({ id: slug, type: z.literal("form") });
/**
 * WhatsApp without the number in the page: a button that, after Turnstile, asks `/api/protected`
 * for the link. The number is a server-side secret (ADR 0010).
 */
const whatsappRevealChannel = z.strictObject({ id: slug, type: z.literal("whatsapp-reveal") });
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
export const contactChannel = z.discriminatedUnion("type", [emailChannel, whatsappChannel, whatsappRevealChannel, formChannel, profileChannel]);

export type ContactChannel = z.output<typeof contactChannel>;
