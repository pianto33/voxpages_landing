import { useEffect } from "react";
import { useRouter } from "next/router";
import { extractTrackingParams, buildTrackingQueryString } from "@/utils/trackingParams";
import { localeFromPathSegment } from "@/utils/locale";
import Loader from "@/components/Loader";
import Header from "@/components/Header";
import styles from "@/styles/Pending.module.css";

/**
 * Página de pending - Ahora simplemente redirige a thanks
 * Se mantiene como fallback para usuarios que puedan estar en el flujo viejo
 */
function PendingPage() {
  const router = useRouter();
  const { countryCode } = router.query;

  useEffect(() => {
    if (router.isReady && countryCode) {
      // Preservar parámetros de tracking si los hay
      const trackingParams = extractTrackingParams(router.query);
      const trackingQueryString = buildTrackingQueryString(trackingParams);
      
      // Redirigir a thanks
      const locale =
        localeFromPathSegment(countryCode?.toString()) || countryCode;
      router.replace(`/${locale}/thanks${trackingQueryString}`);
    }
  }, [router.isReady, countryCode, router]);

  // Mostrar loader mientras redirige
  return (
    <>
      <div className={styles.container}>
        <Header />
        <div className={styles.contentWrapper}>
          <div className={styles.loaderWrapper}>
            <Loader size={150} color="gold" />
          </div>
        </div>
        <div></div>
      </div>
    </>
  );
}

export default PendingPage;
