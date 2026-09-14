"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Settings, Plus, Edit, Loader2, X, History, ChevronDown, ChevronUp, Euro, AlertTriangle } from "lucide-react";
import type { Aeronef } from "@/types";

type Tarif = { id: string; aeronef_id: string; prix_heure: number; date_effet: string; note: string | null; created_at: string };
type Impact = { source: "cloture" | "manuel"; id: string; date: string | null; temps: number; avant: number | null; apres: number; eleves: string | null };
type Simulation = { impacts: Impact[]; nb_vols: number; total_avant: number; total_apres: number; sans_date_disponibles: number; fin_periode: string | null };

const todayParis = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR");
const fmtEur = (n: number | null | undefined) => (n == null ? "—" : `${Number(n).toFixed(2).replace(".", ",")} €`);

export default function AeronefsPage() {
  const supabase = createClient();
  const [aeronefs, setAeronefs] = useState<Aeronef[]>([]);
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Aeronef | null>(null);
  const [form, setForm] = useState({ immatriculation: "", type_aeronef: "", nb_places_eleves: "2", prix_heure: "", actif: true });
  const [saving, setSaving] = useState(false);
  const [expandedHistorique, setExpandedHistorique] = useState<string | null>(null);

  const [tarifFor, setTarifFor] = useState<Aeronef | null>(null);
  // null = new tariff; a Tarif = editing that existing tariff
  const [tarifEdit, setTarifEdit] = useState<Tarif | null>(null);
  const [deleteMode, setDeleteMode] = useState(false);
  const [tarifForm, setTarifForm] = useState({ prix_heure: "", date_effet: todayParis(), note: "", inclure_sans_date: false });
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [applying, setApplying] = useState(false);

  async function load() {
    const [aR, tR] = await Promise.all([
      supabase.from("aeronefs").select("*").order("immatriculation"),
      supabase.from("aeronef_tarifs").select("*").order("date_effet", { ascending: false }),
    ]);
    if (aR.error) toast.error(`Chargement des aéronefs impossible : ${aR.error.message}`);
    if (tR.error) toast.error(`Chargement des tarifs impossible : ${tR.error.message}`);
    setAeronefs(aR.data || []);
    setTarifs(tR.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const tarifsOf = (id: string) => tarifs.filter((t) => t.aeronef_id === id);

  function openCreate() {
    setEditing(null);
    setForm({ immatriculation: "", type_aeronef: "", nb_places_eleves: "2", prix_heure: "", actif: true });
    setShowForm(true);
  }
  function openEdit(a: Aeronef) {
    setEditing(a);
    setForm({ immatriculation: a.immatriculation, type_aeronef: a.type_aeronef, nb_places_eleves: String(a.nb_places_eleves), prix_heure: String(a.prix_heure), actif: a.actif });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.immatriculation.trim() || !form.type_aeronef.trim() || (!editing && !form.prix_heure)) {
      toast.error("Immatriculation, type et prix / heure sont obligatoires");
      return;
    }
    const nbPlaces = parseInt(form.nb_places_eleves, 10);
    if (!Number.isInteger(nbPlaces) || nbPlaces < 1) {
      toast.error("Le nombre de places élèves doit être un entier supérieur ou égal à 1");
      return;
    }
    const payload: any = {
      immatriculation: form.immatriculation.trim(),
      type_aeronef: form.type_aeronef.trim(),
      nb_places_eleves: nbPlaces,
      actif: form.actif,
    };
    if (!editing) {
      const prix = parseFloat(form.prix_heure);
      if (!Number.isFinite(prix) || prix < 0) {
        toast.error("Le prix / heure doit être un nombre valide");
        return;
      }
      payload.prix_heure = prix;
      payload.prix_heure_historique = [];
    }
    setSaving(true);
    const { error } = editing
      ? await supabase.from("aeronefs").update(payload).eq("id", editing.id)
      : await supabase.from("aeronefs").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(`Erreur lors de l'enregistrement : ${error.message}`);
      return;
    }
    toast.success(editing ? "Aéronef mis à jour" : "Aéronef créé");
    setShowForm(false);
    load();
  }

  function openTarif(a: Aeronef, existing: Tarif | null = null) {
    setShowForm(false);
    setTarifFor(a);
    setTarifEdit(existing);
    setDeleteMode(false);
    setTarifForm(existing
      ? { prix_heure: String(existing.prix_heure), date_effet: existing.date_effet, note: existing.note || "", inclure_sans_date: false }
      : { prix_heure: String(a.prix_heure), date_effet: todayParis(), note: "", inclure_sans_date: false });
    setSimulation(null);
  }

  const isInitialTarif = (t: Tarif | null) =>
    !!t && !tarifs.some((x) => x.aeronef_id === t.aeronef_id && x.date_effet < t.date_effet);

  function closeTarif() {
    setTarifFor(null);
    setTarifEdit(null);
    setDeleteMode(false);
    setSimulation(null);
  }

  function updateTarifForm(patch: Partial<typeof tarifForm>) {
    setTarifForm((f) => ({ ...f, ...patch }));
    setSimulation(null);
  }

  function callTarifRpc(simulate: boolean, inclureSansDate = tarifForm.inclure_sans_date, supprimer = deleteMode) {
    const common = { p_inclure_sans_date: inclureSansDate, p_simulation: simulate };
    const values = {
      p_prix_heure: parseFloat(tarifForm.prix_heure.replace(",", ".")),
      p_date_effet: tarifForm.date_effet,
      p_note: tarifForm.note.trim() || null,
    };
    if (tarifEdit && supprimer) return supabase.rpc("supprimer_tarif_aeronef", { p_tarif_id: tarifEdit.id, ...common });
    if (tarifEdit) return supabase.rpc("modifier_tarif_aeronef", { p_tarif_id: tarifEdit.id, ...values, ...common });
    return supabase.rpc("changer_tarif_aeronef", { p_aeronef_id: tarifFor!.id, ...values, ...common });
  }

  function tarifFormError(): string | null {
    const prix = parseFloat(tarifForm.prix_heure.replace(",", "."));
    if (!Number.isFinite(prix) || prix < 0) return "Le prix / heure doit être un nombre valide";
    if (!tarifForm.date_effet) return "La date d'effet est obligatoire";
    return null;
  }

  async function handleSimulate(inclureSansDate = tarifForm.inclure_sans_date, supprimer = deleteMode) {
    const err = supprimer ? null : tarifFormError();
    if (err) { toast.error(err); return; }
    setSimulating(true);
    const { data, error } = await callTarifRpc(true, inclureSansDate, supprimer);
    setSimulating(false);
    if (error) { toast.error(error.message); return; }
    setSimulation(data as Simulation);
  }

  async function handleApply() {
    const err = deleteMode ? null : tarifFormError();
    if (err || !simulation) { toast.error(err || "Vérifiez d'abord l'impact"); return; }
    setApplying(true);
    const { data, error } = await callTarifRpc(false);
    setApplying(false);
    if (error) { toast.error(error.message); return; }
    const res = data as Simulation;
    const delta = res.total_apres - res.total_avant;
    const action = deleteMode ? "Tarif supprimé" : tarifEdit ? "Tarif modifié" : "Tarif enregistré";
    toast.success(
      res.nb_vols > 0
        ? `${action} · ${res.nb_vols} vol${res.nb_vols > 1 ? "s" : ""} recalculé${res.nb_vols > 1 ? "s" : ""} (${delta >= 0 ? "+" : ""}${fmtEur(delta)})`
        : `${action} · aucun vol à recalculer`,
    );
    closeTarif();
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  }

  const delta = simulation ? simulation.total_apres - simulation.total_avant : 0;
  const isBackdated = tarifForm.date_effet < todayParis();

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
                {editing ? (
                  <div>
                    <label className="label">Prix / heure</label>
                    <div className="flex items-center justify-between h-[38px]">
                      <span className="text-sm font-semibold text-gray-900">{editing.prix_heure}€/h</span>
                      <button type="button" onClick={() => openTarif(editing)} className="text-xs font-semibold text-brand-500 hover:text-brand-700">Changer le tarif</button>
                    </div>
                  </div>
                ) : (
                  <div><label className="label">Prix / heure (€) *</label><input type="number" value={form.prix_heure} onChange={(e) => setForm({ ...form, prix_heure: e.target.value })} className="input" placeholder="160" step="0.01" /></div>
                )}
              </div>

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

      {tarifFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !applying && closeTarif()}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-gray-900">
                {deleteMode ? "Supprimer le tarif" : tarifEdit ? "Modifier le tarif" : "Changer le tarif"} — {tarifFor.immatriculation}
              </h3>
              <button onClick={closeTarif} disabled={applying} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              {deleteMode
                ? `Le tarif de ${tarifEdit?.prix_heure}€/h du ${tarifEdit ? fmtDate(tarifEdit.date_effet) : ""} sera supprimé : les vols de sa période reprennent le tarif précédent.`
                : tarifEdit
                  ? "Changer le prix ou la date d'effet recalcule les vols concernés, et les finances se mettent à jour."
                  : <>Tarif actuel : <strong className="text-gray-900">{tarifFor.prix_heure}€/h</strong>. Une date d&apos;effet passée recalcule les vols déjà enregistrés depuis cette date, et les finances se mettent à jour.</>}
            </p>

            {!deleteMode && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label">{tarifEdit ? "Prix / heure (€) *" : "Nouveau prix / heure (€) *"}</label>
                <input type="number" step="0.01" min="0" className="input" value={tarifForm.prix_heure} onChange={(e) => updateTarifForm({ prix_heure: e.target.value })} />
              </div>
              <div>
                <label className="label">Date d&apos;effet *</label>
                {isInitialTarif(tarifEdit) ? (
                  <p className="text-sm text-gray-500 h-[38px] flex items-center">Tarif initial</p>
                ) : (
                  <input type="date" className="input" value={tarifForm.date_effet} onChange={(e) => updateTarifForm({ date_effet: e.target.value })} />
                )}
              </div>
              <div>
                <label className="label">Note</label>
                <input className="input" value={tarifForm.note} onChange={(e) => updateTarifForm({ note: e.target.value })} placeholder="Révision tarifaire 2026" />
              </div>
            </div>
            )}
            {!deleteMode && !isInitialTarif(tarifEdit) && isBackdated && (
              <p className="text-xs text-amber-700 mt-2">Date antérieure à aujourd&apos;hui : les vols effectués depuis le {fmtDate(tarifForm.date_effet)} seront recalculés.</p>
            )}

            <div className={`flex justify-end mt-4 ${deleteMode ? "hidden" : ""}`}>
              <button onClick={() => handleSimulate()} disabled={simulating || applying} className="btn-secondary btn-sm">
                {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Euro className="w-3.5 h-3.5" />} Voir l&apos;impact
              </button>
            </div>

            {simulation && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-[11px] text-gray-500">Vols recalculés</p>
                    <p className="text-lg font-bold text-gray-900">{simulation.nb_vols}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                    <p className="text-[11px] text-gray-500">Coût avant → après</p>
                    <p className="text-sm font-bold text-gray-900">{fmtEur(simulation.total_avant)} → {fmtEur(simulation.total_apres)}</p>
                  </div>
                  <div className={`p-3 rounded-lg border ${delta > 0 ? "bg-red-50 border-red-200" : delta < 0 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
                    <p className="text-[11px] text-gray-500">Écart sur les dépenses</p>
                    <p className={`text-lg font-bold ${delta > 0 ? "text-red-600" : delta < 0 ? "text-emerald-600" : "text-gray-900"}`}>{delta > 0 ? "+" : ""}{fmtEur(delta)}</p>
                  </div>
                </div>

                {simulation.fin_periode && (
                  <p className="text-xs text-gray-500">
                    Un tarif suivant existe à partir du {fmtDate(simulation.fin_periode)} : les vols après cette date gardent ce tarif-là.
                  </p>
                )}

                {(simulation.sans_date_disponibles > 0 || tarifForm.inclure_sans_date) && (
                  <label className="flex items-start gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800 cursor-pointer">
                    <input type="checkbox" className="mt-0.5" checked={tarifForm.inclure_sans_date} disabled={simulating} onChange={(e) => { const checked = e.target.checked; setTarifForm((f) => ({ ...f, inclure_sans_date: checked })); handleSimulate(checked); }} />
                    <span>
                      Inclure aussi les vols saisis à la main sur les fiches élèves ({simulation.sans_date_disponibles}).
                      <span className="block text-xs text-amber-700">Ces vols n&apos;ont pas de date : ils sont pris en compte pour les années scolaires qui couvrent la période du nouveau tarif. L&apos;aperçu se met à jour automatiquement.</span>
                    </span>
                  </label>
                )}

                {simulation.impacts.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-auto max-h-[280px]">
                    <table className="w-full text-sm min-w-[520px]">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          {["Date", "Élèves", "Temps", "Avant", "Après"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-gray-400">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {simulation.impacts.map((i) => (
                          <tr key={i.id} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{i.date ? fmtDate(i.date) : <span className="text-amber-600">Sans date</span>}</td>
                            <td className="px-3 py-2 text-gray-900">{i.eleves || "—"}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{i.temps} min</td>
                            <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fmtEur(i.avant)}</td>
                            <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{fmtEur(i.apres)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Aucun vol déjà enregistré n&apos;est concerné : seul le tarif sera enregistré.</p>
                )}

                {simulation.impacts.some((i) => i.source === "cloture") && (
                  <p className="flex items-start gap-1.5 text-xs text-gray-500">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                    Le prix de chaque vol est recalculé à partir de son temps de vol : un ajustement manuel du prix fait à la clôture sera remplacé.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-between gap-2 mt-5 pt-4 border-t border-gray-100">
              <div>
                {tarifEdit && !isInitialTarif(tarifEdit) && (
                  deleteMode ? (
                    <button onClick={() => { setDeleteMode(false); setSimulation(null); }} disabled={applying} className="btn-secondary btn-sm">Revenir à la modification</button>
                  ) : (
                    <button onClick={() => { setDeleteMode(true); setSimulation(null); handleSimulate(tarifForm.inclure_sans_date, true); }} disabled={applying || simulating} className="btn-sm border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-3 py-1.5 text-xs font-semibold">
                      Supprimer ce tarif
                    </button>
                  )
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={closeTarif} disabled={applying} className="btn-secondary btn-sm">Annuler</button>
                <button onClick={handleApply} disabled={!simulation || applying || simulating} className={deleteMode ? "btn-sm bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50" : "btn-primary btn-sm"} title={!simulation ? "Vérifiez d'abord l'impact" : undefined}>
                  {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {deleteMode ? "Supprimer et recalculer" : tarifEdit ? "Enregistrer la modification" : "Appliquer le nouveau tarif"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {aeronefs.map((a) => {
          const history = tarifsOf(a.id);
          const today = todayParis();
          const upcoming = history.filter((t) => t.date_effet > today);
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
              <div className="flex justify-between items-center py-2 border-t border-gray-100 text-sm">
                <span className="text-gray-500">Prix / heure</span>
                <span className="text-lg font-bold text-brand-500">{a.prix_heure}€/h</span>
              </div>
              {upcoming.length > 0 && (
                <p className="text-xs text-brand-500 pb-2">
                  Prévu : {upcoming[upcoming.length - 1].prix_heure}€/h à partir du {fmtDate(upcoming[upcoming.length - 1].date_effet)}
                </p>
              )}

              {history.length > 0 && (
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => setExpandedHistorique(isExpanded ? null : a.id)}
                    className="w-full flex items-center justify-between py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <span className="flex items-center gap-1"><History className="w-3 h-3" /> Historique des tarifs ({history.length})</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {isExpanded && (
                    <div className="pb-2 space-y-1">
                      {history.map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-2 text-xs text-gray-500 px-1 group">
                          <span className="font-medium">{t.prix_heure}€/h</span>
                          <span className="flex items-center gap-2 text-gray-400 text-right">
                            <span>
                              {isInitialTarif(t) ? "Tarif initial" : `depuis le ${fmtDate(t.date_effet)}`}
                              {t.note && !isInitialTarif(t) ? ` — ${t.note}` : ""}
                            </span>
                            <button onClick={() => openTarif(a, t)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-brand-500" title="Modifier ce tarif" aria-label={`Modifier le tarif ${t.prix_heure}€/h`}>
                              <Edit className="w-3 h-3" />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 mt-2 border-t border-gray-100 grid grid-cols-2 gap-2">
                <button onClick={() => openEdit(a)} className="btn-secondary btn-sm"><Edit className="w-3 h-3" /> Modifier</button>
                <button onClick={() => openTarif(a)} className="btn-secondary btn-sm"><Euro className="w-3 h-3" /> Changer le tarif</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
