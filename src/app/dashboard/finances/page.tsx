"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Euro, Plane, Users, School, TrendingUp, Loader2, Edit, Save, X, Clock, History, UserCheck, Plus, Trash2, Check, Download } from "lucide-react";
import { useYear } from "@/contexts/YearContext";
import { toast } from "sonner";

const PAYMENT_MODES = ["Espèces", "Chèque", "Virement", "CB", "Autre"];
const OP_TYPES = ["Inscription", "Subvention BIA", "Vol", "Remboursement", "Dépense", "Autre"];

const emptyAddForm = { type: "Autre", sens: "recette" as "recette" | "depense", date: "", montant: "", description: "", etablissement: "", mode: "" };

export default function FinancesPage() {
  const supabase = createClient();
  const { selectedAnneeId } = useYear();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "paiements" | "operations" | "pilotes" | "roulage" | "logs">("overview");
  const [expandedPilote, setExpandedPilote] = useState<string | null>(null);
  const [paiementFilter, setPaiementFilter] = useState<"tous" | "payes" | "non_payes">("tous");
  const [filterPaiementEtab, setFilterPaiementEtab] = useState("");
  const [eleves, setEleves] = useState<any[]>([]);
  const [vols, setVols] = useState<any[]>([]);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [manualOps, setManualOps] = useState<any[]>([]);
  const [prixInscription, setPrixInscription] = useState(80);
  const [subFede, setSubFede] = useState(50);
  const [nomClub, setNomClub] = useState("");

  // Edit state
  const [editingOp, setEditingOp] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Add state
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyAddForm);
  const [adding, setAdding] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    let elevesQuery = supabase
      .from("eleves")
      .select("*, etablissement:etablissements(nom), vol1_aeronef:aeronefs!vol1_aeronef_id(type_aeronef,immatriculation), vol2_aeronef:aeronefs!vol2_aeronef_id(type_aeronef,immatriculation)")
      .eq("archive", false);
    if (selectedAnneeId) elevesQuery = elevesQuery.eq("annee_id", selectedAnneeId);

    const [eR, vR, etR, pR, lR, mR] = await Promise.all([
      elevesQuery,
      supabase.from("vols_effectues").select("*, creneau:creneaux(date_vol,heure_debut,pilote:profiles!pilote_id(nom,prenom),aeronef:aeronefs(type_aeronef,immatriculation,prix_heure),etablissement:etablissements(nom),reservations(eleve:eleves(nom,prenom)))").order("created_at", { ascending: false }),
      supabase.from("etablissements").select("*").eq("actif", true),
      supabase.from("parametres").select("*"),
      supabase.from("activity_logs").select("*, user:profiles!user_id(nom,prenom)").order("created_at", { ascending: false }).limit(100),
      supabase.from("operations_manuelles").select("*").order("date", { ascending: false }),
    ]);
    const activeEtabIds = new Set((etR.data || []).map((e: any) => e.id));
    setEleves((eR.data || []).filter((e: any) => activeEtabIds.has(e.etablissement_id)));
    setVols(vR.data || []);
    setEtabs(etR.data || []);
    setLogs(lR.data || []);
    setManualOps(mR.data || []);
    const params = pR.data || [];
    const pi = params.find((p: any) => p.cle === "prix_inscription");
    const sf = params.find((p: any) => p.cle === "subvention_federation");
    if (pi) setPrixInscription(parseFloat(pi.valeur));
    if (sf) setSubFede(parseFloat(sf.valeur));
    const nc = params.find((p: any) => p.cle === "nom_club");
    if (nc) setNomClub(nc.valeur);
    setLoading(false);
  }

  useEffect(() => { if (selectedAnneeId) load(); }, [selectedAnneeId]);

  // ---------- Calculations ----------
  // Aerogest dedup needed first for cost calculations
  const aerogestInVols = new Set<string>(vols.map((v: any) => v.numero_aerogest).filter(Boolean));
  const aerogestCountAll: Record<string, number> = {};
  vols.forEach(v => { if (v.numero_aerogest) aerogestCountAll[v.numero_aerogest] = (aerogestCountAll[v.numero_aerogest] || 0) + 1; });
  eleves.forEach(e => {
    if (e.vol1_effectue && e.vol1_numero_aerogest && !aerogestInVols.has(e.vol1_numero_aerogest)) aerogestCountAll[e.vol1_numero_aerogest] = (aerogestCountAll[e.vol1_numero_aerogest] || 0) + 1;
    if (e.vol2_effectue && e.vol2_numero_aerogest && !aerogestInVols.has(e.vol2_numero_aerogest)) aerogestCountAll[e.vol2_numero_aerogest] = (aerogestCountAll[e.vol2_numero_aerogest] || 0) + 1;
  });

  const totalPaye = eleves.filter(e => e.paiement_effectue).length;
  const totalBia = eleves.filter(e => e.bia_resultat && e.bia_resultat !== "Non admis").length;
  const totalVol1 = eleves.filter(e => e.vol1_effectue).length;
  const totalVol2 = eleves.filter(e => e.vol2_effectue).length;
  // Use each élève's actual paiement_montant (falls back to default prix_inscription)
  const recettesInscriptions = eleves.filter(e => e.paiement_effectue).reduce((a, e) => a + (e.paiement_montant != null ? parseFloat(e.paiement_montant) : prixInscription), 0);
  const recettesFede = totalBia * subFede;
  const recettesManuelles = manualOps.filter(o => o.sens === "recette").reduce((a, o) => a + parseFloat(o.montant || 0), 0);
  const depensesManuelles = manualOps.filter(o => o.sens === "depense").reduce((a, o) => a + parseFloat(o.montant || 0), 0);
  const totalRecettes = recettesInscriptions + recettesFede + recettesManuelles;
  const coutVolsClotures = vols.reduce((acc, v) => acc + (parseFloat(v.prix_total) || 0), 0);
  // Cost of manually-entered eleve vols (price divided by ×N shared-flight)
  const coutVolsManuels = eleves.reduce((acc, e) => {
    let c = 0;
    if (e.vol1_effectue && e.vol1_numero_aerogest && !aerogestInVols.has(e.vol1_numero_aerogest))
      c += e.vol1_prix ? parseFloat(e.vol1_prix) / (aerogestCountAll[e.vol1_numero_aerogest] || 1) : 0;
    if (e.vol2_effectue && e.vol2_numero_aerogest && !aerogestInVols.has(e.vol2_numero_aerogest))
      c += e.vol2_prix ? parseFloat(e.vol2_prix) / (aerogestCountAll[e.vol2_numero_aerogest] || 1) : 0;
    return acc + c;
  }, 0);
  const coutVolsTotal = coutVolsClotures + coutVolsManuels;
  const margeNonUtil = (totalBia - totalVol2) * subFede;
  const solde = totalRecettes - coutVolsTotal - depensesManuelles;

  type PiloteVolDetail = { date: string; numero: string; temps: number | null; cout: number; nbPax: number; tempsParEleve: number | null };
  const piloteStats: Record<string, { nom: string; nbVols: number; heures: number; cout: number; flights: PiloteVolDetail[] }> = {};
  vols.forEach(v => {
    const pName = v.creneau?.pilote ? `${v.creneau.pilote.prenom} ${v.creneau.pilote.nom}` : "Inconnu";
    if (!piloteStats[pName]) piloteStats[pName] = { nom: pName, nbVols: 0, heures: 0, cout: 0, flights: [] };
    const nbPax = (v.numeros_aerogest?.length || 0) > 1 ? v.numeros_aerogest.length : (v.nb_eleves || 1);
    piloteStats[pName].nbVols++;
    piloteStats[pName].heures += (v.temps_vol_minutes || 0) / 60;
    piloteStats[pName].cout += parseFloat(v.prix_total) || 0;
    piloteStats[pName].flights.push({ date: v.creneau?.date_vol || "", numero: v.numero_aerogest || (v.numeros_aerogest?.join(", ") || ""), temps: v.temps_vol_minutes, cout: parseFloat(v.prix_total) || 0, nbPax, tempsParEleve: v.temps_vol_minutes != null ? Math.round(v.temps_vol_minutes / nbPax) : null });
  });
  // Add manual eleve vols to pilote stats
  eleves.forEach(e => {
    if (e.vol1_effectue && e.vol1_pilote_nom && e.vol1_numero_aerogest && !aerogestInVols.has(e.vol1_numero_aerogest)) {
      if (!piloteStats[e.vol1_pilote_nom]) piloteStats[e.vol1_pilote_nom] = { nom: e.vol1_pilote_nom, nbVols: 0, heures: 0, cout: 0, flights: [] };
      const n1 = aerogestCountAll[e.vol1_numero_aerogest] || 1;
      piloteStats[e.vol1_pilote_nom].nbVols++;
      piloteStats[e.vol1_pilote_nom].heures += (e.vol1_temps_minutes || 0) / 60 / n1;
      piloteStats[e.vol1_pilote_nom].cout += e.vol1_prix ? parseFloat(e.vol1_prix) / n1 : 0;
      const t1 = e.vol1_temps_minutes ? Math.round(e.vol1_temps_minutes / n1) : null;
      piloteStats[e.vol1_pilote_nom].flights.push({ date: "", numero: e.vol1_numero_aerogest, temps: t1, cout: e.vol1_prix ? parseFloat(e.vol1_prix) / n1 : 0, nbPax: n1, tempsParEleve: t1 });
    }
    if (e.vol2_effectue && e.vol2_pilote_nom && e.vol2_numero_aerogest && !aerogestInVols.has(e.vol2_numero_aerogest)) {
      if (!piloteStats[e.vol2_pilote_nom]) piloteStats[e.vol2_pilote_nom] = { nom: e.vol2_pilote_nom, nbVols: 0, heures: 0, cout: 0, flights: [] };
      const n2 = aerogestCountAll[e.vol2_numero_aerogest] || 1;
      piloteStats[e.vol2_pilote_nom].nbVols++;
      piloteStats[e.vol2_pilote_nom].heures += (e.vol2_temps_minutes || 0) / 60 / n2;
      piloteStats[e.vol2_pilote_nom].cout += e.vol2_prix ? parseFloat(e.vol2_prix) / n2 : 0;
      const t2 = e.vol2_temps_minutes ? Math.round(e.vol2_temps_minutes / n2) : null;
      piloteStats[e.vol2_pilote_nom].flights.push({ date: "", numero: e.vol2_numero_aerogest, temps: t2, cout: e.vol2_prix ? parseFloat(e.vol2_prix) / n2 : 0, nbPax: n2, tempsParEleve: t2 });
    }
  });

  const etabStats = etabs.map(et => {
    const etEleves = eleves.filter(e => e.etablissement_id === et.id);
    const etPaye = etEleves.filter(e => e.paiement_effectue).length;
    const etBia = etEleves.filter(e => e.bia_resultat && e.bia_resultat !== "Non admis").length;
    const etVol1 = etEleves.filter(e => e.vol1_effectue).length;
    const etVol2 = etEleves.filter(e => e.vol2_effectue).length;
    const etCout = etEleves.reduce((a, e) => {
      let c = 0;
      if (e.vol1_effectue && e.vol1_numero_aerogest) c += e.vol1_prix ? parseFloat(e.vol1_prix) / (aerogestCountAll[e.vol1_numero_aerogest] || 1) : 0;
      else if (e.vol1_effectue) c += parseFloat(e.vol1_prix) || 0;
      if (e.vol2_effectue && e.vol2_numero_aerogest) c += e.vol2_prix ? parseFloat(e.vol2_prix) / (aerogestCountAll[e.vol2_numero_aerogest] || 1) : 0;
      else if (e.vol2_effectue) c += parseFloat(e.vol2_prix) || 0;
      return a + c;
    }, 0);
    const ins = etEleves.filter(e => e.paiement_effectue).reduce((a, e) => a + (e.paiement_montant != null ? parseFloat(e.paiement_montant) : prixInscription), 0);
    const fed = etBia * subFede;
    return { nom: et.nom, eleves: etEleves.length, payes: etPaye, ins, bia: etBia, vol1: etVol1, vol2: etVol2, fed, couts: etCout, solde: ins + fed - etCout };
  });

  // ---------- Operations list (with source tracking) ----------
  const operations: any[] = [];
  eleves.forEach(e => {
    if (e.paiement_effectue) operations.push({ id: e.id, source: "inscription", date: e.paiement_date || e.created_at, type: "Inscription", sens: "recette", montant: e.paiement_montant != null ? parseFloat(e.paiement_montant) : prixInscription, description: `${e.prenom} ${e.nom}`, etablissement: e.etablissement?.nom, mode: e.paiement_mode });
    if (e.bia_resultat && e.bia_resultat !== "Non admis") operations.push({ id: e.id, source: "bia", date: e.bia_date || e.updated_at, type: "Subvention BIA", sens: "recette", montant: subFede, description: `${e.prenom} ${e.nom} — ${e.bia_resultat}`, etablissement: e.etablissement?.nom });
  });
  vols.forEach(v => {
    operations.push({ id: v.id, source: "vol", date: v.created_at, type: "Vol", sens: "depense", montant: parseFloat(v.prix_total), description: `${v.numero_aerogest} — ${v.creneau?.reservations?.map((r: any) => `${r.eleve?.prenom} ${r.eleve?.nom}`).join(", ") || "—"}`, etablissement: v.creneau?.etablissement?.nom, aeronef: v.creneau?.aeronef?.type_aeronef, pilote: v.creneau?.pilote ? `${v.creneau.pilote.prenom} ${v.creneau.pilote.nom}` : "", temps: v.temps_vol_minutes });
  });
  manualOps.forEach(op => {
    operations.push({ id: op.id, source: "manuel", date: op.date, type: op.type, sens: op.sens, montant: parseFloat(op.montant), description: op.description, etablissement: op.etablissement, mode: op.mode });
  });
  // Add manual eleve vols (not already covered by vols_effectues)
  eleves.forEach(e => {
    if (e.vol1_effectue && e.vol1_numero_aerogest && !aerogestInVols.has(e.vol1_numero_aerogest)) {
      const n = aerogestCountAll[e.vol1_numero_aerogest] || 1;
      operations.push({ id: `${e.id}_vol1`, source: "vol_manuel", date: e.updated_at, type: "Vol", sens: "depense", montant: e.vol1_prix ? parseFloat(e.vol1_prix) / n : null, description: `${e.prenom} ${e.nom} — Vol 1 (${e.vol1_numero_aerogest}${n > 1 ? ` ×${n}` : ""})`, etablissement: e.etablissement?.nom, pilote: e.vol1_pilote_nom || "", aeronef: e.vol1_aeronef?.type_aeronef || "", temps: e.vol1_temps_minutes != null ? Math.round(e.vol1_temps_minutes / n) : null });
    }
    if (e.vol2_effectue && e.vol2_numero_aerogest && !aerogestInVols.has(e.vol2_numero_aerogest)) {
      const n = aerogestCountAll[e.vol2_numero_aerogest] || 1;
      operations.push({ id: `${e.id}_vol2`, source: "vol_manuel", date: e.updated_at, type: "Vol", sens: "depense", montant: e.vol2_prix ? parseFloat(e.vol2_prix) / n : null, description: `${e.prenom} ${e.nom} — Vol 2 (${e.vol2_numero_aerogest}${n > 1 ? ` ×${n}` : ""})`, etablissement: e.etablissement?.nom, pilote: e.vol2_pilote_nom || "", aeronef: e.vol2_aeronef?.type_aeronef || "", temps: e.vol2_temps_minutes != null ? Math.round(e.vol2_temps_minutes / n) : null });
    }
  });
  operations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ---------- Handlers ----------
  function openEdit(op: any) {
    setEditingOp(op);
    if (op.source === "inscription") {
      setEditForm({ date: op.date ? op.date.slice(0, 10) : "", montant: op.montant ?? "", mode: op.mode || "" });
    } else if (op.source === "bia") {
      setEditForm({ date: op.date ? op.date.slice(0, 10) : "", montant: op.montant ?? "" });
    } else if (op.source === "vol") {
      setEditForm({ montant: op.montant ?? "", temps: op.temps ?? "" });
    } else {
      setEditForm({ type: op.type, sens: op.sens, date: op.date ? op.date.slice(0, 10) : "", montant: op.montant ?? "", description: op.description || "", etablissement: op.etablissement || "", mode: op.mode || "" });
    }
  }

  async function handleEditSave() {
    if (!editingOp) return;
    setSaving(true);
    if (editingOp.source === "inscription") {
      await supabase.from("eleves").update({ paiement_date: editForm.date || null, paiement_montant: parseFloat(editForm.montant) || null, paiement_mode: editForm.mode || null }).eq("id", editingOp.id);
    } else if (editingOp.source === "bia") {
      await supabase.from("eleves").update({ bia_date: editForm.date || null }).eq("id", editingOp.id);
    } else if (editingOp.source === "vol") {
      const newTemps = editForm.temps !== "" ? parseInt(editForm.temps) : null;
      const newPrix = editForm.montant !== "" ? parseFloat(editForm.montant) : 0;
      if (editForm.montant !== "" && isNaN(newPrix)) { setSaving(false); toast.error("Montant invalide"); return; }
      await supabase.from("vols_effectues").update({ prix_total: newPrix, temps_vol_minutes: (!isNaN(newTemps!) && newTemps !== null) ? newTemps : null }).eq("id", editingOp.id);
    } else {
      await supabase.from("operations_manuelles").update({ type: editForm.type, sens: editForm.sens, date: editForm.date, montant: parseFloat(editForm.montant) || 0, description: editForm.description, etablissement: editForm.etablissement, mode: editForm.mode }).eq("id", editingOp.id);
    }
    setSaving(false);
    setEditingOp(null);
    toast.success("Opération mise à jour");
    load();
  }

  async function handleDelete(op: any) {
    setDeleting(true);
    if (op.source === "inscription") {
      await supabase.from("eleves").update({ paiement_effectue: false, paiement_date: null, paiement_montant: null, paiement_mode: null }).eq("id", op.id);
    } else if (op.source === "bia") {
      await supabase.from("eleves").update({ bia_resultat: null, bia_passe: false, bia_date: null }).eq("id", op.id);
    } else if (op.source === "vol") {
      await supabase.from("vols_effectues").delete().eq("id", op.id);
    } else {
      await supabase.from("operations_manuelles").delete().eq("id", op.id);
    }
    setDeleting(false);
    setConfirmDelete(null);
    toast.success("Opération supprimée");
    load();
  }

  async function handleAdd() {
    if (!addForm.date || !addForm.montant) { toast.error("Date et montant obligatoires"); return; }
    setAdding(true);
    const { error } = await supabase.from("operations_manuelles").insert({
      type: addForm.type,
      sens: addForm.sens,
      date: addForm.date,
      montant: parseFloat(addForm.montant),
      description: addForm.description || null,
      etablissement: addForm.etablissement || null,
      mode: addForm.mode || null,
    });
    setAdding(false);
    if (error) { toast.error("Erreur lors de l'ajout"); return; }
    setShowAdd(false);
    setAddForm(emptyAddForm);
    toast.success("Opération ajoutée");
    load();
  }

  function exportCSV(type: "operations" | "etabs" | "pilotes") {
    let rows: string[][] = [];
    let filename = "";
    const fmt = (v: any) => v == null ? "" : String(v).replace(/"/g, '""');
    const cell = (v: any) => `"${fmt(v)}"`;
    const date = new Date().toISOString().slice(0, 10);

    if (type === "operations") {
      filename = `finances_operations_${date}.csv`;
      rows = [
        ["Date", "Type", "Sens", "Montant (€)", "Description", "Établissement", "Aéronef", "Pilote", "Temps (min)", "Mode"],
        ...operations.map(op => [
          op.date ? new Date(op.date).toLocaleDateString("fr-FR") : "",
          op.type,
          op.sens === "recette" ? "Recette" : "Dépense",
          op.montant?.toFixed(2) ?? "",
          op.description ?? "",
          op.etablissement ?? "",
          op.aeronef ?? "",
          op.pilote ?? "",
          op.temps ?? "",
          op.mode ?? "",
        ].map(cell)),
      ];
    } else if (type === "etabs") {
      filename = `finances_etablissements_${date}.csv`;
      rows = [
        ["Établissement", "Élèves", "Payés", "Inscriptions (€)", "BIA admis", "Subv. fédé (€)", "Coût vols (€)", "Solde (€)"],
        ...etabStats.map(r => [
          r.nom, r.eleves, r.payes, r.ins, r.bia, r.fed, r.couts.toFixed(2), r.solde.toFixed(2),
        ].map(cell)),
        // Total row
        ["TOTAL", eleves.length, totalPaye, recettesInscriptions.toFixed(2), totalBia, recettesFede, coutVolsTotal.toFixed(2), solde.toFixed(2)].map(cell),
      ];
    } else {
      filename = `finances_pilotes_${date}.csv`;
      rows = [
        ["Pilote", "Vols", "Heures", "Coût (€)"],
        ...Object.entries(piloteStats).map(([nom, s]: any) => [
          nom, s.vols, (s.minutes / 60).toFixed(1), s.cout.toFixed(2),
        ].map(cell)),
      ];
    }

    const bom = "\uFEFF";
    const csv = bom + rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Export ${filename} téléchargé`);
  }

  if (loading) return <div className="flex items-center justify-center h-64" role="status" aria-label="Chargement des finances…"><Loader2 className="w-6 h-6 animate-spin text-brand-400" aria-hidden="true" /></div>;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Finances — {new Date().getFullYear()}</h1>
          {nomClub && <p className="text-sm text-gray-500 mt-0.5">{nomClub}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV("operations")} className="btn-secondary btn-sm" title="Exporter toutes les opérations">
            <Download className="w-3.5 h-3.5" /> Opérations
          </button>
          <button onClick={() => exportCSV("etabs")} className="btn-secondary btn-sm" title="Exporter par établissement">
            <Download className="w-3.5 h-3.5" /> Établissements
          </button>
          <button onClick={() => exportCSV("pilotes")} className="btn-secondary btn-sm" title="Exporter par pilote">
            <Download className="w-3.5 h-3.5" /> Pilotes
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-0.5 w-fit flex-wrap">
        {[
          { key: "overview", label: "Vue d'ensemble", icon: TrendingUp },
          { key: "paiements", label: "Paiements", icon: Users },
          { key: "operations", label: "Opérations", icon: Euro },
          { key: "pilotes", label: "Par pilote", icon: UserCheck },
          { key: "roulage", label: "Roulage", icon: Clock },
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
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Inscriptions</p><p className="text-2xl font-bold text-emerald-600">{recettesInscriptions.toFixed(2)}€</p><p className="text-[11px] text-gray-400">{totalPaye} élève{totalPaye > 1 ? "s" : ""} payé{totalPaye > 1 ? "s" : ""}</p></div>
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Subventions fede</p><p className="text-2xl font-bold text-emerald-600">{recettesFede}€</p><p className="text-[11px] text-gray-400">{totalBia} x {subFede}€</p></div>
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Cout vols</p><p className="text-2xl font-bold text-red-600">{coutVolsTotal.toFixed(2)}€</p><p className="text-[11px] text-gray-400">{totalVol1 + totalVol2} vols</p></div>
            <div className="card flex-1 min-w-[160px]"><p className="text-xs text-gray-500 mb-1">Solde</p><p className={`text-2xl font-bold ${solde >= 0 ? "text-emerald-600" : "text-red-600"}`}>{solde >= 0 ? "+" : ""}{solde.toFixed(2)}€</p></div>
          </div>

          <div className="card mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2"><School className="w-4 h-4 text-brand-400" /> Par etablissement</h2>
            <div className="overflow-auto"><table className="w-full text-sm min-w-[700px]"><thead><tr className="bg-gray-50">
              {["Etablissement", "Eleves", "Payes", "Inscriptions", "BIA", "Vol 1", "Vol 2", "Subv.", "Cout vols", "Solde"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
            </tr></thead><tbody>
              {etabStats.map((r, i) => <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2.5 font-semibold">{r.nom}</td>
                <td className="px-3 py-2.5">{r.eleves}</td>
                <td className="px-3 py-2.5">{r.payes}/{r.eleves}</td>
                <td className="px-3 py-2.5 text-emerald-600 font-semibold">{r.ins}€</td>
                <td className="px-3 py-2.5">{r.bia}</td>
                <td className="px-3 py-2.5 font-semibold">{r.vol1}</td>
                <td className="px-3 py-2.5 font-semibold">{r.vol2}</td>
                <td className="px-3 py-2.5 text-emerald-600">{r.fed}€</td>
                <td className="px-3 py-2.5 text-red-600">{r.couts.toFixed(2)}€</td>
                <td className={`px-3 py-2.5 font-bold ${r.solde >= 0 ? "text-emerald-600" : "text-red-600"}`}>{r.solde >= 0 ? "+" : ""}{r.solde.toFixed(2)}€</td>
              </tr>)}
            </tbody></table></div>
          </div>

          <div className="card"><h2 className="text-sm font-semibold text-gray-900 mb-3">Indicateurs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Taux paiement", v: eleves.length > 0 ? `${Math.round(totalPaye / eleves.length * 100)}%` : "—", s: `${totalPaye}/${eleves.length}` },
                { l: "Taux BIA", v: totalBia > 0 ? `${totalBia}` : "0", s: "admis" },
                { l: "Vol 2 realises", v: totalBia > 0 ? `${Math.round(totalVol2 / Math.max(totalBia, 1) * 100)}%` : "—", s: `${totalVol2}/${totalBia}` },
                { l: "Marge sub. non util.", v: margeNonUtil > 0 ? `+${margeNonUtil}€` : "—", s: `${Math.max(totalBia - totalVol2, 0)} sans vol 2` },
              ].map((k, i) => <div key={i} className="p-3 bg-gray-50 rounded-lg"><p className="text-[10px] text-gray-500">{k.l}</p><p className="text-xl font-bold text-gray-900 mt-1">{k.v}</p><p className="text-[10px] text-gray-400">{k.s}</p></div>)}
            </div>
          </div>
        </div>
      )}

      {/* PAIEMENTS */}
      {tab === "paiements" && (() => {
        const elevesFiltered = eleves.filter(e => {
          if (filterPaiementEtab && e.etablissement_id !== filterPaiementEtab) return false;
          if (paiementFilter === "payes") return e.paiement_effectue;
          if (paiementFilter === "non_payes") return !e.paiement_effectue;
          return true;
        });
        const nonPayes = eleves.filter(e => !e.paiement_effectue);
        const payes = eleves.filter(e => e.paiement_effectue);
        return (
          <div className="space-y-4">
            <div className="flex gap-3 flex-wrap">
              <div className="card flex-1 min-w-[130px] border-l-4 border-l-emerald-400">
                <p className="text-xs text-gray-500">Payés</p>
                <p className="text-2xl font-bold text-emerald-600">{payes.length}</p>
                <p className="text-[11px] text-gray-400">{eleves.length > 0 ? Math.round(payes.length / eleves.length * 100) : 0}% du total</p>
              </div>
              <div className="card flex-1 min-w-[130px] border-l-4 border-l-red-400">
                <p className="text-xs text-gray-500">Non payés</p>
                <p className="text-2xl font-bold text-red-500">{nonPayes.length}</p>
                <p className="text-[11px] text-gray-400">{nonPayes.reduce((a, e) => a + (e.paiement_montant != null ? 0 : prixInscription), 0).toFixed(0)}€ restants</p>
              </div>
              <div className="card flex-1 min-w-[130px]">
                <p className="text-xs text-gray-500">Total inscrit</p>
                <p className="text-2xl font-bold text-gray-900">{eleves.length}</p>
                <p className="text-[11px] text-gray-400">{recettesInscriptions.toFixed(2)}€ encaissés</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {(["tous", "payes", "non_payes"] as const).map(f => (
                <button key={f} onClick={() => setPaiementFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${paiementFilter === f ? "bg-brand-500 text-white border-brand-500" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {f === "tous" ? "Tous" : f === "payes" ? "Payés" : "Non payés"}
                </button>
              ))}
              <select value={filterPaiementEtab} onChange={e => setFilterPaiementEtab(e.target.value)} className="ml-auto pl-3 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700">
                <option value="">Tous les établissements</option>
                {etabs.map(et => <option key={et.id} value={et.id}>{et.nom}</option>)}
              </select>
            </div>
            <div className="card p-0 overflow-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead><tr className="bg-gray-50">
                  {["Élève", "Établissement", "Statut", "Mode", "Montant", "Date paiement"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {elevesFiltered.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400 text-sm">Aucun élève</td></tr>
                  ) : elevesFiltered.map((e, i) => (
                    <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium text-gray-900">{e.prenom} {e.nom}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{e.etablissement?.nom || "—"}</td>
                      <td className="px-3 py-2.5">
                        {e.paiement_effectue
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><Check className="w-3 h-3" /> Payé</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full"><X className="w-3 h-3" /> Non payé</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{e.paiement_mode || "—"}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-gray-700">{e.paiement_effectue ? `${(e.paiement_montant != null ? parseFloat(e.paiement_montant) : prixInscription).toFixed(2)}€` : "—"}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{e.paiement_date ? new Date(e.paiement_date).toLocaleDateString("fr-FR") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 font-medium">
                {elevesFiltered.length} élève{elevesFiltered.length > 1 ? "s" : ""}
              </div>
            </div>
          </div>
        );
      })()}

      {/* OPERATIONS */}
      {tab === "operations" && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-gray-500">{operations.length} opération{operations.length > 1 ? "s" : ""}</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Ajouter</button>
          </div>

          <div className="card p-0 overflow-auto">
            <table className="w-full text-sm min-w-[900px]"><thead><tr className="bg-gray-50">
              {["Date", "Type", "Sens", "Montant", "Description", "Etabl.", "Aeronef", "Pilote", "Temps", ""].map((h, i) => <th key={i} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
            </tr></thead><tbody>
              {operations.length === 0 ? <tr><td colSpan={10} className="px-3 py-12 text-center text-gray-400">Aucune operation</td></tr> : operations.map((op, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50 group">
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{op.date ? new Date(op.date).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2.5"><span className={`badge ${op.type.includes("Vol") ? "bg-red-50 text-red-600" : op.type === "Subvention BIA" ? "bg-blue-50 text-blue-600" : op.sens === "depense" ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"}`}>{op.type}</span></td>
                  <td className="px-3 py-2.5"><span className={`text-xs font-semibold ${op.sens === "recette" ? "text-emerald-600" : "text-red-600"}`}>{op.sens === "recette" ? "+" : "−"}</span></td>
                  <td className={`px-3 py-2.5 font-semibold ${op.sens === "recette" ? "text-emerald-600" : "text-red-600"}`}>{op.sens === "recette" ? "+" : "−"}{op.montant?.toFixed(2)}€</td>
                  <td className="px-3 py-2.5 text-gray-700 text-xs">{op.description}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{op.etablissement || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{op.aeronef || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{op.pilote || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{op.temps ? `${op.temps}min` : "—"}</td>
                  <td className="px-3 py-2.5">
                    {op.source !== "vol_manuel" && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(op)} className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700" title="Modifier"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setConfirmDelete(op)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Supprimer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody></table>
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-between text-sm font-semibold flex-wrap gap-2">
              <span>Total recettes: <span className="text-emerald-600">+{totalRecettes.toFixed(2)}€</span></span>
              <span>Total dépenses: <span className="text-red-600">−{(coutVolsTotal + depensesManuelles).toFixed(2)}€</span></span>
              <span>Solde: <span className={solde >= 0 ? "text-emerald-600" : "text-red-600"}>{solde >= 0 ? "+" : ""}{solde.toFixed(2)}€</span></span>
            </div>
          </div>
        </div>
      )}

      {/* PAR PILOTE */}
      {tab === "pilotes" && (
        <div className="space-y-3">
          {Object.values(piloteStats).length === 0 ? (
            <div className="card py-12 text-center text-gray-400">Aucun vol enregistré</div>
          ) : Object.values(piloteStats).sort((a, b) => b.nbVols - a.nbVols).map((p, i) => {
            const maxVol = Math.max(...p.flights.map(f => f.tempsParEleve || 0));
            const over30Count = p.flights.filter(f => (f.tempsParEleve || 0) > 30).length;
            const isExpanded = expandedPilote === p.nom;
            return (
              <div key={i} className="card p-0 overflow-hidden">
                <button
                  onClick={() => setExpandedPilote(isExpanded ? null : p.nom)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{p.nom}</p>
                    <p className="text-xs text-gray-400">{p.nbVols} vol{p.nbVols > 1 ? "s" : ""} · {p.heures.toFixed(1)}h · {p.cout.toFixed(2)}€</p>
                  </div>
                  {over30Count > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full shrink-0">
                      <Clock className="w-3 h-3" /> {over30Count} vol{over30Count > 1 ? "s" : ""} &gt;30 min
                    </span>
                  )}
                  <span className="text-gray-300 text-sm">{isExpanded ? "▲" : "▼"}</span>
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-100 overflow-auto">
                    <table className="w-full text-xs min-w-[500px]">
                      <thead><tr className="bg-gray-50">
                        {["Date", "N° Aérogest", "Nb pax", "Tps/élève", "Coût"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {p.flights.sort((a, b) => (b.date || "").localeCompare(a.date || "")).map((f, j) => {
                          const over30 = (f.tempsParEleve || 0) > 30;
                          return (
                            <tr key={j} className={`border-t border-gray-100 ${over30 ? "bg-amber-50" : ""}`}>
                              <td className="px-3 py-2 text-gray-500">{f.date ? new Date(f.date).toLocaleDateString("fr-FR") : "—"}</td>
                              <td className="px-3 py-2 font-mono text-gray-700">{f.numero || "—"}</td>
                              <td className="px-3 py-2 text-gray-500">{f.nbPax > 1 ? `×${f.nbPax}` : "1 pax"}</td>
                              <td className={`px-3 py-2 font-semibold ${over30 ? "text-amber-700" : "text-gray-700"}`}>
                                {f.tempsParEleve != null ? `${f.tempsParEleve} min` : "—"}
                                {f.nbPax > 1 && f.temps != null && <span className="ml-1 text-gray-400 text-[10px]">({f.temps} total)</span>}
                                {over30 && <span className="ml-1 text-amber-500">⚠</span>}
                              </td>
                              <td className="px-3 py-2 text-red-600">{f.cout > 0 ? `${f.cout.toFixed(2)}€` : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {maxVol > 30 && (
                      <div className="px-3 py-2 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 font-medium">
                        Max : {maxVol} min — {over30Count} vol{over30Count > 1 ? "s" : ""} dépassant 30 min
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ROULAGE */}
      {tab === "roulage" && (() => {
        const TAXI_MIN = 8;
        const roulageVols = vols.filter((v: any) => Array.isArray(v.numeros_aerogest) && v.numeros_aerogest.length > 1);
        const totalFact = roulageVols.reduce((a: number, v: any) => a + v.numeros_aerogest.length * TAXI_MIN, 0);
        const totalReel = roulageVols.reduce((a: number, v: any) => {
          const n = v.numeros_aerogest.length;
          return a + (n > 2 ? n - 1 : n) * TAXI_MIN;
        }, 0);
        const totalEco = totalFact - totalReel;
        return (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              <p>Chaque numéro Aérogest inclut <strong>8 min de roulage</strong>. Pour un vol de 3 pax (3 numéros), le roulage réel est compté <strong>2×8 min</strong> au lieu de 3×8 min.</p>
            </div>
            {roulageVols.length === 0 ? (
              <div className="card py-12 text-center space-y-2">
                <p className="text-gray-400 font-medium">Aucun vol multi-numéros Aérogest</p>
                <p className="text-xs text-gray-400">Les vols clôturés avec l'option "Numéros individuels" (3 pax) apparaîtront ici.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-3 flex-wrap">
                  <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">Roulage facturé</p><p className="text-2xl font-bold text-red-500">{totalFact} min</p></div>
                  <div className="card flex-1 min-w-[130px]"><p className="text-xs text-gray-500">Roulage réel</p><p className="text-2xl font-bold text-gray-900">{totalReel} min</p></div>
                  <div className="card flex-1 min-w-[130px] border-l-4 border-l-emerald-400"><p className="text-xs text-gray-500">Économie</p><p className="text-2xl font-bold text-emerald-600">{totalEco} min</p><p className="text-[11px] text-gray-400">{roulageVols.length} vol{roulageVols.length > 1 ? "s" : ""}</p></div>
                </div>
                <div className="card p-0 overflow-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead><tr className="bg-gray-50">
                      {["Date", "Aéronef", "Numéros Aérogest", "Pax", "Temps vol", "Roulage facturé", "Roulage réel", "Économie"].map(h => <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {roulageVols.map((v: any, i: number) => {
                        const n = v.numeros_aerogest.length;
                        const fact = n * TAXI_MIN;
                        const reel = (n > 2 ? n - 1 : n) * TAXI_MIN;
                        const eco = fact - reel;
                        return (
                          <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2.5 text-gray-500 text-xs">{v.creneau?.date_vol ? new Date(v.creneau.date_vol).toLocaleDateString("fr-FR") : "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-700">{v.creneau?.aeronef?.type_aeronef || "—"}</td>
                            <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{v.numeros_aerogest.join(" / ")}</td>
                            <td className="px-3 py-2.5 text-center font-semibold text-gray-900">{n}</td>
                            <td className="px-3 py-2.5 text-xs">{v.temps_vol_minutes != null ? `${v.temps_vol_minutes} min` : "—"}</td>
                            <td className="px-3 py-2.5 text-xs text-red-500 font-semibold">{fact} min</td>
                            <td className="px-3 py-2.5 text-xs font-semibold">{reel} min</td>
                            <td className={`px-3 py-2.5 text-xs font-bold ${eco > 0 ? "text-emerald-600" : "text-gray-400"}`}>{eco > 0 ? `−${eco} min` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })()}

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

      {/* EDIT MODAL */}
      {editingOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEditingOp(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={e => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">Modifier l&apos;opération</h3>
              <button onClick={() => setEditingOp(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {(editingOp.source === "inscription") && (
                <>
                  <div><label className="label">Date de paiement</label><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="input" /></div>
                  <div><label className="label">Montant (€)</label><input type="number" value={editForm.montant} onChange={e => setEditForm({ ...editForm, montant: e.target.value })} className="input" /></div>
                  <div><label className="label">Mode de paiement</label>
                    <select value={editForm.mode} onChange={e => setEditForm({ ...editForm, mode: e.target.value })} className="input">
                      <option value="">—</option>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </>
              )}
              {editingOp.source === "bia" && (
                <>
                  <div><label className="label">Date résultat BIA</label><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="input" /></div>
                  <div><label className="label">Montant subvention (€)</label><input type="number" value={editForm.montant} onChange={e => setEditForm({ ...editForm, montant: e.target.value })} className="input" /></div>
                </>
              )}
              {editingOp.source === "vol" && (
                <>
                  <div><label className="label">Prix total (€)</label><input type="number" step="0.01" value={editForm.montant} onChange={e => setEditForm({ ...editForm, montant: e.target.value })} className="input" /></div>
                  <div><label className="label">Temps de vol (minutes)</label><input type="number" value={editForm.temps} onChange={e => setEditForm({ ...editForm, temps: e.target.value })} className="input" /></div>
                </>
              )}
              {editingOp.source === "manuel" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Type</label>
                      <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })} className="input">
                        {OP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div><label className="label">Sens</label>
                      <select value={editForm.sens} onChange={e => setEditForm({ ...editForm, sens: e.target.value })} className="input">
                        <option value="recette">Recette (+)</option>
                        <option value="depense">Dépense (−)</option>
                      </select>
                    </div>
                  </div>
                  <div><label className="label">Date</label><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} className="input" /></div>
                  <div><label className="label">Montant (€)</label><input type="number" step="0.01" value={editForm.montant} onChange={e => setEditForm({ ...editForm, montant: e.target.value })} className="input" /></div>
                  <div><label className="label">Description</label><input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="input" /></div>
                  <div><label className="label">Établissement</label><input value={editForm.etablissement} onChange={e => setEditForm({ ...editForm, etablissement: e.target.value })} className="input" /></div>
                  <div><label className="label">Mode</label><input value={editForm.mode} onChange={e => setEditForm({ ...editForm, mode: e.target.value })} className="input" /></div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setEditingOp(null)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleEditSave} disabled={saving} className="btn-primary btn-sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={e => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">Nouvelle opération</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Type</label>
                  <select value={addForm.type} onChange={e => setAddForm({ ...addForm, type: e.target.value })} className="input">
                    {OP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Sens</label>
                  <select value={addForm.sens} onChange={e => setAddForm({ ...addForm, sens: e.target.value as any })} className="input">
                    <option value="recette">Recette (+)</option>
                    <option value="depense">Dépense (−)</option>
                  </select>
                </div>
              </div>
              <div><label className="label">Date *</label><input type="date" value={addForm.date} onChange={e => setAddForm({ ...addForm, date: e.target.value })} className="input" /></div>
              <div><label className="label">Montant (€) *</label><input type="number" step="0.01" value={addForm.montant} onChange={e => setAddForm({ ...addForm, montant: e.target.value })} className="input" placeholder="0.00" /></div>
              <div><label className="label">Description</label><input value={addForm.description} onChange={e => setAddForm({ ...addForm, description: e.target.value })} className="input" placeholder="Commentaire libre..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Établissement</label><input value={addForm.etablissement} onChange={e => setAddForm({ ...addForm, etablissement: e.target.value })} className="input" /></div>
                <div><label className="label">Mode</label>
                  <select value={addForm.mode} onChange={e => setAddForm({ ...addForm, mode: e.target.value })} className="input">
                    <option value="">—</option>
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setShowAdd(false)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleAdd} disabled={adding || !addForm.date || !addForm.montant} className="btn-primary btn-sm">
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">Supprimer cette opération ?</h3>
            <p className="text-sm text-gray-500 mb-1"><strong>{confirmDelete.type}</strong> — {confirmDelete.montant?.toFixed(2)}€</p>
            {confirmDelete.source !== "manuel" && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mb-4">
                {confirmDelete.source === "inscription" && "Ceci annulera le paiement de l'élève (paiement_effectue = false)."}
                {confirmDelete.source === "bia" && "Ceci effacera le résultat BIA de l'élève."}
                {confirmDelete.source === "vol" && "Ceci supprimera définitivement le vol clôturé."}
              </p>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting} className="btn-danger btn-sm">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
