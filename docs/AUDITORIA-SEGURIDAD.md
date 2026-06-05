# 🔒 Auditoría de Seguridad - SR Landing voxpages

**Fecha:** Diciembre 2024  
**Versión:** 1.0

---

## 📊 Resumen Ejecutivo

| Categoría | Estado | Prioridad |
|-----------|--------|-----------|
| Dependencias Vulnerables | ✅ 0 vulnerabilidades (Dic 2024) | ✅ Resuelto |
| Rate Limiting | ✅ Implementado híbrido (Dic 2024) | ✅ Resuelto |
| Validación de Input | ✅ Implementado con Zod (Dic 2024) | ✅ Resuelto |
| Security Headers | ✅ Implementados (Dic 2024) | ✅ Resuelto |
| CORS | ✅ Configurado (Dic 2024) | ✅ Resuelto |
| Endpoint de Debug Expuesto | ✅ Eliminado (Dic 2024) | ✅ Resuelto |
| Cron Jobs Protección | ✅ CRON_SECRET obligatorio (Dic 2024) | ✅ Resuelto |
| Cache Distribuido | ⚠️ Documentado (TODO Redis) | 🟡 Media |
| SQL Injection | ✅ N/A (usa Stripe API) | ✅ OK |
| Secrets Management | ✅ En env vars | ✅ OK |
| Monitoreo | ✅ Implementado | ✅ OK |
| Logging | ✅ A Slack + BetterStack | ✅ OK |

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. ✅ ~~Dependencias con Vulnerabilidades Críticas~~ (RESUELTO)

**Estado:** ✅ RESUELTO (Diciembre 2024)

```bash
npm audit
# Resultado: found 0 vulnerabilities
```

Todas las dependencias están actualizadas y sin vulnerabilidades conocidas.

---

### 2. ✅ ~~Sin Rate Limiting en APIs Críticas~~ (RESUELTO)

**Estado:** ✅ RESUELTO (Diciembre 2024)

**Implementación:** Sistema híbrido de 2 capas en `src/lib/rate-limit/`

#### Arquitectura

```
Request → [Capa 1: Memoria] → [Capa 2: Upstash] → API Handler
              ↓                      ↓
         Bloquea ataques       Rate limit fino
         obvios (gratis)       (distribuido)
```

#### Capa 1: Memoria (gratis, instantáneo)
- **50+ requests/10seg** desde misma IP → Bloqueo 1 minuto
- No consume comandos de Upstash
- Atrapa bots/scripts agresivos

#### Capa 2: Upstash Redis (fino, distribuido)

| Endpoint | Límite | Identificador |
|----------|--------|---------------|
| `create-customer` | 10/minuto | IP |
| `create-subscription` | 5/minuto | IP + customerId |
| `create-intent` | 10/minuto | IP |
| `check-customer` | 20/minuto | IP |
| `send-email` | 3/hora | IP + email |

#### Beneficios
- Ataque rápido (100 req/seg) → Bloqueado en Capa 1 → **0 comandos Upstash**
- Ataque lento (1 req/seg) → Bloqueado en Capa 2 → ~3 comandos
- Usuario normal → Pasa ambas capas → ~3 comandos

**Variables de entorno configuradas:**
```bash
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AXxx..."
```

---

### 3. ✅ ~~Sin Validación de Input~~ (RESUELTO)

**Estado:** ✅ RESUELTO (Diciembre 2024)

**Implementación:** Validación con Zod en `src/lib/validation/`

#### Schemas implementados

| Schema | Endpoint | Validaciones |
|--------|----------|--------------|
| `createCustomerSchema` | `/api/create-customer` | name, email, country (2 chars), city, postal |
| `createSubscriptionSchema` | `/api/create-subscription` | customerId (cus_*), priceId (price_*), geo data, gclid |
| `createIntentSchema` | `/api/create-intent` | amount (int positivo), currency (3 chars), email |
| `checkCustomerSchema` | `/api/check-customer` | email (válido, max 254) |
| `sendEmailSchema` | `/api/send-email` | email, name, token, amount, currency, lng |
| `checkSubscriptionsSchema` | `/api/check-subscriptions` | customerId (cus_*) |

#### Ejemplo de uso

