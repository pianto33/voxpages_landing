import Head from "next/head";
import { useEffect } from "react";
import { Inter, Orbitron } from "next/font/google";
import styles from "@/styles/Layout.module.css";
import { useAppTranslation } from "@/hooks/useAppTranslation";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  display: "swap",
});

interface Props {
  children: React.ReactNode;
}

function htmlLang(lng: string): string {
  if (lng === "ksa") return "ar";
  if (lng === "br") return "pt-BR";
  if (lng === "mys") return "ms";
  if (lng === "mx") return "es-MX";
  if (lng === "cl") return "es-CL";
  return lng || "es";
}

function Layout({ children }: Props) {
  const { t, lng } = useAppTranslation();

  useEffect(() => {
    const html = document.documentElement;
    html.lang = htmlLang(lng);
    html.dir = lng === "ksa" ? "rtl" : "ltr";
  }, [lng]);

  return (
    <>
      <Head>
        <title>Landing page</title>
        <meta name="description" content={t("metadata.description")} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </Head>

      <div
        className={`${styles.layout} ${inter.variable} ${orbitron.variable}`}
      >
        <main>{children}</main>
      </div>
    </>
  );
}

export default Layout;
