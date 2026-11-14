"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, Mail, X, AlertCircle, Check } from "lucide-react";

export type ParentInvitable = {
  email: string;
  nom: string;
  prenom: string;
  /** Prénom + nom des enfants rattachés à cette adresse, pour que l'équipe se repère. */
  enfants: string[];
};

type Cible = "sansAcces" | "selection";

type Statut = { aCompte: boolean; dejaConnecte: boolean };

const MESSAGE_MAX = 2000;

/**
 * Deux adresses peuvent désigner le même parent écrit différemment : on
 * dédoublonne sur l'adresse, en cumulant les enfants.
 */
export function regrouperParents(lignes: ParentInvitable[]): ParentInvitable[] {
  const par = new Map<string, ParentInvitable>();
  for (const l of lignes) {
    const email = l.email.trim().toLowerCase();
    if (!email) continue;
    const dejaVu = par.get(email);
    if (dejaVu) {
      for (const enfant of l.enfants) if (!dejaVu.enfants.includes(enfant)) dejaVu.enfants.push(enfant);
      if (!dejaVu.nom) dejaVu.nom = l.nom;
      if (!dejaVu.prenom) dejaVu.prenom = l.prenom;
      continue;
    }
    par.set(email, { email, nom: l.nom, prenom: l.prenom, enfants: [...l.enfants] });
  }
  return Array.from(par.values()).sort((a, b) =>
    `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, "fr"),
  );
}

export default function InvitationParentsModal({
  ouvert,
  onClose,
  anneeLabel,
  candidats,
  selection,
  cibleInitiale,
  chargementCandidats,
}: {
  ouvert: boolean;
  onClose: () => void;
  anneeLabel: string;
  /** Tous les parents des élèves actuellement filtrés (toutes les pages). */
  candidats: ParentInvitable[];
  /** Parents des élèves cochés dans la liste. */
  selection: ParentInvitable[];
  cibleInitiale: Cible;
  chargementCandidats: boolean;
}) {
  const supabase = createClient();
  const [cible, setCible] = useState<Cible>(cibleInitiale);
  const [message, setMessage] = useState("");
  const [envoi, setEnvoi] = useState<{ faits: number; total: number } | null>(null);
  const [statuts, setStatuts] = useState<Record<string, Statut> | null>(null);
  const [statutsIndispo, setStatutsIndispo] = useState(false);
  const [chargementStatuts, setChargementStatuts] = useState(false);

  useEffect(() => {
    if (ouvert) setCible(cibleInitiale);
  }, [ouvert, cibleInitiale]);

  // Qui n'a jamais ouvert son espace ? auth.users n'est pas lisible depuis le
  // navigateur : la réponse vient de la fonction statut_acces_parents.
  useEffect(() => {
    if (!ouvert || candidats.length === 0) return;
    let annule = false;
    (async () => {
      setChargementStatuts(true);
      const { data, error } = await supabase.rpc("statut_acces_parents", {
        p_emails: candidats.map((p) => p.email),
      });
      if (annule) return;
      setChargementStatuts(false);
      if (error) {
        setStatuts(null);
        setStatutsIndispo(true);
        return;
      }
      const map: Record<string, Statut> = {};
      for (const row of (data as any[]) || []) {
        map[String(row.email).toLowerCase()] = {
          aCompte: !!row.a_compte,
          dejaConnecte: !!row.deja_connecte,
        };
      }
      setStatuts(map);
      setStatutsIndispo(false);
    })();
    return () => {
      annule = true;
    };
  }, [ouvert, candidats]);

  const sansAcces = useMemo(() => {
    if (!statuts) return [];
    // Pas de compte, ou compte créé par l'import mais jamais activé : dans les deux
    // cas la famille n'a pas encore d'accès et l'email d'activation a du sens.
    return candidats.filter((p) => {
      const s = statuts[p.email];
      return !s || !s.aCompte || !s.dejaConnecte;
    });
  }, [candidats, statuts]);

  const destinataires = cible === "selection" ? selection : sansAcces;
  const occupe = envoi !== null;
  // Tant que la liste des parents ou leur statut d'activation n'est pas revenue, on
  // affiche « … » plutôt qu'un zéro trompeur.
  const enAttente =
    chargementCandidats || chargementStatuts || (candidats.length > 0 && statuts === null && !statutsIndispo);

  async function envoyer() {
    if (destinataires.length === 0) return;
    setEnvoi({ faits: 0, total: destinataires.length });
    let ok = 0;
    const echecs: string[] = [];
    for (let i = 0; i < destinataires.length; i++) {
      const p = destinataires[i];
      try {
        const res = await fetch("/api/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: p.email,
            nom: p.nom,
            prenom: p.prenom,
            message: message.trim(),
          }),
        });
        if (res.ok) ok++;
        else echecs.push(p.email);
      } catch {
        echecs.push(p.email);
      }
      setEnvoi({ faits: i + 1, total: destinataires.length });
    }
    setEnvoi(null);
    if (echecs.length === 0) {
      toast.success(`${ok} invitation${ok > 1 ? "s" : ""} envoyée${ok > 1 ? "s" : ""}`);
      setMessage("");
      onClose();
      return;
    }
    toast.warning(
      `${ok} invitation${ok > 1 ? "s" : ""} envoyée${ok > 1 ? "s" : ""}, ${echecs.length} en échec : ${echecs.slice(0, 5).join(", ")}${echecs.length > 5 ? "…" : ""}`,
    );
  }

  if (!ouvert) return null;

  const Option = ({ valeur, titre, detail, nombre, desactive }: { valeur: Cible; titre: string; detail: string; nombre: number | null; desactive?: boolean }) => (
    <button
      type="button"
      disabled={desactive || occupe}
      onClick={() => setCible(valeur)}
      className={`flex-1 min-w-[200px] text-left p-3 rounded-xl border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        cible === valeur ? "border-brand-400 bg-brand-50 ring-2 ring-brand-300/40" : "border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{titre}</span>
        <span className={`text-sm font-bold ${cible === valeur ? "text-brand-600" : "text-gray-500"}`}>
          {nombre === null ? "…" : nombre}
        </span>
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{detail}</p>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !occupe && onClose()} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-auto"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Invitation des parents</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Email d&apos;activation du compte famille
              {anneeLabel ? (
                <>
                  {" "}— année <strong className="text-brand-600">{anneeLabel}</strong>, celle choisie dans le sélecteur du menu
                </>
              ) : null}
              .
            </p>
          </div>
          <button onClick={() => !occupe && onClose()} disabled={occupe} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="label">Destinataires</label>
        <div className="flex gap-2 flex-wrap mb-1">
          <Option
            valeur="sansAcces"
            titre="Parents sans accès"
            detail={statutsIndispo ? "Statut d'activation indisponible" : "Aucun compte, ou compte jamais activé"}
            nombre={enAttente ? null : statutsIndispo ? 0 : sansAcces.length}
            desactive={statutsIndispo || (!enAttente && sansAcces.length === 0)}
          />
          <Option
            valeur="selection"
            titre="Élèves sélectionnés"
            detail={selection.length > 0 ? "Les parents des élèves cochés dans la liste" : "Cochez des élèves dans la liste d'abord"}
            nombre={selection.length}
            desactive={selection.length === 0}
          />
        </div>
        {statutsIndispo && (
          <div className="mb-4 mt-2 p-3 rounded-lg bg-amber-50 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Impossible de savoir qui a déjà activé son compte. Sélectionnez les élèves concernés dans la liste pour
              inviter leurs parents.
            </p>
          </div>
        )}
        <div className="mb-5" />

        <label className="label" htmlFor="message-invitation">
          Mot d&apos;introduction <span className="font-normal text-gray-400">(optionnel)</span>
        </label>
        <textarea
          id="message-invitation"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          disabled={occupe}
          rows={5}
          placeholder={"Bonjour,\n\nJe suis Jean Dupont, responsable du BIA à l'aéroclub. Votre enfant est inscrit au Brevet d'Initiation Aéronautique cette année. Voici l'accès à votre espace famille, où vous pourrez suivre son dossier et réserver ses vols."}
          className="input"
          style={{ minHeight: "7rem", lineHeight: 1.5 }}
        />
        <div className="flex items-center justify-between mt-1 mb-5">
          <p className="text-[11px] text-gray-500">
            Ce texte apparaît en haut de l&apos;email, avant le bouton d&apos;activation.
          </p>
          <span className={`text-[11px] ${message.length > MESSAGE_MAX - 100 ? "text-amber-600" : "text-gray-400"}`}>
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>

        {destinataires.length > 0 && (
          <div className="mb-5">
            <label className="label">
              {destinataires.length} destinataire{destinataires.length > 1 ? "s" : ""}
            </label>
            <div className="max-h-44 overflow-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
              {destinataires.map((p) => (
                <div key={p.email} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {p.prenom} {p.nom}
                      {!p.nom && !p.prenom ? <span className="text-gray-400">Parent</span> : null}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">{p.email}</p>
                  </div>
                  {p.enfants.length > 0 && (
                    <span className="text-[11px] text-gray-400 shrink-0 truncate max-w-[45%]" title={p.enfants.join(", ")}>
                      {p.enfants.join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {destinataires.length === 0 && !enAttente && (
          <div className="mb-5 p-3 rounded-lg bg-gray-50 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-sm text-gray-600">
              {cible === "sansAcces"
                ? "Tous les parents de cette année ont déjà activé leur compte."
                : "Aucun élève sélectionné n'a d'adresse parent."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {occupe && (
            <span className="text-xs text-gray-500 mr-auto">
              Envoi {envoi!.faits}/{envoi!.total}…
            </span>
          )}
          <button onClick={onClose} disabled={occupe} className="btn-secondary">
            Annuler
          </button>
          <button
            onClick={envoyer}
            disabled={occupe || destinataires.length === 0 || enAttente}
            className="btn-primary"
          >
            {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Envoyer {destinataires.length > 0 ? `${destinataires.length} invitation${destinataires.length > 1 ? "s" : ""}` : "les invitations"}
          </button>
        </div>
      </div>
    </div>
  );
}
