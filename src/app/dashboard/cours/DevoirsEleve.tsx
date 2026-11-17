"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, ClipboardList, Upload, Download, Award, Trash2 } from "lucide-react";
import { TAILLE_MAX, TAILLE_MAX_MO } from "@/lib/cours";

const supabase = createClient();

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Les devoirs attribués aux enfants du compte : déposer un fichier, lire la note. */
export default function DevoirsEleve({ enfants }: { enfants: any[] }) {
  const [enfantId, setEnfantId] = useState<string>(enfants[0]?.id ?? "");
  const [copies, setCopies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [occupe, setOccupe] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enfantId) { setCopies([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("devoir_copies")
      .select("id, devoir_id, fichier_path, fichier_nom, fichier_taille, rendu_le, note, commentaire, corrige_le, resultat_visible, devoir:devoirs(id, titre, consigne, matiere, date_limite, note_sur, publie)")
      .eq("eleve_id", enfantId);
    setLoading(false);
    if (error) { toast.error(`Chargement impossible : ${error.message}`); return; }
    setCopies((data ?? []).filter((c: any) => c.devoir?.publie));
  }, [enfantId]);

  useEffect(() => { load(); }, [load]);

  async function deposer(copie: any, fichier: File) {
    if (fichier.size > TAILLE_MAX) {
      toast.error(`Fichier trop lourd (maximum ${TAILLE_MAX_MO} Mo)`);
      return;
    }
    setOccupe(copie.id);
    // Le chemin commence par l'identifiant de l'élève : c'est ce que la règle de
    // sécurité du stockage vérifie pour n'ouvrir que les dossiers de ses enfants.
    const extension = fichier.name.includes(".") ? fichier.name.split(".").pop() : "";
    const chemin = `${enfantId}/${copie.devoir_id}-${Date.now()}${extension ? `.${extension}` : ""}`;
    const { error: upErr } = await supabase.storage.from("devoirs").upload(chemin, fichier, { upsert: false });
    if (upErr) { setOccupe(null); toast.error(`Envoi impossible : ${upErr.message}`); return; }

    const ancien = copie.fichier_path;
    const { error } = await supabase
      .from("devoir_copies")
      .update({
        fichier_path: chemin,
        fichier_nom: fichier.name,
        fichier_taille: fichier.size,
        rendu_le: new Date().toISOString(),
      })
      .eq("id", copie.id);
    if (error) {
      await supabase.storage.from("devoirs").remove([chemin]);
      setOccupe(null);
      toast.error(error.message);
      return;
    }
    // Le remplacement ne laisse pas traîner l'ancienne version.
    if (ancien) await supabase.storage.from("devoirs").remove([ancien]);
    setOccupe(null);
    toast.success("Devoir déposé");
    load();
  }

  async function retirer(copie: any) {
    setOccupe(copie.id);
    const { error } = await supabase
      .from("devoir_copies")
      .update({ fichier_path: null, fichier_nom: null, fichier_taille: null, rendu_le: null })
      .eq("id", copie.id);
    if (!error && copie.fichier_path) await supabase.storage.from("devoirs").remove([copie.fichier_path]);
    setOccupe(null);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function telecharger(copie: any) {
    if (!copie.fichier_path) return;
    setOccupe(copie.id);
    const { data, error } = await supabase.storage.from("devoirs").download(copie.fichier_path);
    setOccupe(null);
    if (error || !data) { toast.error(error?.message ?? "Téléchargement impossible"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = copie.fichier_nom || "devoir";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (enfants.length === 0) {
    return <div className="card py-10 text-center text-sm text-gray-400">Aucun élève rattaché à votre compte.</div>;
  }

  return (
    <div>
      {enfants.length > 1 && (
        <div className="flex gap-1.5 flex-wrap mb-4">
          {enfants.map((e) => (
            <button
              key={e.id}
              onClick={() => setEnfantId(e.id)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${e.id === enfantId ? "border-brand-400 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {e.prenom} {e.nom}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>
      ) : copies.length === 0 ? (
        <div className="card py-12 text-center">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucun devoir pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {copies.map((c) => {
            const enRetard = c.devoir?.date_limite && !c.rendu_le && c.devoir.date_limite < new Date().toISOString().slice(0, 10);
            const corrige = c.resultat_visible && c.corrige_le;
            return (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{c.devoir?.titre}</p>
                    <p className="text-xs text-gray-500">
                      {c.devoir?.matiere} · noté sur {c.devoir?.note_sur}
                      {c.devoir?.date_limite ? ` · à rendre le ${fmtDate(c.devoir.date_limite)}` : ""}
                    </p>
                  </div>
                  {corrige && (
                    <span className="flex items-center gap-1.5 font-bold text-emerald-600 shrink-0">
                      <Award className="w-4 h-4" /> {c.note} / {c.devoir?.note_sur}
                    </span>
                  )}
                </div>

                {c.devoir?.consigne && (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{c.devoir.consigne}</p>
                )}

                {corrige && c.commentaire && (
                  <p className="text-sm text-brand-700 bg-brand-50 rounded-lg px-3 py-2 mt-2">« {c.commentaire} »</p>
                )}

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {c.rendu_le ? (
                    <>
                      <span className="text-xs text-emerald-600 font-semibold">
                        Rendu le {fmtDate(c.rendu_le)}
                      </span>
                      <button onClick={() => telecharger(c)} disabled={occupe === c.id} className="btn-secondary btn-sm">
                        <Download className="w-3.5 h-3.5" /> {c.fichier_nom}
                      </button>
                      {!c.corrige_le && (
                        <button onClick={() => retirer(c)} disabled={occupe === c.id} className="btn-secondary btn-sm text-red-500 border-red-200 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" /> Retirer
                        </button>
                      )}
                    </>
                  ) : (
                    <span className={`text-xs font-semibold ${enRetard ? "text-red-600" : "text-amber-600"}`}>
                      {enRetard ? "En retard" : "Pas encore rendu"}
                    </span>
                  )}

                  {!c.corrige_le && (
                    <label className="btn-primary btn-sm cursor-pointer">
                      {occupe === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      {c.rendu_le ? "Remplacer" : "Déposer mon devoir"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={occupe === c.id}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) deposer(c, f);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
