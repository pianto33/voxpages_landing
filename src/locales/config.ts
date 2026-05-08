export type Locale = (typeof locales)[number];

export const locales = ["es", "pt", "it", "pl", "hu", "cz", "us"] as const;
export const defaultLocale: Locale = "es";
