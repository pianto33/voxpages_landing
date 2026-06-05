import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Endpoint TEMPORAL de diagnóstico para Better Stack.
 *
 * Sirve para verificar, desde el runtime de Vercel:
 *  - Que las env vars BETTERSTACK_SOURCE_TOKEN y BETTERSTACK_INGESTING_HOST
 *    estén seteadas en el environment correcto (preview vs production).
 *  - Que la conectividad outbound Vercel -> Better Stack funcione.
 *  - Qué status HTTP devuelve el endpoint de ingesta.
 *
 * Protección simple: requiere ?key=<últimos 6 chars del token>. Así sólo
 * quien tenga acceso a Better Stack/Vercel puede invocarlo.
 *
 * Borrar este archivo cuando termine el diagnóstico.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const token = process.env.BETTERSTACK_SOURCE_TOKEN || "";
  const host =
    process.env.BETTERSTACK_INGESTING_HOST || "in.logs.betterstack.com";
  const isHostDefault = !process.env.BETTERSTACK_INGESTING_HOST;

  const expectedKey = token.slice(-6);
  const providedKey = (req.query.key as string) || "";

  if (!token) {
    return res.status(503).json({
      ok: false,
      reason: "BETTERSTACK_SOURCE_TOKEN not set in this environment",
    });
  }

  if (!providedKey || providedKey !== expectedKey) {
    return res.status(401).json({
      ok: false,
      reason: "Invalid or missing key. Pass ?key=<last 6 chars of token>.",
    });
  }

  const endpoint = `https://${host}`;
  const startedAt = Date.now();

  let httpStatus: number | null = null;
  let httpStatusText: string | null = null;
  let respBody: string | null = null;
  let fetchError: string | null = null;

  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dt: new Date().toISOString(),
        level: "info",
        message: "BetterStack ping from /api/_debug/betterstack-ping",
        app: "voxpages_landing",
        environment:
          process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        vercel_region: process.env.VERCEL_REGION || null,
        vercel_deployment_url: process.env.VERCEL_URL || null,
        diagnostic: true,
      }),
    });
    httpStatus = r.status;
    httpStatusText = r.statusText;
    try {
      respBody = (await r.text()).slice(0, 500);
    } catch {
      respBody = null;
    }
  } catch (e: any) {
    fetchError = e?.message || String(e);
  }

  const durationMs = Date.now() - startedAt;
  const ok = httpStatus !== null && httpStatus >= 200 && httpStatus < 300;

  return res.status(200).json({
    ok,
    diagnostic: {
      env: {
        VERCEL_ENV: process.env.VERCEL_ENV || null,
        NODE_ENV: process.env.NODE_ENV || null,
        VERCEL_REGION: process.env.VERCEL_REGION || null,
      },
      betterstack: {
        tokenSet: true,
        tokenLength: token.length,
        tokenSuffix: token.slice(-4),
        host,
        isHostDefault,
        endpoint,
      },
      request: {
        durationMs,
        httpStatus,
        httpStatusText,
        respBody,
        fetchError,
      },
    },
    hint: isHostDefault
      ? "BETTERSTACK_INGESTING_HOST no está seteado en este environment. El cliente está usando 'in.logs.betterstack.com' por defecto, que NO acepta el token de un source con host dedicado."
      : ok
      ? "Conectividad OK. Si igual no ves logs en Better Stack, revisá el filtro 'Source' en el Live tail."
      : "Llegó al endpoint pero Better Stack rechazó la request. Revisá el token del source y/o el host.",
  });
}
