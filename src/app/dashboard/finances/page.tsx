"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Euro, Plane, Users, School, TrendingUp, Loader2, Edit, Save, X, Clock, History, UserCheck } from "lucide-react";

export default function FinancesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "operations" | "pilotes" | "logs">("overview");
  const [eleves, setEleves] = useState<any[]>([]);
  const [vols, setVols] = useState<any[]>([]);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [prixInscription, setPrixInscription] = useState(80);
  const [subFede, setSubFede] = useState(50);
  const [editingOp, setEditingOp] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [eR, vR, etR, pR, lR] = await Promise.all([
        supabase.from("eleves").select("*, etablissement:etablissements(nom), vol1_aeronef:aeronefs!vol1_aeronef_id(type_aeronef,immatriculation), vol2_aeronef:aeronefs!vol2_aeronef_id(type_aeronef,immatriculation)").eq("archive", false),
        supabase.from("vols_effectues").select("*, creneau:creneaux(date_vol,heure_debut,pilote:profiles!pilote_id(nom,prenom),aeronef:aeronefs(type_aeronef,immatriculation,prix_heure),etablissement:etablissements(nom),reservations(eleve:eleves(nom,prenom)))").order("created_at", { ascending: false }),
        supabase.from("etablissements").select("*").eq("actif", true),
        supabase.from("parametres").select("*"),
        supabase.from("activity_logs").select("*, user:profiles!user_id(nom,prenom)").order("created_at", { ascending: false }).limit(100),
      ]);
      setEleves(eR.data || []);
      setVols(vR.data || []);
      setEtabs(etR.data || []);
      setLogs(lR.data || []);
      const params = pR.data || [];
      const pi = params.find((p: any) => p.cle === "prix_inscription");
      const sf = params.find((p: any) => p.cle === "subvention_federation");
      if (pi) setPrixInscription(parseFloat(pi.valeur));
      if (sf) setSubFede(parseFloat(sf.valeur));
      setLoading(false);
    }
    load();
  }, []);

  // Calculations
  const totalPaye = eleves.filter(e => e.paiement_effectue).length;
  const totalBia = eleves.filter(e => e.bia_resultat && e.bia_resultat !== "Non admis").length;
  const totalVol1 = eleves.filter(e => e.vol1_effectue).length;
  const totalVol2 = eleves.filter(e => e.vol2_effectue).length;
  const recettesInscriptions = totalPaye * prixInscription;
  const recettesFede = totalBia * subFede;
  const totalRecettes = recettesInscriptions + recettesFede;

  // Source unique pour les coûts vols : vols_effectues (une entrée par vol, évite le double comptage)
  // Les prix copiés sur les élèves lors de la clôture ne sont pas additionnés pour éviter la duplication.
  const coutVolsClotures = vols.reduce((acc, v) => acc + (parseFloat(v.prix_total) || 0), 0);
  const coutVolsTotal = coutVolsClotures;

  const margeNonUtil = (totalBia - totalVol2) * subFede;
  const solde = totalRecettes - coutVolsTotal;

  // Stats by pilot — depuis vols_effectues uniquement (source unique, évite le double comptage)
  const piloteStats: Record<string, { nom: string; nbVols: number; heures: number; cout: number }> = {};
  vols.forEach(v => {
    const pName = v.creneau?.pilote ? `${v.creneau.pilote.prenom} ${v.creneau.pilote.nom}` : "Inconnu";
    if (!piloteStats[pName]) piloteStats[pName] = { nom: pName, nbVols: 0, heures: 0, cout: 0 };
    piloteStats[pName].nbVols++;
    piloteStats[pName].heures += (v.temps_vol_minutes || 0) / 60;
    piloteStats[pName].cout += parseFloat(v.prix_total) || 0;
  });

  // Stats by etablissement
  const etabStats = etabs.map(et => {
    const etEleves = eleves.filter(e => e.etablissement_id === et.id);
    const etPaye = etEleves.filter(e => e.paiement_effectue).length;
    const etBia = etEleves.filter(e => e.bia_resultat && e.bia_resultat !== "Non admis").length;
    const etVol2 = etEleves.filter(e => e.vol2_effectue).length;
    const etCout = etEleves.reduce((a, e) => a + (parseFloat(e.vol1_prix) || 0) + (parseFloat(e.vol2_prix) || 0), 0);
    const ins = etPaye * prixInscription;
    const fed = etBia * subFede;
    return { nom: et.nom, eleves: etEleves.length, payes: etPaye, ins, bia: etBia, fed, couts: etCout, solde: ins + fed - etCout };
  });

  // Build operations list
  const operations: any[] = [];
  eleves.forEach(e => {
    if (e.paiement_effectue) operations.push({ date: e.paiement_date || e.created_at, type: "Inscription", sens: "recette", montant: e.paiement_montant || prixInscription, description: `${e.prenom} ${e.nom}`, etablissement: e.etablissement?.nom, mode: e.paiement_mode });
    if (e.bia_resultat && e.bia_resultat !== "Non admis") operations.push({ date: e.bia_date || e.updated_at, type: "Subvention BIA", sens: "recette", montant: subFede, description: `${e.prenom} ${e.nom} — ${e.bia_resultat}`, etablissement: e.etablissement?.nom });
  });
  // Les vols sont comptés depuis vols_effectues uniquement (source unique, évite le double comptage)
  vols.forEach(v => {
    operations.push({ date: v.created_at, type: "Vol", sens: "depense", montant: parseFloat(v.prix_total), description: `${v.numero_aerogest} — ${v.creneau?.reservations?.map((r: any) => `${r.eleve?.prenom} ${r.eleve?.nom}`).join(", ") || "—"}`, etablissement: v.creneau?.etablissement?.nom, aeronef: v.creneau?.aeronef?.type_aeronef, pilote: v.creneau?.pilote ? `${v.creneau.pilote.prenom} ${v.creneau.pilote.nom}` : "", temps: v.temps_vol_minutes });
  });
  operations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Finances — {new Date().getFullYear()}</h1>
        <p className="text-sm text-gray-500 mt-0.5">Aero-Club du Bassin d&apos;Arcachon</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-0.5 w-fit flex-wrap">
        {[
          { key: "overview", label: "Vue d'ensemble", icon: TrendingUp },
          { key: "operations", label: "Operations", icon: Euro },
          { key: "pilotes", label: "Par pilote", icon: UserCheck },
          { key: "logs", label: "Logs", icon: History },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${tab === key ? "bg-white text-brand-500 shadow-sm" : "text-gray-500"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div>
          <div className="flex gap-3 flex-wrap mb-6">
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Inscriptions</p><p className="text-2xl font-bold text-emerald-600">{recettesInscriptions}E</p><p className="text-[11px] text-gray-400">{totalPaye} x {prixInscription}E</p></div>
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Subventions fede</p><p className="text-2xl font-bold text-emerald-600">{recettesFede}E</p><p className="text-[11px] text-gray-400">{totalBia} x {subFede}E</p></div>
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Cout vols</p><p className="text-2xl font-bold text-red-600">{coutVolsTotal.toFixed(2)}E</p><p className="text-[11px] text-gray-400">{totalVol1 + totalVol2} vols</p></div>
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Solde</p><p className={`text-2xl font-bold ${solde >= 0 ? "text-emerald-600" : "text-red-600"}`}>{solde >= 0 ? "+" : ""}{solde.toFixed(2)}E</p></div>
          </div>

          {/* Par etablissement */}
          <div className="card mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><School className="w-4 h-4 text-brand-400" /> Par etablissement</h2>
            <div className="overflow-auto"><table className="w-full text-sm min-w-[700px]"><thead><tr className="bg-gray-50">
              {["Etablissement", "Eleves", "Payes", "Inscriptions", "BIA", "Subv.", "Cout vols", "Solde"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
            </tr></thead><tbody>
              {etabStats.map((r, i) => <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2.5 font-semibold">{r.nom}</td>
                <td className="px-3 py-2.5">{r.eleves}</td>
                <td className="px-3 py-2.5">{r.payes}/{r.eleves}</td>
                <td className="px-3 py-2.5 text-emerald-600 font-semibold">{r.ins}E</td>
                <td className="px-3 py-2.5">{r.bia}</td>
                <td className="px-3 py-2.5 text-emerald-600">{r.fed}E</td>
                <td className="px-3 py-2.5 text-red-600">{r.couts.toFixed(2)}E</td>
                <td className={`px-3 py-2.5 font-bold ${r.solde >= 0 ? "text-emerald-600" : "text-red-600"}`}>{r.solde >= 0 ? "+" : ""}{r.solde.toFixed(2)}E</td>
              </tr>)}
            </tbody></table></div>
          </div>

          {/* KPIs */}
          <div className="card"><h2 className="text-sm font-semibold text-gray-900 mb-3">Indicateurs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Taux paiement", v: eleves.length > 0 ? `${Math.round(totalPaye / eleves.length * 100)}%` : "—", s: `${totalPaye}/${eleves.length}` },
                { l: "Taux BIA", v: totalBia > 0 ? `${totalBia}` : "0", s: "admis" },
                { l: "Vol 2 realises", v: totalBia > 0 ? `${Math.round(totalVol2 / Math.max(totalBia, 1) * 100)}%` : "—", s: `${totalVol2}/${totalBia}` },
                { l: "Marge sub. non util.", v: margeNonUtil > 0 ? `+${margeNonUtil}E` : "—", s: `${Math.max(totalBia - totalVol2, 0)} sans vol 2` },
              ].map((k, i) => <div key={i} className="p-3 bg-gray-50 rounded-lg"><p className="text-[10px] text-gray-500">{k.l}</p><p className="text-xl font-bold text-gray-900 mt-1">{k.v}</p><p className="text-[10px] text-gray-400">{k.s}</p></div>)}
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONS */}
      {tab === "operations" && (
        <div className="card p-0 overflow-auto">
          <table className="w-full text-sm min-w-[800px]"><thead><tr className="bg-gray-50">
            {["Date", "Type", "Sens", "Montant", "Description", "Etabl.", "Aeronef", "Pilote", "Temps"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
          </tr></thead><tbody>
            {operations.length === 0 ? <tr><td colSpan={9} className="px-3 py-12 text-center text-gray-400">Aucune operation</td></tr> : operations.map((op, i) => (
              <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2.5 text-gray-500 text-xs">{op.date ? new Date(op.date).toLocaleDateString("fr-FR") : "—"}</td>
                <td className="px-3 py-2.5"><span className={`badge ${op.type.includes("Vol") ? "bg-red-50 text-red-600" : op.type === "Subvention BIA" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>{op.type}</span></td>
                <td className="px-3 py-2.5"><span className={`text-xs font-semibold ${op.sens === "recette" ? "text-emerald-600" : "text-red-600"}`}>{op.sens === "recette" ? "+" : "-"}</span></td>
                <td className={`px-3 py-2.5 font-semibold ${op.sens === "recette" ? "text-emerald-600" : "text-red-600"}`}>{op.sens === "recette" ? "+" : "-"}{op.montant?.toFixed(2)}E</td>
                <td className="px-3 py-2.5 text-gray-700 text-xs max-w-[200px] truncate">{op.description}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{op.etablissement || "—"}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{op.aeronef || "—"}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{op.pilote || "—"}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{op.temps ? `${op.temps}min` : "—"}</td>
              </tr>
            ))}
          </tbody></table>
          <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between text-sm font-semibold">
            <span>Total recettes: <span className="text-emerald-600">+{totalRecettes.toFixed(2)}E</span></span>
            <span>Total depenses: <span className="text-red-600">-{coutVolsTotal.toFixed(2)}E</span></span>
            <span>Solde: <span className={solde >= 0 ? "text-emerald-600" : "text-red-600"}>{solde >= 0 ? "+" : ""}{solde.toFixed(2)}E</span></span>
          </div>
        </div>
      )}

      {/* PAR PILOTE */}
      {tab === "pilotes" && (
        <div className="card p-0 overflow-auto">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50">
            {["Pilote", "Nombre de vols", "Heures de vol", "Cout total"].map(h => <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
          </tr></thead><tbody>
            {Object.values(piloteStats).length === 0 ? <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">Aucun vol enregistre</td></tr> : Object.values(piloteStats).sort((a, b) => b.nbVols - a.nbVols).map((p, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-4 py-3 font-semibold text-gray-900">{p.nom}</td>
                <td className="px-4 py-3">{p.nbVols}</td>
                <td className="px-4 py-3">{p.heures.toFixed(1)}h</td>
                <td className="px-4 py-3 font-semibold text-red-600">{p.cout.toFixed(2)}E</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}

      {/* LOGS */}
      {tab === "logs" && (
        <div className="card p-0 overflow-auto">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50">
            {["Date", "Utilisateur", "Action", "Table", "Details"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
          </tr></thead><tbody>
            {logs.length === 0 ? <tr><td colSpan={5} className="px-3 py-12 text-center text-gray-400">Aucun log</td></tr> : logs.map((l, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2.5 text-gray-500 text-xs">{new Date(l.created_at).toLocaleString("fr-FR")}</td>
                <td className="px-3 py-2.5 text-xs">{l.user?.prenom} {l.user?.nom}</td>
                <td className="px-3 py-2.5"><span className={`badge ${l.action === "create" ? "bg-emerald-50 text-emerald-600" : l.action === "delete" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>{l.action}</span></td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">{l.table_name}</td>
                <td className="px-3 py-2.5 text-gray-500 text-[10px] max-w-[300px] truncate">{l.details ? JSON.stringify(l.details).slice(0, 150) : "—"}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      )}
    </div>
  );
}
