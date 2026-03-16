"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  Search,
  Edit,
  Loader2,
  X,
  Check,
  Plus,
  Mail,
  UserPlus,
  AlertCircle,
  Trash2,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";

const ALL_ROLES = [
  {
    value: "superadmin",
    label: "SuperAdmin",
    color: "text-red-600 bg-red-50",
    desc: "Tous les droits",
  },
  {
    value: "coordinateur",
    label: "Coordinateur",
    color: "text-blue-600 bg-blue-50",
    desc: "Vue globale",
  },
  {
    value: "pilote",
    label: "Pilote",
    color: "text-amber-600 bg-amber-50",
    desc: "Gestion vols",
  },
  {
    value: "gerant",
    label: "Gerant",
    color: "text-emerald-600 bg-emerald-50",
    desc: "Gestion eleves",
  },
  {
    value: "parent",
    label: "Parent",
    color: "text-gray-600 bg-gray-100",
    desc: "Espace famille",
  },
];

const emptyCreate = {
  email: "",
  nom: "",
  prenom: "",
  telephone: "",
  roles: [] as string[],
  etablissement_id: "",
  etablissement_ids: [] as string[],
};

export default function UtilisateursPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<any[]>([]);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [elevesByParentEmail, setElevesByParentEmail] = useState<Record<string, string[]>>({});
  const [parentNameByEmail, setParentNameByEmail] = useState<Record<string, string>>({});
  const [isSA, setIsSA] = useState(false);
  const [parentEmails, setParentEmails] = useState<{ email: string; nom: string; prenom: string }[]>([]);
  const [parentDataByEmail, setParentDataByEmail] = useState<Record<string, { nom: string; prenom: string }>>({});
  // Bulk invite state
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const [bulkDone, setBulkDone] = useState(false);
  const [confirmInvite, setConfirmInvite] = useState<any | null>(null);
  const [confirmInviteLoading, setConfirmInviteLoading] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const [usersRes, etabsRes, elevesRes, profRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, etablissement_ids, etablissement:etablissements(nom)")
        .order("nom"),
      supabase
        .from("etablissements")
        .select("*")
        .eq("actif", true)
        .order("nom"),
      supabase
        .from("eleves")
        .select("prenom, nom, parent_email, parent_nom, parent_prenom"),
      user
        ? supabase.from("profiles").select("roles").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
    ]);
    setUsers(usersRes.data || []);
    setEtabs(etabsRes.data || []);
    setIsSA(profRes.data?.roles?.includes("superadmin") ?? false);
    // Build unique parent email list for bulk invite
    const seen = new Set<string>();
    const pList: { email: string; nom: string; prenom: string }[] = [];
    for (const e of elevesRes.data || []) {
      if (!e.parent_email) continue;
      const key = e.parent_email.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        pList.push({ email: e.parent_email, nom: e.parent_nom || "", prenom: e.parent_prenom || "" });
      }
    }
    setParentEmails(pList);

    // Build maps: parent_email -> student names + parent name fallback
    const studentMap: Record<string, string[]> = {};
    const parentNameMap: Record<string, string> = {};
    const parentDataMap: Record<string, { nom: string; prenom: string }> = {};
    for (const e of elevesRes.data || []) {
      if (!e.parent_email) continue;
      const key = e.parent_email.toLowerCase();
      if (!studentMap[key]) studentMap[key] = [];
      studentMap[key].push(`${e.prenom} ${e.nom}`);
      // Store parent name from eleve fiche as fallback (in case profile has no name)
      if (!parentNameMap[key] && (e.parent_prenom || e.parent_nom)) {
        parentNameMap[key] = `${e.parent_prenom ?? ""} ${e.parent_nom ?? ""}`.trim();
        parentDataMap[key] = { nom: e.parent_nom || "", prenom: e.parent_prenom || "" };
      }
    }
    setElevesByParentEmail(studentMap);
    setParentNameByEmail(parentNameMap);
    setParentDataByEmail(parentDataMap);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = users.filter((u) => {
    if (
      searchQ &&
      !`${u.nom} ${u.prenom} ${u.email}`
        .toLowerCase()
        .includes(searchQ.toLowerCase())
    )
      return false;
    if (filterRole !== "all" && !u.roles?.includes(filterRole)) return false;
    return true;
  });

  function toggleRole(role: string, target: "edit" | "create") {
    if (target === "edit" && editing) {
      const has = editing.roles?.includes(role);
      setEditing({
        ...editing,
        roles: has
          ? editing.roles.filter((r: string) => r !== role)
          : [...(editing.roles || []), role],
      });
    } else if (target === "create") {
      const has = createForm.roles.includes(role);
      setCreateForm({
        ...createForm,
        roles: has
          ? createForm.roles.filter((r) => r !== role)
          : [...createForm.roles, role],
      });
    }
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const ids: string[] = editing.etablissement_ids || [];
    const { error: err } = await supabase
      .from("profiles")
      .update({
        nom: editing.nom,
        prenom: editing.prenom,
        telephone: editing.telephone,
        roles: editing.roles,
        etablissement_id: ids[0] || null,       // keep legacy FK in sync
        etablissement_ids: ids,                  // full multi-etab array
        actif: editing.actif,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Profil mis à jour");
    setEditing(null);
    load();
  }

  async function handleCreate() {
    setError(null);
    if (!createForm.email || !createForm.nom || !createForm.prenom) {
      setError("Email, nom et prenom obligatoires.");
      return;
    }
    if (createForm.roles.length === 0) {
      setError("Selectionnez au moins un role.");
      return;
    }
    setSaving(true);

    const res = await fetch("/api/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: createForm.email,
        nom: createForm.nom,
        prenom: createForm.prenom,
        telephone: createForm.telephone,
        roles: createForm.roles,
        etablissement_id: createForm.etablissement_id || null,
        etablissement_ids: createForm.etablissement_ids,
      }),
    });
    const json = await res.json();

    setSaving(false);
    if (!res.ok) {
      toast.error(`Erreur création compte: ${json.error}`);
      return;
    }

    setCreating(false);
    setCreateForm({ ...emptyCreate });
    toast.success(`Compte créé — identifiants envoyés à ${createForm.email}`);
    load();
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const res = await fetch("/api/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: confirmDelete.id }),
    });
    const json = await res.json();
    setDeleting(false);
    if (!res.ok) {
      // Keep modal open and show the specific blocking reason
      setDeleteError(json.error);
      return;
    }
    setConfirmDelete(null);
    setDeleteError(null);
    toast.success(`Compte de ${confirmDelete.prenom} ${confirmDelete.nom} supprimé`);
    load();
  }

  function handleSendInvite(user: any) {
    setConfirmInvite(user);
  }

  async function doSendInvite(user: any) {
    setSendingInvite(user.id);
    const tid = toast.loading("Envoi de l'invitation…");
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, nom: user.nom, prenom: user.prenom }),
    });
    const json = await res.json();
    setSendingInvite(null);
    toast.dismiss(tid);
    if (!res.ok) toast.error(`Erreur: ${json.error}`);
    else toast.success(`Email envoyé à ${user.email}`);
  }

  async function handleBulkInvite() {
    if (parentEmails.length === 0) return;
    setBulkSending(true);
    setBulkProgress(0);
    setBulkTotal(parentEmails.length);
    setBulkDone(false);
    for (let i = 0; i < parentEmails.length; i++) {
      const p = parentEmails[i];
      await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: p.email, nom: p.nom, prenom: p.prenom }),
      }).catch(() => {});
      setBulkProgress(i + 1);
      // Small delay to avoid Resend rate limits
      await new Promise((r) => setTimeout(r, 300));
    }
    setBulkSending(false);
    setBulkDone(true);
  }

  const roleColor = (r: string) =>
    ALL_ROLES.find((ar) => ar.value === r)?.color ||
    "text-gray-500 bg-gray-100";

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Utilisateurs & Roles
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length} utilisateur{users.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {isSA && (
            <button
              onClick={() => { setShowBulkInvite(true); setBulkDone(false); setBulkProgress(0); }}
              className="btn-secondary btn-sm"
            >
              <Mail className="w-3.5 h-3.5" /> Inviter les parents
            </button>
          )}
          <button
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className="btn-primary btn-sm"
          >
            <UserPlus className="w-3.5 h-3.5" /> Creer un compte
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-start gap-2">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{success}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Rechercher..."
            className="input"
            style={{ paddingLeft: "2.25rem" }}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {[{ value: "all", label: "Tous" }, ...ALL_ROLES].map((r) => (
            <button
              key={r.value}
              onClick={() => setFilterRole(r.value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${filterRole === r.value ? "border-brand-500 bg-brand-50 text-brand-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Invite Modal */}
      {showBulkInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !bulkSending && setShowBulkInvite(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-gray-900">Inviter les parents</h3>
              {!bulkSending && (
                <button onClick={() => setShowBulkInvite(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {!bulkSending && !bulkDone && (
              <>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-5">
                  <p className="text-sm font-semibold text-amber-800 mb-1">Confirmation requise</p>
                  <p className="text-sm text-amber-700">
                    Vous allez envoyer un email d&apos;invitation (ou de réinitialisation de mot de passe) à{" "}
                    <strong>{parentEmails.length} adresse{parentEmails.length > 1 ? "s" : ""}</strong> parent.
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    Les parents qui ont déjà un compte recevront un lien de réinitialisation de mot de passe.
                    Les nouveaux recevront une invitation pour créer leur compte.
                  </p>
                </div>
                <div className="max-h-40 overflow-auto rounded-lg border border-gray-200 mb-5 text-xs">
                  {parentEmails.map((p, i) => (
                    <div key={i} className="flex justify-between px-3 py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700">{p.prenom} {p.nom}</span>
                      <span className="text-gray-400">{p.email}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowBulkInvite(false)} className="btn-secondary btn-sm">Annuler</button>
                  <button onClick={handleBulkInvite} className="btn-primary btn-sm">
                    <Mail className="w-3.5 h-3.5" /> Envoyer {parentEmails.length} email{parentEmails.length > 1 ? "s" : ""}
                  </button>
                </div>
              </>
            )}
            {bulkSending && (
              <div className="text-center py-6">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400 mx-auto mb-4" />
                <p className="text-sm font-semibold text-gray-900 mb-2">Envoi en cours…</p>
                <p className="text-sm text-gray-500 mb-4">{bulkProgress} / {bulkTotal} emails envoyés</p>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${bulkTotal > 0 ? (bulkProgress / bulkTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
            {bulkDone && (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-7 h-7 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-2">{bulkTotal} emails envoyés !</p>
                <p className="text-sm text-gray-500 mb-5">Tous les parents ont reçu leur invitation.</p>
                <button onClick={() => setShowBulkInvite(false)} className="btn-primary btn-sm">Fermer</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setCreating(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                Creer un compte
              </h3>
              <button
                onClick={() => setCreating(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-sm text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label">Prenom *</label>
                <input
                  value={createForm.prenom}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, prenom: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Nom *</label>
                <input
                  value={createForm.nom}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, nom: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, email: e.target.value })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Telephone</label>
                <input
                  value={createForm.telephone}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, telephone: e.target.value })
                  }
                  className="input"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="label mb-2">Établissements</label>
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {etabs.map((e) => {
                  const checked = createForm.etablissement_ids.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => {
                        const next = checked
                          ? createForm.etablissement_ids.filter((x) => x !== e.id)
                          : [...createForm.etablissement_ids, e.id];
                        setCreateForm({ ...createForm, etablissement_ids: next, etablissement_id: next[0] || "" });
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-50 last:border-0 transition-colors ${checked ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"}`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      {e.nom}
                    </button>
                  );
                })}
              </div>
              {createForm.etablissement_ids.length > 0 && (
                <p className="text-xs text-brand-500 mt-1">{createForm.etablissement_ids.length} établissement{createForm.etablissement_ids.length > 1 ? "s" : ""} sélectionné{createForm.etablissement_ids.length > 1 ? "s" : ""}</p>
              )}
            </div>
            <div className="mb-4">
              <label className="label mb-2">Roles *</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((r) => {
                  const active = createForm.roles.includes(r.value);
                  return (
                    <div
                      key={r.value}
                      onClick={() => toggleRole(r.value, "create")}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${active ? "border-brand-400 bg-brand-50/50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${active ? "text-brand-500" : "text-gray-500"}`}
                        >
                          {r.label}
                        </span>
                        {active && <Check className="w-4 h-4 text-brand-500" />}
                      </div>
                      <p className="text-[11px] text-gray-400">{r.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                onClick={() => setCreating(false)}
                className="btn-secondary"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}{" "}
                Creer le compte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setEditing(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl max-h-[90vh] overflow-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">
                Editer — {editing.prenom} {editing.nom}
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
              <div className="col-span-2">
                <label className="label mb-2">Établissements</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                  {etabs.map((e: any) => {
                    const ids: string[] = editing.etablissement_ids || (editing.etablissement_id ? [editing.etablissement_id] : []);
                    const checked = ids.includes(e.id);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          const next = checked ? ids.filter((x: string) => x !== e.id) : [...ids, e.id];
                          setEditing({ ...editing, etablissement_ids: next, etablissement_id: next[0] || null });
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm border-b border-gray-50 last:border-0 transition-colors ${checked ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? "border-brand-500 bg-brand-500" : "border-gray-300"}`}>
                          {checked && <Check className="w-2.5 h-2.5 text-white" />}
                        </span>
                        {e.nom}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="label mb-2">Roles</label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((r) => {
                  const active = editing.roles?.includes(r.value);
                  return (
                    <div
                      key={r.value}
                      onClick={() => toggleRole(r.value, "edit")}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${active ? "border-brand-400 bg-brand-50/50" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${active ? "text-brand-500" : "text-gray-500"}`}
                        >
                          {r.label}
                        </span>
                        {active && <Check className="w-4 h-4 text-brand-500" />}
                      </div>
                      <p className="text-[11px] text-gray-400">{r.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.actif}
                  onChange={(e) =>
                    setEditing({ ...editing, actif: e.target.checked })
                  }
                />
                <span className="font-medium text-gray-700">Compte actif</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(null)}
                  className="btn-secondary btn-sm"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary btn-sm"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{" "}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setConfirmDelete(null); setDeleteError(null); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Supprimer le compte</h3>
                <p className="text-sm text-gray-500">{confirmDelete.prenom} {confirmDelete.nom}</p>
              </div>
            </div>

            {deleteError ? (
              <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{deleteError}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-5">
                Cette action supprime définitivement le compte et l&apos;accès à la plateforme. Les données associées (élèves, créneaux, etc.) ne seront pas supprimées.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmDelete(null); setDeleteError(null); }} className="btn-secondary btn-sm">
                {deleteError ? "Fermer" : "Annuler"}
              </button>
              {!deleteError && (
                <button onClick={handleDelete} disabled={deleting} className="btn-danger btn-sm">
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="card p-0 overflow-auto">
        <table className="w-full text-sm min-w-[750px]">
          <thead>
            <tr className="bg-gray-50">
              {["Utilisateur", "Email", "Role(s)", "Établissement", "Statut", "", "", ""].map((h, i) => (
                <th key={i} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const emailKey = u.email?.toLowerCase();
              const linkedStudents = elevesByParentEmail[emailKey] || [];
              const profileName = `${u.prenom ?? ""} ${u.nom ?? ""}`.trim();
              const displayName = profileName || parentNameByEmail[emailKey] || u.email;
              return (
                <tr key={u.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-gray-900">{displayName}</div>
                    {linkedStudents.length > 0 && (
                      <div className="text-[11px] text-blue-500 mt-0.5">
                        Élève{linkedStudents.length > 1 ? "s" : ""} : {linkedStudents.join(", ")}
                      </div>
                    )}
                    {u.telephone && (
                      <div className="text-[11px] text-gray-400">{u.telephone}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{u.email}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {u.roles?.map((r: string) => (
                        <span key={r} className={`badge ${roleColor(r)}`}>
                          {ALL_ROLES.find((ar) => ar.value === r)?.label || r}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{u.etablissement?.nom || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={u.actif ? "dot-success" : "dot-danger"} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => {
                        const emailKey = u.email?.toLowerCase();
                        const fallback = parentDataByEmail[emailKey] || { nom: "", prenom: "" };
                        setEditing({
                          ...u,
                          nom: u.nom || fallback.nom,
                          prenom: u.prenom || fallback.prenom,
                        });
                        setError(null);
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded-md"
                    >
                      <Edit className="w-3 h-3" /> Éditer
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => handleSendInvite(u)}
                      disabled={sendingInvite === u.id}
                      className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded-md"
                    >
                      {sendingInvite === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                      Invitation
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setConfirmDelete(u)}
                      className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded-md"
                    >
                      <Trash2 className="w-3 h-3" /> Supprimer
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!confirmInvite}
        title="Envoyer l'invitation"
        message={`Envoyer un email d'invitation/accès à ${confirmInvite?.email ?? ""} ?`}
        confirmLabel="Envoyer"
        variant="primary"
        loading={confirmInviteLoading}
        onCancel={() => setConfirmInvite(null)}
        onConfirm={async () => {
          if (!confirmInvite) return;
          setConfirmInviteLoading(true);
          await doSendInvite(confirmInvite);
          setConfirmInviteLoading(false);
          setConfirmInvite(null);
        }}
      />
    </div>
  );
}
