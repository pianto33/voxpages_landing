/** @type {import('next').NextConfig} */

// ============================================================================
// CORS - Dominios Permitidos
// ============================================================================
const PRODUCTION_ORIGINS = [
  'https://landing.summaryvox.com',
  'https://landing-qa.summaryvox.com',
  'https://summaryvox.com',
  'https://cross.summaryvox.com',
  'https://cross-qa.summaryvox.com',
  'https://suscriptionlanding-git-qa-summaryvox-projects.vercel.app',
  'https://resume-book-git-qa-summaryvox-projects.vercel.app',
];

const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
];

const getAllowedOrigins = () => {
  return process.env.NODE_ENV === 'production' 
    ? PRODUCTION_ORIGINS 
    : [...PRODUCTION_ORIGINS, ...DEV_ORIGINS];
};

// ============================================================================
// Security Headers
// ============================================================================
const securityHeaders = [
  // SEO - No indexar esta landing
  {
    key: 'X-Robots-Tag',
    value: 'noindex, nofollow, noarchive, nosnippet',
  },
  // Prevenir clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Prevenir MIME sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // XSS Protection (legacy pero útil para navegadores viejos)
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Controlar qué información se envía en el Referer
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Deshabilitar APIs del navegador que no usamos
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // Content Security Policy - Ajustado para Stripe, Meta Pixel y Vercel
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Scripts: Stripe, Meta Pixel, Microsoft Clarity, Vercel Live (preview)
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://connect.facebook.net https://www.clarity.ms https://*.clarity.ms https://vercel.live https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      // Frames: Stripe, hCaptcha, Vercel Live (preview), Google Pay
      "frame-src https://js.stripe.com https://hooks.stripe.com https://www.facebook.com https://newassets.hcaptcha.com https://www.google.com https://vercel.live https://pay.google.com",
      // Conexiones: Stripe, Meta Pixel + CAPI, ipapi (ambos dominios), Clarity, Vercel, hCaptcha, Google Pay
      "connect-src 'self' https://api.stripe.com https://www.facebook.com https://connect.facebook.net https://*.datah04.com https://ipapi.co https://api.ipapi.com https://www.clarity.ms https://*.clarity.ms https://www.google.com https://*.google.com https://vercel.live https://va.vercel-scripts.com https://api.hcaptcha.com https://summaryvox.com https://qa.summaryvox.com https://pay.google.com",
      "worker-src 'self' blob:",
    ].join('; '),
  },
];

// HSTS solo en producción (requiere HTTPS)
if (process.env.NODE_ENV === 'production') {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  });
}

const nextConfig = {
  reactStrictMode: true,
  
  async rewrites() {
    return [
      {
        source: '/.well-known/apple-developer-merchantid-domain-association',
        destination: '/api/.well-known/apple-developer-merchantid-domain-association',
      },
    ];
  },
  
  async headers() {
    const allowedOrigins = getAllowedOrigins();
    
    return [
      // Security headers para todas las rutas
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // CORS headers para API routes
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            // En producción, el middleware validará el origin específico
            // Aquí usamos el primer origen como default (Vercel maneja CORS dinámicamente)
            value: process.env.NODE_ENV === 'production' 
              ? 'https://landing.summaryvox.com'
              : '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
};

// Exportar lista de orígenes para uso en middleware/APIs
export { getAllowedOrigins, PRODUCTION_ORIGINS, DEV_ORIGINS };

export default nextConfig;
