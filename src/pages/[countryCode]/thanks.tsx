import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
import { IoCheckmarkCircleOutline } from "react-icons/io5";
import { useStripeData } from "@/hooks/useStripeData";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { generateAutoLoginToken, buildLoginUrl } from "@/api/voxpages";
import { sendEvent } from "@/utils/gtm";
import { GTM_EVENTS } from "@/constants";
import { extractTrackingParams, saveTrackingParams } from "@/utils/trackingParams";
import Button from "@/components/Button";
import Header from "@/components/Header";
import { logger } from "@/utils/logger";
import { clientLogger } from "@/utils/clientLogger";
import { setEmail as setIdentityEmail, setCustomerId, endFunnel } from "@/utils/userIdentity";
import { resolveThanksCheckoutIdentity } from "@/utils/resolveThanksIdentity";
import styles from "@/styles/Thanks.module.css";

function ThanksPage() {
    const router = useRouter();
    const { t, lng } = useAppTranslation();
    const stripeData = useStripeData();
    const [magicLink, setMagicLink] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [useFallback, setUseFallback] = useState(false);
    
    // Ref para prevenir múltiples ejecuciones del procesamiento de pago
    const paymentProcessedRef = useRef(false);
    // Flag persistente en sessionStorage para prevenir duplicados incluso si el componente se desmonta
    const [processingComplete, setProcessingComplete] = useState(false);
    
    // Obtener amount y currency de localStorage (guardados durante el pago) o usar fallback
    const amount = typeof window !== 'undefined' 
        ? (parseInt(localStorage.getItem("paymentAmount") || "") || stripeData.amount)
        : stripeData.amount;
    const currency = typeof window !== 'undefined'
        ? (localStorage.getItem("paymentCurrency") || stripeData.currency)
        : stripeData.currency;

    // Log inicial para debugging
    useEffect(() => {
        const email = localStorage.getItem("userEmail") || "";
        const name = localStorage.getItem("userName") || "";
        const customerId = localStorage.getItem("customerId") || "";
        
        logger.info("Thanks page: carga inicial", {
            hasEmail: !!email,
            hasName: !!name,
            hasCustomerId: !!customerId,
            lng,
            amount,
            currency,
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Solo una vez al montar
    
    // Meta Pixel Purchase conversion (se ejecuta cuando tenemos amount/currency)
    useEffect(() => {
        if (!amount || !currency) return;

        let cancelled = false;
        let retryCount = 0;
        const maxRetries = 50;
        const value = amount / 100;
        const cur = currency.toUpperCase();

        const sendMetaConversion = () => {
            if (cancelled) return;
            if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
                (window as any).fbq('track', 'Purchase', { value, currency: cur });
                logger.info("Meta Pixel Purchase conversion sent", {
                    value: value.toFixed(2),
                    currency: cur,
                });
            } else {
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(sendMetaConversion, 100);
                } else {
                    logger.warn("Meta Pixel (fbq) not available after retries");
                }
            }
        };

        sendMetaConversion();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount, currency]);

    // Capturar y guardar parámetros de tracking (fbclid, utm_*, etc.)
    useEffect(() => {
        if (router.isReady) {
            const trackingParams = extractTrackingParams(router.query);
            if (Object.keys(trackingParams).length > 0) {
                saveTrackingParams(trackingParams);
            }
        }
    }, [router.isReady, router.query]);

    // Timeout de 6 segundos para ofrecer link sin token
    useEffect(() => {
        const timeout = setTimeout(() => {
            if (!magicLink && isLoading) {
                const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || "https://voxpages.com";
                setMagicLink(`${platformUrl}/${lng}`);
                setIsLoading(false);
                setUseFallback(true);
                logger.warn("Magic link generation timeout, using fallback link", {
                    page: 'thanks',
                    timeout: 6000
                });
            }
        }, 6000);

        return () => clearTimeout(timeout);
    }, [magicLink, isLoading, lng]);

    useEffect(() => {
        if (!router.isReady || !lng) {
            if (!lng) {
                logger.info("Thanks page: esperando idioma");
            }
            return;
        }

        const setupIntentId =
            typeof router.query.setup_intent === "string"
                ? router.query.setup_intent
                : undefined;
        const redirectStatus =
            typeof router.query.redirect_status === "string"
                ? router.query.redirect_status
                : undefined;

        if (redirectStatus && redirectStatus !== "succeeded") {
            logger.info("Thanks page: redirect de Stripe sin éxito", {
                redirectStatus,
                setupIntentId,
            });
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const identity = await resolveThanksCheckoutIdentity({
                    setupIntentId,
                    redirectStatus,
                    fallbackAmount: stripeData.amount,
                    fallbackCurrency: stripeData.currency,
                });

                if (cancelled) return;

                if (!identity?.email) {
                    logger.info("Thanks page: esperando identidad del checkout", {
                        hasSetupIntent: !!setupIntentId,
                        redirectStatus: redirectStatus || null,
                    });
                    return;
                }

                const { email, customerId } = identity;
                const resolvedAmount = identity.amount ?? amount;
                const resolvedCurrency = identity.currency ?? currency;

                const sessionKey = `payment_processed_${customerId || email}`;
                const alreadyProcessed = sessionStorage.getItem(sessionKey);

                if (alreadyProcessed || paymentProcessedRef.current || processingComplete) {
                    logger.info("Thanks page: pago ya procesado, evitando duplicados", {
                        email,
                        sessionKey,
                        alreadyProcessed: !!alreadyProcessed,
                        refCurrent: paymentProcessedRef.current,
                        stateComplete: processingComplete,
                    });
                    return;
                }

                logger.info("Thanks page: iniciando procesamiento de pago exitoso", {
                    email,
                    customerId,
                    lng,
                    identitySource: identity.source,
                    setupIntentId: setupIntentId || null,
                });

                paymentProcessedRef.current = true;
                setIsLoading(true);

                setIdentityEmail(email);
                if (customerId) setCustomerId(customerId);

                clientLogger.funnel("magic_link_requested", {
                    email,
                    customerId,
                    lng,
                    identitySource: identity.source,
                });

                const token = await generateAutoLoginToken(email);
                const link = buildLoginUrl(token, lng);
                setMagicLink(link);
                setIsLoading(false);

                clientLogger.funnel("magic_link_received", {
                    email,
                    customerId,
                    lng,
                    identitySource: identity.source,
                });

                logger.info("Thanks page: magic link generado exitosamente", {
                    email,
                });

                if (resolvedAmount && resolvedCurrency) {
                    logger.paymentSuccess(
                        email,
                        resolvedAmount,
                        resolvedCurrency,
                        customerId,
                        {
                            lng,
                            identitySource: identity.source,
                            setupIntentId: setupIntentId || null,
                        }
                    );
                } else {
                    logger.warn("Thanks page: payment_succeeded omitido por falta de amount/currency", {
                        email,
                        resolvedAmount,
                        resolvedCurrency,
                        identitySource: identity.source,
                    });
                }

                endFunnel();

                sessionStorage.setItem(sessionKey, "true");
                setProcessingComplete(true);
            } catch (error) {
                if (cancelled) return;

                logger.error("Error en procesamiento de thanks page", error, {
                    setupIntentId: setupIntentId || null,
                    page: "thanks",
                    errorType: (error as any)?.message || "Unknown",
                });
                setIsLoading(false);
                const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || "https://voxpages.com";
                setMagicLink(`${platformUrl}/${lng}`);
                setUseFallback(true);
                paymentProcessedRef.current = false;
            }
        })();

        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        router.isReady,
        router.query.setup_intent,
        router.query.redirect_status,
        lng,
        amount,
        currency,
    ]);

    return (
        <>
            <div className={styles.container}>
                <Header />
                <div className={styles.contentWrapper}>
                    <IoCheckmarkCircleOutline className={styles.successIcon} />
                    
                    <h1 className={styles.title}>{t("thanks.title")}</h1>
                    <p className={styles.subtitle}>{t("thanks.subtitle")}</p>
                    <p className={styles.processingMessage}>{t("thanks.processing_message")}</p>

                    <div className={styles.buttonWrapper}>
                        <Button
                            onClick={() => {
                                if (magicLink) {
                                    sendEvent(GTM_EVENTS.GO_TO_PLATFORM);
                                    window.location.href = magicLink;
                                }
                            }}
                            variant="primary"
                            disabled={isLoading || !magicLink}
                        >
                            {isLoading 
                                ? t("loading") || "Cargando..." 
                                : useFallback 
                                    ? t("go_to_platform_manual") || t("go_to_platform")
                                    : t("go_to_platform")
                            }
                        </Button>
                    </div>

                    <h2 className={styles.subtitle}>{t("need_help_client")}</h2>
                </div>
                <div></div>
            </div>
        </>
    );
}

export default ThanksPage;