```typescript
import { validate, createCustomerSchema } from '@/lib/validation';

const validation = validate(createCustomerSchema, req.body);
if (!validation.success || !validation.data) {
  return res.status(400).json({ 
    error: 'Invalid input',
    details: validation.error?.details 
  });
}

const { name, email, country } = validation.data;
// Datos validados y tipados ✅
```

#### Protecciones incluidas

- ✅ Emails normalizados (lowercase, trim, max 254 chars)
- ✅ Montos validados (entero positivo, max ~$999,999)
- ✅ IDs de Stripe validados (formato cus_*, price_*)
- ✅ Códigos de país ISO (2 letras)
- ✅ Prevención de payloads enormes (límites de longitud)

---

## 🟡 PROBLEMAS MODERADOS

### 4. ✅ ~~Endpoint de Debug Expuesto~~ (RESUELTO)

**Estado:** ✅ RESUELTO (Diciembre 2024)

**Acción tomada:** 
- Eliminado `src/pages/api/verify-env.ts`
- Eliminado `src/pages/verify-env.tsx`

El endpoint ya no existe y no se expone información sensible.

---

### 5. ✅ ~~Security Headers Insuficientes~~ (RESUELTO)

**Estado:** ✅ RESUELTO (Diciembre 2024)

**Archivo:** `next.config.mjs`

**Headers implementados:**

| Header | Protección |
|--------|------------|
| `X-Frame-Options` | DENY - Previene clickjacking |
| `X-Content-Type-Options` | nosniff - Previene MIME sniffing |
| `X-XSS-Protection` | 1; mode=block - XSS (legacy) |
| `Referrer-Policy` | strict-origin-when-cross-origin |
| `Permissions-Policy` | Deshabilita camera, microphone, geolocation |
| `Strict-Transport-Security` | HSTS en producción |
| `Content-Security-Policy` | Configurado para Stripe y GTM |

**CORS configurado:**
- Producción: Solo dominios de voxpages (HTTPS)
- Desarrollo: También localhost:3000/3001

---

### 6. ✅ ~~Cron Jobs con Protección Parcial~~ (RESUELTO)

**Estado:** ✅ RESUELTO (Diciembre 2024)

**Archivos actualizados:**
- `src/pages/api/monitoring/cron/health-check.ts`
- `src/pages/api/monitoring/cron/daily-report.ts`

**Protección implementada:**
- En producción: CRON_SECRET es **obligatorio**
- Si no está configurado: Retorna error 500
- Si el secret no coincide: Retorna 401 Unauthorized
- Logging de intentos de acceso no autorizados

**Nota sobre "no exponer endpoints":**
En Vercel, los cron jobs se ejecutan vía HTTP, no es posible hacerlos "internos".
La forma correcta de protegerlos es con CRON_SECRET, que Vercel envía automáticamente
cuando ejecuta los jobs programados en `vercel.json`.

---

### 7. ⚠️ Cache de Deduplicación en Memoria (DOCUMENTADO)

**Estado:** ⚠️ DOCUMENTADO con TODO (Diciembre 2024)

**Archivos con TODO agregado:** 
- `src/pages/api/send-email.ts`
- `src/services/slackService.ts`

**Situación actual:**
- Cache en memoria (`global`) provee protección básica
- Funciona para requests duplicados en la misma instancia
- Limitaciones conocidas y documentadas en el código

**Limitaciones en Vercel serverless:**
- Cada instancia tiene su propio cache (no compartido)
- Se pierde en cold starts y re-deploys
- No garantiza deduplicación al 100%

**Mejora futura (cuando se implemente rate limiting):**
Usar Upstash Redis para cache distribuido - ver TODO en los archivos.

---

## ✅ LO QUE ESTÁ BIEN

### 8. ✅ Secrets en Environment Variables

```typescript
// Todos los secrets están en env vars, no hardcodeados
const STRIPE_PRIVATE_KEY = process.env.STRIPE_PRIVATE_KEY ?? "";
const resend = new Resend(process.env.RESEND_API_KEY);
```

✅ No hay secrets en el código fuente

---

### 9. ✅ Stripe SDK Seguro

```typescript
// Usa el SDK oficial de Stripe
import Stripe from "stripe";
const stripe = new Stripe(STRIPE_PRIVATE_KEY);

// Las llamadas son seguras por diseño
await stripe.customers.create(customerData);
await stripe.subscriptions.create(subscriptionData);
```

