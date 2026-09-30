import type { WalletResolveKind, WalletTestSpec } from "@/lib/walletTestMatrix";

type BaseResolve = {
  emailRequired: boolean;
  phoneNumberRequired: boolean;
  billingAddressRequired: boolean;
};

const TRIAL_LABEL = "1 Day Free Trial";
const MGMT = "https://www.voxpages.com/cancel";

function tomorrow(): Date {
  return new Date(Date.now() + 864e5);
}

function deferredBlock() {
  return {
    deferredPaymentRequest: {
      paymentDescription: TRIAL_LABEL,
      managementURL: MGMT,
      deferredBilling: {
        label: TRIAL_LABEL,
        amount: 0,
        amountType: "final" as const,
        deferredPaymentDate: tomorrow(),
      },
    },
  };
}

export function buildWalletResolve(
  kind: WalletResolveKind,
  base: BaseResolve,
  elementsAmount: number,
): Record<string, unknown> {
  switch (kind) {
    case "line_items_0":
      return {
        ...base,
        business: { name: TRIAL_LABEL },
        lineItems: [{ name: TRIAL_LABEL, amount: 0 }],
      };
    case "line_items_match":
      return {
        ...base,
        business: { name: "VoxPages" },
        lineItems: [{ name: "VoxPages", amount: elementsAmount }],
      };
    case "deferred":
      return {
        ...base,
        business: { name: TRIAL_LABEL },
        lineItems: [{ name: TRIAL_LABEL, amount: 0 }],
        applePay: deferredBlock(),
      };
    case "deferred_only":
      return {
        ...base,
        applePay: deferredBlock(),
      };
    case "base":
    default:
      return { ...base };
  }
}

export function resolveForWalletTest(
  spec: WalletTestSpec,
  expressPaymentType: string,
  base: BaseResolve,
): Record<string, unknown> {
  if (expressPaymentType === "google_pay") {
    return buildWalletResolve(spec.gpay, base, spec.elementsAmount);
  }
  if (expressPaymentType === "apple_pay") {
    return buildWalletResolve(spec.apple, base, spec.elementsAmount);
  }
  return { ...base };
}

/** Payload de producción: deferred + lineItems 0 para cualquier wallet. */
export function productionTrialResolve(base: BaseResolve): Record<string, unknown> {
  return buildWalletResolve("deferred", base, 0);
}
