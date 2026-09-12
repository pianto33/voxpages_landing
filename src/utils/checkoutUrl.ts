/** Origin real del browser para return_url de Stripe (3DS / wallet). */
export function getCheckoutBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "";
}
