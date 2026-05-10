import type { NextApiRequest, NextApiResponse } from 'next';
import { runHealthCheck } from '@/monitoring/services/monitoringService';
import { betterStack } from '@/monitoring/services/betterStackService';

/**
 * Cron de health check (Vercel Cron, ver vercel.json).
 *
 * Corre periódicamente y emite a Better Stack:
 *   - Métricas del runtime (memoria, CPU, región).
 *   - Un "heartbeat" estructurado con `funnel_step: heartbeat` y un
 *     mensaje legible. Si dejás de ver heartbeats en el live tail
 *     significa que la app está caída (deploy roto, vars rotas, etc.).
 *
 * Vercel Cron envía un header `Authorization: Bearer <CRON_SECRET>`.
 * Si seteás CRON_SECRET en env vars, validamos. Si no está seteado,
 * permitimos invocación libre (útil para QA / dev).
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ ok: false, reason: 'unauthorized' });
    }
  }

  try {
    const result = await runHealthCheck();
    await betterStack.info('heartbeat', {
      funnel_step: 'heartbeat',
      healthy: result.healthy,
      memory: result.metrics?.memory,
      cpu: result.metrics?.cpu,
      vercel_region: process.env.VERCEL_REGION || null,
      vercel_env: process.env.VERCEL_ENV || null,
      timestamp: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    await betterStack.error('heartbeat_error', {
      error: error?.message || String(error),
      vercel_region: process.env.VERCEL_REGION || null,
    });
    return res.status(500).json({ ok: false, error: error?.message });
  }
}
