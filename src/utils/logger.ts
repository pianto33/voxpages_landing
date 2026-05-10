import { betterStack } from '@/monitoring/services/betterStackService';
import { getShortSessionId } from './sessionId';

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface LogMetadata {
  [key: string]: any;
}

interface LogCacheEntry {
  hash: string;
  timestamp: number;
}

/**
 * Enriquece metadata con sessionId automáticamente
 */
const enrichMetadata = (metadata?: LogMetadata): LogMetadata => {
  const enriched: LogMetadata = {
    sessionId: getShortSessionId(),
    ...metadata,
  };
  
  return enriched;
};

/**
 * Crea un hash simple de un string
 */
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

class Logger {
  // Cache para prevenir duplicados
  private logCache: Map<string, LogCacheEntry> = new Map();
  // TTL para los logs en el cache (por defecto 5 minutos)
  private cacheTTL: number = 5 * 60 * 1000;
  // Niveles que queremos deduplicar (puedes ajustar esto)
  private deduplicateLevels: Set<LogLevel> = new Set<LogLevel>(['error', 'warn', 'info']);
  // Campos a excluir del hash de deduplicación
  private excludeFields: Set<string> = new Set([
    'sessionId',
    'timestamp',
    'time',
    'date',
    'datetime',
    'requestId',
    'traceId',
  ]);

