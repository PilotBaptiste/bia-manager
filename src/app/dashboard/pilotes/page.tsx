"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserCheck, Loader2, Plane, Edit, X, Save, School } from "lucide-react";

export default function PilotesPage() {
  const supabase = createClient();
  const [pilotes, setPilotes] = useState<any[]>([]);
  const [aeronefs, setAeronefs] = useState<any[]>([]);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [qualifs, setQualifs] = useState<any[]>([]);
  const [piloteEtabs, setPiloteEtabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [pR, aR, qR, eR, peR] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .contains("roles", ["pilote"])
        .eq("actif", true)
        .order("nom"),
      supabase.from("aeronefs").select("*").eq("actif", true),
      supabase
        .from("pilote_qualifications")
        .select("*, aeronef:aeronefs(type_aeronef, immatriculation)"),
      supabase
        .from("etablissements")
        .select("*")
        .eq("actif", true)
        .order("nom"),
      supabase.from("pilote_etablissements").select("*"),
    ]);
    setPilotes(pR.data || []);
    setAeronefs(aR.data || []);
    setQualifs(qR.data || []);
    setEtabs(eR.data || []);
    setPiloteEtabs(peR.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function hasQualif(piloteId: string, aeronefId: string) {
    return qualifs.some(
      (q) => q.pilote_id === piloteId && q.aeronef_id === aeronefId,
    );
  }
  function hasEtab(piloteId: string, etabId: string) {
    return piloteEtabs.some(
      (pe) => pe.pilote_id === piloteId && pe.etablissement_id === etabId,
    );
  }
  function getPiloteEtabs(piloteId: string) {
    return piloteEtabs.filter((pe) => pe.pilote_id === piloteId);
  }

  async function toggleQualif(piloteId: string, aeronefId: string) {
    setSaving(true);
    const existing = qualifs.find(
      (q) => q.pilote_id === piloteId && q.aeronef_id === aeronefId,
    );
    if (existing)
      await supabase
        .from("pilote_qualifications")
        .delete()
        .eq("id", existing.id);
    else
      await supabase
        .from("pilote_qualifications")
        .insert({ pilote_id: piloteId, aeronef_id: aeronefId });
    setSaving(false);
    load();
  }

  async function toggleEtab(piloteId: string, etabId: string) {
    setSaving(true);
    const existing = piloteEtabs.find(
      (pe) => pe.pilote_id === piloteId && pe.etablissement_id === etabId,
    );
    if (existing)
      await supabase
        .from("pilote_etablissements")
        .delete()
        .eq("id", existing.id);
    else
      await supabase
        .from("pilote_etablissements")
        .insert({ pilote_id: piloteId, etablissement_id: etabId });
    setSaving(false);
    load();
  }

  async function handleSaveProfile() {
    if (!editing) return;
    setError(null);
    setSaving(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({
        nom: editing.nom,
        prenom: editing.prenom,
        telephone: editing.telephone,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(null);
    load();
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );

  return (
    <div>
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                Editer le pilote
              </h3>
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Prenom</label>
                <input
                  value={editing.prenom}
                  onChange={(e) =>
                    setEditing({ ...editing, prenom: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Nom</label>
                <input
                  value={editing.nom}
                  onChange={(e) =>
                    setEditing({ ...editing, nom: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  value={editing.email}
                  disabled
                  className="input opacity-60"
                />
              </div>
              <div>
                <label className="label">Telephone</label>
                <input
                  value={editing.telephone || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, telephone: e.target.value })
                  }
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => setEditing(null)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveProfile}
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
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Pilotes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {pilotes.length} pilote{pilotes.length > 1 ? "s" : ""} · Machines et
          etablissements
        </p>
      </div>

      {pilotes.length === 0 ? (
        <div className="card text-center py-12">
          <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun pilote.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pilotes.map((p) => {
            const pEtabs = getPiloteEtabs(p.id);
            return (
              <div key={p.id} className="card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {p.prenom} {p.nom}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.email} · {p.telephone || "—"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditing({ ...p });
                      setError(null);
                    }}
                    className="btn-secondary btn-sm"
                  >
                    <Edit className="w-3 h-3" /> Editer
                  </button>
                </div>

                {/* Machines */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Plane className="w-3.5 h-3.5" /> Machines autorisees
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aeronefs.map((a) => {
                      const ok = hasQualif(p.id, a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => toggleQualif(p.id, a.id)}
                          disabled={saving}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${ok ? "border-brand-400 bg-brand-50 text-brand-500" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}
                        >
                          <Plane className="w-3 h-3" /> {a.type_aeronef} (
                          {a.immatriculation}){" "}
                          {ok && <span className="text-emerald-500">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Etablissements */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <School className="w-3.5 h-3.5" /> Etablissements assignes (
                    {pEtabs.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {etabs.map((et) => {
                      const ok = hasEtab(p.id, et.id);
                      return (
                        <button
                          key={et.id}
                          onClick={() => toggleEtab(p.id, et.id)}
                          disabled={saving}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${ok ? "border-emerald-400 bg-emerald-50 text-emerald-600" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}
                        >
                          <School className="w-3 h-3" /> {et.nom}{" "}
                          {ok && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  {pEtabs.length === 0 && (
                    <p className="text-xs text-amber-500 mt-1">
                      Aucun etablissement assigne — le pilote ne pourra pas
                      creer de creneaux.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
