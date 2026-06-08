import { GetPaymentIntentPayload } from "@/interfaces/payment-intent";
import {
  CreateIntentPayload,
  CreatePaymentIntentResponse,
  type PaymentIntentResponse,
} from "@/interfaces/payment-intent";

export const getPaymentIntent = async ({
  intentId,
  clientSecret,
}: GetPaymentIntentPayload) => {
  const response = await fetch(
    `https://api.stripe.com/v1/payment_intents/${intentId}?client_secret=${clientSecret}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY}`,
      },
    }
  );

  const data = await response.json();

  // La API de Stripe devuelve { error: { message: "..." } }
  if (data.error) {
    const errorMessage = typeof data.error === 'string' ? data.error : data.error.message || 'Error desconocido en getPaymentIntent';
    throw new Error(errorMessage);
  }

  return data as PaymentIntentResponse;
};

export const createPaymentIntent = async (payload: CreateIntentPayload) => {
  const response = await fetch("/api/create-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (data.error) {
    const errorMessage = typeof data.error === 'string' ? data.error : data.error.message || 'Error desconocido en createPaymentIntent';
    throw new Error(errorMessage);
  }

  return data as CreatePaymentIntentResponse;
};

export interface SetupIntentCheckoutResponse {
  email: string;
  name: string;
  priceId: string | null;
  countryCode: string;
  customerId: string | null;
  amount: number | null;
  currency: string | null;
  status: string;
}

export const fetchSetupIntentCheckout = async (
  setupIntentId: string
): Promise<SetupIntentCheckoutResponse> => {
  const response = await fetch("/api/check-setup-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupIntentId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Error al resolver SetupIntent");
  }

  return data as SetupIntentCheckoutResponse;
};

// NOTA: Las siguientes funciones fueron eliminadas ya que el nuevo flujo
// simplificado usa el endpoint /api/create-setup-intent que maneja todo:
// - checkCustomer (ahora lo hace el endpoint)
// - createCustomer (ahora lo hace el endpoint)
// - checkSubscriptions (ahora lo hace el endpoint)
// - createSubscription (reemplazado por SetupIntent + webhook)
