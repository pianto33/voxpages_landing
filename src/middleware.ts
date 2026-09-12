import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/locales/config";
import {
  campaignLocaleFromPathname,
  hasLocalePrefix,
  localeFromPathSegment,
} from "@/utils/locale";

const LOCALE_SET = new Set<string>(locales);

function withPrivateCache(res: NextResponse) {
  // Evita que Vercel Edge cachee el path original del rewrite
  // (si no, countryCode queda en el slug de campaña en vez del locale).
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Apple Pay / Stripe pegan acá sin locale. No redirigir a /es/...
  if (pathname.startsWith("/.well-known")) {
    return NextResponse.next();
  }

  if (hasLocalePrefix(pathname)) {
    return NextResponse.next();
  }

  const newUrl = request.nextUrl.clone();

  // `/ca-28`, `/str-ca28`, `/str-lv12`, `/tlf` → rewrite a /{locale}{pathname}
  // (la URL pública no cambia: Lambda/ads siguen viendo el slug).
  const campaignLocale = campaignLocaleFromPathname(pathname);
  if (campaignLocale) {
    newUrl.pathname = `/${campaignLocale}${pathname}`;
    return withPrivateCache(NextResponse.rewrite(newUrl));
  }

  // `/?pr=us` (y el resto de ISO) no debe caer al default ES.
  const prLocale = localeFromPathSegment(
    request.nextUrl.searchParams.get("pr")
  );
  if (prLocale && LOCALE_SET.has(prLocale)) {
    newUrl.pathname = pathname === "/" ? `/${prLocale}` : `/${prLocale}${pathname}`;
    return NextResponse.redirect(newUrl);
  }

  newUrl.pathname =
    pathname === "/" ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(newUrl);
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.png|\\.well-known).*)",
};
