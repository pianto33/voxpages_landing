import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { STRIPE_PRODUCT_ID } from "@/constants";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { validateWarn, createSetupIntentSchema } from "@/lib/validation";
import { getRequestContext, compactContext } from "@/utils/serverContext";
import {
  findCheckoutBlockingSubscriptionForEmail,
  isBillableSubscriptionStatus,
} from "@/lib/stripeSubscriptions";

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY ?? "");

/** Reutiliza customer existente (prioriza el que ya tiene sub) o crea uno nuevo. */
async function resolveStripeCustomer(params: {
  email: string;
  name: string;
  metadata: Record<string, string>;
  address?: Stripe.AddressParam;
}): Promise<{ customerId: string; created: boolean }> {
  const normalizedEmail = params.email.toLowerCase().trim();

  const existing = await stripe.customers.list({
    email: normalizedEmail,
    limit: 100,
  });

  if (existing.data.length > 0) {
    for (const customer of existing.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 5,
      });
      if (subs.data.some((s) => isBillableSubscriptionStatus(s.status))) {
        return { customerId: customer.id, created: false };
      }
    }
    return { customerId: existing.data[0].id, created: false };
  }

  const customer = await stripe.customers.create(
    {
      email: normalizedEmail,
      name: params.name,
      metadata: params.metadata,
      ...(params.address ? { address: params.address } : {}),
    },
    { idempotencyKey: `voxpages-customer-${normalizedEmail}` }
  );

  return { customerId: customer.id, created: true };
}

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
      "create-setup-intent",
      { ip: req.headers["x-forwarded-for"]?.toString(), url: req.url }
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

    // Solo active/trialing: past_due puede seguir para actualizar PM vía webhook.
    const existingBlock = await findCheckoutBlockingSubscriptionForEmail(stripe, email);
    if (existingBlock) {
      logger.info("create-setup-intent bloqueado: ya tiene suscripción", {
        funnel_step: "setup_intent_blocked_existing_subscription",
        ...ctx,
        email,
        customer_id: existingBlock.customerId,
        subscription_id: existingBlock.subscription.id,
        subscription_status: existingBlock.subscription.status,
      });
      return res.status(409).json({
        error: "existing_subscription",
        code: "existing_subscription",
      });
    }

    const metadata: Record<string, string> = {
      email,
      name: name || "",
      priceId,
      // Para que el webhook resuelva producto sin expandir el price (eventos tempranos).
      product_id: STRIPE_PRODUCT_ID,
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

    const addressCountry = billing_country || geo_country;
    const addressState = billing_state || geo_state;
    const addressCity = billing_city || geo_city;
    const addressPostal = billing_postal || geo_postal;

    let address: Stripe.AddressParam | undefined;
    if (addressCountry) {
      address = { country: addressCountry };
      if (addressState) address.state = addressState;
      if (addressCity) address.city = addressCity;
      if (addressPostal) address.postal_code = addressPostal;
      if (billing_line1) address.line1 = billing_line1;
      if (billing_line2) address.line2 = billing_line2;
    }

    const { customerId, created: customerCreated } = await resolveStripeCustomer({
      email,
      name: name || email.split("@")[0],
      metadata,
      address,
    });

    logger.info(
      customerCreated ? "Customer creado para checkout" : "Customer reutilizado para checkout",
      {
        funnel_step: customerCreated ? "customer_created" : "customer_reused",
        ...ctx,
        customer_id: customerId,
        email,
      }
    );

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never",
      },
      usage: "off_session",
      metadata,
      // "any" = pedir 3DS siempre que la tarjeta lo soporte (suele ir frictionless:
      // sin OTP). Más cobertura/liability shift que "automatic", sin forzar challenge.
      payment_method_options: {
        card: {
          request_three_d_secure: "any",
        },
      },
    });

    logger.info("SetupIntent creado exitosamente", {
      funnel_step: "setup_intent_created",
      ...ctx,
      setup_intent_id: setupIntent.id,
      customer_id: customerId,
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
export default withRateLimitAndMonitoring(handler, "create-setup-intent");
