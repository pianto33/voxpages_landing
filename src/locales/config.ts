export type Locale = (typeof locales)[number];

export const locales = [
  "es",
  "pt",
  "pl",
  "hu",
  "cz",
  "us",
  "ca",
  "au",
  "mo",
  "hk",
  "sg",
  "br",
  "mx",
  "cl",
  "mys",
  "ksa",
] as const;
export const defaultLocale: Locale = "es";
