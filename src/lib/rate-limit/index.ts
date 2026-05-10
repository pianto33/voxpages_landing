/**
 * 🛡️ Rate Limiting en Memoria
 * 
 * Protección rápida contra ataques obvios/agresivos.
 * - Bloquea bots/scripts que hacen muchas requests rápidas
 * - 50+ requests en 10 segundos desde misma IP → Bloqueo 1 minuto
 * 
 * Uso:
 * ```typescript
 * import { withRateLimit } from '@/lib/rate-limit';
 * 
 * async function handler(req, res) { ... }
 * 
 * export default withRateLimit(handler, 'create-customer');
 * ```
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { checkMemoryRateLimit, getMemoryRateLimitStats } from './memoryRateLimiter';
import { logger } from '@/utils/logger';
import { getRequestContext, compactContext } from '@/utils/serverContext';

// Tipos de endpoints soportados
export type RateLimitEndpoint = 
  | 'create-customer'
  | 'create-subscription'
  | 'create-setup-intent'
  | 'create-intent'
  | 'check-customer'
  | 'send-email'
  | 'default';

// Re-exportar utilidades de memoria
export { getMemoryRateLimitStats, clearMemoryRateLimitCache } from './memoryRateLimiter';

// ============================================================================
// Utilidades
// ============================================================================

/**
 * Extrae la IP del cliente de la request
 */
function getClientIP(req: NextApiRequest): string {
  // Vercel/Cloudflare headers
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const vercelIP = req.headers['x-vercel-forwarded-for'];
  
  if (typeof vercelIP === 'string') return vercelIP.split(',')[0].trim();
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (typeof realIP === 'string') return realIP;
  
  return req.socket?.remoteAddress || 'unknown';
}

// ============================================================================
// Middleware Principal
// ============================================================================

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;

interface RateLimitOptions {
  /** Identificador personalizado (por defecto usa IP) */
  customIdentifier?: (req: NextApiRequest) => string;
}

/**
 * Middleware de rate limiting en memoria
 * 
 * Bloquea ataques agresivos (50+ req/10s)
 * 
 * @param handler - Handler de la API
 * @param endpoint - Nombre del endpoint (para logging)
 * @param options - Opciones adicionales
 * 
 * @example
 * ```typescript
 * export default withRateLimit(handler, 'create-customer');
 * ```
 */
export function withRateLimit(
  handler: ApiHandler,
  endpoint: RateLimitEndpoint = 'default',
  options: RateLimitOptions = {}
): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const ip = options.customIdentifier?.(req) || getClientIP(req);
    
    // Rate limit en memoria
    const memoryResult = checkMemoryRateLimit(ip);
    
    if (!memoryResult.allowed) {
      const ctx = compactContext(getRequestContext(req));
      logger.warn('rate_limit_hit', {
        ...ctx,
        endpoint,
        rate_limit_ip: ip,
        rate_limit_reason: memoryResult.reason,
        rate_limit_retry_after_ms: memoryResult.retryAfterMs || null,
      });

      res.setHeader('Retry-After', Math.ceil((memoryResult.retryAfterMs || 60000) / 1000));
      res.setHeader('X-RateLimit-Layer', 'memory');
      
      return res.status(429).json({
        error: 'Too many requests',
        message: memoryResult.reason,
        retryAfter: Math.ceil((memoryResult.retryAfterMs || 60000) / 1000),
      });
    }
    
    // Request permitida - ejecutar handler
    return handler(req, res);
  };
}

/**
 * Combina rate limiting con el middleware de monitoreo existente
 * 
 * @example
 * ```typescript
 * import { withRateLimitAndMonitoring } from '@/lib/rate-limit';
 * 
 * async function handler(req, res) { ... }
 * 
 * export default withRateLimitAndMonitoring(handler, 'create-customer');
 * ```
 */
export function withRateLimitAndMonitoring(
  handler: ApiHandler,
  endpoint: RateLimitEndpoint = 'default',
  options: RateLimitOptions = {}
): ApiHandler {
  // Importar dinámicamente para evitar dependencia circular
  const { withMonitoring } = require('@/monitoring/middleware/apiMonitoring');
  
  // Primero rate limit, luego monitoreo
  return withRateLimit(withMonitoring(handler), endpoint, options);
}
