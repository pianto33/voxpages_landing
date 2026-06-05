# voxpages - Landing de Suscripción

Landing page para suscripciones de voxpages - Tu destino definitivo para resúmenes de libros en formato de audio.

## 🚀 Stack Tecnológico

- **Framework**: Next.js 14.2.13
- **Lenguaje**: TypeScript
- **Estilos**: CSS Modules
- **Internacionalización**: i18next
- **Pagos**: Stripe
- **Emails**: Resend
- **Analytics**: Google Tag Manager

## 🌍 Idiomas Soportados

-
- 🇪🇸 Español (es)
- 🇵🇹 Portugués (pt)
- 🇮🇹 Italiano (it)
- 🇵🇱 Polaco (pl)
- 🇭🇺 Húngaro (hu)
- 🇨🇿 Checo (cz)

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus claves

# Ejecutar en desarrollo
npm run dev
```

## 📋 Variables de Entorno Requeridas

```bash
# Resend (Emails)
RESEND_API_KEY=re_...

# Stripe (Pagos)
STRIPE_PRIVATE_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_...

# URLs
NEXT_PUBLIC_PLATFORM_URL=https://voxpages.com
NEXT_PUBLIC_BASE_URL=https://landing.voxpages.com

# Google Tag Manager
NEXT_PUBLIC_GTM_CODE=GTM-...
```

## 🎨 Estructura del Proyecto

```
src/
├── api/              # Servicios API externos
├── components/       # Componentes React
├── constants/        # Constantes y configuración
├── contexts/         # Context providers
├── hooks/            # Custom hooks
├── interfaces/       # TypeScript interfaces
├── locales/          # Traducciones i18n
├── pages/            # Páginas Next.js
├── styles/           # CSS Modules
└── utils/            # Utilidades
```

## 💳 Flujo de Suscripción

1. Usuario ingresa a `/[countryCode]` (ej: `/es`, `/pt`)
2. Completa el formulario de Stripe
3. Redirige a `/pending` para procesar el pago
4. Redirige a `/thanks` con auto-login
5. Usuario es redirigido a voxpages con sesión iniciada

## 📧 Sistema de Emails

Usa Resend para enviar emails desde `@voxpages.com`:
- Email de bienvenida con link de auto-login
- Información del trial gratuito
- Links de cancelación y soporte

## 🌐 Rutas Dinámicas

- `/[countryCode]` - Página principal de suscripción
- `/[countryCode]/pending` - Procesamiento del pago
- `/[countryCode]/thanks` - Confirmación y redirección
- `/[countryCode]/error` - Página de errores

## 🔗 Integración con voxpages

El sistema usa auto-login tokens para crear/loguear usuarios automáticamente:
- Genera token JWT desde la API de voxpages
- Token sin expiración
- Usuario se crea automáticamente si no existe

## 📦 Scripts Disponibles

```bash
npm run dev    # Desarrollo
npm run build  # Build de producción
npm run start  # Servidor de producción
npm run lint   # Linter
```

## 🚢 Deploy

El proyecto está optimizado para Vercel:

1. Conecta el repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático en cada push

## 📝 Notas

- El trial gratuito es de 24 horas
- Los precios varían por país (ver `src/constants/index.ts`)
- Todos los textos están completamente traducidos
