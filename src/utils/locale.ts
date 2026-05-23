import { STRIPE_DATA } from "@/constants";
import { defaultLocale, Locale, locales } from "@/locales/config";

/** Slugs de campaña US que llegan sin locale prefix (Lambda@Edge). */
export const US_CAMPAIGN_PATH_PREFIXES = ["/str-lv12", "/tlf"] as const;

/** Cookie ISO country → locale del landing (cuando difieren). */
export const LOCALE_FROM_COUNTRY: Record<string, Locale> = {
    us: "us",
    ca: "ca",
};

export function isUsCampaignPath(pathname: string): boolean {
    return US_CAMPAIGN_PATH_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

export function isCampaignSlug(segment: string | undefined): boolean {
    if (!segment) return false;
    return US_CAMPAIGN_PATH_PREFIXES.some(
        (prefix) => segment === prefix.slice(1) || segment.startsWith(`${prefix.slice(1)}/`)
    );
}

/**
 * Resuelve el locale de UI: cookie `_sv_c` > path > defaultLocale.
 */
export function resolveAppLocale(
    cookieCountry: string | null | undefined,
    pathCountry: string | null | undefined
): Locale {
    const cookie = cookieCountry?.toLowerCase();
    if (cookie) {
        const mapped = LOCALE_FROM_COUNTRY[cookie] ?? cookie;
        if ((locales as readonly string[]).includes(mapped)) {
            return mapped as Locale;
        }
    }

    const path = pathCountry?.toLowerCase();
    if (path && (locales as readonly string[]).includes(path)) {
        return path as Locale;
    }

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
        if (
            (locales as readonly string[]).includes(expectedLocale) &&
            params.lng !== expectedLocale
        ) {
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
