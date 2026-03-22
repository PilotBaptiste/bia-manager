"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Baby, ChevronRight, Loader2, Check } from "lucide-react";

interface Props {
  userId: string;
  defaultPrenom?: string;
  defaultNom?: string;
  defaultTelephone?: string;
}

type Enfant = {
  id: string;
  nom: string;
  prenom: string;
  date_naissance: string | null;
  lieu_naissance: string | null;
  adresse_rue: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
};

/**
 * Modal shown to parents who haven't completed their profile yet.
 * Step 1: parent info (prenom, nom, telephone)
 * Step 2 (if children found): edit each child's details
 */
export default function ParentOnboarding({ userId, defaultPrenom, defaultNom, defaultTelephone }: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [prenom, setPrenom] = useState(defaultPrenom || "");
  const [nom, setNom] = useState(defaultNom || "");
  const [telephone, setTelephone] = useState(defaultTelephone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 — children
  const [enfants, setEnfants] = useState<Enfant[]>([]);
  const [enfantForms, setEnfantForms] = useState<Record<string, any>>({});
  const [savingKids, setSavingKids] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user?.email) return;
      // Set parent_id on linked eleves before querying (same pattern as reservation page)
      await fetch("/api/link-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      }).catch(() => {});
      const { data } = await supabase
        .from("eleves")
        .select("id,nom,prenom,date_naissance,lieu_naissance,adresse_rue,adresse_cp,adresse_ville")
        .eq("parent_id", user.id)
        .eq("archive", false);
      if (data && data.length > 0) {
        setEnfants(data);
        const forms: Record<string, any> = {};
        data.forEach((e: Enfant) => {
          forms[e.id] = {
            nom: e.nom || "",
            prenom: e.prenom || "",
            date_naissance: e.date_naissance || "",
            lieu_naissance: e.lieu_naissance || "",
            adresse_rue: e.adresse_rue || "",
            adresse_cp: e.adresse_cp || "",
            adresse_ville: e.adresse_ville || "",
          };
        });
        setEnfantForms(forms);
      }
    });
  }, [userId]);

  if (done) return null;

  function updateEnfantForm(id: string, field: string, value: string) {
    setEnfantForms((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim() || !nom.trim()) { setError("Prénom et nom sont requis."); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ prenom: prenom.trim(), nom: nom.trim(), telephone: telephone.trim() || null })
      .eq("id", userId);
    setSaving(false);
    if (err) { setError(err.message); return; }

    if (enfants.length > 0) {
      setStep(2);
    } else {
      setDone(true);
      router.refresh();
    }
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault();
    setSavingKids(true);
    for (const enfant of enfants) {
      const f = enfantForms[enfant.id];
      if (!f) continue;
      await supabase.from("eleves").update({
        nom: f.nom.trim() || enfant.nom,
        prenom: f.prenom.trim() || enfant.prenom,
        date_naissance: f.date_naissance || null,
        lieu_naissance: f.lieu_naissance.trim() || null,
        adresse_rue: f.adresse_rue.trim() || null,
        adresse_cp: f.adresse_cp.trim() || null,
        adresse_ville: f.adresse_ville.trim() || null,
      }).eq("id", enfant.id);
    }
    setSavingKids(false);
    setDone(true);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 pb-0">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-xl shrink-0">✈️</div>
          <div>
            <h2 id="onboarding-title" className="text-lg font-bold text-gray-900">
              Bienvenue sur BIA Manager !
            </h2>
            <p className="text-sm text-gray-500">
              {step === 1 ? "Étape 1/2 — Votre profil" : `Étape 2/2 — Informations de votre${enfants.length > 1 ? "s" : ""} enfant${enfants.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-brand-400 rounded-full transition-all duration-500"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="p-6 space-y-4">
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

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1.5">
              <p className="font-semibold">📋 Pour réserver un vol de découverte, votre enfant doit être :</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>À jour du <strong>paiement</strong> de l&apos;activité BIA</li>
                <li>Avec une <strong>attestation parentale</strong> remplie et signée</li>
              </ul>
              <p className="text-blue-600 text-xs mt-2">
                Vous recevrez un email dès que tout est validé et qu&apos;un créneau est disponible.
              </p>
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {enfants.length > 0 ? "Suivant" : "Accéder à mon espace"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Step 2 — children */}
        {step === 2 && (
          <form onSubmit={handleStep2} className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Ces informations sont utilisées pour les documents officiels (attestation BIA, inscriptions). Vous pourrez les modifier à tout moment depuis votre profil.
            </p>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {enfants.map((enfant) => {
                const f = enfantForms[enfant.id] || {};
                return (
                  <div key={enfant.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                      <Baby className="w-4 h-4 text-brand-400" />
                      {f.prenom || enfant.prenom} {f.nom || enfant.nom}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Prénom</label>
                        <input
                          className="input"
                          value={f.prenom ?? ""}
                          onChange={(e) => updateEnfantForm(enfant.id, "prenom", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Nom</label>
                        <input
                          className="input"
                          value={f.nom ?? ""}
                          onChange={(e) => updateEnfantForm(enfant.id, "nom", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Date de naissance</label>
                        <input
                          className="input"
                          type="date"
                          value={f.date_naissance ?? ""}
                          onChange={(e) => updateEnfantForm(enfant.id, "date_naissance", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Lieu de naissance</label>
                        <input
                          className="input"
                          value={f.lieu_naissance ?? ""}
                          onChange={(e) => updateEnfantForm(enfant.id, "lieu_naissance", e.target.value)}
                          placeholder="Ville, Dép."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label">Adresse</label>
                      <input
                        className="input"
                        value={f.adresse_rue ?? ""}
                        onChange={(e) => updateEnfantForm(enfant.id, "adresse_rue", e.target.value)}
                        placeholder="Numéro et nom de rue"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="label">Code postal</label>
                        <input
                          className="input"
                          value={f.adresse_cp ?? ""}
                          onChange={(e) => updateEnfantForm(enfant.id, "adresse_cp", e.target.value)}
                          placeholder="75000"
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <label className="label">Ville</label>
                        <input
                          className="input"
                          value={f.adresse_ville ?? ""}
                          onChange={(e) => updateEnfantForm(enfant.id, "adresse_ville", e.target.value)}
                          placeholder="Paris"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setDone(true); router.refresh(); }}
                className="btn-secondary flex-1"
              >
                Passer cette étape
              </button>
              <button type="submit" disabled={savingKids} className="btn-primary flex-1">
                {savingKids ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" /> Terminer
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
