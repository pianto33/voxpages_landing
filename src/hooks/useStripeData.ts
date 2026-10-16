import { STRIPE_DATA, PRICE_ID, withPriceToWallet } from "@/constants";
import { useRouteSignals } from "@/lib/browserRoute";
import { readCookie } from "@/utils/cookie";
import { localeFromPathSegment, marketKey } from "@/utils/locale";

/**
 * Orden de prioridad para resolver país (y por lo tanto precio):
 *   1. Cookie `_sv_c` (la setea el Lambda@Edge cuando rutea trafico a Vercel)
 *      → es la única fuente confiable cuando CloudFront/Vercel pueden servir
 *      HTML cacheado: la cookie viaja en cada request y la lee el JS post-hidratación.
 *   2. Query param `?pr=xx` (override manual / testing).
 *   3. `countryCode` del path (comportamiento histórico).
 */

export const useStripeData = () => {
    const { countryCode: routedCountry, priceParam: routedPrice, asPath } =
        useRouteSignals();

    const cookieCountry = marketKey(readCookie("_sv_c"));
    if (cookieCountry && STRIPE_DATA[cookieCountry]) {
        return withPriceToWallet(STRIPE_DATA[cookieCountry]);
    }

    const priceParam = marketKey(routedPrice);
    if (priceParam && STRIPE_DATA[priceParam]) {
        return withPriceToWallet(STRIPE_DATA[priceParam]);
    }

    const rawPath = routedCountry;
    const mappedPath = localeFromPathSegment(rawPath);
    const countryCode = marketKey(mappedPath ?? rawPath);

    if (asPath === "/pt-meo" || asPath.includes("/pt-meo")) {
        return withPriceToWallet(STRIPE_DATA["PT_MEO"] || STRIPE_DATA.DEFAULT);
    }

    return withPriceToWallet(STRIPE_DATA[countryCode] || STRIPE_DATA.DEFAULT);
};

export const usePriceId = () => {
    const { countryCode: routedCountry, priceParam: routedPrice, asPath } =
        useRouteSignals();

    const cookieCountry = marketKey(readCookie("_sv_c"));
    if (cookieCountry && PRICE_ID[cookieCountry]) {
        return PRICE_ID[cookieCountry];
    }

    const priceParam = marketKey(routedPrice);
    if (priceParam && PRICE_ID[priceParam]) {
        return PRICE_ID[priceParam];
    }

    const rawPath = routedCountry;
    const mappedPath = localeFromPathSegment(rawPath);
    const countryCode = marketKey(mappedPath ?? rawPath) || "DEFAULT";

    if (asPath === "/pt-meo" || asPath.includes("/pt-meo")) {
        return PRICE_ID.PT_MEO;
    }

    return PRICE_ID[countryCode] || PRICE_ID.DEFAULT;
};
