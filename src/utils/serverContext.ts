/**
 * Contexto de telemetría que el servidor extrae de cada request.
 *
 * Lee los headers que el cliente inyecta vía apiFetch / clientLogger
 * (X-Anon-Id, X-Session-Id, X-Funnel-Id, X-Customer-Id) más los
 * headers estándar (forwarded-for, origin, referer, vercel-ip-country)
 * para que CADA log server-side pueda llevar la identidad del usuario
 * y permita filtrar/correlacionar en Better Stack.
 *
 * Uso:
 *   const ctx = getRequestContext(req);
 *   logger.info('algo paso', { ...ctx, custom: 'field' });
 */

import type { NextApiRequest } from 'next';

export interface ServerLogContext {
  // Identidad del usuario (vienen de headers que setea el cliente)
  anon_id: string | null;
  session_id: string | null;
  funnel_id: string | null;
  customer_id: string | null;

  // Datos de transporte / red
  ip: string | null;
  origin: string | null;
  referer: string | null;
  user_agent: string | null;
  host: string | null;

  // Geolocalización (la setea Vercel automáticamente, sin costo)
  country: string | null;       // x-vercel-ip-country
  city: string | null;          // x-vercel-ip-city
  region_name: string | null;   // x-vercel-ip-country-region
  vercel_region: string | null; // process.env.VERCEL_REGION

  // Request en sí
  url: string | null;
  method: string | null;
}

function pickHeader(req: NextApiRequest, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return v[0];
  return null;
}

function getClientIP(req: NextApiRequest): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim();
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string') return real;
  return req.socket?.remoteAddress || null;
}

export function getRequestContext(req: NextApiRequest): ServerLogContext {
  return {
    anon_id: pickHeader(req, 'x-anon-id'),
    session_id: pickHeader(req, 'x-session-id'),
    funnel_id: pickHeader(req, 'x-funnel-id'),
    customer_id: pickHeader(req, 'x-customer-id'),

    ip: getClientIP(req),
    origin: pickHeader(req, 'origin'),
    referer: pickHeader(req, 'referer'),
    user_agent: pickHeader(req, 'user-agent'),
    host: pickHeader(req, 'host'),

    country: pickHeader(req, 'x-vercel-ip-country'),
    city: pickHeader(req, 'x-vercel-ip-city'),
    region_name: pickHeader(req, 'x-vercel-ip-country-region'),
    vercel_region: process.env.VERCEL_REGION || null,

    url: req.url || null,
    method: req.method || null,
  };
}

/**
 * Devuelve sólo los campos no nulos para reducir ruido en logs.
 */
export function compactContext(ctx: ServerLogContext): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v !== null && v !== undefined && v !== '') out[k] = v;
  }
  return out;
}
