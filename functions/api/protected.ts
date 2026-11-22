import { handleProtectedRequest, type ProtectedEnv } from "../../src/capabilities/protected-access.ts";
import { jsonResponse } from "../../src/capabilities/request-guard.ts";

/** POST /api/protected — releases the WhatsApp number or a private file after Turnstile (ADR 0010). */
export const onRequestPost = ({ request, env }: { request: Request; env: ProtectedEnv }): Promise<Response> =>
  handleProtectedRequest(request, env);

export const onRequest = (): Response => jsonResponse({ error: "method" }, 405);
