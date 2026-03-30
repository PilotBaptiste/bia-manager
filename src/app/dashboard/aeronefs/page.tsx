"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings, Plus, Edit, Loader2, X, History, ChevronDown, ChevronUp } from "lucide-react";
import type { Aeronef, PrixHeureLigne } from "@/types";

export default function AeronefsPage() {
  const supabase = createClient();
  const [aeronefs, setAeronefs] = useState<Aeronef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Aeronef | null>(null);
  const [form, setForm] = useState({ immatriculation: "", type_aeronef: "", nb_places_eleves: "2", prix_heure: "", note_changement: "", actif: true });
  const [saving, setSaving] = useState(false);
  const [expandedHistorique, setExpandedHistorique] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("aeronefs").select("*").order("immatriculation");
    setAeronefs(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ immatriculation: "", type_aeronef: "", nb_places_eleves: "2", prix_heure: "", note_changement: "", actif: true });
    setShowForm(true);
  }
  function openEdit(a: Aeronef) {
    setEditing(a);
    setForm({ immatriculation: a.immatriculation, type_aeronef: a.type_aeronef, nb_places_eleves: String(a.nb_places_eleves), prix_heure: String(a.prix_heure), note_changement: "", actif: a.actif });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.immatriculation.trim() || !form.type_aeronef.trim() || !form.prix_heure) return;
    setSaving(true);
    const newPrix = parseFloat(form.prix_heure);
    const payload: any = {
      immatriculation: form.immatriculation.trim(),
      type_aeronef: form.type_aeronef.trim(),
      nb_places_eleves: parseInt(form.nb_places_eleves),
      prix_heure: newPrix,
      actif: form.actif,
    };

    if (editing) {
      // Si le prix a changé, archiver l'ancien dans l'historique
      if (newPrix !== editing.prix_heure) {
        const existingHistory: PrixHeureLigne[] = editing.prix_heure_historique || [];
        const newEntry: PrixHeureLigne = {
          prix: editing.prix_heure,
          date: new Date().toISOString().split("T")[0],
          ...(form.note_changement.trim() ? { note: form.note_changement.trim() } : {}),
        };
        payload.prix_heure_historique = [newEntry, ...existingHistory];
      }
      await supabase.from("aeronefs").update(payload).eq("id", editing.id);
    } else {
      payload.prix_heure_historique = [];
      await supabase.from("aeronefs").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    load();
  }

  const priceChanged = editing && parseFloat(form.prix_heure) !== editing.prix_heure;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Aéronefs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gestion de la flotte et tarification</p>
        </div>
        <button onClick={openCreate} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editing ? "Modifier" : "Nouvel aéronef"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div><label className="label">Immatriculation *</label><input value={form.immatriculation} onChange={(e) => setForm({ ...form, immatriculation: e.target.value.toUpperCase() })} className="input" placeholder="F-GXYZ" /></div>
              <div><label className="label">Type *</label><input value={form.type_aeronef} onChange={(e) => setForm({ ...form, type_aeronef: e.target.value })} className="input" placeholder="DR400, PA28, C172..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Places élèves</label><input type="number" value={form.nb_places_eleves} onChange={(e) => setForm({ ...form, nb_places_eleves: e.target.value })} className="input" min="1" max="10" /></div>
                <div><label className="label">Prix / heure (€) *</label><input type="number" value={form.prix_heure} onChange={(e) => setForm({ ...form, prix_heure: e.target.value })} className="input" placeholder="160" step="0.01" /></div>
              </div>

              {/* Note de changement — visible uniquement si le prix est modifié */}
              {priceChanged && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700">
                    Prix modifié : {editing.prix_heure}€/h → {form.prix_heure}€/h
                  </p>
                  <p className="text-xs text-amber-600">L'ancien tarif sera conservé dans l'historique. Les vols déjà clôturés ne changeront pas de prix.</p>
                  <div>
                    <label className="label">Note (optionnel)</label>
                    <input
                      className="input"
                      value={form.note_changement}
                      onChange={(e) => setForm({ ...form, note_changement: e.target.value })}
                      placeholder="Ex : Révision tarifaire 2026"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-700">Statut</p>
                  <p className="text-xs text-gray-500">{form.actif ? "Disponible pour les créneaux" : "Retiré de la flotte active"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, actif: !form.actif })}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.actif ? "bg-emerald-500" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.actif ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Historique des prix dans le modal */}
              {editing && (editing.prix_heure_historique?.length ?? 0) > 0 && (
                <div className="border border-gray-200 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-500 flex items-center gap-1"><History className="w-3 h-3" /> Historique des tarifs</p>
                  {editing.prix_heure_historique!.map((h, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-gray-600">
                      <span className="font-medium">{h.prix}€/h</span>
                      <span className="text-gray-400">{new Date(h.date).toLocaleDateString("fr-FR")}{h.note ? ` — ${h.note}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {editing ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {aeronefs.map((a) => {
          const hasHistory = (a.prix_heure_historique?.length ?? 0) > 0;
          const isExpanded = expandedHistorique === a.id;
          return (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-lg font-bold text-gray-900">{a.immatriculation}</p>
                  <p className="text-sm text-gray-500">{a.type_aeronef}</p>
                </div>
                <span className={`badge ${a.actif ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {a.actif ? "Actif" : "Inactif"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-t border-gray-100 text-sm">
                <span className="text-gray-500">Places élèves</span>
                <span className="font-semibold">{a.nb_places_eleves}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-gray-100 text-sm">
                <span className="text-gray-500">Prix / heure</span>
                <span className="text-lg font-bold text-brand-500">{a.prix_heure}€/h</span>
              </div>

              {/* Historique dépliable */}
              {hasHistory && (
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setExpandedHistorique(isExpanded ? null : a.id)}
                    className="w-full flex items-center justify-between py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <span className="flex items-center gap-1"><History className="w-3 h-3" /> {a.prix_heure_historique!.length} tarif{a.prix_heure_historique!.length > 1 ? "s" : ""} précédent{a.prix_heure_historique!.length > 1 ? "s" : ""}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {isExpanded && (
                    <div className="pb-2 space-y-1">
                      {a.prix_heure_historique!.map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-gray-500 px-1">
                          <span className="font-medium">{h.prix}€/h</span>
                          <span className="text-gray-400">{new Date(h.date).toLocaleDateString("fr-FR")}{h.note ? ` — ${h.note}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 mt-2 border-t border-gray-100">
                <button onClick={() => openEdit(a)} className="btn-secondary btn-sm w-full"><Edit className="w-3 h-3" /> Modifier</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
