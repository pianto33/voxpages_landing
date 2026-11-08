import { logger } from "./logger";
import { resolveApiUrl } from "./apiBase";

export async function getIpAddress(): Promise<string | null> {
  try {
    const response = await fetch(resolveApiUrl("/api/get-ip"));
    if (!response.ok) {
      throw new Error("Error al obtener la IP");
    }
    const data = await response.json();
    return data.ip;
  } catch (error) {
    logger.warn("Error al obtener la IP", { error });
    return null;
  }
}
