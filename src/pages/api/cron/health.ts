import type { NextApiRequest, NextApiResponse } from 'next';
import { runHealthCheck } from '@/monitoring/services/monitoringService';
import { betterStack } from '@/monitoring/services/betterStackService';

/**
 * Health check endpoint para uptime monitor externo (Better Stack Uptime, etc).
 *
 * Devuelve HTTP 200 + JSON con métricas si todo OK. Solo loguea a
 * Better Stack cuando hay un error (heartbeat_error). El "estoy vivo"
 * se observa en Better Stack Uptime, no se emiten logs por cada ping
 * para no saturar el ingest.
 *
 * Si seteás CRON_SECRET en env vars, validamos `Authorization: Bearer`.
 * Si no, permitimos invocación libre (útil para QA / dev / uptime monitor
 * público).
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
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    await betterStack.error('heartbeat_error', {
      error: error?.message || String(error),
      vercel_region: process.env.VERCEL_REGION || null,
    });
    return res.status(500).json({ ok: false, error: error?.message });
  }
}
