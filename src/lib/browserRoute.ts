import { useRouter } from "next/router";
import { useEffect, useLayoutEffect, useState } from "react";
import {
  campaignLocaleFromPathname,
  firstPathSegment,
  hasLocalePrefix,
} from "@/utils/locale";

/**
 * Señales de ruta leídas de window.location, sin esperar router.isReady.
 *
 * En páginas auto-exportadas con middleware, Next deja isReady en false hasta
 * un router.replace async (componentDidMount). Ese hueco retrasa <Elements>.
 * La URL pública ya tiene el país: locale (`/us`), slug de campaña (`/ca-28`
 * → ca, igual que el rewrite del middleware) o el path ya redirigido.
 *
 * El estado arranca null para que el HTML del server y la hidratación
 * coincidan. useLayoutEffect lo llena antes del paint.
 */
export type BrowserRoute = {
  countryCode: string;
  priceParam?: string;
  asPath: string;
};

const useClientLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function countryCodeFromPublicPath(pathname: string): string {
  if (hasLocalePrefix(pathname)) {
    return firstPathSegment(pathname) ?? "";
  }
  return campaignLocaleFromPathname(pathname) ?? firstPathSegment(pathname) ?? "";
}

export function readBrowserRoute(): BrowserRoute {
  const { pathname, search } = window.location;
  const priceParam = new URLSearchParams(search).get("pr") || undefined;
  return {
    countryCode: countryCodeFromPublicPath(pathname),
    priceParam,
    asPath: `${pathname}${search}`,
  };
}

let snapshot: BrowserRoute | null = null;

function useBrowserRoute(): BrowserRoute | null {
  // Si un padre ya leyó la URL en este commit, el hijo arranca con el país
  // correcto y no pinta el default.
  const [route, setRoute] = useState<BrowserRoute | null>(() => snapshot);
  useClientLayoutEffect(() => {
    if (!snapshot) snapshot = readBrowserRoute();
    setRoute(snapshot);
  }, []);
  return route;
}

/**
 * País / ?pr= / asPath con la misma forma que el router, pero listos antes
 * del paint. Hasta entonces `ready` es false (el shell estático no trae país).
 * Cuando el router hidrata, pasa a ser la fuente: en la primera carga los
 * valores coinciden, así <Elements> no se remonta.
 */
export function useRouteSignals() {
  const router = useRouter();
  const browser = useBrowserRoute();

  if (router.isReady) {
    const pr = router.query.pr;
    const priceParam = Array.isArray(pr) ? pr[0] : pr || undefined;
    return {
      countryCode:
        typeof router.query.countryCode === "string"
          ? router.query.countryCode
          : "",
      priceParam: priceParam || undefined,
      asPath: router.asPath,
      ready: true,
    };
  }

  if (browser) {
    return { ...browser, ready: true };
  }

  return {
    countryCode: "",
    priceParam: undefined as string | undefined,
    asPath: router.asPath,
    ready: false,
  };
}
