# 🔌 Ejemplos de Integración con Herramientas de Monitoreo

Esta guía contiene ejemplos prácticos de integración con diferentes herramientas de monitoreo gratuitas.

---

## 📊 Better Stack (Logtail)

### 1. Crear Cuenta y Obtener Token

1. Ve a [betterstack.com](https://betterstack.com) y crea una cuenta gratuita
2. Ve a "Logs" > "Sources"
3. Click en "Connect source"
4. Selecciona "HTTP" como el tipo de fuente
5. Copia el **Source Token**

### 2. Configurar en Vercel

```bash
# Agrega esta variable de entorno en Vercel
BETTERSTACK_SOURCE_TOKEN=tu_token_aqui
```

### 3. ¡Listo!

El sistema ya está configurado para enviar logs automáticamente. Verás:

- ✅ Todos los logs de Slack también en Better Stack
- ✅ Logs estructurados con metadata
- ✅ Niveles: info, warn, error, fatal
- ✅ Búsqueda y filtros avanzados

### 4. Crear Dashboards en Better Stack

#### Dashboard de Errores:
1. Ve a "Dashboards" > "Create dashboard"
2. Agrega widget "Count" con query:
   ```
   level:error
   ```
3. Agrupa por: `message`

#### Dashboard de Performance:
1. Agrega widget "Histogram"
2. Query:
   ```
   type:performance
   ```
3. Campo: `duration_ms`

#### Dashboard de Memoria:
1. Agrega widget "Line chart"
2. Query:
   ```
   type:metrics
   ```
3. Campo: `memory.percentage`

### 5. Configurar Alertas

1. Ve a "Alerting" > "Create alert"
2. Condiciones ejemplo:

**Alerta de Errores:**
```
Query: level:error
Condition: Count > 10 in 5 minutes
Notify: Slack #alerts
```

**Alerta de Memoria:**
```
Query: type:metrics AND memory.percentage > 85
Condition: Count > 3 in 10 minutes
Notify: Slack #red-alert
```

---

## 📈 Grafana Cloud

### 1. Crear Cuenta

1. Ve a [grafana.com](https://grafana.com/auth/sign-up/create-user)
2. Selecciona "Free" plan
3. Crea tu stack (ej: `voxpages.grafana.net`)

### 2. Configurar Prometheus como Data Source

1. En Grafana, ve a "Connections" > "Data sources"
2. Click "Add data source" > "Prometheus"
3. Configura:
   ```
   Name: Vercel Metrics
   URL: https://tu-app.vercel.app/api/metrics?format=prometheus
   ```

4. En "Authentication":
   - Selecciona "Custom HTTP headers"
   - Header: `Authorization`
   - Value: `Bearer tu_METRICS_AUTH_TOKEN`

5. Click "Save & Test"

### 3. Variables de Entorno (Opcional - Para Push)

Si quieres hacer PUSH de métricas a Grafana (recomendado):

```bash
# En Grafana Cloud, ve a Details > Prometheus
# Copia estos valores:
GRAFANA_PROMETHEUS_URL=https://prometheus-prod-XX-XXX.grafana.net/api/prom/push
GRAFANA_PROMETHEUS_USER=123456
GRAFANA_PROMETHEUS_PASSWORD=tu_token_de_grafana
```

### 4. Importar Dashboards Pre-hechos

1. Ve a "Dashboards" > "Import"
2. Ingresa estos IDs:

**Node.js Application Dashboard:**
```
ID: 11159
Data source: Vercel Metrics
```

**API Monitoring:**
```
ID: 3662
Data source: Vercel Metrics
```

### 5. Crear Dashboard Personalizado

#### Panel: Memory Usage (Gauge)

```promql
# Query
nodejs_memory_percentage

# Visualization: Gauge
# Thresholds:
# - Green: 0-60
# - Yellow: 60-80
# - Red: 80-100
```

#### Panel: Memory Over Time (Graph)

```promql
# Query
nodejs_memory_used_mb

# Visualization: Time series
# Legend: Memory Used (MB)
```

#### Panel: API Response Times (Heatmap)

```promql
# Query (requiere histogramas)
rate(api_response_time_ms_bucket[5m])

# Visualization: Heatmap
```

### 6. Configurar Alertas en Grafana

1. En tu panel, click en el título > "Edit"
2. Tab "Alert"
3. Click "Create alert rule from this panel"

**Ejemplo - Alta Memoria:**
```
Condition: WHEN avg() OF query(A, 5m, now) IS ABOVE 85
Evaluate: Every 1m for 5m
Send to: Slack #red-alert
Message: 
  🚨 Alta memoria detectada
  Valor: {{ $values.A }}%
  Host: {{ $labels.instance }}
```

---

## ⏰ BetterUptime (Uptime Monitoring)

### 1. Crear Cuenta

1. Ve a [betteruptime.com](https://betteruptime.com)
2. Crea cuenta gratuita (10 monitores gratis)

### 2. Crear Monitor de Health Check

1. Click "Create monitor"
2. Configura:
   ```
   Monitor type: HTTP(s)
   URL: https://tu-app.vercel.app/api/health
   Name: Main App Health
   Check interval: 3 minutes (gratis)
   Request timeout: 30 seconds
   ```

3. Expected response:
   ```json
   Status code: 200
   Response contains: "healthy"
   ```

### 3. Configurar Alertas

1. En el monitor, ve a "Notifications"
2. Click "Add integration" > "Slack"
3. Conecta tu workspace de Slack
4. Selecciona el canal (ej: `#red-alert`)

### 4. Crear Status Page (GRATIS)

1. Ve a "Status pages" > "Create status page"
2. Agrega tus monitores
3. Personaliza:
   ```
   Title: voxpages Status
   URL: voxpages.betteruptime.com (gratis)
   Theme: Light/Dark
   ```

4. ¡Comparte la URL públicamente!

### 5. Monitores Adicionales Recomendados

**Monitor de Métricas:**
```
URL: https://tu-app.vercel.app/api/metrics
Expected: 200
Advanced: Check if memory.percentage < 90
```

**Monitor de Cron:**
```
Type: Heartbeat
Name: Daily Report Heartbeat
Expected: Signal every 24 hours
```

Para el heartbeat, modifica `daily-report.ts`:
```typescript
// Al final del handler exitoso:
if (process.env.BETTERUPTIME_HEARTBEAT_URL) {
  await fetch(process.env.BETTERUPTIME_HEARTBEAT_URL);
}
```

---

## 🔔 Configuración Avanzada de Slack

### 1. Mejorar Formato de Mensajes

Actualiza `slackService.ts` para usar Block Kit:

```typescript
const blocks = [
  {
    type: 'header',
    text: {
      type: 'plain_text',
      text: '🚨 Alert: High Memory Usage',
    },
  },
  {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Memory:*\n${memory}MB (${percent}%)`,
      },
      {
        type: 'mrkdwn',
        text: `*Status:*\n❌ Critical`,
      },
    ],
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Metrics',
        },
        url: 'https://tu-app.vercel.app/api/metrics',
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'View Logs',
        },
        url: 'https://betterstack.com',
        style: 'primary',
      },
    ],
  },
];
```

### 2. Crear Slash Commands

1. En Slack, ve a "Your Apps" > "Create New App"
2. "From scratch" > Nombre: "System Monitor"
3. "Slash Commands" > "Create New Command"

**Comando: `/health`**
```
Command: /health
Request URL: https://tu-app.vercel.app/api/slack/health
Short description: Check system health
```

Crea el endpoint:
```typescript
// src/pages/api/slack/health.ts
export default async function handler(req, res) {
  const metrics = getSystemMetrics();
  
  return res.json({
    response_type: 'in_channel',
    text: `System Health Check`,
    blocks: [
      // ... formato de métricas
    ],
  });
}
```

---

## 🧪 Scripts de Testing

### Script para Probar Todas las Integraciones

```bash
#!/bin/bash
# test-monitoring.sh

