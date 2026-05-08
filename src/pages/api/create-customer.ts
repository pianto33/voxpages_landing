import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { fetchIPData } from "@/services/trackingService";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { validateWarn, createCustomerSchema } from "@/lib/validation";

const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY ?? "";
const stripe = new Stripe(STRIPE_PRIVATE_KEY);

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    // 🔒 Validar input (modo warn: alerta pero no bloquea)
    const { data: validatedData } = await validateWarn(
      createCustomerSchema, 
      req.body, 
      'create-customer',
      { ip: req.headers['x-forwarded-for']?.toString(), url: req.url }
    );
    
    try {
      const {
        name,
        email,
        country,
        state,
        city,
        postal,
        billing_country,
        billing_state,
        billing_city,
        billing_postal,
        billing_line1,
        billing_line2,
      } = validatedData;

      const ipData = await fetchIPData();
      const forwarded = req.headers["x-forwarded-for"];
      const fallbackIp =
        typeof forwarded === "string"
          ? forwarded.split(/, /)[0]
          : req.socket.remoteAddress;

      const finalIp = ipData.ip || fallbackIp || "unknown";

      // Construir metadata con toda la información de geolocalización
      const metadata: Record<string, string> = {
        ip_address: finalIp,
      };

      if (country) metadata.geo_country = country;
      if (state) metadata.geo_state = state;
      if (city) metadata.geo_city = city;
      if (postal) metadata.geo_postal = postal;

      // Billing address tiene prioridad sobre geo IP (fuente de verdad para sales tax)
      if (billing_country) metadata.billing_country = billing_country;
      if (billing_state) metadata.billing_state = billing_state;
      if (billing_city) metadata.billing_city = billing_city;
      if (billing_postal) metadata.billing_postal = billing_postal;
      if (billing_line1) metadata.billing_line1 = billing_line1;
      if (billing_line2) metadata.billing_line2 = billing_line2;

      const customerData: Stripe.CustomerCreateParams = {
        name: name,
        email: email,
        metadata: metadata,
      };

      // Customer.address: usar billing > geo IP (Stripe Tax y AVS prefieren el billing).
      const addressCountry = billing_country || country;
      const addressState = billing_state || state;
      const addressCity = billing_city || city;
      const addressPostal = billing_postal || postal;

      if (addressCountry) {
        customerData.address = {
          country: addressCountry,
        };

        if (addressState) customerData.address.state = addressState;
        if (addressCity) customerData.address.city = addressCity;
        if (addressPostal) customerData.address.postal_code = addressPostal;
        if (billing_line1) customerData.address.line1 = billing_line1;
        if (billing_line2) customerData.address.line2 = billing_line2;

        logger.info("Customer creado con dirección y metadata", {
          email,
          addressCountry,
          addressCity,
          hasPostal: !!addressPostal,
          source: billing_country ? "billing" : "geo_ip",
        });
      }

      const customer = await stripe.customers.create(customerData);

      res.status(200).send(customer);
    } catch (error: any) {
      logger.error("Error POST '/create-customer'", error, {
        email: req.body.email,
        name: req.body.name,
      });
      
      res.status(400).json({ error: error.message });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}

// Exporta con rate limiting (10/min) + monitoreo
export default withRateLimitAndMonitoring(handler, 'create-customer');
