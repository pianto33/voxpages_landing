import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { defaultLocale } from "@/locales/config";
import commonES from "./translations/es/common.json";
import commonPT from "./translations/pt/common.json";
import commonPL from "./translations/pl/common.json";
import commonHU from "./translations/hu/common.json";
import commonCZ from "./translations/cz/common.json";
import commonUS from "./translations/us/common.json";
import commonBR from "./translations/br/common.json";
import commonMX from "./translations/mx/common.json";
import commonCL from "./translations/cl/common.json";
import commonMYS from "./translations/mys/common.json";
import commonKSA from "./translations/ksa/common.json";

declare module "i18next" {
  interface CustomTypeOptions {
    returnNull: false;
  }
}

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    returnNull: false,
    resources: {
      es: {
        common: commonES,
      },
      pt: {
        common: commonPT,
      },
      pl: {
        common: commonPL,
      },
      hu: {
        common: commonHU,
      },
      cz: {
        common: commonCZ,
      },
      us: {
        common: commonUS,
      },
      ca: {
        common: commonUS,
      },
      // Mercados EN (misma copy que US): Australia, Macao, Hong Kong, Singapur
      au: {
        common: commonUS,
      },
      mo: {
        common: commonUS,
      },
      hk: {
        common: commonUS,
      },
      sg: {
        common: commonUS,
      },
      br: {
        common: commonBR,
      },
      mx: {
        common: commonMX,
      },
      cl: {
        common: commonCL,
      },
      mys: {
        common: commonMYS,
      },
      ksa: {
        common: commonKSA,
      },
    },
    detection: {
      order: ["navigator", "htmlTag", "path", "subdomain"],
      caches: ["localStorage", "cookie"],
    },
    fallbackLng: {
      br: ["pt", defaultLocale],
      mx: [defaultLocale],
      cl: [defaultLocale],
      mys: ["us", defaultLocale],
      ksa: ["us", defaultLocale],
      default: [defaultLocale],
    },
    interpolation: {
      escapeValue: false,
    },
  });
