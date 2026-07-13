import { IPData } from "@/interfaces/tracking";
import { logger } from "@/utils/logger";

const IP_CACHE_KEY = 'ip_data_cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutos

interface CachedIPData {
  data: IPData;
  timestamp: number;
}

/**
 * Obtiene datos de IP desde el caché si están disponibles y no han expirado
 */
function getCachedIPData(): IPData | null {
  if (typeof window === 'undefined') return null; // Solo cachear en el cliente

  try {
    const cached = sessionStorage.getItem(IP_CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp }: CachedIPData = JSON.parse(cached);
    const now = Date.now();

    // Verificar si el caché ha expirado
    if (now - timestamp > CACHE_DURATION) {
      sessionStorage.removeItem(IP_CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    // Si hay algún error leyendo el caché, ignorarlo
    return null;
  }
}

/**
 * Guarda los datos de IP en el caché
 */
function setCachedIPData(data: IPData): void {
  if (typeof window === 'undefined') return; // Solo cachear en el cliente

  try {
    const cached: CachedIPData = {
      data,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(IP_CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    // Si hay algún error guardando el caché, ignorarlo
    console.debug('Error guardando caché de IP:', error);
  }
}

/** Evita 2 fetches en paralelo si varios effects llaman antes de escribir el caché. */
let ipDataInFlight: Promise<IPData> | null = null;

/**
 * Obtiene datos de IP usando el sistema centralizado de servicio pago + fallback.
 * Funciona tanto en cliente como en servidor.
 * Con sistema de caché para evitar llamadas repetitivas.
 * @returns Objeto con datos de IP y geolocalización
 */
export async function fetchIPData(): Promise<IPData> {
  // Intentar obtener del caché primero
  const cachedData = getCachedIPData();
  if (cachedData) {
    return cachedData;
  }

  if (typeof window !== "undefined" && ipDataInFlight) {
    return ipDataInFlight;
  }

  const request = fetchIPDataUncached();
  if (typeof window !== "undefined") {
    ipDataInFlight = request.finally(() => {
      ipDataInFlight = null;
    });
    return ipDataInFlight;
  }
  return request;
}

async function fetchIPDataUncached(): Promise<IPData> {
  const ipData: IPData = {
    ip: null,
    country: null,
    state: null,
    city: null,
    postal: null,
    timezone: null,
  };

  try {
    const API_KEY = process.env.NEXT_PUBLIC_IPAPI_ACCESS_KEY;

    // 1. Intentar primero con API premium si tenemos la key
    if (API_KEY) {
      try {
        const premiumUrl = `https://api.ipapi.com/api/check?access_key=${API_KEY}`;
        const res = await fetch(premiumUrl);

        if (res.ok) {
          const data = await res.json();

          // Verificar que la respuesta sea válida (no error de API)
          if (data && !data.error && data.ip) {
            const result = {
              ip: data.ip || null,
              country: data.country_code || null, // Código ISO (US, MX, ES) para Stripe
              state: data.region_name || null,
              city: data.city || null,
              postal: data.zip || null,
              timezone: data.time_zone?.id || null,
            };
            setCachedIPData(result);
            return result;
          } else {
            // La API premium falló o devolvió error
            throw new Error(
              `Premium API error: ${data?.error || "Invalid response"}`
            );
          }
        } else {
          throw new Error(`Premium API HTTP error: ${res.status}`);
        }
      } catch (premiumError) {
        // Solo loguear en desarrollo o primera vez
        console.debug("Premium API failed, falling back to free API", premiumError);
        // Continuar al fallback
      }
    }

    // 2. Si no tenemos API key o la premium falló, usar API gratuita
    if (!ipData.ip) {
      try {
        const freeUrl = "https://ipapi.co/json/";
        const res = await fetch(freeUrl);

        if (res.ok) {
          const data = await res.json();

          // Verificar que la respuesta sea válida
          if (data && !data.error && data.ip) {
            const result = {
              ip: data.ip || null,
              country: data.country_code || null, // Código ISO (US, MX, ES) para Stripe
              state: data.region || null,
              city: data.city || null,
              postal: data.postal || null,
              timezone: data.timezone || null,
            };
            setCachedIPData(result);
            return result;
          } else {
            throw new Error(
              `Free API error: ${data?.error || "Invalid response"}`
            );
          }
        } else {
          throw new Error(`Free API HTTP error: ${res.status}`);
        }
      } catch (freeError) {
        // Solo loguear en consola, no enviar a Slack para reducir ruido
        console.debug("Free API also failed", freeError);
      }
    }

    // 3. Último fallback: Solo obtener IP básica
    if (!ipData.ip) {
      try {
        const resIp = await fetch("https://api.ipify.org?format=json");
        if (resIp.ok) {
          const ipOnly = await resIp.json();
          const result = {
            ip: ipOnly.ip || null,
            country: null,
            state: null,
            city: null,
            postal: null,
            timezone: null,
          };
          setCachedIPData(result);
          return result;
        }
      } catch (ipError) {
        // Solo loguear en consola, no enviar a Slack para reducir ruido
        console.debug("Even IP fallback failed", ipError);
      }
    }
  } catch (error) {
    // Solo loguear en consola, no enviar a Slack para reducir ruido
    console.debug("⚠️ Error general obteniendo información de IP", error);
  }

  // Cachear incluso si falló (evitar reintentos constantes)
  setCachedIPData(ipData);
  return ipData;
}
