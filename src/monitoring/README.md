# 📊 Carpeta de Monitoreo

Esta carpeta contiene **todo el código relacionado con monitoreo y observabilidad** del sistema.

---

## 📁 Estructura

```
src/monitoring/
├── README.md                     ← Este archivo
├── services/                     ← Servicios de monitoreo
│   ├── monitoringService.ts      Core del sistema de monitoreo
│   ├── betterStackService.ts     Integración con Better Stack
│   └── grafanaService.ts         Integración con Grafana Cloud
└── middleware/                   ← Middleware
    └── apiMonitoring.ts          Middleware para monitoreo automático de APIs
```

---

## 🔧 Servicios

### `monitoringService.ts`
**Propósito:** Core del sistema de monitoreo

**Exports principales:**
- `getSystemMetrics()` - Obtiene métricas del sistema (memoria, CPU)
- `checkSystemHealth()` - Verifica estado del sistema y alerta si hay problemas
- `PerformanceMonitor` - Clase para monitorear performance de requests
- `runHealthCheck()` - Ejecuta health check completo
- `formatMetricsForExport()` - Formatea métricas para exportación

**Usado por:**
- `/api/monitoring/health`
- `/api/monitoring/metrics`
- `/api/monitoring/cron/*`
- Middleware de API

---

### `betterStackService.ts`
**Propósito:** Integración con Better Stack (Logtail)

**Exports principales:**
- `betterStack.sendLog()` - Envía log a Better Stack
- `betterStack.info()`, `warn()`, `error()`, etc.
- `betterStack.sendMetrics()` - Envía métricas
- `betterStack.sendPerformance()` - Envía datos de performance

**Configuración:**
```bash
BETTERSTACK_SOURCE_TOKEN=tu_token
```

**Usado por:**
- `slackService.ts` (automático)

---

### `grafanaService.ts`
**Propósito:** Integración con Grafana Cloud

**Exports principales:**
- `grafana.sendMetric()` - Envía métrica individual
- `grafana.sendMetrics()` - Envía múltiples métricas
- `grafana.sendSystemMetrics()` - Envía métricas del sistema
- `grafana.sendApiMetrics()` - Envía métricas de API

**Configuración:**
```bash
GRAFANA_PROMETHEUS_URL=tu_url
GRAFANA_PROMETHEUS_USER=tu_user
GRAFANA_PROMETHEUS_PASSWORD=tu_password
```

**Estado:** Opcional (no se usa automáticamente)

---

## 🛣️ Middleware

### `apiMonitoring.ts`
**Propósito:** Middleware para monitoreo automático de APIs

**Export principal:**
- `withMonitoring(handler)` - Envuelve un handler de API para monitorearlo

**Uso:**
```typescript
import { withMonitoring } from '@/monitoring/middleware/apiMonitoring';

async function handler(req, res) {
  // tu código
}

export default withMonitoring(handler);
```

**Qué hace:**
- ⏱️ Mide tiempo de respuesta
- 💾 Mide uso de memoria
- 🚨 Alerta si tarda > 5 segundos
- 🔴 Alerta si retorna 5xx
- 📊 Exporta métricas

**Aplicado en:**
- `/api/create-customer`
- `/api/create-intent`
- `/api/create-subscription`
- `/api/check-customer`
- `/api/check-subscriptions`

---

## 📊 Endpoints de API

Los endpoints de monitoreo están en `src/pages/api/monitoring/`:

```
src/pages/api/monitoring/
├── health.ts                  GET /api/monitoring/health
├── metrics.ts                 GET /api/monitoring/metrics
└── cron/
    ├── health-check.ts        POST /api/monitoring/cron/health-check
    └── daily-report.ts        POST /api/monitoring/cron/daily-report
```

### `GET /api/monitoring/health`
Health check del sistema
- Retorna estado saludable/no saludable
- Métricas de memoria y CPU
- HTTP 200 si OK, 503 si problemas

### `GET /api/monitoring/metrics`
Exportación de métricas
- Formato JSON (default)
- Formato Prometheus (`?format=prometheus`)
- Requiere header: `Authorization: Bearer TOKEN`

### `POST /api/monitoring/cron/health-check`
Cron job de health check
- Ejecutado cada 15 minutos por Vercel
- Alerta en Slack si hay problemas
- Requiere header: `Authorization: Bearer CRON_SECRET`

