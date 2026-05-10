/**
 * Wrapper de fetch para llamadas a /api/* del propio Next.
 *
 * Inyecta automáticamente los headers de telemetría (X-Anon-Id,
 * X-Session-Id, X-Funnel-Id, X-Customer-Id) sin que cada call site
 * tenga que recordarlo.
 *
 * Comportamiento idéntico a fetch nativo en todo lo demás.
 */

import { getTelemetryHeaders } from './userIdentity';

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const telemetryHeaders = getTelemetryHeaders();

  const mergedHeaders: HeadersInit = {
    ...telemetryHeaders,
    ...(init.headers || {}),
  };

  return fetch(input, {
    ...init,
    headers: mergedHeaders,
  });
}

export default apiFetch;
