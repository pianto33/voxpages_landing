import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { validateWarn, createSetupIntentSchema } from "@/lib/validation";
import { getRequestContext, compactContext } from "@/utils/serverContext";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY ?? "");

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ctx = compactContext(getRequestContext(req));

  logger.info("create-setup-intent request", {
    funnel_step: "setup_intent_create_request",
    ...ctx,
    email: req.body?.email,
    price_id: req.body?.priceId,
    country_code: req.body?.countryCode,
  });

  try {
    const { data: validatedData } = await validateWarn(
      createSetupIntentSchema,
      req.body,
      'create-setup-intent',
      { ip: req.headers['x-forwarded-for']?.toString(), url: req.url }
    );

    const { 
      email, 
      name, 
      priceId, 
      countryCode, 
      ip_address, 
      fbclid,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      utm_id,
      geo_country,
      geo_state,
      geo_city,
      geo_postal,
      billing_country,
      billing_state,
      billing_city,
      billing_postal,
      billing_line1,
      billing_line2,
    } = validatedData;

    if (!email || !priceId) {
      return res.status(400).json({ error: "Missing email or priceId" });
    }

    const metadata: Record<string, string> = {
      email,
      name: name || "",
      priceId,
      countryCode: countryCode || "",
      ip_address: ip_address || "",
      geo_country: geo_country || "",
      geo_state: geo_state || "",
      geo_city: geo_city || "",
      geo_postal: geo_postal || "",
    };

    if (fbclid) metadata.fbclid = fbclid;
    if (utm_source) metadata.utm_source = utm_source;
    if (utm_medium) metadata.utm_medium = utm_medium;
    if (utm_campaign) metadata.utm_campaign = utm_campaign;
    if (utm_term) metadata.utm_term = utm_term;
    if (utm_content) metadata.utm_content = utm_content;
    if (utm_id) metadata.utm_id = utm_id;

    // Billing address (preferida sobre geo IP cuando exista — es la fuente de
    // verdad para sales tax USA y mapeo ZIP -> estado por AVS).
    if (billing_country) metadata.billing_country = billing_country;
    if (billing_state) metadata.billing_state = billing_state;
    if (billing_city) metadata.billing_city = billing_city;
    if (billing_postal) metadata.billing_postal = billing_postal;
    if (billing_line1) metadata.billing_line1 = billing_line1;
    if (billing_line2) metadata.billing_line2 = billing_line2;

    const setupIntent = await stripe.setupIntents.create({
      payment_method_types: ["card"],
      usage: "off_session",
      metadata,
    });

    logger.info("SetupIntent creado exitosamente", {
      funnel_step: "setup_intent_created",
      ...ctx,
      setup_intent_id: setupIntent.id,
      email,
      price_id: priceId,
      country_code: countryCode,
      billing_country: billing_country || null,
      billing_postal: billing_postal || null,
      billing_state: billing_state || null,
      geo_country: geo_country || null,
    });

    return res.status(200).json({
      clientSecret: setupIntent.client_secret,
    });
  } catch (error: any) {
    logger.error("Error creating setup intent:", error, {
      ...ctx,
      email: req.body?.email,
      price_id: req.body?.priceId,
    });
    return res.status(400).json({ error: error.message });
  }
}

// Exporta con rate limiting (5/min) + monitoreo
export default withRateLimitAndMonitoring(handler, 'create-setup-intent');
