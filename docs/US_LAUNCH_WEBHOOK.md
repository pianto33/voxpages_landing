# US Launch — Cambios en el frontend que el webhook debe consumir

> Contexto: empezamos a suscribir usuarios en USA. Para sales tax (Stripe Tax monitoring + futuro filing) necesitamos **billing address** asociado a cada transacción.
> Este doc resume **qué cambió en `sr_landing-voxpages`** y **qué tiene que hacer el servicio que procesa los webhooks de Stripe** para no perder esa información.

---

## TL;DR para el equipo del webhook

1. El landing ahora **captura billing address** desde Apple Pay / Google Pay / Link / PaymentElement y lo manda al backend de tres formas redundantes:
   - **`setupIntent.metadata.billing_*`** (set en `setupIntents.create` desde el landing).
   - **`paymentMethod.billing_details.address`** (set por Stripe automáticamente en `confirmSetup`).
   - **`customer.address` + `customer.metadata.billing_*`** (cuando el webhook crea el customer, debe usar estos valores).
2. **Source of truth recomendada (en orden):**
   1. `paymentMethod.billing_details.address` — la pieza más confiable, validada por la wallet.
   2. `setupIntent.metadata.billing_*` — fallback (en caso de que el PM no tenga address).
   3. `setupIntent.metadata.geo_*` — fallback geo IP (poco confiable, NO usar para tax).
3. Al **crear el Customer** (en el webhook), **persistir** el billing address en:
   - `customer.address.{country, state, city, postal_code, line1, line2}`
   - `customer.metadata.billing_*` (mismos campos, prefijo `billing_`).
4. Al **crear la Subscription**, propagar `billing_*` en `subscription.metadata`.
5. **NO activar `automatic_tax: { enabled: true }` todavía.** Stripe Tax está en modo monitoring (Nivel A). Se activará el cobro de tax cuando crucemos thresholds y nos registremos como contribuyente.

---

## 1. Nuevos campos en `setupIntent.metadata`

Cuando el landing crea el SetupIntent (`POST /api/create-setup-intent`), inyecta estos campos en `metadata` (todos opcionales y en formato string):

| Campo | Origen | Ejemplo |
|---|---|---|
| `billing_country` | wallet/PaymentElement | `"US"` (ISO 3166-1 alpha-2) |
| `billing_state` | wallet/PaymentElement | `"CA"` |
| `billing_city` | wallet/PaymentElement | `"San Francisco"` |
| `billing_postal` | wallet/PaymentElement | `"94103"` |
| `billing_line1` | wallet (Google Pay/Link) | `"123 Market St"` |
| `billing_line2` | wallet (Google Pay/Link) | `"Apt 4B"` |
| `geo_country` | IP geolocation (fallback) | `"US"` |
| `geo_state` | IP geolocation (fallback) | `"California"` |
| `geo_city` | IP geolocation (fallback) | `"San Francisco"` |
| `geo_postal` | IP geolocation (fallback) | `"94103"` |
| `email`, `name`, `priceId`, `countryCode`, `ip_address`, `fbclid`, `utm_*`, `utm_id` | (ya existentes) | — |

> **Nota Apple Pay**: por default Apple Pay envía solo `country` + `postal_code` (no street). Eso es **suficiente** para sales tax USA (Stripe mapea ZIP → estado vía AVS). Por eso `billing_line1`/`billing_line2` pueden venir vacíos en pagos con Apple Pay y NO es un error.

---

## 2. Flujo end-to-end

