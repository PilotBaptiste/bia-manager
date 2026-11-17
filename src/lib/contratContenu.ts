// Le contenu d'un contrat, décrit en blocs plutôt qu'en HTML.
//
// Deux rendus en vivent : l'aperçu à l'écran et le PDF signé. S'ils partaient
// chacun de leur propre texte, ils finiraient par ne plus dire la même chose —
// et c'est le genre d'écart qui se découvre devant un juge.

import { DONNEES, CONSERVATION, HEBERGEURS, type Editeur } from "@/lib/legal";
import type { Contrat } from "@/lib/contrats";

export type Bloc =
  | { t: "titre"; texte: string }
  | { t: "para"; texte: string }
  | { t: "liste"; items: string[] }
  | { t: "table"; lignes: [string, string][] };

/** Les deux parties, telles qu'elles figurent en tête du contrat. */
export type Partie = { role: string; lignes: string[]; qualite: string };

export const VALEUR_MANQUANTE = "•••";
const ou = (v: unknown, quoi: string) => (String(v ?? "").trim() || `[${quoi}]`);

export const dateFr = (d: string | null | undefined) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "";

export function titreContrat(contrat: Contrat) {
  return contrat.type === "sous_traitance"
    ? "Contrat de sous-traitance — données à caractère personnel"
    : "Contrat d'abonnement — BIA Manager";
}

export function sousTitre(contrat: Contrat) {
  const morceaux: string[] = [];
  if (contrat.reference) morceaux.push(`Référence ${contrat.reference}`);
  morceaux.push(contrat.date_effet ? `Prend effet le ${dateFr(contrat.date_effet)}` : "[date d'effet]");
  if (contrat.date_fin) morceaux.push(`échéance le ${dateFr(contrat.date_fin)}`);
  return morceaux.join(" · ");
}

export function parties(contrat: Contrat, nomClub: string, e: Editeur): [Partie, Partie] {
  const editeurLignes = [
    `${ou(e.nom, "nom de l'éditeur")}${e.statut ? ` — ${e.statut}` : ""}`,
    ou(e.adresse, "adresse de l'éditeur"),
    ...(e.siret ? [`SIRET ${e.siret}`] : []),
    ou(e.email, "email de l'éditeur"),
  ];
  const clubLignes = [
    ou(contrat.club_raison_sociale || nomClub, "raison sociale du club"),
    ou(contrat.club_adresse, "adresse du club"),
    ...(contrat.club_siret ? [`SIRET ${contrat.club_siret}`] : []),
    `Représenté par ${ou(contrat.club_representant, "nom du représentant")}${contrat.club_fonction ? `, ${contrat.club_fonction}` : ""}`,
    ...(contrat.club_email ? [contrat.club_email] : []),
  ];
  return [
    { role: "L'éditeur", lignes: editeurLignes, qualite: "ci-après « l'Éditeur »" },
    { role: "L'aéroclub", lignes: clubLignes, qualite: "ci-après « l'Aéroclub »" },
  ];
}

function clausesParticulieres(contrat: Contrat, numero: number): Bloc[] {
  const texte = contrat.clauses_particulieres?.trim();
  if (!texte) return [];
  return [
    { t: "titre", texte: `Article ${numero} — Clauses particulières` },
    ...texte.split(/\r?\n+/).filter(Boolean).map((p): Bloc => ({ t: "para", texte: p })),
  ];
}

