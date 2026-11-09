"use client";
import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

/** Démarre le paiement en ligne de la cotisation BIA et renvoie vers HelloAsso. */
export default function BoutonPaiement({ eleveId }: { eleveId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function payer() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/paiement/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eleve_id: eleveId }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (!res?.ok || !data?.url) {
      setLoading(false);
      setError(data?.error ?? "Paiement indisponible pour le moment.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="mt-2">
      <button onClick={payer} disabled={loading} className="btn-primary btn-sm">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
        Payer en ligne
      </button>
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
      {!error && <p className="text-[11px] text-gray-500 mt-1">Paiement sécurisé par HelloAsso</p>}
    </div>
  );
}
