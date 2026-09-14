"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Loader2,
  X,
  LogIn,
  Edit,
  Power,
  Users,
  School,
  Plane,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Mail,
  Puzzle,
  Bug,
} from "lucide-react";
import { ROOT_DOMAIN, clubUrl } from "@/lib/tenant";
import { MODULES, MODULE_CATEGORIES } from "@/lib/modules";

type Club = {
  id: string;
  slug: string;
  nom: string;
  actif: boolean;
  created_at: string;
  annee: string | null;
  counts: { etablissements: number; eleves: number; users: number; parents: number; vol1: number; vol2: number; vols: number; creneauxClotures: number };
  admins: { prenom: string; nom: string; email: string }[];
  modules: string[];
};

function slugify(nom: string) {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/^a[eé]ro[\s-]?club\s+(de la\s+|de l['’]|du\s+|des\s+|de\s+|d['’])/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42)
    .replace(/-+$/g, "");
}

function defaultYear() {
  const now = new Date();
  const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return { anneeLabel: `${y}-${y + 1}`, anneeDebut: `${y}-09-01`, anneeFin: `${y + 1}-08-31` };
}

const emptyForm = () => ({
  nom: "",
  slug: "",
  sigle: "",
  adminPrenom: "",
  adminNom: "",
  adminEmail: "",
  ...defaultYear(),
  dateExamenBia: "",
});

const siteLabel = (slug: string) => (ROOT_DOMAIN ? `${slug}.${ROOT_DOMAIN}` : slug);

async function api<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erreur serveur inattendue");
  return data;
}

