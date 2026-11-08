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
 */
export function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || "").trim();
  return raw.replace(/\/$/, "");
}

/** Resuelve `/api/...` contra NEXT_PUBLIC_API_BASE si está seteada. */
export function resolveApiUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}
