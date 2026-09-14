// Mapeo del countryCode del landing (us/es/pt/pl/hu/cz/ca/au/mo/hk/sg) al locale del sitio
// principal (voxpages.com). El landing usa "us" (y mercados EN) para tráfico inglés pero el
// sitio principal usa "en" como locale inglés. El resto coincide.
const SITE_LOCALE_MAP: Record<string, string> = {
    us: "en",
    ca: "en",
    au: "en",
    mo: "en",
    hk: "en",
    sg: "en",
    es: "es",
    pt: "pt",
    pl: "pl",
    hu: "hu",
    cz: "cz",
};

function toSiteLocale(lng: string): string {
    return SITE_LOCALE_MAP[lng.toLowerCase()] ?? "es";
}

// Páginas legales/soporte viven en voxpages.com, no en el landing.
// El landing solo linkea afuera para evitar duplicación y mismatches.
export const LEGAL = {
    SUPPORT_EMAIL: "help@voxpages.com",
    COMPANY_NAME: "Pianto33 LLC",
    COMPANY_ADDRESS: "1007 N Orange St, 4th Floor STE 4527, Wilmington, DE 19801, US",
    termsUrl: (lng: string) =>
        `https://www.voxpages.com/${toSiteLocale(lng)}/terms`,
    privacyUrl: (lng: string) =>
        `https://www.voxpages.com/${toSiteLocale(lng)}/privacy`,
    subscriptionPolicyUrl: (lng: string) =>
        `https://www.voxpages.com/${toSiteLocale(lng)}/subscription-policy`,
};

export const GTM_EVENTS = {
    STRIPE_CLICK: "stripe_click",
    STRIPE_CLICK_FAIL: "stripe_click_fail",
    STRIPE_CANCEL: "stripe_cancel",
    GO_TO_PLATFORM: "go_to_platform",
    PAYMENT_SUCCEDED: "payment_succeded",
    PAYMENT_FAILED: "payment_failed",
};

export interface StripeData {
    amount: number;
    currency: string;
    /** Mínimo de cargo Stripe en unidad menor (mismo formato que amount). */
    minPriceStripe: number;
}

/** Monto que se manda a Elements / wallets: el mínimo, no el full. */
export function withPriceToWallet(data: StripeData): StripeData & { priceToWallet: number } {
    return { ...data, priceToWallet: data.minPriceStripe };
}

interface StripeDataMap extends Partial<Record<string, StripeData>> {
    DEFAULT: StripeData;
}

// Keys ISO 3166-1 alpha-2 en uppercase. El Lambda@Edge setea la cookie `_sv_c`
// usando `cloudfront-viewer-country`, los hooks (`useStripeData` / `usePriceId`)
// la pasan a uppercase y matchean contra estos mapas.
export const PRICE_ID: Record<string, string> = {
    ES: "price_1Su25dIiQJtaidhOGQkittUc",
    PT: "price_1T05OHIiQJtaidhOEyBKlduA",
    PL: "price_1Sz2R2IiQJtaidhOeJn7ObxV",
    HU: "price_1Sz2RTIiQJtaidhOx0ACsVYK",
    CZ: "price_1T05MtIiQJtaidhOA6FWLCOA",
    CA: "price_1TZxHpIiQJtaidhO9AcDCeOe",
    US: "price_1TTpEdIiQJtaidhOGImimPye",
    AU: "price_1TtVo7IiQJtaidhOOllGeCDd",
    MO: "price_1TtVoTIiQJtaidhOwZlGa1cw",
    HK: "price_1TtVooIiQJtaidhOoUDABLqH",
    SG: "price_1TtVpJIiQJtaidhOVKjfIX7j",
    TEST: "price_1St9gPIiQJtaidhOwIQPuQkA",
    DEFAULT: "price_1St8jpIiQJtaidhOGVFFc7dt",
};

/** Producto Stripe principal de Voxpages (landing). */
export const STRIPE_PRODUCT_ID = "prod_TqqQ17wBX3t38I";

// amount expresado en la menor unidad de cada moneda (centavos/fillér/grosz/haléř).
// Para HUF la menor unidad es fillér: HUF 6.800 → 680000.
// minPriceStripe: floor para Elements/wallets. La tabla Stripe
// (https://docs.stripe.com/currencies#minimum-and-maximum-charge-amounts)
// no alcanza si al convertir a USD (settlement) queda < ~0.50 USD: GPay
// no aparece y Express Checkout cae a /checkout-card.
export const STRIPE_DATA: StripeDataMap = {
    TEST: {
        amount: 100, // 1.00 USD
        currency: "usd",
        minPriceStripe: 50, // 0.50 USD
    },
    ES: {
        amount: 1999, // 19.99 EUR
        currency: "eur",
        minPriceStripe: 50, // 0.50 EUR
    },
    CA: {
        amount: 2800, // 28.00 CAD
        currency: "cad",
        minPriceStripe: 100, // 1.00 CAD (tabla 0.50 CAD ≈ 0.36 USD → GPay no aparece)
    },
    PT: {
        amount: 1999, // 19.99 EUR
        currency: "eur",
        minPriceStripe: 50, // 0.50 EUR
    },
    PL: {
        amount: 4900, // 49.00 PLN
        currency: "pln",
        minPriceStripe: 200, // 2.00 PLN
    },
    HU: {
        amount: 680000, // 6.800 HUF
        currency: "huf",
        minPriceStripe: 17500, // 175.00 HUF
    },
    CZ: {
        amount: 41900, // 419.00 CZK
        currency: "czk",
        minPriceStripe: 1500, // 15.00 CZK
    },
    US: {
        amount: 3999, // 39.99 USD
        currency: "usd",
        minPriceStripe: 50, // 0.50 USD
    },
    AU: {
        amount: 2890, // 28.90 AUD
        currency: "aud",
        minPriceStripe: 100, // 1.00 AUD (tabla 0.50 AUD ≈ 0.33 USD → GPay no aparece)
    },
    MO: {
        amount: 16000, // 160.00 MOP
        currency: "mop",
        minPriceStripe: 800, // 8.00 MOP (~1 USD; 4.00 MOP no alcanzó para GPay)
    },
    HK: {
        amount: 15000, // 150.00 HKD
        currency: "hkd",
        minPriceStripe: 400, // 4.00 HKD
    },
    SG: {
        amount: 2599, // 25.99 SGD
        currency: "sgd",
        minPriceStripe: 100, // 1.00 SGD (tabla 0.50 SGD ≈ 0.37 USD → GPay no aparece)
    },
    DEFAULT: {
        amount: 1999, // 19.99 USD (matchea el priceId DEFAULT cargado en Stripe)
        currency: "usd",
        minPriceStripe: 50, // 0.50 USD
    },
};

/** Resuelve amount/currency a partir de un Stripe price_id (metadata del SetupIntent). */
export function getStripeDataByPriceId(priceId: string): StripeData | null {
    for (const [key, id] of Object.entries(PRICE_ID)) {
        if (id === priceId) {
            return STRIPE_DATA[key] ?? null;
        }
    }
    return null;
}