export default function PlateformePage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openedSlug, setOpenedSlug] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ nom: string; siteUrl: string; inviteLink?: string; warning?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [modulesFor, setModulesFor] = useState<Club | null>(null);
  const [testingSentry, setTestingSentry] = useState(false);
  const [modulesDraft, setModulesDraft] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<Club | null>(null);
  const [newNom, setNewNom] = useState("");
  const [toggling, setToggling] = useState<Club | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api<{ clubs: Club[]; currentOrgId: string | null }>("/api/plateforme/clubs");
      setClubs(data.clubs);
      setCurrentOrgId(data.currentOrgId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setOpenedSlug(new URLSearchParams(window.location.search).get("club"));
    load();
  }, []);

  const totals = useMemo(
    () => ({
      actifs: clubs.filter((c) => c.actif).length,
      eleves: clubs.reduce((s, c) => s + c.counts.eleves, 0),
      etablissements: clubs.reduce((s, c) => s + c.counts.etablissements, 0),
      vols: clubs.reduce((s, c) => s + c.counts.vols, 0),
    }),
    [clubs],
  );

  const openedClub = openedSlug ? clubs.find((c) => c.slug === openedSlug) ?? null : null;

  async function enter(club: Club) {
    if (club.id === currentOrgId) {
      window.location.href = clubUrl(club.slug, "/dashboard", window.location.origin);
      return;
    }
    setEntering(club.id);
    try {
      const { url } = await api<{ url: string }>("/api/plateforme/entrer", {
        method: "POST",
        body: JSON.stringify({ organisationId: club.id }),
      });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message);
      setEntering(null);
    }
  }

  function openCreate() {
    setForm(emptyForm());
    setSlugTouched(false);
    setResult(null);
    setShowCreate(true);
  }

  function closeCreate() {
    if (creating) return;
    setShowCreate(false);
    setResult(null);
  }

  async function handleCreate() {
    if (!form.nom.trim() || !form.slug.trim() || !form.adminEmail.trim()) {
      toast.error("Nom, adresse du site et email de l'administrateur sont obligatoires");
      return;
    }
    setCreating(true);
    try {
      const data = await api<{ organisation: Club; siteUrl: string; inviteLink?: string; warning?: string }>("/api/plateforme/clubs", {
        method: "POST",
        body: JSON.stringify({ ...form, dateExamenBia: form.dateExamenBia || undefined }),
      });
      toast.success(`${data.organisation.nom} a été créé`);
      if (data.warning) toast.warning(data.warning);
      setResult({ nom: data.organisation.nom, siteUrl: data.siteUrl, inviteLink: data.inviteLink, warning: data.warning });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Copie impossible, sélectionnez le lien manuellement");
    }
  }

  async function testSentry() {
    setTestingSentry(true);
    try {
      const { eventId } = await api<{ eventId: string }>("/api/plateforme/test-sentry", { method: "POST" });
      toast.success(`Erreur de test envoyée à Sentry (réf. ${eventId.slice(0, 8)}). Elle doit apparaître dans Issues d'ici une minute.`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setTestingSentry(false);
    }
  }

  async function handleSaveModules() {
    if (!modulesFor) return;
    setSaving(true);
    try {
      await api(`/api/plateforme/clubs/${modulesFor.id}`, { method: "PATCH", body: JSON.stringify({ modules: modulesDraft }) });
      toast.success(`Modules de ${modulesFor.nom} enregistrés`);
      setModulesFor(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRename() {
    if (!renaming || !newNom.trim()) return;
    setSaving(true);
    try {
      await api(`/api/plateforme/clubs/${renaming.id}`, { method: "PATCH", body: JSON.stringify({ nom: newNom.trim() }) });
      toast.success("Aéroclub renommé");
      setRenaming(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!toggling) return;
    setSaving(true);
    try {
      await api(`/api/plateforme/clubs/${toggling.id}`, { method: "PATCH", body: JSON.stringify({ actif: !toggling.actif }) });
      toast.success(toggling.actif ? `${toggling.nom} est désactivé` : `${toggling.nom} est réactivé`);
      setToggling(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  }

  const kpis = [
    { label: "Clubs actifs", value: totals.actifs, icon: Building2 },
    { label: "Élèves", value: totals.eleves, icon: Users },
    { label: "Établissements actifs", value: totals.etablissements, icon: School },
    { label: "Vols élèves effectués", value: totals.vols, icon: Plane },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Aéroclubs</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clubs.length} aéroclub{clubs.length > 1 ? "s" : ""} sur la plateforme</p>
        </div>
        <div className="flex gap-2">
          <button onClick={testSentry} disabled={testingSentry} className="btn-secondary btn-sm" title="Envoyer une erreur de test à Sentry">
            {testingSentry ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bug className="w-3.5 h-3.5" />} Tester Sentry
          </button>
          <button onClick={openCreate} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> Nouvel aéroclub</button>
        </div>
      </div>

      {/* Club ouvert depuis son sous-domaine */}
      {openedSlug && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
          <div className="flex items-center gap-2.5 text-sm text-brand-600">
            <MapPin className="w-4 h-4 shrink-0" />
            {openedClub ? (
              <span>Vous avez ouvert le site de <strong>{openedClub.nom}</strong>. Y accéder avec votre compte ?</span>
            ) : (
              <span>Aucun aéroclub ne correspond à l&apos;adresse « {openedSlug} ».</span>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setOpenedSlug(null)} className="btn-secondary btn-sm">Ignorer</button>
            {openedClub && (
              <button onClick={() => enter(openedClub)} disabled={entering !== null} className="btn-primary btn-sm">
                {entering === openedClub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                Accéder au site
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="card">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <k.icon className="w-4 h-4 text-brand-500" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{k.value.toLocaleString("fr-FR")}</p>
                <p className="text-xs text-gray-500 truncate">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Liste */}
      {clubs.length === 0 ? (
        <div className="card text-center">
          <div className="py-8">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5 text-brand-500" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Aucun aéroclub</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">Créez le premier club pour démarrer.</p>
          <button onClick={openCreate} className="btn-primary btn-sm mx-auto"><Plus className="w-3.5 h-3.5" /> Nouvel aéroclub</button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-left">
                  {["Aéroclub", "Administrateurs", "Établissements", "Élèves", "Vols élèves", "Comptes", "Statut", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap ${i >= 2 && i <= 5 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clubs.map((c) => {
                  const isHere = c.id === currentOrgId;
                  return (
                    <tr key={c.id} className={`align-top ${c.actif ? "" : "bg-gray-50/60"}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-semibold ${c.actif ? "text-gray-900" : "text-gray-500"}`}>{c.nom}</p>
                          {isHere && <span className="badge bg-brand-50 text-brand-500">Vous êtes ici</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{siteLabel(c.slug)}</p>
                        {c.annee && <p className="text-[11px] text-gray-400 mt-0.5">Année {c.annee}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {c.admins.length === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="space-y-1">
                            {c.admins.map((a) => (
                              <div key={a.email} className="min-w-0">
                                <p className="text-xs font-medium text-gray-700">{[a.prenom, a.nom].filter(Boolean).join(" ") || "—"}</p>
                                <p className="text-[11px] text-gray-400 truncate max-w-[220px]">{a.email}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{c.counts.etablissements}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">{c.counts.eleves}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        <p>{c.counts.vols}</p>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">Vol 1 : {c.counts.vol1} · Vol 2 : {c.counts.vol2}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                        <p>{c.counts.users}</p>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">dont {c.counts.parents} parent{c.counts.parents > 1 ? "s" : ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${c.actif ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                          {c.actif ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.actif && (
                            <button onClick={() => enter(c)} disabled={entering !== null} className="btn-primary btn-sm whitespace-nowrap" title={`Ouvrir ${siteLabel(c.slug)} avec votre compte`}>
                              {entering === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                              Accéder au site
                            </button>
                          )}
                          <button
                            onClick={() => { setModulesFor(c); setModulesDraft(c.modules ?? []); }}
                            className="relative p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            title="Modules du club"
                          >
                            <Puzzle className="w-3.5 h-3.5" />
                            {(c.modules?.length ?? 0) > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand-400" />}
                          </button>
                          <button
                            onClick={() => { setRenaming(c); setNewNom(c.nom); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            title="Renommer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setToggling(c)}
                            className={`p-1.5 rounded-lg transition-colors ${c.actif ? "text-gray-400 hover:bg-red-50 hover:text-red-600" : "text-gray-400 hover:bg-emerald-50 hover:text-emerald-600"}`}
                            title={c.actif ? "Désactiver" : "Réactiver"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Création */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeCreate} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{result ? "Aéroclub créé" : "Nouvel aéroclub"}</h3>
              <button onClick={closeCreate} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-700"><strong>{result.nom}</strong> est prêt.{!result.inviteLink && " L'invitation a été envoyée à l'administrateur."}</p>
                </div>

                <div>
                  <label className="label">Site du club</label>
                  <div className="flex gap-2">
                    <input readOnly value={result.siteUrl} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
                    <button onClick={() => copy(result.siteUrl, "site")} className="btn-secondary btn-sm shrink-0">
                      {copied === "site" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />} Copier
                    </button>
                    <a href={result.siteUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm shrink-0" title="Ouvrir">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {result.inviteLink && (
                  <div>
                    <label className="label">Lien d&apos;activation de l&apos;administrateur</label>
                    <div className="flex gap-2">
                      <input readOnly value={result.inviteLink} className="input font-mono text-xs" onFocus={(e) => e.target.select()} />
                      <button onClick={() => copy(result.inviteLink!, "invite")} className="btn-primary btn-sm shrink-0">
                        {copied === "invite" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copier
                      </button>
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 mt-2">
                      {result.warning ?? "Aucun email n'a été envoyé (Resend non configuré)."} Transmettez ce lien à l&apos;administrateur : il est valable 24 heures.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button onClick={openCreate} className="btn-secondary btn-sm"><Plus className="w-3.5 h-3.5" /> Créer un autre club</button>
                  <button onClick={closeCreate} className="btn-primary btn-sm">Terminer</button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="label">Nom de l&apos;aéroclub *</label>
                    <input
                      value={form.nom}
                      onChange={(e) => {
                        const nom = e.target.value;
                        setForm((f) => ({ ...f, nom, slug: slugTouched ? f.slug : slugify(nom) }));
                      }}
                      className="input"
                      placeholder="Aéro-Club de ..."
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="label">Adresse du site *</label>
                      <div className="flex items-center rounded-lg border border-gray-200 bg-white focus-within:border-brand-400 focus-within:shadow-[0_0_0_3px_rgba(43,94,143,0.12)] transition-colors">
                        <input
                          value={form.slug}
                          onChange={(e) => {
                            setSlugTouched(true);
                            setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 42) }));
                          }}
                          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm font-mono outline-none"
                          placeholder="mon-club"
                        />
                        {ROOT_DOMAIN && <span className="pr-3 text-xs text-gray-400 font-mono whitespace-nowrap">.{ROOT_DOMAIN}</span>}
                      </div>
                    </div>
                    <div>
                      <label className="label">Sigle</label>
                      <input value={form.sigle} onChange={(e) => setForm({ ...form, sigle: e.target.value })} className="input" placeholder="ACXX" />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Administrateur du club</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="label">Prénom</label><input value={form.adminPrenom} onChange={(e) => setForm({ ...form, adminPrenom: e.target.value })} className="input" placeholder="Jean" /></div>
                      <div><label className="label">Nom</label><input value={form.adminNom} onChange={(e) => setForm({ ...form, adminNom: e.target.value })} className="input" placeholder="Dupont" /></div>
                    </div>
                    <div className="mt-3">
                      <label className="label">Email *</label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} className="input pl-8" placeholder="president@aeroclub.fr" />
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">Il recevra un email pour activer son accès.</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Année scolaire</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div><label className="label">Libellé *</label><input value={form.anneeLabel} onChange={(e) => setForm({ ...form, anneeLabel: e.target.value })} className="input" /></div>
                      <div><label className="label">Début *</label><input type="date" value={form.anneeDebut} onChange={(e) => setForm({ ...form, anneeDebut: e.target.value })} className="input" /></div>
                      <div><label className="label">Fin *</label><input type="date" value={form.anneeFin} onChange={(e) => setForm({ ...form, anneeFin: e.target.value })} className="input" /></div>
                    </div>
                    <div className="mt-3">
                      <label className="label">Date d&apos;examen BIA <span className="normal-case font-normal text-gray-400">(facultatif)</span></label>
                      <input type="date" value={form.dateExamenBia} onChange={(e) => setForm({ ...form, dateExamenBia: e.target.value })} className="input" />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    Les tarifs (inscription, subvention fédération, durée cible des vols) et le modèle d&apos;attestation sont repris de votre club actuel. L&apos;administrateur pourra les modifier dans Paramètres.
                  </p>
                </div>
                <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
                  <button onClick={closeCreate} disabled={creating} className="btn-secondary btn-sm">Annuler</button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !form.nom.trim() || !form.slug.trim() || !form.adminEmail.trim()}
                    className="btn-primary btn-sm"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Créer l&apos;aéroclub
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Renommer */}
      {renaming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setRenaming(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Renommer l&apos;aéroclub</h3>
              <button onClick={() => setRenaming(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <label className="label">Nom</label>
            <input
              value={newNom}
              onChange={(e) => setNewNom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
              className="input"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-2">L&apos;adresse du site ({siteLabel(renaming.slug)}) ne change pas.</p>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setRenaming(null)} disabled={saving} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleRename} disabled={saving || !newNom.trim() || newNom.trim() === renaming.nom} className="btn-primary btn-sm">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Désactiver / réactiver */}
      {toggling && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setToggling(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-2">
              {toggling.actif ? `Désactiver ${toggling.nom} ?` : `Réactiver ${toggling.nom} ?`}
            </h3>
            {toggling.actif ? (
              <p className="text-sm text-gray-500 mb-5">
                Les {toggling.counts.users} membre{toggling.counts.users > 1 ? "s" : ""} de ce club (administrateurs, pilotes, coordinateurs, parents) perdront immédiatement l&apos;accès à BIA Manager. Aucune donnée n&apos;est supprimée : vous pourrez réactiver le club à tout moment.
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-5">
                Les membres de ce club retrouveront leur accès à BIA Manager avec toutes leurs données.
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setToggling(null)} disabled={saving} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleToggle} disabled={saving} className={toggling.actif ? "btn-danger btn-sm" : "btn-primary btn-sm"}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {toggling.actif ? "Désactiver" : "Réactiver"}
              </button>
            </div>
          </div>
        </div>
      )}
      {modulesFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !saving && setModulesFor(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div onClick={(e) => e.stopPropagation()} className="relative bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-gray-900">Modules — {modulesFor.nom}</h3>
              <button onClick={() => setModulesFor(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Un module désactivé est invisible pour ce club : ni onglet dans le menu, ni accès par son adresse.
              Élèves, planning, établissements, pilotes, aéronefs, utilisateurs et paramètres restent toujours actifs.
            </p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{modulesDraft.length} / {MODULES.length} activés</span>
              <div className="flex gap-3 text-xs font-semibold">
                <button type="button" onClick={() => setModulesDraft(MODULES.filter((m) => m.categorie !== "Essais").map((m) => m.key))} className="text-brand-500 hover:text-brand-700">Tout activer</button>
                <button type="button" onClick={() => setModulesDraft([])} className="text-gray-400 hover:text-gray-600">Tout désactiver</button>
              </div>
            </div>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {MODULE_CATEGORIES.map((cat) => (
              <div key={cat}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">{cat}</p>
              <div className="space-y-2">
              {MODULES.filter((m) => m.categorie === cat).map((m) => {
                const on = modulesDraft.includes(m.key);
                return (
                  <label key={m.key} className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={on}
                      onChange={() => setModulesDraft(on ? modulesDraft.filter((k) => k !== m.key) : [...modulesDraft, m.key])}
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">{m.label}</span>
                      <span className="block text-xs text-gray-500 mt-0.5">{m.description}</span>
                    </span>
                  </label>
                );
              })}
              </div>
              </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
              <button onClick={() => setModulesFor(null)} className="btn-secondary btn-sm">Annuler</button>
              <button onClick={handleSaveModules} disabled={saving} className="btn-primary btn-sm">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
