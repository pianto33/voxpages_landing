# Convenciones de logs y observabilidad

Este documento describe cómo se loguea, qué campos lleva cada log, y
cómo filtrar y correlacionar en Better Stack.

> **Origen de los logs:** Better Stack source `voxpages`, host
> `s2426827.eu-fsn-3.betterstackdata.com`. Las env vars relevantes son
> `BETTERSTACK_SOURCE_TOKEN` y `BETTERSTACK_INGESTING_HOST`.

---

## 1. Identificadores de telemetría

Cada log lleva un set estable de identificadores que permiten filtrar
y correlacionar en Better Stack:

| Campo         | Vida útil                                           | Origen                                | Uso típico                                          |
| ------------- | --------------------------------------------------- | ------------------------------------- | --------------------------------------------------- |
| `anon_id`     | persistente (localStorage)                          | UUID v4 al primer hit del browser     | "Mismo browser entre sesiones distintas"            |
| `session_id`  | sesión de tab (sessionStorage)                      | UUID v4 ya existente                  | "Una visita / tab"                                  |
| `funnel_id`   | desde `checkout_mounted` hasta `payment_*`          | UUID v4 al montar el checkout         | "Un intento de compra de punta a punta"             |
| `funnel_step` | por log                                             | string canónico (ver tabla abajo)     | Filtrar pasos del funnel                            |
| `customer_id` | desde que existe                                    | Stripe                                | Identidad post-Stripe                               |
| `email`       | desde que se conoce                                 | usuario en checkout                   | Identidad humana                                    |
| `country`     | siempre (server)                                    | `x-vercel-ip-country`                 | Geo                                                 |
| `price_id`    | en eventos de checkout / API de Stripe              | constante / query param               | Variantes de precio                                 |
| `currency`, `amount` | en eventos de checkout y `payment_*`         | `useStripeData` / payload             | Análisis monetario                                  |

**Cómo se propagan cliente → server:** el cliente inyecta tres headers
en cada `fetch` a `/api/*` cuando usás `apiFetch()`:

- `X-Anon-Id`
- `X-Session-Id`
- `X-Funnel-Id`
- `X-Customer-Id` (si ya está)

El server los extrae con `getRequestContext(req)` y los mete en cada
log automáticamente. Cualquier nuevo handler de API debería:

```ts
import { getRequestContext, compactContext } from '@/utils/serverContext';

const ctx = compactContext(getRequestContext(req));
logger.info('mi evento', { ...ctx, custom_field: 'foo' });
```

---

## 2. Pasos canónicos del funnel (`funnel_step`)

Tanto el cliente como el server usan los mismos `funnel_step`. Filtrá
por ellos para reconstruir el funnel:

| Paso                              | Origen                | Quién lo emite                            |
| --------------------------------- | --------------------- | ----------------------------------------- |
| `landing_view`                    | cliente               | `[[...slug]].tsx` (`clientLogger.visit`)  |
| `checkout_mounted`                | cliente               | `StripeExpressCheckout`, `CardPaymentForm`|
| `checkout_clicked`                | cliente               | `onClick` del Express, submit del Card    |
| `setup_intent_create_request`     | cliente y server      | `clientLogger.funnel(...)` + endpoint     |
| `customer_create_request`         | server                | `/api/create-customer` (entrada)          |
| `customer_created`                | server                | `/api/create-customer` (éxito)            |
| `setup_intent_created`            | server                | `/api/create-setup-intent` (éxito)        |
| `subscription_create_request`     | server                | `/api/create-subscription` (entrada)      |
| `subscription_created`            | server                | `/api/create-subscription` (éxito)        |
| `payment_confirm_request`         | cliente               | antes de `stripe.confirmSetup`            |
| `payment_succeeded`               | cliente               | `thanks.tsx` → `logger.paymentSuccess`    |
| `payment_failed`                  | cliente               | `clientLogger.paymentFailed(reason, ...)` |
| `magic_link_requested`            | cliente y server      | `thanks.tsx` y `/api/generate-token`      |
| `magic_link_received`             | cliente y server      | `thanks.tsx` y `/api/generate-token`      |
| `heartbeat`                       | server (cron)         | `/api/cron/health`, una vez por hora      |

---

## 3. Cómo filtrar en Better Stack

Better Stack permite búsquedas por campos del JSON. Ejemplos útiles:

