import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import StripeExpressCheckout from "@/components/StripeExpressCheckout";
import Button from "@/components/Button";
import styles from "@/styles/Home.module.css";
import { useStripeData } from "@/hooks/useStripeData";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import Footer from "@/components/Footer";
import { clientLogger } from "@/utils/clientLogger";
import { readCookie } from "@/utils/cookie";
import { detectLocaleMismatch } from "@/utils/locale";
import { LEGAL } from "@/constants";
import logoText from "../../../public/images/logo-text.png";

const ArrowSvg = (props: React.SVGProps<SVGSVGElement>) => (
    <svg
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
        />
        <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeMiterlimit="10"
            strokeWidth="3"
            d="M13 2l6.588 7.413c.55.593.55 1.581 0 2.174L13 19"
        />
    </svg>
);

const CheckIcon = () => (
    <svg
        className={styles.featureIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const ChevronDown = () => (
    <svg
        className={styles.scrollChevron}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const BoltIcon = () => (
    <svg
        className={styles.stepBadgeIcon}
        viewBox="0 0 24 24"
        fill="currentColor"
    >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
);

export default function Home() {
    const router = useRouter();
    const { t, lng } = useAppTranslation();
    const { amount, currency } = useStripeData();
    const benefits = t("benefits_list", { returnObjects: true }) as string[];
    const formattedAmount = (amount / 100).toFixed(2);
    const snapRef = useRef<HTMLDivElement>(null);

    // Locale resuelto (cookie `_sv_c` > path > default). LEGAL mapea us/ca → en.
    const resolvedCountry = lng;

    useEffect(() => {
        if (!router.isReady) return;

        const countryCode = router.query.countryCode?.toString() || "unknown";
        const cookieCountry = readCookie("_sv_c");

        clientLogger.visit("Landing Page", {
            countryCode,
            path: router.asPath,
            locale: lng,
            cookie_country: cookieCountry,
            amount,
            currency,
        });

        const mismatch = detectLocaleMismatch({
            cookieCountry,
            pathCountry: router.query.countryCode?.toString(),
            lng,
            currency,
        });
        if (mismatch) {
            clientLogger.warn("locale_price_mismatch", {
                context: "Landing - locale/price alignment",
                ...mismatch,
            });
        }
    }, [router.isReady, router.query.countryCode, router.asPath, lng, amount, currency]);

    const scrollToInfo = () => {
        const container = snapRef.current;
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: "smooth",
            });
        }
    };

    const scrollToHero = () => {
        const container = snapRef.current;
        if (container) {
            container.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const trialText = t("enjoy_free_trial", {
        amount: formattedAmount,
        currency: currency.toUpperCase(),
    });

    return (
        <div className={styles.snapContainer} ref={snapRef}>
            {/* ── Screen 1: Hero ── */}
            <div className={styles.screen}>
                <div className={styles.topArea}>
                    <div className={styles.logoTextOnly}>
                        <Image
                            src={logoText}
                            alt="SummaryVox"
                            fill
                            sizes="220px"
                            style={{ objectFit: "contain" }}
                            priority
                        />
                    </div>
                    <p
                        className={styles.tagline}
                        dangerouslySetInnerHTML={{
                            __html: t("welcome_intro"),
                        }}
                    />
                    <span className={styles.stepBadge}>
                        <BoltIcon />
                        {t("one_step_away")}
                    </span>
                </div>

                <div className={styles.ctaFixed}>
                    <StripeExpressCheckout
                        label={t("subscribe")}
                        amount={amount}
                        currency={currency}
                        animateButton
                    />
                    <p className={styles.trialInfo} dangerouslySetInnerHTML={{ __html: trialText }} />
                    <Link
                        href={LEGAL.termsUrl(resolvedCountry)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.termsLink}
                    >
                        {t("footer.terms_and_conditions")}
                    </Link>
                </div>

                <div className={styles.bottomBar}>
                    <div
                        className={styles.scrollHint}
                        onClick={scrollToInfo}
                    >
                        <ChevronDown />
                    </div>
                </div>
            </div>

            {/* ── Screen 2: Product info ── */}
            <div className={styles.screen}>
                <div className={styles.infoContent}>
                    <h2 className={styles.infoTitle}>
                        {t("benefits_premium")}
                    </h2>
                    <div className={styles.featureList}>
                        {benefits.map((item) => (
                            <div key={item} className={styles.featureItem}>
                                <CheckIcon />
                                <span className={styles.featureText}>
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={styles.ctaFixed}>
                    <Button
                        animate
                        endIcon={<ArrowSvg />}
                        onClick={scrollToHero}
                    >
                        {t("subscribe")}
                    </Button>
                    <p className={styles.trialInfo} dangerouslySetInnerHTML={{ __html: trialText }} />
                    <Link
                        href={LEGAL.termsUrl(resolvedCountry)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.termsLink}
                    >
                        {t("footer.terms_and_conditions")}
                    </Link>
                </div>

                <div className={styles.bottomBar}>
                    <Footer />
                </div>
            </div>
        </div>
    );
}