  /**
   * Limpia logs antiguos del cache
   */
  private cleanOldLogs() {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.logCache.forEach((entry, key) => {
      if (now - entry.timestamp > this.cacheTTL) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.logCache.delete(key));
  }

  /**
   * Crea una clave de metadata para deduplicación excluyendo campos que cambian
   */
  private getMetadataKey(metadata?: LogMetadata): string {
    if (!metadata) return '';

    // Filtrar metadata para solo incluir campos relevantes
    const relevantMetadata: LogMetadata = {};
    
    for (const [key, value] of Object.entries(metadata)) {
      // Solo incluir campos que NO estén en la lista de exclusión
      if (!this.excludeFields.has(key)) {
        relevantMetadata[key] = value;
      }
    }

    // Si no quedó nada relevante, retornar string vacío
    if (Object.keys(relevantMetadata).length === 0) {
      return '';
    }

    // Ordenar las claves para que el hash sea consistente
    const sortedKeys = Object.keys(relevantMetadata).sort();
    const sortedMetadata: LogMetadata = {};
    for (const key of sortedKeys) {
      sortedMetadata[key] = relevantMetadata[key];
    }

    return JSON.stringify(sortedMetadata);
  }

  /**
   * Verifica si un log es duplicado
   */
  private isDuplicate(level: LogLevel, message: string, metadata?: LogMetadata): boolean {
    // Si el nivel no está en la lista de deduplicación, permitir
    if (!this.deduplicateLevels.has(level)) {
      return false;
    }

    // Crear un hash único del log (mensaje + campos relevantes de metadata)
    const metadataKey = this.getMetadataKey(metadata);
    const logKey = `${level}:${message}:${metadataKey}`;
    const hash = simpleHash(logKey);

    // Limpiar cache periódicamente
    if (this.logCache.size > 100) {
      this.cleanOldLogs();
    }

    // Verificar si ya existe
    const existing = this.logCache.get(hash);
    if (existing) {
      const now = Date.now();
      // Si el log es reciente (dentro del TTL), es duplicado
      if (now - existing.timestamp < this.cacheTTL) {
        console.debug(`[Logger] Log duplicado detectado, ignorando: ${message}`);
        return true;
      }
    }

    // Guardar en cache
    this.logCache.set(hash, {
      hash,
      timestamp: Date.now(),
    });

    return false;
  }

  /**
   * Configura el TTL del cache (en milisegundos)
   */
  setCacheTTL(milliseconds: number) {
    this.cacheTTL = milliseconds;
  }

  /**
   * Configura qué niveles de log quieres deduplicar
   */
  setDeduplicateLevels(levels: LogLevel[]) {
    this.deduplicateLevels = new Set(levels);
  }

  /**
   * Agrega campos adicionales a excluir del hash de deduplicación
   */
  addExcludeFields(...fields: string[]) {
    fields.forEach(field => this.excludeFields.add(field));
  }

  /**
   * Remueve campos de la lista de exclusión
   */
  removeExcludeFields(...fields: string[]) {
    fields.forEach(field => this.excludeFields.delete(field));
  }

  /**
   * Configura completamente los campos a excluir
   */
  setExcludeFields(fields: string[]) {
    this.excludeFields = new Set(fields);
  }

  /**
   * Limpia manualmente el cache de logs
   */
  clearCache() {
    this.logCache.clear();
  }

  private async sendToBetterStack(level: LogLevel, message: string, metadata?: LogMetadata) {
    // Si estamos en el cliente, enviar a través de la API
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level,
            message,
            metadata,
          }),
        });
      } catch (fetchError) {
        console.error('[Logger] Error enviando log al servidor:', fetchError);
      }
      return;
    }

    try {
      // Preparar el mensaje con nivel
      const levelEmoji = {
        log: '📝',
        info: 'ℹ️',
        warn: '⚠️',
        error: '🚨',
        debug: '🔍',
      };

      const emoji = levelEmoji[level] || '📝';
      const formattedMessage = `${emoji} [${level.toUpperCase()}] ${message}`;

      // Enviar a Better Stack
      const logLevel = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info';
      await betterStack.sendLog(logLevel, formattedMessage, metadata);
    } catch (logError) {
      // Si falla Better Stack, solo logear en consola (evitar loop infinito)
      console.error('[Logger] Error enviando a Better Stack:', logError);
    }
  }

  log(message: string, metadata?: LogMetadata) {
    console.log(message, metadata || '');
    const enriched = enrichMetadata(metadata);
    
    // Log no se deduplica por defecto, pero puedes cambiarlo
    if (!this.isDuplicate('log', message, enriched)) {
      this.sendToBetterStack('log', message, enriched);
    }
  }

  info(message: string, metadata?: LogMetadata) {
    console.info(message, metadata || '');
    const enriched = enrichMetadata(metadata);
    
    if (!this.isDuplicate('info', message, enriched)) {
      this.sendToBetterStack('info', message, enriched);
    }
  }

  warn(message: string, errorOrMetadata?: Error | any | LogMetadata, metadata?: LogMetadata) {
    // Detectar si el segundo parámetro es un error o metadata
    // Si tiene propiedades típicas de Error (message, stack, code, type) es un error
    // Si no, es metadata directamente
    const isError = errorOrMetadata instanceof Error || 
      (errorOrMetadata && (
        errorOrMetadata.stack || 
        errorOrMetadata.code || 
        (errorOrMetadata.type && typeof errorOrMetadata.message === 'string')
      ));
    
    const error = isError ? errorOrMetadata : undefined;
    const actualMetadata = isError ? metadata : errorOrMetadata;
    
    console.warn(message, error || actualMetadata || '');
    
    const warnMetadata = enrichMetadata({
      ...actualMetadata,
      ...(error ? {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      } : {}),
    });
    
    if (!this.isDuplicate('warn', message, warnMetadata)) {
      this.sendToBetterStack('warn', message, warnMetadata);
    }
  }

  error(message: string, error?: Error | any, metadata?: LogMetadata) {
    console.error(message, error || '');
    
    const errorMetadata = enrichMetadata({
      ...metadata,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (!this.isDuplicate('error', message, errorMetadata)) {
      this.sendToBetterStack('error', message, errorMetadata);
    }
  }

  debug(message: string, metadata?: LogMetadata) {
    console.debug(message, metadata || '');
    // Debug no se envía a Better Stack por defecto para no saturar
  }

  // Método especial para pagos exitosos
  async paymentSuccess(email: string, amount: number, currency: string, customerId?: string, extra?: LogMetadata) {
    const metadata = enrichMetadata({
      funnel_step: 'payment_succeeded',
      email,
      amount,
      currency,
      customerId,
      customer_id: customerId,
      ...(extra || {}),
    });
    
    const message = `✅ Pago exitoso: ${email} - ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
    
    // Si estamos en el cliente, enviar a través de la API
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level: 'payment-success',
            message,
            metadata,
          }),
        });
      } catch (fetchError) {
        console.error('[Logger] Error enviando pago exitoso al servidor:', fetchError);
      }
      return;
    }

    // En servidor, enviar directamente a Better Stack
    await betterStack.info(message, metadata);
  }

  // Simétrico a paymentSuccess: pagos fallidos (decline, error de
  // confirmación, error de red, etc.). Mantiene mismo schema para
  // que las queries de funnel funcionen en ambos lados.
  async paymentFailed(reason: string, extra?: LogMetadata) {
    const metadata = enrichMetadata({
      funnel_step: 'payment_failed',
      reason,
      ...(extra || {}),
    });

    const message = `❌ Pago fallido: ${reason}`;

    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/log', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            level: 'warn',
            message,
            metadata,
          }),
        });
      } catch (fetchError) {
        console.error('[Logger] Error enviando paymentFailed al servidor:', fetchError);
      }
      return;
    }

    await betterStack.warn(message, metadata);
  }
}

// Exportar instancia única
export const logger = new Logger();

// Helpers para compatibilidad con console
export default logger;
