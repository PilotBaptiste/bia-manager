"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Loader2, Edit, Trash2, Eye, EyeOff, ListChecks, Users, Check, X, ChevronLeft, Send,
} from "lucide-react";
import { MATIERES } from "@/lib/cours";
import { useYear } from "@/contexts/YearContext";
import ConfirmModal from "@/components/ConfirmModal";

const supabase = createClient();

const QCM_SELECT =
  "*, questions:qcm_questions(id, enonce, explication, points, ordre, choix:qcm_choix(id, texte, correct, ordre)), copies:qcm_copies(id, eleve_id, termine_le, score, total, commentaire, resultat_visible)";

type Choix = { id?: string; texte: string; correct: boolean };
type Question = { id?: string; enonce: string; explication: string; points: string; choix: Choix[] };

const questionVide = (): Question => ({
  enonce: "",
  explication: "",
  points: "1",
  choix: [
    { texte: "", correct: true },
    { texte: "", correct: false },
  ],
});

function trier<T extends { ordre?: number }>(l: T[] | null | undefined) {
  return [...(l ?? [])].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
}

/** Les QCM du club : création, attribution aux élèves, copies reçues. */
export default function QcmGestion() {
  const { selectedAnneeId, annees } = useYear();
  const anneeLabel = annees.find((a: any) => a.id === selectedAnneeId)?.label ?? "";
  const [qcms, setQcms] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState<{ mode: "liste" } | { mode: "edition"; qcm: any | null } | { mode: "copies"; qcm: any }>({ mode: "liste" });
  const [confirmSuppression, setConfirmSuppression] = useState<any | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const load = useCallback(async () => {
    const elevesQ = supabase
      .from("eleves")
      .select("id, nom, prenom, etablissement_id, etablissement:etablissements(nom)")
      .eq("archive", false)
      .order("nom");
    const [qcmR, elevesR] = await Promise.all([
      (selectedAnneeId
        ? supabase.from("qcm").select(QCM_SELECT).eq("annee_id", selectedAnneeId)
        : supabase.from("qcm").select(QCM_SELECT)
      ).order("created_at", { ascending: false }),
      selectedAnneeId ? elevesQ.eq("annee_id", selectedAnneeId) : elevesQ,
    ]);
    if (qcmR.error) toast.error(`Chargement impossible : ${qcmR.error.message}`);
    setQcms(qcmR.data ?? []);
    setEleves(elevesR.data ?? []);
    setLoading(false);
  }, [selectedAnneeId]);

  useEffect(() => { load(); }, [load]);

  async function supprimer(q: any) {
    setSuppressionEnCours(true);
    const { error } = await supabase.from("qcm").delete().eq("id", q.id);
    setSuppressionEnCours(false);
    setConfirmSuppression(null);
    if (error) { toast.error(error.message); return; }
    toast.success("QCM supprimé");
    load();
  }

  async function basculerPublication(q: any) {
    const { error } = await supabase.from("qcm").update({ publie: !q.publie }).eq("id", q.id);
    if (error) { toast.error(error.message); return; }
    toast.success(q.publie ? "QCM repassé en brouillon" : "QCM publié");
    load();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>;
  }

  if (vue.mode === "edition") {
    return <EditeurQcm qcm={vue.qcm} anneeId={selectedAnneeId} onFerme={() => { setVue({ mode: "liste" }); load(); }} />;
  }
  if (vue.mode === "copies") {
    return <Copies qcm={vue.qcm} eleves={eleves} onFerme={() => { setVue({ mode: "liste" }); load(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-sm text-gray-500">
          {qcms.length} QCM{anneeLabel ? ` · ${anneeLabel}` : ""}
        </p>
        <button onClick={() => setVue({ mode: "edition", qcm: null })} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> Nouveau QCM
        </button>
      </div>

      {qcms.length === 0 ? (
        <div className="card py-12 text-center">
          <ListChecks className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucun QCM pour cette année.</p>
          <p className="text-xs text-gray-400 mt-1">Créez-en un, ajoutez vos questions, puis attribuez-le à vos élèves.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {qcms.map((q) => {
            const copies = q.copies ?? [];
            const rendues = copies.filter((c: any) => c.termine_le).length;
            return (
              <div key={q.id} className="card flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{q.titre}</p>
                    <span className="badge bg-gray-100 text-gray-500">{q.matiere}</span>
                    {q.publie ? (
                      <span className="badge bg-emerald-50 text-emerald-600">Publié</span>
                    ) : (
                      <span className="badge bg-amber-50 text-amber-600">Brouillon</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(q.questions ?? []).length} question{(q.questions ?? []).length > 1 ? "s" : ""} ·{" "}
                    {copies.length} attribué{copies.length > 1 ? "s" : ""} · {rendues} rendu{rendues > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setVue({ mode: "copies", qcm: q })} className="btn-secondary btn-sm" title="Attribuer et voir les copies">
                    <Users className="w-3.5 h-3.5" /> Copies
                  </button>
                  <button onClick={() => basculerPublication(q)} className="btn-secondary btn-sm" title={q.publie ? "Repasser en brouillon" : "Publier"}>
                    {q.publie ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setVue({ mode: "edition", qcm: q })} className="btn-secondary btn-sm" title="Modifier">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmSuppression(q)} className="btn-danger btn-sm" title="Supprimer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!confirmSuppression}
        title="Supprimer ce QCM"
        message={`Supprimer « ${confirmSuppression?.titre ?? ""} » ?\nLes copies et les réponses des élèves seront supprimées aussi. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={suppressionEnCours}
        onCancel={() => setConfirmSuppression(null)}
        onConfirm={() => confirmSuppression && supprimer(confirmSuppression)}
      />
    </div>
  );
}

/** Création et modification d'un QCM, questions et réponses comprises. */
function EditeurQcm({ qcm, anneeId, onFerme }: { qcm: any | null; anneeId: string | null; onFerme: () => void }) {
  const [titre, setTitre] = useState(qcm?.titre ?? "");
  const [description, setDescription] = useState(qcm?.description ?? "");
  const [matiere, setMatiere] = useState<string>(qcm?.matiere ?? MATIERES[0]);
  const [correctionImmediate, setCorrectionImmediate] = useState(qcm?.correction_immediate ?? true);
  const [publie, setPublie] = useState(qcm?.publie ?? false);
  const [questions, setQuestions] = useState<Question[]>(
    qcm
      ? trier(qcm.questions).map((q: any) => ({
          id: q.id,
          enonce: q.enonce,
          explication: q.explication ?? "",
          points: String(q.points ?? 1),
          choix: trier(q.choix).map((c: any) => ({ id: c.id, texte: c.texte, correct: !!c.correct })),
        }))
      : [questionVide()],
  );
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function majQuestion(i: number, patch: Partial<Question>) {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  }
  function majChoix(i: number, j: number, patch: Partial<Choix>) {
    setQuestions((qs) =>
      qs.map((q, qi) =>
        qi !== i ? q : { ...q, choix: q.choix.map((c, ci) => (ci === j ? { ...c, ...patch } : c)) },
      ),
    );
  }
  function bonneReponse(i: number, j: number) {
    // Une seule bonne réponse par question : cocher l'une décoche les autres.
    setQuestions((qs) =>
      qs.map((q, qi) => (qi !== i ? q : { ...q, choix: q.choix.map((c, ci) => ({ ...c, correct: ci === j })) })),
    );
  }

  function valider(): string | null {
    if (!titre.trim()) return "Le titre est obligatoire.";
    if (questions.length === 0) return "Ajoutez au moins une question.";
    for (const [i, q] of questions.entries()) {
      if (!q.enonce.trim()) return `Question ${i + 1} : l'énoncé est vide.`;
      const remplis = q.choix.filter((c) => c.texte.trim());
      if (remplis.length < 2) return `Question ${i + 1} : il faut au moins deux réponses.`;
      if (!remplis.some((c) => c.correct)) return `Question ${i + 1} : cochez la bonne réponse.`;
      const points = parseFloat(q.points);
      if (!Number.isFinite(points) || points <= 0) return `Question ${i + 1} : le barème doit être un nombre positif.`;
    }
    return null;
  }

  async function enregistrer() {
    const probleme = valider();
    if (probleme) { setErreur(probleme); return; }
    setErreur(null);
    setSaving(true);

    const champs = {
      titre: titre.trim(),
      description: description.trim() || null,
      matiere,
      correction_immediate: correctionImmediate,
      publie,
      annee_id: anneeId,
    };

    let qcmId = qcm?.id as string | undefined;
    if (qcmId) {
      const { error } = await supabase.from("qcm").update(champs).eq("id", qcmId);
      if (error) { setSaving(false); setErreur(error.message); return; }
    } else {
      const { data, error } = await supabase.from("qcm").insert(champs).select("id").single();
      if (error || !data) { setSaving(false); setErreur(error?.message ?? "Création impossible"); return; }
      qcmId = data.id;
    }

    // Les questions sont réécrites en bloc : plus simple et plus sûr que de
    // suivre chaque ajout, déplacement et suppression. Les copies déjà rendues
    // gardent leur score, qui est stocké sur la copie.
    await supabase.from("qcm_questions").delete().eq("qcm_id", qcmId);
    for (const [i, q] of questions.entries()) {
      const { data: qRow, error: qErr } = await supabase
        .from("qcm_questions")
        .insert({
          qcm_id: qcmId,
          enonce: q.enonce.trim(),
          explication: q.explication.trim() || null,
          points: parseFloat(q.points),
          ordre: i,
        })
        .select("id")
        .single();
      if (qErr || !qRow) { setSaving(false); setErreur(qErr?.message ?? "Enregistrement impossible"); return; }
      const choix = q.choix
        .filter((c) => c.texte.trim())
        .map((c, j) => ({ question_id: qRow.id, texte: c.texte.trim(), correct: c.correct, ordre: j }));
      const { error: cErr } = await supabase.from("qcm_choix").insert(choix);
      if (cErr) { setSaving(false); setErreur(cErr.message); return; }
    }

    setSaving(false);
    toast.success(qcm ? "QCM modifié" : "QCM créé");
    onFerme();
  }

  return (
    <div>
      <button onClick={onFerme} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ChevronLeft className="w-3.5 h-3.5" /> Retour aux QCM
      </button>

      <div className="card mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" placeholder="Aérodynamique — chapitre 1" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Consigne <span className="font-normal text-gray-400">(optionnel)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Matière</label>
            <select value={matiere} onChange={(e) => setMatiere(e.target.value)} className="select">
              {MATIERES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col justify-end gap-2 pb-1">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={correctionImmediate} onChange={(e) => setCorrectionImmediate(e.target.checked)} />
              <span className="text-gray-700">Montrer la correction dès que l&apos;élève rend</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={publie} onChange={(e) => setPublie(e.target.checked)} />
              <span className="text-gray-700">Publier (visible des familles)</span>
            </label>
          </div>
        </div>
        {!correctionImmediate && (
          <p className="text-[11px] text-gray-500 mt-2">
            Les copies vous arrivent corrigées, mais la note reste cachée à la famille tant que vous ne la rendez pas visible dans l&apos;onglet Copies.
          </p>
        )}
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={i} className="card">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">Question {i + 1}</p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <label className="text-[11px] text-gray-500">Barème</label>
                  <input
                    type="number"
                    value={q.points}
                    onChange={(e) => majQuestion(i, { points: e.target.value })}
                    className="input w-16 py-1 text-sm"
                    min="0.5"
                    step="0.5"
                  />
                </div>
                <button
                  onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                  disabled={questions.length === 1}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                  title="Supprimer la question"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <textarea
              value={q.enonce}
              onChange={(e) => majQuestion(i, { enonce: e.target.value })}
              className="input mb-3"
              rows={2}
              placeholder="Quelle est la portance d'une aile ?"
            />

            <div className="space-y-1.5">
              {q.choix.map((c, j) => (
                <div key={j} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => bonneReponse(i, j)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${c.correct ? "border-emerald-500 bg-emerald-500" : "border-gray-300 hover:border-emerald-300"}`}
                    title="Bonne réponse"
                  >
                    {c.correct && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <input
                    value={c.texte}
                    onChange={(e) => majChoix(i, j, { texte: e.target.value })}
                    className="input flex-1 py-1.5 text-sm"
                    placeholder={`Réponse ${j + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => majQuestion(i, { choix: q.choix.filter((_, ci) => ci !== j) })}
                    disabled={q.choix.length <= 2}
                    className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 mt-2">
              <button
                type="button"
                onClick={() => majQuestion(i, { choix: [...q.choix, { texte: "", correct: false }] })}
                className="text-xs font-semibold text-brand-500 hover:text-brand-700"
              >
                + Ajouter une réponse
              </button>
              <input
                value={q.explication}
                onChange={(e) => majQuestion(i, { explication: e.target.value })}
                className="input flex-1 max-w-sm py-1 text-xs"
                placeholder="Explication montrée à la correction (optionnel)"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setQuestions((qs) => [...qs, questionVide()])}
        className="btn-secondary btn-sm mt-3"
      >
        <Plus className="w-3.5 h-3.5" /> Ajouter une question
      </button>

      {erreur && <p className="text-sm text-red-600 mt-3">{erreur}</p>}

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onFerme} className="btn-secondary">Annuler</button>
        <button onClick={enregistrer} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {qcm ? "Enregistrer" : "Créer le QCM"}
        </button>
      </div>
    </div>
  );
}

/** Attribution du QCM aux élèves, et copies reçues. */
function Copies({ qcm, eleves, onFerme }: { qcm: any; eleves: any[]; onFerme: () => void }) {
  const [copies, setCopies] = useState<any[]>(qcm.copies ?? []);
  const [occupe, setOccupe] = useState(false);
  const [recherche, setRecherche] = useState("");

  const parEleve = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of copies) m.set(c.eleve_id, c);
    return m;
  }, [copies]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return eleves.filter((e) => !q || `${e.prenom} ${e.nom}`.toLowerCase().includes(q));
  }, [eleves, recherche]);

  async function recharger() {
    const { data } = await supabase
      .from("qcm_copies")
      .select("id, eleve_id, termine_le, score, total, commentaire, resultat_visible")
      .eq("qcm_id", qcm.id);
    setCopies(data ?? []);
  }

  async function attribuer(eleveIds: string[]) {
    if (eleveIds.length === 0) return;
    setOccupe(true);
    const { error } = await supabase
      .from("qcm_copies")
      .insert(eleveIds.map((id) => ({ qcm_id: qcm.id, eleve_id: id })));
    setOccupe(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`QCM attribué à ${eleveIds.length} élève${eleveIds.length > 1 ? "s" : ""}`);
    recharger();
  }

  async function retirer(copie: any) {
    setOccupe(true);
    const { error } = await supabase.from("qcm_copies").delete().eq("id", copie.id);
    setOccupe(false);
    if (error) { toast.error(error.message); return; }
    recharger();
  }

  async function majCopie(copie: any, patch: any) {
    const { error } = await supabase.from("qcm_copies").update(patch).eq("id", copie.id);
    if (error) { toast.error(error.message); return; }
    recharger();
  }

  const nonAttribues = visibles.filter((e) => !parEleve.has(e.id));

  return (
    <div>
      <button onClick={onFerme} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ChevronLeft className="w-3.5 h-3.5" /> Retour aux QCM
      </button>

      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h3 className="font-bold text-gray-900">{qcm.titre}</h3>
          <p className="text-xs text-gray-500">
            {copies.length} attribué{copies.length > 1 ? "s" : ""} · {copies.filter((c: any) => c.termine_le).length} rendu
            {copies.filter((c: any) => c.termine_le).length > 1 ? "s" : ""}
          </p>
        </div>
        {!qcm.publie && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5">
            QCM en brouillon : les familles ne le voient pas encore.
          </p>
        )}
      </div>

      <input
        value={recherche}
        onChange={(e) => setRecherche(e.target.value)}
        placeholder="Rechercher un élève…"
        className="input max-w-sm mb-3"
      />

      {nonAttribues.length > 0 && (
        <div className="card mb-4">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">
              {nonAttribues.length} élève{nonAttribues.length > 1 ? "s" : ""} sans ce QCM
            </p>
            <button onClick={() => attribuer(nonAttribues.map((e) => e.id))} disabled={occupe} className="btn-primary btn-sm">
              {occupe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Attribuer à tous
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {nonAttribues.map((e) => (
              <button
                key={e.id}
                onClick={() => attribuer([e.id])}
                disabled={occupe}
                className="text-[11px] px-2 py-0.5 rounded-full border border-gray-300 text-gray-600 hover:border-brand-300 hover:text-brand-600"
              >
                + {e.prenom} {e.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {copies.length === 0 ? (
        <div className="card py-10 text-center text-sm text-gray-400">Ce QCM n&apos;est attribué à personne.</div>
      ) : (
        <div className="card p-0 overflow-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50">
              <tr>
                {["Élève", "Statut", "Score", "Commentaire", "Note rendue", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {copies
                .map((c: any) => ({ copie: c, eleve: eleves.find((e) => e.id === c.eleve_id) }))
                .filter(({ eleve }) => !recherche.trim() || (eleve && visibles.some((v) => v.id === eleve.id)))
                .sort((a, b) => `${a.eleve?.nom ?? ""}`.localeCompare(`${b.eleve?.nom ?? ""}`, "fr"))
                .map(({ copie, eleve }) => (
                  <tr key={copie.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {eleve ? `${eleve.prenom} ${eleve.nom}` : "Élève retiré"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {copie.termine_le ? (
                        <span className="text-emerald-600 font-semibold">
                          Rendu le {new Date(copie.termine_le).toLocaleDateString("fr-FR")}
                        </span>
                      ) : (
                        <span className="text-gray-400">En attente</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">
                      {copie.termine_le ? `${copie.score ?? 0} / ${copie.total ?? 0}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        defaultValue={copie.commentaire ?? ""}
                        onBlur={(e) => {
                          if (e.target.value !== (copie.commentaire ?? "")) {
                            majCopie(copie, { commentaire: e.target.value.trim() || null });
                          }
                        }}
                        placeholder="Mot à l'élève…"
                        className="input py-1 text-xs min-w-[160px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => majCopie(copie, { resultat_visible: !copie.resultat_visible })}
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${copie.resultat_visible ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 text-gray-500"}`}
                        title={copie.resultat_visible ? "La famille voit la note" : "La note reste cachée"}
                      >
                        {copie.resultat_visible ? "Visible" : "Cachée"}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => retirer(copie)} disabled={occupe} className="text-gray-300 hover:text-red-500 p-1" title="Retirer ce QCM à l'élève">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