```
[Cliente]                               [sr_landing-voxpages]                      [Webhook backend]
   │                                              │                                       │
   │  click Apple/Google Pay / completa form      │                                       │
   │ ─────────────────────────────────────────►   │                                       │
   │                                              │ POST /api/create-setup-intent         │
   │                                              │  body: { ..., billing_* }             │
   │                                              │ Stripe.setupIntents.create({          │
   │                                              │   metadata: { billing_*, geo_* }      │
   │                                              │ })                                    │
   │                                              │                                       │
   │  confirmSetup({                              │                                       │
   │    payment_method_data.billing_details = {   │                                       │
   │      email, name, address: { ... }           │                                       │
   │    }                                         │                                       │
   │  })                                          │                                       │
   │ ◄────────────────────────────────────────    │                                       │
   │                                              │                                       │
   │  redirect → /thanks (return_url)             │                                       │
   │                                              │                                       │
   │                       Stripe webhook: setup_intent.succeeded ─────────────────────►  │
   │                                                                                      │
   │                                                                  El backend debe:    │
   │                                                                  1) leer setupIntent │
   │                                                                  2) leer paymentMethod│
   │                                                                  3) crear/encontrar  │
   │                                                                     customer con     │
   │                                                                     address          │
   │                                                                  4) crear subscription│
   │                                                                     con metadata     │
```

---

## 3. Qué hacer en el webhook (lógica recomendada)

### 3.1 Resolver el billing address

```ts
// Pseudocódigo
async function resolveBillingAddress(setupIntent: Stripe.SetupIntent) {
  // 1. Preferir el address del PaymentMethod (validado por la wallet)
  const pmId = typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : setupIntent.payment_method?.id;

  let pmAddress: Stripe.Address | null = null;
  let cardCountry: string | null = null;

  if (pmId) {
    const pm = await stripe.paymentMethods.retrieve(pmId);
    pmAddress = pm.billing_details?.address ?? null;
    cardCountry = pm.card?.country ?? null;
  }

  // 2. Fallback: metadata del SetupIntent (lo que mandó el landing)
  const meta = setupIntent.metadata ?? {};

  return {
    country: pmAddress?.country || meta.billing_country || null,
    state: pmAddress?.state || meta.billing_state || null,
    city: pmAddress?.city || meta.billing_city || null,
    postal_code: pmAddress?.postal_code || meta.billing_postal || null,
    line1: pmAddress?.line1 || meta.billing_line1 || null,
    line2: pmAddress?.line2 || meta.billing_line2 || null,
    // Para audit trail / triangulación tax:
    card_country: cardCountry,
    geo_country: meta.geo_country || null,
    geo_state: meta.geo_state || null,
    geo_postal: meta.geo_postal || null,
    ip_address: meta.ip_address || null,
  };
}
```

### 3.2 Crear / actualizar el Customer

```ts
const billing = await resolveBillingAddress(setupIntent);

const customerParams: Stripe.CustomerCreateParams = {
  email: setupIntent.metadata.email,
  name: setupIntent.metadata.name,
  metadata: {
    // ...metadata existente que ya guardabas (utm_*, fbclid, ip_address, etc.)
    billing_country: billing.country ?? "",
    billing_state: billing.state ?? "",
    billing_city: billing.city ?? "",
    billing_postal: billing.postal_code ?? "",
    billing_line1: billing.line1 ?? "",
    billing_line2: billing.line2 ?? "",
    card_country: billing.card_country ?? "",
    geo_country: billing.geo_country ?? "",
    geo_state: billing.geo_state ?? "",
    geo_postal: billing.geo_postal ?? "",
  },
};

// CLAVE: setear address.country como mínimo. State + postal habilitan
// el mapeo a estado en Stripe Tax (sales tax USA via AVS).
if (billing.country) {
  customerParams.address = {
    country: billing.country,
    ...(billing.state && { state: billing.state }),
    ...(billing.city && { city: billing.city }),
    ...(billing.postal_code && { postal_code: billing.postal_code }),
    ...(billing.line1 && { line1: billing.line1 }),
    ...(billing.line2 && { line2: billing.line2 }),
  };
}

const customer = await stripe.customers.create(customerParams);
```

### 3.3 Crear la Subscription

```ts
await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: setupIntent.metadata.priceId }],
  default_payment_method: pmId,
  trial_period_days: 1,
  metadata: {
    billing_country: billing.country ?? "",
    billing_state: billing.state ?? "",
    billing_city: billing.city ?? "",
    billing_postal: billing.postal_code ?? "",
    card_country: billing.card_country ?? "",
    // ...resto del metadata existente
  },
  // ❌ NO PONER automatic_tax todavía. Stripe Tax está en monitoring.
});
```

