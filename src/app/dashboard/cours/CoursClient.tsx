"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  GraduationCap, Plus, Loader2, Edit, Trash2, Eye, EyeOff, CheckCircle2, BarChart2, FileText, Link2, ChevronRight,
} from "lucide-react";
import { MATIERES } from "@/lib/cours";
import LecteurCours from "./LecteurCours";
import FormCours from "./FormCours";
import SuiviCours from "./SuiviCours";

const supabase = createClient();

const COURS_SELECT = "*, ressources:cours_ressources(id, titre, type, fichier_path, fichier_nom, fichier_taille, url, ordre)";

function ordonner(ressources: any[] | null | undefined) {
  return [...(ressources ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

export default function CoursClient({ peutGerer, estEquipe }: { peutGerer: boolean; estEquipe?: boolean }) {
  const [cours, setCours] = useState<any[]>([]);
  const [enfants, setEnfants] = useState<any[]>([]);
  const [vus, setVus] = useState<any[]>([]);
  const [vuesRessources, setVuesRessources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreMatiere, setFiltreMatiere] = useState("");

  // undefined = formulaire fermé · null = création · objet = modification
  const [formPour, setFormPour] = useState<any | null | undefined>(undefined);
  const [suiviPour, setSuiviPour] = useState<any | null>(null);
  const [lecture, setLecture] = useState<{ cours: any; eleve: any | null } | null>(null);
  const [confirmSuppression, setConfirmSuppression] = useState<any | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const [coursR, enfantsR, vusR, vrR] = await Promise.all([
      supabase.from("cours").select(COURS_SELECT).order("matiere").order("ordre").order("created_at"),
      user
        ? supabase
            .from("eleves")
            .select("id, prenom, nom, etablissement:etablissements(nom)")
            .or(`parent_id.eq.${user.id},parent2_id.eq.${user.id}`)
            .eq("archive", false)
            .order("prenom")
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("cours_vus").select("cours_id, eleve_id, vu_at, termine_at"),
      supabase.from("cours_ressources_vues").select("ressource_id, eleve_id"),
    ]);
    if (coursR.error) toast.error(`Chargement impossible : ${coursR.error.message}`);
    setCours((coursR.data ?? []).map((c: any) => ({ ...c, ressources: ordonner(c.ressources) })));
    setEnfants(enfantsR.data ?? []);
    setVus(vusR.data ?? []);
    setVuesRessources(vrR.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibles = useMemo(
    () => cours.filter((c) => (peutGerer || c.publie) && (!filtreMatiere || c.matiere === filtreMatiere)),
    [cours, peutGerer, filtreMatiere],
  );

  // Regroupement par matière, dans l'ordre du programme du BIA
  const parMatiere = useCallback((liste: any[]) => {
    const groupes = new Map<string, any[]>();
    for (const c of liste) {
      if (!groupes.has(c.matiere)) groupes.set(c.matiere, []);
      groupes.get(c.matiere)!.push(c);
    }
    return Array.from(groupes.entries()).sort((a, b) => {
      const ia = MATIERES.indexOf(a[0] as any);
      const ib = MATIERES.indexOf(b[0] as any);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, []);

  /** Progression d'un élève : documents ouverts et cours terminés. */
  const progression = useCallback(
    (eleveId: string) => ({
      ressourcesVues: new Set(vuesRessources.filter((v) => v.eleve_id === eleveId).map((v) => v.ressource_id)),
      termines: new Set(vus.filter((v) => v.eleve_id === eleveId && v.termine_at).map((v) => v.cours_id)),
    }),
    [vus, vuesRessources],
  );

  async function basculerPublie(c: any) {
    const { error } = await supabase.from("cours").update({ publie: !c.publie }).eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    setCours((prev) => prev.map((x) => (x.id === c.id ? { ...x, publie: !c.publie } : x)));
  }

  async function supprimer(c: any) {
    const { error } = await supabase.from("cours").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    const chemins = (c.ressources ?? []).filter((r: any) => r.fichier_path).map((r: any) => r.fichier_path);
    if (chemins.length > 0) await supabase.storage.from("cours").remove(chemins);
    toast.success("Cours supprimé");
    setConfirmSuppression(null);
    load();
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cours</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {peutGerer
              ? "Documents mis à disposition des familles, et suivi de lecture par élève"
              : "Les cours partagés par votre aéroclub"}
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
            <button onClick={() => setFormPour(null)} className="btn-primary btn-sm">
              <Plus className="w-4 h-4" /> Nouveau cours
            </button>
          )}
        </div>
      </div>

      {visibles.length === 0 ? (
        <div className="card text-center py-12">
          <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700">Aucun cours pour l&apos;instant</p>
          <p className="text-sm text-gray-500 mt-1">
            {peutGerer
              ? "Créez un cours, puis ajoutez-lui autant de documents et de liens que nécessaire."
              : "Votre aéroclub n'a pas encore partagé de cours."}
          </p>
          {peutGerer && (
            <button onClick={() => setFormPour(null)} className="btn-primary btn-sm mt-4 mx-auto">
              <Plus className="w-4 h-4" /> Nouveau cours
            </button>
          )}
        </div>
      ) : peutGerer ? (
        /* ── Vue de l'équipe du club ── */
        <div className="space-y-5">
          {parMatiere(visibles).map(([matiere, liste]) => (
            <div key={matiere}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                {matiere} <span className="text-gray-300">· {liste.length}</span>
              </h2>
              <div className="space-y-2">
                {liste.map((c) => {
                  const nbFichiers = c.ressources.filter((r: any) => r.type === "fichier").length;
                  const nbLiens = c.ressources.filter((r: any) => r.type === "lien").length;
                  return (
                    <div key={c.id} className={`card flex items-start gap-3 ${!c.publie ? "bg-gray-50 border-dashed" : ""}`}>
                      <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.titre}</p>
                          {!c.publie && (
                            <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">Brouillon</span>
                          )}
                        </div>
                        {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>}
                        <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-1">
                          {c.ressources.length === 0 ? (
                            <span className="text-amber-600">Aucun document — les familles ne verront rien</span>
                          ) : (
                            <>
                              <span>{c.ressources.length} document{c.ressources.length > 1 ? "s" : ""}</span>
                              {nbFichiers > 0 && (
                                <span className="inline-flex items-center gap-0.5"><FileText className="w-3 h-3" />{nbFichiers}</span>
                              )}
                              {nbLiens > 0 && (
                                <span className="inline-flex items-center gap-0.5"><Link2 className="w-3 h-3" />{nbLiens}</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setSuiviPour(c)} className="btn-secondary btn-sm" title="Qui a ouvert ce cours">
                          <BarChart2 className="w-3.5 h-3.5" /> Suivi
                        </button>
                        <button onClick={() => setLecture({ cours: c, eleve: null })} className="btn-secondary btn-sm" title="Aperçu tel que le voient les familles">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => basculerPublie(c)} className="btn-secondary btn-sm" title={c.publie ? "Masquer aux familles" : "Publier"}>
                          {c.publie ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setFormPour(c)} className="btn-secondary btn-sm" title="Modifier">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmSuppression(c)} className="btn-danger btn-sm" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : enfants.length === 0 ? (
        estEquipe ? (
          /* ── Pilote ou gérant : consultation, sans progression ── */
          <div className="space-y-5">
            {parMatiere(visibles).map(([matiere, liste]) => (
              <div key={matiere}>
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                  {matiere} <span className="text-gray-300">· {liste.length}</span>
                </h2>
                <div className="space-y-2">
                  {liste.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setLecture({ cours: c, eleve: null })}
                      className="card w-full text-left flex items-center gap-3 hover:border-brand-200 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.titre}</p>
                        {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>}
                        <p className="text-[11px] text-gray-400 mt-1">
                          {c.ressources.length === 0
                            ? "Aucun document"
                            : `${c.ressources.length} document${c.ressources.length > 1 ? "s" : ""}`}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <GraduationCap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">Aucun élève rattaché à votre compte</p>
            <p className="text-sm text-gray-500 mt-1">Contactez votre aéroclub pour rattacher votre enfant à votre espace.</p>
          </div>
        )
      ) : (
        /* ── Vue des familles : une partie par enfant ── */
        <div className="space-y-8">
          {enfants.map((enfant) => {
            const { ressourcesVues, termines } = progression(enfant.id);
            const nbTermines = visibles.filter((c) => termines.has(c.id)).length;
            return (
              <section key={enfant.id}>
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-base font-bold text-gray-900">
                      {enfant.prenom} {enfant.nom}
                      {enfant.etablissement?.nom && (
                        <span className="ml-2 text-xs font-normal text-gray-400">{enfant.etablissement.nom}</span>
                      )}
                    </h2>
                    <span className="text-xs font-semibold text-gray-500">
                      {nbTermines} / {visibles.length} cours terminé{nbTermines > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1.5">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all"
                      style={{ width: visibles.length ? `${Math.round((nbTermines / visibles.length) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {parMatiere(visibles).map(([matiere, liste]) => (
                    <div key={matiere}>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{matiere}</h3>
                      <div className="space-y-2">
                        {liste.map((c) => {
                          const total = c.ressources.length;
                          const ouverts = c.ressources.filter((r: any) => ressourcesVues.has(r.id)).length;
                          const fini = termines.has(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => setLecture({ cours: c, eleve: enfant })}
                              className={`card w-full text-left flex items-center gap-3 hover:border-brand-200 transition-colors ${fini ? "bg-emerald-50/40 border-emerald-100" : ""}`}
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${fini ? "bg-emerald-100 text-emerald-600" : "bg-brand-50 text-brand-500"}`}>
                                {fini ? <CheckCircle2 className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{c.titre}</p>
                                {c.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{c.description}</p>}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <div className="h-1 w-24 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-brand-400"
                                      style={{ width: total ? `${Math.round((ouverts / total) * 100)}%` : "0%" }}
                                    />
                                  </div>
                                  <span className="text-[11px] text-gray-400">
                                    {total === 0 ? "Aucun document" : `${ouverts}/${total} document${total > 1 ? "s" : ""}`}
                                  </span>
                                  {fini && <span className="text-[11px] font-semibold text-emerald-600">Terminé</span>}
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {formPour !== undefined && peutGerer && (
        <FormCours cours={formPour} onFermer={() => { setFormPour(undefined); load(); }} onChangement={load} />
      )}
      {suiviPour && peutGerer && <SuiviCours cours={suiviPour} onFermer={() => setSuiviPour(null)} />}
      {lecture && (
        <LecteurCours
          cours={lecture.cours}
          eleve={lecture.eleve}
          ressourcesVues={lecture.eleve ? progression(lecture.eleve.id).ressourcesVues : new Set<string>()}
          termine={lecture.eleve ? progression(lecture.eleve.id).termines.has(lecture.cours.id) : false}
          onFermer={() => setLecture(null)}
          onChangement={load}
        />
      )}

      {confirmSuppression && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl w-full max-w-sm p-5">
            <h2 className="font-bold text-gray-900 mb-1">Supprimer ce cours ?</h2>
            <p className="text-sm text-gray-500 mb-4">
              « {confirmSuppression.titre} » sera définitivement supprimé
              {confirmSuppression.ressources?.length > 0
                ? `, ainsi que ses ${confirmSuppression.ressources.length} document(s) et le suivi de lecture associé.`
                : ", ainsi que le suivi de lecture associé."}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmSuppression(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => supprimer(confirmSuppression)} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
