export const GENERAL = {
    WHATSAPP_URL: "https://api.whatsapp.com/send?phone=54912341234",
};

export const GTM_EVENTS = {
    STRIPE_CLICK: "stripe_click",
    STRIPE_CLICK_FAIL: "stripe_click_fail",
    STRIPE_CANCEL: "stripe_cancel",
    GO_TO_PLATFORM: "go_to_platform",
    PAYMENT_SUCCEDED: "payment_succeded",
    PAYMENT_FAILED: "payment_failed",
};

interface StripeData {
    amount: number;
    currency: string;
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
    US: "price_1TTpEdIiQJtaidhOGImimPye",
    TEST: "price_1St9gPIiQJtaidhOwIQPuQkA",
    DEFAULT: "price_1St8jpIiQJtaidhOGVFFc7dt",
};

// amount expresado en la menor unidad de cada moneda (centavos/fillér/grosz/haléř).
// Para HUF la menor unidad es fillér: HUF 6.800 → 680000.
export const STRIPE_DATA: StripeDataMap = {
    TEST: {
        amount: 100, // 1.00 USD
        currency: "usd",
    },
    ES: {
        amount: 1999, // 19.99 EUR
        currency: "eur",
    },
    PT: {
        amount: 1999, // 19.99 EUR
        currency: "eur",
    },
    PL: {
        amount: 4900, // 49.00 PLN
        currency: "pln",
    },
    HU: {
        amount: 680000, // 6.800 HUF
        currency: "huf",
    },
    CZ: {
        amount: 41900, // 419.00 CZK
        currency: "czk",
    },
    US: {
        amount: 3999, // 39.99 USD
        currency: "usd",
    },
    DEFAULT: {
        amount: 1999, // 19.99 EUR
        currency: "eur",
    },
};
