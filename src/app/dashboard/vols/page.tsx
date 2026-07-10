"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useYear } from "@/contexts/YearContext";
import { matchDesiderata } from "@/components/DesiderataGrid";
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
  Trash2,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

export default function VolsPage() {
  const supabase = createClient();
  const { selectedAnneeId, activeAnneeId } = useYear();
  // anneeId = active year used when creating new slots
  const anneeId = activeAnneeId;
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [volsHisto, setVolsHisto] = useState<any[]>([]);
  const [aeronefs, setAeronefs] = useState<any[]>([]);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [pilotes, setPilotes] = useState<any[]>([]);
  const [qualifs, setQualifs] = useState<any[]>([]);
  const [piloteEtabs, setPiloteEtabs] = useState<any[]>([]);
  const [biaExamDate, setBiaExamDate] = useState<string>("");
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "calendar" | "historique">("list");
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [showClose, setShowClose] = useState<any>(null);
  const [showEditSlot, setShowEditSlot] = useState<any>(null);
  const [editHisto, setEditHisto] = useState<any>(null);
  const [editHistoElevesLocal, setEditHistoElevesLocal] = useState<any[]>([]);
  const [editHistoElevesOrig, setEditHistoElevesOrig] = useState<any[]>([]);
  const [addHistoEleveId, setAddHistoEleveId] = useState("");
  const [addHistoEleveTypeVol, setAddHistoEleveTypeVol] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; variant?: "danger" | "primary"; reasonLabel?: string; onConfirm: (reason?: string) => void } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [calView, setCalView] = useState<"week" | "month">("week");
  const [calWeekStart, setCalWeekStart] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  });
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

    let creneauxQuery = supabase
      .from("creneaux")
      .select(
        "*, pilote:profiles!pilote_id(nom,prenom,id,email,telephone), aeronef:aeronefs(*), etablissement:etablissements(nom), reservations(*, eleve:eleves(id,nom,prenom,date_naissance,lieu_naissance,classe,commentaires,vol1_temps_minutes,parent_nom,parent_prenom,parent_email,parent_telephone,etablissement:etablissements(nom)))",
      )
      .order("date_vol", { ascending: true })
      .order("heure_debut", { ascending: true });
    if (selectedAnneeId) creneauxQuery = creneauxQuery.eq("annee_id", selectedAnneeId);

    let elevesQuery = supabase
      .from("eleves")
      .select("id, nom, prenom, etablissement_id, desiderata, abandonne, bia_resultat, vol2_autorise, vol1_effectue, vol1_numero_aerogest, vol1_prix, vol1_temps_minutes, vol1_pilote_nom, vol1_aeronef_id, vol2_effectue, vol2_numero_aerogest, vol2_prix, vol2_temps_minutes, vol2_pilote_nom, vol2_aeronef_id")
      .eq("archive", false)
      .order("nom");
    if (selectedAnneeId) elevesQuery = elevesQuery.eq("annee_id", selectedAnneeId);

    const [profRes, crRes, aRes, eRes, vhRes, pRes, qRes, peRes, elRes] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        creneauxQuery,
        supabase.from("aeronefs").select("*").eq("actif", true),
        supabase.from("etablissements").select("*").eq("actif", true),
        supabase
          .from("vols_effectues")
          .select(
            "*, creneau:creneaux(date_vol,heure_debut,heure_fin,pilote_id,aeronef_id,etablissement_id,pilote:profiles!pilote_id(nom,prenom),aeronef:aeronefs(type_aeronef,immatriculation),etablissement:etablissements(nom),reservations(id,type_vol,statut,eleve:eleves(id,nom,prenom)))",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, nom, prenom, email, telephone")
          .contains("roles", ["pilote"])
          .eq("actif", true)
          .order("nom"),
        supabase.from("pilote_qualifications").select("pilote_id, aeronef_id"),
        supabase
          .from("pilote_etablissements")
          .select("pilote_id, etablissement_id"),
        elevesQuery,
      ]);
    setProfile(profRes.data);
    setCreneaux(crRes.data || []);
    setAeronefs(aRes.data || []);
    setEtabs(eRes.data || []);
    setVolsHisto((vhRes.data || []).sort((a: any, b: any) => {
      const da = `${a.creneau?.date_vol ?? ""}${a.creneau?.heure_debut ?? ""}`;
      const db = `${b.creneau?.date_vol ?? ""}${b.creneau?.heure_debut ?? ""}`;
      return db.localeCompare(da); // desc: plus récent en premier
    }));
    setPilotes(pRes.data || []);
    setQualifs(qRes.data || []);
    setPiloteEtabs(peRes.data || []);
    setEleves(elRes.data || []);
    setLoading(false);

    // Charger la date BIA séparément (RLS variable selon le rôle — non bloquant)
    try {
      const { data: biaParam } = await supabase
        .from("parametres").select("valeur").eq("cle", "date_examen_bia").maybeSingle();
      setBiaExamDate(biaParam?.valeur || "");
    } catch { /* RLS : la date BIA reste vide, pas de filtrage */ }
  }

  useEffect(() => {
    if (selectedAnneeId) load();
  }, [selectedAnneeId]);

  const isPilote = profile?.roles?.includes("pilote");
  const isSA = profile?.roles?.includes("superadmin");
  const isCoord = profile?.roles?.includes("coordinateur") && !isSA;
  const isGerant = profile?.roles?.includes("gerant") && !isSA && !isCoord;
  const etabIdsFromProfile = (ids: any, id: any): string[] =>
    ids?.length > 0 ? ids : id ? [id] : [];
  const coordEtabIds = etabIdsFromProfile(profile?.etablissement_ids, profile?.etablissement_id);
  const gerantEtabIds = etabIdsFromProfile(profile?.etablissement_ids, profile?.etablissement_id);
  const canCreate = isPilote || isSA;
  // SA + pilotes → all | coordinateur → leurs étabs | gérant → leur étab
  // Pilote prend la priorité sur coordinateur/gérant : un pilote voit TOUT le planning
  const displayed =
    isSA || isPilote
      ? creneaux
      : isCoord && coordEtabIds.length > 0
        ? creneaux.filter((c) => coordEtabIds.includes(c.etablissement_id))
        : isGerant && gerantEtabIds.length > 0
          ? creneaux.filter((c) => gerantEtabIds.includes(c.etablissement_id))
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

  // Students already on an active slot (not cancelled/terminated) — hide from eleves_autorises picker
  const busyEleveIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of creneaux) {
      if (c.statut === "annule" || c.statut === "termine") continue;
      for (const r of (c.reservations || [])) {
        if (r.statut !== "annule" && r.eleve?.id) ids.add(r.eleve.id);
      }
    }
    return ids;
  }, [creneaux]);

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
      setError("Date et aéronef obligatoires.");
      return;
    }
    if (form.date_vol < new Date().toISOString().slice(0, 10)) {
      setError("La date du vol ne peut pas être dans le passé.");
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
    // Check overlap: same pilot OR same aircraft on the same day with overlapping time
    const overlap = creneaux.find((c) => {
      if (c.statut === "annule" || c.statut === "termine") return false;
      if (c.date_vol !== form.date_vol) return false;
      const sameActor = c.pilote_id === piloteId || c.aeronef_id === form.aeronef_id;
      if (!sameActor) return false;
      // Time overlap: existing [cStart, cEnd) overlaps new [newStart, newEnd)
      const cStart = c.heure_debut?.slice(0, 5) ?? "00:00";
      const cEnd = c.heure_fin?.slice(0, 5) ?? "23:59";
      const newStart = form.heure_debut;
      const newEnd = form.heure_fin;
      return newStart < cEnd && newEnd > cStart;
    });
    if (overlap) {
      const who = overlap.pilote_id === piloteId ? "ce pilote" : "cet aéronef";
      const t = `${overlap.heure_debut?.slice(0, 5)}–${overlap.heure_fin?.slice(0, 5)}`;
      setError(`Chevauchement détecté : ${who} a déjà un créneau de ${t} ce jour-là.`);
      return;
    }
    const aeronef = aeronefs.find((a) => a.id === form.aeronef_id);
    const piloteObj = pilotes.find((p: any) => p.id === piloteId) || (isSA ? null : profile);
    const piloteNom = piloteObj ? `${piloteObj.prenom} ${piloteObj.nom}` : "";
    const aeronefObj = aeronefs.find((a: any) => a.id === form.aeronef_id);
    const aeronefLabel = aeronefObj ? `${aeronefObj.type_aeronef} (${aeronefObj.immatriculation})` : "";
    // Merge all per-étab eleves_autorises into one flat array
    const allEleveAut: string[] = [];
    for (const etabId of form.etablissements) {
      const ea = form.elevesByEtab[etabId];
      if (ea?.length > 0) allEleveAut.push(...ea);
    }
    const eleveAut = allEleveAut.length > 0 ? allEleveAut : null;
    const etabIds = form.etablissements.length > 0 ? form.etablissements : null;
    // Single établissement_id for FK compat (null if multi or none)
    const singleEtabId = form.etablissements.length === 1 ? form.etablissements[0] : null;
    setSaving(true);
    const { data: created, error: err } = await supabase.from("creneaux").insert({
      pilote_id: piloteId,
      aeronef_id: form.aeronef_id,
      annee_id: anneeId,
      etablissement_id: singleEtabId,
      etablissement_ids: etabIds,
      date_vol: form.date_vol,
      heure_debut: form.heure_debut,
      heure_fin: form.heure_fin,
      places_disponibles: aeronef?.nb_places_eleves || 2,
      notes_pilote: form.notes_pilote || null,
      eleves_autorises: eleveAut,
    }).select("id").single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    // Notify eligible parents (anti-spam: only if no open slots already existed for this scope)
    fetch("/api/email/notify-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creneau_id: created?.id,
        etablissement_id: singleEtabId,
        etablissement_ids: etabIds,
        eleves_autorises: eleveAut,
        date_vol: form.date_vol,
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin,
        pilote_nom: piloteNom,
        aeronef: aeronefLabel,
      }),
    }).catch(() => {});
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
      onConfirm: (_r?: string) => doCloseFlight(),
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

  async function doDeleteSlot(id: string, slot: any, motif?: string) {
    const parents = getAffectedParents(slot);
    const pilotNom = slot?.pilote ? `${slot.pilote.prenom} ${slot.pilote.nom}` : "";
    if (motif) {
      await supabase.from("creneaux").update({ motif_annulation: motif }).eq("id", id);
    }
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
          pilote_email: slot?.pilote?.email || "",
          pilote_telephone: slot?.pilote?.telephone || "",
          motif: motif || undefined,
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
      reasonLabel: affected.length > 0 ? "Motif de suppression (optionnel, visible dans l'email)" : undefined,
      onConfirm: (motif) => doDeleteSlot(id, slot, motif),
    });
  }

  async function doCancelSlot(id: string, slot: any, motif?: string) {
    const parents = getAffectedParents(slot);
    const pilotNom = slot?.pilote ? `${slot.pilote.prenom} ${slot.pilote.nom}` : "";
    await supabase.from("creneaux").update({ statut: "annule", ...(motif ? { motif_annulation: motif } : {}) }).eq("id", id);
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
          pilote_email: slot?.pilote?.email || "",
          pilote_telephone: slot?.pilote?.telephone || "",
          motif: motif || undefined,
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
      reasonLabel: "Motif d'annulation (optionnel, visible dans l'email)",
      onConfirm: (motif) => doCancelSlot(id, slot, motif),
    });
  }

  async function handleEditSlot(updated: any) {
    if (updated.heure_debut && updated.heure_fin && updated.heure_debut >= updated.heure_fin) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    // Check overlap (excluding this slot itself)
    const editOverlap = creneaux.find((c) => {
      if (c.id === updated.id) return false;
      if (c.statut === "annule" || c.statut === "termine") return false;
      if (c.date_vol !== updated.date_vol) return false;
      const sameActor = c.pilote_id === updated.pilote_id || c.aeronef_id === updated.aeronef_id;
      if (!sameActor) return false;
      const cStart = c.heure_debut?.slice(0, 5) ?? "00:00";
      const cEnd = c.heure_fin?.slice(0, 5) ?? "23:59";
      const newStart = updated.heure_debut?.slice(0, 5);
      const newEnd = updated.heure_fin?.slice(0, 5);
      return newStart < cEnd && newEnd > cStart;
    });
    if (editOverlap) {
      const who = editOverlap.pilote_id === updated.pilote_id ? "ce pilote" : "cet aéronef";
      const t = `${editOverlap.heure_debut?.slice(0, 5)}–${editOverlap.heure_fin?.slice(0, 5)}`;
      toast.error(`Chevauchement : ${who} a déjà un créneau de ${t} ce jour-là.`);
      return;
    }
    // Collect affected parents from original slot BEFORE updating
    const parents = getAffectedParents(showEditSlot);
    // Build merged eleves_autorises from elevesByEtab (if user changed per-etab selection)
    const allEleveAut: string[] = [];
    for (const etabId of (updated.etablissements || [])) {
      const ea = (updated.elevesByEtab || {})[etabId];
      if (ea?.length > 0) allEleveAut.push(...ea);
    }
    // If user didn't touch per-etab eleves keep existing flat list
    const eleveAut = allEleveAut.length > 0
      ? allEleveAut
      : (updated.eleves_autorises?.length > 0 ? updated.eleves_autorises : null);
    const etabIds = updated.etablissements?.length > 0 ? updated.etablissements : null;
    const singleEtabId = updated.etablissements?.length === 1 ? updated.etablissements[0] : null;
    setSaving(true);
    const { error: err } = await supabase.from("creneaux").update({
      date_vol: updated.date_vol,
      heure_debut: updated.heure_debut,
      heure_fin: updated.heure_fin,
      aeronef_id: updated.aeronef_id,
      etablissement_id: singleEtabId,
      etablissement_ids: etabIds,
      pilote_id: updated.pilote_id,
      notes_pilote: updated.notes_pilote || null,
      eleves_autorises: eleveAut,
    }).eq("id", updated.id);
    setSaving(false);
    if (err) { toast.error(err.message); return; }
    toast.success("Créneau modifié");
    setShowEditSlot(null);
    // Notify affected parents only if date/time/aeronef changed (not just notes)
    const slotChanged =
      updated.date_vol !== showEditSlot.date_vol ||
      updated.heure_debut !== showEditSlot.heure_debut ||
      updated.heure_fin !== showEditSlot.heure_fin ||
      updated.aeronef_id !== showEditSlot.aeronef_id;
    const aeronefObj = aeronefs.find((a: any) => a.id === updated.aeronef_id);
    const etabObj = etabs.find((e: any) => e.id === updated.etablissement_id);
    if (parents.length > 0 && slotChanged) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "slot_modified",
          parents,
          date_vol: updated.date_vol,
          heure_debut: updated.heure_debut,
          heure_fin: updated.heure_fin,
          aeronef: aeronefObj ? `${aeronefObj.type_aeronef} (${aeronefObj.immatriculation})` : "",
          etablissement: etabObj?.nom || "",
        }),
      }).catch(() => {});
    }
    // Emails swap pilote : parents + ancien pilote + nouveau pilote
    const pilotChanged = updated.pilote_id !== showEditSlot.pilote_id;
    if (pilotChanged) {
      const newPilote = pilotes.find((p: any) => p.id === updated.pilote_id);
      const oldPilote = showEditSlot.pilote; // { nom, prenom, email, telephone } depuis le JOIN
      const eleves_du_creneau = parents.map((p: any) => `${p.eleve_prenom} ${p.eleve_nom}`);
      const swapPayload = {
        date_vol: updated.date_vol,
        heure_debut: updated.heure_debut,
        heure_fin: updated.heure_fin,
        aeronef: aeronefObj ? `${aeronefObj.type_aeronef} (${aeronefObj.immatriculation})` : "",
        etablissement: etabObj?.nom || "",
        new_pilote_nom: newPilote ? `${newPilote.prenom} ${newPilote.nom}` : "",
        new_pilote_email: newPilote?.email || "",
        new_pilote_telephone: newPilote?.telephone || "",
        old_pilote_nom: oldPilote ? `${oldPilote.prenom} ${oldPilote.nom}` : "",
        old_pilote_email: oldPilote?.email || "",
        eleves_du_creneau,
      };
      // Email aux parents
      if (parents.length > 0) {
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "pilot_changed", parents, ...swapPayload }),
        }).catch(() => {});
      }
      // Email au nouveau pilote avec les infos élèves
      if (newPilote?.email) {
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pilot_swap_new",
            eleves_details: (showEditSlot.reservations || [])
              .filter((r: any) => r.statut !== "annule" && r.eleve)
              .map((r: any) => ({
                prenom: r.eleve.prenom,
                nom: r.eleve.nom,
                parent_nom: r.eleve.parent_nom,
                parent_prenom: r.eleve.parent_prenom,
                parent_email: r.eleve.parent_email,
                parent_telephone: r.eleve.parent_telephone,
                type_vol: r.type_vol,
              })),
            pilote_email: newPilote.email,
            pilote_prenom: newPilote.prenom,
            ...swapPayload,
          }),
        }).catch(() => {});
      }
      // Email à l'ancien pilote — confirmation du swap
      if (oldPilote?.email) {
        fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "pilot_swap_old",
            pilote_email: oldPilote.email,
            pilote_prenom: oldPilote.prenom,
            ...swapPayload,
          }),
        }).catch(() => {});
      }
    }
    load();
  }

  async function handleNotifySlot(slot: any) {
    const aeronefObj = aeronefs.find((a: any) => a.id === slot.aeronef_id);
    const aeronefLabel = aeronefObj ? `${aeronefObj.type_aeronef} (${aeronefObj.immatriculation})` : "";
    const piloteNom = slot.pilote ? `${slot.pilote.prenom} ${slot.pilote.nom}` : "";
    const dateFormatted = new Date(slot.date_vol + "T00:00:00").toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    // Notify parents of students ALREADY on this slot (confirmation/reminder)
    const activeResas = (slot.reservations || []).filter(
      (r: any) => r.statut !== "annule" && r.eleve?.parent_email,
    );
    if (activeResas.length > 0) {
      let sent = 0;
      for (const r of activeResas) {
        const res = await fetch("/api/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "booking_confirm",
            parent_email: r.eleve.parent_email,
            parent_prenom: r.eleve.parent_prenom || "",
            eleve_prenom: r.eleve.prenom,
            eleve_nom: r.eleve.nom,
            type_vol: r.type_vol,
            date_vol: slot.date_vol,
            heure_debut: slot.heure_debut?.slice(0, 5),
            heure_fin: slot.heure_fin?.slice(0, 5),
            aeronef: aeronefLabel,
            pilote_nom: piloteNom,
            pilote_email: "", // ne pas notifier le pilote lors d'un envoi manuel admin
            pilote_telephone: slot.pilote?.telephone || "",
            etablissement: slot.etablissement?.nom || "",
          }),
        }).catch(() => null);
        if (res?.ok) sent++;
      }
      if (sent > 0) toast.success(`${sent} parent(s) notifié(s)`);
      else toast.error("Erreur lors de l'envoi");
      return;
    }

    // No students on slot → nothing to send
    toast.info("Aucun élève sur ce créneau à notifier");
  }

  async function doRemoveEleve(rid: string, name: string, motif?: string) {
    const removedRes = (showDetail?.reservations || []).find((r: any) => r.id === rid);
    await supabase.from("reservations").update({ statut: "annule", ...(motif ? { motif_annulation: motif } : {}) }).eq("id", rid);
    toast.success(`${name} retiré du créneau`);
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
          pilote_email: "",
          pilote_nom: "",
          motif: motif || undefined,
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

  function handleRemoveEleve(rid: string, name: string) {
    setConfirmAction({
      title: `Retirer ${name}`,
      message: `${name} sera retiré du créneau et le parent sera notifié par email.`,
      variant: "danger",
      reasonLabel: "Motif (optionnel, visible dans l'email)",
      onConfirm: (motif) => doRemoveEleve(rid, name, motif),
    });
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

  function openEditHisto(v: any) {
    const resEleves = (v.creneau?.reservations || [])
      .filter((r: any) => r.statut !== "annule" && r.eleve?.id)
      .map((r: any) => ({ ...r.eleve, type_vol: r.type_vol || 1, reservation_id: r.id }));
    setEditHistoElevesLocal(resEleves);
    setEditHistoElevesOrig(resEleves);
    setAddHistoEleveId("");
    setAddHistoEleveTypeVol(1);
    setEditHisto({ ...v });
  }

  async function doDeleteHisto(v: any) {
    // Reset vol flags on linked eleves
    const reservations = (v.creneau?.reservations || []).filter((r: any) => r.eleve?.id);
    for (const r of reservations) {
      if (r.type_vol === 2) {
        await supabase.from("eleves").update({ vol2_effectue: false, vol2_numero_aerogest: null, vol2_temps_minutes: null, vol2_aeronef_id: null, vol2_prix: null, vol2_pilote_nom: null }).eq("id", r.eleve.id);
      } else {
        await supabase.from("eleves").update({ vol1_effectue: false, vol1_numero_aerogest: null, vol1_temps_minutes: null, vol1_aeronef_id: null, vol1_prix: null, vol1_pilote_nom: null }).eq("id", r.eleve.id);
      }
      await supabase.from("reservations").update({ statut: "reserve" }).eq("id", r.id);
    }
    // Reopen the creneau
    await supabase.from("creneaux").update({ statut: "ouvert" }).eq("id", v.creneau_id);
    await supabase.from("vols_effectues").delete().eq("id", v.id);
    toast.success("Entrée supprimée");
    load();
  }

  async function doDeleteManual(group: { ids: string[]; numero_aerogest: string }) {
    const vol1Ids = group.ids.filter((id) => id.endsWith("_vol1")).map((id) => id.replace("_vol1", ""));
    const vol2Ids = group.ids.filter((id) => id.endsWith("_vol2")).map((id) => id.replace("_vol2", ""));
    if (vol1Ids.length) {
      await supabase.from("eleves").update({ vol1_effectue: false, vol1_numero_aerogest: null, vol1_temps_minutes: null, vol1_aeronef_id: null, vol1_prix: null, vol1_pilote_nom: null }).in("id", vol1Ids);
    }
    if (vol2Ids.length) {
      await supabase.from("eleves").update({ vol2_effectue: false, vol2_numero_aerogest: null, vol2_temps_minutes: null, vol2_aeronef_id: null, vol2_prix: null, vol2_pilote_nom: null }).in("id", vol2Ids);
    }
    toast.success("Entrée supprimée");
    load();
  }

  async function handleSaveHisto() {
    if (!editHisto) return;
    setSaving(true);

    const newNbEleves = editHistoElevesLocal.length > 0 ? editHistoElevesLocal.length : editHisto.nb_eleves;
    await supabase
      .from("vols_effectues")
      .update({
        numero_aerogest: editHisto.numero_aerogest,
        temps_vol_minutes: editHisto.temps_vol_minutes,
        nb_eleves: newNbEleves,
        prix_total: editHisto.prix_total,
        notes: editHisto.notes,
      })
      .eq("id", editHisto.id);

    // Compute eleve diffs
    const origIds = new Set(editHistoElevesOrig.map((e: any) => e.id));
    const newIds = new Set(editHistoElevesLocal.map((e: any) => e.id));
    const creneauId = editHisto.creneau_id;
    const prixParEleve = editHisto.prix_total ? parseFloat(editHisto.prix_total) / Math.max(newNbEleves, 1) : 0;
    const tempsMin = editHisto.temps_vol_minutes;
    const numAerogest = editHisto.numero_aerogest || null;
    const piloteNom = editHisto.creneau?.pilote ? `${editHisto.creneau.pilote.prenom} ${editHisto.creneau.pilote.nom}` : "";
    const aeronefId = editHisto.creneau?.aeronef_id;

    // Remove eleves no longer on the vol
    for (const e of editHistoElevesOrig) {
      if (!newIds.has(e.id)) {
        await supabase.from("reservations").update({ statut: "annule" }).eq("id", e.reservation_id);
        if (e.type_vol === 2) {
          await supabase.from("eleves").update({ vol2_effectue: false, vol2_numero_aerogest: null, vol2_temps_minutes: null, vol2_aeronef_id: null, vol2_prix: null, vol2_pilote_nom: null }).eq("id", e.id);
        } else {
          await supabase.from("eleves").update({ vol1_effectue: false, vol1_numero_aerogest: null, vol1_temps_minutes: null, vol1_aeronef_id: null, vol1_prix: null, vol1_pilote_nom: null }).eq("id", e.id);
        }
      }
    }

    // Update eleves whose type_vol changed (same ID, different type)
    for (const e of editHistoElevesLocal) {
      if (!origIds.has(e.id)) continue; // handled below in "Add new"
      const orig = editHistoElevesOrig.find((x: any) => x.id === e.id);
      const newTypeVol = e.type_vol || 1;
      const oldTypeVol = orig?.type_vol || 1;
      if (newTypeVol === oldTypeVol) continue; // unchanged
      // Update la réservation
      if (orig?.reservation_id) {
        await supabase.from("reservations").update({ type_vol: newTypeVol }).eq("id", orig.reservation_id);
      }
      // Récupérer l'état actuel de l'élève pour comparer les numéros Aérogest
      const eleveState = eleves.find((el: any) => el.id === e.id);
      // Effacer les anciens champs UNIQUEMENT si c'est ce vol qui les a écrits
      // (identifié par le numéro Aérogest correspondant à ce vol)
      if (oldTypeVol === 2) {
        const wasThisFlight = numAerogest && eleveState?.vol2_numero_aerogest === numAerogest;
        if (wasThisFlight) {
          await supabase.from("eleves").update({ vol2_effectue: false, vol2_numero_aerogest: null, vol2_temps_minutes: null, vol2_aeronef_id: null, vol2_prix: null, vol2_pilote_nom: null }).eq("id", e.id);
        }
      } else {
        const wasThisFlight = numAerogest && eleveState?.vol1_numero_aerogest === numAerogest;
        if (wasThisFlight) {
          await supabase.from("eleves").update({ vol1_effectue: false, vol1_numero_aerogest: null, vol1_temps_minutes: null, vol1_aeronef_id: null, vol1_prix: null, vol1_pilote_nom: null }).eq("id", e.id);
        }
      }
      // Écrire les nouveaux champs vol
      if (newTypeVol === 2) {
        await supabase.from("eleves").update({ vol2_effectue: true, vol2_temps_minutes: tempsMin, vol2_aeronef_id: aeronefId, vol2_prix: prixParEleve, vol2_pilote_nom: piloteNom, vol2_numero_aerogest: numAerogest }).eq("id", e.id);
      } else {
        await supabase.from("eleves").update({ vol1_effectue: true, vol1_temps_minutes: tempsMin, vol1_aeronef_id: aeronefId, vol1_prix: prixParEleve, vol1_pilote_nom: piloteNom, vol1_numero_aerogest: numAerogest }).eq("id", e.id);
      }
    }

    // Add new eleves
    for (const e of editHistoElevesLocal) {
      if (origIds.has(e.id)) continue; // already handled above
      const typeVol = e.type_vol || 1;
      const { data: existing } = await supabase.from("reservations").select("id").eq("creneau_id", creneauId).eq("eleve_id", e.id).maybeSingle();
      if (existing) {
        await supabase.from("reservations").update({ statut: "effectue", type_vol: typeVol }).eq("id", existing.id);
      } else {
        await supabase.from("reservations").insert({ creneau_id: creneauId, eleve_id: e.id, type_vol: typeVol, statut: "effectue" });
      }
      if (typeVol === 2) {
        await supabase.from("eleves").update({ vol2_effectue: true, vol2_temps_minutes: tempsMin, vol2_aeronef_id: aeronefId, vol2_prix: prixParEleve, vol2_pilote_nom: piloteNom, vol2_numero_aerogest: numAerogest }).eq("id", e.id);
      } else {
        await supabase.from("eleves").update({ vol1_effectue: true, vol1_temps_minutes: tempsMin, vol1_aeronef_id: aeronefId, vol1_prix: prixParEleve, vol1_pilote_nom: piloteNom, vol1_numero_aerogest: numAerogest }).eq("id", e.id);
      }
    }

    setSaving(false);
    setEditHisto(null);
    setEditHistoElevesLocal([]);
    setEditHistoElevesOrig([]);
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
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700" role="alert" aria-live="assertive">
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
                                {etabEleves.filter(el => {
                                  if (el.abandonne) return false;
                                  if (busyEleveIds.has(el.id)) return false;
                                  if (el.vol2_effectue) return false;
                                  if (el.vol1_effectue && !el.vol2_autorise) return false;
                                  // Masquer les Non admis (BIA échoué)
                                  if (el.bia_resultat === "Non admis") return false;
                                  // Pour les non-SA : masquer les élèves dont la date BIA est passée sans avoir fait Vol 1
                                  if (!isSA) {
                                    const today = new Date().toISOString().split("T")[0];
                                    if (!el.vol1_effectue && biaExamDate && biaExamDate < today) return false;
                                  }
                                  return true;
                                }).map((el) => {
                                  const sel = etabElvsSelected.includes(el.id);
                                  const volLabel = (el.vol1_effectue && el.vol2_autorise) ? "BIA ✓ · V2" : "V1";
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
                                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${sel ? "bg-brand-500 text-white border-brand-500" : "text-gray-600 border-gray-300 hover:border-brand-300"}`}
                                    >
                                      {el.prenom} {el.nom}
                                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${sel ? "bg-white/30 text-white" : "bg-gray-100 text-gray-400"}`}>{volLabel}</span>
                                      {(() => {
                                        const m = matchDesiderata(el.desiderata, form.date_vol, form.heure_debut);
                                        if (m === "match") return <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">DISPO</span>;
                                        if (m === "no-match") return <span className="bg-orange-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">INDISPO</span>;
                                        return null;
                                      })()}
                                    </button>
                                  );
                                })}
                                {etabEleves.filter(el => !el.abandonne && busyEleveIds.has(el.id)).length > 0 && (
                                  <p className="text-[10px] text-gray-400 w-full mt-1">{etabEleves.filter(el => !el.abandonne && busyEleveIds.has(el.id)).length} élève(s) déjà positionné(s) sur un vol actif masqué(s)</p>
                                )}
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
                  <p className="text-xs text-brand-500 mt-1">{form.etablissements.length} établissement{form.etablissements.length > 1 ? "s" : ""} sélectionné{form.etablissements.length > 1 ? "s" : ""}</p>
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
              {showDetail.statut === "annule" && showDetail.motif_annulation && (
                <div className="flex flex-col gap-0.5 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <span className="text-xs text-red-500 font-semibold">Motif d'annulation</span>
                  <span className="text-xs text-red-700">{showDetail.motif_annulation}</span>
                </div>
              )}
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
              {(showDetail.etablissement_ids?.length > 0 || showDetail.etablissement) && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Établissement{showDetail.etablissement_ids?.length > 1 ? "s" : ""}</span>
                  <span className="font-medium text-right">
                    {showDetail.etablissement_ids?.length > 0
                      ? showDetail.etablissement_ids.map((id: string) => etabs.find((e) => e.id === id)?.nom || id).join(", ")
                      : showDetail.etablissement?.nom}
                  </span>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">
                  Elèves ({showDetail.reservations?.filter((r: any) => r.statut !== "annule").length || 0})
                </p>
                {showDetail.statut !== "termine" && showDetail.statut !== "annule" &&
                  (isSA || isCoord || showDetail.pilote_id === profile?.id) && (
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
                          (isSA || isCoord || showDetail.pilote_id === profile?.id) && (
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
                  if (e.abandonne) return false;
                  if (e.vol2_effectue) return false;
                  if (e.vol1_effectue && !e.vol2_autorise) return false;
                  if (e.bia_resultat === "Non admis") return false;
                  if (!isSA) {
                    const today = new Date().toISOString().split("T")[0];
                    if (!e.vol1_effectue && biaExamDate && biaExamDate < today) return false;
                  }
                  if (showDetail.etablissement_id && e.etablissement_id !== showDetail.etablissement_id) return false;
                  if (q && !`${e.prenom} ${e.nom}`.toLowerCase().includes(q)) return false;
                  return true;
                });
                return (
                  <div className="mt-2 p-3 bg-brand-50/40 border border-brand-100 rounded-lg space-y-2">
                    <input
                      autoFocus
                      value={addEleveSearch}
                      onChange={e => setAddEleveSearch(e.target.value)}
                      placeholder="Rechercher un élève..."
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                    />
                    <p className="text-[10px] text-gray-400">Le type de vol (Vol 1 ou Vol 2) est détecté automatiquement selon l'état de l'élève.</p>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {available.length === 0 ? (
                        <p className="text-xs text-gray-400 py-1">Aucun élève disponible</p>
                      ) : available.map((e: any) => {
                        // Auto-détecter le type de vol selon l'état de l'élève
                        const detectedTypeVol: 1 | 2 = (e.vol1_effectue && e.vol2_autorise && !e.vol2_effectue) ? 2 : 1;
                        const match = matchDesiderata(e.desiderata, showDetail.date_vol, showDetail.heure_debut);
                        return (
                          <button
                            key={e.id}
                            onClick={() => handleAddEleve(e.id, detectedTypeVol)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm rounded-lg bg-white border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-all text-left"
                          >
                            <span className="font-medium text-gray-900 flex items-center gap-1.5">
                              {e.prenom} {e.nom}
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${detectedTypeVol === 2 ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"}`}>
                                Vol {detectedTypeVol}
                              </span>
                              {match === "match" && <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">DISPO</span>}
                              {match === "no-match" && <span className="bg-orange-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">INDISPO</span>}
                            </span>
                            <span className="text-xs text-brand-500 font-medium">+ Ajouter</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
            {showDetail.statut !== "termine" && showDetail.statut !== "annule" && (() => {
                const canEditSlot = isSA || isCoord || showDetail.pilote_id === profile?.id;
                return (
                  <div className="flex gap-2 pt-3 border-t border-gray-100 flex-wrap">
                    {canEditSlot && (
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
                    )}
                    {canEditSlot && (
                      <button
                        onClick={() => {
                          setShowDetail(null);
                          // Pre-populate elevesByEtab from existing active reservations
                          const elevesByEtabFromResas: Record<string, string[]> = {};
                          for (const res of showDetail.reservations || []) {
                            if (res.statut === "annule" || !res.eleve?.id) continue;
                            const eleveData = eleves.find((el: any) => el.id === res.eleve.id);
                            const etabId = eleveData?.etablissement_id;
                            if (!etabId) continue;
                            if (!elevesByEtabFromResas[etabId]) elevesByEtabFromResas[etabId] = [];
                            elevesByEtabFromResas[etabId].push(res.eleve.id);
                          }
                          setShowEditSlot({
                            ...showDetail,
                            etablissements: showDetail.etablissement_ids?.length > 0
                              ? showDetail.etablissement_ids
                              : (showDetail.etablissement_id ? [showDetail.etablissement_id] : []),
                            elevesByEtab: elevesByEtabFromResas,
                            eleves_autorises: showDetail.eleves_autorises || [],
                          });
                        }}
                        className="btn-secondary"
                      >
                        <Edit className="w-4 h-4" /> Modifier
                      </button>
                    )}
                    {canEditSlot && (
                      <button
                        onClick={() => handleNotifySlot(showDetail)}
                        className="btn-secondary"
                        title="Notifier les parents"
                      >
                        <Mail className="w-4 h-4" /> Notifier
                      </button>
                    )}
                    {canEditSlot && (
                      <button
                        onClick={() => handleCancelSlot(showDetail.id)}
                        className="btn-secondary"
                      >
                        Annuler vol
                      </button>
                    )}
                    {canEditSlot && (
                      <button
                        onClick={() => handleDeleteSlot(showDetail.id)}
                        className="btn-danger btn-sm"
                      >
                        Suppr.
                      </button>
                    )}
                  </div>
                );
              })()}
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
              {/* Récap élèves + type de vol — vérification avant clôture */}
              {(showClose.reservations || []).filter((r: any) => r.statut !== "annule").length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                  {(showClose.reservations || [])
                    .filter((r: any) => r.statut !== "annule")
                    .map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700">{r.eleve?.prenom} {r.eleve?.nom}</span>
                        <span className={`font-bold px-2 py-0.5 rounded-full ${r.type_vol === 2 ? "bg-emerald-100 text-emerald-700" : "bg-brand-100 text-brand-700"}`}>
                          Vol {r.type_vol || 1}
                        </span>
                      </div>
                    ))}
                  <p className="text-[10px] text-gray-400 pt-1">Le type de vol détermine dans quel champ les données seront enregistrées.</p>
                </div>
              )}
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700" role="alert" aria-live="assertive">
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
              {/* Établissements — multi-select, même UI que la création */}
              <div>
                <label className="label">Établissements</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {isSA && (
                    <button
                      type="button"
                      onClick={() => setShowEditSlot({ ...showEditSlot, etablissements: [], elevesByEtab: {} })}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-100 transition-colors ${(showEditSlot.etablissements || []).length === 0 ? "bg-brand-50 text-brand-600 font-semibold" : "text-gray-500 hover:bg-gray-50"}`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${(showEditSlot.etablissements || []).length === 0 ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                        {(showEditSlot.etablissements || []).length === 0 && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      Tous les établissements
                    </button>
                  )}
                  <div className="max-h-36 overflow-y-auto">
                    {etabs.map((etab) => {
                      const editEtabs: string[] = showEditSlot.etablissements || [];
                      const checked = editEtabs.includes(etab.id);
                      const etabEleves = eleves.filter((el) => el.etablissement_id === etab.id);
                      const etabElvsSelected: string[] = (showEditSlot.elevesByEtab || {})[etab.id] ?? [];
                      return (
                        <div key={etab.id} className="border-b border-gray-50 last:border-0">
                          <button
                            type="button"
                            onClick={() => {
                              const next = checked
                                ? editEtabs.filter((x) => x !== etab.id)
                                : [...editEtabs, etab.id];
                              setShowEditSlot({ ...showEditSlot, etablissements: next });
                            }}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${checked ? "bg-brand-50 text-brand-700 font-semibold" : "text-gray-700 hover:bg-gray-50"}`}
                          >
                            <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                              {checked && <Check className="w-2.5 h-2.5 text-white" />}
                            </span>
                            {etab.nom}
                          </button>
                          {checked && etabEleves.length > 0 && (
                            <div className="px-3 pb-2 bg-brand-50/50">
                              <p className="text-[10px] text-gray-400 mb-1.5">Restreindre à des élèves spécifiques (optionnel) :</p>
                              <div className="flex flex-wrap gap-1">
                                {etabEleves.filter(el => {
                                  if (el.abandonne) return false;
                                  if (el.vol2_effectue) return false;
                                  if (el.vol1_effectue && !el.vol2_autorise) return false;
                                  if (el.bia_resultat === "Non admis") return false;
                                  if (!isSA) {
                                    const today = new Date().toISOString().split("T")[0];
                                    if (!el.vol1_effectue && biaExamDate && biaExamDate < today) return false;
                                  }
                                  // Keep: not busy, OR already on this specific slot
                                  if (!busyEleveIds.has(el.id)) return true;
                                  return (showEditSlot.reservations || []).some((r: any) => r.statut !== "annule" && r.eleve?.id === el.id);
                                }).map((el) => {
                                  const sel = etabElvsSelected.includes(el.id);
                                  const volLabel = (el.vol1_effectue && el.vol2_autorise) ? "BIA ✓ · V2" : "V1";
                                  return (
                                    <button
                                      key={el.id}
                                      type="button"
                                      onClick={() => {
                                        const next = sel
                                          ? etabElvsSelected.filter((x) => x !== el.id)
                                          : [...etabElvsSelected, el.id];
                                        setShowEditSlot({ ...showEditSlot, elevesByEtab: { ...(showEditSlot.elevesByEtab || {}), [etab.id]: next } });
                                      }}
                                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1 ${sel ? "bg-brand-500 text-white border-brand-500" : "text-gray-600 border-gray-300 hover:border-brand-300"}`}
                                    >
                                      {el.prenom} {el.nom}
                                      <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${sel ? "bg-white/30 text-white" : "bg-gray-100 text-gray-400"}`}>{volLabel}</span>
                                      {(() => {
                                        const m = matchDesiderata(el.desiderata, showEditSlot.date_vol, showEditSlot.heure_debut);
                                        if (m === "match") return <span className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">DISPO</span>;
                                        if (m === "no-match") return <span className="bg-orange-400 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">INDISPO</span>;
                                        return null;
                                      })()}
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
                {(showEditSlot.etablissements || []).length > 0 && (
                  <p className="text-xs text-brand-500 mt-1">{showEditSlot.etablissements.length} établissement{showEditSlot.etablissements.length > 1 ? "s" : ""} sélectionné{showEditSlot.etablissements.length > 1 ? "s" : ""}</p>
                )}
              </div>
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
                  <label className="label">Nb élèves</label>
                  <div className="input bg-gray-50 text-gray-500 flex items-center gap-1 cursor-default select-none">
                    <User className="w-3.5 h-3.5 text-gray-400" />
                    <span>{editHistoElevesLocal.length > 0 ? editHistoElevesLocal.length : editHisto.nb_eleves}</span>
                    {editHistoElevesLocal.length > 0 && <span className="text-[10px] text-gray-400 ml-1">(depuis liste)</span>}
                  </div>
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
              {/* Eleves management */}
              <div>
                <label className="label">Élèves sur ce vol ({editHistoElevesLocal.length})</label>
                <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                  {editHistoElevesLocal.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Aucun élève lié</p>
                  )}
                  {editHistoElevesLocal.map((e: any) => {
                    const tv = e.type_vol || 1;
                    return (
                      <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                        <span className="font-medium">{e.prenom} {e.nom}</span>
                        <div className="flex items-center gap-2">
                          {/* Toggle Vol 1 / Vol 2 */}
                          <button
                            type="button"
                            onClick={() => setEditHistoElevesLocal((prev) =>
                              prev.map((x) => x.id === e.id ? { ...x, type_vol: tv === 1 ? 2 : 1 } : x)
                            )}
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border-2 transition-all ${tv === 2 ? "border-emerald-400 bg-emerald-50 text-emerald-700" : "border-brand-300 bg-brand-50 text-brand-700"}`}
                            title="Cliquer pour changer le type de vol"
                          >
                            Vol {tv}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditHistoElevesLocal((prev) => prev.filter((x) => x.id !== e.id))}
                            className="text-red-400 hover:text-red-600 p-0.5 rounded"
                            title="Retirer de ce vol"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <select
                    value={addHistoEleveId}
                    onChange={(e) => {
                      setAddHistoEleveId(e.target.value);
                      // Auto-détecter le type de vol selon l'état de l'élève
                      const found = eleves.find((el: any) => el.id === e.target.value);
                      if (found) {
                        const detected: 1 | 2 = (found.vol1_effectue && found.vol2_autorise && !found.vol2_effectue) ? 2 : 1;
                        setAddHistoEleveTypeVol(detected);
                      }
                    }}
                    className="input flex-1 text-sm"
                  >
                    <option value="">— Ajouter un élève</option>
                    {eleves
                      .filter((e: any) => !editHistoElevesLocal.some((x: any) => x.id === e.id))
                      .sort((a: any, b: any) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`))
                      .map((e: any) => {
                        const tv = (e.vol1_effectue && e.vol2_autorise && !e.vol2_effectue) ? "Vol 2" : "Vol 1";
                        return <option key={e.id} value={e.id}>{e.prenom} {e.nom} — {tv}</option>;
                      })}
                  </select>
                  <select
                    value={addHistoEleveTypeVol}
                    onChange={(e) => setAddHistoEleveTypeVol(parseInt(e.target.value) as 1 | 2)}
                    className="input w-20 text-sm"
                    title="Type de vol (auto-détecté, modifiable)"
                  >
                    <option value={1}>Vol 1</option>
                    <option value={2}>Vol 2</option>
                  </select>
                  <button
                    type="button"
                    disabled={!addHistoEleveId}
                    onClick={() => {
                      const found = eleves.find((e: any) => e.id === addHistoEleveId);
                      if (!found) return;
                      setEditHistoElevesLocal((prev) => [...prev, { ...found, type_vol: addHistoEleveTypeVol, reservation_id: null }]);
                      setAddHistoEleveId("");
                    }}
                    className="btn-secondary btn-sm px-3"
                    title="Ajouter"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                {c.reservations?.filter((r: any) => r.statut !== "annule").length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.reservations
                      .filter((r: any) => r.statut !== "annule")
                      .map((r: any) => `${r.eleve?.prenom} ${r.eleve?.nom}`)
                      .join(", ")}
                  </p>
                )}
              </div>
            </div>
            <span className={`badge ${sS[c.statut] || "bg-gray-100 text-gray-500"}`}>
              {sL[c.statut] || c.statut}
            </span>
          </div>
        );

        const SectionList = ({ slots, label }: { slots: any[]; label?: string }) => {
          const active = slots.filter((c) => !["termine", "annule"].includes(c.statut));
          const past = slots.filter((c) => ["termine", "annule"].includes(c.statut));
          return (
            <div className="flex flex-col gap-2.5">
              {label && (
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 pt-1">{label}</p>
              )}
              {active.length === 0 && past.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Aucun créneau</p>
              )}
              {active.map((c) => <SlotCard key={c.id} c={c} />)}
              {past.length > 0 && (
                <details className="mt-1">
                  <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none py-2 px-1 hover:text-gray-600">
                    Terminés / Annulés ({past.length})
                  </summary>
                  <div className="flex flex-col gap-2.5 mt-2 opacity-70">
                    {past.map((c) => <SlotCard key={c.id} c={c} />)}
                  </div>
                </details>
              )}
            </div>
          );
        };

        // For pilots: split my slots vs others
        if (isPilote && !isSA) {
          const mySlots = filteredDisplayed.filter((c) => c.pilote_id === profile?.id);
          const othersSlots = filteredDisplayed.filter((c) => c.pilote_id !== profile?.id);
          return (
            <div className="flex flex-col gap-6">
              <SectionList slots={mySlots} label="Mes créneaux" />
              {othersSlots.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider py-2 px-1">
                    Planning général — autres pilotes ({othersSlots.filter(c => !["termine","annule"].includes(c.statut)).length} actifs)
                  </p>
                  <SectionList slots={othersSlots} />
                </div>
              )}
            </div>
          );
        }

        return <SectionList slots={filteredDisplayed} />;
      })()}

      {/* CALENDAR */}
      {mode === "calendar" && (() => {
        // Helper timezone-safe : utilise l'heure locale (pas UTC)
        const localDateStr = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        const todayLocal = new Date();
        todayLocal.setHours(0, 0, 0, 0);
        const todayStr = localDateStr(todayLocal);

        const statBg: Record<string, string> = {
          ouvert: "bg-amber-50 border-amber-200",
          confirme: "bg-brand-50 border-brand-200",
          termine: "bg-emerald-50 border-emerald-200",
          annule: "bg-red-50 border-red-200 opacity-60",
          complet: "bg-blue-50 border-blue-200",
        };
        const statText: Record<string, string> = {
          ouvert: "text-amber-700",
          confirme: "text-brand-700",
          termine: "text-emerald-700",
          annule: "text-red-600",
          complet: "text-blue-700",
        };

        const ViewToggle = ({ current }: { current: "week" | "month" }) => (
          <div className="flex rounded-lg overflow-hidden border border-gray-200 text-xs font-semibold shrink-0">
            <button onClick={() => setCalView("week")} className={`px-2.5 py-1 ${current === "week" ? "bg-brand-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Sem.</button>
            <button onClick={() => setCalView("month")} className={`px-2.5 py-1 ${current === "month" ? "bg-brand-500 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Mois</button>
          </div>
        );

        // ── VUE SEMAINE ──────────────────────────────────
        if (calView === "week") {
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(calWeekStart);
            d.setDate(calWeekStart.getDate() + i);
            return d;
          });
          const fmtWeek = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
          const joursLong = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
          const joursShort = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

          const slotsByDay: Record<string, any[]> = {};
          filteredDisplayed.forEach((c) => {
            const ds = c.date_vol; // already "YYYY-MM-DD" from DB
            if (!slotsByDay[ds]) slotsByDay[ds] = [];
            slotsByDay[ds].push(c);
          });

          const goToday = () => {
            const d = new Date();
            const day = d.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            d.setDate(d.getDate() + diff);
            d.setHours(0, 0, 0, 0);
            setCalWeekStart(new Date(d));
          };

          const SlotCard = ({ f }: { f: any }) => {
            const nbEleves = (f.reservations || []).filter((r: any) => r.statut !== "annule").length;
            const capacity = f.aeronef?.nb_places_eleves ?? 1;
            const isFull = nbEleves >= capacity;
            return (
              <button
                onClick={() => setShowDetail(f)}
                className={`w-full text-left rounded-xl border p-2.5 hover:shadow-md active:scale-95 transition-all ${statBg[f.statut] || "bg-gray-50 border-gray-200"}`}
              >
                <p className={`text-xs font-bold ${statText[f.statut] || "text-gray-700"}`}>
                  {f.heure_debut?.slice(0, 5)} – {f.heure_fin?.slice(0, 5)}
                </p>
                {f.pilote && <p className="text-[11px] text-gray-600 mt-0.5 font-medium truncate">👤 {f.pilote.prenom} {f.pilote.nom}</p>}
                {f.aeronef && <p className="text-[11px] text-gray-500 truncate">✈ {f.aeronef.type_aeronef}</p>}
                <p className={`text-[10px] mt-1 font-semibold ${isFull ? "text-blue-600" : "text-gray-400"}`}>
                  {nbEleves}/{capacity} élève{capacity > 1 ? "s" : ""}
                </p>
              </button>
            );
          };

          return (
            <div className="card p-0 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100 bg-white gap-2">
                <button onClick={() => { const d = new Date(calWeekStart); d.setDate(d.getDate() - 7); setCalWeekStart(new Date(d)); }}
                  className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 font-bold text-base shrink-0">‹</button>
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <span className="text-sm font-bold text-gray-900 text-center">
                    {fmtWeek(weekDays[0])} – {fmtWeek(weekDays[6])} {weekDays[6].getFullYear()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={goToday} className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium">Aujourd'hui</button>
                    <ViewToggle current="week" />
                  </div>
                </div>
                <button onClick={() => { const d = new Date(calWeekStart); d.setDate(d.getDate() + 7); setCalWeekStart(new Date(d)); }}
                  className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 font-bold text-base shrink-0">›</button>
              </div>

              {/* DESKTOP : grille 7 colonnes */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-7 border-b border-gray-100">
                  {weekDays.map((day, i) => {
                    const ds = localDateStr(day);
                    const isToday = ds === todayStr;
                    return (
                      <div key={i} className={`text-center py-2 border-r last:border-r-0 border-gray-100 ${isToday ? "bg-brand-50" : "bg-gray-50"}`}>
                        <p className={`text-[11px] font-bold uppercase ${isToday ? "text-brand-600" : "text-gray-400"}`}>{joursShort[i]}</p>
                        <p className={`text-lg font-bold mt-0.5 ${isToday ? "text-brand-600" : "text-gray-700"}`}>{day.getDate()}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-7 divide-x divide-gray-100 min-h-[280px]">
                  {weekDays.map((day, i) => {
                    const ds = localDateStr(day);
                    const isToday = ds === todayStr;
                    const slots = (slotsByDay[ds] || []).slice().sort((a: any, b: any) => (a.heure_debut || "").localeCompare(b.heure_debut || ""));
                    return (
                      <div key={i} className={`p-1.5 space-y-1.5 ${isToday ? "bg-brand-50/30" : "bg-white"}`}>
                        {slots.length === 0 && <div className="h-full flex items-center justify-center"><span className="text-[10px] text-gray-200">—</span></div>}
                        {slots.map((f: any, fi: number) => <SlotCard key={fi} f={f} />)}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MOBILE : liste verticale par jour */}
              <div className="sm:hidden divide-y divide-gray-100">
                {weekDays.map((day, i) => {
                  const ds = localDateStr(day);
                  const isToday = ds === todayStr;
                  const slots = (slotsByDay[ds] || []).slice().sort((a: any, b: any) => (a.heure_debut || "").localeCompare(b.heure_debut || ""));
                  return (
                    <div key={i} className={isToday ? "bg-brand-50/20" : ""}>
                      <div className={`flex items-center gap-2 px-4 py-2.5 ${isToday ? "bg-brand-50" : "bg-gray-50/60"}`}>
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${isToday ? "bg-brand-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                          {day.getDate()}
                        </span>
                        <span className={`text-sm font-semibold ${isToday ? "text-brand-700" : "text-gray-600"}`}>
                          {joursLong[i]}
                        </span>
                        {isToday && <span className="text-[10px] font-bold text-brand-500 bg-brand-100 px-1.5 py-0.5 rounded-full ml-auto">Aujourd'hui</span>}
                      </div>
                      {slots.length === 0 ? (
                        <p className="text-xs text-gray-300 px-4 py-3">Aucun créneau</p>
                      ) : (
                        <div className="p-3 space-y-2">
                          {slots.map((f: any, fi: number) => <SlotCard key={fi} f={f} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // ── VUE MOIS ──────────────────────────────────
        return (
          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
              <button onClick={() => setCalMonth((m) => Math.max(0, m - 1))}
                className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 font-bold text-base shrink-0">‹</button>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-bold text-gray-900">{mN[calMonth]} {cY}</span>
                <ViewToggle current="month" />
              </div>
              <button onClick={() => setCalMonth((m) => Math.min(11, m + 1))}
                className="p-2 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 font-bold text-base shrink-0">›</button>
            </div>
            <div className="grid grid-cols-7">
              {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                <div key={i} className="py-2 text-center text-[10px] font-bold uppercase text-gray-400 bg-gray-50 border-b border-gray-100">{d}</div>
              ))}
              {cD.map((d, i) => {
                const dateStr = d ? `${cY}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
                const isToday = dateStr === todayStr;
                const fls = d ? (fBD[d] || []).slice().sort((a: any, b: any) => (a.heure_debut || "").localeCompare(b.heure_debut || "")) : [];
                return (
                  <div key={i} className={`min-h-[70px] sm:min-h-[100px] p-1 border-t border-gray-100 ${(i + 1) % 7 !== 0 ? "border-r" : ""} ${d ? (isToday ? "bg-brand-50/40" : "bg-white") : "bg-gray-50/40"}`}>
                    {d && (
                      <>
                        <div className={`text-[11px] font-bold mb-1 w-5 h-5 flex items-center justify-center rounded-full ml-auto ${isToday ? "bg-brand-500 text-white" : "text-gray-400"}`}>
                          {d}
                        </div>
                        {fls.map((f: any, fi: number) => {
                          const nbEleves = (f.reservations || []).filter((r: any) => r.statut !== "annule").length;
                          return (
                            <div key={fi} onClick={() => setShowDetail(f)}
                              className={`px-1 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-[11px] font-semibold mb-0.5 cursor-pointer hover:opacity-80 transition-opacity truncate ${sS[f.statut] || "bg-gray-100 text-gray-600"}`}>
                              <span className="font-bold">{f.heure_debut?.slice(0, 5)}</span>
                              <span className="hidden sm:inline ml-1 opacity-70 font-normal">{f.pilote?.nom}</span>
                              {nbEleves > 0 && <span className="hidden sm:inline float-right opacity-60">·{nbEleves}</span>}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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
                          {isSA && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEditHisto(v)} className="btn-secondary btn-sm" title="Modifier"><Edit className="w-3 h-3" /></button>
                              <button
                                onClick={() => setConfirmAction({
                                  title: "Supprimer cette entrée ?",
                                  message: `Cette action supprimera l'entrée de vol (N° ${v.numero_aerogest || "—"}) et réinitialisera les flags vol des élèves liés. Le créneau repassera en statut "ouvert".`,
                                  variant: "danger",
                                  onConfirm: (_r?: string) => doDeleteHisto(v),
                                })}
                                className="btn-secondary btn-sm text-red-500 hover:bg-red-50"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
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
                        <td className="px-3 py-2.5">
                          {isSA && (
                            <button
                              onClick={() => setConfirmAction({
                                title: "Supprimer cette entrée ?",
                                message: `Cette action réinitialisera les informations de vol (N° ${g.numero_aerogest}) des élèves concernés.`,
                                variant: "danger",
                                onConfirm: (_r?: string) => doDeleteManual(g),
                              })}
                              className="btn-secondary btn-sm text-red-500 hover:bg-red-50"
                              title="Supprimer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </td>
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
        reasonLabel={confirmAction?.reasonLabel}
        onCancel={() => setConfirmAction(null)}
        onConfirm={async (reason) => {
          if (!confirmAction) return;
          setConfirmLoading(true);
          await confirmAction.onConfirm(reason);
          setConfirmLoading(false);
          setConfirmAction(null);
        }}
      />
    </div>
  );
}
