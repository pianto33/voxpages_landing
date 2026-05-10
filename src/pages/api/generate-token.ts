import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/utils/logger";
import { withRateLimitAndMonitoring } from "@/lib/rate-limit";
import { getRequestContext, compactContext } from "@/utils/serverContext";

const PLATFORM_URL =
  process.env.NEXT_PUBLIC_PLATFORM_URL || "https://summaryvox.com";
const JWT_LANDING_SECRET = process.env.JWT_LANDING_SECRET || "";

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
    const response = await fetch(`${PLATFORM_URL}/api/auth/landing-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-secret": JWT_LANDING_SECRET,
      },
      body: JSON.stringify({ email: email.toLowerCase().trim() }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      logger.error("Error from SummaryVox landing-token endpoint", null, {
        ...ctx,
        status: response.status,
        email,
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
