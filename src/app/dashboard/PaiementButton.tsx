"use client";
import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PaiementButton({ eleveId, montant }: { eleveId: string; montant: number }) {
  const [loading, setLoading] = useState(false);

  async function payer() {
    setLoading(true);
    const res = await fetch("/api/paiement/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eleveId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setLoading(false);
      toast.error(data.error ?? "Le paiement n'a pas pu être lancé.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <button onClick={payer} disabled={loading} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-400 transition-colors disabled:opacity-60">
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
      Payer {montant}€ par carte
    </button>
  );
}
