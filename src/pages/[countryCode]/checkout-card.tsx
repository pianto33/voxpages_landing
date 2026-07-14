import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Header from "@/components/Header";
import CardPaymentForm from "@/components/CardPaymentForm";
import Footer from "@/components/Footer";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { useStripeData, usePriceId } from "@/hooks/useStripeData";
import { clientLogger } from "@/utils/clientLogger";
import styles from "@/styles/CheckoutCard.module.css";

/**
 * Fallback cuando Express Checkout no tiene wallets (GPay/Apple Pay).
 * Entrada típica: redirect desde StripeExpressCheckout onReady no_wallet.
 */
export default function CheckoutCardPage() {
  const router = useRouter();
  const { t } = useAppTranslation();
  const { amount, currency } = useStripeData();
  const priceId = usePriceId();
  const formattedAmount = (amount / 100).toFixed(2);
  const didVisitRef = useRef(false);

  useEffect(() => {
    if (!router.isReady || didVisitRef.current) return;
    didVisitRef.current = true;
    const countryCode = router.query.countryCode?.toString() || "unknown";
    clientLogger.visit("Card Checkout Page", {
      countryCode,
      path: router.asPath,
      locale: router.locale,
      surface: "card_form",
      fallback_from: "express_checkout",
    });
  }, [router.isReady, router.query.countryCode, router.asPath, router.locale]);

  return (
    <div className={styles.page}>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>{t("checkout.card_page_title")}</h1>
        <p className={styles.subtitle}>{t("checkout.card_page_subtitle")}</p>
        <p
          className={styles.trialInfo}
          dangerouslySetInnerHTML={{
            __html: t("enjoy_free_trial", {
              amount: formattedAmount,
              currency: currency.toUpperCase(),
            }),
          }}
        />
        <div className={styles.formWrap}>
          <CardPaymentForm
            label={t("subscribe")}
            priceId={priceId}
            amount={amount}
            currency={currency}
            animateButton
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
