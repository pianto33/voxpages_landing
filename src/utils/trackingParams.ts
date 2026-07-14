/**
 * Utilidades para preservar parámetros de tracking (fbclid, utm_*, etc.)
 * a través del flujo de pago
 */

export const TRACKING_PARAMS = [
  'fbclid',       // Facebook Click ID
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',       // Meta Ad Set / Campaign ID
  'msclkid',      // Microsoft Ads Click ID
  'ttclid',       // TikTok Click ID
] as const;

/** Query keys to keep when redirecting between checkout surfaces. */
export const CHECKOUT_PRESERVE_PARAMS = [
  ...TRACKING_PARAMS,
  'pr',
  'notr',
] as const;

/**
 * Builds a query object from the current router query, keeping only
 * tracking + pricing flags (pr / notr).
 */
export const pickCheckoutQuery = (
  query: Record<string, string | string[] | undefined>
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of CHECKOUT_PRESERVE_PARAMS) {
    const value = query[key];
    if (typeof value === 'string' && value) {
      out[key] = value;
    }
  }
  return out;
};

export interface TrackingParams {
  fbclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  utm_id?: string;
  msclkid?: string;
  ttclid?: string;
}

/**
 * Extrae los parámetros de tracking de la URL actual
 */
export const extractTrackingParams = (query: Record<string, string | string[] | undefined>): TrackingParams => {
  const params: TrackingParams = {};
  
  TRACKING_PARAMS.forEach((param) => {
    const value = query[param];
    if (value && typeof value === 'string') {
      params[param as keyof TrackingParams] = value;
    }
  });
  
  return params;
};

/**
 * Guarda los parámetros de tracking en localStorage
 */
export const saveTrackingParams = (params: TrackingParams): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem('trackingParams', JSON.stringify(params));
  } catch (error) {
    console.error('Error guardando tracking params:', error);
  }
};

/**
 * Recupera los parámetros de tracking desde localStorage
 */
export const getTrackingParams = (): TrackingParams => {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem('trackingParams');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Error recuperando tracking params:', error);
    return {};
  }
};

/**
 * Construye un query string con los parámetros de tracking
 */
export const buildTrackingQueryString = (params: TrackingParams, includeQuestionMark = true): string => {
  const entries = Object.entries(params).filter(([, value]) => value);
  
  if (entries.length === 0) return '';
  
  const queryString = entries
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join('&');
  
  return includeQuestionMark ? `?${queryString}` : queryString;
};

/**
 * Añade parámetros de tracking a una URL
 */
export const addTrackingParams = (url: string, params: TrackingParams): string => {
  const queryString = buildTrackingQueryString(params, false);
  
  if (!queryString) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${queryString}`;
};

