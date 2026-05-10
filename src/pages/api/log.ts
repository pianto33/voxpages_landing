import type { NextApiRequest, NextApiResponse } from 'next';
import { betterStack } from '@/monitoring/services/betterStackService';
import { getRequestContext } from '@/utils/serverContext';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { level, message, metadata } = req.body || {};

  try {
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Contexto que viene en headers de telemetría + datos de la request
    // (IP real, country detectado por Vercel, host, etc.).
    const reqCtx = getRequestContext(req);

    // Cliente puede mandar metadata.sessionId (legacy) o el nuevo
    // session_id en headers. Priorizamos header, mantenemos compat.
    const sessionId =
      reqCtx.session_id ||
      metadata?.session_id ||
      metadata?.sessionId ||
      'unknown';

    const enrichedMetadata = {
      // Campos comunes del contexto de telemetría
      anon_id: reqCtx.anon_id,
      session_id: sessionId,
      funnel_id: reqCtx.funnel_id,
      customer_id: reqCtx.customer_id || metadata?.customer_id || null,
      ip: reqCtx.ip,
      country: reqCtx.country,
      vercel_region: reqCtx.vercel_region,
      // Mantengo `sessionId` plano para compat con búsquedas viejas
      sessionId,
      // Lo que mandó el cliente (incluye funnel_step, email, etc.)
      ...metadata,
      // Datos de transporte
      origin: reqCtx.origin,
      referer: reqCtx.referer,
      user_agent: reqCtx.user_agent,
      timestamp: new Date().toISOString(),
    };

    const levelEmoji = {
      log: '📝',
      info: 'ℹ️',
      warn: '⚠️',
      error: '🚨',
      'payment-success': '✅',
      visit: '👁️',
      click: '🖱️',
    };

    const emoji = levelEmoji[level as keyof typeof levelEmoji] || '📝';
    const logLevel = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';

    await betterStack.sendLog(
      logLevel,
      `${emoji} [${level?.toUpperCase() || 'LOG'}] ${message}`,
      enrichedMetadata
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[API Log] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
