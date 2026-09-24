import type { ContactChannel, ProfileNetwork } from "../schemas/contact.ts";

/** Attributes for an `<a>` element. External pages open in a new tab without access to this one. */
export interface LinkAttributes {
  readonly href: string;
  readonly target?: "_blank";
  readonly rel?: "noopener noreferrer";
}

const external = (href: string): LinkAttributes => ({ href, target: "_blank", rel: "noopener noreferrer" });

/** Brand names are proper nouns and are not translated. */
const networkNames: Record<ProfileNetwork, string> = { github: "GitHub", linkedin: "LinkedIn" };

export function contactLink(channel: ContactChannel): LinkAttributes {
  switch (channel.type) {
    case "email":
      return { href: `mailto:${channel.address}` };
    case "whatsapp":
      return external(`https://wa.me/${channel.phone.slice(1)}`);
    case "profile":
      return external(channel.url);
  }
}

/** Visible name of a channel: the address for email, the service name otherwise. */
export function contactLabel(channel: ContactChannel): string {
  switch (channel.type) {
    case "email":
      return channel.address;
    case "whatsapp":
      return "WhatsApp";
    case "profile":
      return networkNames[channel.network];
  }
}
