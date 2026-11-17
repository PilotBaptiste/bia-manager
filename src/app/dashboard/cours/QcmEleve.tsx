"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, ListChecks, Check, X, ChevronLeft, Award } from "lucide-react";

const supabase = createClient();

type Choix = { id: string; texte: string; correct?: boolean };
type QuestionPassage = { id: string; enonce: string; points: number; explication: string | null; choisi: string | null; choix: Choix[] };

/** Les QCM attribués aux enfants du compte : les passer, voir la correction. */
export default function QcmEleve({ enfants }: { enfants: any[] }) {
  const [enfantId, setEnfantId] = useState<string>(enfants[0]?.id ?? "");
  const [copies, setCopies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [passage, setPassage] = useState<{ qcmId: string } | null>(null);

  const enfant = enfants.find((e) => e.id === enfantId);

  const load = useCallback(async () => {
    if (!enfantId) { setCopies([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("qcm_copies")
      .select("id, qcm_id, termine_le, score, total, commentaire, resultat_visible, qcm:qcm(id, titre, description, matiere, publie)")
      .eq("eleve_id", enfantId);
    setLoading(false);
    if (error) { toast.error(`Chargement impossible : ${error.message}`); return; }
    // Un QCM repassé en brouillon disparaît de l'espace famille.
    setCopies((data ?? []).filter((c: any) => c.qcm?.publie));
  }, [enfantId]);

  useEffect(() => { load(); }, [load]);

  if (enfants.length === 0) {
    return <div className="card py-10 text-center text-sm text-gray-400">Aucun élève rattaché à votre compte.</div>;
  }

  if (passage && enfant) {
    return (
      <Passage
        qcmId={passage.qcmId}
        eleve={enfant}
        onFerme={() => { setPassage(null); load(); }}
      />
    );
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
          <ListChecks className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucun QCM pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {copies.map((c) => {
            const corrige = !!c.termine_le && c.resultat_visible;
            return (
              <div key={c.id} className="card flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{c.qcm?.titre}</p>
                  <p className="text-xs text-gray-500">
                    {c.qcm?.matiere}
                    {c.termine_le ? ` · rendu le ${new Date(c.termine_le).toLocaleDateString("fr-FR")}` : " · à faire"}
                  </p>
                  {corrige && c.commentaire && (
                    <p className="text-xs text-brand-600 mt-1">« {c.commentaire} »</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {c.termine_le ? (
                    corrige ? (
                      <span className="flex items-center gap-1.5 font-bold text-emerald-600">
                        <Award className="w-4 h-4" /> {c.score} / {c.total}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Correction en attente</span>
                    )
                  ) : null}
                  <button onClick={() => setPassage({ qcmId: c.qcm_id })} className={c.termine_le ? "btn-secondary btn-sm" : "btn-primary btn-sm"}>
                    {c.termine_le ? "Revoir" : "Commencer"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Passage d'un QCM : les bonnes réponses viennent du serveur, après l'envoi. */
function Passage({ qcmId, eleve, onFerme }: { qcmId: string; eleve: any; onFerme: () => void }) {
  const [donnees, setDonnees] = useState<any | null>(null);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const res = await fetch(`/api/qcm/passer?qcm_id=${encodeURIComponent(qcmId)}&eleve_id=${encodeURIComponent(eleve.id)}`);
    const json = await res.json();
    if (!res.ok) { setErreur(json.error ?? "Chargement impossible"); return; }
    setDonnees(json);
    const deja: Record<string, string> = {};
    for (const q of json.questions ?? []) if (q.choisi) deja[q.id] = q.choisi;
    setReponses(deja);
  }, [qcmId, eleve.id]);

  useEffect(() => { charger(); }, [charger]);

  async function envoyer() {
    const questions: QuestionPassage[] = donnees?.questions ?? [];
    const manquantes = questions.filter((q) => !reponses[q.id]);
    if (manquantes.length > 0) {
      setErreur(`Il reste ${manquantes.length} question${manquantes.length > 1 ? "s" : ""} sans réponse.`);
      return;
    }
    setErreur(null);
    setEnvoi(true);
    const res = await fetch("/api/qcm/passer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qcm_id: qcmId, eleve_id: eleve.id, reponses }),
    });
    const json = await res.json();
    setEnvoi(false);
    if (!res.ok) { setErreur(json.error ?? "Envoi impossible"); return; }
    if (json.correction_immediate) {
      toast.success(`QCM rendu — ${json.score} / ${json.total}`);
    } else {
      toast.success("QCM rendu. Votre formateur vous renverra la correction.");
    }
    charger();
  }

  if (erreur && !donnees) {
    return (
      <div>
        <button onClick={onFerme} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
          <ChevronLeft className="w-3.5 h-3.5" /> Retour
        </button>
        <div className="card py-10 text-center text-sm text-red-600">{erreur}</div>
      </div>
    );
  }
  if (!donnees) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>;
  }

  const rendu = !!donnees.copie?.termine_le;
  const corrige = rendu && donnees.copie?.resultat_visible;
  const questions: QuestionPassage[] = donnees.questions ?? [];

  return (
    <div>
      <button onClick={onFerme} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ChevronLeft className="w-3.5 h-3.5" /> Retour aux QCM
      </button>

      <div className="card mb-4">
        <h3 className="font-bold text-gray-900">{donnees.qcm.titre}</h3>
        <p className="text-xs text-gray-500">
          {donnees.qcm.matiere} · {eleve.prenom} {eleve.nom}
        </p>
        {donnees.qcm.description && <p className="text-sm text-gray-600 mt-2">{donnees.qcm.description}</p>}
        {corrige && (
          <p className="mt-3 text-lg font-bold text-emerald-600">
            {donnees.copie.score} / {donnees.copie.total}
          </p>
        )}
        {rendu && !corrige && (
          <p className="mt-3 text-sm text-amber-600">
            Copie rendue. Votre formateur vous enverra la correction.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500 mb-1">
              Question {i + 1} <span className="text-gray-400 font-medium normal-case">· {q.points} pt{q.points > 1 ? "s" : ""}</span>
            </p>
            <p className="text-sm text-gray-900 mb-3 whitespace-pre-wrap">{q.enonce}</p>
            <div className="space-y-1.5">
              {q.choix.map((c) => {
                const choisi = reponses[q.id] === c.id;
                const bonne = c.correct === true;
                const mauvaiseChoisie = corrige && choisi && !bonne;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={rendu}
                    onClick={() => setReponses((r) => ({ ...r, [q.id]: c.id }))}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg border text-sm transition-colors disabled:cursor-default ${
                      corrige && bonne
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : mauvaiseChoisie
                          ? "border-red-300 bg-red-50 text-red-700"
                          : choisi
                            ? "border-brand-400 bg-brand-50 text-brand-800"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${choisi || (corrige && bonne) ? "border-current" : "border-gray-300"}`}>
                      {corrige && bonne && <Check className="w-2.5 h-2.5" />}
                      {mauvaiseChoisie && <X className="w-2.5 h-2.5" />}
                      {!corrige && choisi && <span className="w-2 h-2 rounded-full bg-current" />}
                    </span>
                    {c.texte}
                  </button>
                );
              })}
            </div>
            {corrige && q.explication && (
              <p className="text-xs text-gray-500 mt-2 border-l-2 border-brand-200 pl-2">{q.explication}</p>
            )}
          </div>
        ))}
      </div>

      {erreur && <p className="text-sm text-red-600 mt-3">{erreur}</p>}

      {!rendu && (
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onFerme} className="btn-secondary">Reprendre plus tard</button>
          <button onClick={envoyer} disabled={envoi} className="btn-primary">
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Rendre ma copie
          </button>
        </div>
      )}
    </div>
  );
}
