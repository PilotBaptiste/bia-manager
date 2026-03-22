"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  defaultPrenom?: string;
  defaultNom?: string;
  defaultTelephone?: string;
}

/**
 * Modal shown to parents who haven't completed their profile yet (nom/prenom/telephone missing).
 * Collects name + phone, updates profiles table, then dismisses itself.
 */
export default function ParentOnboarding({ userId, defaultPrenom, defaultNom, defaultTelephone }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [prenom, setPrenom] = useState(defaultPrenom || "");
  const [nom, setNom] = useState(defaultNom || "");
  const [telephone, setTelephone] = useState(defaultTelephone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim()) {
      setError("Prénom et nom sont requis.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ prenom: prenom.trim(), nom: nom.trim(), telephone: telephone.trim() || null })
      .eq("id", userId);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-xl">✈️</div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bienvenue sur BIA Manager !</h2>
            <p className="text-sm text-gray-500">Complétez votre profil pour continuer</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom *</label>
              <input
                className="input"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Jean"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Nom *</label>
              <input
                className="input"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Dupont"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input
              className="input"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="06 12 34 56 78"
              type="tel"
            />
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1.5">
            <p className="font-semibold">📋 Pour réserver un vol de découverte, votre enfant doit être :</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>À jour du <strong>paiement</strong> de l'activité BIA</li>
              <li>Avec une <strong>attestation parentale</strong> remplie et signée</li>
            </ul>
            <p className="text-blue-600 text-xs mt-2">
              Vous recevrez un email dès que tout est validé et qu'un créneau est disponible.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? "Enregistrement…" : "Accéder à mon espace →"}
          </button>
        </form>
      </div>
    </div>
  );
}
