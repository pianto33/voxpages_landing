import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import {
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementConfirmEvent,
} from "@stripe/stripe-js";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { usePriceId } from "@/hooks/useStripeData";
import { sendEvent } from "@/utils/gtm";
import { GTM_EVENTS } from "@/constants";
import { fetchIPData } from "@/services/trackingService";
import { logger } from "@/utils/logger";
import { clientLogger } from "@/utils/clientLogger";
import { startFunnel, setEmail as setIdentityEmail } from "@/utils/userIdentity";
import { apiFetch } from "@/utils/apiFetch";
import { extractTrackingParams, saveTrackingParams, getTrackingParams, addTrackingParams } from "@/utils/trackingParams";
import Button from "@/components/Button";
import CardPaymentForm from "@/components/CardPaymentForm";
import styles from "@/styles/StripeExpressCheckout.module.css";

interface Props {
  label: string;
  animateButton?: boolean;
  amount: number;
  currency: string;
}

const ArrowSvg = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className={styles.arrow}
    xmlns="http://www.w3.org/2000/svg"
    width="42"
    height="21"
    fill="none"
    viewBox="0 0 22 21"
    {...props}
  >
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="3"
      d="M2 2l7.53 7.413a1.491 1.491 0 010 2.174L2 19"
    ></path>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="3"
      d="M13 2l6.588 7.413c.55.593.55 1.581 0 2.174L13 19"
    ></path>
  </svg>
);

// Helper para detectar bots (Vercel, Lighthouse, crawlers, etc.)
const isBot = () => {
  if (typeof navigator === 'undefined') return true;
  const userAgent = navigator.userAgent;
  return /bot|crawler|spider|lighthouse|vercel|prerender|headless/i.test(userAgent);
};

/** Consola: solo si NEXT_PUBLIC_CHECKOUT_DEBUG=true (evita ruido en prod). */
const checkoutDebug =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_CHECKOUT_DEBUG === "true";

function checkoutConsole(label: string, payload: Record<string, unknown>) {
  if (!checkoutDebug || isBot()) return;
  console.info(`[VoxPages][Checkout] ${label}`, payload);
}

