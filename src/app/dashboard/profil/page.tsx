"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, Save, Loader2, Check, Lock } from "lucide-react";

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

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setForm({
          nom: data.nom || "",
          prenom: data.prenom || "",
          telephone: data.telephone || "",
        });
      }
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
    // Refresh server layout so sidebar name updates immediately
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
    const { error } = await supabase.auth.updateUser({
      password: pwForm.password,
    });
    setPwSaving(false);
    if (error) {
      setPwMsg(`Erreur: ${error.message}`);
      return;
    }
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
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-1">{profile?.email}</p>
      </div>

      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
          <Check className="w-4 h-4" /> Profil mis a jour
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-400" /> Informations
            personnelles
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
                onChange={(e) =>
                  setForm({ ...form, telephone: e.target.value })
                }
                className="input"
                placeholder="06 XX XX XX XX"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                value={profile?.email || ""}
                disabled
                className="input opacity-60"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}{" "}
              Enregistrer
            </button>
          </div>
        </div>

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
                onChange={(e) =>
                  setPwForm({ ...pwForm, password: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Confirmer</label>
              <input
                type="password"
                value={pwForm.confirm}
                onChange={(e) =>
                  setPwForm({ ...pwForm, confirm: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={handleChangePassword}
              disabled={pwSaving}
              className="btn-secondary"
            >
              {pwSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}{" "}
              Modifier le mot de passe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
