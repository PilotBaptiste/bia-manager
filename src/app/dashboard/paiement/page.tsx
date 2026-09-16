"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

function Retour() {
  const reference = useSearchParams().get("ref");
  const [etat, setEtat] = useState<{ statut: string; montant?: number; eleve?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) { setError("Référence de paiement manquante."); return; }
    let stop = false;
    let essais = 0;
    async function verifier() {
      const res = await fetch(`/api/paiement/etat?ref=${encodeURIComponent(reference!)}`);
      const data = await res.json().catch(() => ({}));
      if (stop) return;
      if (!res.ok) { setError(data.error ?? "Vérification impossible."); return; }
      setEtat(data);
      // Le rappel de SumUp peut arriver quelques secondes après le retour du navigateur.
      if (data.statut === "en_attente" && essais++ < 10) setTimeout(verifier, 2000);
    }
    verifier();
    return () => { stop = true; };
  }, [reference]);

  const paye = etat?.statut === "paye";
  const echoue = etat?.statut === "echoue" || !!error;

  return (
    <div className="max-w-md mx-auto">
      <div className="card text-center">
        <div className="flex justify-center mb-3">
          {paye ? <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            : echoue ? <XCircle className="w-10 h-10 text-red-500" />
            : <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />}
        </div>
        <h1 className="text-lg font-bold text-gray-900">
          {paye ? "Paiement confirmé" : echoue ? "Paiement non abouti" : "Vérification du paiement…"}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {paye ? `L'inscription de ${etat?.eleve} est réglée (${etat?.montant}€). Vous pouvez maintenant signer l'attestation et réserver le vol.`
            : echoue ? (error ?? "Le paiement n'a pas été encaissé. Vous pouvez réessayer depuis votre espace.")
            : "Nous attendons la confirmation de SumUp, cela prend quelques secondes."}
        </p>
        <Link href="/dashboard" className="btn-primary btn-sm mt-4 inline-flex">Retour à mon espace</Link>
      </div>
    </div>
  );
}

export default function PaiementRetourPage() {
  return <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>}><Retour /></Suspense>;
}
