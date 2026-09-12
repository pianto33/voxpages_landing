import { STRIPE_DATA } from "@/constants";
import { defaultLocale, Locale, locales } from "@/locales/config";

/** Slugs de campaña US que llegan sin locale prefix (Lambda@Edge). */
export const US_CAMPAIGN_PATH_PREFIXES = ["/str-lv12", "/tlf"] as const;

/**
 * Primer segmento de ads/Lambda que NO es un locale ISO.
 * `/ca-28` y `/str-ca28` matcheaban `startsWith('/ca')` y Stripe no tiene CA-28.
 */
export const CAMPAIGN_SLUG_TO_LOCALE: Record<string, Locale> = {
    "ca-28": "ca",
    "str-ca28": "ca",
    "str-lv12": "us",
    tlf: "us",
};

const LOCALE_SET = new Set<string>(locales);

/** Cookie ISO country → locale del landing (cuando difieren). */
export const LOCALE_FROM_COUNTRY: Record<string, Locale> = {
    us: "us",
    ca: "ca",
    au: "au",
    mo: "mo",
    hk: "hk",
    sg: "sg",
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
    const lower = segment.toLowerCase();
    if (LOCALE_SET.has(lower)) return lower as Locale;
    return CAMPAIGN_SLUG_TO_LOCALE[lower];
}

/** Locale destino cuando el path es un slug de campaña suelto (`/ca-28`, `/str-lv12`). */
export function campaignLocaleFromPathname(pathname: string): Locale | undefined {
    const segment = firstPathSegment(pathname);
    if (!segment || LOCALE_SET.has(segment)) return undefined;
    return CAMPAIGN_SLUG_TO_LOCALE[segment];
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
    const cookie = cookieCountry?.toLowerCase();
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
    const cookie = params.cookieCountry?.toUpperCase() ?? null;
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
