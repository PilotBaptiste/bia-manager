"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchAll } from "@/lib/fetchAll";
import { useYear } from "@/contexts/YearContext";
import { Loader2, Plane, Euro, Users, TrendingUp, ChevronDown, ChevronUp, Download, BarChart2 } from "lucide-react";
import { toast } from "sonner";

export default function StatistiquesPage() {
  const supabase = createClient();
  const { selectedAnneeId, annees } = useYear();
  const anneeLabel = annees.find((a: any) => a.id === selectedAnneeId)?.label || "";
  const [loading, setLoading] = useState(true);
  const [vols, setVols] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [aeronefs, setAeronefs] = useState<any[]>([]);
  const [manualOps, setManualOps] = useState<any[]>([]);
  const [subventions, setSubventions] = useState<any[]>([]);
  const [prixInscription, setPrixInscription] = useState(80);
  const [subFede, setSubFede] = useState(50);
  // Expanded card state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  async function load() {
    setLoading(true);
    let elevesQ = supabase
      .from("eleves")
      .select("*, etablissement:etablissements(nom,actif), vol1_aeronef:aeronefs!vol1_aeronef_id(type_aeronef,immatriculation,nb_places_eleves), vol2_aeronef:aeronefs!vol2_aeronef_id(type_aeronef,immatriculation,nb_places_eleves)")
      .eq("archive", false)
      .order("id");
    if (selectedAnneeId) elevesQ = elevesQ.eq("annee_id", selectedAnneeId);

    let volsQ = supabase
      .from("vols_effectues")
      .select("*, creneau:creneaux!inner(annee_id,date_vol,heure_debut,aeronef_id,etablissement_id,pilote:profiles!pilote_id(nom,prenom),aeronef:aeronefs(type_aeronef,immatriculation,nb_places_eleves,prix_heure),etablissement:etablissements(nom))")
      .order("created_at", { ascending: false })
      .order("id");
    if (selectedAnneeId) volsQ = volsQ.eq("creneau.annee_id", selectedAnneeId);
    let opsQ = supabase.from("operations_manuelles").select("*").order("id");
    const startYear = parseInt(anneeLabel.split(/[-/]/)[0]);
    if (Number.isFinite(startYear)) opsQ = opsQ.gte("date", `${startYear}-09-01`).lte("date", `${startYear + 1}-08-31`);

    const [vR, eR, aR, pR, mR, etR, sR] = await Promise.all([
      fetchAll((from, to) => volsQ.range(from, to)),
      fetchAll((from, to) => elevesQ.range(from, to)),
      supabase.from("aeronefs").select("*"),
      supabase.from("parametres").select("*"),
      fetchAll((from, to) => opsQ.range(from, to)),
      supabase.from("etablissements").select("id,nom").eq("actif", true),
      selectedAnneeId
        ? supabase.from("subventions").select("*").eq("annee_id", selectedAnneeId)
        : Promise.resolve({ data: [], error: null }),
    ]);
    setSubventions(sR.data || []);
    const loadError = [vR, eR, aR, pR, mR, etR].find((r: any) => r.error)?.error;
    if (loadError) toast.error(`Chargement incomplet : ${loadError.message}`);

    const activeEtabIds = new Set((etR.data || []).map((e: any) => e.id));
    setVols((vR.data || []).filter((v: any) => !v.creneau?.etablissement_id || activeEtabIds.has(v.creneau.etablissement_id)));
    setEleves((eR.data || []).filter((e: any) => activeEtabIds.has(e.etablissement_id)));
    setAeronefs(aR.data || []);
    setManualOps(mR.data || []);
    const params = pR.data || [];
    const pi = params.find((p: any) => p.cle === "prix_inscription");
    const sf = params.find((p: any) => p.cle === "subvention_federation");
    if (pi && Number.isFinite(parseFloat(pi.valeur))) setPrixInscription(parseFloat(pi.valeur));
    if (sf && Number.isFinite(parseFloat(sf.valeur))) setSubFede(parseFloat(sf.valeur));
    setLoading(false);
  }

  useEffect(() => { if (selectedAnneeId) load(); }, [selectedAnneeId, anneeLabel]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
    </div>
  );

  // ─── Calculations ───────────────────────────────────────────
  const aerogestInVols = new Set<string>(vols.flatMap((v: any) => [v.numero_aerogest, ...(v.numeros_aerogest || [])]).filter(Boolean));
  const isManualFlight = (num: string | null | undefined) => !num || !aerogestInVols.has(num);
  const aerogestCount: Record<string, number> = {};
  eleves.forEach((e: any) => {
    if (e.vol1_effectue && e.vol1_numero_aerogest && isManualFlight(e.vol1_numero_aerogest))
      aerogestCount[e.vol1_numero_aerogest] = (aerogestCount[e.vol1_numero_aerogest] || 0) + 1;
    if (e.vol2_effectue && e.vol2_numero_aerogest && isManualFlight(e.vol2_numero_aerogest))
      aerogestCount[e.vol2_numero_aerogest] = (aerogestCount[e.vol2_numero_aerogest] || 0) + 1;
  });

  // nb_places_eleves counts student seats: 1 = biplace, 3 = quadriplace.
  const capaciteLabel = (seats: number) => seats === 1 ? "Biplace" : seats === 3 ? "Quadriplace" : `${seats + 1} places`;

  type Flight = { date: string; numero: string; nbPax: number; cost: number; mins: number; pilote: string };
  type AeronefStat = { label: string; places: number; nbVols: number; nbEleves: number; totalCost: number; totalMin: number; flights: Flight[] };
  const aeronefStats: Record<string, AeronefStat> = {};
  const addFlight = (aeronef: any, f: Flight) => {
    const places = aeronef?.nb_places_eleves || 1;
    const key = aeronef ? `${aeronef.type_aeronef} (${aeronef.immatriculation})` : "Aéronef non renseigné";
    if (!aeronefStats[key]) aeronefStats[key] = { label: key, places, nbVols: 0, nbEleves: 0, totalCost: 0, totalMin: 0, flights: [] };
    aeronefStats[key].nbVols++;
    aeronefStats[key].nbEleves += f.nbPax;
    aeronefStats[key].totalCost += f.cost;
    aeronefStats[key].totalMin += f.mins;
    aeronefStats[key].flights.push(f);
  };

  vols.forEach((v: any) => {
    const aeronef = v.creneau?.aeronef || aeronefs.find((a: any) => a.id === v.creneau?.aeronef_id);
    const nbPax = Math.max(v.numeros_aerogest?.length || 0, v.nb_eleves || 0, 1);
    addFlight(aeronef, {
      date: v.creneau?.date_vol || "",
      numero: v.numero_aerogest || (v.numeros_aerogest || []).join(", "),
      nbPax,
      cost: parseFloat(v.prix_total) || 0,
      mins: v.temps_vol_minutes || 0,
      pilote: v.creneau?.pilote ? `${v.creneau.pilote.prenom} ${v.creneau.pilote.nom}` : "",
    });
  });

  // Legacy flights entered directly on the student file: students sharing a number flew together,
  // their vol_prix / vol_temps are the per-student share already divided by the number of passengers.
  const legacyGroups: Record<string, { aeronef: any; nbPax: number; cost: number; mins: number; pilote: string }> = {};
  eleves.forEach((e: any) => {
    ([1, 2] as const).forEach((n) => {
      if (!e[`vol${n}_effectue`] || !isManualFlight(e[`vol${n}_numero_aerogest`])) return;
      const num = e[`vol${n}_numero_aerogest`];
      const key = num || `${e.id}_vol${n}`;
      const share = num ? (aerogestCount[num] || 1) : 1;
      const g = legacyGroups[key] || (legacyGroups[key] = { aeronef: e[`vol${n}_aeronef`], nbPax: 0, cost: 0, mins: 0, pilote: e[`vol${n}_pilote_nom`] || "" });
      g.nbPax++;
      g.cost += (parseFloat(e[`vol${n}_prix`]) || 0) / share;
      g.mins = Math.max(g.mins, e[`vol${n}_temps_minutes`] || 0);
    });
  });
  Object.entries(legacyGroups).forEach(([key, g]) => {
    addFlight(g.aeronef, { date: "", numero: key.includes("_vol") ? "" : key, nbPax: g.nbPax, cost: g.cost, mins: g.mins, pilote: g.pilote });
  });

  const placeGroups: Record<number, { nbVols: number; nbEleves: number; totalCost: number; totalMin: number }> = {};
  Object.values(aeronefStats).forEach(st => {
    const g = placeGroups[st.places] || (placeGroups[st.places] = { nbVols: 0, nbEleves: 0, totalCost: 0, totalMin: 0 });
    g.nbVols += st.nbVols;
    g.nbEleves += st.nbEleves;
    g.totalCost += st.totalCost;
    g.totalMin += st.totalMin;
  });

  const allFlights = Object.values(aeronefStats);
  const totalVolsClotures = allFlights.reduce((a, st) => a + st.nbVols, 0);
  const totalElevesTrans = allFlights.reduce((a, st) => a + st.nbEleves, 0);
  const totalCostVols = allFlights.reduce((a, st) => a + st.totalCost, 0);
  const avgCostPerEleve = totalElevesTrans > 0 ? totalCostVols / totalElevesTrans : 0;

  const totalEleves = eleves.length;
  const totalPaye = eleves.filter(e => e.paiement_effectue).length;
  const totalBia = eleves.filter(e => e.bia_resultat && e.bia_resultat !== "Non admis").length;
  const totalVol1 = eleves.filter(e => e.vol1_effectue).length;
  const totalVol2 = eleves.filter(e => e.vol2_effectue).length;
  const recettesInscriptions = eleves.filter(e => e.paiement_effectue).reduce((a, e) => a + (e.paiement_montant != null ? parseFloat(e.paiement_montant) : prixInscription), 0);
  const recettesFede = totalBia * subFede;
  const depensesManuellas = manualOps.filter(o => o.sens === "depense").reduce((a, o) => a + parseFloat(o.montant || 0), 0);
  const recettesManuelles = manualOps.filter(o => o.sens === "recette").reduce((a, o) => a + parseFloat(o.montant || 0), 0);
  const recettesSubventions = subventions.reduce((a, sv) => a + (parseFloat(sv.montant_total) || 0), 0);
  const totalRecettes = recettesInscriptions + recettesFede + recettesManuelles + recettesSubventions;
  const solde = totalRecettes - totalCostVols - depensesManuellas;

  const fmt = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

  function exportCSV() {
    const rows = [
      ["Aéronef", "Places", "Vols", "Élèves", "Coût total (€)", "Moy./vol (€)", "Moy./élève (€)", "Temps total", "Tps moy./élève"],
      ...Object.values(aeronefStats).sort((a, b) => b.nbVols - a.nbVols).map(s => [
        s.label, s.places, s.nbVols, s.nbEleves,
        s.totalCost.toFixed(2),
        s.nbVols > 0 ? (s.totalCost / s.nbVols).toFixed(2) : "",
        s.nbEleves > 0 ? (s.totalCost / s.nbEleves).toFixed(2) : "",
        fmt(s.totalMin),
        s.nbEleves > 0 ? `${Math.round(s.totalMin / s.nbEleves)} min` : "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`)
      ),
    ];
    const bom = "﻿";
    const csv = bom + rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `stats_vols_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Export téléchargé");
  }

  const StatCard = ({ id, title, value, sub, color = "text-gray-900", children }: { id: string; title: string; value: string | number; sub?: string; color?: string; children?: React.ReactNode }) => (
    <div className="card p-0 overflow-hidden">
      <button onClick={() => toggle(id)} className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left">
        <div className="flex-1">
          <p className="text-xs text-gray-500">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
        {children && (expanded[id] ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />)}
      </button>
      {expanded[id] && children && (
        <div className="border-t border-gray-100">{children}</div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><BarChart2 className="w-5 h-5 text-brand-400" /> Statistiques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue consolidée — vols et finances. Cliquer sur une carte pour voir le détail.</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary btn-sm">
          <Download className="w-3.5 h-3.5" /> Export aéronefs
        </button>
      </div>

      {/* ─── Élèves ─── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2"><Users className="w-3.5 h-3.5" /> Élèves</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard id="total_eleves" title="Total inscrits" value={totalEleves} sub={`${totalPaye} payés`} />
          <StatCard id="vol1" title="Vol 1 effectué" value={totalVol1} sub={`${totalEleves > 0 ? Math.round(totalVol1/totalEleves*100) : 0}% des inscrits`} />
          <StatCard id="vol2" title="Vol 2 effectué" value={totalVol2} sub={`${totalBia > 0 ? Math.round(totalVol2/Math.max(totalBia,1)*100) : 0}% des admis BIA`} />
          <StatCard id="bia" title="BIA réussi" value={totalBia} sub={`${totalEleves > 0 ? Math.round(totalBia/totalEleves*100) : 0}% des inscrits`} />
        </div>
      </section>

      {/* ─── Finances ─── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2"><Euro className="w-3.5 h-3.5" /> Finances</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard id="recettes" title="Total recettes" value={`${totalRecettes.toFixed(0)}€`} color="text-emerald-600"
            sub={`Inscriptions ${recettesInscriptions.toFixed(0)}€ · Fédé ${recettesFede}€`}>
            <div className="p-3 space-y-1 text-sm">
              {[
                { l: "Inscriptions", v: recettesInscriptions, note: `${totalPaye} élèves` },
                { l: "Subventions fédé", v: recettesFede, note: `${totalBia} × ${subFede}€` },
                { l: "Subventions locales", v: recettesSubventions, note: `${subventions.length} subvention${subventions.length > 1 ? "s" : ""}` },
                { l: "Recettes manuelles", v: recettesManuelles, note: `${manualOps.filter(o=>o.sens==="recette").length} opérations` },
              ].map((r,i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{r.l} <span className="text-[10px] text-gray-400">{r.note}</span></span>
                  <span className="font-semibold text-emerald-600">{r.v.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </StatCard>
          <StatCard id="couts" title="Coût vols" value={`${totalCostVols.toFixed(0)}€`} color="text-red-600"
            sub={`${totalVolsClotures} vols · moy. ${totalVolsClotures > 0 ? (totalCostVols/totalVolsClotures).toFixed(0) : 0}€/vol`}>
            <div className="overflow-auto">
              <table className="w-full text-xs min-w-[400px]">
                <thead><tr className="bg-gray-50">{["Aéronef","Vols","Moy./vol","Total"].map(h=><th key={h} className="px-3 py-1.5 text-left text-[10px] font-semibold text-gray-400">{h}</th>)}</tr></thead>
                <tbody>
                  {Object.values(aeronefStats).sort((a,b)=>b.totalCost-a.totalCost).map((s,i)=>(
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-semibold">{s.label}</td>
                      <td className="px-3 py-2">{s.nbVols}</td>
                      <td className="px-3 py-2">{s.nbVols > 0 ? `${(s.totalCost/s.nbVols).toFixed(0)}€` : "—"}</td>
                      <td className="px-3 py-2 text-red-600 font-semibold">{s.totalCost.toFixed(2)}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </StatCard>
          <StatCard id="solde" title="Solde" value={`${solde >= 0 ? "+" : ""}${solde.toFixed(0)}€`} color={solde >= 0 ? "text-emerald-600" : "text-red-600"}
            sub="Recettes − Dépenses" />
          <StatCard id="avg_eleve" title="Coût moy./élève" value={`${avgCostPerEleve.toFixed(0)}€`}
            sub={`sur ${totalElevesTrans} passages élève`} />
        </div>
      </section>

      {/* ─── Vols par type d'aéronef ─── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2"><Plane className="w-3.5 h-3.5" /> Vols par type d&apos;aéronef</h2>

        {/* Summary by nb places */}
        <div className="flex gap-3 flex-wrap mb-4">
          {Object.entries(placeGroups).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([places, s]) => {
            const label = capaciteLabel(parseInt(places));
            const avgCostVol = s.nbVols > 0 ? s.totalCost / s.nbVols : 0;
            const avgCostEleve = s.nbEleves > 0 ? s.totalCost / s.nbEleves : 0;
            return (
              <StatCard key={places} id={`places_${places}`} title={label} value={`${s.nbVols} vols`}
                sub={`${s.nbEleves} élèves · ${s.totalCost.toFixed(0)}€`}>
                <div className="p-3 grid grid-cols-2 gap-2 text-sm">
                  {[
                    { l: "Coût moy./vol", v: `${avgCostVol.toFixed(0)}€` },
                    { l: "Coût moy./élève", v: `${avgCostEleve.toFixed(0)}€` },
                    { l: "Temps moy./élève", v: s.nbEleves > 0 ? `${Math.round(s.totalMin/s.nbEleves)} min` : "—" },
                    { l: "Temps total", v: fmt(s.totalMin) },
                  ].map((r,i) => (
                    <div key={i} className="p-2 bg-gray-50 rounded-lg">
                      <p className="text-[10px] text-gray-400">{r.l}</p>
                      <p className="font-bold text-gray-900">{r.v}</p>
                    </div>
                  ))}
                </div>
              </StatCard>
            );
          })}
        </div>

        {/* Detail per aeronef model */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-sm">Détail par aéronef</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead><tr className="bg-gray-50">
                {["Aéronef", "Places", "Vols", "Élèves", "Coût total", "Moy./vol", "Moy./élève", "Tps moy./élève"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {Object.values(aeronefStats).sort((a,b)=>b.nbVols-a.nbVols).map((s,i) => (
                  <>
                    <tr key={i} className="border-t border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => toggle(`aeronef_${i}`)}>
                      <td className="px-3 py-2.5 font-semibold">{s.label}</td>
                      <td className="px-3 py-2.5 text-gray-500">{capaciteLabel(s.places)}</td>
                      <td className="px-3 py-2.5">{s.nbVols}</td>
                      <td className="px-3 py-2.5">{s.nbEleves}</td>
                      <td className="px-3 py-2.5 text-red-600 font-semibold">{s.totalCost.toFixed(2)}€</td>
                      <td className="px-3 py-2.5">{s.nbVols > 0 ? `${(s.totalCost/s.nbVols).toFixed(0)}€` : "—"}</td>
                      <td className="px-3 py-2.5">{s.nbEleves > 0 ? `${(s.totalCost/s.nbEleves).toFixed(0)}€` : "—"}</td>
                      <td className="px-3 py-2.5">{s.nbEleves > 0 ? `${Math.round(s.totalMin/s.nbEleves)} min` : "—"}</td>
                    </tr>
                    {expanded[`aeronef_${i}`] && s.flights.map((f: any, j: number) => (
                      <tr key={`${i}_${j}`} className="bg-gray-50 border-t border-gray-100 text-xs text-gray-600">
                        <td className="px-3 py-1.5 pl-8 text-gray-400">{f.date ? new Date(f.date).toLocaleDateString("fr-FR") : "—"}</td>
                        <td className="px-3 py-1.5"></td>
                        <td className="px-3 py-1.5 font-mono">{f.numero || "—"}</td>
                        <td className="px-3 py-1.5">{f.nbPax > 1 ? `×${f.nbPax}` : "1 pax"}</td>
                        <td className="px-3 py-1.5 text-red-500">{f.cost > 0 ? `${f.cost.toFixed(2)}€` : "—"}</td>
                        <td className="px-3 py-1.5">{f.pilote || "—"}</td>
                        <td className="px-3 py-1.5">{f.nbPax > 0 ? `${(f.cost/f.nbPax).toFixed(0)}€` : "—"}</td>
                        <td className="px-3 py-1.5">{f.mins ? `${Math.round(f.mins/f.nbPax)} min` : "—"}</td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
