"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { X, Loader2, Save, Search } from "lucide-react";

const supabase = createClient();
const todayParis = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });

/**
 * Saisie d'un vol déjà effectué, sans créneau ni réservation, et sans aucun email.
 * Les champs du vol sont écrits directement sur les fiches élèves : le vol apparaît
 * ensuite comme « manuel » dans l'historique, les finances et les statistiques.
 */
export default function SaisieDirecte({
  aeronefs,
  pilotes,
  eleves,
  onFermer,
  onEnregistre,
}: {
  aeronefs: any[];
  pilotes: any[];
  eleves: any[];
  onFermer: () => void;
  onEnregistre: () => void;
}) {
  const [form, setForm] = useState({
    date: todayParis(),
    aeronef_id: "",
    pilote_id: "",
    pilote_libre: "",
    temps: "",
    numero: "",
    prix_total: "",
  });
  const [tarif, setTarif] = useState<number | null>(null);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [typeParEleve, setTypeParEleve] = useState<Record<string, 1 | 2>>({});
  const [recherche, setRecherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Vol proposé par défaut pour un élève, d'après son avancement. */
  function volPropose(e: any): 1 | 2 | null {
    if (!(e.vol1_effectue || e.vol1_skippe)) return 1;
    if (e.vol2_autorise && !e.vol2_effectue && !e.vol2_refuse) return 2;
    return null;
  }

  const eligibles = useMemo(
    () =>
      eleves
        .filter((e) => !e.abandonne && volPropose(e) !== null)
        .filter((e) => {
          const q = recherche.trim().toLowerCase();
          return !q || `${e.prenom} ${e.nom}`.toLowerCase().includes(q);
        }),
    [eleves, recherche],
  );

  // Tarif en vigueur à la date du vol, comme pour une clôture
  useEffect(() => {
    if (!form.aeronef_id || !form.date) { setTarif(null); return; }
    let annule = false;
    supabase
      .rpc("tarif_aeronef", { p_aeronef_id: form.aeronef_id, p_date: form.date })
      .then(({ data }) => {
        if (annule) return;
        const prix = data != null ? Number(data) : aeronefs.find((a) => a.id === form.aeronef_id)?.prix_heure ?? null;
        setTarif(prix);
      });
    return () => { annule = true; };
  }, [form.aeronef_id, form.date, aeronefs]);

  // Prix calculé automatiquement, modifiable ensuite
  useEffect(() => {
    const minutes = parseInt(form.temps);
    if (!tarif || !Number.isFinite(minutes) || minutes <= 0) return;
    setForm((f) => ({ ...f, prix_total: String(Math.round((minutes / 60) * tarif * 100) / 100) }));
  }, [tarif, form.temps]);

  function basculer(e: any) {
    const defaut = volPropose(e);
    if (!defaut) return;
    setChoisis((prev) => {
      if (prev.includes(e.id)) return prev.filter((x) => x !== e.id);
      setTypeParEleve((t) => ({ ...t, [e.id]: t[e.id] ?? defaut }));
      return [...prev, e.id];
    });
  }

  async function enregistrer() {
    setErreur(null);
    const minutes = parseInt(form.temps);
    const prix = parseFloat(String(form.prix_total).replace(",", "."));
    if (!form.date) { setErreur("La date du vol est obligatoire."); return; }
    if (!form.aeronef_id) { setErreur("Choisissez l'aéronef."); return; }
    if (!Number.isFinite(minutes) || minutes <= 0) { setErreur("Le temps de vol doit être supérieur à 0."); return; }
    if (!form.numero.trim()) { setErreur("Le numéro de vol est obligatoire."); return; }
    if (!Number.isFinite(prix) || prix < 0) { setErreur("Le prix du vol est invalide."); return; }
    if (choisis.length === 0) { setErreur("Sélectionnez au moins un élève."); return; }

    const pilote = form.pilote_id
      ? (() => { const p = pilotes.find((x) => x.id === form.pilote_id); return p ? `${p.prenom} ${p.nom}` : ""; })()
      : form.pilote_libre.trim();
    const prixParEleve = Math.round((prix / choisis.length) * 100) / 100;

    setSaving(true);
    const echecs: string[] = [];
    for (const id of choisis) {
      const eleve = eleves.find((e) => e.id === id);
      const type = typeParEleve[id] ?? volPropose(eleve) ?? 1;
      const champs = type === 2
        ? {
            vol2_effectue: true, vol2_temps_minutes: minutes, vol2_aeronef_id: form.aeronef_id,
            vol2_prix: prixParEleve, vol2_pilote_nom: pilote || null, vol2_numero_aerogest: form.numero.trim(),
          }
        : {
            vol1_effectue: true, vol1_temps_minutes: minutes, vol1_aeronef_id: form.aeronef_id,
            vol1_prix: prixParEleve, vol1_pilote_nom: pilote || null, vol1_numero_aerogest: form.numero.trim(),
          };
      const { error } = await supabase.from("eleves").update(champs).eq("id", id);
      if (error) echecs.push(`${eleve?.prenom} ${eleve?.nom} : ${error.message}`);
    }
    setSaving(false);

    if (echecs.length > 0) {
      setErreur(`Enregistrement partiel. ${echecs.join(" · ")}`);
      onEnregistre();
      return;
    }
    toast.success(`Vol enregistré pour ${choisis.length} élève${choisis.length > 1 ? "s" : ""}`);
    onEnregistre();
    onFermer();
  }

  const prixParEleveAffiche = (() => {
    const prix = parseFloat(String(form.prix_total).replace(",", "."));
    if (!Number.isFinite(prix) || choisis.length === 0) return null;
    return Math.round((prix / choisis.length) * 100) / 100;
  })();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg my-8 p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h2 className="font-bold text-gray-900">Saisir un vol effectué</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sans créneau ni réservation, et sans aucun email aux familles.
            </p>
          </div>
          <button onClick={onFermer} className="text-gray-400 hover:text-gray-600 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {erreur && <div className="my-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{erreur}</div>}

        <div className="grid grid-cols-2 gap-3 mt-4 mb-3">
          <div>
            <label className="label">Date du vol *</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">N° de vol *</label>
            <input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="input" placeholder="Ex : 20261112A" />
          </div>
        </div>

        <div className="mb-3">
          <label className="label">Aéronef *</label>
          <select value={form.aeronef_id} onChange={(e) => setForm({ ...form, aeronef_id: e.target.value })} className="select">
            <option value="">— Choisir —</option>
            {aeronefs.map((a) => (
              <option key={a.id} value={a.id}>{a.type_aeronef} ({a.immatriculation})</option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="label">Pilote</label>
          <select value={form.pilote_id} onChange={(e) => setForm({ ...form, pilote_id: e.target.value })} className="select">
            <option value="">— Saisir un nom libre —</option>
            {pilotes.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
          </select>
          {!form.pilote_id && (
            <input
              value={form.pilote_libre}
              onChange={(e) => setForm({ ...form, pilote_libre: e.target.value })}
              className="input mt-2"
              placeholder="Nom du pilote (facultatif)"
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">Temps de vol (min) *</label>
            <input type="number" min={1} value={form.temps} onChange={(e) => setForm({ ...form, temps: e.target.value })} className="input" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Prix total (€) *</label>
              {tarif != null && <span className="text-[11px] text-gray-400">{tarif}€/h</span>}
            </div>
            <input type="number" step="0.01" value={form.prix_total} onChange={(e) => setForm({ ...form, prix_total: e.target.value })} className="input" />
          </div>
        </div>

        {/* Élèves */}
        <div className="rounded-lg border border-gray-200 p-3 mb-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <label className="label !mb-0">
              Élèves à bord {choisis.length > 0 && <span className="text-gray-400">· {choisis.length}</span>}
            </label>
            {prixParEleveAffiche != null && (
              <span className="text-[11px] font-semibold text-emerald-600">{prixParEleveAffiche}€ par élève</span>
            )}
          </div>
          <div className="relative mb-2">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} className="input pl-8 text-sm" placeholder="Rechercher un élève…" />
          </div>
          {eligibles.length === 0 ? (
            <p className="text-xs text-gray-400">Aucun élève en attente de vol.</p>
          ) : (
            <div className="space-y-1 max-h-[220px] overflow-y-auto">
              {eligibles.map((e) => {
                const selectionne = choisis.includes(e.id);
                const type = typeParEleve[e.id] ?? volPropose(e);
                return (
                  <div key={e.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${selectionne ? "bg-brand-50" : "hover:bg-gray-50"}`}>
                    <input type="checkbox" checked={selectionne} onChange={() => basculer(e)} />
                    <button type="button" onClick={() => basculer(e)} className="flex-1 text-left min-w-0">
                      <span className="text-sm text-gray-900">{e.prenom} {e.nom}</span>
                    </button>
                    {selectionne && (
                      <div className="flex bg-white rounded-md border border-gray-200 p-0.5 shrink-0">
                        {([1, 2] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTypeParEleve((prev) => ({ ...prev, [e.id]: t }))}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${type === t ? "bg-brand-500 text-white" : "text-gray-400"}`}
                          >
                            V{t}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-2">
            Le vol proposé (V1 ou V2) dépend de l&apos;avancement de l&apos;élève. Vous pouvez le corriger.
            Le prix est réparti à parts égales entre les élèves sélectionnés.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onFermer} className="btn-secondary">Annuler</button>
          <button onClick={enregistrer} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer le vol
          </button>
        </div>
      </div>
    </div>
  );
}
