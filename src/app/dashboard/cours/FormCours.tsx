"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  X, Loader2, Save, Upload, Link2, FileText, Trash2, Check, Plus, ArrowUp, ArrowDown,
} from "lucide-react";
import { MATIERES, EXTENSIONS, TAILLE_MAX, TAILLE_MAX_MO, tailleLisible, nomFichierSur, formatLisible } from "@/lib/cours";

const supabase = createClient();

const vide = { titre: "", description: "", matiere: "Général", ordre: "0", publie: true };

/**
 * Création et modification d'un cours. Un cours réunit plusieurs documents et liens,
 * ajoutés un par un une fois le cours créé.
 */
export default function FormCours({
  cours,
  onFermer,
  onChangement,
}: {
  cours: any | null;
  onFermer: () => void;
  onChangement: () => void;
}) {
  const [id, setId] = useState<string | null>(cours?.id ?? null);
  const [form, setForm] = useState(
    cours
      ? {
          titre: cours.titre,
          description: cours.description ?? "",
          matiere: cours.matiere,
          ordre: String(cours.ordre ?? 0),
          publie: cours.publie,
        }
      : vide,
  );
  const [ressources, setRessources] = useState<any[]>(cours?.ressources ?? []);
  const [erreur, setErreur] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nouveauLien, setNouveauLien] = useState({ titre: "", url: "" });
  const [ajoutLien, setAjoutLien] = useState(false);

  async function enregistrerCours() {
    setErreur(null);
    if (!form.titre.trim()) {
      setErreur("Le titre est obligatoire.");
      return null;
    }
    setSaving(true);
    const payload = {
      titre: form.titre.trim(),
      description: form.description.trim() || null,
      matiere: form.matiere,
      ordre: parseInt(form.ordre) || 0,
      publie: form.publie,
      type: "fichier",
      updated_at: new Date().toISOString(),
    };

    let coursId = id;
    if (coursId) {
      const { error } = await supabase.from("cours").update(payload).eq("id", coursId);
      if (error) { setSaving(false); setErreur(`Enregistrement impossible : ${error.message}`); return null; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("cours")
        .insert({ ...payload, cree_par: user?.id ?? null })
        .select("id")
        .single();
      if (error || !data) { setSaving(false); setErreur(`Création impossible : ${error?.message}`); return null; }
      coursId = data.id;
      setId(coursId);
    }
    setSaving(false);
    onChangement();
    return coursId;
  }

  /** Le cours doit exister avant de recevoir des documents. */
  async function assurerCours() {
    return id ?? (await enregistrerCours());
  }

  async function ajouterFichier(file: File) {
    setErreur(null);
    if (file.size > TAILLE_MAX) {
      setErreur(`Fichier trop volumineux (${TAILLE_MAX_MO} Mo maximum).`);
      return;
    }
    const ext = `.${(file.name.split(".").pop() ?? "").toLowerCase()}`;
    if (!EXTENSIONS.includes(ext)) {
      setErreur(`Format non accepté. Formats possibles : ${EXTENSIONS.join(", ")}.`);
      return;
    }
    const coursId = await assurerCours();
    if (!coursId) return;

    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = user
      ? await supabase.from("profiles").select("organisation_id").eq("id", user.id).maybeSingle()
      : { data: null };
    if (!prof?.organisation_id) {
      setUploading(false);
      setErreur("Votre compte n'est pas rattaché à un aéroclub : envoi impossible.");
      return;
    }
    // Les fichiers sont rangés dans un dossier par club : la politique de stockage le vérifie
    const chemin = `${prof.organisation_id}/${Date.now()}-${nomFichierSur(file.name)}`;
    const { error: upErr } = await supabase.storage.from("cours").upload(chemin, file, { upsert: false });
    if (upErr) {
      setUploading(false);
      setErreur(`Envoi impossible : ${upErr.message}`);
      return;
    }
    const { data, error } = await supabase
      .from("cours_ressources")
      .insert({
        cours_id: coursId,
        titre: file.name.replace(/\.[^.]+$/, ""),
        type: "fichier",
        fichier_path: chemin,
        fichier_nom: file.name,
        fichier_taille: file.size,
        ordre: ressources.length,
      })
      .select("*")
      .single();
    setUploading(false);
    if (error || !data) {
      setErreur(`Ajout impossible : ${error?.message}`);
      return;
    }
    setRessources((prev) => [...prev, data]);
    onChangement();
    toast.success("Document ajouté");
  }

  async function ajouterLien() {
    setErreur(null);
    const url = nouveauLien.url.trim();
    if (!/^https?:\/\/.+/i.test(url)) {
      setErreur("L'adresse doit commencer par http:// ou https://");
      return;
    }
    const coursId = await assurerCours();
    if (!coursId) return;

    const { data, error } = await supabase
      .from("cours_ressources")
      .insert({
        cours_id: coursId,
        titre: nouveauLien.titre.trim() || url,
        type: "lien",
        url,
        ordre: ressources.length,
      })
      .select("*")
      .single();
    if (error || !data) {
      setErreur(`Ajout impossible : ${error?.message}`);
      return;
    }
    setRessources((prev) => [...prev, data]);
    setNouveauLien({ titre: "", url: "" });
    setAjoutLien(false);
    onChangement();
    toast.success("Lien ajouté");
  }

  async function renommer(r: any, titre: string) {
    setRessources((prev) => prev.map((x) => (x.id === r.id ? { ...x, titre } : x)));
    await supabase.from("cours_ressources").update({ titre }).eq("id", r.id);
    onChangement();
  }

  async function supprimer(r: any) {
    const { error } = await supabase.from("cours_ressources").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    if (r.type === "fichier" && r.fichier_path) {
      await supabase.storage.from("cours").remove([r.fichier_path]);
    }
    setRessources((prev) => prev.filter((x) => x.id !== r.id));
    onChangement();
  }

  async function deplacer(index: number, sens: -1 | 1) {
    const cible = index + sens;
    if (cible < 0 || cible >= ressources.length) return;
    const liste = [...ressources];
    [liste[index], liste[cible]] = [liste[cible], liste[index]];
    setRessources(liste);
    await Promise.all(
      liste.map((r, i) => supabase.from("cours_ressources").update({ ordre: i }).eq("id", r.id)),
    );
    onChangement();
  }

  async function terminer() {
    const coursId = await enregistrerCours();
    if (coursId) {
      toast.success(cours ? "Cours modifié" : "Cours créé");
      onFermer();
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-lg my-8 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900">{cours ? "Modifier le cours" : "Nouveau cours"}</h2>
          <button onClick={onFermer} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {erreur && <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{erreur}</div>}

        <div className="mb-3">
          <label className="label">Titre du cours *</label>
          <input value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} className="input"
            placeholder="Ex. : Météorologie — les nuages" />
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
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input min-h-[70px]" placeholder="À quoi sert ce cours, à quel moment le travailler…" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input type="checkbox" checked={form.publie} onChange={(e) => setForm({ ...form, publie: e.target.checked })} />
          <span className="text-sm text-gray-700">Visible par les élèves et les familles</span>
        </label>

        {/* ── Documents du cours ── */}
        <div className="rounded-lg border border-gray-200 p-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Documents du cours {ressources.length > 0 && <span className="text-gray-300">· {ressources.length}</span>}
            </p>
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Un cours peut réunir plusieurs PDF, présentations, images et liens. Les familles les ouvrent dans l&apos;ordre affiché.
          </p>

          {ressources.length > 0 && (
            <div className="space-y-2 mb-3">
              {ressources.map((r, i) => (
                <div key={r.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${r.type === "lien" ? "bg-violet-50 text-violet-500" : "bg-brand-50 text-brand-500"}`}>
                    {r.type === "lien" ? <Link2 className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      value={r.titre}
                      onChange={(e) => setRessources((prev) => prev.map((x) => (x.id === r.id ? { ...x, titre: e.target.value } : x)))}
                      onBlur={(e) => renommer(r, e.target.value.trim() || r.fichier_nom || "Document")}
                      className="w-full text-sm font-medium text-gray-900 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none"
                    />
                    <p className="text-[11px] text-gray-400 truncate">
                      {r.type === "lien" ? r.url : [formatLisible(r.fichier_nom), tailleLisible(r.fichier_taille)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center shrink-0">
                    <button onClick={() => deplacer(i, -1)} disabled={i === 0} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Monter">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deplacer(i, 1)} disabled={i === ressources.length - 1} className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-30" title="Descendre">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => supprimer(r)} className="p-1 text-gray-300 hover:text-red-500" title="Retirer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {ajoutLien ? (
            <div className="rounded-lg border border-gray-200 p-2.5 space-y-2">
              <input value={nouveauLien.titre} onChange={(e) => setNouveauLien({ ...nouveauLien, titre: e.target.value })}
                className="input text-sm" placeholder="Intitulé (facultatif)" />
              <input value={nouveauLien.url} onChange={(e) => setNouveauLien({ ...nouveauLien, url: e.target.value })}
                className="input text-sm" placeholder="https://…" />
              <div className="flex gap-2">
                <button onClick={ajouterLien} className="btn-primary btn-sm"><Check className="w-3.5 h-3.5" /> Ajouter</button>
                <button onClick={() => { setAjoutLien(false); setNouveauLien({ titre: "", url: "" }); }} className="btn-secondary btn-sm">Annuler</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <label className="btn-secondary btn-sm cursor-pointer">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Envoi…" : "Ajouter un fichier"}
                <input type="file" accept={EXTENSIONS.join(",")} className="hidden" disabled={uploading}
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) ajouterFichier(f); e.target.value = ""; }} />
              </label>
              <button onClick={() => setAjoutLien(true)} className="btn-secondary btn-sm">
                <Plus className="w-3.5 h-3.5" /> Ajouter un lien
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onFermer} className="btn-secondary">Fermer</button>
          <button onClick={terminer} disabled={saving || uploading} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
