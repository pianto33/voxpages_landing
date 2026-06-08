import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getStripeDataByPriceId } from "@/constants";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { validateWarn, checkSetupIntentSchema } from "@/lib/validation";
import { getRequestContext, compactContext } from "@/utils/serverContext";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY ?? "");

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ctx = compactContext(getRequestContext(req));

  const { data: validatedData } = await validateWarn(
    checkSetupIntentSchema,
    req.body,
    "check-setup-intent",
    { ip: req.headers["x-forwarded-for"]?.toString(), url: req.url }
  );

  try {
    const { setupIntentId } = validatedData;

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== "succeeded") {
      logger.info("check-setup-intent: SetupIntent aún no exitoso", {
        ...ctx,
        setup_intent_id: setupIntentId,
        status: setupIntent.status,
      });
      return res.status(409).json({
        error: "SetupIntent not succeeded",
        status: setupIntent.status,
      });
    }

    const metadata = setupIntent.metadata ?? {};
    const email = metadata.email?.toLowerCase().trim();
    const name = metadata.name?.trim() || "";
    const priceId = metadata.priceId;
    const countryCode = metadata.countryCode || "";

    if (!email) {
      logger.warn("check-setup-intent: SetupIntent sin email en metadata", {
        ...ctx,
        setup_intent_id: setupIntentId,
      });
      return res.status(404).json({ error: "Email not found in SetupIntent" });
    }

    const customerId =
      typeof setupIntent.customer === "string"
        ? setupIntent.customer
        : setupIntent.customer?.id || null;

    const stripeData = priceId ? getStripeDataByPriceId(priceId) : null;

    logger.info("check-setup-intent: identidad resuelta", {
      funnel_step: "setup_intent_resolved",
      ...ctx,
      setup_intent_id: setupIntentId,
      email,
      price_id: priceId || null,
      customer_id: customerId,
    });

    return res.status(200).json({
      email,
      name,
      priceId: priceId || null,
      countryCode,
      customerId,
      amount: stripeData?.amount ?? null,
      currency: stripeData?.currency ?? null,
      status: setupIntent.status,
    });
  } catch (error: any) {
    if (error?.code === "resource_missing") {
      logger.warn("check-setup-intent: resource_missing", {
        ...ctx,
        setup_intent_id: req.body?.setupIntentId,
        stripe_code: error.code,
        stripe_request_id: error.requestId,
      });
      return res.status(404).json({ error: "SetupIntent not found" });
    }

    logger.error("Error en check-setup-intent", error, {
      ...ctx,
      setup_intent_id: req.body?.setupIntentId,
      stripe_code: error?.code,
      stripe_request_id: error?.requestId,
    });

    return res.status(400).json({ error: error.message });
  }
}

export default withRateLimitAndMonitoring(handler, "check-setup-intent");
