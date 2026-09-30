import Link from "next/link";
import { WALLET_TEST_LIST } from "@/lib/walletTestMatrix";

export default function TestWalletsPage() {
  return (
    <main style={{ maxWidth: 640, margin: "24px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20 }}>Tests de Google Pay</h1>
      <p style={{ fontSize: 14, color: "#444" }}>
        Cada link es la landing de España con un combo distinto de monto y payload.
        El cobro real no cambia. Probar Google Pay en Android y anotar cuál abre.
      </p>
      <ul style={{ paddingLeft: 18, lineHeight: 1.5 }}>
        {WALLET_TEST_LIST.map((spec) => (
          <li key={spec.id} style={{ marginBottom: 12 }}>
            <Link href={spec.path}>{spec.path}</Link>
            <div style={{ fontSize: 13, color: "#444" }}>{spec.label}</div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Elements {spec.elementsAmount} · Apple {spec.apple} · GPay {spec.gpay}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
