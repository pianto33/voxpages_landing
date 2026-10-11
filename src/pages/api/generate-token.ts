import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { getRequestContext, compactContext } from "@/utils/serverContext";

const PLATFORM_URL =
  process.env.NEXT_PUBLIC_PLATFORM_URL || "https://www.voxpages.com";
const JWT_LANDING_SECRET = process.env.JWT_LANDING_SECRET || "";

/**
 * voxpages.com (apex) responde 307 a www. Un fetch que sigue ese redirect
 * no siempre reenvía el POST con x-api-secret, y la landing termina en un 404
 * que no es el route. Pedimos directo a www y, si igual hay redirect,
 * re-posteamos a mano.
 */
function landingTokenUrl(): string {
  const base = PLATFORM_URL.endsWith("/") ? PLATFORM_URL : `${PLATFORM_URL}/`;
  const url = new URL("api/auth/landing-token", base);
  if (url.hostname === "voxpages.com") {
    url.hostname = "www.voxpages.com";
  }
  return url.toString();
}

async function postLandingToken(email: string): Promise<Response> {
  let url = landingTokenUrl();
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": JWT_LANDING_SECRET,
      },
      body: JSON.stringify({ email }),
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    url = new URL(location, url).toString();
  }
  return fetch(url, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      "x-api-secret": JWT_LANDING_SECRET,
    },
    body: JSON.stringify({ email }),
  });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ctx = compactContext(getRequestContext(req));

  const { email } = req.body;

  logger.info("generate-token request", {
    funnel_step: "magic_link_requested",
    ...ctx,
    email,
  });

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  if (!JWT_LANDING_SECRET) {
    logger.error("JWT_LANDING_SECRET is not configured", null, { ...ctx });
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const tokenUrl = landingTokenUrl();
    const response = await postLandingToken(email.toLowerCase().trim());

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      logger.error("Error from VoxPages landing-token endpoint", null, {
        ...ctx,
        status: response.status,
        email,
        token_url: tokenUrl,
      });
      return res
        .status(response.status)
        .json({ error: data.error || "Error generating token" });
    }

    const data = await response.json();

    if (!data.token) {
      logger.error("No token in landing-token response", null, { ...ctx, email });
      return res.status(502).json({ error: "Invalid response from platform" });
    }

    logger.info("generate-token success", {
      funnel_step: "magic_link_received",
      ...ctx,
      email,
    });

    return res.status(200).json({ token: data.token });
  } catch (error) {
    logger.error("Error calling landing-token endpoint", error, { ...ctx, email });
    return res.status(500).json({ error: "Internal server error" });
  }
}

export default withRateLimitAndMonitoring(handler, "default");
