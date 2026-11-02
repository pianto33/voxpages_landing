import { STRIPE_DATA } from "@/constants";
import { defaultLocale, Locale, locales } from "@/locales/config";

/** Slugs de campaña US que llegan sin locale prefix (Lambda@Edge). */
export const US_CAMPAIGN_PATH_PREFIXES = ["/str-lv12", "/tlf"] as const;

/**
 * Primer segmento de ads/Lambda que NO es un locale ISO.
 * `/ca-28` y `/str-ca28` matcheaban `startsWith('/ca')` y Stripe no tiene CA-28.
 */
export const CAMPAIGN_SLUG_TO_LOCALE: Record<string, Locale> = {
    // Espejo de los pathRules de la Lambda@Edge (ab-test-cloudfront-unificado.md).
    // La Lambda ya reescribe `/slug` → `/{locale}/slug` + ?pr= + cookie `_sv_c`;
    // este mapa cubre el fallback cuando el browser lee la URL pública sin cookie.
    // mid.theauravibe.com
    "str-lv12": "us",
    "str-lv13": "us",
    ldmop: "us",
    "str-ca28": "ca",
    "str-ksa": "ksa",
    "str-myr": "mys",
    "str-aud": "au",
    "str-mx": "mx",
    tlf: "us",
    // landing-g.todosgamers.com
    "slmb-cl": "cl",
    // oneplay-g / oneplay.todosgamers.com
    "ca-28": "ca",
    "hk-2": "hk",
    "mo-2": "mo",
    // oneplay-g.playcher.com → Chequia (CZK, copy cs). El locale es `cz`, no `cze`.
    cze: "cz",
};

/**
 * Cookie / ?pr= ISO2 cuando el path de mercado no es el ISO
 * (`SA` → /ksa, `MY` → /mys).
 */
const SEGMENT_ALIASES: Record<string, Locale> = {
    sa: "ksa",
    my: "mys",
};

/** Clave de STRIPE_DATA / PRICE_ID. Acepta ISO2 y el slug de mercado. */
const MARKET_KEY_ALIASES: Record<string, string> = {
    my: "mys",
    sa: "ksa",
};

/**
 * Prefijo que la Lambda@Edge antepone a `?pr=` y a la cookie `_sv_c` cuando el
 * destino es un landing cross (`xmx`, `xcz`). Acá hay un solo producto Stripe,
 * así que el prefijo solo se tolera (se descarta); la señal la usa Gistly.
 * Ningún locale ni ISO2 empieza con `x`, no hay colisión.
 */
export const CROSS_PREFIX = "x";

export function hasCrossPrefix(value: string | null | undefined): boolean {
    if (!value) return false;
    const v = value.trim().toLowerCase();
    return v.length > CROSS_PREFIX.length && v.startsWith(CROSS_PREFIX);
}

/** `xmx` → `mx`; valores sin prefijo se devuelven igual (trim + lowercase). */
export function stripCrossPrefix(value: string): string {
    const v = value.trim().toLowerCase();
    return hasCrossPrefix(v) ? v.slice(CROSS_PREFIX.length) : v;
}

export function marketKey(raw: string | undefined | null): string {
    const key = raw ? stripCrossPrefix(raw) : "";
    if (!key) return "";
    return (MARKET_KEY_ALIASES[key] ?? key).toUpperCase();
}

const LOCALE_SET = new Set<string>(locales);

/** Cookie ISO country → locale del landing (cuando difieren). */
export const LOCALE_FROM_COUNTRY: Record<string, Locale> = {
    us: "us",
    ca: "ca",
    au: "au",
    mo: "mo",
    hk: "hk",
    sg: "sg",
    br: "br",
    mx: "mx",
    cl: "cl",
    cz: "cz",
    sa: "ksa",
    ksa: "ksa",
    my: "mys",
    mys: "mys",
};

