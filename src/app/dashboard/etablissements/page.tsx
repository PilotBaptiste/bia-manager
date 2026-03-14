"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { School, Plus, Edit, Trash2, Loader2, X, User } from "lucide-react";
import type { Etablissement } from "@/types";

const emptyForm = { nom: "", ville: "", adresse: "", code_postal: "", telephone: "", email: "", contact_prenom: "", contact_nom: "", actif: true };

export default function EtablissementsPage() {
  const supabase = createClient();
  const [etabs, setEtabs] = useState<Etablissement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Etablissement | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from("etablissements").select("*").order("nom");
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

  async function handleDelete(id: string) {
    const { error } = await supabase.from("etablissements").delete().eq("id", id);
    if (error) {
      toast.error("Impossible de supprimer : des élèves ou pilotes sont liés à cet établissement. Passez-le en Inactif à la place.");
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
        <button onClick={openCreate} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
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
            {e.telephone && <p className="text-xs text-gray-500 mb-3">{e.telephone}</p>}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => openEdit(e)} className="btn-secondary btn-sm flex-1"><Edit className="w-3 h-3" /> Modifier</button>
              <button onClick={() => setConfirmDelete(e.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
