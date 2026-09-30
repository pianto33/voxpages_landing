/**
 * Rutas /test-* para aislar qué combo abre Google Pay.
 * El monto es el que va a Elements, en unidad menor (50 = 0,50).
 * La URL pública se queda en /test-N; el middleware reescribe a /es.
 */

export type WalletTestId =
  | "test-0"
  | "test-1"
  | "test-2"
  | "test-3"
  | "test-4"
  | "test-5"
  | "test-6"
  | "test-7"
  | "test-8"
  | "test-9";

export type WalletResolveKind =
  | "base"
  | "line_items_0"
  | "line_items_match"
  | "deferred"
  | "deferred_only";

export type WalletTestSpec = {
  id: WalletTestId;
  path: `/${WalletTestId}`;
  /** Unidad menor de Elements. 0 | 50 (= 0,50) | 500 (= 5,00). */
  elementsAmount: number;
  apple: WalletResolveKind;
  gpay: WalletResolveKind;
  label: string;
};

export const WALLET_TESTS: Record<WalletTestId, WalletTestSpec> = {
  "test-0": {
    id: "test-0",
    path: "/test-0",
    elementsAmount: 0,
    apple: "base",
    gpay: "base",
    label: "Elements 0 · ambos base. Si abre, el payload de trial es lo que mata GPay.",
  },
  "test-1": {
    id: "test-1",
    path: "/test-1",
    elementsAmount: 0,
    apple: "line_items_0",
    gpay: "line_items_0",
    label: "Elements 0 · lineItems 0 sin deferred. Histórico OR_BIBED_06.",
  },
  "test-2": {
    id: "test-2",
    path: "/test-2",
    elementsAmount: 0,
    apple: "deferred",
    gpay: "deferred",
    label: "Elements 0 · deferred en Apple y GPay. Igual que producción ahora.",
  },
  "test-3": {
    id: "test-3",
    path: "/test-3",
    elementsAmount: 0,
    apple: "deferred",
    gpay: "base",
    label: "Elements 0 · deferred solo Apple · GPay base.",
  },
  "test-4": {
    id: "test-4",
    path: "/test-4",
    elementsAmount: 50,
    apple: "base",
    gpay: "base",
    label: "Elements 0,50 · ambos base. El piso, sin trial en el resolve.",
  },
  "test-5": {
    id: "test-5",
    path: "/test-5",
    elementsAmount: 50,
    apple: "deferred",
    gpay: "base",
    label: "Elements 0,50 · deferred solo Apple · GPay base.",
  },
  "test-6": {
    id: "test-6",
    path: "/test-6",
    elementsAmount: 50,
    apple: "deferred",
    gpay: "deferred",
    label: "Elements 0,50 · deferred en Apple y GPay.",
  },
  "test-7": {
    id: "test-7",
    path: "/test-7",
    elementsAmount: 500,
    apple: "base",
    gpay: "base",
    label: "Elements 5,00 · ambos base. Monto claramente positivo.",
  },
  "test-8": {
    id: "test-8",
    path: "/test-8",
    elementsAmount: 50,
    apple: "base",
    gpay: "line_items_match",
    label: "Elements 0,50 · GPay lineItems = 0,50 (suman el total).",
  },
  "test-9": {
    id: "test-9",
    path: "/test-9",
    elementsAmount: 0,
    apple: "base",
    gpay: "deferred",
    label: "Elements 0 · deferred solo en GPay.",
  },
};

export const WALLET_TEST_LIST: WalletTestSpec[] = Object.values(WALLET_TESTS);

function pathOnly(asPath: string): string {
  return asPath.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
}

export function getWalletTestSpec(
  asPath: string,
  explicitId?: string | string[],
): WalletTestSpec | null {
  const fromPath = WALLET_TESTS[pathOnly(asPath).replace(/^\//, "") as WalletTestId];
  if (fromPath) return fromPath;
  const id = Array.isArray(explicitId) ? explicitId[0] : explicitId;
  if (id && id in WALLET_TESTS) return WALLET_TESTS[id as WalletTestId];
  return null;
}

export function isWalletTestPath(pathname: string): boolean {
  return getWalletTestSpec(pathname) !== null;
}
