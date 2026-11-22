import { handleContactRequest, type ContactEnv } from "../../src/capabilities/contact-request.ts";
import { jsonResponse } from "../../src/capabilities/request-guard.ts";

/** POST /api/contact — sends a message from the contact form to the site owner's inbox (ADR 0009). */
export const onRequestPost = ({ request, env }: { request: Request; env: ContactEnv }): Promise<Response> =>
  handleContactRequest(request, env);

export const onRequest = (): Response => jsonResponse({ error: "method" }, 405);
