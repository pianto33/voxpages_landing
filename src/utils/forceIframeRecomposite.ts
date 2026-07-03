/**
 * Fuerza un recomposite del contenedor del iframe Stripe para que Safari/Chrome
 * mobile recalculen el hit-test tras pasar de oculto a interactivo.
 *
 * En Android también hace un micro-scroll (1px) porque el hit-test del iframe
 * cross-origin a veces no se actualiza solo con transform/opacity.
 */
export function forceIframeRecomposite(
  container: HTMLElement | null
): (() => void) | undefined {
  if (!container || typeof window === "undefined") return;

  void container.offsetHeight;
  void container.getBoundingClientRect();
  container.style.transform = "translateZ(0)";
  container.style.opacity = "0.999";

  const iframe = container.querySelector("iframe");
  if (iframe instanceof HTMLElement) {
    void iframe.offsetHeight;
    void iframe.getBoundingClientRect();
    iframe.style.transform = "translateZ(0)";
  }

  const isAndroid = /Android/i.test(navigator.userAgent);
  const scrollY = isAndroid ? window.scrollY : null;
  if (isAndroid && scrollY != null) {
    window.scrollTo(window.scrollX, scrollY + 1);
  }

  let raf2 = 0;
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      container.style.transform = "";
      container.style.opacity = "";
      if (iframe instanceof HTMLElement) {
        iframe.style.transform = "";
      }
      if (isAndroid && scrollY != null) {
        window.scrollTo(window.scrollX, scrollY);
      }
    });
  });

  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
  };
}
