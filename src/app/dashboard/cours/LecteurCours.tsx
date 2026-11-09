"use client";
import { useState } from "react";
import { toast } from "sonner";
import {
  X, FileText, Link2, Download, Check, Loader2, CheckCircle2, RotateCcw, Eye, ExternalLink,
} from "lucide-react";
import { sAfficheEnLigne, formatLisible, tailleLisible } from "@/lib/cours";

type Ressource = {
  id: string;
  titre: string;
  type: "fichier" | "lien";
  fichier_nom: string | null;
  fichier_taille: number | null;
  url: string | null;
};

/**
 * Lecture d'un cours par une famille : les documents s'affichent dans l'application,
 * et le cours peut être marqué comme terminé. La progression est celle de l'élève.
 */
export default function LecteurCours({
  cours,
  eleve,
  ressourcesVues,
  termine,
  onFermer,
  onChangement,
}: {
  cours: { id: string; titre: string; description: string | null; matiere: string; ressources: Ressource[] };
  eleve: { id: string; prenom: string; nom: string } | null;
  ressourcesVues: Set<string>;
  termine: boolean;
  onFermer: () => void;
  onChangement: () => void;
}) {
  const [ouvert, setOuvert] = useState<Ressource | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const param = eleve ? `&eleve=${encodeURIComponent(eleve.id)}` : "";

  function urlFichier(r: Ressource, mode: "view" | "download") {
    return `/api/cours/fichier?id=${encodeURIComponent(r.id)}&mode=${mode}${param}`;
  }

  function afficher(r: Ressource) {
    setOuvert(r);
    // L'ouverture est enregistrée par la route qui sert le fichier
    setTimeout(onChangement, 1500);
  }

  function telecharger(r: Ressource) {
    window.location.href = urlFichier(r, "download");
    setTimeout(onChangement, 1500);
  }

  async function ouvrirLien(r: Ressource) {
    window.open(r.url!, "_blank", "noopener,noreferrer");
    await fetch("/api/cours/ressource-vue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, eleve_id: eleve?.id ?? null }),
    }).catch(() => {});
    onChangement();
  }

  async function basculerTermine() {
    if (!eleve) return;
    setEnregistrement(true);
    const res = await fetch("/api/cours/termine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cours_id: cours.id, eleve_id: eleve.id, termine: !termine }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setEnregistrement(false);
    if (!res?.ok) {
      toast.error(data?.error ?? "Enregistrement impossible");
      return;
    }
    toast.success(termine ? "Cours remis à faire" : "Cours marqué comme terminé");
    onChangement();
  }

  const total = cours.ressources.length;
  const vus = cours.ressources.filter((r) => ressourcesVues.has(r.id)).length;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-3xl my-8">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{cours.matiere}</p>
            <h2 className="font-bold text-gray-900 text-lg truncate">{cours.titre}</h2>
            {eleve && (
              <p className="text-sm text-gray-500 mt-0.5">
                Progression de <strong>{eleve.prenom} {eleve.nom}</strong>
              </p>
            )}
          </div>
          <button onClick={onFermer} className="text-gray-400 hover:text-gray-600 shrink-0" title="Fermer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {cours.description && (
            <p className="text-sm text-gray-600 whitespace-pre-line mb-4">{cours.description}</p>
          )}

          {/* Progression */}
          {total > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>{vus} document{vus > 1 ? "s" : ""} ouvert{vus > 1 ? "s" : ""} sur {total}</span>
                {termine && (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Terminé
                  </span>
                )}
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-400 transition-all"
                  style={{ width: `${Math.round((vus / total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Documents */}
          {total === 0 ? (
            <p className="text-sm text-gray-400">Ce cours ne contient encore aucun document.</p>
          ) : (
            <div className="space-y-2">
              {cours.ressources.map((r) => {
                const vu = ressourcesVues.has(r.id);
                const affichable = r.type === "fichier" && sAfficheEnLigne(r.fichier_nom);
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${r.type === "lien" ? "bg-violet-50 text-violet-500" : "bg-brand-50 text-brand-500"}`}>
                      {r.type === "lien" ? <Link2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.titre}</p>
                      <p className="text-[11px] text-gray-400">
                        {r.type === "lien"
                          ? "Lien externe"
                          : [formatLisible(r.fichier_nom), tailleLisible(r.fichier_taille)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {vu && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                        <Check className="w-3 h-3" /> Ouvert
                      </span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {r.type === "lien" ? (
                        <button onClick={() => ouvrirLien(r)} className="btn-secondary btn-sm">
                          <ExternalLink className="w-3.5 h-3.5" /> Ouvrir
                        </button>
                      ) : affichable ? (
                        <>
                          <button onClick={() => afficher(r)} className="btn-secondary btn-sm">
                            <Eye className="w-3.5 h-3.5" /> Lire
                          </button>
                          <button onClick={() => telecharger(r)} className="btn-secondary btn-sm" title="Télécharger">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => telecharger(r)} className="btn-secondary btn-sm">
                          <Download className="w-3.5 h-3.5" /> Télécharger
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Visionneur */}
          {ouvert && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{ouvert.titre}</p>
                <div className="flex items-center gap-2">
                  <a href={urlFichier(ouvert, "view")} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
                    <ExternalLink className="w-3.5 h-3.5" /> Plein écran
                  </a>
                  <button onClick={() => setOuvert(null)} className="btn-secondary btn-sm">
                    <X className="w-3.5 h-3.5" /> Fermer
                  </button>
                </div>
              </div>
              <iframe
                src={urlFichier(ouvert, "view")}
                title={ouvert.titre}
                className="w-full h-[70vh] rounded-lg border border-gray-200 bg-gray-50"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Si le document ne s&apos;affiche pas, utilisez « Plein écran » ou téléchargez-le.
              </p>
            </div>
          )}

          {/* Terminer */}
          {eleve && (
            <div className="flex items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-100 flex-wrap">
              <p className="text-xs text-gray-500">
                {termine
                  ? "Ce cours est marqué comme terminé pour cet élève."
                  : "Quand le cours est travaillé, marquez-le comme terminé."}
              </p>
              <button
                onClick={basculerTermine}
                disabled={enregistrement}
                className={termine ? "btn-secondary btn-sm" : "btn-primary btn-sm"}
              >
                {enregistrement ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : termine ? (
                  <RotateCcw className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {termine ? "Remettre à faire" : "Marquer comme terminé"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
