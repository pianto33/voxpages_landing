/**
 * Identidad y contexto del usuario para telemetría.
 *
 * Convenciones de identificadores (filtrables en Better Stack):
 *  - anon_id:    UUID v4 persistente en localStorage. Sigue al MISMO browser
 *                a través de sesiones distintas (cierre de tab, días después).
 *                El usuario puede borrarlo (privacy mode, "clear data"), no
 *                es invasivo y es estándar en analytics.
 *  - session_id: UUID v4 por sesión de tab (sessionStorage). Distingue
 *                visitas separadas del mismo anon_id.
 *  - funnel_id:  UUID v4 que identifica un INTENTO de compra de punta a
 *                punta. Se crea al montar el componente de checkout y se
 *                cierra al recibir payment_succeeded o payment_failed.
 *  - customer_id: id de Stripe (cuando ya existe).
 *  - email:      email del usuario (cuando lo conocemos).
 *
 * Cómo filtrar logs en Better Stack:
 *  - "todos los logs de un usuario":      anon_id:"a1b2c3d4-..."
 *  - "una visita":                        session_id:"..."
 *  - "un intento de compra":              funnel_id:"..."
 *  - "intentos fallidos en US":           funnel_step:"payment_failed" country:"US"
 */

import { getSessionId } from './sessionId';

const ANON_ID_KEY = 'app_anon_id';
const FUNNEL_ID_KEY = 'app_funnel_id';
const CUSTOMER_ID_KEY = 'app_customer_id';
const EMAIL_KEY = 'app_email';

/**
 * UUID v4 simple (sin dependencias externas).
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Obtiene (o crea) el anon_id persistente en localStorage.
 * Devuelve "server" si se llama desde el servidor.
 */
export function getAnonId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return 'temp-' + generateUUID();
  }
}

/**
 * Inicia un nuevo funnel. Llamarlo cuando el usuario está por entrar
 * al flujo de pago (típicamente al montar StripeExpressCheckout).
 * Si ya hay uno activo, lo reusa (idempotente).
 */
export function startFunnel(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem(FUNNEL_ID_KEY);
    if (!id) {
      id = generateUUID();
      sessionStorage.setItem(FUNNEL_ID_KEY, id);
    }
    return id;
  } catch {
    return 'temp-' + generateUUID();
  }
}

/**
 * Fuerza un nuevo funnel_id (después de un payment_succeeded o
 * cuando el usuario reintenta un pago tras un fallo).
 */
export function resetFunnel(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const id = generateUUID();
    sessionStorage.setItem(FUNNEL_ID_KEY, id);
    return id;
  } catch {
    return 'temp-' + generateUUID();
  }
}

/**
 * Obtiene el funnel_id actual sin crear uno nuevo. Devuelve null si
 * no hay funnel activo.
 */
export function getFunnelId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(FUNNEL_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Cierra el funnel actual. Llamarlo después de un payment_succeeded
 * para que la próxima compra arranque uno nuevo.
 */
export function endFunnel(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(FUNNEL_ID_KEY);
  } catch {
    // noop
  }
}

/**
 * Persiste el customer_id de Stripe para correlacionar logs futuros.
 */
export function setCustomerId(customerId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (customerId) sessionStorage.setItem(CUSTOMER_ID_KEY, customerId);
  } catch {
    // noop
  }
}

export function getCustomerId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(CUSTOMER_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Persiste el email del usuario (formato plain, según decisión de proyecto).
 */
export function setEmail(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (email) sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    // noop
  }
}

export function getEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

/**
 * Devuelve el contexto completo para enriquecer logs del cliente.
 * Lo usa clientLogger en cada envío automáticamente.
 */
export interface ClientLogContext {
  anon_id: string;
  session_id: string;
  funnel_id: string | null;
  customer_id: string | null;
  email: string | null;
  path: string;
  url: string;
  referrer: string;
  user_agent: string;
}

export function getClientLogContext(): ClientLogContext {
  if (typeof window === 'undefined') {
    return {
      anon_id: 'server',
      session_id: 'server',
      funnel_id: null,
      customer_id: null,
      email: null,
      path: '',
      url: '',
      referrer: '',
      user_agent: '',
    };
  }

  return {
    anon_id: getAnonId(),
    session_id: getSessionId(),
    funnel_id: getFunnelId(),
    customer_id: getCustomerId(),
    email: getEmail(),
    path: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer || '',
    user_agent: navigator.userAgent || '',
  };
}

/**
 * Headers que se inyectan en cada fetch a /api/* para que el server
 * tenga el mismo contexto que el cliente sin pedírselo en el body.
 */
export const TELEMETRY_HEADERS = {
  ANON: 'X-Anon-Id',
  SESSION: 'X-Session-Id',
  FUNNEL: 'X-Funnel-Id',
  CUSTOMER: 'X-Customer-Id',
} as const;

export function getTelemetryHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const headers: Record<string, string> = {
    [TELEMETRY_HEADERS.ANON]: getAnonId(),
    [TELEMETRY_HEADERS.SESSION]: getSessionId(),
  };
  const funnel = getFunnelId();
  if (funnel) headers[TELEMETRY_HEADERS.FUNNEL] = funnel;
  const customer = getCustomerId();
  if (customer) headers[TELEMETRY_HEADERS.CUSTOMER] = customer;
  return headers;
}