function StripeExpressCheckout({ label, animateButton, amount, currency }: Props) {
  const { t } = useAppTranslation();
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState("");
  const [isStripeReady, setisStripeReady] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{
    country: string | null;
    state: string | null;
    city: string | null;
    postal: string | null;
  } | null>(null);
  const [loadingState, setLoadingState] = useState<{
    ready: boolean;
    error: string | null;
    availableMethods: any;
    readyTime: number | null;
    renderTime: number;
  }>({
    ready: false,
    error: null,
    availableMethods: null,
    readyTime: null,
    renderTime: Date.now(),
  });
  // priceId resuelto con la misma lógica de cookie/?pr/countryCode que usa el
  // resto de la landing — antes había una función local que ignoraba la cookie
  // y eso causaba mismatches (UI mostraba US $39.99 pero el SetupIntent iba al
  // priceId DEFAULT de USD 19.99).
  const priceId = usePriceId();

  // Para medir tiempo entre "wallet abierto" y "wallet cancelado/confirmado".
  // Útil para distinguir cancels rápidos (UX rota) de cancels después de
  // ver el sheet de pago (rechazo consciente).
  const walletOpenedAtRef = useRef<number | null>(null);

  // Guardamos qué wallet específico (apple_pay / google_pay / link / ...) abrió
  // el usuario al clickear. Stripe sólo nos lo dice en el onClick; lo persistimos
  // acá para poder loguearlo también en onCancel/onConfirm y diagnosticar abandonos.
  const walletTypeRef = useRef<string | null>(null);

  // Igual que sr_landing-voxpages
  const isProduction =
    process.env.NODE_ENV === "production" &&
    !process.env.NEXT_PUBLIC_BASE_URL?.includes("localhost") &&
    !process.env.NEXT_PUBLIC_BASE_URL?.includes("qa") &&
    !process.env.NEXT_PUBLIC_BASE_URL?.includes("staging");

  const isQA =
    process.env.NEXT_PUBLIC_BASE_URL?.includes("qa") ||
    process.env.NEXT_PUBLIC_BASE_URL?.includes("staging") ||
    process.env.NEXT_PUBLIC_BASE_URL?.includes("localhost");
  // Obtener la IP y datos de geolocalización
  useEffect(() => {
    const getIPAddress = async () => {
      try {
        const ipData = await fetchIPData();
        if (ipData.ip) {
          setIpAddress(ipData.ip);
          // Guardar datos de geolocalización para enviar al webhook
          setGeoData({
            country: ipData.country,
            state: ipData.state,
            city: ipData.city,
            postal: ipData.postal,
          });
        }
      } catch (error) {
        if (!isBot()) {
          logger.warn("Error obteniendo IP en cliente", { error });
        }
      }
    };

    // Guardar parámetros de tracking (fbclid, utm_*, etc.)
    const trackingParams = extractTrackingParams(router.query);
    if (Object.keys(trackingParams).length > 0) {
      saveTrackingParams(trackingParams);
      if (!isBot()) {
        logger.info("Parámetros de tracking capturados", trackingParams);
      }
    }

    getIPAddress();
  }, [router.query]);

  // Timeout detector: logear si Stripe no carga en 10 segundos
  useEffect(() => {
    if (isBot() || isQA) return; // Solo en producci?n y usuarios reales
    
    const timeoutId = setTimeout(() => {
      if (!loadingState.ready && !loadingState.error) {
        clientLogger.warn('Stripe Express Checkout no carg? despu?s de 10 segundos', {
          context: 'StripeExpressCheckout - timeout detector',
          loadingState: {
            ready: loadingState.ready,
            error: loadingState.error,
            timeSinceRenderMs: Date.now() - loadingState.renderTime,
          },
          stripe: !!stripe,
          elements: !!elements,
          priceId,
          countryCode: router.query.countryCode,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          isOnline: typeof navigator !== 'undefined' ? navigator.onLine : null,
        });
      }
    }, 10000); // 10 segundos

    return () => clearTimeout(timeoutId);
  }, [loadingState.ready, loadingState.error, isQA, stripe, elements, priceId, router.query.countryCode]);

  const onConfirm = async (e: StripeExpressCheckoutElementConfirmEvent) => {
    try {
      if (!isBot()) {
        checkoutConsole("onConfirm:inicio", {
          priceId,
          path: router.asPath,
          hasBillingEmail: Boolean(e.billingDetails?.email),
          hasBillingName: Boolean(e.billingDetails?.name),
        });
        clientLogger.info("Express onConfirm iniciado", {
          context: "StripeExpressCheckout - onConfirm inicio",
          priceId,
          path: router.asPath,
          hasBillingEmail: Boolean(e.billingDetails?.email),
          hasBillingName: Boolean(e.billingDetails?.name),
        });
      }

      const email = e.billingDetails?.email?.toLowerCase().trim() || null;
      const name = e.billingDetails?.name || 
        (email ? email.split("@")[0] : null);

      // Capturar billing address (Apple Pay / Google Pay / Link). Para sales tax USA
      // alcanza con country + postal_code (Stripe mapea ZIP -> estado vía AVS).
      const billingAddress = e.billingDetails?.address;
      const billingCountry = billingAddress?.country || null;
      const billingState = billingAddress?.state || null;
      const billingPostal = billingAddress?.postal_code || null;
      const billingCity = billingAddress?.city || null;
      const billingLine1 = billingAddress?.line1 || null;
      const billingLine2 = billingAddress?.line2 || null;

      if (!email || !name) {
        if (!isBot()) {
          checkoutConsole("onConfirm:abort", { reason: "falta email o nombre" });
          clientLogger.warn("Express onConfirm abortado: email o nombre", {
            context: "StripeExpressCheckout - onConfirm validación",
            priceId,
          });
          clientLogger.paymentFailed('missing_email_or_name', {
            priceId,
            hasEmail: !!email,
            hasName: !!name,
          });
        }
        const errorMsg = t("error.email");
        setErrorMessage(errorMsg);
        e.paymentFailed({ reason: "fail" });
        return;
      }

      // Identidad: persistir email para que aparezca en logs subsiguientes
      setIdentityEmail(email);

      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("paymentAmount", amount.toString());
      localStorage.setItem("paymentCurrency", currency);

      if (!stripe || !elements) {
        if (!isBot()) {
          clientLogger.paymentFailed('stripe_or_elements_missing', { priceId });
        }
        const errorMsg = t("error.stripe");
        setErrorMessage(errorMsg);
        e.paymentFailed({ reason: "fail" });
        return;
      }

      // Submit del elemento
      const { error: submitError } = await elements.submit();
      if (submitError) {
        if (!isBot()) {
          clientLogger.paymentFailed('elements_submit_error', {
            priceId,
            error: submitError.message,
          });
        }
        const errorMsg = t("error.submit", { error: submitError.message || "Desconocido" });
        setErrorMessage(errorMsg);
        e.paymentFailed({ reason: "fail" });
        return;
      }

      // Obtener parámetros de tracking (fbclid, utm_*, etc.)
      const trackingParams = getTrackingParams();

      // NUEVO: Solo crear SetupIntent (rápido ~200ms)
      // El endpoint se encarga de buscar/crear customer y verificar suscripciones
      if (!isBot()) {
        clientLogger.funnel('setup_intent_create_request', {
          priceId,
          email,
          amount,
          currency,
          countryCode: router.query.countryCode,
          wallet: walletTypeRef.current,
          billing_country: billingCountry,
          billing_postal: billingPostal,
        });
        clientLogger.info('Creando SetupIntent en Stripe', {
          context: 'StripeExpressCheckout - pre createSetupIntent',
          priceId,
          email,
        });
      }

      const response = await apiFetch("/api/create-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          priceId,
          countryCode: router.query.countryCode,
          ip_address: ipAddress,
          fbclid: trackingParams.fbclid || undefined,
          utm_source: trackingParams.utm_source || undefined,
          utm_medium: trackingParams.utm_medium || undefined,
          utm_campaign: trackingParams.utm_campaign || undefined,
          utm_term: trackingParams.utm_term || undefined,
          utm_content: trackingParams.utm_content || undefined,
          utm_id: trackingParams.utm_id || undefined,
          geo_country: geoData?.country || undefined,
          geo_state: geoData?.state || undefined,
          geo_city: geoData?.city || undefined,
          geo_postal: geoData?.postal || undefined,
          billing_country: billingCountry || undefined,
          billing_state: billingState || undefined,
          billing_city: billingCity || undefined,
          billing_postal: billingPostal || undefined,
          billing_line1: billingLine1 || undefined,
          billing_line2: billingLine2 || undefined,
        }),
      });

      if (!isBot()) {
        checkoutConsole("create-setup-intent:http", {
          ok: response.ok,
          status: response.status,
          priceId,
        });
        clientLogger.info("create-setup-intent respuesta HTTP", {
          context: "StripeExpressCheckout - create-setup-intent",
          ok: response.ok,
          status: response.status,
          priceId,
        });
      }

      const data = await response.json();
      
      if (data.error) {
        if (!isBot()) {
          checkoutConsole("create-setup-intent:body-error", {
            error: data.error,
            priceId,
          });
          logger.warn("Error al crear SetupIntent", {
            error: data.error,
            email,
            priceId,
          });
          clientLogger.paymentFailed('setup_intent_create_error', {
            priceId,
            email,
            error: data.error,
          });
        }
        
        setErrorMessage(t("error.general", { error: data.error }));
        e.paymentFailed({ reason: "fail" });
        return;
      }

      // Construir billing_details para Stripe — incluir address para que Stripe la
      // adjunte al PaymentMethod (clave para sales tax USA y AVS).
      const billingDetails: any = {
        email,
        name,
      };

      if (billingCountry || billingPostal || billingState || billingCity || billingLine1) {
        billingDetails.address = {
          ...(billingCountry ? { country: billingCountry } : {}),
          ...(billingState ? { state: billingState } : {}),
          ...(billingCity ? { city: billingCity } : {}),
          ...(billingPostal ? { postal_code: billingPostal } : {}),
          ...(billingLine1 ? { line1: billingLine1 } : {}),
          ...(billingLine2 ? { line2: billingLine2 } : {}),
        };
      }

      // Log antes de confirmSetup
      if (!isBot()) {
        clientLogger.funnel('payment_confirm_request', {
          priceId,
          email,
          amount,
          currency,
          countryCode: router.query.countryCode,
          wallet: walletTypeRef.current,
          billing_country: billingCountry,
          billing_postal: billingPostal,
          hasClientSecret: !!data.clientSecret,
        });
        clientLogger.info('Confirmando setup de pago con Stripe', {
          context: 'StripeExpressCheckout - pre confirmSetup',
          hasClientSecret: !!data.clientSecret,
          email,
        });
      }

      // Construir return_url con parámetros de tracking preservados
      const baseReturnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${router.query.countryCode}/thanks`;
      const returnUrl = addTrackingParams(baseReturnUrl, trackingParams);

      // Confirmar y redirigir DIRECTO a thanks
      const { error } = await stripe.confirmSetup({
        elements,
        clientSecret: data.clientSecret,
        redirect: "always",
        confirmParams: {
          return_url: returnUrl,
          payment_method_data: {
            billing_details: billingDetails,
          },
        },
      });

      if (error) {
        // Log específico para errores de confirmSetup
        if (!isBot()) {
          checkoutConsole("confirmSetup:error", {
            code: error.code,
            type: error.type,
            message: error.message,
          });
          const logData = {
            context: 'StripeExpressCheckout - confirmSetup failed',
            stripeErrorCode: error.code,
            stripeErrorType: error.type,
            stripeDeclineCode: (error as any).decline_code,
            email,
            priceId,
            amount,
            currency,
          };
          
          if (error.type === 'card_error') {
            logger.warn('Tarjeta rechazada en stripe.confirmSetup', error, logData);
          } else {
            logger.error('Error en stripe.confirmSetup', error, logData);
          }
          clientLogger.paymentFailed(
            error.type === 'card_error' ? 'card_declined' : 'confirm_setup_error',
            {
              ...logData,
              stripe_error_code: error.code,
              stripe_error_type: error.type,
              stripe_decline_code: (error as any).decline_code,
              stripe_error_message: error.message,
            }
          );
        }
        setErrorMessage(
          t("error.confirm_setup", { error: error.message || "Desconocido" })
        );
        e.paymentFailed({ reason: "fail" });
      } else if (!isBot()) {
        checkoutConsole("confirmSetup:ok", {
          note: "Stripe no devolvió error; suele seguir redirección 3DS o return_url",
        });
        clientLogger.info("confirmSetup sin error de Stripe", {
          context: "StripeExpressCheckout - confirmSetup ok",
          priceId,
        });
      }
    } catch (error: any) {
      if (!isBot()) {
        logger.error("ERROR StripeExpressCheckout onConfirm", error, {
          context: 'StripeExpressCheckout - catch general onConfirm',
          errorMessage: error?.message || 'Sin mensaje',
          errorName: error?.name || 'Sin nombre',
          errorCode: error?.code || 'Sin código',
          email: e.billingDetails?.email || 'desconocido',
          priceId,
          countryCode: router.query.countryCode,
          hasStripe: !!stripe,
          hasElements: !!elements,
        });
        clientLogger.paymentFailed('unhandled_exception', {
          priceId,
          email: e.billingDetails?.email || null,
          error: error?.message || null,
          errorName: error?.name || null,
          errorCode: error?.code || null,
        });
      }
      const errorMsg = t("error.general", { error: error.message || "Error desconocido" });
      setErrorMessage(errorMsg);
      e.paymentFailed({ reason: "fail" });
    }
  };

  const onClick = (event: StripeExpressCheckoutElementClickEvent) => {
    const { resolve } = event;
    // expressPaymentType viene tipado en la Element pero acá lo extraemos via cast
    // para esquivar mismatches de versiones del SDK; el valor real es
    // 'apple_pay' | 'google_pay' | 'link' | 'amazon_pay' | 'paypal'.
    const expressPaymentType =
      ((event as unknown) as { expressPaymentType?: string }).expressPaymentType || null;
    walletTypeRef.current = expressPaymentType;

    // billingAddressRequired solo lo necesitamos para sales tax USA.
    // Para EU/UK/resto del mundo lo dejamos en false: el wallet sheet de
    // Apple/Google Pay queda como antes (menor fricción, menos abandonos).
    //
    // Importante: NO miramos el locale (router.query.countryCode). El locale
    // determina el idioma del HTML, no el país de cobro. El driver real es
    // la moneda — si vamos a cobrar en USD (?pr=us, vía useStripeData), el
    // usuario es US y necesitamos billing address para sales tax. Si cobramos
    // en EUR (ES y resto), no.
    const isUsUser = currency?.toLowerCase() === "usd";

    walletOpenedAtRef.current = Date.now();

    checkoutConsole("onClick", {
      priceId,
      path: router.asPath,
      host: typeof window !== "undefined" ? window.location.host : null,
      isUsUser,
      billingAddressRequired: isUsUser,
      wallet: expressPaymentType,
    });
    console.log("[StripeExpressCheckout] Wallet clickeado (Express Checkout)");
    sendEvent(GTM_EVENTS.STRIPE_CLICK);
    
    // Solo logear si no es un bot
    if (!isBot()) {
      clientLogger.funnel('checkout_clicked', {
        priceId,
        amount,
        currency,
        wallet: expressPaymentType,
        countryCode: router.query.countryCode,
        billing_address_required: isUsUser,
      });

      clientLogger.click('Google Pay / Apple Pay abriendo', {
        context: 'StripeExpressCheckout - onClick disparado',
        priceId,
        wallet: expressPaymentType,
        isProduction,
        isQA,
        countryCode: router.query.countryCode,
        path: router.asPath,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        billingAddressRequired: isUsUser,
      });
    }

    // Apple Pay recurringPaymentRequest:
    //  - trialBilling: ventana de trial (1 día, alineado con
    //    trial_period_days=1 que usamos al crear la subscription en
    //    /api/create-subscription). Declararlo permite que la red de tarjetas
    //    pre-autorice el método sabiendo el monto recurrente, reduciendo
    //    failures en el cobro del día siguiente.
    //  - regularBilling: cobro recurrente real, empieza al terminar el trial.
    //  - billingAgreement: texto legal mostrado en el sheet.
    //  - Apple valida ESTRICTO: trialBilling requiere amount + label +
    //    recurringPaymentIntervalUnit + recurringPaymentIntervalCount. Si
    //    falta alguno, el resolve() rompe y NINGÚN wallet abre (ni Apple ni
    //    Google). Vimos esto en producción 2026-05-21.
    const TRIAL_DAYS = 1;
    const trialStart = new Date();
    const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const amountStr = (amount / 100).toFixed(2);
    const currencyUpper = currency.toUpperCase();
    resolve({
      emailRequired: true,
      phoneNumberRequired: false,
      billingAddressRequired: isUsUser,
      applePay: {
        recurringPaymentRequest: {
          paymentDescription: "VoxPages monthly subscription",
          managementURL: "https://www.voxpages.com/cancel",
          billingAgreement: `Free 1-day trial, then ${amountStr} ${currencyUpper}/month. Cancel anytime at voxpages.com/cancel.`,
          regularBilling: {
            amount,
            label: "Monthly subscription",
            recurringPaymentIntervalUnit: "month",
            recurringPaymentIntervalCount: 1,
            recurringPaymentStartDate: trialEnd,
          },
          trialBilling: {
            amount: 0,
            label: "Free trial",
            recurringPaymentIntervalUnit: "day",
            recurringPaymentIntervalCount: TRIAL_DAYS,
            recurringPaymentStartDate: trialStart,
            recurringPaymentEndDate: trialEnd,
          },
        },
      },
    });

    checkoutConsole("onClick:resolve", {
      emailRequired: true,
      billingAddressRequired: isUsUser,
    });
  };

  const onReady = ({ availablePaymentMethods }: any) => {
    const readyTime = Date.now();
    const wallets = {
      applePay: Boolean(availablePaymentMethods?.applePay),
      googlePay: Boolean(availablePaymentMethods?.googlePay),
      link: Boolean(availablePaymentMethods?.link),
    };
    checkoutConsole("onReady", {
      applePay: wallets.applePay,
      googlePay: wallets.googlePay,
      link: wallets.link,
      loadTimeMs: readyTime - loadingState.renderTime,
      host: typeof window !== "undefined" ? window.location.host : null,
      origin: typeof window !== "undefined" ? window.location.origin : null,
    });
    setisStripeReady(true);
    setLoadingState(prev => ({
      ...prev,
      ready: true,
      availableMethods: availablePaymentMethods,
      readyTime,
    }));
    
    // Solo logear si no es un bot
    if (!isBot()) {
      const loadTimeMs = readyTime - loadingState.renderTime;

      clientLogger.funnel('checkout_ready', {
        priceId,
        countryCode: router.query.countryCode,
        currency,
        billing_address_required: currency?.toLowerCase() === "usd",
        load_time_ms: loadTimeMs,
        apple_pay_available: wallets.applePay,
        google_pay_available: wallets.googlePay,
        link_available: wallets.link,
      });

      clientLogger.info('Express Checkout cargado correctamente', {
        context: 'StripeExpressCheckout - onReady',
        availablePaymentMethods,
        wallets,
        loadTimeMs,
        host: typeof window !== "undefined" ? window.location.host : undefined,
        priceId,
        isProduction,
        isQA,
        countryCode: router.query.countryCode,
        path: router.asPath,
        stripe: !!stripe,
        elements: !!elements,
      });
    }
  };

  const onCancel = () => {
    if (isBot()) return;

    sendEvent(GTM_EVENTS.STRIPE_CANCEL);

    // Stripe no nos da motivo del cancel (UX privacy). Pero el tiempo que
    // estuvo el sheet abierto es una señal MUY útil:
    //   - < 2s: el wallet ni alcanzó a mostrarse (popup blocker, error,
    //     pasarela rota, AVS pre-check fallido en silencio).
    //   - 2-5s: el user lo vio y cerró rápido (mal precio, mala UX, etc).
    //   - > 5s: cancel "consciente" después de revisar el sheet.
    const openedAt = walletOpenedAtRef.current;
    const walletOpenMs = openedAt ? Date.now() - openedAt : null;
    walletOpenedAtRef.current = null;
    const wallet = walletTypeRef.current;
    walletTypeRef.current = null;

    const cancelKind =
      walletOpenMs == null
        ? 'unknown'
        : walletOpenMs < 2000
          ? 'fast_cancel_lt_2s'
          : walletOpenMs < 5000
            ? 'medium_cancel_2_5s'
            : 'slow_cancel_gt_5s';

    clientLogger.funnel('wallet_cancelled', {
      priceId,
      amount,
      currency,
      countryCode: router.query.countryCode,
      wallet,
      wallet_open_ms: walletOpenMs,
      cancel_kind: cancelKind,
    });

    clientLogger.paymentFailed('wallet_cancelled', {
      priceId,
      countryCode: router.query.countryCode,
      wallet,
      wallet_open_ms: walletOpenMs,
      cancel_kind: cancelKind,
    });
  };

  const onLoadError = (event: any) => {
    const errorType = event?.error?.type;
    const errorMessage = event?.error?.message || 'Unknown error';
    
    // Guardar el error en el estado
    setLoadingState(prev => ({
      ...prev,
      error: `${errorType}: ${errorMessage}`,
    }));
    
    // Si es un bot, solo logear en debug, no como error crítico
    if (isBot()) {
      console.debug('[StripeExpressCheckout] Bot detectado - ignorando error de carga Stripe', {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        errorType,
      });
      return; // No enviar a logs de producción
    }
    
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    
    // Solo logear errores de usuarios reales
    clientLogger.error('Error al cargar Express Checkout Element', {
      context: 'StripeExpressCheckout - onLoadError',
      error: errorMessage,
      errorType: errorType,
      timeSinceRenderMs: Date.now() - loadingState.renderTime,
      priceId,
      isProduction,
      isQA,
      countryCode: router.query.countryCode,
      userAgent,
    });

    checkoutConsole("onLoadError", {
      errorType,
      errorMessage,
      host: typeof window !== "undefined" ? window.location.host : null,
    });

    // Si es error de conexión API de un usuario real, investigar
    if (errorType === 'api_connection_error') {
      logger.warn('Error de conexión con Stripe API de usuario real', {
        errorMessage,
        isProduction,
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent,
      });
    }
  };

  const handleButtonClick = () => {
    // Este onClick solo se ejecuta si el ExpressCheckoutElement NO captura el evento
    // (es decir, cuando NO hay Google Pay/Apple Pay disponible)
    checkoutConsole("handleButtonClick", {
      isStripeReady,
      note: "Clic en capa del botón; el iframe de wallets no capturó el evento",
    });
    console.log(
      "[StripeExpressCheckout] Clic en botón (no capturado por wallet / sin wallet en este navegador)"
    );
    
    if (!isBot()) {
      sendEvent(GTM_EVENTS.STRIPE_CLICK_FAIL);
      
      const now = Date.now();
      clientLogger.warn('Click en botón — capa superior (diagnóstico wallet)', {
        context: 'StripeExpressCheckout - handleButtonClick',
        
        // Estado de Stripe
        isStripeReady,
        stripe: !!stripe,
        elements: !!elements,
        
        // Diagn?stico detallado del ciclo de vida
        loadingState: {
          everReady: loadingState.ready,
          hadError: !!loadingState.error,
          errorDetails: loadingState.error,
          availableMethods: loadingState.availableMethods,
          loadTimeMs: loadingState.readyTime ? (loadingState.readyTime - loadingState.renderTime) : null,
          timeSinceRenderMs: now - loadingState.renderTime,
        },
        
        // Contexto del usuario
        priceId,
        isProduction,
        isQA,
        countryCode: router.query.countryCode,
        path: router.asPath,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        
        // Info adicional ?til
        windowSize: typeof window !== 'undefined' ? {
          width: window.innerWidth,
          height: window.innerHeight,
        } : null,
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : null,
        connectionType: typeof navigator !== 'undefined' && 'connection' in navigator 
          ? (navigator as any).connection?.effectiveType 
          : null,
      });
    }
  };

  // Log solo una vez cuando el componente se monta (no en cada render)
  useEffect(() => {
    if (!isBot()) {
      // Iniciar funnel: este intento de compra queda identificado
      // hasta payment_succeeded / payment_failed.
      startFunnel();

      clientLogger.funnel('checkout_mounted', {
        priceId,
        amount,
        currency,
        countryCode: router.query.countryCode,
        path: router.asPath,
        isProduction,
        isQA,
      });

      clientLogger.info('StripeExpressCheckout renderizado', {
        context: 'StripeExpressCheckout - mount',
        isProduction,
        isQA,
        priceId,
        stripe: !!stripe,
        elements: !!elements,
        countryCode: router.query.countryCode,
        path: router.asPath,
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
        nodeEnv: process.env.NODE_ENV,
        checkoutDebugEnabled: checkoutDebug,
        paymentMethodsConfig: {
          applePay: isProduction ? "auto" : "never",
          googlePay: isProduction ? "always" : "never",
          link: isProduction ? "never" : "auto",
        },
      });
      checkoutConsole("mount", {
        priceId,
        path: router.asPath,
        host: typeof window !== "undefined" ? window.location.host : null,
        checkoutDebugEnabled: checkoutDebug,
      });
    }
  }, []); // Solo una vez al montar

  // En QA/staging/localhost, mostrar el formulario de tarjeta de cr?dito
  if (isQA) {
    if (!isBot()) {
      clientLogger.info('Mostrando CardPaymentForm en ambiente QA', {
        context: 'StripeExpressCheckout - QA mode',
        priceId,
        countryCode: router.query.countryCode,
      });
    }
    
    return (
      <CardPaymentForm
        label={label}
        priceId={priceId}
        animateButton={animateButton}
        amount={amount}
        currency={currency}
      />
    );
  }

  return (
    <>
      <Button
        animate={animateButton}
        endIcon={<ArrowSvg />}
        onClick={handleButtonClick}
      >
        {label}
        <div
          className={`${styles.checkoutContainer} ${
            isStripeReady ? styles.loaded : ""
          }`}
        >
          <div id="checkout-page" className={styles.checkoutPage}>
            <ExpressCheckoutElement
              onClick={onClick}
              onConfirm={onConfirm}
              onReady={onReady}
              onCancel={onCancel}
              onLoadError={onLoadError}
              options={{
                paymentMethods: {
                  // Apple Pay "auto": Stripe sólo muestra el botón si verificó
                  // que va a poder completar el pago. Con "always" mostrábamos
                  // el botón aunque después fallara silenciosamente (el user
                  // veía sheet vacío y cancelaba — 100% cancel rate en 12h).
                  //
                  // Google Pay "always": tiene mucho mejor coverage en todos
                  // los browsers (Chrome/Firefox/Brave) y rara vez falla al
                  // abrir. Lo mantenemos forzado para que el botón siempre
                  // exista y el user pueda pagar incluso si Apple Pay queda
                  // oculto. (Próximo paso: fallback a CardPaymentForm cuando
                  // ambos vengan false.)
                  applePay: isProduction ? "auto" : "never",
                  googlePay: isProduction ? "always" : "never",
                  link: isProduction ? "never" : "auto",
                  amazonPay: "never",
                  paypal: "never",
                },
                buttonType: {
                  applePay: "subscribe",
                  googlePay: "subscribe",
                },
                buttonTheme: {
                  applePay: "black",
                  googlePay: "black",
                },
                layout: {
                  maxColumns: 1,
                  overflow: "never",
                },
                buttonHeight: 55,
              }}
            />
          </div>
        </div>
      </Button>
      {errorMessage && <div className={styles.error}>{errorMessage}</div>}
    </>
  );
}

export default StripeExpressCheckout;
