/**
 * Fuerza un recomposite del contenedor del iframe Stripe para que Safari/Chrome
 * mobile recalculen el hit-test tras pasar de oculto a interactivo.
 */
export function forceIframeRecomposite(
  container: HTMLElement | null
): (() => void) | undefined {
  if (!container) return;

  void container.offsetHeight;
  void container.getBoundingClientRect();
  container.style.transform = "translateZ(0)";
  container.style.opacity = "0.999";

  let raf2 = 0;
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      container.style.transform = "";
      container.style.opacity = "";
    });
  });

  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
  };
}
