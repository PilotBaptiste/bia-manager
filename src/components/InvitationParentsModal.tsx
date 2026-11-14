"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, KeyRound, X, AlertCircle, Check } from "lucide-react";

export type ParentInvitable = {
  email: string;
  nom: string;
  prenom: string;
  /** Prénom + nom des enfants rattachés à cette adresse, pour que l'équipe se repère. */
  enfants: string[];
};

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

/**
 * Envoie aux parents des élèves cochés l'email qui leur fait définir leur mot de
 * passe. Par défaut les familles déjà actives sont écartées : une fiche créée à
 * la main ne doit pas servir à réexpédier un lien à toute la promo.
 */
export default function InvitationParentsModal({
  ouvert,
  onClose,
  anneeLabel,
  parents,
  nbEleves,
}: {
  ouvert: boolean;
  onClose: () => void;
  anneeLabel: string;
  /** Parents des élèves cochés dans la liste, dédoublonnés. */
  parents: ParentInvitable[];
  nbEleves: number;
}) {
  const supabase = createClient();
  const [message, setMessage] = useState("");
  const [sauterActifs, setSauterActifs] = useState(true);
  const [envoi, setEnvoi] = useState<{ faits: number; total: number } | null>(null);
  const [statuts, setStatuts] = useState<Record<string, Statut> | null>(null);
  const [statutsIndispo, setStatutsIndispo] = useState(false);
  const [chargement, setChargement] = useState(false);

  // Dépendance stable : la liste des parents est recalculée à chaque rendu de la
  // page, son identité ne peut pas servir de déclencheur.
  const cleEmails = parents.map((p) => p.email).sort().join(",");

  // Qui a déjà ouvert son espace ? auth.users n'est pas lisible depuis le
  // navigateur : la réponse vient de la fonction statut_acces_parents.
  useEffect(() => {
    if (!ouvert || !cleEmails) return;
    let annule = false;
    (async () => {
      setChargement(true);
      const { data, error } = await supabase.rpc("statut_acces_parents", {
        p_emails: cleEmails.split(","),
      });
      if (annule) return;
      setChargement(false);
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
  }, [ouvert, cleEmails]);

  // Un compte créé par l'import FFA existe sans avoir jamais servi : tant que
  // personne ne s'est connecté, la famille n'a pas d'accès.
  const estActif = (email: string) => !!statuts?.[email]?.aCompte && !!statuts?.[email]?.dejaConnecte;
  const nbActifs = useMemo(
    () => (statuts ? parents.filter((p) => estActif(p.email)).length : 0),
    [parents, statuts],
  );

  const peutFiltrer = !!statuts && !statutsIndispo;
  const destinataires = peutFiltrer && sauterActifs ? parents.filter((p) => !estActif(p.email)) : parents;
  const occupe = envoi !== null;

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
      toast.success(`${ok} email${ok > 1 ? "s" : ""} d'activation envoyé${ok > 1 ? "s" : ""}`);
      setMessage("");
      onClose();
      return;
    }
    toast.warning(
      `${ok} email${ok > 1 ? "s" : ""} envoyé${ok > 1 ? "s" : ""}, ${echecs.length} en échec : ${echecs.slice(0, 5).join(", ")}${echecs.length > 5 ? "…" : ""}`,
    );
  }

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => !occupe && onClose()} />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-auto"
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Activer les comptes famille</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Chaque parent reçoit un lien pour choisir son mot de passe et ouvrir son espace
              {anneeLabel ? (
                <>
                  {" "}— année <strong className="text-brand-600">{anneeLabel}</strong>
                </>
              ) : null}
              .
            </p>
          </div>
          <button onClick={() => !occupe && onClose()} disabled={occupe} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 mb-4">
          <p className="text-sm text-gray-800">
            <strong>{parents.length}</strong> parent{parents.length > 1 ? "s" : ""} pour {nbEleves} élève
            {nbEleves > 1 ? "s" : ""} sélectionné{nbEleves > 1 ? "s" : ""}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {chargement
              ? "Vérification des comptes déjà actifs…"
              : statutsIndispo
                ? "Impossible de savoir qui a déjà activé son compte."
                : nbActifs > 0
                  ? `${parents.length - nbActifs} n'${parents.length - nbActifs > 1 ? "ont" : "a"} pas encore activé son compte · ${nbActifs} déjà actif${nbActifs > 1 ? "s" : ""}`
                  : "Aucun n'a encore activé son compte."}
          </p>
        </div>

        {statutsIndispo ? (
          <div className="mb-5 p-3 rounded-lg bg-amber-50 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Les parents déjà actifs ne peuvent pas être écartés automatiquement : ils recevront eux aussi un lien, qui
              leur servira à réinitialiser leur mot de passe.
            </p>
          </div>
        ) : (
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border mb-5 cursor-pointer transition-colors ${
              sauterActifs ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:bg-gray-50"
            } ${occupe ? "opacity-50 pointer-events-none" : ""}`}
          >
            <input
              type="checkbox"
              checked={sauterActifs}
              disabled={occupe}
              onChange={(e) => setSauterActifs(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-brand-500"
            />
            <span>
              <span className="text-sm font-semibold text-gray-900">
                Ne rien envoyer aux comptes déjà activés
              </span>
              <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">
                {nbActifs > 0
                  ? `${nbActifs} famille${nbActifs > 1 ? "s" : ""} a déjà son accès et sera ignorée. Décochez pour leur renvoyer quand même un lien.`
                  : "Aucune famille active parmi celles sélectionnées : tout le monde recevra l'email."}
              </span>
            </span>
          </label>
        )}

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

        {destinataires.length > 0 ? (
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
                  <div className="flex items-center gap-2 shrink-0 max-w-[55%]">
                    {p.enfants.length > 0 && (
                      <span className="text-[11px] text-gray-400 truncate" title={p.enfants.join(", ")}>
                        {p.enfants.join(", ")}
                      </span>
                    )}
                    {peutFiltrer && estActif(p.email) && (
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 shrink-0">
                        déjà actif
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !chargement && (
            <div className="mb-5 p-3 rounded-lg bg-gray-50 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-gray-600">
                {parents.length === 0
                  ? "Aucun élève sélectionné n'a d'adresse parent."
                  : "Toutes les familles sélectionnées ont déjà activé leur compte."}
              </p>
            </div>
          )
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
          <button onClick={envoyer} disabled={occupe || chargement || destinataires.length === 0} className="btn-primary">
            {occupe || chargement ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {destinataires.length > 0
              ? `Envoyer ${destinataires.length} email${destinataires.length > 1 ? "s" : ""}`
              : "Envoyer"}
          </button>
        </div>
      </div>
    </div>
  );
}
