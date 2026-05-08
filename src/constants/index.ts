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

export const PRICE_ID: Record<string, string> = {
    ES: "price_1St9gFIiQJtaidhOIrc57oIQ",
    US: "price_1TTpEdIiQJtaidhOGImimPye",
    TEST: "price_1St9gPIiQJtaidhOwIQPuQkA",
    DEFAULT: "price_1St8jpIiQJtaidhOGVFFc7dt",
};

export const STRIPE_DATA: StripeDataMap = {
    TEST: {
        amount: 100, // 1.00 USD
        currency: "usd",
    },
    ES: {
        amount: 1999, // 19.99 EUR
        currency: "eur",
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
