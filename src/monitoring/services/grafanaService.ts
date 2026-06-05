/**
 * Servicio de integración con Grafana Cloud
 * Plan gratuito: 10K series, 50GB logs, retención 14 días
 * https://grafana.com
 */

interface GrafanaMetric {
  name: string;
  value: number;
  timestamp?: number;
  labels?: Record<string, string>;
}

export class GrafanaService {
  private prometheusUrl: string | undefined;
  private prometheusUser: string | undefined;
  private prometheusPassword: string | undefined;

  constructor() {
    this.prometheusUrl = process.env.GRAFANA_PROMETHEUS_URL;
    this.prometheusUser = process.env.GRAFANA_PROMETHEUS_USER;
    this.prometheusPassword = process.env.GRAFANA_PROMETHEUS_PASSWORD;
  }

  /**
   * Verifica si Grafana está configurado
   */
  isConfigured(): boolean {
    return !!(this.prometheusUrl && this.prometheusUser && this.prometheusPassword);
  }

  /**
   * Envía una métrica a Grafana Cloud (Prometheus)
   * Usa el formato Prometheus Remote Write
   */
  async sendMetric(metric: GrafanaMetric): Promise<void> {
    if (!this.isConfigured() || !this.prometheusUrl) {
      return;
    }

    try {
      const timestamp = metric.timestamp || Date.now();
      const labels = metric.labels || {};

      // Formato Prometheus text-based
      const prometheusLine = this.formatPrometheusMetric(metric.name, metric.value, labels, timestamp);

      const response = await fetch(this.prometheusUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.prometheusUser}:${this.prometheusPassword}`).toString('base64')}`,
          'Content-Type': 'text/plain',
        },
        body: prometheusLine,
      });

      if (!response.ok) {
        console.error('[Grafana] Failed to send metric:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('[Grafana] Error sending metric:', error);
    }
  }

  /**
   * Formatea una métrica en formato Prometheus
   */
  private formatPrometheusMetric(
    name: string,
    value: number,
    labels: Record<string, string>,
    timestamp: number
  ): string {
    const labelsStr = Object.entries(labels)
      .map(([key, val]) => `${key}="${val}"`)
      .join(',');

    const labelsFormatted = labelsStr ? `{${labelsStr}}` : '';
    return `${name}${labelsFormatted} ${value} ${timestamp}\n`;
  }

  /**
   * Envía múltiples métricas en batch
   */
  async sendMetrics(metrics: GrafanaMetric[]): Promise<void> {
    if (!this.isConfigured()) {
      return;
    }

    // Por simplicidad, enviar una por una
    // En producción, usar Prometheus Remote Write Protocol para batch
    for (const metric of metrics) {
      await this.sendMetric(metric);
    }
  }

  /**
   * Helper para enviar métricas del sistema
   */
  async sendSystemMetrics(memory: number, memoryPercent: number, cpu: number) {
    const baseLabels = {
      app: 'voxpages_landing',
      environment: process.env.VERCEL_ENV || 'development',
    };

    await this.sendMetrics([
      {
        name: 'nodejs_memory_used_mb',
        value: memory,
        labels: baseLabels,
      },
      {
        name: 'nodejs_memory_percentage',
        value: memoryPercent,
        labels: baseLabels,
      },
      {
        name: 'nodejs_cpu_usage_ms',
        value: cpu,
        labels: baseLabels,
      },
    ]);
  }

  /**
   * Helper para métricas de API
   */
  async sendApiMetrics(endpoint: string, duration: number, statusCode: number) {
    await this.sendMetric({
      name: 'api_response_time_ms',
      value: duration,
      labels: {
        app: 'voxpages_landing',
        environment: process.env.VERCEL_ENV || 'development',
        endpoint,
        status_code: String(statusCode),
      },
    });
  }
}

// Singleton
export const grafana = new GrafanaService();
export default grafana;