export function firstPathSegment(pathname: string): string | undefined {
    return pathname.split("/").filter(Boolean)[0]?.toLowerCase();
}

/** Match de locale exacto: `/ca` o `/ca/...`, nunca `/ca-28`. */
export function hasLocalePrefix(pathname: string): boolean {
    const segment = firstPathSegment(pathname);
    if (!segment || !LOCALE_SET.has(segment)) return false;
    return pathname === `/${segment}` || pathname.startsWith(`/${segment}/`);
}

export function localeFromPathSegment(
    segment: string | null | undefined
): Locale | undefined {
    if (!segment) return undefined;
    const lower = stripCrossPrefix(segment);
    if (LOCALE_SET.has(lower)) return lower as Locale;
    if (SEGMENT_ALIASES[lower]) return SEGMENT_ALIASES[lower];
    return CAMPAIGN_SLUG_TO_LOCALE[lower];
}

/** Locale destino cuando el path es un slug de campaña suelto (`/ca-28`, `/str-lv12`). */
export function campaignLocaleFromPathname(pathname: string): Locale | undefined {
    const segment = firstPathSegment(pathname);
    if (!segment || LOCALE_SET.has(segment)) return undefined;
    return SEGMENT_ALIASES[segment] ?? CAMPAIGN_SLUG_TO_LOCALE[segment];
}

export function isUsCampaignPath(pathname: string): boolean {
    return US_CAMPAIGN_PATH_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

export function isCampaignSlug(segment: string | undefined): boolean {
    if (!segment) return false;
    return segment.toLowerCase() in CAMPAIGN_SLUG_TO_LOCALE;
}

/**
 * Resuelve el locale de UI: cookie `_sv_c` > path (incl. slugs de campaña) > defaultLocale.
 */
export function resolveAppLocale(
    cookieCountry: string | null | undefined,
    pathCountry: string | null | undefined
): Locale {
    const cookie = cookieCountry ? stripCrossPrefix(cookieCountry) : undefined;
    if (cookie) {
        const mapped = LOCALE_FROM_COUNTRY[cookie] ?? cookie;
        if (LOCALE_SET.has(mapped)) {
            return mapped as Locale;
        }
    }

    const fromPath = localeFromPathSegment(pathCountry);
    if (fromPath) return fromPath;

    return defaultLocale;
}

export interface LocaleMismatchInfo {
    issues: string[];
    cookie_country: string | null;
    path_country: string | undefined;
    lng: Locale;
    currency: string;
}

/**
 * Detecta desalineaciones precio/idioma/path para loguear en BetterStack.
 */
export function detectLocaleMismatch(params: {
    cookieCountry: string | null;
    pathCountry: string | undefined;
    lng: Locale;
    currency: string;
}): LocaleMismatchInfo | null {
    const issues: string[] = [];
    const cookie = params.cookieCountry ? marketKey(params.cookieCountry) : null;
    const path = params.pathCountry?.toLowerCase();

    if (cookie && STRIPE_DATA[cookie]) {
        const expected = STRIPE_DATA[cookie];
        if (expected.currency.toLowerCase() !== params.currency.toLowerCase()) {
            issues.push(
                `currency_mismatch: cookie ${cookie} expects ${expected.currency}, got ${params.currency}`
            );
        }

        const expectedLocale =
            LOCALE_FROM_COUNTRY[cookie.toLowerCase()] ?? cookie.toLowerCase();
        if (LOCALE_SET.has(expectedLocale) && params.lng !== expectedLocale) {
            issues.push(
                `locale_mismatch: cookie ${cookie} expects ${expectedLocale}, got ${params.lng}`
            );
        }
    }

    if (isCampaignSlug(path) && !cookie) {
        issues.push(`campaign_slug_without_cookie: path=${path}`);
    }

    if (issues.length === 0) return null;

    return {
        issues,
        cookie_country: cookie,
        path_country: path,
        lng: params.lng,
        currency: params.currency,
    };
}
