import { useRouter } from "next/router";
import { STRIPE_DATA, PRICE_ID } from "@/constants";
import { readCookie } from "@/utils/cookie";

/**
 * Orden de prioridad para resolver país (y por lo tanto precio):
 *   1. Cookie `_sv_c` (la setea el Lambda@Edge cuando rutea trafico a Vercel)
 *      → es la única fuente confiable cuando CloudFront/Vercel pueden servir
 *      HTML cacheado: la cookie viaja en cada request y la lee el JS post-hidratación.
 *   2. Query param `?pr=xx` (override manual / testing).
 *   3. `countryCode` del path (comportamiento histórico).
 */

export const useStripeData = () => {
    const router = useRouter();

    const cookieCountry = readCookie("_sv_c")?.toUpperCase();
    if (cookieCountry && STRIPE_DATA[cookieCountry]) {
        return STRIPE_DATA[cookieCountry];
    }

    const priceParam = router.query.pr?.toString().toUpperCase();
    if (priceParam && STRIPE_DATA[priceParam]) {
        return STRIPE_DATA[priceParam];
    }

    const countryCode =
        typeof router.query.countryCode === "string"
            ? router.query.countryCode.toUpperCase()
            : "";

    if (router.asPath === "/pt-meo" || router.asPath.includes("/pt-meo")) {
        return STRIPE_DATA["PT_MEO"] || STRIPE_DATA.DEFAULT;
    }

    return STRIPE_DATA[countryCode] || STRIPE_DATA.DEFAULT;
};

export const usePriceId = () => {
    const router = useRouter();

    const cookieCountry = readCookie("_sv_c")?.toUpperCase();
    if (cookieCountry && PRICE_ID[cookieCountry]) {
        return PRICE_ID[cookieCountry];
    }

    const priceParam = router.query.pr?.toString().toUpperCase();
    if (priceParam && PRICE_ID[priceParam]) {
        return PRICE_ID[priceParam];
    }

    const countryCode =
        router.query.countryCode?.toString().toUpperCase() || "DEFAULT";

    if (router.asPath === "/pt-meo" || router.asPath.includes("/pt-meo")) {
        return PRICE_ID.PT_MEO;
    }

    return PRICE_ID[countryCode] || PRICE_ID.DEFAULT;
};
