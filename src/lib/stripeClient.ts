import { loadStripe, Stripe } from "@stripe/stripe-js";
import { clientLogger } from "@/utils/clientLogger";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || "";

export const stripePromise: Promise<Stripe | null> = loadStripe(
  publishableKey
).catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown Stripe.js load error";

  clientLogger.error("Stripe.js failed to load", {
    context: "stripeClient",
    error: message,
    hasPublishableKey: Boolean(publishableKey),
  });

  return null;
});
