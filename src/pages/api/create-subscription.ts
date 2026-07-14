import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { validateWarn, createSubscriptionSchema } from "@/lib/validation";
import { getRequestContext, compactContext } from "@/utils/serverContext";
import { isBillableSubscriptionStatus } from "@/lib/stripeSubscriptions";

const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY ?? "";
const stripe = new Stripe(STRIPE_PRIVATE_KEY);

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === "POST") {
        const ctx = compactContext(getRequestContext(req));

        logger.info("create-subscription request", {
            funnel_step: "subscription_create_request",
            ...ctx,
            customer_id: req.body?.customerId,
            price_id: req.body?.priceId,
        });

        // 🔒 Validar input (modo warn: alerta pero no bloquea)
        const { data: validatedData } = await validateWarn(
            createSubscriptionSchema, 
            req.body, 
            'create-subscription',
            { ip: req.headers['x-forwarded-for']?.toString(), url: req.url }
        );
        
        try {
            const { 
                customerId, 
                priceId, 
                ip_address, 
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
                fbclid,
                utm_source,
                utm_medium,
                utm_campaign,
                utm_term,
                utm_content,
                utm_id,
            } = validatedData;

            const existingSubs = await stripe.subscriptions.list({
                customer: customerId,
                status: "all",
                limit: 100,
            });
            const billable = existingSubs.data.find((s) =>
                isBillableSubscriptionStatus(s.status)
            );
            if (billable) {
                logger.info("create-subscription bloqueado: ya tiene suscripción", {
                    funnel_step: "subscription_create_blocked_existing",
                    ...ctx,
                    customer_id: customerId,
                    subscription_id: billable.id,
                    subscription_status: billable.status,
                });
                return res.status(409).json({
                    error: "existing_subscription",
                    code: "existing_subscription",
                    subscriptionId: billable.id,
                });
            }
            
            const metadata: Record<string, string> = {};
            
            if (ip_address) metadata.ip_address = ip_address;
            if (geo_country) metadata.geo_country = geo_country;
            if (geo_state) metadata.geo_state = geo_state;
            if (geo_city) metadata.geo_city = geo_city;
            if (geo_postal) metadata.geo_postal = geo_postal;
            if (billing_country) metadata.billing_country = billing_country;
            if (billing_state) metadata.billing_state = billing_state;
            if (billing_city) metadata.billing_city = billing_city;
            if (billing_postal) metadata.billing_postal = billing_postal;
            if (billing_line1) metadata.billing_line1 = billing_line1;
            if (billing_line2) metadata.billing_line2 = billing_line2;
            if (fbclid) metadata.fbclid = fbclid;
            if (utm_source) metadata.utm_source = utm_source;
            if (utm_medium) metadata.utm_medium = utm_medium;
            if (utm_campaign) metadata.utm_campaign = utm_campaign;
            if (utm_term) metadata.utm_term = utm_term;
            if (utm_content) metadata.utm_content = utm_content;
            if (utm_id) metadata.utm_id = utm_id;
            
            const subscriptionData: any = {
                customer: customerId,
                items: [
                    {
                        price: priceId,
                    },
                ],
                trial_period_days: 1,
                collection_method: "charge_automatically",
                payment_behavior: "default_incomplete",
                payment_settings: {
                    save_default_payment_method: "on_subscription",
                    // Renovaciones: automatic. 3DS fuerte solo en SetupIntent (checkout).
                    payment_method_options: {
                        card: {
                            request_three_d_secure: "automatic",
                        },
                    },
                },
                expand: [
                    "latest_invoice.payment_intent",
                    "pending_setup_intent",
                ],
            };

            // Agregar metadata solo si hay datos
            if (Object.keys(metadata).length > 0) {
                subscriptionData.metadata = metadata;
            }

            const subscription = await stripe.subscriptions.create(
                subscriptionData
            );

            logger.info("Suscripción creada", {
                funnel_step: "subscription_created",
                ...ctx,
                customer_id: customerId,
                subscription_id: subscription.id,
                price_id: priceId,
                billing_country: billing_country || null,
                billing_postal: billing_postal || null,
                geo_country: geo_country || null,
            });

            // Actualizar el SetupIntent con metadata incluyendo subscription_id
            // Esto facilita el manejo en webhooks
            if (
                subscription.pending_setup_intent &&
                typeof subscription.pending_setup_intent !== "string"
            ) {
                const setupIntent = subscription.pending_setup_intent;
                const setupIntentId = setupIntent.id;
                
                logger.info("SetupIntent creado por Stripe", {
                    ...ctx,
                    setup_intent_id: setupIntentId,
                    subscription_id: subscription.id,
                    customer_id: customerId,
                    usage: setupIntent.usage,
                    status: setupIntent.status,
                });

                await stripe.setupIntents.update(setupIntentId, {
                    metadata: {
                        ...metadata,
                        subscription_id: subscription.id,
                    },
                });

                logger.info("SetupIntent actualizado con subscription_id", {
                    ...ctx,
                    setup_intent_id: setupIntentId,
                    subscription_id: subscription.id,
                    customer_id: customerId,
                });
            }

            res.status(200).send({
                clientSecret:
                    subscription.pending_setup_intent &&
                    typeof subscription.pending_setup_intent !== "string"
                        ? subscription.pending_setup_intent.client_secret
                        : null,
                subscriptionId: subscription.id,
            });
        } catch (error: any) {
            // card_error = problema del usuario (tarjeta rechazada, robada, etc.) -> warn
            // otros tipos = error del sistema -> error
            const logData = {
                ...ctx,
                customer_id: req.body.customerId,
                price_id: req.body.priceId,
                stripe_error_type: error.type,
                stripe_error_code: error.code,
                stripe_decline_code: error.decline_code,
                stripe_status_code: error.statusCode,
            };

            if (error.type === 'StripeCardError' || error.type === 'card_error') {
                logger.warn("Tarjeta rechazada en '/create-subscription'", error, logData);
            } else {
                logger.error("Error POST '/create-subscription'", error, logData);
            }

            res.status(400).json({ error: error.message || 'Error desconocido al crear subscription' });
        }
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
}

// Exporta con rate limiting (5/min) + monitoreo
export default withRateLimitAndMonitoring(handler, 'create-subscription');
