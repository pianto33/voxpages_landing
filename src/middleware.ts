import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/locales/config";
import { isUsCampaignPath } from "@/utils/locale";

// Paths de campañas US que llegan SIN locale prefix (mid.theauravibe.com).
// Se reescriben a /us/... para que path y locale coincidan con USD.
// Otros orígenes (todosgamers ES/CZ/PL/HU) ya traen /es/, /cz/, etc.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Si la ruta ya incluye un código de país, no hacemos nada
  if (locales.some((code) => pathname.startsWith(`/${code}`))) {
    return NextResponse.next();
  }

  const newUrl = request.nextUrl.clone();

  // Tráfico USA del Lambda@Edge (mid.theauravibe.com → cross.summaryvox.com).
  // El Lambda hace origin override: el URL del browser sigue siendo
  // mid.theauravibe.com/str-lv12. Si respondiéramos con un 307 a /us/str-lv12,
  // el browser saldría del path /str-lv12* y la Lambda dejaría de rutearlo
  // a este origin. Por eso usamos REWRITE (sirve /us/... sin cambiar la URL
  // pública), no redirect.
  //
  // Cache-Control: private, no-store evita que la Vercel Edge cachee la
  // respuesta del path original (/str-lv12). Sin esto, la primera request
  // queda fija en la edge y todas las siguientes saltean el middleware,
  // dejando router.query.countryCode = "str-lv12" en lugar de "us" (que
  // hace que el cliente caiga al PRICE_ID.DEFAULT en EUR en vez del US).
  if (isUsCampaignPath(pathname)) {
    newUrl.pathname = `/us${pathname}`;
    const res = NextResponse.rewrite(newUrl);
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  // Resto: redirect 307 al locale por default (comportamiento histórico).
  newUrl.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(newUrl);
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.png).*)",
};
