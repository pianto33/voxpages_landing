import type { NextApiRequest } from "next";
import { getRequestContext } from "@/utils/serverContext";

const UUID_RE =
  /^(?:temp-)?[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID de browser (anon_id). Rechaza JWT y cualquier cosa con token. */
export function sanitizeDeviceId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!UUID_RE.test(v)) return null;
  if (/token=|bearer\s|eyJ/i.test(v)) return null;
  return v;
}

export function sanitizeIp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim();
  if (v.toLowerCase().startsWith("::ffff:")) v = v.slice(7);
  if (!v || v.length > 45 || /token=|https?:|eyJ/i.test(v)) return null;
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(v)) {
    if (v.split(".").some((part) => Number(part) > 255)) return null;
    return v;
  }
  if (v.includes(":") && /^[0-9a-f:]+$/i.test(v)) return v;
  return null;
}

/** IP que vio Vercel. Si no hay, la que mandó el browser. */
export function checkoutIp(req: NextApiRequest, clientIp: unknown): string {
  return sanitizeIp(getRequestContext(req).ip) || sanitizeIp(clientIp) || "";
}
