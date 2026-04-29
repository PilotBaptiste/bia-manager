"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { School, Plus, Edit, Trash2, Loader2, X, User, Users, Link2, Copy, RefreshCw, QrCode, Check } from "lucide-react";
import Link from "next/link";
import type { Etablissement } from "@/types";

const emptyForm = { nom: "", ville: "", adresse: "", code_postal: "", telephone: "", email: "", contact_prenom: "", contact_nom: "", actif: true };

function generateCode(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // pas de I/O/0/1 ambigus
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function EtablissementsPage() {
  const supabase = createClient();
  const [etabs, setEtabs] = useState<Etablissement[]>([]);
  const [isSA, setIsSA] = useState(false);
  const [isCoord, setIsCoord] = useState(false);
  const [isGerant, setIsGerant] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Etablissement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [codeModal, setCodeModal] = useState<Etablissement | null>(null);
  const [nbEleves, setNbEleves] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    let filteredEtabIds: string[] = [];
    if (user) {
      const { data: prof } = await supabase.from("profiles").select("roles, etablissement_ids, etablissement_id").eq("id", user.id).single();
      const sa = prof?.roles?.includes("superadmin") ?? false;
      const coord = (prof?.roles?.includes("coordinateur") ?? false) && !sa;
      const gerant = (prof?.roles?.includes("gerant") ?? false) && !sa;
      setIsSA(sa);
      setIsCoord(coord);
      setIsGerant(gerant);
      // Coordinateurs et gérants voient uniquement leurs établissements
      if (coord || gerant) {
        filteredEtabIds = prof?.etablissement_ids?.length > 0
          ? prof.etablissement_ids
          : prof?.etablissement_id ? [prof.etablissement_id] : [];
      }
    }
    const query = filteredEtabIds.length > 0
      ? supabase.from("etablissements").select("*").in("id", filteredEtabIds).order("nom")
      : supabase.from("etablissements").select("*").order("nom");
    const { data } = await query;
    setEtabs(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(e: Etablissement) {
    setEditing(e);
    setForm({
      nom: e.nom,
      ville: e.ville || "",
      adresse: e.adresse || "",
      code_postal: e.code_postal || "",
      telephone: e.telephone || "",
      email: e.email || "",
      contact_prenom: e.contact_prenom || "",
      contact_nom: e.contact_nom || "",
      actif: e.actif,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    if (editing) {
      await supabase.from("etablissements").update(form).eq("id", editing.id);
      toast.success("Établissement mis à jour");
    } else {
      await supabase.from("etablissements").insert(form);
      toast.success("Établissement créé");
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function handleGenerateCode(etab: Etablissement) {
    setSavingCode(true);
    const code = generateCode(8);
    const nb = parseInt(nbEleves) || null;
    await supabase.from("etablissements").update({
      code_inscription: code,
      nb_eleves_attendus: nb,
    }).eq("id", etab.id);
    setSavingCode(false);
    toast.success(`Code généré : ${code}`);
    setCodeModal(null);
    load();
  }

  async function handleSaveLimit(etab: Etablissement) {
    setSavingCode(true);
    const nb = parseInt(nbEleves) || null;
    await supabase.from("etablissements").update({ nb_eleves_attendus: nb }).eq("id", etab.id);
    setSavingCode(false);
    toast.success("Limite mise à jour");
    setCodeModal(null);
    load();
  }

  function copyLink(code: string, id: string) {
    const url = `${window.location.origin}/inscription/${code}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/delete-etablissement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Impossible de supprimer cet établissement.");
      setConfirmDelete(null);
      return;
    }
    toast.success("Établissement supprimé");
    setConfirmDelete(null);
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Établissements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{etabs.length} établissement{etabs.length > 1 ? "s" : ""}</p>
        </div>
        {isSA && <button onClick={openCreate} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Ajouter</button>}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editing ? "Modifier" : "Nouvel établissement"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">Nom *</label>
                <input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className="input" placeholder="Lycée..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Ville</label><input value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })} className="input" /></div>
                <div><label className="label">Code postal</label><input value={form.code_postal} onChange={(e) => setForm({ ...form, code_postal: e.target.value })} className="input" /></div>
              </div>
              <div><label className="label">Adresse</label><input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} className="input" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Téléphone</label><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} className="input" /></div>
                <div><label className="label">Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" type="email" /></div>
              </div>
              {/* Contact person */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Responsable de l&apos;établissement</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Prénom</label><input value={form.contact_prenom} onChange={(e) => setForm({ ...form, contact_prenom: e.target.value })} className="input" placeholder="Jean" /></div>
                  <div><label className="label">Nom</label><input value={form.contact_nom} onChange={(e) => setForm({ ...form, contact_nom: e.target.value })} className="input" placeholder="Dupont" /></div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">Statut</p>
                  <p className="text-xs text-gray-500">{form.actif ? "Visible et sélectionnable" : "Masqué dans les listes"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, actif: !form.actif })}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.actif ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.actif ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleSave} disabled={saving || !form.nom.trim()} className="btn-primary btn-sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {editing ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code modal */}
      {codeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCodeModal(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-brand-500" /> Lien d'inscription
              </h3>
              <button onClick={() => setCodeModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4"><strong>{codeModal.nom}</strong></p>

            {codeModal.code_inscription ? (
              <>
                <div className="bg-gray-50 rounded-xl p-4 text-center mb-4">
                  <p className="text-xs text-gray-400 mb-1">Code d'inscription</p>
                  <p className="text-3xl font-mono font-bold tracking-widest text-gray-900">
                    {codeModal.code_inscription}
                  </p>
                </div>
                <button
                  onClick={() => copyLink(codeModal.code_inscription, codeModal.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 mb-3"
                >
                  {copiedId === codeModal.id ? <><Check className="w-4 h-4 text-emerald-500" /> Lien copié !</> : <><Copy className="w-4 h-4" /> Copier le lien d'inscription</>}
                </button>
                <p className="text-xs text-gray-400 mb-4 break-all text-center">
                  {typeof window !== "undefined" ? `${window.location.origin}/inscription/${codeModal.code_inscription}` : ""}
                </p>
              </>
            ) : (
              <div className="bg-amber-50 rounded-xl p-3 mb-4 text-sm text-amber-700">
                Aucun code généré — cliquez sur "Générer" pour créer le lien d'inscription.
              </div>
            )}

            <div className="mb-4">
              <label className="label">Nombre max d'élèves <span className="font-normal text-gray-400">(0 = illimité)</span></label>
              <input
                type="number"
                min="0"
                value={nbEleves}
                onChange={(e) => setNbEleves(e.target.value)}
                placeholder={String(codeModal.nb_eleves_attendus || "0")}
                className="input"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {/* SA et gérant peuvent générer/régénérer un code */}
              {(isSA || isGerant) && (
                <button
                  onClick={() => handleGenerateCode(codeModal)}
                  disabled={savingCode}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 disabled:opacity-60"
                >
                  {savingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  {codeModal.code_inscription ? "Régénérer" : "Générer le code"}
                </button>
              )}
              {codeModal.code_inscription && (
                <button
                  onClick={() => handleSaveLimit(codeModal)}
                  disabled={savingCode}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Enregistrer la limite
                </button>
              )}
              {/* Supprimer le code (désactive les inscriptions) */}
              {(isSA || isGerant) && codeModal.code_inscription && (
                <button
                  onClick={async () => {
                    setSavingCode(true);
                    await supabase.from("etablissements").update({ code_inscription: null }).eq("id", codeModal.id);
                    setSavingCode(false);
                    toast.success("Code supprimé — les inscriptions sont désactivées");
                    setCodeModal(null);
                    load();
                  }}
                  disabled={savingCode}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60 mt-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer le code
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">Supprimer l&apos;établissement ?</h3>
            <p className="text-sm text-gray-500 mb-5">Cette action est irréversible. Si des élèves ou pilotes sont liés à cet établissement, la suppression échouera — passez-le en <strong>Inactif</strong> à la place.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger btn-sm">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {etabs.map((e) => (
          <div key={e.id} className="card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
                  <School className="w-4 h-4 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{e.nom}</p>
                  <p className="text-xs text-gray-500">{e.ville || "—"}</p>
                </div>
              </div>
              <span className={`badge ${e.actif ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                {e.actif ? "Actif" : "Inactif"}
              </span>
            </div>
            {(e.contact_prenom || e.contact_nom) && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                <User className="w-3 h-3 text-gray-400" />
                {e.contact_prenom} {e.contact_nom}
              </div>
            )}
            {e.email && <p className="text-xs text-gray-500 mb-1">{e.email}</p>}
            {e.telephone && <p className="text-xs text-gray-500">{e.telephone}</p>}

            {/* Code inscription — SA et gérant peuvent générer ; coordinateurs peuvent voir */}
            {(isSA || isGerant || e.code_inscription) && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                {e.code_inscription ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Code inscription</p>
                      <p className="font-mono font-bold text-sm text-gray-900 tracking-widest">{e.code_inscription}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => copyLink(e.code_inscription!, e.id)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Copier le lien d'inscription"
                      >
                        {copiedId === e.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => { setCodeModal(e); setNbEleves(String(e.nb_eleves_attendus || "")); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Gérer le code"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Pas encore de code — SA et gérant peuvent en créer un */
                  <button
                    onClick={() => { setCodeModal(e); setNbEleves(""); }}
                    className="flex items-center gap-1.5 text-xs text-brand-500 font-semibold hover:underline"
                  >
                    <Link2 className="w-3 h-3" /> Générer un code d'inscription
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-gray-100 mt-3">
              {(isSA || isCoord || isGerant) && (
                <Link href={`/dashboard/eleves?etablissement=${e.id}`} className="btn-secondary btn-sm flex-1"><Users className="w-3 h-3" /> Élèves</Link>
              )}
              {isSA && <button onClick={() => openEdit(e)} className="btn-secondary btn-sm flex-1"><Edit className="w-3 h-3" /> Modifier</button>}
              {isSA && <button onClick={() => setConfirmDelete(e.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
