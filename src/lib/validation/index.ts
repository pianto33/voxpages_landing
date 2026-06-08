/**
 * 🔒 Validación de Inputs
 * 
 * Uso:
 * ```typescript
 * import { validate, createCustomerSchema } from '@/lib/validation';
 * 
 * const result = validate(createCustomerSchema, req.body);
 * if (!result.success) {
 *   return res.status(400).json({ error: result.error });
 * }
 * const { name, email } = result.data;
 * ```
 */

export {
  // Schemas base
  emailSchema,
  nameSchema,
  stripeCustomerIdSchema,
  stripePriceIdSchema,
  countryCodeSchema,
  postalCodeSchema,
  cityStateSchema,
  ipAddressSchema,
  currencySchema,
  amountSchema,
  fbclidSchema,
  utmParamSchema,
  localeSchema,
  
  // Schemas por endpoint
  createCustomerSchema,
  createSubscriptionSchema,
  createSetupIntentSchema,
  createIntentSchema,
  checkCustomerSchema,
  checkSubscriptionsSchema,
  checkSetupIntentSchema,
  
  // Tipos
  type CreateCustomerInput,
  type CreateSubscriptionInput,
  type CreateSetupIntentInput,
  type CreateIntentInput,
  type CheckCustomerInput,
  type CheckSubscriptionsInput,
  type CheckSetupIntentInput,
  type ValidationResult,
  
  // Utilidades
  validate,
  validateWarn,
  formatZodError,
} from './schemas';
