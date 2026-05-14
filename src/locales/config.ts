export type Locale = (typeof locales)[number];

export const locales = ["es", "pt", "pl", "hu", "cz", "us"] as const;
export const defaultLocale: Locale = "es";
