/**
 * 🔒 Schemas de Validación con Zod
 * 
 * Validación de inputs para todas las APIs críticas.
 * Previene:
 * - Inyección de datos maliciosos
 * - Valores fuera de rango
 * - Tipos incorrectos
 * - DoS por payloads enormes
 */

import { z } from 'zod';

// ============================================================================
// Schemas Base (reutilizables)
// ============================================================================

/**
 * Email válido, normalizado
 */
export const emailSchema = z
  .string()
  .email('Email inválido')
  .max(254, 'Email demasiado largo')
  .transform(val => val.toLowerCase().trim());

/**
 * Nombre de persona
 */
export const nameSchema = z
  .string()
  .min(1, 'Nombre requerido')
  .max(100, 'Nombre demasiado largo')
  .transform(val => val.trim());

/**
 * Stripe Customer ID (formato: cus_*)
 */
export const stripeCustomerIdSchema = z
  .string()
  .regex(/^cus_[a-zA-Z0-9]+$/, 'Customer ID inválido');

/**
 * Stripe Price ID (formato: price_*)
 */
export const stripePriceIdSchema = z
  .string()
  .regex(/^price_[a-zA-Z0-9]+$/, 'Price ID inválido');

/**
 * Código de país ISO 3166-1 alpha-2 (2 letras)
 */
export const countryCodeSchema = z
  .string()
  .length(2, 'Código de país debe ser de 2 letras')
  .regex(/^[A-Z]{2}$/, 'Código de país inválido')
  .optional();

/**
 * Código postal (flexible para diferentes países)
 */
export const postalCodeSchema = z
  .string()
  .max(20, 'Código postal demasiado largo')
  .optional();

/**
 * Ciudad o estado
 */
export const cityStateSchema = z
  .string()
  .max(100, 'Nombre de ciudad/estado demasiado largo')
  .optional();

/**
 * Línea de dirección (line1/line2)
 */
export const addressLineSchema = z
  .string()
  .max(200, 'Línea de dirección demasiado larga')
  .optional();

/**
 * Dirección IP válida (IPv4 o IPv6)
 */
export const ipAddressSchema = z
  .string()
  .max(45, 'IP demasiado larga') // IPv6 max length
  .optional();

/**
 * Moneda ISO 4217 (3 letras)
 */
export const currencySchema = z
  .string()
  .length(3, 'Moneda debe ser de 3 letras')
  .regex(/^[A-Za-z]{3}$/, 'Moneda inválida')
  .transform(val => val.toLowerCase());

/**
 * Monto en centavos (entero positivo)
 */
export const amountSchema = z
  .number()
  .int('Monto debe ser entero')
  .positive('Monto debe ser positivo')
  .max(99999999, 'Monto excede el máximo permitido'); // ~$999,999.99

/**
 * Facebook Click ID (fbclid)
 */
export const fbclidSchema = z
  .string()
  .max(500, 'FBCLID demasiado largo')
  .optional();

/**
 * UTM parameter genérico
 */
export const utmParamSchema = z
  .string()
  .max(500, 'UTM param demasiado largo')
  .optional();

/**
 * Locales soportados
 */
export const localeSchema = z.enum(['es', 'pt', 'pl', 'hu', 'cz', 'us']);

// ============================================================================
// Schemas por Endpoint
// ============================================================================

/**
 * POST /api/create-customer
 */
export const createCustomerSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  country: countryCodeSchema,
  state: cityStateSchema,
  city: cityStateSchema,
  postal: postalCodeSchema,
  // Billing address (preferida sobre geo IP cuando exista).
  billing_country: countryCodeSchema,
  billing_state: cityStateSchema,
  billing_city: cityStateSchema,
  billing_postal: postalCodeSchema,
  billing_line1: addressLineSchema,
  billing_line2: addressLineSchema,
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

/**
 * POST /api/create-subscription
 */
