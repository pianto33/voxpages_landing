import { useRouter } from "next/router";
import { useTranslation, UseTranslationOptions } from "react-i18next";
import { Locale } from "@/locales/config";
import { readCookie } from "@/utils/cookie";
import { resolveAppLocale } from "@/utils/locale";

interface UseAppTranslationOptions<T = string>
  extends UseTranslationOptions<T> {
  defaultLng?: string;
}

export function useAppTranslation(
  namespace: string = "common",
  options: UseAppTranslationOptions = {}
) {
  const router = useRouter();

  // Cookie `_sv_c` > path > defaultLocale. CA/US mapeados vía LOCALE_FROM_COUNTRY.
  // En SSR la cookie es null; el cliente re-resuelve post-hidratación.
  const lng: Locale = resolveAppLocale(
    readCookie("_sv_c"),
    router.query.countryCode?.toString()
  );

  const translation = useTranslation(namespace, { lng, ...options });

  return { ...translation, lng };
}
