import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { logger } from "@/utils/logger";
import { clientLogger } from "@/utils/clientLogger";
import { startFunnel, setEmail as setIdentityEmail } from "@/utils/userIdentity";
import { apiFetch } from "@/utils/apiFetch";
import { fetchIPData } from "@/services/trackingService";
import { extractTrackingParams, saveTrackingParams, addTrackingParams, getTrackingParams } from "@/utils/trackingParams";
import Button from "@/components/Button";
import styles from "@/styles/CardPaymentForm.module.css";

interface Props {
  label: string;
  priceId: string;
  animateButton?: boolean;
  amount: number;
  currency: string;
}

const ArrowSvg = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="42"
    height="21"
    fill="none"
    viewBox="0 0 32 21"
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

function CardPaymentForm({ label, priceId, animateButton, amount, currency }: Props) {
  const { t } = useAppTranslation();
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const [errorMessage, setErrorMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<{
    country: string | null;
    state: string | null;
    city: string | null;
    postal: string | null;
  } | null>(null);
  const [email, setEmail] = useState("");
  // Billing address capturado desde el PaymentElement (necesario para sales tax USA)
  const [billingAddress, setBillingAddress] = useState<{
    country: string | null;
    state: string | null;
    city: string | null;
    postal_code: string | null;
    line1: string | null;
    line2: string | null;
  } | null>(null);

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
        logger.warn("Error obteniendo IP en cliente", {
          context: "CardPaymentForm - IP Fetch",
          error,
        });
      }
    };

    // Guardar parámetros de tracking (fbclid, utm_*, etc.)
    const trackingParams = extractTrackingParams(router.query);
    if (Object.keys(trackingParams).length > 0) {
      saveTrackingParams(trackingParams);
      logger.info("Parámetros de tracking capturados", trackingParams);
    }

    // Iniciar funnel: este intento de compra queda identificado
    startFunnel();
    clientLogger.funnel('checkout_mounted', {
      priceId,
      amount,
      currency,
      countryCode: router.query.countryCode,
      path: router.asPath,
      surface: 'card_form',
    });

    getIPAddress();
  }, [router.query, priceId, amount, currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    clientLogger.funnel('checkout_clicked', {
      priceId,
      amount,
      currency,
      surface: 'card_form',
      countryCode: router.query.countryCode,
    });

    if (!stripe || !elements) {
      clientLogger.paymentFailed('stripe_or_elements_missing', { priceId, surface: 'card_form' });
      setErrorMessage(t("error.stripe"));
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail) {
      clientLogger.paymentFailed('missing_email', { priceId, surface: 'card_form' });
      setErrorMessage(t("error.email"));
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        clientLogger.paymentFailed('elements_submit_error', {
          priceId,
          surface: 'card_form',
          error: submitError.message,
        });
        setErrorMessage(
          t("error.submit", { error: submitError.message || "Desconocido" })
        );
        setIsProcessing(false);
        return;
      }

      // Identidad: persistir email para logs subsiguientes
      setIdentityEmail(normalizedEmail);

      const name = normalizedEmail.split("@")[0];
      localStorage.setItem("userName", name);
      localStorage.setItem("userEmail", normalizedEmail);
      localStorage.setItem("paymentAmount", amount.toString());
      localStorage.setItem("paymentCurrency", currency);

      // Obtener parámetros de tracking (fbclid, utm_*, etc.)
      const trackingParams = getTrackingParams();

      // NUEVO: Solo crear SetupIntent (rápido ~200ms)
      // El webhook se encarga de crear customer y subscription
      clientLogger.funnel('setup_intent_create_request', {
        priceId,
        email: normalizedEmail,
        amount,
        currency,
        surface: 'card_form',
        countryCode: router.query.countryCode,
        billing_country: billingAddress?.country || null,
        billing_postal: billingAddress?.postal_code || null,
      });

      logger.info('Creando SetupIntent en Stripe', {
        context: 'CardPaymentForm - pre createSetupIntent',
        priceId,
        email: normalizedEmail,
      });

      const response = await apiFetch("/api/create-setup-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
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
          billing_country: billingAddress?.country || undefined,
          billing_state: billingAddress?.state || undefined,
          billing_city: billingAddress?.city || undefined,
          billing_postal: billingAddress?.postal_code || undefined,
          billing_line1: billingAddress?.line1 || undefined,
          billing_line2: billingAddress?.line2 || undefined,
        }),
      });

      const data = await response.json();

      if (data.error) {
        logger.warn("Error al crear SetupIntent", {
          error: data.error,
          email: normalizedEmail,
          priceId,
        });
        clientLogger.paymentFailed('setup_intent_create_error', {
          priceId,
          email: normalizedEmail,
          surface: 'card_form',
          error: data.error,
        });
        setErrorMessage(t("error.general", { error: data.error }));
        setIsProcessing(false);
        return;
      }

      // Construir return_url con parámetros de tracking preservados
      const baseReturnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${router.query.countryCode}/thanks`;
      const returnUrl = addTrackingParams(baseReturnUrl, trackingParams);

      clientLogger.funnel('payment_confirm_request', {
        priceId,
        email: normalizedEmail,
        amount,
        currency,
        surface: 'card_form',
        countryCode: router.query.countryCode,
      });

      const { error } = await stripe.confirmSetup({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: returnUrl,
        },
      });

      if (error) {
        clientLogger.paymentFailed(
          error.type === 'card_error' ? 'card_declined' : 'confirm_setup_error',
          {
            priceId,
            email: normalizedEmail,
            surface: 'card_form',
            stripe_error_code: error.code,
            stripe_error_type: error.type,
            stripe_decline_code: (error as any).decline_code,
            stripe_error_message: error.message,
          }
        );
        setErrorMessage(
          t("error.confirm_setup", { error: error.message || "Desconocido" })
        );
        setIsProcessing(false);
      }
    } catch (error: any) {
      // card_error = problema del usuario (tarjeta rechazada, robada, etc.) -> warn
      // otros tipos = error del sistema -> error
      const logData = {
        context: "CardPaymentForm",
        email: normalizedEmail,
        priceId,
        errorMessage: error.message,
        stripeErrorType: error.type,
        stripeErrorCode: error.code,
        stripeDeclineCode: error.decline_code,
      };
      
      if (error.type === 'card_error') {
        logger.warn("Tarjeta rechazada en CardPaymentForm", error, logData);
      } else {
        logger.error("ERROR Card Form Submit", error, logData);
      }

      clientLogger.paymentFailed(
        error.type === 'card_error' ? 'card_declined' : 'unhandled_exception',
        {
          ...logData,
          surface: 'card_form',
        }
      );
      
      setErrorMessage(
        t("error.general", { error: error.message || "Error desconocido" })
      );
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.emailField}>
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("email_placeholder") || "tu@email.com"}
            required
            className={styles.input}
          />
        </div>
        
        <div className={styles.paymentElement}>
          {/* 
            Solo tarjeta de crédito/débito (sin wallets ni otros métodos)
            Para restringir a SOLO Visa/Mastercard, configurar en Stripe Dashboard:
            Settings → Payment methods → Card brands
          */}
          <PaymentElement
            options={{
              layout: "tabs",
              fields: {
                billingDetails: {
                  address: "auto",
                },
              },
            }}
            onChange={(event) => {
              // Capturamos la billing address mientras el usuario completa el form,
              // para enviarla como metadata del SetupIntent (sales tax USA).
              const addr = (event as any)?.value?.billingDetails?.address;
              if (addr) {
                setBillingAddress({
                  country: addr.country || null,
                  state: addr.state || null,
                  city: addr.city || null,
                  postal_code: addr.postal_code || null,
                  line1: addr.line1 || null,
                  line2: addr.line2 || null,
                });
              }
            }}
          />
        </div>

        <Button
          type="submit"
          disabled={isProcessing || !stripe}
          animate={animateButton}
          endIcon={!isProcessing ? <ArrowSvg /> : null}
        >
          {isProcessing ? t("processing") || "Procesando..." : label}
        </Button>

        {errorMessage && <div className={styles.error}>{errorMessage}</div>}
      </form>
    </div>
  );
}

export default CardPaymentForm;
