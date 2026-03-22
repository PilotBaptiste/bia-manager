"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Save, Loader2, Check, Lock, Baby, ChevronDown, ChevronUp } from "lucide-react";

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

type EnfantForm = {
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance: string;
  adresse_rue: string;
  adresse_cp: string;
  adresse_ville: string;
};

function EnfantCard({
  enfant,
  onSaved,
}: {
  enfant: Enfant;
  onSaved: (updated: Enfant) => void;
}) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EnfantForm>({
    nom: enfant.nom || "",
    prenom: enfant.prenom || "",
    date_naissance: enfant.date_naissance || "",
    lieu_naissance: enfant.lieu_naissance || "",
    adresse_rue: enfant.adresse_rue || "",
    adresse_cp: enfant.adresse_cp || "",
    adresse_ville: enfant.adresse_ville || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("eleves")
      .update({
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        date_naissance: form.date_naissance || null,
        lieu_naissance: form.lieu_naissance.trim() || null,
        adresse_rue: form.adresse_rue.trim() || null,
        adresse_cp: form.adresse_cp.trim() || null,
        adresse_ville: form.adresse_ville.trim() || null,
      })
      .eq("id", enfant.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    onSaved({ ...enfant, ...form });
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Baby className="w-4 h-4 text-brand-400 shrink-0" />
          <span className="font-medium text-gray-900">
            {form.prenom} {form.nom}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom</label>
              <input
                className="input"
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Nom</label>
              <input
                className="input"
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date de naissance</label>
              <input
                className="input"
                type="date"
                value={form.date_naissance}
                onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Lieu de naissance</label>
              <input
                className="input"
                value={form.lieu_naissance}
                onChange={(e) => setForm({ ...form, lieu_naissance: e.target.value })}
                placeholder="Ville, Département"
              />
            </div>
          </div>
          <div>
            <label className="label">Adresse</label>
            <input
              className="input"
              value={form.adresse_rue}
              onChange={(e) => setForm({ ...form, adresse_rue: e.target.value })}
              placeholder="Numéro et nom de rue"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Code postal</label>
              <input
                className="input"
                value={form.adresse_cp}
                onChange={(e) => setForm({ ...form, adresse_cp: e.target.value })}
                placeholder="75000"
                maxLength={5}
              />
            </div>
            <div>
              <label className="label">Ville</label>
              <input
                className="input"
                value={form.adresse_ville}
                onChange={(e) => setForm({ ...form, adresse_ville: e.target.value })}
                placeholder="Paris"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {saved && (
            <p className="text-sm text-emerald-600 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Informations enregistrées
            </p>
          )}

          <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfilPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ nom: "", prenom: "", telephone: "" });
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [enfants, setEnfants] = useState<Enfant[]>([]);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Ensure parent_id is set on all linked eleves (same as reservation page)
      await fetch("/api/link-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      }).catch(() => {});

      const [{ data: prof }, { data: kids }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("eleves")
          .select("id,nom,prenom,date_naissance,lieu_naissance,adresse_rue,adresse_cp,adresse_ville")
          .eq("parent_id", user.id)
          .eq("archive", false),
      ]);
      if (prof) {
        setProfile(prof);
        setForm({ nom: prof.nom || "", prenom: prof.prenom || "", telephone: prof.telephone || "" });
      }
      if (kids) setEnfants(kids);
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ nom: form.nom, prenom: form.prenom, telephone: form.telephone })
      .eq("id", profile.id);

    // Sync parent name to all linked eleves rows
    await supabase
      .from("eleves")
      .update({
        parent_nom: form.nom,
        parent_prenom: form.prenom,
        parent_telephone: form.telephone,
        responsable_legal_nom: `${form.prenom} ${form.nom}`.trim(),
      })
      .eq("parent_email", profile.email);

    setSaving(false);
    setSaved(true);
    setProfile({ ...profile, nom: form.nom, prenom: form.prenom, telephone: form.telephone });
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  async function handleChangePassword() {
    if (!pwForm.password || pwForm.password.length < 6) {
      setPwMsg("Le mot de passe doit faire au moins 6 caracteres.");
      return;
    }
    if (pwForm.password !== pwForm.confirm) {
      setPwMsg("Les mots de passe ne correspondent pas.");
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pwForm.password });
    setPwSaving(false);
    if (error) { setPwMsg(`Erreur: ${error.message}`); return; }
    setPwMsg("Mot de passe modifie avec succes !");
    setPwForm({ password: "", confirm: "" });
    setTimeout(() => setPwMsg(null), 5000);
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-1">{profile?.email}</p>
      </div>

      {saved && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" /> Profil mis a jour
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Informations personnelles */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" /> Informations personnelles
          </h2>
          <div className="space-y-3">
            <div>
              <label className="label">Prenom</label>
              <input
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Nom</label>
              <input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Telephone</label>
              <input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="input"
                placeholder="06 XX XX XX XX"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={profile?.email || ""} disabled className="input opacity-60" />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{" "}
              Enregistrer
            </button>
          </div>
        </div>

        {/* Changer mot de passe */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-400" /> Changer le mot de passe
          </h2>
          {pwMsg && (
            <div
              className={`mb-3 p-3 rounded-lg text-sm ${pwMsg.includes("succes") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
            >
              {pwMsg}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="label">Nouveau mot de passe</label>
              <input
                type="password"
                value={pwForm.password}
                onChange={(e) => setPwForm({ ...pwForm, password: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Confirmer</label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleChangePassword} disabled={pwSaving} className="btn-secondary">
              {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}{" "}
              Modifier le mot de passe
            </button>
          </div>
        </div>
      </div>

      {/* Mes enfants */}
      {enfants.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Baby className="w-4 h-4 text-brand-400" /> Mes enfants
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Vous pouvez modifier les informations de votre enfant. Elles sont utilisées pour les documents officiels (attestation, BIA).
          </p>
          <div className="space-y-2">
            {enfants.map((e) => (
              <EnfantCard
                key={e.id}
                enfant={e}
                onSaved={(updated) =>
                  setEnfants((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
