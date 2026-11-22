/**
 * Contact form behavior shared by the page, the `/api/contact` Pages Function and the mailer
 * Worker (ADR 0009). Plain TypeScript with no framework or Cloudflare imports, so it is unit-tested
 * and bundles into both server targets. Everything here treats input as untrusted.
 */

export const contactFormLimits = { name: 100, email: 254, message: 4000, minMessage: 10 } as const;

/** A validated message from a visitor. */
export interface ContactSubmission {
  readonly name: string;
  readonly email: string;
  readonly message: string;
  /** The locale of the page the visitor wrote from, so a reply can use their language. */
  readonly locale: string;
}

export type SubmissionResult =
  | { readonly kind: "valid"; readonly submission: ContactSubmission }
  | { readonly kind: "invalid" }
  /** The hidden field only bots fill in was filled; callers pretend to succeed and send nothing. */
  | { readonly kind: "spam" };

const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const lineBreaks = /[\r\n\u2028\u2029]/;
const emailShape = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;
const localeShape = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function text(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

/** Validates the JSON a visitor's browser sends. The `website` field is the honeypot. */
export function parseSubmission(input: unknown): SubmissionResult {
  if (typeof input !== "object" || input === null) return { kind: "invalid" };
  const body = input as Record<string, unknown>;

  if (text(body.website)) return { kind: "spam" };

  const name = text(body.name);
  const email = text(body.email);
  const message = text(body.message);
  const locale = text(body.locale) ?? "en";

  if (!name || name.length > contactFormLimits.name || lineBreaks.test(name) || controlCharacters.test(name)) return { kind: "invalid" };
  if (!email || email.length > contactFormLimits.email || !emailShape.test(email)) return { kind: "invalid" };
  if (!message || message.length < contactFormLimits.minMessage || message.length > contactFormLimits.message || controlCharacters.test(message)) {
    return { kind: "invalid" };
  }
  if (!localeShape.test(locale)) return { kind: "invalid" };

  return { kind: "valid", submission: { name, email, message, locale } };
}

/** Plain-text mail for the site owner. No HTML, so nothing a visitor writes can be interpreted as markup. */
export function composeMail(submission: ContactSubmission): { subject: string; text: string } {
  return {
    subject: `Portfolio message from ${submission.name}`,
    text: [
      `Name: ${submission.name}`,
      `Email: ${submission.email}`,
      `Language of the page: ${submission.locale}`,
      "",
      submission.message,
      "",
      "— Sent through the portfolio contact form. Reply to this email to answer the visitor.",
    ].join("\n"),
  };
}
