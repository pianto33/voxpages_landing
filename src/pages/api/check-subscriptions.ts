import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { logger } from "@/utils/logger";
import { withMonitoring } from "@/monitoring/middleware/apiMonitoring";
import { validateWarn, checkSubscriptionsSchema } from "@/lib/validation";

const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY ?? "";
const stripe = new Stripe(STRIPE_PRIVATE_KEY);

/**
 * Devuelve metadata de la request para identificar al caller.
 * Útil para detectar quién pega contra este endpoint legacy
 * (no hay frontend de este repo que lo use).
 */
function getCallerInfo(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? forwarded.split(/, /)[0]
      : req.socket.remoteAddress;

  return {
    origin: req.headers.origin || null,
    referer: req.headers.referer || null,
    userAgent: req.headers["user-agent"] || null,
    host: req.headers.host || null,
    ip: ip || null,
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔒 Validar input (modo warn: alerta pero no bloquea)
  const { data: validatedData } = await validateWarn(
    checkSubscriptionsSchema, 
    req.body, 
    'check-subscriptions',
    { ip: req.headers['x-forwarded-for']?.toString(), url: req.url }
  );

  const callerInfo = getCallerInfo(req);

  // Log temporal de identificación de caller. Este endpoint es legacy
  // (no se usa desde el frontend del repo). Sirve para detectar quién
  // sigue pegando contra él y si se puede eliminar.
  logger.info("check-subscriptions request", {
    customerId: validatedData?.customerId,
    ...callerInfo,
  });

  try {
    const { customerId } = validatedData;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
    });

    const hasActiveOrTrialSubscriptions = subscriptions.data.some(
      (subscription) =>
        subscription.status === "active" || subscription.status === "trialing"
    );

    return res.json({
      hasActiveSubscriptions: hasActiveOrTrialSubscriptions,
    });
  } catch (error: any) {
    // resource_missing = el customer no existe en esta cuenta de Stripe.
    // Es un error esperado del cliente (customer viejo en localStorage,
    // mismatch test/live, otra cuenta, etc.), no un bug nuestro. Lo
    // logueamos como warn para no ensuciar las alertas de error.
    if (error?.code === "resource_missing") {
      logger.warn("check-subscriptions: customer no existe", {
        customerId: req.body.customerId,
        stripeCode: error.code,
        stripeRequestId: error.requestId,
        ...callerInfo,
      });
      return res.status(404).json({ error: "Customer not found" });
    }

    logger.error("Error checking subscriptions", error, {
      customerId: req.body.customerId,
      stripeCode: error?.code,
      stripeRequestId: error?.requestId,
      ...callerInfo,
    });

    return res.status(400).json({ error: error.message });
  }
}

export default withMonitoring(handler);
