import Image from "next/image";
import Link from "next/link";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { LEGAL } from "@/constants";
import styles from "@/styles/Footer.module.css";
import logo from "../../../public/images/logo.png";

function Footer() {
    const { t, lng } = useAppTranslation();

    return (
        <footer className={styles.footer}>
            <Image width={28} height={28} src={logo} alt="VoxPages" />

            <nav className={styles.footerLinks} aria-label="Legal">
                <Link
                    href={LEGAL.termsUrl(lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLink}
                >
                    {t("footer.terms_and_conditions")}
                </Link>
                <Link
                    href={LEGAL.privacyUrl(lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLink}
                >
                    {t("footer.privacy_policy")}
                </Link>
                <Link
                    href={LEGAL.subscriptionPolicyUrl(lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLink}
                >
                    {t("footer.subscription_policy")}
                </Link>
                <a
                    href={`mailto:${LEGAL.SUPPORT_EMAIL}`}
                    className={styles.footerLink}
                >
                    {t("footer.contact")}
                </a>
            </nav>

            <address className={styles.address}>
                {LEGAL.COMPANY_ADDRESS}
            </address>

            <span className={styles.company}>
                © {new Date().getFullYear()} {LEGAL.COMPANY_NAME}
            </span>
        </footer>
    );
}

export default Footer;