---

## 4. Persistir en la DB interna (audit trail)

Junto a cada `subscription` recomendamos guardar (para auditoría y futuro tracking de threshold):

| Columna | Tipo | Origen |
|---|---|---|
| `billing_country` | varchar(2) | `pm.billing_details.address.country` |
| `billing_state` | varchar(50) | `pm.billing_details.address.state` |
| `billing_postal` | varchar(20) | `pm.billing_details.address.postal_code` |
| `billing_city` | varchar(100) | `pm.billing_details.address.city` |
| `card_country` | varchar(2) | `pm.card.country` |
| `geo_country` | varchar(2) | `setupIntent.metadata.geo_country` |
| `geo_state` | varchar(100) | `setupIntent.metadata.geo_state` |
| `ip_address` | varchar(45) | `setupIntent.metadata.ip_address` |
| `customer_country_resolved` | varchar(2) | resultado de la lógica de fallback (billing → geo → card) |

Esto da el "EU-style two non-contradictory pieces of evidence" que mencionó el equipo.

---

## 5. Identificar transacciones US

El landing tiene un nuevo **price** y locale dedicados:

| País | URL | `priceId` | `currency` | `amount` |
|---|---|---|---|---|
| USA | `/us` | `price_1TTpEdIiQJtaidhOGImimPye` | `usd` | `3999` (39.99 USD) |
| España | `/es` | `price_1St9gFIiQJtaidhOIrc57oIQ` | `eur` | `1999` |
| Default | `/{otros}` | `price_1St8jpIiQJtaidhOGVFFc7dt` | `eur` | `1999` |

En el webhook se puede detectar US tanto por:
- `setupIntent.metadata.priceId === "price_1TTpEdIiQJtaidhOGImimPye"`
- `setupIntent.metadata.countryCode === "us"`
- `billing_country === "US"`

---

## 6. Stripe Tax (estado actual)

- **Nivel A activado**: monitoring por jurisdicción.
- **Nivel B NO activado**: no se cobra tax al cliente. Activar `automatic_tax: { enabled: true }` cuando estemos a punto de cruzar threshold y registrarnos.
- **Tax code del producto**: pendiente de revisar en Stripe Dashboard → Product. Recomendado para SaaS digital: `txcd_10103001` ("Software as a service - business use") o `txcd_10103000` (general). Si el producto no tiene `tax_code` asignado y activamos Nivel B, Stripe lo trata como "general" — ok pero ambiguo.

---

## 7. Checklist para el equipo del webhook

- [ ] Leer `paymentMethod.billing_details.address` después de `setup_intent.succeeded`.
- [ ] Caer en `setupIntent.metadata.billing_*` cuando el PM no tenga address.
- [ ] Setear `customer.address.country` (mínimo) y `state`/`postal_code` cuando estén.
- [ ] Copiar `billing_*` a `customer.metadata` y `subscription.metadata`.
- [ ] Persistir en DB las columnas de audit trail (`billing_*`, `card_country`, `geo_*`).
- [ ] Distinguir USA por `priceId` o `countryCode` en logs/dashboards internos.
- [ ] Confirmar que **no** se activó `automatic_tax` en `subscriptions.create`.
- [ ] Probar con un Apple Pay de prueba que el `billing_postal` llega y el `customer.address.state` se setea solo (lo deduce Stripe).

---

## 8. Contacto / dudas

Cualquier duda sobre los nuevos campos o cómo el landing los está enviando, el código fuente está en:

- `src/components/StripeExpressCheckout/index.tsx` (Apple/Google/Link)
- `src/components/CardPaymentForm/index.tsx` (PaymentElement, fallback)
- `src/pages/api/create-setup-intent.ts` (qué se persiste en `setupIntent.metadata`)
- `src/lib/validation/schemas.ts` (schema Zod de los campos billing)