echo "🧪 Testing Monitoring System..."
echo ""

BASE_URL="https://tu-app.vercel.app"
METRICS_TOKEN="tu_METRICS_AUTH_TOKEN"
CRON_SECRET="tu_CRON_SECRET"

echo "1️⃣ Testing Health Check..."
curl -s $BASE_URL/api/health | jq .
echo ""

echo "2️⃣ Testing Metrics (JSON)..."
curl -s -H "Authorization: Bearer $METRICS_TOKEN" \
  $BASE_URL/api/metrics | jq .
echo ""

echo "3️⃣ Testing Metrics (Prometheus)..."
curl -s -H "Authorization: Bearer $METRICS_TOKEN" \
  "$BASE_URL/api/metrics?format=prometheus"
echo ""

echo "4️⃣ Testing Health Check Cron..."
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  $BASE_URL/api/cron/health-check | jq .
echo ""

echo "5️⃣ Testing Daily Report Cron..."
curl -s -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  $BASE_URL/api/cron/daily-report | jq .
echo ""

echo "✅ All tests completed!"
```

Guárdalo y hazlo ejecutable:
```bash
chmod +x test-monitoring.sh
./test-monitoring.sh
```

---

## 📱 App de Monitoreo Móvil

### Better Stack Mobile App
- iOS: https://apps.apple.com/app/logtail/id1564453538
- Android: https://play.google.com/store/apps/details?id=com.logtail

### Grafana Mobile App
- iOS: https://apps.apple.com/app/grafana/id1463944812
- Android: https://play.google.com/store/apps/details?id=com.grafana.mobile.android

### BetterUptime Mobile App
- iOS: https://apps.apple.com/app/better-uptime/id1525186096
- Android: https://play.google.com/store/apps/details?id=com.betteruptime

---

## 🎯 Checklist de Setup Completo

- [ ] Variables de entorno configuradas en Vercel
- [ ] Cron jobs activados (vercel.json desplegado)
- [ ] Better Stack conectado y recibiendo logs
- [ ] Grafana dashboard importado y funcionando
- [ ] BetterUptime monitoreando health check
- [ ] Alertas de Slack configuradas
- [ ] Status page público creado
- [ ] Apps móviles instaladas
- [ ] Script de testing ejecutado exitosamente

---

## 🆘 Troubleshooting

**Problema: No recibo alertas en Slack**
- ✅ Verifica que las variables `SLACK_WEBHOOK_*` estén configuradas
- ✅ Revisa que estés en producción (`VERCEL_ENV=production`)
- ✅ Chequea los logs de Vercel

**Problema: Better Stack no recibe logs**
- ✅ Verifica `BETTERSTACK_SOURCE_TOKEN`
- ✅ Mira la consola del navegador/servidor para errores
- ✅ Revisa que la integración esté en `slackService.ts`

**Problema: Grafana no puede conectarse**
- ✅ Verifica que el endpoint `/api/metrics` sea público
- ✅ Chequea el `METRICS_AUTH_TOKEN`
- ✅ Prueba el endpoint manualmente con curl

**Problema: Cron jobs no se ejecutan**
- ✅ Verifica que `vercel.json` esté en la raíz del proyecto
- ✅ Asegúrate de haber desplegado después de agregar vercel.json
- ✅ Revisa "Settings > Cron Jobs" en Vercel Dashboard

---

¿Más preguntas? Revisa la documentación principal en `MONITORING_SETUP.md`

