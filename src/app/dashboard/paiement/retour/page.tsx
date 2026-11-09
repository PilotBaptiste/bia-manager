"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, AlertCircle, XCircle } from "lucide-react";

type Etat = "verification" | "paye" | "attente" | "annule" | "erreur";

export default function RetourPaiementPage() {
  const params = useSearchParams();
  const router = useRouter();
  const reference = params.get("ref") ?? "";
  const etatUrl = params.get("etat") ?? "";
  const [etat, setEtat] = useState<Etat>(etatUrl === "annule" ? "annule" : etatUrl === "erreur" ? "erreur" : "verification");
  const [message, setMessage] = useState<string | null>(null);
  const essais = useRef(0);

  useEffect(() => {
    if (etat !== "verification" || !reference) {
      if (!reference && etat === "verification") setEtat("erreur");
      return;
    }
    let annule = false;

    // HelloAsso peut mettre quelques secondes à finaliser : on revérifie jusqu'à 5 fois.
    async function verifier() {
      const res = await fetch("/api/paiement/confirmer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      }).catch(() => null);
      if (annule) return;

      const data = await res?.json().catch(() => ({}));
      if (!res?.ok) {
        setMessage(data?.error ?? "Vérification impossible.");
        setEtat("erreur");
        return;
      }
      if (data.statut === "paye") {
        setEtat("paye");
        return;
      }
      essais.current += 1;
      if (essais.current >= 5) {
        setEtat("attente");
        return;
      }
      setTimeout(verifier, 2000);
    }
    verifier();
    return () => { annule = true; };
  }, [etat, reference]);

  return (
    <div className="max-w-md mx-auto">
      <div className="card text-center py-10">
        {etat === "verification" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-brand-400 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-900">Vérification du paiement…</h1>
            <p className="text-sm text-gray-500 mt-1">Merci de patienter quelques secondes.</p>
          </>
        )}

        {etat === "paye" && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-900">Paiement enregistré</h1>
            <p className="text-sm text-gray-600 mt-1">
              Merci ! Le dossier est à jour. Dès que l&apos;attestation parentale est signée,
              vous pourrez réserver le vol.
            </p>
            <div className="flex justify-center gap-2 mt-5">
              <button onClick={() => router.push("/dashboard")} className="btn-primary btn-sm">Retour à mon espace</button>
            </div>
          </>
        )}

        {etat === "attente" && (
          <>
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-900">Paiement en cours de traitement</h1>
            <p className="text-sm text-gray-600 mt-1">
              HelloAsso n&apos;a pas encore confirmé le paiement. Il sera enregistré automatiquement
              dès réception — rechargez cette page dans quelques minutes.
            </p>
            <div className="flex justify-center gap-2 mt-5">
              <button onClick={() => { essais.current = 0; setEtat("verification"); }} className="btn-secondary btn-sm">Revérifier</button>
              <button onClick={() => router.push("/dashboard")} className="btn-primary btn-sm">Retour à mon espace</button>
            </div>
          </>
        )}

        {etat === "annule" && (
          <>
            <XCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-900">Paiement annulé</h1>
            <p className="text-sm text-gray-600 mt-1">Aucun montant n&apos;a été prélevé. Vous pouvez recommencer quand vous le souhaitez.</p>
            <div className="flex justify-center gap-2 mt-5">
              <button onClick={() => router.push("/dashboard")} className="btn-primary btn-sm">Retour à mon espace</button>
            </div>
          </>
        )}

        {etat === "erreur" && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-900">Le paiement n&apos;a pas abouti</h1>
            <p className="text-sm text-gray-600 mt-1">{message ?? "Aucun montant n'a été prélevé. Vous pouvez réessayer."}</p>
            <div className="flex justify-center gap-2 mt-5">
              <button onClick={() => router.push("/dashboard")} className="btn-primary btn-sm">Retour à mon espace</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
