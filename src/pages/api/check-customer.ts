import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { validateWarn, checkCustomerSchema } from "@/lib/validation";

const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY ?? "";
const stripe = new Stripe(STRIPE_PRIVATE_KEY);

/**
 * Devuelve metadata de la request para identificar al caller.
 * Útil para detectar quién pega contra este endpoint legacy.
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
    checkCustomerSchema, 
    req.body, 
    'check-customer',
    { ip: req.headers['x-forwarded-for']?.toString(), url: req.url }
  );

  const callerInfo = getCallerInfo(req);

  // Log temporal de identificación de caller. Este endpoint es legacy
  // (no se usa desde el frontend del repo). Sirve para detectar quién
  // sigue pegando contra él y si se puede eliminar.
  logger.info("check-customer request", {
    email: validatedData?.email,
    ...callerInfo,
  });

  try {
    const { email } = validatedData;

    const customers = await stripe.customers.list({
      email,
      limit: 1,
    });

    return res.json({
      customerId: customers.data[0]?.id || null,
    });
  } catch (error: any) {
    // resource_missing en customers.list es muy raro (devuelve lista vacía,
    // no 404), pero lo manejamos por simetría con check-subscriptions.
    if (error?.code === "resource_missing") {
      logger.warn("check-customer: resource_missing", {
        email: req.body.email,
        stripeCode: error.code,
        stripeRequestId: error.requestId,
        ...callerInfo,
      });
      return res.status(404).json({ error: "Customer not found" });
    }

    logger.error("Error checking customer", error, {
      email: req.body.email,
      stripeCode: error?.code,
      stripeRequestId: error?.requestId,
      ...callerInfo,
    });

    return res.status(400).json({ error: error.message });
  }
}

// Exporta con rate limiting (20/min) + monitoreo
export default withRateLimitAndMonitoring(handler, 'check-customer');
