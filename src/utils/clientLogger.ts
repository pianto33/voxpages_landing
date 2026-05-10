/**
 * Logger del cliente. Envía logs al endpoint /api/log de forma no
 * bloqueante (fire-and-forget con keepalive) y enriquece cada log
 * con identificadores de telemetría:
 *
 *   anon_id     -> mismo browser entre sesiones (localStorage)
 *   session_id  -> sesión de tab actual (sessionStorage)
 *   funnel_id   -> intento de compra activo (sessionStorage)
 *   customer_id -> Stripe customer si ya existe
 *   email       -> email plain si lo conocemos
 *
 * También expone helpers `funnel(step, ...)` para emitir eventos de
 * funnel con campos canónicos y `paymentSuccess` / `paymentFailed`.
 *
 * Convención de eventos del funnel (filtrables por `funnel_step`):
 *   - landing_view
 *   - checkout_mounted
 *   - checkout_clicked
 *   - setup_intent_create_request
 *   - setup_intent_created      (también lo emite el server)
 *   - payment_confirm_request
 *   - payment_succeeded         (alias de paymentSuccess)
 *   - payment_failed
 *   - magic_link_requested
 *   - magic_link_received
 */

import { getClientLogContext, getAnonId, getFunnelId } from './userIdentity';
import { getSessionId } from './sessionId';

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'red-alert' | 'visit' | 'click';

interface LogMetadata {
  [key: string]: any;
}

export type FunnelStep =
  | 'landing_view'
  | 'checkout_mounted'
  | 'checkout_clicked'
  | 'setup_intent_create_request'
  | 'setup_intent_created'
  | 'payment_confirm_request'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'magic_link_requested'
  | 'magic_link_received';

class ClientLogger {
  private async sendLog(level: LogLevel, message: string, metadata?: LogMetadata) {
    try {
      const ctx = getClientLogContext();

      const enriched: LogMetadata = {
        ...ctx,
        ...(metadata || {}),
        timestamp: new Date().toISOString(),
      };

      fetch('/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Anon-Id': getAnonId(),
          'X-Session-Id': getSessionId(),
          ...(getFunnelId() ? { 'X-Funnel-Id': getFunnelId() as string } : {}),
        },
        body: JSON.stringify({
          level,
          message,
          metadata: enriched,
        }),
        keepalive: true,
      }).catch(() => {
        // noop: telemetría nunca debe romper el flujo del usuario
      });
    } catch {
      // noop
    }
  }

  log(message: string, metadata?: LogMetadata) {
    this.sendLog('log', message, metadata);
  }

  info(message: string, metadata?: LogMetadata) {
    this.sendLog('info', message, metadata);
  }

  warn(message: string, metadata?: LogMetadata) {
    this.sendLog('warn', message, metadata);
  }

  error(message: string, metadata?: LogMetadata) {
    this.sendLog('error', message, metadata);
  }

  redAlert(message: string, metadata?: LogMetadata) {
    this.sendLog('red-alert', message, metadata);
  }

  visit(pageName: string, metadata?: LogMetadata) {
    this.sendLog('visit', `Page Visit: ${pageName}`, {
      funnel_step: 'landing_view' as FunnelStep,
      page_name: pageName,
      ...metadata,
    });
  }

  click(element: string, metadata?: LogMetadata) {
    this.sendLog('click', `User Click: ${element}`, {
      element,
      ...metadata,
    });
  }

  /**
   * Emite un evento canónico de funnel. El campo `funnel_step` queda
   * como string canónico; el `message` queda legible.
   */
  funnel(step: FunnelStep, metadata?: LogMetadata) {
    this.sendLog('info', `[funnel] ${step}`, {
      funnel_step: step,
      ...metadata,
    });
  }

  /**
   * Pago exitoso. Cierra el funnel después de loguear (el próximo
   * intento del mismo usuario tendrá un funnel_id nuevo).
   */
  paymentSuccess(
    email: string,
    amount: number,
    currency: string,
    metadata?: LogMetadata
  ) {
    this.sendLog(
      'info',
      `payment_succeeded: ${email} ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`,
      {
        funnel_step: 'payment_succeeded' as FunnelStep,
        email,
        amount,
        currency,
        ...metadata,
      }
    );
  }

  /**
   * Pago fallido (decline, error de red, error de Stripe). Mantiene
   * el funnel abierto para que el reintento siga vinculado.
   */
  paymentFailed(
    reason: string,
    metadata?: LogMetadata
  ) {
    this.sendLog('warn', `payment_failed: ${reason}`, {
      funnel_step: 'payment_failed' as FunnelStep,
      reason,
      ...metadata,
    });
  }
}

export const clientLogger = new ClientLogger();

export default clientLogger;
