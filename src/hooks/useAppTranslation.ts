import { useTranslation, UseTranslationOptions } from "react-i18next";
import { Locale } from "@/locales/config";
import { useRouteSignals } from "@/lib/browserRoute";
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
  const { countryCode } = useRouteSignals();

  // Cookie `_sv_c` > path > defaultLocale. CA/US mapeados vía LOCALE_FROM_COUNTRY.
  // El path sale de la URL pública antes de router.isReady.
  const lng: Locale = resolveAppLocale(readCookie("_sv_c"), countryCode);

  const translation = useTranslation(namespace, { lng, ...options });

  return { ...translation, lng };
}
