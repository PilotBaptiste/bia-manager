"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
} from "lucide-react";

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
  password: "",
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

  async function load() {
    const [usersRes, etabsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("*, etablissement:etablissements(nom)")
        .order("nom"),
      supabase
        .from("etablissements")
        .select("*")
        .eq("actif", true)
        .order("nom"),
    ]);
    setUsers(usersRes.data || []);
    setEtabs(etabsRes.data || []);
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
    const { error: err } = await supabase
      .from("profiles")
      .update({
        nom: editing.nom,
        prenom: editing.prenom,
        telephone: editing.telephone,
        roles: editing.roles,
        etablissement_id: editing.etablissement_id || null,
        actif: editing.actif,
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

    // Generate random password if not set
    const password =
      createForm.password || Math.random().toString(36).slice(-10) + "A1!";

    // Create user via Supabase Auth (admin endpoint)
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: createForm.email,
      password: password,
      options: { data: { nom: createForm.nom, prenom: createForm.prenom } },
    });

    if (authErr) {
      setError(`Erreur creation compte: ${authErr.message}`);
      setSaving(false);
      return;
    }

    // Wait a moment for the trigger to create the profile
    await new Promise((r) => setTimeout(r, 1000));

    // Update the profile with roles and other info
    if (authData.user) {
      await supabase
        .from("profiles")
        .update({
          nom: createForm.nom,
          prenom: createForm.prenom,
          telephone: createForm.telephone,
          roles: createForm.roles,
          etablissement_id: createForm.etablissement_id || null,
        })
        .eq("id", authData.user.id);
    }

    setSaving(false);
    setCreating(false);
    setSuccess(
      `Compte cree pour ${createForm.prenom} ${createForm.nom} (${createForm.email}). Mot de passe temporaire: ${password}`,
    );
    setCreateForm(emptyCreate);
    setTimeout(() => setSuccess(null), 15000);
    load();
  }

  async function handleSendInvite(user: any) {
    setSendingInvite(user.id);
    // Use Supabase password reset to send a "set your password" email
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      user.email,
      {
        redirectTo: `${window.location.origin}/auth/connexion`,
      },
    );
    setSendingInvite(null);
    if (err) {
      setError(`Erreur envoi email: ${err.message}`);
    } else {
      setSuccess(`Email de creation de mot de passe envoye a ${user.email}`);
      setTimeout(() => setSuccess(null), 5000);
    }
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
            className="input pl-9"
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
              <div>
                <label className="label">Mot de passe (auto si vide)</label>
                <input
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, password: e.target.value })
                  }
                  className="input"
                  placeholder="Genere automatiquement"
                />
              </div>
              <div>
                <label className="label">Etablissement</label>
                <select
                  value={createForm.etablissement_id}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      etablissement_id: e.target.value,
                    })
                  }
                  className="select"
                >
                  <option value="">Aucun</option>
                  {etabs.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </select>
              </div>
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
                <label className="label">Etablissement</label>
                <select
                  value={editing.etablissement_id || ""}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      etablissement_id: e.target.value || null,
                    })
                  }
                  className="select"
                >
                  <option value="">Aucun</option>
                  {etabs.map((e: any) => (
                    <option key={e.id} value={e.id}>
                      {e.nom}
                    </option>
                  ))}
                </select>
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

      {/* Users table */}
      <div className="card p-0 overflow-auto">
        <table className="w-full text-sm min-w-[750px]">
          <thead>
            <tr className="bg-gray-50">
              {[
                "Utilisateur",
                "Email",
                "Role(s)",
                "Etablissement",
                "Statut",
                "",
                "",
              ].map((h, i) => (
                <th
                  key={i}
                  className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr
                key={u.id}
                className="border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-gray-900">
                    {u.prenom} {u.nom}
                  </div>
                  {u.telephone && (
                    <div className="text-[11px] text-gray-400">
                      {u.telephone}
                    </div>
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
                <td className="px-3 py-2.5 text-gray-500 text-xs">
                  {u.etablissement?.nom || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span className={u.actif ? "dot-success" : "dot-danger"} />
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => {
                      setEditing({ ...u });
                      setError(null);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded-md"
                  >
                    <Edit className="w-3 h-3" /> Editer
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => handleSendInvite(u)}
                    disabled={sendingInvite === u.id}
                    className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded-md"
                  >
                    {sendingInvite === u.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Mail className="w-3 h-3" />
                    )}{" "}
                    Invitation
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
