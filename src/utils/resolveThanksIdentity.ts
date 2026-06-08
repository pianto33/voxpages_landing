import { fetchSetupIntentCheckout } from "@/api/stripe";

export interface ThanksCheckoutIdentity {
  email: string;
  name: string;
  customerId: string;
  amount: number | null;
  currency: string | null;
  source: "localStorage" | "setup_intent";
}

function readLocalIdentity(): Omit<ThanksCheckoutIdentity, "source"> | null {
  if (typeof window === "undefined") return null;

  const email = localStorage.getItem("userEmail")?.trim() || "";
  if (!email) return null;

  const storedAmount = parseInt(localStorage.getItem("paymentAmount") || "", 10);

  return {
    email,
    name: localStorage.getItem("userName")?.trim() || "",
    customerId: localStorage.getItem("customerId")?.trim() || "",
    amount: Number.isFinite(storedAmount) ? storedAmount : null,
    currency: localStorage.getItem("paymentCurrency")?.trim() || null,
  };
}

function persistIdentity(identity: ThanksCheckoutIdentity) {
  localStorage.setItem("userEmail", identity.email);
  if (identity.name) localStorage.setItem("userName", identity.name);
  if (identity.customerId) localStorage.setItem("customerId", identity.customerId);
  if (identity.amount != null) {
    localStorage.setItem("paymentAmount", identity.amount.toString());
  }
  if (identity.currency) localStorage.setItem("paymentCurrency", identity.currency);
}

/**
 * Resuelve email/amount tras el redirect de Stripe. localStorage suele
 * perderse en wallets móviles; el fallback lee setup_intent de la URL.
 */
export async function resolveThanksCheckoutIdentity(params: {
  setupIntentId?: string;
  redirectStatus?: string;
  fallbackAmount?: number;
  fallbackCurrency?: string;
}): Promise<ThanksCheckoutIdentity | null> {
  const { setupIntentId, redirectStatus, fallbackAmount, fallbackCurrency } = params;

  if (redirectStatus && redirectStatus !== "succeeded") {
    return null;
  }

  const local = readLocalIdentity();
  if (local) {
    const identity: ThanksCheckoutIdentity = {
      ...local,
      amount: local.amount ?? fallbackAmount ?? null,
      currency: local.currency ?? fallbackCurrency ?? null,
      source: "localStorage",
    };
    persistIdentity(identity);
    return identity;
  }

  if (!setupIntentId) {
    return null;
  }

  const data = await fetchSetupIntentCheckout(setupIntentId);

  const identity: ThanksCheckoutIdentity = {
    email: data.email,
    name: data.name || "",
    customerId: data.customerId || "",
    amount: data.amount ?? fallbackAmount ?? null,
    currency: data.currency ?? fallbackCurrency ?? null,
    source: "setup_intent",
  };

  persistIdentity(identity);
  return identity;
}