export const createSubscriptionSchema = z.object({
  customerId: stripeCustomerIdSchema,
  priceId: stripePriceIdSchema,
  ip_address: ipAddressSchema,
  geo_country: countryCodeSchema,
  geo_state: cityStateSchema,
  geo_city: cityStateSchema,
  geo_postal: postalCodeSchema,
  // Billing address provista por el wallet/PaymentElement (fuente de verdad
  // para sales tax USA: country + ZIP -> Stripe mapea a estado vía AVS).
  billing_country: countryCodeSchema,
  billing_state: cityStateSchema,
  billing_city: cityStateSchema,
  billing_postal: postalCodeSchema,
  billing_line1: addressLineSchema,
  billing_line2: addressLineSchema,
  fbclid: fbclidSchema,
  utm_source: utmParamSchema,
  utm_medium: utmParamSchema,
  utm_campaign: utmParamSchema,
  utm_term: utmParamSchema,
  utm_content: utmParamSchema,
  utm_id: utmParamSchema,
  radar_session_id: z.string().max(200).optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

/**
 * POST /api/create-setup-intent
 * Endpoint simplificado que crea customer y SetupIntent en una sola llamada
 */
export const createSetupIntentSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  priceId: stripePriceIdSchema,
  countryCode: z.string().max(10).optional(),
  ip_address: ipAddressSchema,
  fbclid: fbclidSchema,
  utm_source: utmParamSchema,
  utm_medium: utmParamSchema,
  utm_campaign: utmParamSchema,
  utm_term: utmParamSchema,
  utm_content: utmParamSchema,
  utm_id: utmParamSchema,
  geo_country: countryCodeSchema,
  geo_state: cityStateSchema,
  geo_city: cityStateSchema,
  geo_postal: postalCodeSchema,
  // Billing address recolectada por el wallet (Apple Pay / Google Pay / Link)
  // o el PaymentElement. Es la pieza fundacional para sales tax USA.
  billing_country: countryCodeSchema,
  billing_state: cityStateSchema,
  billing_city: cityStateSchema,
  billing_postal: postalCodeSchema,
  billing_line1: addressLineSchema,
  billing_line2: addressLineSchema,
});

export type CreateSetupIntentInput = z.infer<typeof createSetupIntentSchema>;

/**
 * POST /api/create-intent
 */
export const createIntentSchema = z.object({
  amount: amountSchema,
  currency: currencySchema,
  email: emailSchema.optional(),
  automatic_payment_methods: z.any().optional(),
});

export type CreateIntentInput = z.infer<typeof createIntentSchema>;

/**
 * POST /api/check-customer
 */
export const checkCustomerSchema = z.object({
  email: emailSchema,
});

export type CheckCustomerInput = z.infer<typeof checkCustomerSchema>;

/**
 * POST /api/check-subscriptions
 */
export const checkSubscriptionsSchema = z.object({
  customerId: stripeCustomerIdSchema,
});

export type CheckSubscriptionsInput = z.infer<typeof checkSubscriptionsSchema>;

// ============================================================================
// Utilidades
// ============================================================================

/**
 * Resultado de validación
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details: z.ZodIssue[];
  };
}

/**
 * Valida datos con un schema de Zod
 * 
 * @example
 * const result = validate(createCustomerSchema, req.body);
 * if (!result.success) {
 *   return res.status(400).json({ error: result.error });
 * }
 * const { name, email } = result.data;
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }
  
  return {
    success: false,
    error: {
      message: 'Validation failed',
      details: result.error.issues,
    },
  };
}

/**
 * Formatea errores de Zod para respuesta de API
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
}

/**
 * Valida datos con un schema de Zod en modo WARN
 * 
 * Si la validación falla:
 * - Loguea el error en consola
 * - Retorna los datos originales sin validar (permite continuar)
 * 
 * Útil para rollout gradual sin afectar usuarios.
 * 
 * @example
 * const data = await validateWarn(createCustomerSchema, req.body, 'create-customer', req);
 * // Siempre retorna data, pero alerta si es inválida
 */
export async function validateWarn<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  endpoint: string,
  context?: { ip?: string; url?: string }
): Promise<{ data: T; wasValid: boolean }> {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return {
      data: result.data,
      wasValid: true,
    };
  }
  
  // Validación falló - loguear pero continuar
  const errorDetails = result.error.issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
  
  console.warn(`[Validation] Endpoint ${endpoint} recibió datos inválidos:`, errorDetails, {
    ip: context?.ip || 'unknown',
    url: context?.url || 'unknown',
  });
  
  // Retornar datos originales (sin validar) para permitir continuar
  return {
    data: data as T,
    wasValid: false,
  };
}
