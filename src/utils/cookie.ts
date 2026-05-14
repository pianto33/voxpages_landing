/**
 * Lee una cookie por nombre desde document.cookie.
 *
 * Devuelve null en SSR (donde `document` no existe) y también si la cookie no
 * está. Se usa, entre otros, para leer `_sv_c` (country code seteado por el
 * Lambda@Edge cuando el visitante fue routeado a Vercel). Esta cookie es la
 * fuente de verdad para precio/idioma porque viaja en cada request y no se
 * ve afectada por respuestas HTML cacheadas por CloudFront/Vercel.
 */
export function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(
        new RegExp("(?:^|; )" + name + "=([^;]*)")
    );
    return m ? decodeURIComponent(m[1]) : null;
}
