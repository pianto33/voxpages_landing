import { logger } from "@/utils/logger";

const platformUrl =
  process.env.NEXT_PUBLIC_PLATFORM_URL || "https://voxpages.com";

/**
 * Genera un token de auto-login llamando al API route server-side.
 * La llamada real al endpoint de VoxPages se hace desde /api/generate-token
 * para mantener el secreto JWT_LANDING_SECRET fuera del browser.
 */
export const generateAutoLoginToken = async (
  email: string
): Promise<string> => {
  try {
    const response = await fetch("/api/generate-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok || !data.token) {
      throw new Error(data.error || "Error al generar token");
    }

    return data.token;
  } catch (error) {
    logger.error("Error generating auto-login token", error, { email });
    throw new Error("create_user");
  }
};

/**
 * Construye la URL de redirección con el token JWT.
 * Formato: https://voxpages.com/{locale}/login/jwt/{token}
 */
export const buildLoginUrl = (token: string, locale: string = "es"): string => {
  return `${platformUrl}/${locale}/login/jwt/${token}`;
};

/**
 * Genera token y devuelve la URL completa de login para redirigir al usuario.
 */
export const getMagicLink = async (
  email: string,
  locale: string = "es"
): Promise<string> => {
  try {
    const token = await generateAutoLoginToken(email);
    return buildLoginUrl(token, locale);
  } catch (error) {
    logger.error("Error getting magic link", error, { email, locale });
    throw error;
  }
};
