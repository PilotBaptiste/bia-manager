"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plane, Loader2, Plus, Trash2, Eye, EyeOff, CheckCircle2, AlertCircle, User } from "lucide-react";

const CLASSES = ["2nde", "1ère", "Terminale", "BTS", "Autre"];

const emptyEnfant = { nom: "", prenom: "", date_naissance: "", lieu_naissance: "", classe: "" };

export default function InscriptionCodePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [etabInfo, setEtabInfo] = useState<{ nom: string; ville: string; isFull: boolean; inscritCount: number; limit: number } | null>(null);
  const [loadingEtab, setLoadingEtab] = useState(true);
  const [etabError, setEtabError] = useState<string | null>(null);

  // Parent form
  const [parent, setParent] = useState({
    email: "", password: "", passwordConfirm: "",
    nom: "", prenom: "", telephone: "",
  });
  const [showPw, setShowPw] = useState(false);

  // Children
  const [enfants, setEnfants] = useState([{ ...emptyEnfant }]);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load etab info
  useEffect(() => {
    async function load() {
      if (!code) return;
      const res = await fetch(`/api/inscription?code=${encodeURIComponent(code.toUpperCase())}`);
      if (!res.ok) {
        const d = await res.json();
        setEtabError(d.error ?? "Code invalide");
      } else {
        const d = await res.json();
        // Aplatir la réponse : l'API retourne { etab: { nom, ville }, inscritCount, limit, isFull }
        setEtabInfo({
          nom: d.etab?.nom ?? d.nom ?? "",
          ville: d.etab?.ville ?? d.ville ?? "",
          inscritCount: d.inscritCount ?? 0,
          limit: d.limit ?? 0,
          isFull: d.isFull ?? false,
        });
      }
      setLoadingEtab(false);
    }
    load();
  }, [code]);

  function updateParent(field: string, value: string) {
    setParent((p) => ({ ...p, [field]: value }));
    setFormError(null);
  }

  function updateEnfant(idx: number, field: string, value: string) {
    setEnfants((prev) => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
    setFormError(null);
  }

  function addEnfant() {
    if (enfants.length >= 5) return;
    setEnfants((prev) => [...prev, { ...emptyEnfant }]);
  }

  function removeEnfant(idx: number) {
    if (enfants.length <= 1) return;
    setEnfants((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!parent.email.trim() || !parent.password || !parent.nom.trim() || !parent.prenom.trim()) {
      setFormError("Remplissez tous les champs obligatoires (parent).");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parent.email.trim())) {
      setFormError("Adresse email invalide.");
      return;
    }
    if (parent.password.length < 8) {
      setFormError("Mot de passe trop court (8 caractères minimum).");
      return;
    }
    if (parent.password !== parent.passwordConfirm) {
      setFormError("Les mots de passe ne correspondent pas.");
      return;
    }
    for (const [i, e] of enfants.entries()) {
      if (!e.nom.trim() || !e.prenom.trim()) {
        setFormError(`Prénom et nom obligatoires pour l'enfant ${i + 1}.`);
        return;
      }
      if (!e.date_naissance) {
        setFormError(`Date de naissance obligatoire pour l'enfant ${i + 1}.`);
        return;
      }
    }

    setSubmitting(true);
    const res = await fetch("/api/inscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: code.toUpperCase(),
        parent: {
          email: parent.email.trim().toLowerCase(),
          password: parent.password,
          nom: parent.nom.trim(),
          prenom: parent.prenom.trim(),
          telephone: parent.telephone.trim(),
        },
        enfants: enfants.map((e) => ({
          nom: e.nom.trim(),
          prenom: e.prenom.trim(),
          date_naissance: e.date_naissance,
          lieu_naissance: e.lieu_naissance.trim(),
          classe: e.classe,
        })),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error ?? "Une erreur est survenue.");
      setSubmitting(false);
      return;
    }

    setSuccess(true);
  }

  // Loading state
  if (loadingEtab) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  // Invalid code
  if (etabError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Code invalide</h2>
          <p className="text-gray-500 mb-6">{etabError}</p>
          <a href="/inscription" className="inline-block bg-blue-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-800 transition-colors">
            Réessayer
          </a>
        </div>
      </div>
    );
  }

  // Full
  if (etabInfo?.isFull) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Inscriptions complètes</h2>
          <p className="text-gray-500">
            Le quota d'inscriptions pour <strong>{etabInfo.nom}</strong> est atteint ({etabInfo.inscritCount}/{etabInfo.limit} élèves).
            Contactez l'établissement pour plus d'informations.
          </p>
        </div>
      </div>
    );
  }

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Inscription confirmée !</h2>
          <p className="text-gray-500 mb-2">
            Bienvenue {parent.prenom} ! Votre compte a été créé et un email de confirmation vous a été envoyé à <strong>{parent.email}</strong>.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Vous pouvez maintenant vous connecter pour signer l'attestation et réserver les vols.
          </p>
          <a
            href="/auth/connexion"
            className="inline-block bg-blue-900 text-white px-8 py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors"
          >
            Se connecter →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 py-10 px-4">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-none">BIA Manager</p>
            <p className="text-white/50 text-xs">Aéro-Club du Bassin d'Arcachon</p>
          </div>
        </div>

        {/* Etablissement banner */}
        <div className="bg-blue-900/50 border border-blue-700/40 rounded-2xl px-5 py-4 mb-6 text-center">
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Inscription pour</p>
          <p className="text-white font-bold text-lg">{etabInfo?.nom}</p>
          {etabInfo?.ville && <p className="text-white/60 text-sm">{etabInfo.ville}</p>}
          {(etabInfo?.limit ?? 0) > 0 && (
            <p className="text-white/50 text-xs mt-1">
              {etabInfo!.inscritCount} / {etabInfo!.limit} places utilisées
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── Parent section ── */}
          <div className="bg-white rounded-2xl p-6">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Vos coordonnées
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Prénom *</label>
                <input type="text" value={parent.prenom} onChange={(e) => updateParent("prenom", e.target.value)}
                  placeholder="Marie" className="input-field" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Nom *</label>
                <input type="text" value={parent.nom} onChange={(e) => updateParent("nom", e.target.value)}
                  placeholder="Dupont" className="input-field" required />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Email *</label>
              <input type="email" value={parent.email} onChange={(e) => updateParent("email", e.target.value)}
                placeholder="marie.dupont@email.com" className="input-field" required />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Téléphone</label>
              <input type="tel" value={parent.telephone} onChange={(e) => updateParent("telephone", e.target.value)}
                placeholder="06 12 34 56 78" className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Mot de passe * <span className="font-normal text-gray-400">(8 car. min)</span></label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={parent.password}
                    onChange={(e) => updateParent("password", e.target.value)}
                    className="input-field pr-10" required minLength={8} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Confirmer *</label>
                <input type={showPw ? "text" : "password"} value={parent.passwordConfirm}
                  onChange={(e) => updateParent("passwordConfirm", e.target.value)}
                  className={`input-field ${parent.passwordConfirm && parent.password !== parent.passwordConfirm ? "border-red-400" : ""}`}
                  required />
              </div>
            </div>
          </div>

          {/* ── Children section ── */}
          {enfants.map((enfant, idx) => (
            <div key={idx} className="bg-white rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <Plane className="w-4 h-4 text-blue-600" />
                  {enfants.length > 1 ? `Enfant ${idx + 1}` : "Votre enfant"}
                </h2>
                {enfants.length > 1 && (
                  <button type="button" onClick={() => removeEnfant(idx)}
                    className="text-red-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Prénom *</label>
                  <input type="text" value={enfant.prenom} onChange={(e) => updateEnfant(idx, "prenom", e.target.value)}
                    placeholder="Lucas" className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Nom *</label>
                  <input type="text" value={enfant.nom} onChange={(e) => updateEnfant(idx, "nom", e.target.value)}
                    placeholder="Dupont" className="input-field" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date de naissance *</label>
                  <input type="date" value={enfant.date_naissance}
                    onChange={(e) => updateEnfant(idx, "date_naissance", e.target.value)}
                    className="input-field" required />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Lieu de naissance</label>
                  <input type="text" value={enfant.lieu_naissance}
                    onChange={(e) => updateEnfant(idx, "lieu_naissance", e.target.value)}
                    placeholder="Bordeaux" className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Classe</label>
                <select value={enfant.classe} onChange={(e) => updateEnfant(idx, "classe", e.target.value)}
                  className="input-field">
                  <option value="">— Sélectionner —</option>
                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ))}

          {/* Add child */}
          {enfants.length < 5 && (
            <button type="button" onClick={addEnfant}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-white/30 text-white/70 hover:border-white/50 hover:text-white transition-colors text-sm font-semibold">
              <Plus className="w-4 h-4" /> Ajouter un autre enfant
            </button>
          )}

          {/* Error */}
          {formError && (
            <div className="flex items-start gap-2 p-4 bg-red-50 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 disabled:opacity-60 text-blue-900 font-bold py-4 rounded-2xl transition-colors text-base shadow-lg">
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Création du compte…</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Confirmer mon inscription</>
            )}
          </button>

          <p className="text-center text-white/40 text-xs pb-6">
            En vous inscrivant, vous acceptez que vos données soient utilisées dans le cadre du BIA.
            Déjà un compte ?{" "}
            <a href="/auth/connexion" className="text-white/70 hover:text-white underline">Se connecter</a>
          </p>
        </form>
      </div>
    </div>
  );
}
