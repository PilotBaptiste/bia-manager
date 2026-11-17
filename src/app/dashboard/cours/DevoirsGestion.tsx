"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  Plus, Loader2, Edit, Trash2, Eye, EyeOff, ClipboardList, Download, ChevronLeft, Send, Check,
} from "lucide-react";
import { MATIERES } from "@/lib/cours";
import { useYear } from "@/contexts/YearContext";
import ConfirmModal from "@/components/ConfirmModal";

const supabase = createClient();

const DEVOIR_SELECT =
  "*, copies:devoir_copies(id, eleve_id, fichier_path, fichier_nom, fichier_taille, rendu_le, note, commentaire, corrige_le, resultat_visible)";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtTaille(o: number | null | undefined) {
  if (!o) return "";
  return o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`;
}

/** Les devoirs du club : création, attribution, fichiers rendus et correction. */
export default function DevoirsGestion() {
  const { selectedAnneeId, annees } = useYear();
  const anneeLabel = annees.find((a: any) => a.id === selectedAnneeId)?.label ?? "";
  const [devoirs, setDevoirs] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [vue, setVue] = useState<{ mode: "liste" } | { mode: "edition"; devoir: any | null } | { mode: "copies"; devoir: any }>({ mode: "liste" });
  const [confirmSuppression, setConfirmSuppression] = useState<any | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const load = useCallback(async () => {
    const elevesQ = supabase
      .from("eleves")
      .select("id, nom, prenom, etablissement_id")
      .eq("archive", false)
      .order("nom");
    const [devR, elevesR] = await Promise.all([
      (selectedAnneeId
        ? supabase.from("devoirs").select(DEVOIR_SELECT).eq("annee_id", selectedAnneeId)
        : supabase.from("devoirs").select(DEVOIR_SELECT)
      ).order("created_at", { ascending: false }),
      selectedAnneeId ? elevesQ.eq("annee_id", selectedAnneeId) : elevesQ,
    ]);
    if (devR.error) toast.error(`Chargement impossible : ${devR.error.message}`);
    setDevoirs(devR.data ?? []);
    setEleves(elevesR.data ?? []);
    setLoading(false);
  }, [selectedAnneeId]);

  useEffect(() => { load(); }, [load]);

  async function supprimer(d: any) {
    setSuppressionEnCours(true);
    // Les fichiers déposés partent avec le devoir : rien ne doit rester orphelin
    // dans le stockage.
    const chemins = (d.copies ?? []).map((c: any) => c.fichier_path).filter(Boolean);
    if (chemins.length > 0) await supabase.storage.from("devoirs").remove(chemins);
    const { error } = await supabase.from("devoirs").delete().eq("id", d.id);
    setSuppressionEnCours(false);
    setConfirmSuppression(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Devoir supprimé");
    load();
  }

  async function basculerPublication(d: any) {
    const { error } = await supabase.from("devoirs").update({ publie: !d.publie }).eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>;
  }
  if (vue.mode === "edition") {
    return <EditeurDevoir devoir={vue.devoir} anneeId={selectedAnneeId} onFerme={() => { setVue({ mode: "liste" }); load(); }} />;
  }
  if (vue.mode === "copies") {
    return <Rendus devoir={vue.devoir} eleves={eleves} onFerme={() => { setVue({ mode: "liste" }); load(); }} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <p className="text-sm text-gray-500">
          {devoirs.length} devoir{devoirs.length > 1 ? "s" : ""}{anneeLabel ? ` · ${anneeLabel}` : ""}
        </p>
        <button onClick={() => setVue({ mode: "edition", devoir: null })} className="btn-primary btn-sm">
          <Plus className="w-3.5 h-3.5" /> Nouveau devoir
        </button>
      </div>

      {devoirs.length === 0 ? (
        <div className="card py-12 text-center">
          <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucun devoir pour cette année.</p>
          <p className="text-xs text-gray-400 mt-1">La famille dépose un fichier, vous le notez et le commentez.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {devoirs.map((d) => {
            const copies = d.copies ?? [];
            const rendus = copies.filter((c: any) => c.rendu_le).length;
            const corriges = copies.filter((c: any) => c.corrige_le).length;
            return (
              <div key={d.id} className="card flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{d.titre}</p>
                    <span className="badge bg-gray-100 text-gray-500">{d.matiere}</span>
                    {d.publie ? (
                      <span className="badge bg-emerald-50 text-emerald-600">Publié</span>
                    ) : (
                      <span className="badge bg-amber-50 text-amber-600">Brouillon</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {copies.length} attribué{copies.length > 1 ? "s" : ""} · {rendus} rendu{rendus > 1 ? "s" : ""} ·{" "}
                    {corriges} corrigé{corriges > 1 ? "s" : ""}
                    {d.date_limite ? ` · à rendre le ${fmtDate(d.date_limite)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setVue({ mode: "copies", devoir: d })} className="btn-secondary btn-sm">
                    <ClipboardList className="w-3.5 h-3.5" /> Rendus
                  </button>
                  <button onClick={() => basculerPublication(d)} className="btn-secondary btn-sm" title={d.publie ? "Repasser en brouillon" : "Publier"}>
                    {d.publie ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => setVue({ mode: "edition", devoir: d })} className="btn-secondary btn-sm">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmSuppression(d)} className="btn-danger btn-sm">
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
        title="Supprimer ce devoir"
        message={`Supprimer « ${confirmSuppression?.titre ?? ""} » ?\nLes fichiers déposés par les familles et les notes seront supprimés aussi. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={suppressionEnCours}
        onCancel={() => setConfirmSuppression(null)}
        onConfirm={() => confirmSuppression && supprimer(confirmSuppression)}
      />
    </div>
  );
}

function EditeurDevoir({ devoir, anneeId, onFerme }: { devoir: any | null; anneeId: string | null; onFerme: () => void }) {
  const [titre, setTitre] = useState(devoir?.titre ?? "");
  const [consigne, setConsigne] = useState(devoir?.consigne ?? "");
  const [matiere, setMatiere] = useState<string>(devoir?.matiere ?? MATIERES[0]);
  const [dateLimite, setDateLimite] = useState(devoir?.date_limite ?? "");
  const [noteSur, setNoteSur] = useState(String(devoir?.note_sur ?? 20));
  const [publie, setPublie] = useState(devoir?.publie ?? false);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer() {
    if (!titre.trim()) { setErreur("Le titre est obligatoire."); return; }
    const sur = parseFloat(noteSur);
    if (!Number.isFinite(sur) || sur <= 0) { setErreur("Le barème doit être un nombre positif."); return; }
    setErreur(null);
    setSaving(true);
    const champs = {
      titre: titre.trim(),
      consigne: consigne.trim() || null,
      matiere,
      date_limite: dateLimite || null,
      note_sur: sur,
      publie,
      annee_id: anneeId,
    };
    const { error } = devoir
      ? await supabase.from("devoirs").update(champs).eq("id", devoir.id)
      : await supabase.from("devoirs").insert(champs);
    setSaving(false);
    if (error) { setErreur(error.message); return; }
    toast.success(devoir ? "Devoir modifié" : "Devoir créé");
    onFerme();
  }

  return (
    <div>
      <button onClick={onFerme} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ChevronLeft className="w-3.5 h-3.5" /> Retour aux devoirs
      </button>
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="label">Titre *</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className="input" placeholder="Exposé sur l'histoire de l'aéronautique" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Consigne</label>
            <textarea value={consigne} onChange={(e) => setConsigne(e.target.value)} className="input" rows={4} placeholder="Ce que l'élève doit rendre, le format attendu…" />
          </div>
          <div>
            <label className="label">Matière</label>
            <select value={matiere} onChange={(e) => setMatiere(e.target.value)} className="select">
              {MATIERES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">À rendre le</label>
              <input type="date" value={dateLimite} onChange={(e) => setDateLimite(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Note sur</label>
              <input type="number" value={noteSur} onChange={(e) => setNoteSur(e.target.value)} className="input" min="1" step="1" />
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm mt-3">
          <input type="checkbox" checked={publie} onChange={(e) => setPublie(e.target.checked)} />
          <span className="text-gray-700">Publier (visible des familles à qui il est attribué)</span>
        </label>
        {erreur && <p className="text-sm text-red-600 mt-3">{erreur}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onFerme} className="btn-secondary">Annuler</button>
          <button onClick={enregistrer} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {devoir ? "Enregistrer" : "Créer le devoir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Rendus({ devoir, eleves, onFerme }: { devoir: any; eleves: any[]; onFerme: () => void }) {
  const [copies, setCopies] = useState<any[]>(devoir.copies ?? []);
  const [occupe, setOccupe] = useState(false);
  const [telechargement, setTelechargement] = useState<string | null>(null);

  const parEleve = useMemo(() => new Map(copies.map((c: any) => [c.eleve_id, c])), [copies]);
  const nonAttribues = eleves.filter((e) => !parEleve.has(e.id));

  async function recharger() {
    const { data } = await supabase
      .from("devoir_copies")
      .select("id, eleve_id, fichier_path, fichier_nom, fichier_taille, rendu_le, note, commentaire, corrige_le, resultat_visible")
      .eq("devoir_id", devoir.id);
    setCopies(data ?? []);
  }

  async function attribuer(ids: string[]) {
    if (ids.length === 0) return;
    setOccupe(true);
    const { error } = await supabase.from("devoir_copies").insert(ids.map((id) => ({ devoir_id: devoir.id, eleve_id: id })));
    setOccupe(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Devoir attribué à ${ids.length} élève${ids.length > 1 ? "s" : ""}`);
    recharger();
  }

  async function majCopie(copie: any, patch: any) {
    const { error } = await supabase.from("devoir_copies").update(patch).eq("id", copie.id);
    if (error) { toast.error(error.message); return; }
    recharger();
  }

  async function telecharger(copie: any) {
    if (!copie.fichier_path) return;
    setTelechargement(copie.id);
    const { data, error } = await supabase.storage.from("devoirs").download(copie.fichier_path);
    setTelechargement(null);
    if (error || !data) { toast.error(error?.message ?? "Téléchargement impossible"); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = copie.fichier_nom || "devoir";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button onClick={onFerme} className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-3">
        <ChevronLeft className="w-3.5 h-3.5" /> Retour aux devoirs
      </button>

      <div className="mb-4">
        <h3 className="font-bold text-gray-900">{devoir.titre}</h3>
        <p className="text-xs text-gray-500">
          Noté sur {devoir.note_sur}
          {devoir.date_limite ? ` · à rendre le ${fmtDate(devoir.date_limite)}` : ""}
          {devoir.publie ? "" : " · brouillon, invisible des familles"}
        </p>
      </div>

      {nonAttribues.length > 0 && (
        <div className="card mb-4">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">
              {nonAttribues.length} élève{nonAttribues.length > 1 ? "s" : ""} sans ce devoir
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
        <div className="card py-10 text-center text-sm text-gray-400">Ce devoir n&apos;est attribué à personne.</div>
      ) : (
        <div className="space-y-2">
          {copies
            .map((c: any) => ({ copie: c, eleve: eleves.find((e) => e.id === c.eleve_id) }))
            .sort((a, b) => `${a.eleve?.nom ?? ""}`.localeCompare(`${b.eleve?.nom ?? ""}`, "fr"))
            .map(({ copie, eleve }) => (
              <div key={copie.id} className="card">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{eleve ? `${eleve.prenom} ${eleve.nom}` : "Élève retiré"}</p>
                    <p className="text-xs text-gray-500">
                      {copie.rendu_le ? (
                        <>
                          Rendu le {fmtDate(copie.rendu_le)} ·{" "}
                          <span className="text-gray-700">{copie.fichier_nom}</span>{" "}
                          <span className="text-gray-400">{fmtTaille(copie.fichier_taille)}</span>
                        </>
                      ) : (
                        <span className="text-amber-600">Pas encore rendu</span>
                      )}
                    </p>
                  </div>
                  {copie.fichier_path && (
                    <button onClick={() => telecharger(copie)} disabled={telechargement === copie.id} className="btn-secondary btn-sm shrink-0">
                      {telechargement === copie.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      Télécharger
                    </button>
                  )}
                </div>

                <div className="flex items-end gap-2 flex-wrap">
                  <div>
                    <label className="label">Note</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        defaultValue={copie.note ?? ""}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const note = v === "" ? null : parseFloat(v);
                          if (note !== null && (!Number.isFinite(note) || note < 0 || note > devoir.note_sur)) {
                            toast.error(`La note doit être entre 0 et ${devoir.note_sur}`);
                            return;
                          }
                          if (note !== (copie.note == null ? null : parseFloat(copie.note))) {
                            majCopie(copie, { note, corrige_le: note === null ? null : new Date().toISOString() });
                          }
                        }}
                        className="input w-20 py-1 text-sm"
                        step="0.5"
                        min="0"
                        max={devoir.note_sur}
                      />
                      <span className="text-sm text-gray-500">/ {devoir.note_sur}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="label">Commentaire</label>
                    <input
                      defaultValue={copie.commentaire ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (copie.commentaire ?? "")) {
                          majCopie(copie, { commentaire: e.target.value.trim() || null });
                        }
                      }}
                      className="input py-1 text-sm"
                      placeholder="Appréciation, points à revoir…"
                    />
                  </div>
                  <button
                    onClick={() => majCopie(copie, { resultat_visible: !copie.resultat_visible })}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${copie.resultat_visible ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-gray-300 text-gray-500 hover:border-brand-300"}`}
                    title={copie.resultat_visible ? "La famille voit la note et le commentaire" : "La correction reste chez vous"}
                  >
                    {copie.resultat_visible ? "Rendu à la famille" : "Rendre à la famille"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