✅ Stripe SDK maneja automáticamente:
- Autenticación
- Encriptación
- Validación de datos
- Firma de webhooks

---

### 10. ✅ Monitoreo y Logging Estructurado

**Sistema implementado:**
- Middleware de monitoreo en APIs (`withMonitoring`)
- Logging a Slack por canales (success, red-alert, logs)
- Integración con BetterStack
- Health checks periódicos (cron jobs)
- Deduplicación de logs

```typescript
// Middleware automático
export default withMonitoring(handler);

// Logging estructurado
logger.error("Error POST '/create-customer'", error, {
  email: req.body.email,
  name: req.body.name,
});

// Alertas críticas a Slack
await notifySystemError('Error al generar token', error, { Email: email });
```

✅ Buen sistema de observabilidad

---

### 11. ✅ Idempotencia en Envío de Emails

```typescript
// Previene emails duplicados (aunque con cache en memoria)
const cachedEmail = emailCache.get(cacheKey);
if (cachedEmail && Date.now() - cachedEmail.timestamp < 5 * 60 * 1000) {
  return res.status(200).json({ 
    message: "Email ya enviado recientemente",
    isDuplicate: true,
  });
}
```

✅ Concepto correcto, pero mejorar implementación con Redis

---

## 🌐 Protección DoS/DDoS

### Lo que Vercel provee automáticamente:

| Protección | Incluido | Notas |
|------------|----------|-------|
| DDoS básico | ✅ | Edge network distribuida |
| Bot mitigation | ⚠️ | Básico en todos los planes |
| Rate limiting global | ⚠️ | Solo Pro/Enterprise |
| WAF | ❌ | Solo Enterprise |
| IP blocking | ❌ | Solo Enterprise |

### Lo que TÚ debes implementar:

| Protección | Estado | Implementación |
|------------|--------|----------------|
| Rate limiting por endpoint | ❌ | Upstash Redis |
| Input validation | ❌ | Zod |
| Request size limits | ✅ | Next.js default (4MB) |
| Brute force protection | ❌ | Rate limit + lockout |

---

## 📋 Plan de Acción (Priorizado)

### 🔴 Inmediato (Antes de producción)

1. ~~**Actualizar dependencias vulnerables**~~ ✅ HECHO
   - `npm audit` retorna 0 vulnerabilidades

2. ~~**Implementar rate limiting con Upstash**~~ ✅ HECHO
   - Sistema híbrido: Memoria (Capa 1) + Upstash (Capa 2)
   - Ver `src/lib/rate-limit/`

3. ~~**Agregar validación con Zod**~~ ✅ HECHO
   - Ver `src/lib/validation/`
   - 6 schemas implementados

### 🟡 Esta semana

4. ~~**Agregar Security Headers**~~ ✅ HECHO
   - `next.config.mjs` actualizado
   - CSP, CORS, X-Frame-Options, HSTS, etc.

5. ~~**Endpoint verify-env**~~ ✅ ELIMINADO
   - Archivos eliminados completamente

6. **Migrar cache a Redis** (TODO documentado)
   - Deduplicación de emails
   - Deduplicación de notificaciones Slack

### 🟢 Próximo sprint

7. **Considerar Cloudflare** para:
   - WAF
   - Rate limiting avanzado
   - Bot detection
   - Geographic restrictions

8. **Penetration testing**
   - Manual o con herramienta como OWASP ZAP

---

## 🧪 Tests de Seguridad Sugeridos

```typescript
describe('🔒 Security Tests', () => {
  it('rate limiting blocks excessive requests', async () => {
    // Simular 20 requests rápidos a /api/create-customer
    // Verificar que después de N retorna 429
  });
  
  it('rejects invalid input', async () => {
    const response = await fetch('/api/create-intent', {
      method: 'POST',
      body: JSON.stringify({ amount: -100, currency: 'INVALID' }),
    });
    expect(response.status).toBe(400);
  });
  
  it('security headers are present', async () => {
    const response = await fetch('/');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
```

---

## 📚 Referencias

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [Stripe Security Best Practices](https://stripe.com/docs/security/guide)
- [Upstash Rate Limiting](https://upstash.com/docs/oss/ratelimit/overview)
- [Zod Validation](https://zod.dev/)

---

## 📞 Contacto

Para reportar vulnerabilidades: help@support.voxpages.com
