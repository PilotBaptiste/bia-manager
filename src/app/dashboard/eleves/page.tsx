"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Eleve, Etablissement } from "@/types";
import {
  Users,
  Search,
  Plus,
  Download,
  Filter,
  X,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  Loader2,
  Save,
  AlertCircle,
  Mail,
} from "lucide-react";

function Dot({ ok }: { ok: boolean }) {
  return <span className={ok ? "dot-success" : "dot-danger"} />;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 pb-1.5 border-b border-gray-100">
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-right ${accent || "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}

const emptyForm = {
  nom: "",
  prenom: "",
  date_naissance: "",
  lieu_naissance: "",
  etablissement_id: "",
  classe: "",
  parent_nom: "",
  parent_prenom: "",
  parent_email: "",
  parent_telephone: "",
  paiement_effectue: false,
  paiement_mode: "",
  paiement_montant: "80",
  attestation_signee: false,
  attestation_parent_signataire: "",
  vol1_effectue: false,
  vol1_temps_minutes: "",
  vol1_aeronef_id: "",
  vol1_prix: "",
  vol1_pilote_nom: "",
  vol2_autorise: false,
  vol2_effectue: false,
  vol2_temps_minutes: "",
  vol2_aeronef_id: "",
  vol2_prix: "",
  vol2_pilote_nom: "",
  bia_passe: false,
  bia_resultat: "",
  bia_date: "",
  commentaires: "",
  attestation_url_manual: "",
};

export default function ElevesPage() {
  const supabase = createClient();
  const [eleves, setEleves] = useState<any[]>([]);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [aeronefs, setAeronefs] = useState<any[]>([]);
  const [anneeId, setAnneeId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [fEtab, setFEtab] = useState("all");
  const [fPaiement, setFPaiement] = useState("all");
  const [fAttest, setFAttest] = useState("all");
  const [fVol1, setFVol1] = useState("all");
  const [fBia, setFBia] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setProfileId(user.id);
    const [eR, etR, aR, anR] = await Promise.all([
      supabase
        .from("eleves")
        .select(
          "*, etablissement:etablissements(*), vol1_aeronef:aeronefs!vol1_aeronef_id(type_aeronef,immatriculation,prix_heure), vol2_aeronef:aeronefs!vol2_aeronef_id(type_aeronef,immatriculation,prix_heure)",
        )
        .eq("archive", false)
        .order("nom"),
      supabase
        .from("etablissements")
        .select("*")
        .eq("actif", true)
        .order("nom"),
      supabase
        .from("aeronefs")
        .select("*")
        .eq("actif", true)
        .order("type_aeronef"),
      supabase.from("annees").select("*").eq("active", true).single(),
    ]);
    setEleves(eR.data || []);
    setEtablissements(etR.data || []);
    setAeronefs(aR.data || []);
    if (anR.data) setAnneeId(anR.data.id);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      eleves.filter((s) => {
        if (
          searchQ &&
          !`${s.nom} ${s.prenom} ${s.parent_nom} ${s.parent_prenom} ${s.parent_email}`
            .toLowerCase()
            .includes(searchQ.toLowerCase())
        )
          return false;
        if (fEtab !== "all" && s.etablissement_id !== fEtab) return false;
        if (fPaiement === "oui" && !s.paiement_effectue) return false;
        if (fPaiement === "non" && s.paiement_effectue) return false;
        if (fAttest === "oui" && !s.attestation_signee) return false;
        if (fAttest === "non" && s.attestation_signee) return false;
        if (fVol1 === "oui" && !s.vol1_effectue) return false;
        if (fVol1 === "non" && s.vol1_effectue) return false;
        if (fBia === "admis" && !s.bia_resultat) return false;
        if (fBia === "non" && s.bia_resultat) return false;
        return true;
      }),
    [eleves, searchQ, fEtab, fPaiement, fAttest, fVol1, fBia],
  );

  const activeFilters = [fEtab, fPaiement, fAttest, fVol1, fBia].filter(
    (f) => f !== "all",
  ).length;

  function calcPrix(aeronefId: string, minutes: string): string {
    if (!aeronefId || !minutes) return "";
    const a = aeronefs.find((x) => x.id === aeronefId);
    if (!a) return "";
    return ((parseInt(minutes) / 60) * a.prix_heure).toFixed(2);
  }

  function updateVol1Aeronef(aeronefId: string) {
    setForm((f) => ({
      ...f,
      vol1_aeronef_id: aeronefId,
      vol1_prix: calcPrix(aeronefId, f.vol1_temps_minutes),
    }));
  }
  function updateVol1Temps(mins: string) {
    setForm((f) => ({
      ...f,
      vol1_temps_minutes: mins,
      vol1_prix: calcPrix(f.vol1_aeronef_id, mins),
    }));
  }
  function updateVol2Aeronef(aeronefId: string) {
    setForm((f) => ({
      ...f,
      vol2_aeronef_id: aeronefId,
      vol2_prix: calcPrix(aeronefId, f.vol2_temps_minutes),
    }));
  }
  function updateVol2Temps(mins: string) {
    setForm((f) => ({
      ...f,
      vol2_temps_minutes: mins,
      vol2_prix: calcPrix(f.vol2_aeronef_id, mins),
    }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, etablissement_id: etablissements[0]?.id || "" });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(s: any) {
    setEditingId(s.id);
    setForm({
      nom: s.nom,
      prenom: s.prenom,
      date_naissance: s.date_naissance,
      lieu_naissance: s.lieu_naissance || "",
      etablissement_id: s.etablissement_id || "",
      classe: s.classe || "",
      parent_nom: s.parent_nom,
      parent_prenom: s.parent_prenom,
      parent_email: s.parent_email,
      parent_telephone: s.parent_telephone,
      paiement_effectue: s.paiement_effectue,
      paiement_mode: s.paiement_mode || "",
      paiement_montant: String(s.paiement_montant || 80),
      attestation_signee: s.attestation_signee,
      attestation_parent_signataire: s.attestation_parent_signataire || "",
      vol1_effectue: s.vol1_effectue,
      vol1_temps_minutes: String(s.vol1_temps_minutes || ""),
      vol1_aeronef_id: s.vol1_aeronef_id || "",
      vol1_prix: String(s.vol1_prix || ""),
      vol1_pilote_nom: s.vol1_pilote_nom || "",
      vol2_autorise: s.vol2_autorise,
      vol2_effectue: s.vol2_effectue,
      vol2_temps_minutes: String(s.vol2_temps_minutes || ""),
      vol2_aeronef_id: s.vol2_aeronef_id || "",
      vol2_prix: String(s.vol2_prix || ""),
      vol2_pilote_nom: s.vol2_pilote_nom || "",
      bia_passe: s.bia_passe,
      bia_resultat: s.bia_resultat || "",
      bia_date: s.bia_date || "",
      commentaires: s.commentaires || "",
      attestation_url_manual: s.attestation_url || "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function logActivity(action: string, recordId: string, details: any) {
    try {
      await supabase.from("activity_logs").insert({
        user_id: profileId,
        action,
        table_name: "eleves",
        record_id: recordId,
        details,
      });
    } catch {}
  }

  async function handleSave() {
    setFormError(null);
    if (!form.nom.trim() || !form.prenom.trim() || !form.date_naissance) {
      setFormError("Nom, prenom et date de naissance obligatoires.");
      return;
    }
    if (!form.parent_email.trim()) {
      setFormError("Email parent obligatoire.");
      return;
    }
    if (!anneeId) {
      setFormError("Aucune annee active.");
      return;
    }
    setSaving(true);
    const payload: any = {
      nom: form.nom,
      prenom: form.prenom,
      date_naissance: form.date_naissance,
      lieu_naissance: form.lieu_naissance || "—",
      etablissement_id: form.etablissement_id || null,
      classe: form.classe || "—",
      annee_id: anneeId,
      parent_nom: form.parent_nom,
      parent_prenom: form.parent_prenom,
      parent_email: form.parent_email,
      parent_telephone: form.parent_telephone,
      paiement_effectue: form.paiement_effectue,
      paiement_mode: form.paiement_mode || null,
      paiement_montant: form.paiement_effectue
        ? parseFloat(form.paiement_montant) || 80
        : null,
      attestation_signee: form.attestation_signee,
      attestation_parent_signataire: form.attestation_signee
        ? form.attestation_parent_signataire ||
          `${form.parent_prenom} ${form.parent_nom}`
        : null,
      attestation_date: form.attestation_signee
        ? new Date().toISOString()
        : null,
      vol1_effectue: form.vol1_effectue,
      vol1_temps_minutes:
        form.vol1_effectue && form.vol1_temps_minutes
          ? parseInt(form.vol1_temps_minutes)
          : null,
      vol1_aeronef_id: form.vol1_aeronef_id || null,
      vol1_prix: form.vol1_prix ? parseFloat(form.vol1_prix) : null,
      vol1_pilote_nom: form.vol1_pilote_nom || null,
      vol2_effectue: form.vol2_effectue,
      vol2_temps_minutes:
        form.vol2_effectue && form.vol2_temps_minutes
          ? parseInt(form.vol2_temps_minutes)
          : null,
      vol2_aeronef_id: form.vol2_aeronef_id || null,
      vol2_prix: form.vol2_prix ? parseFloat(form.vol2_prix) : null,
      vol2_pilote_nom: form.vol2_pilote_nom || null,
      bia_passe: form.bia_passe,
      bia_resultat: form.bia_resultat || null,
      bia_date: form.bia_date || null,
      vol2_autorise:
        form.vol2_autorise ||
        form.bia_resultat === "Admis" ||
        form.bia_resultat === "Mention",
      commentaires: form.commentaires || null,
    };
    // Only update attestation_url if a new file was uploaded
    if (form.attestation_url_manual)
      payload.attestation_url = form.attestation_url_manual;
    const { data: parentProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", form.parent_email)
      .single();
    if (parentProfile) payload.parent_id = parentProfile.id;

    let result;
    if (editingId) {
      result = await supabase
        .from("eleves")
        .update(payload)
        .eq("id", editingId);
      if (!result.error)
        await logActivity("update", editingId, { changes: payload });
    } else {
      result = await supabase
        .from("eleves")
        .insert(payload)
        .select("id")
        .single();
      if (!result.error && result.data)
        await logActivity("create", result.data.id, payload);
    }
    setSaving(false);
    if (result.error) {
      setFormError(`Erreur: ${result.error.message}`);
      return;
    }
    setShowForm(false);
    // Reload the selected student if editing from fiche
    if (selected && editingId) {
      const { data: updated } = await supabase
        .from("eleves")
        .select(
          "*, etablissement:etablissements(*), vol1_aeronef:aeronefs!vol1_aeronef_id(type_aeronef,immatriculation,prix_heure), vol2_aeronef:aeronefs!vol2_aeronef_id(type_aeronef,immatriculation,prix_heure)",
        )
        .eq("id", editingId)
        .single();
      if (updated) setSelected(updated);
    } else {
      setSelected(null);
    }
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cet eleve ?")) return;
    await logActivity("delete", id, {
      nom: selected?.nom,
      prenom: selected?.prenom,
    });
    await supabase.from("eleves").delete().eq("id", id);
    setSelected(null);
    load();
  }

  // ══════════════════════════════════════════════════
  // FORM MODAL — defined here so it can be used in both fiche and table views
  // ══════════════════════════════════════════════════
  const formModal = showForm ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => setShowForm(false)}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl max-h-[90vh] overflow-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">
            {editingId ? "Editer l'eleve" : "Inscrire un eleve"}
          </h3>
          <button
            onClick={() => setShowForm(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {formError && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{formError}</p>
          </div>
        )}

        {/* Identite */}
        <div className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Identite
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Nom *</label>
              <input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Prenom *</label>
              <input
                value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Date naissance *</label>
              <input
                type="date"
                value={form.date_naissance}
                onChange={(e) =>
                  setForm({ ...form, date_naissance: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Lieu naissance</label>
              <input
                value={form.lieu_naissance}
                onChange={(e) =>
                  setForm({ ...form, lieu_naissance: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Etablissement</label>
              <select
                value={form.etablissement_id}
                onChange={(e) =>
                  setForm({ ...form, etablissement_id: e.target.value })
                }
                className="select"
              >
                <option value="">—</option>
                {etablissements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Classe</label>
              <input
                value={form.classe}
                onChange={(e) => setForm({ ...form, classe: e.target.value })}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Parent */}
        <div className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Responsable legal
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Nom parent</label>
              <input
                value={form.parent_nom}
                onChange={(e) =>
                  setForm({ ...form, parent_nom: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Prenom parent</label>
              <input
                value={form.parent_prenom}
                onChange={(e) =>
                  setForm({ ...form, parent_prenom: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Email parent *</label>
              <input
                type="email"
                value={form.parent_email}
                onChange={(e) =>
                  setForm({ ...form, parent_email: e.target.value })
                }
                className="input"
              />
            </div>
            <div>
              <label className="label">Telephone parent</label>
              <input
                value={form.parent_telephone}
                onChange={(e) =>
                  setForm({ ...form, parent_telephone: e.target.value })
                }
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Statuts */}
        <div className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Statuts administratifs
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.paiement_effectue}
                  onChange={(e) =>
                    setForm({ ...form, paiement_effectue: e.target.checked })
                  }
                />
                <span className="text-sm font-semibold text-gray-700">
                  Paiement
                </span>
              </label>
              {form.paiement_effectue && (
                <>
                  <div className="mb-2">
                    <label className="label">Montant (E)</label>
                    <input
                      type="number"
                      value={form.paiement_montant}
                      onChange={(e) =>
                        setForm({ ...form, paiement_montant: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Mode</label>
                    <input
                      value={form.paiement_mode}
                      onChange={(e) =>
                        setForm({ ...form, paiement_mode: e.target.value })
                      }
                      className="input"
                      placeholder="CB, cheque..."
                    />
                  </div>
                </>
              )}
            </div>
            <div className="p-3 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.attestation_signee}
                  onChange={(e) =>
                    setForm({ ...form, attestation_signee: e.target.checked })
                  }
                />
                <span className="text-sm font-semibold text-gray-700">
                  Attestation
                </span>
              </label>
              {form.attestation_signee && (
                <>
                  <div className="mb-2">
                    <label className="label">Signataire</label>
                    <input
                      value={form.attestation_parent_signataire}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          attestation_parent_signataire: e.target.value,
                        })
                      }
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Joindre un document</label>
                    <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-brand-300 bg-brand-50/50 text-brand-500 font-semibold text-sm cursor-pointer hover:bg-brand-50 hover:border-brand-400 transition-all">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      {form.attestation_url_manual
                        ? "Document uploade ✓ — Cliquer pour changer"
                        : "Cliquer pour uploader (PDF, JPG, PNG)"}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const ext = file.name.split(".").pop();
                          const fileName = `attestation_manuelle_${form.nom}_${form.prenom}_${Date.now()}.${ext}`;
                          const { error } = await supabase.storage
                            .from("attestations")
                            .upload(fileName, file);
                          if (error) {
                            alert(`Erreur upload: ${error.message}`);
                            return;
                          }
                          setForm((f) => ({
                            ...f,
                            attestation_url_manual: fileName,
                          }));
                        }}
                      />
                    </label>
                    {form.attestation_url_manual && (
                      <div className="flex items-center justify-between mt-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                        <p className="text-xs text-emerald-700 font-medium truncate flex-1">
                          Fichier :{" "}
                          {form.attestation_url_manual.split("/").pop()}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm("Supprimer ce document ?")) {
                              await supabase.storage
                                .from("attestations")
                                .remove([form.attestation_url_manual]);
                              if (editingId) {
                                await supabase
                                  .from("eleves")
                                  .update({ attestation_url: null })
                                  .eq("id", editingId);
                              }
                              setForm((f) => ({
                                ...f,
                                attestation_url_manual: "",
                              }));
                              if (selected) {
                                setSelected({
                                  ...selected,
                                  attestation_url: null,
                                });
                              }
                            }
                          }}
                          className="ml-2 text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="p-3 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.bia_passe}
                  onChange={(e) =>
                    setForm({ ...form, bia_passe: e.target.checked })
                  }
                />
                <span className="text-sm font-semibold text-gray-700">BIA</span>
              </label>
              {form.bia_passe && (
                <>
                  <div className="mb-2">
                    <label className="label">Resultat</label>
                    <select
                      value={form.bia_resultat}
                      onChange={(e) =>
                        setForm({ ...form, bia_resultat: e.target.value })
                      }
                      className="select"
                    >
                      <option value="">—</option>
                      <option value="Admis">Admis</option>
                      <option value="Non admis">Non admis</option>
                      <option value="Mention">Mention</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Date</label>
                    <input
                      type="date"
                      value={form.bia_date}
                      onChange={(e) =>
                        setForm({ ...form, bia_date: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Vols */}
        <div className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Vols decouverte
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Vol 1 */}
            <div className="p-3 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={form.vol1_effectue}
                  onChange={(e) =>
                    setForm({ ...form, vol1_effectue: e.target.checked })
                  }
                />
                <span className="text-sm font-semibold text-gray-700">
                  Vol 1 effectue
                </span>
              </label>
              {form.vol1_effectue && (
                <>
                  <div className="mb-2">
                    <label className="label">Aeronef</label>
                    <select
                      value={form.vol1_aeronef_id}
                      onChange={(e) => updateVol1Aeronef(e.target.value)}
                      className="select"
                    >
                      <option value="">— Choisir l&apos;aeronef —</option>
                      {aeronefs.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.type_aeronef} ({a.immatriculation}) —{" "}
                          {a.prix_heure}E/h
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="label">Temps de vol (min)</label>
                    <input
                      type="number"
                      value={form.vol1_temps_minutes}
                      onChange={(e) => updateVol1Temps(e.target.value)}
                      className="input"
                      placeholder="45"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="label">Pilote</label>
                    <input
                      value={form.vol1_pilote_nom}
                      onChange={(e) =>
                        setForm({ ...form, vol1_pilote_nom: e.target.value })
                      }
                      className="input"
                      placeholder="Nom du pilote"
                    />
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-600 font-medium">
                      Prix calcule
                    </p>
                    <p className="text-lg font-bold text-emerald-700">
                      {form.vol1_prix
                        ? `${form.vol1_prix} E`
                        : "Selectionnez un aeronef et un temps"}
                    </p>
                    {form.vol1_aeronef_id &&
                      form.vol1_temps_minutes &&
                      (() => {
                        const a = aeronefs.find(
                          (x) => x.id === form.vol1_aeronef_id,
                        );
                        return a ? (
                          <p className="text-[10px] text-emerald-500 mt-0.5">
                            {form.vol1_temps_minutes}min / 60 x {a.prix_heure}
                            E/h = {form.vol1_prix}E
                          </p>
                        ) : null;
                      })()}
                  </div>
                </>
              )}
            </div>
            {/* Vol 2 */}
            <div className="p-3 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={form.vol2_autorise}
                  onChange={(e) =>
                    setForm({ ...form, vol2_autorise: e.target.checked })
                  }
                />
                <span className="text-sm font-semibold text-gray-700">
                  Vol 2 autorise
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input
                  type="checkbox"
                  checked={form.vol2_effectue}
                  onChange={(e) =>
                    setForm({ ...form, vol2_effectue: e.target.checked })
                  }
                />
                <span className="text-sm font-semibold text-gray-700">
                  Vol 2 effectue
                </span>
              </label>
              {form.vol2_effectue && (
                <>
                  <div className="mb-2">
                    <label className="label">Aeronef</label>
                    <select
                      value={form.vol2_aeronef_id}
                      onChange={(e) => updateVol2Aeronef(e.target.value)}
                      className="select"
                    >
                      <option value="">— Choisir l&apos;aeronef —</option>
                      {aeronefs.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.type_aeronef} ({a.immatriculation}) —{" "}
                          {a.prix_heure}E/h
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-2">
                    <label className="label">Temps de vol (min)</label>
                    <input
                      type="number"
                      value={form.vol2_temps_minutes}
                      onChange={(e) => updateVol2Temps(e.target.value)}
                      className="input"
                      placeholder="45"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="label">Pilote</label>
                    <input
                      value={form.vol2_pilote_nom}
                      onChange={(e) =>
                        setForm({ ...form, vol2_pilote_nom: e.target.value })
                      }
                      className="input"
                    />
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <p className="text-xs text-emerald-600 font-medium">
                      Prix calcule
                    </p>
                    <p className="text-lg font-bold text-emerald-700">
                      {form.vol2_prix
                        ? `${form.vol2_prix} E`
                        : "Selectionnez un aeronef et un temps"}
                    </p>
                    {form.vol2_aeronef_id &&
                      form.vol2_temps_minutes &&
                      (() => {
                        const a = aeronefs.find(
                          (x) => x.id === form.vol2_aeronef_id,
                        );
                        return a ? (
                          <p className="text-[10px] text-emerald-500 mt-0.5">
                            {form.vol2_temps_minutes}min / 60 x {a.prix_heure}
                            E/h = {form.vol2_prix}E
                          </p>
                        ) : null;
                      })()}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Commentaires */}
        <div className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Remarques
          </h4>
          <textarea
            value={form.commentaires}
            onChange={(e) => setForm({ ...form, commentaires: e.target.value })}
            className="input min-h-[80px] resize-y"
            placeholder="Adresse, responsable BIA, infos pilote..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
          <button onClick={() => setShowForm(false)} className="btn-secondary">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}{" "}
            {editingId ? "Enregistrer" : "Inscrire"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ══════════════════════════════════════════════════
  // FICHE ELEVE — detail view
  // ══════════════════════════════════════════════════
  if (selected) {
    const s = selected;
    const totalVol = (s.vol1_temps_minutes || 0) + (s.vol2_temps_minutes || 0);
    const totalPrix =
      (parseFloat(s.vol1_prix) || 0) + (parseFloat(s.vol2_prix) || 0);
    return (
      <div>
        {formModal}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <button
            onClick={() => setSelected(null)}
            className="p-2 rounded-lg bg-brand-50 text-brand-500 hover:bg-brand-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {s.prenom} {s.nom}
            </h2>
            <p className="text-sm text-gray-500">
              {s.etablissement?.nom || "—"} · {s.classe}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openEdit(s)}
              className="btn-secondary btn-sm"
            >
              <Edit className="w-3.5 h-3.5" /> Editer
            </button>
            <button
              onClick={() => handleDelete(s.id)}
              className="btn-danger btn-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <Section title="Identite">
              <InfoRow label="Nom" value={s.nom} />
              <InfoRow label="Prenom" value={s.prenom} />
              <InfoRow
                label="Naissance"
                value={new Date(s.date_naissance).toLocaleDateString("fr-FR")}
              />
              <InfoRow label="Lieu" value={s.lieu_naissance} />
              <InfoRow label="Classe" value={s.classe} />
              <InfoRow
                label="Etablissement"
                value={s.etablissement?.nom || "—"}
              />
            </Section>
            <Section title="Responsable legal">
              <InfoRow
                label="Nom"
                value={`${s.parent_prenom} ${s.parent_nom}`}
              />
              <InfoRow label="Email" value={s.parent_email} />
              <InfoRow label="Telephone" value={s.parent_telephone} />
              <div className="mt-2">
                <button
                  onClick={async () => {
                    const { error } = await supabase.auth.resetPasswordForEmail(
                      s.parent_email,
                      {
                        redirectTo: `${window.location.origin}/auth/connexion`,
                      },
                    );
                    alert(
                      error
                        ? `Erreur: ${error.message}`
                        : `Email envoye a ${s.parent_email}`,
                    );
                  }}
                  className="btn-secondary btn-sm"
                >
                  <Mail className="w-3.5 h-3.5" /> Invitation parent
                </button>
              </div>
            </Section>
            {s.commentaires && (
              <Section title="Commentaires">
                <div className="text-sm bg-amber-50 p-3 rounded-lg border-l-[3px] border-amber-400 text-gray-700">
                  {s.commentaires}
                </div>
              </Section>
            )}
          </div>
          <div className="card">
            <Section title="Paiement">
              {s.paiement_effectue ? (
                <>
                  <InfoRow
                    label="Statut"
                    value="Paye"
                    accent="text-emerald-600"
                  />
                  <InfoRow
                    label="Montant"
                    value={`${s.paiement_montant || 80}E`}
                  />
                  {s.paiement_mode && (
                    <InfoRow label="Mode" value={s.paiement_mode} />
                  )}
                </>
              ) : (
                <InfoRow
                  label="Statut"
                  value="En attente"
                  accent="text-red-600"
                />
              )}
            </Section>
            <Section title="Attestation">
              {s.attestation_signee ? (
                <>
                  <InfoRow
                    label="Statut"
                    value="Signee"
                    accent="text-emerald-600"
                  />
                  {s.attestation_parent_signataire && (
                    <InfoRow
                      label="Signataire"
                      value={s.attestation_parent_signataire}
                    />
                  )}
                  {s.attestation_url && (
                    <div className="mt-2">
                      <button
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from("attestations")
                            .download(s.attestation_url);
                          if (data) {
                            const url = URL.createObjectURL(data);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `attestation_${s.nom}.pdf`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }
                        }}
                        className="btn-secondary btn-sm"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <InfoRow
                  label="Statut"
                  value="Non signee"
                  accent="text-red-600"
                />
              )}
            </Section>
            <Section title="Vol 1">
              {s.vol1_effectue ? (
                <>
                  <InfoRow
                    label="Statut"
                    value="Effectue"
                    accent="text-emerald-600"
                  />
                  {s.vol1_temps_minutes && (
                    <InfoRow
                      label="Temps"
                      value={`${s.vol1_temps_minutes} min`}
                    />
                  )}
                  {s.vol1_aeronef && (
                    <InfoRow
                      label="Aeronef"
                      value={`${s.vol1_aeronef.type_aeronef} (${s.vol1_aeronef.immatriculation})`}
                    />
                  )}
                  {s.vol1_pilote_nom && (
                    <InfoRow label="Pilote" value={s.vol1_pilote_nom} />
                  )}
                  {s.vol1_prix && (
                    <InfoRow
                      label="Prix vol"
                      value={`${s.vol1_prix}E`}
                      accent="text-red-600"
                    />
                  )}
                </>
              ) : (
                <InfoRow
                  label="Statut"
                  value={
                    s.paiement_effectue && s.attestation_signee
                      ? "Peut reserver"
                      : "Conditions non remplies"
                  }
                />
              )}
            </Section>
            <Section title="BIA">
              {s.bia_resultat ? (
                <>
                  <InfoRow
                    label="Resultat"
                    value={s.bia_resultat}
                    accent="text-emerald-600"
                  />
                  {s.bia_date && (
                    <InfoRow
                      label="Date"
                      value={new Date(s.bia_date).toLocaleDateString("fr-FR")}
                    />
                  )}
                </>
              ) : (
                <InfoRow label="Statut" value="En attente" />
              )}
            </Section>
            <Section title="Vol 2">
              {s.vol2_effectue ? (
                <>
                  <InfoRow
                    label="Statut"
                    value="Effectue"
                    accent="text-emerald-600"
                  />
                  {s.vol2_temps_minutes && (
                    <InfoRow
                      label="Temps"
                      value={`${s.vol2_temps_minutes} min`}
                    />
                  )}
                  {s.vol2_aeronef && (
                    <InfoRow
                      label="Aeronef"
                      value={`${s.vol2_aeronef.type_aeronef} (${s.vol2_aeronef.immatriculation})`}
                    />
                  )}
                  {s.vol2_pilote_nom && (
                    <InfoRow label="Pilote" value={s.vol2_pilote_nom} />
                  )}
                  {s.vol2_prix && (
                    <InfoRow
                      label="Prix vol"
                      value={`${s.vol2_prix}E`}
                      accent="text-red-600"
                    />
                  )}
                  <InfoRow
                    label="Total temps"
                    value={`${totalVol} min`}
                    accent={
                      totalVol >= 40 ? "text-emerald-600" : "text-amber-600"
                    }
                  />
                  <InfoRow
                    label="Total prix vols"
                    value={`${totalPrix.toFixed(2)}E`}
                    accent="text-red-600"
                  />
                </>
              ) : s.vol2_autorise ? (
                <InfoRow
                  label="Statut"
                  value="Autorise"
                  accent="text-amber-600"
                />
              ) : (
                <InfoRow label="Statut" value="—" />
              )}
            </Section>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════
  // TABLE — list view
  // ══════════════════════════════════════════════════
  return (
    <div>
      {formModal}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Eleves BIA</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} eleve{filtered.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button onClick={openCreate} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" /> Inscrire
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Rechercher..."
            className="input pl-9"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn-secondary btn-sm relative ${showFilters ? "ring-2 ring-brand-400/30" : ""}`}
        >
          <Filter className="w-3.5 h-3.5" /> Filtres
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {activeFilters}
            </span>
          )}
        </button>
        {activeFilters > 0 && (
          <button
            onClick={() => {
              setFEtab("all");
              setFPaiement("all");
              setFAttest("all");
              setFVol1("all");
              setFBia("all");
            }}
            className="text-xs text-red-500 font-semibold"
          >
            Reset
          </button>
        )}
      </div>

      {showFilters && (
        <div className="card mb-3 p-4">
          <div className="flex gap-3 flex-wrap">
            <div className="min-w-[140px]">
              <label className="label">Etablissement</label>
              <select
                value={fEtab}
                onChange={(e) => setFEtab(e.target.value)}
                className="select"
              >
                <option value="all">Tous</option>
                {etablissements.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="label">Paiement</label>
              <select
                value={fPaiement}
                onChange={(e) => setFPaiement(e.target.value)}
                className="select"
              >
                <option value="all">Tous</option>
                <option value="oui">Paye</option>
                <option value="non">Non</option>
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="label">Attestation</label>
              <select
                value={fAttest}
                onChange={(e) => setFAttest(e.target.value)}
                className="select"
              >
                <option value="all">Toutes</option>
                <option value="oui">Signee</option>
                <option value="non">Non</option>
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="label">Vol 1</label>
              <select
                value={fVol1}
                onChange={(e) => setFVol1(e.target.value)}
                className="select"
              >
                <option value="all">Tous</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </div>
            <div className="min-w-[120px]">
              <label className="label">BIA</label>
              <select
                value={fBia}
                onChange={(e) => setFBia(e.target.value)}
                className="select"
              >
                <option value="all">Tous</option>
                <option value="admis">Admis</option>
                <option value="non">Non</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="card p-0 overflow-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead>
              <tr className="bg-gray-50">
                {[
                  "Nom",
                  "Prenom",
                  "Etablissement",
                  "Classe",
                  "Paie.",
                  "Att.",
                  "Vol 1",
                  "BIA",
                  "Vol 2",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-12 text-center text-gray-400"
                  >
                    {eleves.length === 0 ? (
                      <div className="flex flex-col items-center gap-2">
                        <Users className="w-8 h-8 text-gray-300" />
                        <p>Aucun eleve</p>
                        <button
                          onClick={openCreate}
                          className="btn-primary btn-sm mt-2"
                        >
                          <Plus className="w-3.5 h-3.5" /> Inscrire
                        </button>
                      </div>
                    ) : (
                      "Aucun resultat"
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => setSelected(s)}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-semibold text-gray-900">
                      {s.nom}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">{s.prenom}</td>
                    <td className="px-3 py-2.5">
                      <span className="badge bg-brand-50 text-brand-500 truncate max-w-[150px]">
                        {s.etablissement?.nom || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">
                      {s.classe}
                    </td>
                    <td className="px-3 py-2.5">
                      <Dot ok={s.paiement_effectue} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Dot ok={s.attestation_signee} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Dot ok={s.vol1_effectue} />
                    </td>
                    <td className="px-3 py-2.5">
                      {s.bia_resultat ? (
                        <span className="badge bg-emerald-50 text-emerald-600">
                          {s.bia_resultat}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {s.vol2_effectue ? (
                        <Dot ok />
                      ) : s.vol2_autorise ? (
                        <span className="badge bg-amber-50 text-amber-600">
                          OK
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Eye className="w-4 h-4 text-brand-400" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
