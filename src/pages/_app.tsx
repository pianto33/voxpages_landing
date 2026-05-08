import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Script from "next/script";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Analytics } from "@vercel/analytics/react";
import UserProvider from "@/contexts/user/user-provider";
import Layout from "@/components/Layout";
import { useMemo } from "react";
import { useStripeData } from "@/hooks/useStripeData";
import "@/locales/i18n";

// Mover esto fuera del componente para que solo se cree una vez
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || ""
);

export default function App({ Component, pageProps }: AppProps) {
  const { currency } = useStripeData();
  const options = useMemo<StripeElementsOptions>(
    () => ({
      mode: "subscription",
      amount: 0,
      currency,
      appearance: { disableAnimations: true },
      setup_future_usage: "off_session",
      // paymentMethodTypes: ["card"], // ← QUITADO: bloqueaba Google Pay y Apple Pay
    }),
    [currency]
  );

  return (
    <>
      {/* Meta Pixel - afterInteractive para que cargue rápido (necesario para conversiones) */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '925098830084735');
          fbq('track', 'PageView');
        `}
      </Script>
      {/* Microsoft Clarity - heatmaps y grabaciones de sesión.
          Como el landing se sirve también desde dominios externos vía Lambda@Edge
          (landing-g.todosgamers.com → ES/CZ/PL/HU, mid.theauravibe.com → US),
          y Clarity acepta sólo el Site URL configurado en cada proyecto, se
          inyecta el Project ID correcto según el hostname del browser.
          IDs fallback hardcodeados; env vars (si están seteadas) tienen prioridad. */}
      <Script id="ms-clarity" strategy="afterInteractive">
        {`
          (function(c,l,a,r){
            var host = (location.hostname || '').toLowerCase();
            var id = "${process.env.NEXT_PUBLIC_CLARITY_ID || ''}" || "w84pumcs1f";
            if (host.indexOf('todosgamers.com') !== -1) {
              id = "${process.env.NEXT_PUBLIC_CLARITY_ID_TODOSGAMERS || ''}" || "wnz9s5zs2k";
            } else if (host.indexOf('theauravibe.com') !== -1) {
              id = "${process.env.NEXT_PUBLIC_CLARITY_ID_THEAURAVIBE || ''}" || "wnz9f4ghjp";
            }
            if (!id) return;
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            var t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+id;
            var y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script");
        `}
      </Script>
      <Elements stripe={stripePromise} options={options}>
        <UserProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </UserProvider>
      </Elements>
      <Analytics />
    </>
  );
}
