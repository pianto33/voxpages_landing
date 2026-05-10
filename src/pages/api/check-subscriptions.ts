import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { logger } from "@/utils/logger";
import { withMonitoring } from "@/monitoring/middleware/apiMonitoring";
import { validateWarn, checkSubscriptionsSchema } from "@/lib/validation";
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
    checkSubscriptionsSchema, 
    req.body, 
    'check-subscriptions',
    { ip: req.headers['x-forwarded-for']?.toString(), url: req.url }
  );

  const ctx = compactContext(getRequestContext(req));

  logger.info("check-subscriptions request", {
    ...ctx,
    customer_id: validatedData?.customerId,
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
        ...ctx,
        customer_id: req.body.customerId,
        stripe_code: error.code,
        stripe_request_id: error.requestId,
      });
      return res.status(404).json({ error: "Customer not found" });
    }

    logger.error("Error checking subscriptions", error, {
      ...ctx,
      customer_id: req.body.customerId,
      stripe_code: error?.code,
      stripe_request_id: error?.requestId,
    });

    return res.status(400).json({ error: error.message });
  }
}

export default withMonitoring(handler);
