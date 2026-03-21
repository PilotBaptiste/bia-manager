"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plane,
  Plus,
  Calendar,
  List,
  Loader2,
  X,
  Check,
  AlertCircle,
  Clock,
  User,
  Mail,
  Phone,
  History,
  Edit,
  Save,
  Filter,
  Download,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

export default function VolsPage() {
  const supabase = createClient();
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [volsHisto, setVolsHisto] = useState<any[]>([]);
  const [aeronefs, setAeronefs] = useState<any[]>([]);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [pilotes, setPilotes] = useState<any[]>([]);
  const [qualifs, setQualifs] = useState<any[]>([]);
  const [piloteEtabs, setPiloteEtabs] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [anneeId, setAnneeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "calendar" | "historique">("list");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showClose, setShowClose] = useState<any>(null);
  const [showEditSlot, setShowEditSlot] = useState<any>(null);
  const [editHisto, setEditHisto] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; variant?: "danger" | "primary"; onConfirm: () => void } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [filterPilote, setFilterPilote] = useState("");
  const [filterAeronef, setFilterAeronef] = useState("");
  const [filterEtab, setFilterEtab] = useState("");
  const [filterStatut, setFilterStatut] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showAddEleve, setShowAddEleve] = useState(false);
  const [addEleveSearch, setAddEleveSearch] = useState("");
  const [addEleveTypeVol, setAddEleveTypeVol] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    date_vol: "",
    heure_debut: "09:00",
    heure_fin: "10:00",
    aeronef_id: "",
    etablissements: [] as string[],
    elevesByEtab: {} as Record<string, string[]>,
    notes_pilote: "",
    pilote_id: "",
  });
  const [closeForm, setCloseForm] = useState({
    numero_aerogest: "",
    temps_vol_minutes: "",
    nb_eleves: "",
    prix_total: "",
    notes: "",
    pilote_override: "",
  });

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const [profRes, crRes, aRes, eRes, anRes, vhRes, pRes, qRes, peRes, elRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("creneaux")
          .select(
            "*, pilote:profiles!pilote_id(nom,prenom,id,email,telephone), aeronef:aeronefs(*), etablissement:etablissements(nom), reservations(*, eleve:eleves(id,nom,prenom,date_naissance,lieu_naissance,classe,commentaires,vol1_temps_minutes,parent_nom,parent_prenom,parent_email,parent_telephone,etablissement:etablissements(nom)))",
          )
          .order("date_vol", { ascending: false }),
        supabase.from("aeronefs").select("*").eq("actif", true),
        supabase.from("etablissements").select("*").eq("actif", true),
        supabase.from("annees").select("*").eq("active", true).single(),
        supabase
          .from("vols_effectues")
          .select(
            "*, creneau:creneaux(date_vol,heure_debut,heure_fin,pilote_id,aeronef_id,etablissement_id,pilote:profiles!pilote_id(nom,prenom),aeronef:aeronefs(type_aeronef,immatriculation),etablissement:etablissements(nom),reservations(eleve:eleves(nom,prenom)))",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, nom, prenom")
          .contains("roles", ["pilote"])
          .eq("actif", true)
          .order("nom"),
        supabase.from("pilote_qualifications").select("pilote_id, aeronef_id"),
        supabase
          .from("pilote_etablissements")
          .select("pilote_id, etablissement_id"),
        supabase
          .from("eleves")
          .select("id, nom, prenom, etablissement_id, vol1_effectue, vol1_numero_aerogest, vol1_prix, vol1_temps_minutes, vol1_pilote_nom, vol1_aeronef_id, vol2_effectue, vol2_numero_aerogest, vol2_prix, vol2_temps_minutes, vol2_pilote_nom, vol2_aeronef_id")
          .eq("archive", false)
          .order("nom"),
      ]);
    setProfile(profRes.data);
    setCreneaux(crRes.data || []);
    setAeronefs(aRes.data || []);
    setEtabs(eRes.data || []);
    setVolsHisto(vhRes.data || []);
    setPilotes(pRes.data || []);
    setQualifs(qRes.data || []);
    setPiloteEtabs(peRes.data || []);
    setEleves(elRes.data || []);
    if (anRes.data) setAnneeId(anRes.data.id);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const isPilote = profile?.roles?.includes("pilote");
  const isSA = profile?.roles?.includes("superadmin");
  const isCoord = profile?.roles?.includes("coordinateur");
  const isGerant = profile?.roles?.includes("gerant") && !isSA && !isCoord;
  const gerantEtabIds: string[] =
    profile?.etablissement_ids?.length > 0
      ? profile.etablissement_ids
      : profile?.etablissement_id
        ? [profile.etablissement_id]
        : [];
  const canCreate = isPilote || isSA;
  // Priority: SA/coordinateur → all | gérant → their établissements | pilot only → their slots
  const displayed =
    isSA || isCoord
      ? creneaux
      : isGerant && gerantEtabIds.length > 0
        ? creneaux.filter(
            (c) =>
              !c.etablissement_id ||
              gerantEtabIds.includes(c.etablissement_id),
          )
        : isPilote
          ? creneaux.filter((c) => c.pilote_id === profile?.id)
          : creneaux;

  const filteredDisplayed = displayed.filter((c) => {
    if (filterPilote && c.pilote_id !== filterPilote) return false;
    if (filterAeronef && c.aeronef_id !== filterAeronef) return false;
    if (filterEtab && c.etablissement_id !== filterEtab) return false;
    if (filterStatut && c.statut !== filterStatut) return false;
    if (filterDateFrom && c.date_vol < filterDateFrom) return false;
    if (filterDateTo && c.date_vol > filterDateTo) return false;
    return true;
  });
  const hasFilters = !!(filterPilote || filterAeronef || filterEtab || filterStatut || filterDateFrom || filterDateTo);

  const filteredHisto = volsHisto.filter((v) => {
    if (filterPilote && v.creneau?.pilote_id !== filterPilote) return false;
    if (filterAeronef && v.creneau?.aeronef_id !== filterAeronef) return false;
    if (filterEtab && v.creneau?.etablissement_id !== filterEtab) return false;
    if (filterDateFrom && v.creneau?.date_vol < filterDateFrom) return false;
    if (filterDateTo && v.creneau?.date_vol > filterDateTo) return false;
    return true;
  });

  // Get qualified aeronefs for a pilot — returns [] if no qualifications set
  function getQualifiedAeronefs(pid: string) {
    if (!pid) return [];
    const pq = qualifs.filter((q) => q.pilote_id === pid);
    // No fallback to all aeronefs — if no qualif assigned, pilot sees nothing
    return aeronefs.filter((a) => pq.some((q) => q.aeronef_id === a.id));
  }

  // Get assigned etablissements for a pilot
  function getPiloteEtabsList(pid: string) {
    const pe = piloteEtabs.filter((x) => x.pilote_id === pid);
    return etabs.filter((e) => pe.some((x) => x.etablissement_id === e.id));
  }

  const createPiloteId = isSA ? form.pilote_id : profile?.id;
  // SA without pilot selected → show all aeronefs; otherwise restrict to qualifs
  const availableAeronefs = isSA && !form.pilote_id
    ? aeronefs
    : getQualifiedAeronefs(createPiloteId || "");
  const availableEtabs = isSA
    ? etabs
    : profile?.id
      ? getPiloteEtabsList(profile.id)
      : [];

  async function handleCreateSlot() {
    setError(null);
    if (!form.date_vol || !form.aeronef_id) {
      setError("Date et aeronef obligatoires.");
      return;
    }
    if (isSA && !form.pilote_id) {
      setError("Selectionnez un pilote.");
      return;
    }
    if (!isSA && availableEtabs.length === 0) {
      setError("Aucun etablissement assigne. Contactez le SuperAdmin.");
      return;
    }
    if (!isSA && form.etablissements.length === 0) {
      setError("Selectionnez au moins un etablissement.");
      return;
    }
    if (form.heure_debut && form.heure_fin && form.heure_debut >= form.heure_fin) {
      setError("L'heure de fin doit être après l'heure de début.");
      return;
    }
    const piloteId = isSA && form.pilote_id ? form.pilote_id : profile.id;
    const aeronef = aeronefs.find((a) => a.id === form.aeronef_id);
    const piloteObj = pilotes.find((p: any) => p.id === piloteId) || (isSA ? null : profile);
    const piloteNom = piloteObj ? `${piloteObj.prenom} ${piloteObj.nom}` : "";
    const aeronefObj = aeronefs.find((a: any) => a.id === form.aeronef_id);
    const aeronefLabel = aeronefObj ? `${aeronefObj.type_aeronef} (${aeronefObj.immatriculation})` : "";
    // Create one créneau per selected établissement (or one global if SA with none selected)
    const etabsToCreate: (string | null)[] = form.etablissements.length > 0
      ? form.etablissements
      : [null];
    setSaving(true);
    let hasError = false;
    for (const etabId of etabsToCreate) {
      const eleveAut = etabId && (form.elevesByEtab[etabId]?.length ?? 0) > 0
        ? form.elevesByEtab[etabId]
        : null;
      const { data: created, error: err } = await supabase.from("creneaux").insert({
        pilote_id: piloteId,
        aeronef_id: form.aeronef_id,
        annee_id: anneeId,
        etablissement_id: etabId,
        date_vol: form.date_vol,
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin,
        places_disponibles: aeronef?.nb_places_eleves || 2,
        notes_pilote: form.notes_pilote || null,
        eleves_autorises: eleveAut,
      }).select("id").single();
      if (err) { setError(err.message); hasError = true; break; }
      // Notify eligible parents (anti-spam: only if no open slots already existed for this scope)
      fetch("/api/email/notify-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creneau_id: created?.id,
          etablissement_id: etabId,
          eleves_autorises: eleveAut,
          date_vol: form.date_vol,
          heure_debut: form.heure_debut,
          heure_fin: form.heure_fin,
          pilote_nom: piloteNom,
          aeronef: aeronefLabel,
        }),
      }).catch(() => {});
    }
    setSaving(false);
    if (hasError) return;
    setShowCreate(false);
    setForm({
      date_vol: "",
      heure_debut: "09:00",
      heure_fin: "10:00",
      aeronef_id: "",
      etablissements: [],
      elevesByEtab: {},
      notes_pilote: "",
      pilote_id: "",
    });
    load();
  }

  function handleCloseFlight() {
    setError(null);
    if (
      !closeForm.numero_aerogest ||
      !closeForm.temps_vol_minutes ||
      !closeForm.prix_total
    ) {
      setError("Champs obligatoires manquants.");
      return;
    }
    const nbEleves = (showClose?.reservations || []).filter((r: any) => r.statut !== "annule").length;
    setConfirmAction({
      title: "Clôturer le vol",
      message: `Confirmer la clôture du vol du ${showClose?.date_vol ?? ""} ?\n${nbEleves} élève(s) seront enregistrés comme ayant effectué leur vol.`,
      variant: "primary",
      onConfirm: () => doCloseFlight(),
    });
  }

  async function doCloseFlight() {
    setSaving(true);
    await supabase
      .from("vols_effectues")
      .insert({
        creneau_id: showClose.id,
        numero_aerogest: closeForm.numero_aerogest,
        temps_vol_minutes: parseInt(closeForm.temps_vol_minutes),
        nb_eleves:
          parseInt(closeForm.nb_eleves) || showClose.reservations?.length || 0,
        prix_total: parseFloat(closeForm.prix_total),
        notes: closeForm.notes || null,
        valide_par: profile.id,
      });
    await supabase
      .from("creneaux")
      .update({ statut: "termine" })
      .eq("id", showClose.id);
    const activeRes = (showClose.reservations || []).filter(
      (r: any) => r.statut !== "annule",
    );
    for (const r of activeRes) {
      await supabase
        .from("reservations")
        .update({ statut: "effectue" })
        .eq("id", r.id);
      if (r.eleve?.id) {
        const prixParEleve =
          parseFloat(closeForm.prix_total) / Math.max(activeRes.length, 1);
        const piloteNom = closeForm.pilote_override
          ? (() => { const p = pilotes.find((x) => x.id === closeForm.pilote_override); return p ? `${p.prenom} ${p.nom}` : ""; })()
          : showClose.pilote
          ? `${showClose.pilote.prenom} ${showClose.pilote.nom}`
          : "";
        if (r.type_vol === 2) {
          await supabase
            .from("eleves")
            .update({
              vol2_effectue: true,
              vol2_temps_minutes: parseInt(closeForm.temps_vol_minutes),
              vol2_aeronef_id: showClose.aeronef_id,
              vol2_prix: prixParEleve,
              vol2_pilote_nom: piloteNom,
              vol2_numero_aerogest: closeForm.numero_aerogest || null,
            })
            .eq("id", r.eleve.id);
        } else {
          await supabase
            .from("eleves")
            .update({
              vol1_effectue: true,
              vol1_temps_minutes: parseInt(closeForm.temps_vol_minutes),
              vol1_aeronef_id: showClose.aeronef_id,
              vol1_prix: prixParEleve,
              vol1_pilote_nom: piloteNom,
              vol1_numero_aerogest: closeForm.numero_aerogest || null,
            })
            .eq("id", r.eleve.id);
        }
      }
    }
    setSaving(false);
    setShowClose(null);
    setCloseForm({
      numero_aerogest: "",
      temps_vol_minutes: "",
      nb_eleves: "",
      prix_total: "",
      notes: "",
      pilote_override: "",
    });
    load();
  }

  function getAffectedParents(creneau: any) {
    return (creneau?.reservations || [])
      .filter((r: any) => r.statut !== "annule" && r.eleve?.parent_email)
      .map((r: any) => ({
        email: r.eleve.parent_email,
        prenom: r.eleve.parent_prenom || "",
        eleve_prenom: r.eleve.prenom,
        eleve_nom: r.eleve.nom,
        eleve_id: r.eleve.id,
      }));
  }

  async function doDeleteSlot(id: string, slot: any) {
    const parents = getAffectedParents(slot);
    const pilotNom = slot?.pilote ? `${slot.pilote.prenom} ${slot.pilote.nom}` : "";
    await supabase.from("creneaux").delete().eq("id", id);
    toast.success("Créneau supprimé");
    setShowDetail(null);
    if (parents.length > 0) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slot_cancelled",
          parents,
          date_vol: slot?.date_vol,
          heure_debut: slot?.heure_debut,
          pilote_nom: pilotNom,
        }),
      }).catch(() => {});
    }
    load();
  }

  function handleDeleteSlot(id: string) {
    const slot = showDetail;
    const affected = getAffectedParents(slot);
    setConfirmAction({
      title: "Supprimer le créneau",
      message: `Le créneau du ${slot?.date_vol ?? ""} sera définitivement supprimé.${affected.length > 0 ? `\n${affected.length} parent(s) seront notifiés par email.` : ""}`,
      variant: "danger",
      onConfirm: () => doDeleteSlot(id, slot),
    });
  }

  async function doCancelSlot(id: string, slot: any) {
    const parents = getAffectedParents(slot);
    const pilotNom = slot?.pilote ? `${slot.pilote.prenom} ${slot.pilote.nom}` : "";
    await supabase.from("creneaux").update({ statut: "annule" }).eq("id", id);
    await supabase.from("reservations").update({ statut: "annule" }).eq("creneau_id", id).neq("statut", "annule");
    toast.success("Créneau annulé");
    setShowDetail(null);
    if (parents.length > 0) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slot_cancelled",
          parents,
          date_vol: slot?.date_vol,
          heure_debut: slot?.heure_debut,
          pilote_nom: pilotNom,
        }),
      }).catch(() => {});
    }
    load();
  }

  function handleCancelSlot(id: string) {
    const slot = showDetail;
    const affected = getAffectedParents(slot);
    setConfirmAction({
      title: "Annuler le créneau",
      message: `Le créneau du ${slot?.date_vol ?? ""} sera marqué comme annulé.${affected.length > 0 ? `\n${affected.length} parent(s) seront notifiés par email.` : ""}`,
      variant: "danger",
      onConfirm: () => doCancelSlot(id, slot),
    });
  }

  async function handleEditSlot(updated: any) {
    if (updated.heure_debut && updated.heure_fin && updated.heure_debut >= updated.heure_fin) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    // Collect affected parents from original slot BEFORE updating
    const parents = getAffectedParents(showEditSlot);
    setSaving(true);
    const { error: err } = await supabase.from("creneaux").update({
      date_vol: updated.date_vol,
      heure_debut: updated.heure_debut,
      heure_fin: updated.heure_fin,
      aeronef_id: updated.aeronef_id,
      etablissement_id: updated.etablissement_id || null,
      pilote_id: updated.pilote_id,
      notes_pilote: updated.notes_pilote || null,
      eleves_autorises: updated.eleves_autorises?.length > 0 ? updated.eleves_autorises : null,
    }).eq("id", updated.id);
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success("Créneau modifié");
    setShowEditSlot(null);
    // Notify affected parents about the modification
    if (parents.length > 0) {
      const aeronef = aeronefs.find((a: any) => a.id === updated.aeronef_id);
      const etab = etabs.find((e: any) => e.id === updated.etablissement_id);
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slot_modified",
          parents,
          date_vol: updated.date_vol,
          heure_debut: updated.heure_debut,
          heure_fin: updated.heure_fin,
          aeronef: aeronef ? `${aeronef.type_aeronef} (${aeronef.immatriculation})` : "",
          etablissement: etab?.nom || "",
        }),
      }).catch(() => {});
    }
    load();
  }

  async function handleRemoveEleve(rid: string, name: string) {
    // Capture eleve/slot info before cancelling for the email
    const removedRes = (showDetail?.reservations || []).find((r: any) => r.id === rid);
    await supabase.from("reservations").update({ statut: "annule" }).eq("id", rid);
    toast.success(`${name} retiré du créneau`);
    // Notify the parent (fire-and-forget) — pilote_email omitted intentionally
    if (removedRes?.eleve?.parent_email) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "booking_cancel",
          eleve_id: removedRes.eleve.id ?? null,
          parent_email: removedRes.eleve.parent_email,
          parent_prenom: removedRes.eleve.parent_prenom || "",
          eleve_prenom: removedRes.eleve.prenom,
          eleve_nom: removedRes.eleve.nom,
          type_vol: removedRes.type_vol,
          date_vol: showDetail?.date_vol,
          heure_debut: showDetail?.heure_debut,
          pilote_email: "", // pilot is the one removing — don't notify themselves
          pilote_nom: "",
        }),
      }).catch(() => {});
    }
    const { data } = await supabase
      .from("creneaux")
      .select(
        "*, pilote:profiles!pilote_id(nom,prenom,id,email,telephone), aeronef:aeronefs(*), etablissement:etablissements(nom), reservations(*, eleve:eleves(id,nom,prenom,date_naissance,lieu_naissance,classe,commentaires,vol1_temps_minutes,parent_nom,parent_prenom,parent_email,parent_telephone,etablissement:etablissements(nom)))",
      )
      .eq("id", showDetail.id)
      .single();
    if (data) setShowDetail(data);
    load();
  }
  async function handleAddEleve(eleveId: string, typeVol: 1 | 2) {
    if (!showDetail) return;
    // Check if a cancelled reservation already exists (reactivate it)
    const { data: existing } = await supabase
      .from("reservations")
      .select("id")
      .eq("creneau_id", showDetail.id)
      .eq("eleve_id", eleveId)
      .eq("statut", "annule")
      .maybeSingle();
    let err: any = null;
    if (existing) {
      const { error } = await supabase.from("reservations").update({ statut: "reserve", type_vol: typeVol }).eq("id", existing.id);
      err = error;
    } else {
      const { error } = await supabase.from("reservations").insert({ creneau_id: showDetail.id, eleve_id: eleveId, type_vol: typeVol, statut: "reserve" });
      err = error;
    }
    if (err) { toast.error(err.message); return; }
    const eleve = eleves.find((e: any) => e.id === eleveId);
    toast.success(`${eleve?.prenom} ${eleve?.nom} ajouté au créneau`);
    setShowAddEleve(false);
    setAddEleveSearch("");
    // Refresh detail
    const { data } = await supabase
      .from("creneaux")
      .select("*, pilote:profiles!pilote_id(nom,prenom,id,email,telephone), aeronef:aeronefs(*), etablissement:etablissements(nom), reservations(*, eleve:eleves(id,nom,prenom,date_naissance,lieu_naissance,classe,commentaires,vol1_temps_minutes,parent_nom,parent_prenom,parent_email,parent_telephone,etablissement:etablissements(nom)))")
      .eq("id", showDetail.id)
      .single();
    if (data) setShowDetail(data);
    load();
  }

  async function handleSaveHisto() {
    if (!editHisto) return;
    setSaving(true);
    await supabase
      .from("vols_effectues")
      .update({
        numero_aerogest: editHisto.numero_aerogest,
        temps_vol_minutes: editHisto.temps_vol_minutes,
        nb_eleves: editHisto.nb_eleves,
        prix_total: editHisto.prix_total,
        notes: editHisto.notes,
      })
      .eq("id", editHisto.id);
    setSaving(false);
    setEditHisto(null);
    load();
  }

  const sL: Record<string, string> = {
    ouvert: "Ouvert",
    confirme: "Confirme",
    termine: "Cloture",
    annule: "Annule",
    complet: "Complet",
  };
  const sS: Record<string, string> = {
    ouvert: "bg-amber-50 text-amber-600",
    confirme: "bg-brand-50 text-brand-500",
    termine: "bg-emerald-50 text-emerald-600",
    annule: "bg-red-50 text-red-600",
    complet: "bg-blue-50 text-blue-600",
  };
  const mN = [
    "Janvier",
    "Fevrier",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Aout",
    "Septembre",
    "Octobre",
    "Novembre",
    "Decembre",
  ];
  const cY = new Date().getFullYear(),
    dIM = new Date(cY, calMonth + 1, 0).getDate(),
    fD = (new Date(cY, calMonth, 1).getDay() + 6) % 7;
  const cD: (number | null)[] = [];
  for (let i = 0; i < fD; i++) cD.push(null);
  for (let d = 1; d <= dIM; d++) cD.push(d);
  const fBD: Record<number, any[]> = {};
  filteredDisplayed.forEach((c) => {
    const d = new Date(c.date_vol);
    if (d.getMonth() === calMonth && d.getFullYear() === cY) {
      const day = d.getDate();
      if (!fBD[day]) fBD[day] = [];
      fBD[day].push(c);
    }
  });

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );

  return (
    <div>
      {/* CREATE */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                Nouveau creneau
              </h3>
              <button
                onClick={() => setShowCreate(false)}
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
            <div className="space-y-3">
              {isSA && (
                <div>
                  <label className="label">Pilote *</label>
                  <select
                    value={form.pilote_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pilote_id: e.target.value,
                        aeronef_id: "",
                      })
                    }
                    className="select"
                  >
                    <option value="">— Choisir —</option>
                    {pilotes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.prenom} {p.nom}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Date *</label>
                <input
                  type="date"
                  value={form.date_vol}
                  onChange={(e) =>
                    setForm({ ...form, date_vol: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Debut</label>
                  <input
                    type="time"
                    value={form.heure_debut}
                    onChange={(e) =>
                      setForm({ ...form, heure_debut: e.target.value })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Fin</label>
                  <input
                    type="time"
                    value={form.heure_fin}
                    onChange={(e) =>
                      setForm({ ...form, heure_fin: e.target.value })
                    }
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">
                  Aeronef *{" "}
                  {isSA && !form.pilote_id ? "(choisir un pilote d'abord)" : ""}
                </label>
                <select
                  value={form.aeronef_id}
                  onChange={(e) =>
                    setForm({ ...form, aeronef_id: e.target.value })
                  }
                  className="select"
                  disabled={isSA && !form.pilote_id}
                >
                  <option value="">— Choisir —</option>
                  {availableAeronefs.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.type_aeronef} ({a.immatriculation}) — {a.prix_heure}E/h
                    </option>
                  ))}
                </select>
              </div>
              {/* Établissements (multi-select) */}
              <div>
                <label className="label">Établissements {!isSA ? "*" : ""}</label>
                {!isSA && availableEtabs.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Aucun etablissement assigne. Contactez le SuperAdmin.</p>
                )}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {isSA && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, etablissements: [], elevesByEtab: {} })}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 transition-colors ${form.etablissements.length === 0 ? "bg-brand-50 text-brand-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${form.etablissements.length === 0 ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                        {form.etablissements.length === 0 && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      Tous les établissements
                    </button>
                  )}
                  <div className="max-h-36 overflow-y-auto">
                    {(isSA ? etabs : availableEtabs).map((etab) => {
                      const checked = form.etablissements.includes(etab.id);
                      const etabEleves = eleves.filter((el) => el.etablissement_id === etab.id);
                      const etabElvsSelected = form.elevesByEtab[etab.id] ?? [];
                      return (
                        <div key={etab.id} className="border-b border-gray-50 last:border-0">
                          <button
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? form.etablissements.filter((x) => x !== etab.id)
                                : [...form.etablissements, etab.id];
                              setForm({ ...form, etablissements: next });
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${checked ? "bg-brand-50 text-brand-700 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                          >
                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                              {checked && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>
                            {etab.nom}
                          </button>
                          {/* Per-étab eleves_autorises */}
                          {checked && etabEleves.length > 0 && (
                            <div className="px-3 pb-2 bg-brand-50/50">
                              <p className="text-[10px] text-gray-400 mb-1.5">Restreindre à des élèves spécifiques (optionnel) :</p>
                              <div className="flex flex-wrap gap-1">
                                {etabEleves.map((el) => {
                                  const sel = etabElvsSelected.includes(el.id);
                                  return (
                                    <button
                                      key={el.id}
                                      type="button"
                                      onClick={() => {
                                        const next = sel
                                          ? etabElvsSelected.filter((x) => x !== el.id)
                                          : [...etabElvsSelected, el.id];
                                        setForm({ ...form, elevesByEtab: { ...form.elevesByEtab, [etab.id]: next } });
                                      }}
                                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${sel ? "bg-brand-500 text-white border-brand-500" : "text-gray-600 border-gray-300 hover:border-brand-300"}`}
                                    >
                                      {el.prenom} {el.nom}
                                    </button>
                                  );
                                })}
                              </div>
                              {etabElvsSelected.length > 0 && (
                                <p className="text-[10px] text-brand-500 mt-1">{etabElvsSelected.length} élève{etabElvsSelected.length > 1 ? "s" : ""} sélectionné{etabElvsSelected.length > 1 ? "s" : ""}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {form.etablissements.length > 0 && (
                  <p className="text-xs text-brand-500 mt-1">{form.etablissements.length} établissement{form.etablissements.length > 1 ? "s" : ""} — {form.etablissements.length} créneau{form.etablissements.length > 1 ? "x" : ""} créé{form.etablissements.length > 1 ? "s" : ""}</p>
                )}
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={form.notes_pilote}
                  onChange={(e) =>
                    setForm({ ...form, notes_pilote: e.target.value })
                  }
                  className="input min-h-[60px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowCreate(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateSlot}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}{" "}
                Creer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL */}
      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => { setShowDetail(null); setShowAddEleve(false); }}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                Vol du{" "}
                {new Date(showDetail.date_vol).toLocaleDateString("fr-FR")}
              </h3>
              <button
                onClick={() => { setShowDetail(null); setShowAddEleve(false); }}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Horaire</span>
                <span className="font-medium">
                  {showDetail.heure_debut?.slice(0, 5)} -{" "}
                  {showDetail.heure_fin?.slice(0, 5)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Statut</span>
                <span
                  className={`badge ${sS[showDetail.statut] || "bg-gray-100"}`}
                >
                  {sL[showDetail.statut]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Pilote</span>
                <span className="font-medium">
                  {showDetail.pilote?.prenom} {showDetail.pilote?.nom}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Aeronef</span>
                <span className="font-medium">
                  {showDetail.aeronef?.type_aeronef} (
                  {showDetail.aeronef?.immatriculation})
                </span>
              </div>
              {showDetail.etablissement && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Etablissement</span>
                  <span className="font-medium">
                    {showDetail.etablissement.nom}
                  </span>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">
                  Elèves ({showDetail.reservations?.filter((r: any) => r.statut !== "annule").length || 0})
                </p>
                {showDetail.statut !== "termine" && showDetail.statut !== "annule" && canCreate && (
                  <button
                    onClick={() => { setShowAddEleve(v => !v); setAddEleveSearch(""); }}
                    className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${showAddEleve ? "bg-brand-50 border-brand-200 text-brand-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter un élève
                  </button>
                )}
              </div>
              {showDetail.reservations
                ?.filter((r: any) => r.statut !== "annule")
                .map((r: any, i: number) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg bg-gray-50 mb-2 border border-gray-100"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-bold text-gray-900">
                        {r.eleve?.prenom} {r.eleve?.nom}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="badge bg-brand-50 text-brand-500">
                          Vol {r.type_vol || 1}
                        </span>
                        {showDetail.statut !== "termine" &&
                          (canCreate ||
                            showDetail.pilote_id === profile?.id) && (
                            <button
                              onClick={() =>
                                handleRemoveEleve(
                                  r.id,
                                  `${r.eleve?.prenom} ${r.eleve?.nom}`,
                                )
                              }
                              className="btn-danger btn-sm"
                            >
                              <X className="w-3 h-3" /> Retirer
                            </button>
                          )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
                      <div>
                        <span className="text-gray-400">Ne(e)</span>{" "}
                        <span className="text-gray-700">
                          {r.eleve?.date_naissance &&
                            new Date(r.eleve.date_naissance).toLocaleDateString(
                              "fr-FR",
                            )}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Classe</span>{" "}
                        <span className="text-gray-700">{r.eleve?.classe}</span>
                      </div>
                    </div>
                    {r.eleve?.vol1_temps_minutes && (
                      <div className="p-2 bg-amber-50 rounded text-xs text-amber-700 mb-2">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Vol 1: {r.eleve.vol1_temps_minutes}min — Cible: ~
                        {45 - r.eleve.vol1_temps_minutes}min
                      </div>
                    )}
                    {r.eleve?.commentaires && (
                      <div className="p-2 bg-amber-50 rounded text-xs text-amber-700 mb-2">
                        <AlertCircle className="w-3 h-3 inline mr-1" />
                        {r.eleve.commentaires}
                      </div>
                    )}
                    <div className="p-3 bg-white rounded border border-gray-200 mt-2">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">
                        Parent
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-gray-400" />
                          {r.eleve?.parent_prenom} {r.eleve?.parent_nom}
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <a
                            href={`mailto:${r.eleve?.parent_email}`}
                            className="text-brand-500 hover:underline"
                          >
                            {r.eleve?.parent_email}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-gray-400" />
                          <a
                            href={`tel:${r.eleve?.parent_telephone}`}
                            className="text-brand-500 hover:underline"
                          >
                            {r.eleve?.parent_telephone}
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              {(!showDetail.reservations ||
                showDetail.reservations.filter(
                  (r: any) => r.statut !== "annule",
                ).length === 0) && (
                <p className="text-sm text-gray-400">Aucun eleve</p>
              )}

              {/* ── Add élève panel (superadmin) ── */}
              {showAddEleve && (() => {
                const alreadyIn = new Set(
                  (showDetail.reservations || [])
                    .filter((r: any) => r.statut !== "annule")
                    .map((r: any) => r.eleve_id)
                );
                const q = addEleveSearch.toLowerCase();
                const available = eleves.filter((e: any) => {
                  if (alreadyIn.has(e.id)) return false;
                  if (showDetail.etablissement_id && e.etablissement_id !== showDetail.etablissement_id) return false;
                  if (q && !`${e.prenom} ${e.nom}`.toLowerCase().includes(q)) return false;
                  return true;
                });
                return (
                  <div className="mt-2 p-3 bg-brand-50/40 border border-brand-100 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        value={addEleveSearch}
                        onChange={e => setAddEleveSearch(e.target.value)}
                        placeholder="Rechercher un élève..."
                        className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                      />
                      <select
                        value={addEleveTypeVol}
                        onChange={e => setAddEleveTypeVol(Number(e.target.value) as 1 | 2)}
                        className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
                      >
                        <option value={1}>Vol 1</option>
                        <option value={2}>Vol 2</option>
                      </select>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {available.length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">Aucun élève disponible</p>
                      ) : available.map((e: any) => (
                        <button
                          key={e.id}
                          onClick={() => handleAddEleve(e.id, addEleveTypeVol)}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-lg bg-white border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-all text-left"
                        >
                          <span className="font-medium text-gray-900">{e.prenom} {e.nom}</span>
                          <span className="text-xs text-brand-500 font-medium">+ Ajouter</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            {showDetail.statut !== "termine" &&
              showDetail.statut !== "annule" &&
              (canCreate || showDetail.pilote_id === profile?.id) && (
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setShowDetail(null);
                      setShowClose(showDetail);
                      setCloseForm({
                        ...closeForm,
                        nb_eleves: String(
                          showDetail.reservations?.filter(
                            (r: any) => r.statut !== "annule",
                          ).length || 0,
                        ),
                      });
                    }}
                    className="btn-primary flex-1"
                  >
                    <Check className="w-4 h-4" /> Cloturer
                  </button>
                  <button
                    onClick={() => {
                      setShowDetail(null);
                      setShowEditSlot({
                        ...showDetail,
                        eleves_autorises: showDetail.eleves_autorises || [],
                      });
                    }}
                    className="btn-secondary"
                  >
                    <Edit className="w-4 h-4" /> Modifier
                  </button>
                  <button
                    onClick={() => handleCancelSlot(showDetail.id)}
                    className="btn-secondary"
                  >
                    Annuler vol
                  </button>
                  <button
                    onClick={() => handleDeleteSlot(showDetail.id)}
                    className="btn-danger btn-sm"
                  >
                    Suppr.
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* CLOSE */}
      {showClose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowClose(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                Cloturer le vol
              </h3>
              <button
                onClick={() => setShowClose(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 mb-4 text-sm">
              <p className="font-medium">
                {new Date(showClose.date_vol).toLocaleDateString("fr-FR")} ·{" "}
                {showClose.heure_debut?.slice(0, 5)}
              </p>
              <p className="text-gray-500">
                {showClose.aeronef?.type_aeronef} (
                {showClose.aeronef?.immatriculation})
              </p>
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-3">
              {isSA && (
                <div>
                  <label className="label">Pilote (optionnel — remplace le pilote du créneau)</label>
                  <select value={closeForm.pilote_override} onChange={(e) => setCloseForm({ ...closeForm, pilote_override: e.target.value })} className="select">
                    <option value="">{showClose?.pilote ? `${showClose.pilote.prenom} ${showClose.pilote.nom} (par défaut)` : "— Choisir —"}</option>
                    {pilotes.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">N Aerogest *</label>
                <input
                  value={closeForm.numero_aerogest}
                  onChange={(e) =>
                    setCloseForm({
                      ...closeForm,
                      numero_aerogest: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Temps vol (min) *</label>
                  <input
                    type="number"
                    value={closeForm.temps_vol_minutes}
                    onChange={(e) => {
                      const mins = e.target.value;
                      const prixHeure = showClose?.aeronef?.prix_heure;
                      const auto = prixHeure && mins
                        ? String(Math.round((parseInt(mins) / 60) * prixHeure * 100) / 100)
                        : closeForm.prix_total;
                      setCloseForm({ ...closeForm, temps_vol_minutes: mins, prix_total: auto });
                    }}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Nb eleves</label>
                  <input
                    type="number"
                    value={closeForm.nb_eleves}
                    onChange={(e) =>
                      setCloseForm({ ...closeForm, nb_eleves: e.target.value })
                    }
                    className="input"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label !mb-0">Prix total (€) *</label>
                  {showClose?.aeronef?.prix_heure && (
                    <span className="text-[11px] text-gray-400">
                      Tarif : {showClose.aeronef.prix_heure}€/h
                      {closeForm.temps_vol_minutes && ` · calculé automatiquement`}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={closeForm.prix_total}
                  onChange={(e) =>
                    setCloseForm({ ...closeForm, prix_total: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={closeForm.notes}
                  onChange={(e) =>
                    setCloseForm({ ...closeForm, notes: e.target.value })
                  }
                  className="input min-h-[60px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowClose(null)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleCloseFlight}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}{" "}
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SLOT */}
      {showEditSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowEditSlot(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Modifier le créneau</h3>
              <button onClick={() => setShowEditSlot(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              {isSA && (
                <div>
                  <label className="label">Pilote</label>
                  <select value={showEditSlot.pilote_id} onChange={(e) => setShowEditSlot({ ...showEditSlot, pilote_id: e.target.value })} className="select">
                    <option value="">— Choisir —</option>
                    {pilotes.map((p) => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Date *</label>
                <input type="date" value={showEditSlot.date_vol} onChange={(e) => setShowEditSlot({ ...showEditSlot, date_vol: e.target.value })} className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Début</label><input type="time" value={showEditSlot.heure_debut} onChange={(e) => setShowEditSlot({ ...showEditSlot, heure_debut: e.target.value })} className="input" /></div>
                <div><label className="label">Fin</label><input type="time" value={showEditSlot.heure_fin} onChange={(e) => setShowEditSlot({ ...showEditSlot, heure_fin: e.target.value })} className="input" /></div>
              </div>
              <div>
                <label className="label">Aéronef</label>
                <select value={showEditSlot.aeronef_id} onChange={(e) => setShowEditSlot({ ...showEditSlot, aeronef_id: e.target.value })} className="select">
                  <option value="">— Choisir —</option>
                  {aeronefs.map((a) => <option key={a.id} value={a.id}>{a.type_aeronef} ({a.immatriculation}) — {a.prix_heure}E/h</option>)}
                </select>
              </div>
              <div>
                <label className="label">Établissement</label>
                <select value={showEditSlot.etablissement_id || ""} onChange={(e) => setShowEditSlot({ ...showEditSlot, etablissement_id: e.target.value })} className="select">
                  <option value="">Tous</option>
                  {etabs.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              {/* Student picker */}
              {(() => {
                const elevesDispo = eleves.filter((el) => showEditSlot.etablissement_id ? el.etablissement_id === showEditSlot.etablissement_id : true);
                if (elevesDispo.length === 0) return null;
                const allSelected = (showEditSlot.eleves_autorises || []).length === 0;
                return (
                  <div>
                    <label className="label">Élèves autorisés <span className="normal-case font-normal text-gray-400">(vide = tous)</span></label>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <button type="button" onClick={() => setShowEditSlot({ ...showEditSlot, eleves_autorises: [] })} className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 transition-colors ${allSelected ? "bg-brand-50 text-brand-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}>
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${allSelected ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>{allSelected && <Check className="w-2.5 h-2.5 text-white" />}</span>
                        Tous les élèves
                      </button>
                      <div className="max-h-40 overflow-y-auto">
                        {elevesDispo.map((el) => {
                          const checked = (showEditSlot.eleves_autorises || []).includes(el.id);
                          return (
                            <button key={el.id} type="button" onClick={() => { const next = checked ? (showEditSlot.eleves_autorises || []).filter((x: string) => x !== el.id) : [...(showEditSlot.eleves_autorises || []), el.id]; setShowEditSlot({ ...showEditSlot, eleves_autorises: next }); }} className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-50 last:border-0 transition-colors ${checked ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"}`}>
                              <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>{checked && <Check className="w-2.5 h-2.5 text-white" />}</span>
                              {el.prenom} {el.nom}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div>
                <label className="label">Notes</label>
                <textarea value={showEditSlot.notes_pilote || ""} onChange={(e) => setShowEditSlot({ ...showEditSlot, notes_pilote: e.target.value })} className="input min-h-[60px]" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setShowEditSlot(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => handleEditSlot(showEditSlot)} disabled={saving} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT HISTO */}
      {editHisto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setEditHisto(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Modifier</h3>
              <button
                onClick={() => setEditHisto(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="label">N Aerogest</label>
                <input
                  value={editHisto.numero_aerogest}
                  onChange={(e) =>
                    setEditHisto({
                      ...editHisto,
                      numero_aerogest: e.target.value,
                    })
                  }
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Temps (min)</label>
                  <input
                    type="number"
                    value={editHisto.temps_vol_minutes}
                    onChange={(e) =>
                      setEditHisto({
                        ...editHisto,
                        temps_vol_minutes: parseInt(e.target.value) || 0,
                      })
                    }
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Nb eleves</label>
                  <input
                    type="number"
                    value={editHisto.nb_eleves}
                    onChange={(e) =>
                      setEditHisto({
                        ...editHisto,
                        nb_eleves: parseInt(e.target.value) || 0,
                      })
                    }
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="label">Prix (E)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editHisto.prix_total}
                  onChange={(e) =>
                    setEditHisto({
                      ...editHisto,
                      prix_total: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  value={editHisto.notes || ""}
                  onChange={(e) =>
                    setEditHisto({ ...editHisto, notes: e.target.value })
                  }
                  className="input min-h-[60px]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button
                onClick={() => setEditHisto(null)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveHisto}
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

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isPilote && !isSA ? "Mes creneaux" : "Planning des vols"}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {(() => {
              const activeCount = filteredDisplayed.filter(c => c.statut !== "termine" && c.statut !== "annule").length;
              const totalActive = displayed.filter(c => c.statut !== "termine" && c.statut !== "annule").length;
              return <>
                {activeCount} créneau{activeCount > 1 ? "x" : ""} actif{activeCount > 1 ? "s" : ""}
                {hasFilters && totalActive !== activeCount && (
                  <span className="text-gray-400"> / {totalActive} total</span>
                )}
              </>;
            })()}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {[
              { k: "list", l: "Liste", i: List },
              { k: "calendar", l: "Calendrier", i: Calendar },
              ...((isSA || isPilote)
                ? [{ k: "historique", l: "Historique", i: History }]
                : []),
            ].map(({ k, l, i: I }: any) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === k ? "bg-white text-brand-500 shadow-sm" : "text-gray-500"}`}
              >
                <I className="w-3.5 h-3.5" />
                {l}
              </button>
            ))}
          </div>
          {canCreate && (
            <button
              onClick={() => {
                setError(null);
                setShowCreate(true);
              }}
              className="btn-primary btn-sm"
            >
              <Plus className="w-3.5 h-3.5" /> Nouveau créneau
            </button>
          )}
        </div>
      </div>

      {/* FILTERS — visible to SA/coordinateur/gérant */}
      {(isSA || isCoord || isGerant) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex flex-wrap gap-2 items-end">
            {(isSA || isCoord) && (
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pilote</label>
                <select
                  value={filterPilote}
                  onChange={(e) => setFilterPilote(e.target.value)}
                  className="select text-sm py-1.5"
                >
                  <option value="">Tous</option>
                  {pilotes.map((p) => (
                    <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aéronef</label>
              <select
                value={filterAeronef}
                onChange={(e) => setFilterAeronef(e.target.value)}
                className="select text-sm py-1.5"
              >
                <option value="">Tous</option>
                {aeronefs.map((a) => (
                  <option key={a.id} value={a.id}>{a.type_aeronef} ({a.immatriculation})</option>
                ))}
              </select>
            </div>
            {(isSA || isCoord) && (
              <div className="flex flex-col gap-1 min-w-[160px]">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Établissement</label>
                <select
                  value={filterEtab}
                  onChange={(e) => setFilterEtab(e.target.value)}
                  className="select text-sm py-1.5"
                >
                  <option value="">Tous</option>
                  {etabs.map((e) => (
                    <option key={e.id} value={e.id}>{e.nom}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1 min-w-[120px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</label>
              <select
                value={filterStatut}
                onChange={(e) => setFilterStatut(e.target.value)}
                className="select text-sm py-1.5"
              >
                <option value="">Tous</option>
                <option value="planifie">Planifié</option>
                <option value="confirme">Confirmé</option>
                <option value="termine">Terminé</option>
                <option value="annule">Annulé</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Du</label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[130px]">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Au</label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="input text-sm py-1.5"
              />
            </div>
            {hasFilters && (
              <button
                onClick={() => {
                  setFilterPilote("");
                  setFilterAeronef("");
                  setFilterEtab("");
                  setFilterStatut("");
                  setFilterDateFrom("");
                  setFilterDateTo("");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors self-end"
              >
                <X className="w-3.5 h-3.5" /> Réinitialiser
              </button>
            )}
          </div>
          {hasFilters && mode !== "historique" && (
            <p className="text-xs text-brand-500 mt-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> {filteredDisplayed.length} résultat{filteredDisplayed.length !== 1 ? "s" : ""} sur {displayed.length}
            </p>
          )}
        </div>
      )}

      {/* LIST */}
      {mode === "list" && (() => {
        const activeSlots = filteredDisplayed.filter((c) => !["termine", "annule"].includes(c.statut));
        const pastSlots = filteredDisplayed.filter((c) => ["termine", "annule"].includes(c.statut));
        const SlotCard = ({ c }: { c: any }) => (
          <div
            key={c.id}
            onClick={() => setShowDetail(c)}
            className="card flex items-center justify-between flex-wrap gap-3 p-4 cursor-pointer hover:border-brand-200 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1 min-w-[260px]">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${(sS[c.statut] || "bg-gray-100").split(" ")[0]}`}
              >
                <Plane
                  className={`w-5 h-5 ${(sS[c.statut] || "text-gray-500").split(" ")[1]}`}
                />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {new Date(c.date_vol).toLocaleDateString("fr-FR")} ·{" "}
                  {c.heure_debut?.slice(0, 5)} - {c.heure_fin?.slice(0, 5)}
                </p>
                <p className="text-xs text-gray-500">
                  {c.pilote?.prenom} {c.pilote?.nom} ·{" "}
                  {c.aeronef?.type_aeronef} ({c.aeronef?.immatriculation})
                </p>
                {c.reservations?.filter((r: any) => r.statut !== "annule")
                  .length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.reservations
                      .filter((r: any) => r.statut !== "annule")
                      .map((r: any) => `${r.eleve?.prenom} ${r.eleve?.nom}`)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
            <span
              className={`badge ${sS[c.statut] || "bg-gray-100 text-gray-500"}`}
            >
              {sL[c.statut] || c.statut}
            </span>
          </div>
        );
        return (
          <div className="flex flex-col gap-2.5">
            {activeSlots.length === 0 && pastSlots.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                <Plane className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>Aucun creneau</p>
              </div>
            ) : (
              <>
                {activeSlots.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">Aucun créneau actif</p>
                )}
                {activeSlots.map((c) => <SlotCard key={c.id} c={c} />)}
                {pastSlots.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none py-2 px-1 hover:text-gray-600">
                      Terminés / Annulés ({pastSlots.length})
                    </summary>
                    <div className="flex flex-col gap-2.5 mt-2 opacity-70">
                      {pastSlots.map((c) => <SlotCard key={c.id} c={c} />)}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* CALENDAR */}
      {mode === "calendar" && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <button
              onClick={() => setCalMonth((m) => Math.max(0, m - 1))}
              className="p-1.5 rounded-md bg-brand-50 text-brand-500 text-sm font-semibold"
            >
              ‹
            </button>
            <span className="text-sm font-bold text-gray-900">
              {mN[calMonth]} {cY}
            </span>
            <button
              onClick={() => setCalMonth((m) => Math.min(11, m + 1))}
              className="p-1.5 rounded-md bg-brand-50 text-brand-500 text-sm font-semibold"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div
                key={d}
                className="px-1 py-2 text-center text-[10px] font-bold uppercase text-gray-400 bg-gray-50"
              >
                {d}
              </div>
            ))}
            {cD.map((d, i) => {
              const fls = d ? fBD[d] || [] : [];
              return (
                <div
                  key={i}
                  className={`min-h-[78px] p-1 border-t border-gray-100 ${(i + 1) % 7 !== 0 ? "border-r" : ""} ${d ? "bg-white" : "bg-gray-50 opacity-30"}`}
                >
                  {d && (
                    <>
                      <div className="text-xs text-right pr-1 mb-1 text-gray-500">
                        {d}
                      </div>
                      {fls.map((f: any, fi: number) => (
                        <div
                          key={fi}
                          onClick={() => setShowDetail(f)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold mb-0.5 truncate cursor-pointer ${sS[f.statut] || "bg-gray-100"}`}
                        >
                          {f.heure_debut?.slice(0, 5)} · {f.pilote?.nom}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* HISTORIQUE */}
      {mode === "historique" && (isSA || isPilote) && (() => {
        // Aerogest numbers already covered by vols_effectues
        const aerogestInVols = new Set<string>(volsHisto.map((v: any) => v.numero_aerogest).filter(Boolean));

        // Build manual groups from eleve vol1/vol2 fields (grouped by numero_aerogest, excluding those already in vols_effectues)
        const manualByAerogest: Record<string, { ids: string[]; noms: string[]; numero_aerogest: string; prix_total: number; temps: number | null; pilote: string; aeronef_label: string; etab_ids: string[] }> = {};
        for (const e of eleves) {
          if (e.vol1_effectue && e.vol1_numero_aerogest && !aerogestInVols.has(e.vol1_numero_aerogest)) {
            if (!manualByAerogest[e.vol1_numero_aerogest]) {
              const a = e.vol1_aeronef_id ? aeronefs.find((x: any) => x.id === e.vol1_aeronef_id) : null;
              manualByAerogest[e.vol1_numero_aerogest] = { ids: [], noms: [], numero_aerogest: e.vol1_numero_aerogest, prix_total: 0, temps: e.vol1_temps_minutes || null, pilote: e.vol1_pilote_nom || "", aeronef_label: a ? `${a.type_aeronef} (${a.immatriculation})` : "", etab_ids: [] };
            }
            const g = manualByAerogest[e.vol1_numero_aerogest];
            g.ids.push(`${e.id}_vol1`);
            g.noms.push(`${e.prenom} ${e.nom}`);
            if (!g.prix_total) g.prix_total = e.vol1_prix ? parseFloat(e.vol1_prix) : 0;
            if (e.etablissement_id && !g.etab_ids.includes(e.etablissement_id)) g.etab_ids.push(e.etablissement_id);
          }
          if (e.vol2_effectue && e.vol2_numero_aerogest && !aerogestInVols.has(e.vol2_numero_aerogest)) {
            if (!manualByAerogest[e.vol2_numero_aerogest]) {
              const a = e.vol2_aeronef_id ? aeronefs.find((x: any) => x.id === e.vol2_aeronef_id) : null;
              manualByAerogest[e.vol2_numero_aerogest] = { ids: [], noms: [], numero_aerogest: e.vol2_numero_aerogest, prix_total: 0, temps: e.vol2_temps_minutes || null, pilote: e.vol2_pilote_nom || "", aeronef_label: a ? `${a.type_aeronef} (${a.immatriculation})` : "", etab_ids: [] };
            }
            const g = manualByAerogest[e.vol2_numero_aerogest];
            g.ids.push(`${e.id}_vol2`);
            g.noms.push(`${e.prenom} ${e.nom}`);
            if (!g.prix_total) g.prix_total = e.vol2_prix ? parseFloat(e.vol2_prix) : 0;
            if (e.etablissement_id && !g.etab_ids.includes(e.etablissement_id)) g.etab_ids.push(e.etablissement_id);
          }
        }

        // Resolve pilote filter to a name (manual groups store pilote as a string name, not UUID)
        const filterPiloteNom = filterPilote ? (() => { const p = pilotes.find((x: any) => x.id === filterPilote); return p ? `${p.prenom} ${p.nom}` : null; })() : null;

        // Apply filters to manual groups
        const filteredManual = Object.values(manualByAerogest).filter(g => {
          if (filterEtab && !g.etab_ids.includes(filterEtab)) return false;
          if (filterPiloteNom && g.pilote !== filterPiloteNom) return false;
          return true;
        });

        // For non-SA pilots: restrict to their own flights only
        const myPiloteNom = isPilote && !isSA ? `${profile.prenom} ${profile.nom}` : null;
        const histoToShow = myPiloteNom ? filteredHisto.filter((v: any) => v.creneau?.pilote_id === profile?.id) : filteredHisto;
        const manualToShow = myPiloteNom ? filteredManual.filter(g => g.pilote === myPiloteNom) : filteredManual;

        // Count occurrences of each numero_aerogest in histoToShow (for ×N detection)
        const aerogestCount: Record<string, number> = {};
        for (const v of histoToShow) {
          if (v.numero_aerogest) aerogestCount[v.numero_aerogest] = (aerogestCount[v.numero_aerogest] || 0) + 1;
        }

        const sharedCountVol = histoToShow.filter((v: any) => v.nb_eleves && v.nb_eleves > 1).length;
        const sharedCountManual = manualToShow.filter(g => g.ids.length > 1).length;
        const totalShared = sharedCountVol + sharedCountManual;
        const totalRows = histoToShow.length + manualToShow.length;

        function exportComptaCSV() {
          const headers = ["Date", "Pilote", "Aeronef", "Eleves", "N Aerogest", "Nb partages", "Prix vol total (€)", "Prix par élève (€)", "Temps (min)", "Source"];
          const rows: any[][] = [];
          histoToShow.forEach((v) => {
            const n = v.nb_eleves && v.nb_eleves > 1 ? v.nb_eleves : 1;
            const prixEleve = v.prix_total ? (parseFloat(v.prix_total) / n).toFixed(2) : "";
            rows.push([
              v.creneau?.date_vol ? new Date(v.creneau.date_vol).toLocaleDateString("fr-FR") : "",
              v.creneau?.pilote ? `${v.creneau.pilote.prenom} ${v.creneau.pilote.nom}` : "",
              v.creneau?.aeronef?.type_aeronef || "",
              v.creneau?.reservations?.map((r: any) => `${r.eleve?.prenom} ${r.eleve?.nom}`).join(", ") || "",
              v.numero_aerogest || "",
              n,
              v.prix_total || "",
              prixEleve,
              v.temps_vol_minutes || "",
              "planning",
            ]);
          });
          manualToShow.forEach((g) => {
            const n = g.ids.length;
            const prixEleve = n > 0 ? (g.prix_total / n).toFixed(2) : "";
            rows.push(["", g.pilote, g.aeronef_label, g.noms.join(", "), g.numero_aerogest, n, g.prix_total.toFixed(2), prixEleve, g.temps || "", "manuel"]);
          });
          const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
          const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
          const a = document.createElement("a"); a.href = url;
          a.download = `compta_vols_${new Date().toISOString().slice(0,10)}.csv`;
          a.click(); URL.revokeObjectURL(url);
        }

        return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {totalShared > 0 && (
                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-medium">
                  ⚠ {totalShared} N° Aérogest partagé(s) — prix divisé par élève
                </span>
              )}
            </p>
            {isSA && <button onClick={exportComptaCSV} className="btn-secondary btn-sm flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export compta CSV
            </button>}
          </div>
          <div className="card p-0 overflow-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-gray-50">
                {["Date", "Pilote", "Aeronef", "Eleves", "N Aerogest", "Temps", "Prix vol", "Prix/élève", "Notes", ""].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {totalRows === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-12 text-center text-gray-400">Aucun vol</td>
                </tr>
              ) : (
                <>
                  {histoToShow.map((v) => {
                    const n = v.nb_eleves && v.nb_eleves > 1 ? v.nb_eleves : 1;
                    const prixEleve = v.prix_total ? parseFloat(v.prix_total) / n : null;
                    const isShared = n > 1;
                    return (
                      <tr key={v.id} className={`border-t border-gray-100 hover:bg-gray-50 ${isShared ? "bg-amber-50/30" : ""}`}>
                        <td className="px-3 py-2.5 font-medium">{v.creneau?.date_vol && new Date(v.creneau.date_vol).toLocaleDateString("fr-FR")}</td>
                        <td className="px-3 py-2.5">{v.creneau?.pilote?.prenom} {v.creneau?.pilote?.nom}</td>
                        <td className="px-3 py-2.5 text-gray-500">{v.creneau?.aeronef?.type_aeronef}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{v.creneau?.reservations?.map((r: any) => `${r.eleve?.prenom} ${r.eleve?.nom}`).join(", ") || "—"}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          <span>{v.numero_aerogest}</span>
                          {isShared && <span className="ml-1.5 inline-flex items-center bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">×{n}</span>}
                        </td>
                        <td className="px-3 py-2.5">{v.temps_vol_minutes}min</td>
                        <td className="px-3 py-2.5 text-gray-500">{v.prix_total}€</td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-700">
                          {prixEleve !== null ? (
                            <span>{prixEleve % 1 === 0 ? prixEleve : prixEleve.toFixed(2)}€{isShared && <span className="text-[10px] font-normal text-amber-600 ml-1">÷{n}</span>}</span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{v.notes || "—"}</td>
                        <td className="px-3 py-2.5">
                          {isSA && <button onClick={() => setEditHisto({ ...v })} className="btn-secondary btn-sm"><Edit className="w-3 h-3" /></button>}
                        </td>
                      </tr>
                    );
                  })}
                  {manualToShow.map((g) => {
                    const n = g.ids.length;
                    const isShared = n > 1;
                    const prixEleve = n > 0 && g.prix_total > 0 ? g.prix_total / n : null;
                    return (
                      <tr key={g.numero_aerogest} className={`border-t border-gray-100 hover:bg-gray-50 bg-blue-50/20 ${isShared ? "bg-amber-50/30" : ""}`}>
                        <td className="px-3 py-2.5 text-gray-400 text-[10px] italic">manuel</td>
                        <td className="px-3 py-2.5">{g.pilote || "—"}</td>
                        <td className="px-3 py-2.5 text-gray-500">{g.aeronef_label || "—"}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs">{g.noms.join(", ")}</td>
                        <td className="px-3 py-2.5 font-mono text-xs">
                          <span>{g.numero_aerogest}</span>
                          {isShared && <span className="ml-1.5 inline-flex items-center bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">×{n}</span>}
                        </td>
                        <td className="px-3 py-2.5">{g.temps ? `${g.temps}min` : "—"}</td>
                        <td className="px-3 py-2.5 text-gray-500">{g.prix_total > 0 ? `${g.prix_total.toFixed(2)}€` : "—"}</td>
                        <td className="px-3 py-2.5 font-semibold text-emerald-700">
                          {prixEleve !== null ? (
                            <span>{prixEleve % 1 === 0 ? prixEleve : prixEleve.toFixed(2)}€{isShared && <span className="text-[10px] font-normal text-amber-600 ml-1">÷{n}</span>}</span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">—</td>
                        <td className="px-3 py-2.5"></td>
                      </tr>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>
          </div>
        </div>
        );
      })()}
      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        variant={confirmAction?.variant}
        loading={confirmLoading}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          if (!confirmAction) return;
          setConfirmLoading(true);
          await confirmAction.onConfirm();
          setConfirmLoading(false);
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