```
# Todo lo que hizo un usuario en su browser, en cualquier sesión
anon_id:"a1b2c3d4-1234-4abc-9def-...

# Una sesión específica
session_id:"..."

# Un intento de compra de punta a punta (ordenar por dt asc)
funnel_id:"..."

# Funnels que llegaron a payment_failed por declines en US
funnel_step:"payment_failed" country:"US" reason:"card_declined"

# Tasa de aprobación: contar payment_succeeded vs payment_failed por país
funnel_step:"payment_succeeded" country:"US"
funnel_step:"payment_failed" country:"US"

# Errores del endpoint de SetupIntent
"check-setup-intent" level:"error"

# Health checks (heartbeat) — si dejás de verlos hay deploy roto
funnel_step:"heartbeat"

# Country mismatch (Vercel-IP vs IP-API vs billing): potencial VPN/fraude
"country_mismatch"

# Rate limit dispara
"rate_limit_hit"
```

> Tip: en Better Stack guardá estas búsquedas como **Presets** para
> tenerlas a mano. También podés crear **Alerts** sobre queries (ej:
> "más de 5 `payment_failed` con `card_declined` en 10 min en US").

---

## 4. Convenciones para nuevos logs

1. **Siempre inyectar `getRequestContext(req)` en endpoints server**.
   Eso garantiza que `anon_id`, `session_id`, `funnel_id`, `country`,
   `ip`, `origin`, `referer` viajen con el log sin trabajo extra.

2. **Eventos del funnel**: si agregás un paso nuevo del funnel, usar
   `clientLogger.funnel('mi_paso_nuevo', { ... })` o
   `logger.info('...', { funnel_step: 'mi_paso_nuevo', ...ctx })`.
   Mantener `snake_case` y verbos en pasado (`*_created`, `*_failed`,
   `*_requested`, `*_received`).

3. **Niveles**:
   - `info`: eventos de funnel + creaciones exitosas.
   - `warn`: cosas raras pero esperables (declines, country mismatch,
     resource_missing, rate-limit).
   - `error`: bugs reales del sistema.

4. **Naming de campos**: usar `snake_case` (`customer_id`, `price_id`,
   `setup_intent_id`). Hay legacy en camelCase, pero todo log nuevo
   debería usar snake_case para queries consistentes.

5. **Nunca loguear** secretos (`STRIPE_PRIVATE_KEY`, `JWT_LANDING_SECRET`),
   ni números completos de tarjeta (Stripe nunca los envía al cliente
   igual). Email se loguea en plain (decisión de proyecto).

---

## 5. Cliente: cómo enviar logs

Para emitir logs desde un componente React:

```ts
import { clientLogger } from '@/utils/clientLogger';

// Funnel:
clientLogger.funnel('checkout_clicked', { priceId, amount, currency });

// Pago exitoso (cierra funnel):
clientLogger.paymentSuccess(email, amount, currency, { lng });

// Pago fallido (mantiene el funnel):
clientLogger.paymentFailed('card_declined', {
  stripe_error_code: error.code,
  stripe_decline_code: error.decline_code,
});

// Genérico:
clientLogger.info('mi evento', { campo_extra: 'foo' });
clientLogger.warn('algo raro', { detalle: 'bar' });
clientLogger.error('algo mal', { error_msg: e.message });
```

Para hacer requests a `/api/*` que propaguen los headers de telemetría
automáticamente, usar `apiFetch` en lugar de `fetch`:

```ts
import { apiFetch } from '@/utils/apiFetch';

const r = await apiFetch('/api/create-setup-intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
});
```

---

## 6. Server: cómo enviar logs

```ts
import { logger } from '@/utils/logger';
import { getRequestContext, compactContext } from '@/utils/serverContext';

async function handler(req, res) {
  const ctx = compactContext(getRequestContext(req));

  logger.info('mi-endpoint request', { ...ctx, email: req.body.email });

  try {
    // ... lógica ...
    logger.info('mi-endpoint success', {
      funnel_step: 'mi_paso_creado',
      ...ctx,
      result_id: result.id,
    });
  } catch (err) {
    logger.error('mi-endpoint error', err, { ...ctx });
  }
}
```

---

## 7. Heartbeat / health check

`/api/cron/health` se ejecuta cada hora (Vercel Cron, ver `vercel.json`)
y emite un evento `funnel_step:"heartbeat"` con métricas de runtime.
Si en Better Stack dejás de ver heartbeats, la app está caída o el
deploy rompió las env vars de Better Stack.

Para protegerlo, seteá `CRON_SECRET` en Vercel; el cron de Vercel ya
manda `Authorization: Bearer <CRON_SECRET>` automáticamente.
