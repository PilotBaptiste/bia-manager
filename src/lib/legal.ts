// Informations légales de la plateforme.
//
// Ce fichier ne contient que des constantes et des types : il est importé
// aussi bien par les pages serveur que par la console propriétaire côté
// navigateur. La lecture en base vit dans legalServeur.ts.
//
// L'identité de l'éditeur se règle depuis la console propriétaire, et retombe
// sur les variables d'environnement si la base ne dit rien. Tant qu'une valeur
// manque, les pages affichent « à compléter » plutôt que du texte inventé :
// une mention légale fausse vaut moins que pas de mention.


export const lire = (v: string | null | undefined) => (v ?? "").trim();

export type Editeur = {
  nom: string;
  statut: string;
  siret: string;
  adresse: string;
  email: string;
  directeur: string;
  complet: boolean;
};

/** Identité telle que réglée par variables d'environnement (secours). */
export function editeurEnv(): Editeur {
  const nom = lire(process.env.NEXT_PUBLIC_EDITEUR_NOM);
  const statut = lire(process.env.NEXT_PUBLIC_EDITEUR_STATUT);
  const siret = lire(process.env.NEXT_PUBLIC_EDITEUR_SIRET);
  const adresse = lire(process.env.NEXT_PUBLIC_EDITEUR_ADRESSE);
  const email = lire(process.env.NEXT_PUBLIC_EDITEUR_EMAIL);
  const directeur = lire(process.env.NEXT_PUBLIC_EDITEUR_DIRECTEUR) || nom;
  return assembler({ nom, statut, siret, adresse, email, directeur });
}

export function assembler(v: Omit<Editeur, "complet">): Editeur {
  return {
    ...v,
    directeur: v.directeur || v.nom,
    // Le SIRET n'est obligatoire que s'il y a une structure immatriculée :
    // un éditeur en nom propre n'en a pas.
    complet: !!(v.nom && v.adresse && v.email),
  };
}

/** Où tournent l'application et la base. Ce sont des faits, pas des réglages. */
export const HEBERGEURS = [
  {
    role: "Application web",
    nom: "Vercel Inc.",
    adresse: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
    site: "https://vercel.com",
    note: "Les pages sont servies depuis les centres de données européens de Vercel.",
  },
  {
    role: "Base de données et fichiers",
    nom: "Supabase",
    adresse: "970 Toa Payoh North, #07-04, Singapour 318992",
    site: "https://supabase.com",
    note: "Le projet est hébergé en région Europe : les données ne quittent pas l'Union européenne.",
  },
  {
    role: "Envoi des emails",
    nom: "Resend",
    adresse: "2261 Market Street #5039, San Francisco, CA 94114, États-Unis",
    site: "https://resend.com",
    note: "Seuls l'adresse du destinataire et le contenu du message transitent par ce service.",
  },
] as const;

/** Ce que l'application enregistre réellement, catégorie par catégorie. */
export const DONNEES = [
  {
    titre: "Élève",
    details: "Nom, prénom, date et lieu de naissance, adresse postale, établissement et classe.",
    pourquoi: "Inscrire l'élève au BIA, l'identifier auprès de la FFA et établir son autorisation de vol.",
  },
  {
    titre: "Responsables légaux",
    details: "Nom, prénom, adresse email et numéro de téléphone, pour un ou deux responsables.",
    pourquoi: "Donner accès à l'espace famille, recueillir l'autorisation parentale et prévenir des vols.",
  },
  {
    titre: "Autorisation parentale",
    details: "Signature manuscrite tracée à l'écran, date et heure, document PDF généré.",
    pourquoi: "Preuve de l'autorisation de vol, exigée avant tout vol de découverte.",
  },
  {
    titre: "Vols et réservations",
    details: "Créneaux réservés, date du vol, aéronef, pilote, durée et numéro de vol.",
    pourquoi: "Organiser les vols, justifier les heures auprès de la fédération et calculer les coûts.",
  },
  {
    titre: "Paiements",
    details: "Montant, date et mode de règlement de la cotisation BIA. Aucune coordonnée bancaire n'est enregistrée.",
    pourquoi: "Suivre les règlements. Les paiements par carte sont traités par HelloAsso, qui ne nous transmet aucun numéro de carte.",
  },
  {
    titre: "Formation en ligne",
    details: "Documents de cours ouverts, réponses aux QCM, fichiers de devoirs déposés, notes et commentaires du formateur.",
    pourquoi: "Suivre la progression de l'élève et lui rendre ses travaux corrigés.",
  },
  {
    titre: "Emails envoyés",
    details: "Adresse du destinataire, objet, date et état d'envoi.",
    pourquoi: "Savoir si une famille a bien été prévenue, et traiter les désabonnements.",
  },
  {
    titre: "Compte utilisateur",
    details: "Adresse email, mot de passe chiffré, rôles et date de dernière connexion.",
    pourquoi: "Permettre la connexion et n'ouvrir à chacun que ce qui le concerne.",
  },
] as const;

/** Combien de temps chaque catégorie est conservée, et pourquoi. */
export const CONSERVATION = [
  {
    quoi: "Dossier de l'élève et coordonnées des responsables",
    duree: "L'année scolaire en cours, puis archivage",
    pourquoi:
      "L'aéroclub consulte les années passées pour son suivi pédagogique et ses déclarations fédérales. Un dossier peut être supprimé à tout moment à la demande de la famille.",
  },
  {
    quoi: "Autorisations parentales signées",
    duree: "5 ans",
    pourquoi: "Preuve à conserver en cas de question sur un vol déjà effectué.",
  },
  {
    quoi: "Paiements et écritures financières",
    duree: "10 ans",
    pourquoi: "Durée légale de conservation des pièces comptables.",
  },
  {
    quoi: "Travaux de formation (QCM, devoirs, notes)",
    duree: "L'année scolaire en cours, puis archivage",
    pourquoi: "Suivi de la progression sur la durée de la formation.",
  },
  {
    quoi: "Journal des emails envoyés",
    duree: "12 mois",
    pourquoi: "Diagnostic des envois et traitement des désabonnements.",
  },
  {
    quoi: "Compte utilisateur inactif",
    duree: "3 ans après la dernière connexion",
    pourquoi: "Au-delà, le compte n'a plus d'usage et peut être supprimé.",
  },
] as const;

/** Les droits ouverts par le RGPD, dits sans jargon. */
export const DROITS = [
  { titre: "Accès", texte: "Obtenir la copie des données enregistrées sur vous ou sur votre enfant." },
  { titre: "Rectification", texte: "Faire corriger une information inexacte ou incomplète." },
  { titre: "Effacement", texte: "Demander la suppression du dossier, sous réserve des durées légales ci-dessus." },
  { titre: "Opposition", texte: "Refuser de recevoir les emails d'information, par le lien de désabonnement en bas de chaque message." },
  { titre: "Limitation", texte: "Demander le gel d'un traitement le temps qu'une contestation soit examinée." },
  { titre: "Portabilité", texte: "Récupérer les données fournies dans un format lisible par une autre application." },
] as const;