function corpsSousTraitance(contrat: Contrat): Bloc[] {
  const suite = contrat.clauses_particulieres?.trim() ? 8 : 7;
  return [
    { t: "titre", texte: "Article 1 — Objet" },
    {
      t: "para",
      texte:
        "Le présent contrat définit les conditions dans lesquelles l'Éditeur traite, pour le compte de l'Aéroclub, les données à caractère personnel nécessaires au fonctionnement de la plateforme BIA Manager. Il est conclu en application de l'article 28 du Règlement (UE) 2016/679 (RGPD).",
    },
    {
      t: "para",
      texte:
        "L'Aéroclub est responsable du traitement : il décide des données enregistrées et des personnes qui y accèdent. L'Éditeur est sous-traitant : il fournit l'outil et l'héberge.",
    },

    { t: "titre", texte: "Article 2 — Description du traitement" },
    {
      t: "para",
      texte:
        "Nature et finalité. Organisation du Brevet d'Initiation Aéronautique : inscription des élèves, recueil des autorisations parentales, planification et suivi des vols de découverte, gestion financière, communication avec les familles et formation en ligne.",
    },
    {
      t: "para",
      texte:
        "Personnes concernées. Élèves inscrits au BIA, le plus souvent mineurs, leurs responsables légaux, et les membres de l'équipe de l'Aéroclub (administrateurs, coordinateurs, pilotes, gérants, formateurs).",
    },
    { t: "para", texte: "Catégories de données traitées :" },
    { t: "table", lignes: DONNEES.map((d) => [d.titre, d.details] as [string, string]) },
    {
      t: "para",
      texte:
        "Aucune donnée bancaire n'est enregistrée par la plateforme. Aucune donnée dite sensible au sens de l'article 9 du RGPD n'est collectée.",
    },

    { t: "titre", texte: "Article 3 — Durée" },
    {
      t: "para",
      texte:
        "Le présent contrat prend effet à la date indiquée en tête et court pendant toute la durée d'utilisation de la plateforme par l'Aéroclub. Il prend fin de plein droit à la cessation du service.",
    },

    { t: "titre", texte: "Article 4 — Obligations de l'Éditeur" },
    {
      t: "para",
      texte:
        "4.1 — Instructions documentées. L'Éditeur ne traite les données que sur instruction documentée de l'Aéroclub, y compris pour leur transfert hors de l'Union européenne. Il n'utilise jamais ces données pour son propre compte, ne les vend pas et ne les communique à aucun tiers autre que les sous-traitants listés à l'article 4.4.",
    },
    {
      t: "para",
      texte:
        "4.2 — Confidentialité. Toute personne habilitée à accéder aux données s'y engage par écrit ou est soumise à une obligation légale de confidentialité.",
    },
    {
      t: "para",
      texte:
        "4.3 — Sécurité. L'Éditeur met en œuvre les mesures suivantes : cloisonnement des données entre aéroclubs appliqué par la base de données elle-même ; droits d'accès déterminés par le rôle de chaque compte ; chiffrement des échanges ; mots de passe stockés sous forme chiffrée irréversible ; accès aux documents déposés par liens signés de courte durée ; sauvegardes régulières de la base.",
    },
    {
      t: "para",
      texte: "4.4 — Sous-traitance ultérieure. L'Aéroclub autorise l'Éditeur à recourir aux sous-traitants suivants, soumis aux mêmes obligations :",
    },
    { t: "liste", items: HEBERGEURS.map((h) => `${h.nom} — ${h.role}. ${h.note}`) },
    {
      t: "para",
      texte:
        "L'Éditeur informe l'Aéroclub de tout changement envisagé de sous-traitant, qui dispose d'un délai d'un mois pour s'y opposer.",
    },
    {
      t: "para",
      texte:
        "4.5 — Droit d'information des personnes. L'information des élèves et de leurs responsables légaux incombe à l'Aéroclub. L'Éditeur met à sa disposition une politique de confidentialité accessible publiquement depuis la plateforme, sans compte.",
    },
    {
      t: "para",
      texte:
        "4.6 — Exercice des droits. L'Éditeur transmet sans délai à l'Aéroclub toute demande d'accès, de rectification, d'effacement, d'opposition, de limitation ou de portabilité qu'il recevrait directement, et lui fournit les moyens techniques d'y répondre.",
    },
    {
      t: "para",
      texte:
        "4.7 — Violation de données. L'Éditeur notifie à l'Aéroclub toute violation de données à caractère personnel dans les 48 heures suivant sa découverte, avec la nature de la violation, les catégories et le nombre approximatif de personnes concernées, les conséquences probables et les mesures prises.",
    },
    {
      t: "para",
      texte:
        "4.8 — Assistance. L'Éditeur aide l'Aéroclub à remplir ses obligations de sécurité, de notification et, le cas échéant, d'analyse d'impact.",
    },
    {
      t: "para",
      texte:
        "4.9 — Sort des données en fin de contrat. À la cessation du service, l'Éditeur met à disposition de l'Aéroclub un export de ses données dans un format lisible, puis les détruit, ainsi que leurs copies de sauvegarde, dans un délai de 90 jours. Il en justifie par écrit sur demande.",
    },
    {
      t: "para",
      texte:
        "4.10 — Registre et documentation. L'Éditeur tient le registre des traitements effectués pour le compte de l'Aéroclub et met à sa disposition la documentation nécessaire pour démontrer le respect du présent contrat, y compris en permettant des audits.",
    },
    {
      t: "para",
      texte:
        "4.11 — Localisation. Les données sont hébergées dans l'Union européenne. Tout transfert hors de l'Union serait soumis à l'accord préalable écrit de l'Aéroclub.",
    },

    { t: "titre", texte: "Article 5 — Obligations de l'Aéroclub" },
    { t: "para", texte: "L'Aéroclub s'engage à :" },
    {
      t: "liste",
      items: [
        "ne saisir que des données nécessaires à l'organisation du BIA ;",
        "informer les élèves et leurs responsables légaux du traitement, et recueillir les autorisations requises ;",
        "tenir à jour la liste des membres de son équipe disposant d'un accès, et retirer sans délai les accès devenus inutiles ;",
        "documenter par écrit toute instruction particulière donnée à l'Éditeur ;",
        "veiller au respect du présent contrat par son équipe.",
      ],
    },

    { t: "titre", texte: "Article 6 — Responsabilité" },
    {
      t: "para",
      texte:
        "Chaque partie répond des dommages causés par le non-respect des obligations du RGPD qui lui incombent. L'Éditeur n'est responsable que des traitements qu'il effectue pour le compte de l'Aéroclub, à l'exclusion du contenu saisi par ce dernier.",
    },

    ...clausesParticulieres(contrat, 7),

    { t: "titre", texte: `Article ${suite} — Droit applicable` },
    {
      t: "para",
      texte:
        "Le présent contrat est soumis au droit français. À défaut d'accord amiable, les tribunaux français sont seuls compétents.",
    },

    { t: "titre", texte: "Annexe — Durées de conservation" },
    { t: "table", lignes: CONSERVATION.map((c) => [c.quoi, c.duree] as [string, string]) },
  ];
}

