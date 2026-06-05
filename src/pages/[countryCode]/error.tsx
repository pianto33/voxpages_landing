import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { GTM_EVENTS, LEGAL } from "@/constants";
import { generateAutoLoginToken, buildLoginUrl } from "@/api/voxpages";
import { sendEvent } from "@/utils/gtm";
import { useStripeData } from "@/hooks/useStripeData";
import { logger } from "@/utils/logger";
import Button from "@/components/Button";
import Header from "@/components/Header";
import StripeExpressCheckout from "@/components/StripeExpressCheckout";
import errorIcon from "../../../public/images/error-icon.jpeg";
import styles from "@/styles/Error.module.css";

function ErrorPage() {
  const { t, lng } = useAppTranslation();
  const router = useRouter();
  const { error } = router.query;
  const stripeData = useStripeData();
  const [magicLink, setMagicLink] = useState("https://voxpages.com");
  const isCreateUserError = error === "create_user";
  const isExistingSubscriptionError = error === "existing_subscription";
  
  // Obtener amount y currency de localStorage (guardados durante el pago) o usar fallback
  const amount = typeof window !== 'undefined'
    ? (parseInt(localStorage.getItem("paymentAmount") || "") || stripeData.amount)
    : stripeData.amount;
  const currency = typeof window !== 'undefined'
    ? (localStorage.getItem("paymentCurrency") || stripeData.currency)
    : stripeData.currency;

  // Log cuando usuarios llegan a la página de error
  useEffect(() => {
    if (error) {
      const email = localStorage.getItem("userEmail") || "N/A";
      const errorMessages: Record<string, string> = {
        existing_subscription: "Usuario con suscripción activa intentó suscribirse nuevamente",
        create_user: "Error al crear usuario en la plataforma",
      };
      
      const message = errorMessages[error as string] || `Usuario llegó a página de error: ${error}`;
      
      logger.info(message, {
        'Tipo de Error': error as string,
        Email: email,
      });
    }
  }, [error]);

  useEffect(() => {
    if (isExistingSubscriptionError || isCreateUserError) {
      const email = localStorage.getItem("userEmail") || "";
      const customerId = localStorage.getItem("customerId") || "";
      if (!email) return;

      (async () => {
        try {
          const token = await generateAutoLoginToken(email);
          setMagicLink(buildLoginUrl(token, lng));
        } catch (error) {
          logger.error("Error getting magic link", error, {
            email,
            customerId,
            page: 'error',
          });
          return;
        }
      })();
    }
  }, [isExistingSubscriptionError, isCreateUserError, lng, amount, currency]);

  return (
    <>
      <div className={styles.container}>
        <Header />
        <div className={styles.contentWrapper}>
          <h1 className={styles.title}>
            {isCreateUserError
              ? t("error.create_user")
              : isExistingSubscriptionError
              ? t("error.existing_subscription")
              : t("error.default")}
          </h1>
          <Image
            src={errorIcon}
            alt="Error"
            className={styles.errorIcon}
            width={150}
            height={150}
            priority
          />
          
          <div className={styles.buttonWrapper}>
            {!isCreateUserError && !isExistingSubscriptionError && (
              <StripeExpressCheckout label={t("retry")} animateButton amount={amount} currency={currency} />
            )}
            {(isExistingSubscriptionError || isCreateUserError) && (
              <Button
                href={magicLink}
                onClick={() => sendEvent(GTM_EVENTS.GO_TO_PLATFORM)}
                variant="primary"
              >
                {t("go_to_platform")}
              </Button>
            )}
          </div>

          <div className={styles.helpSection}>
            <h2 className={styles.subtitle}>
              {!isCreateUserError && !isExistingSubscriptionError && t("need_help_subscription")}
              {(isCreateUserError || isExistingSubscriptionError) && t("need_help_client")}
            </h2>

            <Button
              href={`mailto:${LEGAL.SUPPORT_EMAIL}`}
              variant="primary"
            >
              {t("contact")}
            </Button>
          </div>
        </div>
        <div></div>
      </div>
    </>
  );
}

export default ErrorPage;
