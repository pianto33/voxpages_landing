import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { validateWarn, checkCustomerSchema } from "@/lib/validation";
import { getRequestContext, compactContext } from "@/utils/serverContext";

const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY ?? "";
const stripe = new Stripe(STRIPE_PRIVATE_KEY);

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

  const ctx = compactContext(getRequestContext(req));

  // Log temporal de identificación de caller. Este endpoint es legacy
  // (no se usa desde el frontend del repo). Sirve para detectar quién
  // sigue pegando contra él y si se puede eliminar.
  logger.info("check-customer request", {
    ...ctx,
    email: validatedData?.email,
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
        ...ctx,
        email: req.body.email,
        stripe_code: error.code,
        stripe_request_id: error.requestId,
      });
      return res.status(404).json({ error: "Customer not found" });
    }

    logger.error("Error checking customer", error, {
      ...ctx,
      email: req.body.email,
      stripe_code: error?.code,
      stripe_request_id: error?.requestId,
    });

    return res.status(400).json({ error: error.message });
  }
}

// Exporta con rate limiting (20/min) + monitoreo
export default withRateLimitAndMonitoring(handler, 'check-customer');
