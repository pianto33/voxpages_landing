import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/locales/config";

// Paths de campañas que llegan SIN locale prefix y deben mapearse a 'us'.
// Estos paths los enruta el Lambda@Edge desde mid.theauravibe.com cuando
// el visitante es de USA (por ejemplo: '/str-lv12*'). Otros orígenes
// (todosgamers para ES/CZ/PL/HU) ya envían el locale en la URL, así que
// caen en la rama "ya tiene locale" y no pasan por este matcher.
const US_PATH_PREFIXES = ["/str-lv12"];

function isUsCampaignPath(pathname: string): boolean {
  return US_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

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
  if (isUsCampaignPath(pathname)) {
    newUrl.pathname = `/us${pathname}`;
    return NextResponse.rewrite(newUrl);
  }

  // Resto: redirect 307 al locale por default (comportamiento histórico).
  newUrl.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(newUrl);
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.png).*)",
};
