import Stripe from "stripe";

/** Sub que ya cobra / va a cobrar — no crear otra. */
export const BILLABLE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

/**
 * Bloqueo temprano en checkout/landing: solo active/trialing.
 * past_due se deja pasar para que el webhook pueda actualizar el payment method
 * sin crear una segunda suscripción.
 */
export const CHECKOUT_BLOCK_STATUSES = new Set(["active", "trialing"]);

export function isBillableSubscriptionStatus(status: string): boolean {
  return BILLABLE_SUBSCRIPTION_STATUSES.has(status);
}

export function isCheckoutBlockStatus(status: string): boolean {
  return CHECKOUT_BLOCK_STATUSES.has(status);
}

export type BillableSubscriptionMatch = {
  subscription: Stripe.Subscription;
  customerId: string;
};

async function findSubscriptionForEmail(
  stripe: Stripe,
  email: string,
  statuses: Set<string>
): Promise<BillableSubscriptionMatch | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const customers = await stripe.customers.list({
    email: normalizedEmail,
    limit: 100,
  });

  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: "all",
      limit: 100,
    });
    const match = subs.data.find((s) => statuses.has(s.status));
    if (match) {
      return { subscription: match, customerId: customer.id };
    }
  }

  return null;
}

/** Busca sub billable (active/trialing/past_due) por email. */
export async function findBillableSubscriptionForEmail(
  stripe: Stripe,
  email: string
): Promise<BillableSubscriptionMatch | null> {
  return findSubscriptionForEmail(stripe, email, BILLABLE_SUBSCRIPTION_STATUSES);
}

/** Busca sub que debe bloquear el checkout (active/trialing). */
export async function findCheckoutBlockingSubscriptionForEmail(
  stripe: Stripe,
  email: string
): Promise<BillableSubscriptionMatch | null> {
  return findSubscriptionForEmail(stripe, email, CHECKOUT_BLOCK_STATUSES);
}
