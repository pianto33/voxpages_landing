import { ADS_API_ORIGINS } from "./cors";

/**
 * Base absoluta para /api/* en el build de Vercel (variante B).
 *
 * El HTML de B se ve bajo el dominio público de ads (playcher, landing-g…).
 * Si el JS hace fetch('/api/...') relativo, la request entra por ese dominio
 * y Cloudflare la manda a EKS (A), que no tiene esas rutas → 405 y logs
 * vacíos en Better Stack. Con NEXT_PUBLIC_API_BASE apuntando a
 * https://cross.voxpages.com, B solo habla con Vercel.
 *
 * Vacío / ausente = URL relativa (build de EKS / A, o local sin env).
 *
 * Visita directa a landing.* / cross.* (sin ads): se deja relativa para
 * same-origin. Solo se fuerza el absoluto si la barra de URL es un host de ads.
 */
export function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
  return raw.replace(/\/$/, "");
}

function isAdsBrowserHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return ADS_API_ORIGINS.some((origin) => {
    try {
      return new URL(origin).hostname === host;
    } catch {
      return false;
    }
  });
}

/** Resuelve `/api/...` contra NEXT_PUBLIC_API_BASE solo en hosts de ads. */
export function resolveApiUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  const base = getApiBase();
  if (!base) return path;
  if (!isAdsBrowserHost()) return path;
  return `${base}${path}`;
}
