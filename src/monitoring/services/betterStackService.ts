/**
 * Servicio de integración con Better Stack (Logtail)
 * Plan gratuito: 1GB/mes, retención 7 días
 * https://betterstack.com
 */

interface BetterStackLog {
  dt: string; // timestamp ISO
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  [key: string]: any; // metadata adicional
}

export class BetterStackService {
  private sourceToken: string | undefined;
  private ingestingHost: string;
  private endpoint: string;

  constructor() {
    this.sourceToken = process.env.BETTERSTACK_SOURCE_TOKEN;
    // El ingesting host por defecto (funciona para la mayoría)
    this.ingestingHost = process.env.BETTERSTACK_INGESTING_HOST || 'in.logs.betterstack.com';
    this.endpoint = `https://${this.ingestingHost}`;
  }

  /**
   * Verifica si Better Stack está configurado
   */
  isConfigured(): boolean {
    return !!this.sourceToken;
  }

  /**
   * Envía un log a Better Stack
   * Formato según: https://betterstack.com/docs/logs/ingesting-data/http/logs/
   */
  async sendLog(
    level: BetterStackLog['level'],
    message: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.sourceToken) {
      // Si no está configurado, no hacer nada (silencioso)
      return;
    }

    try {
      // Formato correcto según la documentación de Better Stack
      const log: BetterStackLog = {
        message, // message primero (requerido)
        dt: new Date().toISOString(), // RFC 3339 format
        level,
        // Metadata adicional
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
        app: 'voxpages_landing',
        ...metadata,
      };

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sourceToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(log),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[BetterStack] Failed to send log:', response.status, response.statusText, text);
      }
    } catch (error) {
      // No lanzar error para evitar romper el flujo principal
      console.error('[BetterStack] Error sending log:', error);
    }
  }

  /**
   * Helpers para diferentes niveles
   */
  async info(message: string, metadata?: Record<string, any>) {
    await this.sendLog('info', message, metadata);
  }

  async warn(message: string, metadata?: Record<string, any>) {
    await this.sendLog('warn', message, metadata);
  }

  async error(message: string, metadata?: Record<string, any>) {
    await this.sendLog('error', message, metadata);
  }

  async debug(message: string, metadata?: Record<string, any>) {
    await this.sendLog('debug', message, metadata);
  }

  async fatal(message: string, metadata?: Record<string, any>) {
    await this.sendLog('fatal', message, metadata);
  }

  /**
   * Envía métricas estructuradas
   */
  async sendMetrics(metrics: Record<string, number>) {
    await this.sendLog('info', 'System Metrics', {
      ...metrics,
      type: 'metrics',
    });
  }

  /**
   * Envía evento de performance
   */
  async sendPerformance(endpoint: string, duration: number, statusCode: number) {
    await this.sendLog('info', `API Performance: ${endpoint}`, {
      type: 'performance',
      endpoint,
      duration_ms: duration,
      status_code: statusCode,
    });
  }
}

// Singleton
export const betterStack = new BetterStackService();
export default betterStack;

