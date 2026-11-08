/**
 * Orígenes desde los que el browser de la variante B llama a cross.*
 * (HTML en el host de ads, /api en Vercel).
 */
export const ADS_API_ORIGINS = [
  "https://landing-g.todosgamers.com",
  "https://oneplay.todosgamers.com",
  "https://oneplay-g.todosgamers.com",
  "https://landing-g.slumbrapp.com",
  "https://oneplay-g.playcher.com",
  "https://mid.theauravibe.com",
] as const;

export const OWN_API_ORIGINS = [
  "https://cross.voxpages.com",
  "https://landing.voxpages.com",
  "https://cross-qa.voxpages.com",
  "https://landing-qa.voxpages.com",
  "https://cross.summaryvox.com",
  "https://ldg.summaryvox.com",
] as const;

const ALLOWED = new Set<string>([...ADS_API_ORIGINS, ...OWN_API_ORIGINS]);

export function isAllowedApiOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return ALLOWED.has(origin);
}

/** Headers CORS para respuestas de /api (middleware o handler). */
export function apiCorsHeaderPairs(origin: string | null | undefined): [string, string][] {
  if (!isAllowedApiOrigin(origin)) return [];
  return [
    ["Access-Control-Allow-Origin", origin as string],
    ["Vary", "Origin"],
    ["Access-Control-Allow-Methods", "GET, POST, OPTIONS"],
    [
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Anon-Id, X-Session-Id, X-Funnel-Id, X-Customer-Id",
    ],
    ["Access-Control-Max-Age", "86400"],
  ];
}
