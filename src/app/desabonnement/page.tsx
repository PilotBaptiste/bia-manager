"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, MailX, Plane } from "lucide-react";

function Desabonnement() {
  const p = useSearchParams();
  const query = `o=${encodeURIComponent(p.get("o") ?? "")}&e=${encodeURIComponent(p.get("e") ?? "")}&s=${encodeURIComponent(p.get("s") ?? "")}`;
  const [etat, setEtat] = useState<{ email: string; club: string; desabonne: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/desabonnement?${query}`)
      .then(async (r) => ({ ok: r.ok, data: await r.json() }))
      .then(({ ok, data }) => (ok ? setEtat(data) : setError(data.error ?? "Lien invalide.")))
      .catch(() => setError("Lien invalide."));
  }, []);

  async function enregistrer(accepte: boolean) {
    setSaving(true);
    const res = await fetch(`/api/desabonnement?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepte }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Enregistrement impossible."); return; }
    setEtat((e) => (e ? { ...e, desabonne: data.desabonne } : e));
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }
  if (!etat) {
    return <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  }

  return (
    <>
      <p className="text-sm text-gray-500 mb-1">{etat.club}</p>
      <h1 className="text-lg font-bold text-gray-900 mb-1">Emails envoyés à {etat.email}</h1>

      {etat.desabonne ? (
        <>
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 my-4">
            <MailX className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Cette adresse ne reçoit plus aucun email.</p>
              <p className="mt-1">
                Vous ne serez plus prévenu des créneaux de vol disponibles, des confirmations, des rappels ni des annulations.
                Il vous appartient de vous tenir informé directement auprès de l&apos;aéroclub.
              </p>
            </div>
          </div>
          <button onClick={() => enregistrer(true)} disabled={saving} className="btn-primary w-full justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Recevoir à nouveau les emails
          </button>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-200 p-4 my-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-gray-600">
              <p className="font-semibold text-gray-900">Avant de confirmer</p>
              <p className="mt-1">
                Toute l&apos;organisation du BIA passe par email : ouverture des créneaux de vol, confirmation de réservation,
                rappels, changement de pilote, annulation. En vous désabonnant, vous ne recevrez <strong>plus aucun</strong> de ces messages,
                et il vous appartiendra de vous tenir informé auprès de l&apos;aéroclub.
              </p>
              <p className="mt-1">Vous pourrez réactiver les emails à tout moment depuis votre espace, rubrique Mon profil.</p>
            </div>
          </div>
          <button onClick={() => enregistrer(false)} disabled={saving} className="btn-danger w-full justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailX className="w-4 h-4" />} Ne plus recevoir d&apos;emails
          </button>
        </>
      )}
    </>
  );
}

export default function DesabonnementPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-4 text-brand-500">
          <Plane className="w-5 h-5" />
          <span className="text-sm font-bold">BIA Manager</span>
        </div>
        <div className="card">
          <Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>}>
            <Desabonnement />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
