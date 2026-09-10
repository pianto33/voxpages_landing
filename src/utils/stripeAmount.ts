/**
 * STRIPE_DATA.amount ya está en unidad menor de cargo (siempre ×100):
 * 1999 = 19.99 EUR · 680000 = 6800.00 HUF.
 *
 * HUF NO es zero-decimal en charges: Stripe cobra con 2 decimales
 * (mínimo 175.00 HUF). Dividir /100 mandaba 6800 → 68.00 HUF y Elements
 * no encontraba métodos de pago.
 *
 * JPY/CLP/KRW/VND sí son zero-decimal: 1000 → 10 JPY, etc.
 */
const ZERO_DECIMAL = new Set(["jpy", "clp", "krw", "vnd"]);

export function toStripeAmount(amount: number, currency: string): number {
  if (ZERO_DECIMAL.has(currency.toLowerCase())) return Math.round(amount / 100);
  return Math.round(amount);
}
