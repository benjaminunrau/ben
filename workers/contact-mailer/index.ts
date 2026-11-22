import { composeMail, parseSubmission } from "../../src/capabilities/contact-form.ts";

/**
 * Sends a validated contact-form message to the site owner's inbox (ADR 0009). It has no public
 * route: only the Pages Function reaches it, through a service binding. The inbox address is the
 * `CONTACT_INBOX` secret, so it is never committed.
 */
interface Env {
  EMAIL: {
    send(message: {
      to: string;
      from: string;
      replyTo: { email: string; name: string };
      subject: string;
      text: string;
    }): Promise<unknown>;
  };
  /** Sender address on the domain onboarded for Email Sending. */
  MAIL_FROM: string;
  /** Destination inbox; set with `wrangler secret put CONTACT_INBOX`. */
  CONTACT_INBOX?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST" || !env.CONTACT_INBOX) return new Response(null, { status: 405 });

    // The Pages Function already validated this; checking again keeps the Worker safe on its own.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(null, { status: 400 });
    }
    const parsed = parseSubmission(body);
    if (parsed.kind !== "valid") return new Response(null, { status: 400 });

    const { subject, text } = composeMail(parsed.submission);
    try {
      await env.EMAIL.send({
        to: env.CONTACT_INBOX,
        from: env.MAIL_FROM,
        replyTo: { email: parsed.submission.email, name: parsed.submission.name },
        subject,
        text,
      });
    } catch (error) {
      // Log the error code only; never the visitor's message.
      console.error("contact mail failed", (error as { code?: string }).code ?? "unknown");
      return new Response(null, { status: 502 });
    }
    return new Response(null, { status: 204 });
  },
};
