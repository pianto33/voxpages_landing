/**
 * Wrapper de fetch para llamadas a /api/* del propio Next.
 *
 * Inyecta automáticamente los headers de telemetría (X-Anon-Id,
 * X-Session-Id, X-Funnel-Id, X-Customer-Id) sin que cada call site
 * tenga que recordarlo.
 *
 * Si NEXT_PUBLIC_API_BASE está seteada (build Vercel / variante B),
 * resuelve `/api/...` a URL absoluta para no pegarle al host de ads/EKS.
 */

import { getTelemetryHeaders } from './userIdentity';
import { resolveApiUrl } from './apiBase';

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const telemetryHeaders = getTelemetryHeaders();

  const mergedHeaders: HeadersInit = {
    ...telemetryHeaders,
    ...(init.headers || {}),
  };

  const resolved =
    typeof input === 'string' ? resolveApiUrl(input) : input;

  return fetch(resolved, {
    ...init,
    headers: mergedHeaders,
  });
}

export default apiFetch;
