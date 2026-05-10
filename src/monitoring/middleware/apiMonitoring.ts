import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiMonitor } from '@/monitoring/services/monitoringService';
import { getRequestContext, compactContext } from '@/utils/serverContext';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;

/**
 * Middleware para monitorear automáticamente todas las peticiones API.
 *
 * Inyecta contexto de telemetría (anon_id, session_id, funnel_id,
 * country, ip, etc.) en los logs que produce el monitor (slow
 * response, server error). Cada handler puede a su vez usar
 * `getRequestContext(req)` para enriquecer sus propios logs.
 *
 * Uso:
 *   export default withMonitoring(handler);
 */
export function withMonitoring(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const monitor = createApiMonitor(req.url || 'unknown', req.method || 'GET');
    const ctx = getRequestContext(req);
    const compactCtx = compactContext(ctx);

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);

    let statusCode = 200;
    let finished = false;

    const finalize = (code: number, extra?: Record<string, any>) => {
      if (finished) return;
      finished = true;
      monitor.end(code, {
        ...compactCtx,
        ...(extra || {}),
      });
    };

    res.json = function (body: any) {
      finalize(res.statusCode);
      return originalJson(body);
    };

    res.send = function (body: any) {
      finalize(res.statusCode);
      return originalSend(body);
    };

    res.end = function (...args: any[]) {
      finalize(res.statusCode);
      return originalEnd(...args);
    };

    try {
      await handler(req, res);
    } catch (error) {
      statusCode = 500;
      finalize(statusCode, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };
}

export default withMonitoring;
