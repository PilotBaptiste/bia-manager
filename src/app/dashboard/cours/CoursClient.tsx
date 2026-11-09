"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  GraduationCap, Plus, Loader2, X, Upload, Link2, FileText, Download, Trash2, Edit, Eye, EyeOff, Check, Save,
} from "lucide-react";
import { MATIERES, EXTENSIONS, TAILLE_MAX, TAILLE_MAX_MO, tailleLisible, nomFichierSur } from "@/lib/cours";

const supabase = createClient();

/** Nom de domaine d'un lien, ou le lien brut s'il n'est pas interprétable. */
function hoteLisible(url: string | null | undefined): string {
  try {
    return new URL(String(url)).hostname.replace(/^www\./, "");
  } catch {
    return String(url ?? "");
  }
}

const emptyForm = {
  titre: "",
  description: "",
  matiere: "Général",
  type: "fichier" as "fichier" | "lien",
  url: "",
  ordre: "0",
  publie: true,
  fichier_path: "",
  fichier_nom: "",
  fichier_taille: 0,
};

export default function CoursClient({ peutGerer }: { peutGerer: boolean }) {
  const [cours, setCours] = useState<any[]>([]);
  const [vus, setVus] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [filtreMatiere, setFiltreMatiere] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const [{ data: coursData, error }, { data: vusData }] = await Promise.all([
      supabase.from("cours").select("*").order("matiere").order("ordre").order("created_at"),
      user ? supabase.from("cours_vus").select("cours_id").eq("profile_id", user.id) : Promise.resolve({ data: [] as any[] }),
    ]);
    if (error) toast.error(`Chargement impossible : ${error.message}`);
    setCours(coursData ?? []);
    setVus(new Set((vusData ?? []).map((v: any) => v.cours_id)));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const parMatiere = useMemo(() => {
    const visibles = cours.filter((c) => (peutGerer || c.publie) && (!filtreMatiere || c.matiere === filtreMatiere));
    const groupes = new Map<string, any[]>();
    for (const c of visibles) {
      if (!groupes.has(c.matiere)) groupes.set(c.matiere, []);
      groupes.get(c.matiere)!.push(c);
    }
    // Ordre des matières du BIA, les matières inconnues à la fin
    return Array.from(groupes.entries()).sort((a, b) => {
      const ia = MATIERES.indexOf(a[0] as any);
      const ib = MATIERES.indexOf(b[0] as any);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [cours, peutGerer, filtreMatiere]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: any) {
    setEditingId(c.id);
    setForm({
      titre: c.titre,
      description: c.description ?? "",
      matiere: c.matiere,
      type: c.type,
      url: c.url ?? "",
      ordre: String(c.ordre ?? 0),
      publie: c.publie,
      fichier_path: c.fichier_path ?? "",
      fichier_nom: c.fichier_nom ?? "",
      fichier_taille: c.fichier_taille ?? 0,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleUpload(file: File) {
    if (file.size > TAILLE_MAX) {
      setFormError(`Fichier trop volumineux (${TAILLE_MAX_MO} Mo maximum).`);
      return;
    }
    const ext = `.${(file.name.split(".").pop() ?? "").toLowerCase()}`;
    if (!EXTENSIONS.includes(ext)) {
      setFormError(`Format non accepté. Formats possibles : ${EXTENSIONS.join(", ")}.`);
      return;
    }
    setUploading(true);
    setFormError(null);
    // Le club est préfixé dans le chemin : les fichiers de deux aéroclubs ne se mélangent jamais
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = user
      ? await supabase.from("profiles").select("organisation_id").eq("id", user.id).maybeSingle()
      : { data: null };
    if (!prof?.organisation_id) {
      setUploading(false);
      setFormError("Votre compte n'est pas rattaché à un aéroclub : envoi impossible.");
      return;
    }
    const chemin = `${prof.organisation_id}/${Date.now()}-${nomFichierSur(file.name)}`;
    const { error } = await supabase.storage.from("cours").upload(chemin, file, { upsert: false });
    setUploading(false);
    if (error) {
      setFormError(`Envoi impossible : ${error.message}`);
      return;
    }
    setForm((f) => ({
      ...f,
      fichier_path: chemin,
      fichier_nom: file.name,
      fichier_taille: file.size,
      titre: f.titre || file.name.replace(/\.[^.]+$/, ""),
    }));
    toast.success("Fichier envoyé");
  }

  async function handleSave() {
    setFormError(null);
    if (!form.titre.trim()) { setFormError("Le titre est obligatoire."); return; }
    if (form.type === "fichier" && !form.fichier_path) { setFormError("Choisissez un fichier à envoyer."); return; }
    if (form.type === "lien") {
      const u = form.url.trim();
      if (!/^https?:\/\/.+/i.test(u)) { setFormError("L'adresse doit commencer par http:// ou https://"); return; }
    }

    setSaving(true);
    const payload: any = {
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      matiere: form.matiere,
      type: form.type,
      ordre: parseInt(form.ordre) || 0,
      publie: form.publie,
      fichier_path: form.type === "fichier" ? form.fichier_path : null,
      fichier_nom: form.type === "fichier" ? form.fichier_nom : null,
      fichier_taille: form.type === "fichier" ? form.fichier_taille || null : null,
      url: form.type === "lien" ? form.url.trim() : null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("cours").update(payload).eq("id", editingId));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await supabase.from("cours").insert({ ...payload, cree_par: user?.id ?? null }));
    }
    setSaving(false);
    if (error) { setFormError(`Enregistrement impossible : ${error.message}`); return; }
    toast.success(editingId ? "Cours modifié" : "Cours ajouté");
    setShowForm(false);
    load();
  }

  async function handleDelete(c: any) {
    const { error } = await supabase.from("cours").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    // Le fichier n'a plus de raison d'être conservé
    if (c.type === "fichier" && c.fichier_path) {
      await supabase.storage.from("cours").remove([c.fichier_path]);
    }
    toast.success("Cours supprimé");
    setConfirmDelete(null);
    load();
  }

  async function togglePublie(c: any) {
    const { error } = await supabase.from("cours").update({ publie: !c.publie }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    setCours((prev) => prev.map((x) => (x.id === c.id ? { ...x, publie: !c.publie } : x)));
  }

  async function ouvrirLien(c: any) {
    window.open(c.url, "_blank", "noopener,noreferrer");
    setVus((prev) => new Set(prev).add(c.id));
    fetch("/api/cours/vu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id }),
    }).catch(() => {});
  }

  function telecharger(c: any) {
    setVus((prev) => new Set(prev).add(c.id));
    window.location.href = `/api/cours/download?id=${encodeURIComponent(c.id)}`;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  }

  const total = cours.filter((c) => peutGerer || c.publie).length;

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cours</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {peutGerer
              ? "Documents et liens mis à disposition des élèves et des familles"
              : "Les documents de cours partagés par votre aéroclub"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {MATIERES.some((m) => cours.some((c) => c.matiere === m)) && (
            <select value={filtreMatiere} onChange={(e) => setFiltreMatiere(e.target.value)} className="select text-sm">
              <option value="">Toutes les matières</option>
              {MATIERES.filter((m) => cours.some((c) => c.matiere === m)).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          {peutGerer && (
            <button onClick={openNew} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Ajouter un cours
            </button>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Aucun cours pour l&apos;instant</p>
          <p className="text-sm text-gray-500 mt-1">
            {peutGerer
              ? "Ajoutez un document PDF, une présentation ou un lien vers une ressource en ligne."
              : "Votre aéroclub n'a pas encore partagé de document."}
          </p>
          {peutGerer && (
            <button onClick={openNew} className="btn-primary btn-sm mt-4 mx-auto">
              <Plus className="w-4 h-4" /> Ajouter un cours
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {parMatiere.map(([matiere, liste]) => (
            <div key={matiere}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                {matiere} <span className="text-gray-300">· {liste.length}</span>
              </h2>
              <div className="space-y-2">
                {liste.map((c) => (
                  <div
                    key={c.id}
                    className={`card flex items-start gap-3 ${!c.publie ? "bg-gray-50 border-dashed" : ""}`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${c.type === "lien" ? "bg-violet-50 text-violet-500" : "bg-brand-50 text-brand-500"}`}>
                      {c.type === "lien" ? <Link2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.titre}</p>
                        {vus.has(c.id) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Consulté
                          </span>
                        )}
                        {!c.publie && (
                          <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">Brouillon</span>
                        )}
                      </div>
                      {c.description && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{c.description}</p>}
                      <p className="text-[11px] text-gray-400 mt-1">
                        {c.type === "lien"
                          ? hoteLisible(c.url)
                          : [c.fichier_nom, tailleLisible(c.fichier_taille)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.type === "lien" ? (
                        <button onClick={() => ouvrirLien(c)} className="btn-secondary btn-sm" title="Ouvrir le lien">
                          <Link2 className="w-3.5 h-3.5" /> Ouvrir
                        </button>
                      ) : (
                        <button onClick={() => telecharger(c)} className="btn-secondary btn-sm" title="Télécharger">
                          <Download className="w-3.5 h-3.5" /> Ouvrir
                        </button>
                      )}
                      {peutGerer && (
                        <>
                          <button onClick={() => togglePublie(c)} className="btn-secondary btn-sm" title={c.publie ? "Masquer aux familles" : "Publier"}>
                            {c.publie ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => openEdit(c)} className="btn-secondary btn-sm" title="Modifier">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setConfirmDelete(c)} className="btn-danger btn-sm" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Formulaire ── */}
      {showForm && peutGerer && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg my-8 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">{editingId ? "Modifier le cours" : "Ajouter un cours"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{formError}</div>
            )}

            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-0.5 w-fit">
              {([
                { key: "fichier", label: "Document", icon: FileText },
                { key: "lien", label: "Lien", icon: Link2 },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, type: key })}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${form.type === key ? "bg-white text-brand-500 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {form.type === "fichier" ? (
              <div className="mb-3">
                <label className="label">Fichier *</label>
                <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-lg p-5 cursor-pointer hover:border-brand-300 text-sm text-gray-500">
                  {uploading ? (
                    <><Loader2 className="w-5 h-5 animate-spin text-brand-400" /> Envoi en cours…</>
                  ) : form.fichier_path ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-500" />
                      <span className="font-medium text-gray-700">{form.fichier_nom}</span>
                      <span className="text-xs text-gray-400">{tailleLisible(form.fichier_taille)} — cliquer pour remplacer</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      <span>Cliquer pour choisir un fichier</span>
                      <span className="text-xs text-gray-400">PDF, Word, PowerPoint, image, vidéo — {TAILLE_MAX_MO} Mo max</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept={EXTENSIONS.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="mb-3">
                <label className="label">Adresse du lien *</label>
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="input"
                  placeholder="https://…"
                />
                <p className="text-[11px] text-gray-400 mt-1">Vidéo, site de révision, dossier partagé…</p>
              </div>
            )}

            <div className="mb-3">
              <label className="label">Titre *</label>
              <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="input" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div className="sm:col-span-2">
                <label className="label">Matière</label>
                <select value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} className="select">
                  {MATIERES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Ordre</label>
                <input type="number" value={form.ordre} onChange={(e) => setForm({ ...form, ordre: e.target.value })} className="input" />
              </div>
            </div>

            <div className="mb-3">
              <label className="label">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input min-h-[70px]"
                placeholder="À quoi sert ce document, à quel moment le travailler…"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" checked={form.publie} onChange={(e) => setForm({ ...form, publie: e.target.checked })} />
              <span className="text-sm text-gray-700">Visible par les élèves et les familles</span>
            </label>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button onClick={handleSave} disabled={saving || uploading} className="btn-primary">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation de suppression ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="font-bold text-gray-900 mb-1">Supprimer ce cours ?</h2>
            <p className="text-sm text-gray-500 mb-4">
              « {confirmDelete.titre} » sera définitivement supprimé
              {confirmDelete.type === "fichier" ? ", ainsi que son fichier." : "."}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
