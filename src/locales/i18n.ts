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
    },
    detection: {
      order: ["navigator", "htmlTag", "path", "subdomain"],
      caches: ["localStorage", "cookie"],
    },
    fallbackLng: defaultLocale,
    interpolation: {
      escapeValue: false,
    },
  });