function corpsAbonnement(contrat: Contrat): Bloc[] {
  const suite = contrat.clauses_particulieres?.trim() ? 8 : 7;
  const montant =
    contrat.montant_annuel != null ? `${Number(contrat.montant_annuel).toFixed(2)} € par an` : "[montant annuel]";
  return [
    { t: "titre", texte: "Article 1 — Objet" },
    {
      t: "para",
      texte:
        "L'Éditeur met à disposition de l'Aéroclub la plateforme BIA Manager, accessible en ligne, pour la gestion de son Brevet d'Initiation Aéronautique.",
    },
    { t: "titre", texte: "Article 2 — Périmètre du service" },
    {
      t: "para",
      texte:
        "L'abonnement comprend l'accès à la plateforme pour un aéroclub, sans limite de nombre d'élèves, de pilotes ni d'établissements partenaires ; l'hébergement et les sauvegardes ; les mises à jour ; et l'assistance par email.",
    },
    {
      t: "para",
      texte: "Les fonctionnalités optionnelles sont activées club par club par l'Éditeur, à la demande de l'Aéroclub.",
    },
    { t: "titre", texte: "Article 3 — Tarif" },
    {
      t: "para",
      texte: `${montant}, payable à la souscription puis à chaque échéance annuelle. Tout changement de tarif est notifié trois mois avant l'échéance ; à défaut d'accord, l'Aéroclub peut résilier sans frais.`,
    },
    { t: "titre", texte: "Article 4 — Durée et résiliation" },
    {
      t: "para",
      texte:
        "L'abonnement est conclu pour un an, renouvelable par tacite reconduction. Chaque partie peut y mettre fin par écrit au plus tard un mois avant l'échéance. En cas de résiliation, l'Aéroclub récupère l'export de ses données dans les conditions prévues au contrat de sous-traitance.",
    },
    { t: "titre", texte: "Article 5 — Disponibilité" },
    {
      t: "para",
      texte:
        "L'Éditeur met en œuvre les moyens raisonnables pour assurer la disponibilité du service, sans garantie de fonctionnement ininterrompu. Les interruptions programmées sont annoncées à l'avance.",
    },
    { t: "titre", texte: "Article 6 — Données" },
    {
      t: "para",
      texte:
        "Les données saisies par l'Aéroclub lui appartiennent. Leur traitement est régi par le contrat de sous-traitance conclu entre les parties, qui fait partie intégrante du présent accord.",
    },
    ...clausesParticulieres(contrat, 7),
    { t: "titre", texte: `Article ${suite} — Droit applicable` },
    { t: "para", texte: "Le présent contrat est soumis au droit français." },
  ];
}

export function corpsContrat(contrat: Contrat): Bloc[] {
  return contrat.type === "sous_traitance" ? corpsSousTraitance(contrat) : corpsAbonnement(contrat);
}