### `POST /api/monitoring/cron/daily-report`
Cron job de reporte diario
- Ejecutado diariamente a las 9am UTC
- Envía resumen a Slack canal #monitoring
- Requiere header: `Authorization: Bearer CRON_SECRET`

---

## 🔗 Dependencias

### Internas:
- `@/services/slackService` - Para enviar alertas a Slack

### Externas:
- Ninguna (solo usa APIs nativas de Node.js)

---

## 🚀 Cómo Usar

### 1. Aplicar monitoreo a una API:
```typescript
// src/pages/api/tu-endpoint.ts
import { withMonitoring } from '@/monitoring/middleware/apiMonitoring';

async function handler(req, res) {
  // tu lógica aquí
  res.json({ success: true });
}

export default withMonitoring(handler);
```

### 2. Obtener métricas del sistema:
```typescript
import { getSystemMetrics } from '@/monitoring/services/monitoringService';

const metrics = getSystemMetrics();
console.log(metrics.memory.percentage); // ej: 45.2
```

### 3. Enviar log a Better Stack:
```typescript
import { betterStack } from '@/monitoring/services/betterStackService';

await betterStack.info('Usuario registrado', {
  email: 'user@example.com',
  plan: 'premium'
});
```

### 4. Verificar health:
```bash
curl https://tu-app.vercel.app/api/monitoring/health
```

---

## ⚙️ Configuración

Variables de entorno necesarias:

### Requeridas:
```bash
CRON_SECRET=tu_token_secreto
METRICS_AUTH_TOKEN=tu_token_secreto
SLACK_WEBHOOK_MONITORING=tu_webhook
```

### Opcionales:
```bash
BETTERSTACK_SOURCE_TOKEN=tu_token
GRAFANA_PROMETHEUS_URL=tu_url
GRAFANA_PROMETHEUS_USER=tu_user
GRAFANA_PROMETHEUS_PASSWORD=tu_password
LOG_ALL_REQUESTS=false
```

---

## 📈 Métricas Capturadas

### Sistema:
- 💾 Memoria usada (MB)
- 📊 Porcentaje de memoria
- ⚙️ CPU usage (ms)
- 🕐 Uptime del servidor

### APIs:
- ⏱️ Tiempo de respuesta (ms)
- 💾 Memoria por request (KB)
- 🔢 HTTP status code
- 🌍 País del usuario
- 📱 User Agent
- 🔗 Endpoint y método

---

## 🎯 Performance

**Overhead por request:** ~10-15ms (2-5%)

Ver análisis completo en: `docs/monitoring/PERFORMANCE_IMPACT.md`

---

## 📚 Documentación

Toda la documentación está en `docs/monitoring/`:
- `QUICK_START.md` - Guía rápida
- `MONITORING_SETUP.md` - Setup completo
- `INTEGRATION_EXAMPLES.md` - Ejemplos de integraciones
- `PERFORMANCE_IMPACT.md` - Análisis de performance

---

## 🧪 Testing

Script de testing disponible:
```bash
./test-monitoring.sh https://tu-app.vercel.app
```

---

## 🤝 Mantener Separado

**IMPORTANTE:** Todo el código de monitoreo debe permanecer en esta carpeta.

**✅ Agregar aquí:**
- Nuevos servicios de monitoreo
- Nuevas integraciones (DataDog, Sentry, etc.)
- Utilidades de logging
- Helpers de métricas

**❌ NO agregar aquí:**
- Lógica de negocio
- Servicios de la aplicación principal
- Código no relacionado con observabilidad

---

## 🔄 Flujo de Datos

```
1. Request llega a API
   ↓
2. Middleware withMonitoring() intercepta
   ↓
3. Ejecuta tu handler
   ↓
4. Mide performance y memoria
   ↓
5. Si hay problema → Alerta a Slack/Better Stack
   ↓
6. Retorna respuesta al usuario
```

---

## 💡 Tips

1. **No modifiques las rutas de API** - Están en `vercel.json`
2. **Los servicios son singleton** - Se instancian una sola vez
3. **Todo es async** - No bloquea las respuestas al usuario
4. **Fail-safe** - Si monitoreo falla, no rompe tu app

---

**Última actualización:** 4 de Diciembre de 2025  
**Mantenido por:** Sistema de Monitoreo voxpages

