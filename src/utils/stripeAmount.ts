/**
 * STRIPE_DATA.amount ya está en unidad menor “siempre ×100”
 * (1999 = 19.99 EUR · 680000 = 6.800 HUF).
 *
 * Stripe Elements / Google Pay quieren el amount de la API:
 * EUR/USD → 1999; HUF/JPY (zero-decimal) → enteros de la moneda (6800, no 680000).
 * No multiplicar ×100: eso aplica a landings que guardan 19.99 en constantes.
 */
const ZERO_DECIMAL = new Set(["jpy", "huf", "clp", "krw", "vnd"]);

export function toStripeAmount(amount: number, currency: string): number {
  if (ZERO_DECIMAL.has(currency.toLowerCase())) return Math.round(amount / 100);
  return Math.round(amount);
}
