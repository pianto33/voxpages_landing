import { useRouter } from "next/router";
import { useTranslation, UseTranslationOptions } from "react-i18next";
import { defaultLocale, Locale, locales } from "@/locales/config";
import { readCookie } from "@/utils/cookie";

interface UseAppTranslationOptions<T = string>
  extends UseTranslationOptions<T> {
  defaultLng?: string;
}

export function useAppTranslation(
  namespace: string = "common",
  options: UseAppTranslationOptions = {}
) {
  const router = useRouter();

  // Misma jerarquía que precio: cookie `_sv_c` (seteada por Lambda@Edge) >
  // countryCode del path > defaultLocale. En SSR la cookie es null y se
  // usa el fallback; el JS del cliente re-resuelve con la cookie.
  const cookieCountry = readCookie("_sv_c")?.toLowerCase() as Locale | null;
  const lng: Locale =
    cookieCountry && (locales as readonly string[]).includes(cookieCountry)
      ? cookieCountry
      : (router.query.countryCode as Locale) || defaultLocale;

  const translation = useTranslation(namespace, { lng, ...options });

  return { ...translation, lng };
}
