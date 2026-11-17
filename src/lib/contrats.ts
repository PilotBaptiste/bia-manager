// Génération des contrats passés entre l'éditeur de la plateforme et chaque
// aéroclub. Le document est produit en HTML puis imprimé par le navigateur :
// même approche que l'export FFA, sans dépendance supplémentaire.
//
// Le contrat de sous-traitance suit la structure de l'article 28 du RGPD et du
// modèle publié par la CNIL. C'est un socle sérieux, pas un avis juridique.

import { DONNEES, CONSERVATION, HEBERGEURS, type Editeur } from "@/lib/legal";

export type TypeContrat = "sous_traitance" | "abonnement";

export const TYPES_CONTRAT: { valeur: TypeContrat; label: string; description: string }[] = [
  {
    valeur: "sous_traitance",
    label: "Sous-traitance RGPD",
    description: "Obligatoire : le club confie des données de mineurs à la plateforme (article 28 du RGPD).",
  },
  {
    valeur: "abonnement",
    label: "Abonnement",
    description: "Conditions commerciales : périmètre du service, tarif, durée et résiliation.",
  },
];

export const STATUTS: { valeur: string; label: string; couleur: string }[] = [
  { valeur: "brouillon", label: "Brouillon", couleur: "bg-gray-100 text-gray-600" },
  { valeur: "envoye", label: "Envoyé", couleur: "bg-amber-50 text-amber-700" },
  { valeur: "signe", label: "Signé", couleur: "bg-emerald-50 text-emerald-700" },
  { valeur: "resilie", label: "Résilié", couleur: "bg-red-50 text-red-600" },
];

export type Contrat = {
  id?: string;
  organisation_id: string;
  type: TypeContrat;
  reference: string | null;
  club_raison_sociale: string | null;
  club_adresse: string | null;
  club_siret: string | null;
  club_representant: string | null;
  club_fonction: string | null;
  club_email: string | null;
  date_effet: string | null;
  date_fin: string | null;
  montant_annuel: number | null;
  statut: string;
  envoye_le: string | null;
  signe_le: string | null;
  signe_par: string | null;
  resilie_le: string | null;
  clauses_particulieres: string | null;
  notes: string | null;
};

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Valeur manquante : visible dans le document, pour ne rien signer à l'aveugle. */
const ou = (v: unknown, quoi: string) =>
  String(v ?? "").trim() ? esc(v) : `<span class="manque">[${esc(quoi)}]</span>`;

const dateFr = (d: string | null | undefined) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : null;

function enTete(contrat: Contrat, nomClub: string, e: Editeur, titre: string) {
  return `
  <h1>${esc(titre)}</h1>
  <p class="sous">
    ${contrat.reference ? `Référence ${esc(contrat.reference)} · ` : ""}
    ${contrat.date_effet ? `Prend effet le ${esc(dateFr(contrat.date_effet))}` : `<span class="manque">[date d'effet]</span>`}
    ${contrat.date_fin ? ` · échéance le ${esc(dateFr(contrat.date_fin))}` : ""}
  </p>

  <h2>Entre les soussignés</h2>
  <div class="parties">
    <div class="partie">
      <p class="role">L'éditeur</p>
      <p><strong>${ou(e.nom, "nom de l'éditeur")}</strong>${e.statut ? ` — ${esc(e.statut)}` : ""}</p>
      <p>${ou(e.adresse, "adresse de l'éditeur")}</p>
      ${e.siret ? `<p>SIRET ${esc(e.siret)}</p>` : ""}
      <p>${ou(e.email, "email de l'éditeur")}</p>
      <p class="qualite">ci-après « l'Éditeur »</p>
    </div>
    <div class="partie">
      <p class="role">L'aéroclub</p>
      <p><strong>${ou(contrat.club_raison_sociale || nomClub, "raison sociale du club")}</strong></p>
      <p>${ou(contrat.club_adresse, "adresse du club")}</p>
      ${contrat.club_siret ? `<p>SIRET ${esc(contrat.club_siret)}</p>` : ""}
      <p>Représenté par ${ou(contrat.club_representant, "nom du représentant")}${contrat.club_fonction ? `, ${esc(contrat.club_fonction)}` : ""}</p>
      ${contrat.club_email ? `<p>${esc(contrat.club_email)}</p>` : ""}
      <p class="qualite">ci-après « l'Aéroclub »</p>
    </div>
  </div>`;
}

function corpsSousTraitance(contrat: Contrat) {
  const lignesDonnees = DONNEES.map(
    (d) => `<tr><td><strong>${esc(d.titre)}</strong></td><td>${esc(d.details)}</td></tr>`,
  ).join("");
  const lignesDurees = CONSERVATION.map(
    (c) => `<tr><td>${esc(c.quoi)}</td><td>${esc(c.duree)}</td></tr>`,
  ).join("");
  const sousTraitants = HEBERGEURS.map(
    (h) => `<li><strong>${esc(h.nom)}</strong> — ${esc(h.role)}. ${esc(h.note)}</li>`,
  ).join("");

  return `
  <h2>Article 1 — Objet</h2>
  <p>
    Le présent contrat définit les conditions dans lesquelles l'Éditeur traite, pour le compte de l'Aéroclub, les
    données à caractère personnel nécessaires au fonctionnement de la plateforme BIA Manager. Il est conclu en
    application de l'article 28 du Règlement (UE) 2016/679 (RGPD).
  </p>
  <p>
    L'Aéroclub est <strong>responsable du traitement</strong> : il décide des données enregistrées et des personnes
    qui y accèdent. L'Éditeur est <strong>sous-traitant</strong> : il fournit l'outil et l'héberge.
  </p>

  <h2>Article 2 — Description du traitement</h2>
  <p>
    <strong>Nature et finalité.</strong> Organisation du Brevet d'Initiation Aéronautique : inscription des élèves,
    recueil des autorisations parentales, planification et suivi des vols de découverte, gestion financière,
    communication avec les familles et formation en ligne.
  </p>
  <p><strong>Personnes concernées.</strong> Élèves inscrits au BIA, le plus souvent mineurs, leurs responsables
    légaux, et les membres de l'équipe de l'Aéroclub (administrateurs, coordinateurs, pilotes, gérants, formateurs).</p>
  <p><strong>Catégories de données traitées :</strong></p>
  <table><tbody>${lignesDonnees}</tbody></table>
  <p>
    Aucune donnée bancaire n'est enregistrée par la plateforme. Aucune donnée dite sensible au sens de l'article 9
    du RGPD n'est collectée.
  </p>

  <h2>Article 3 — Durée</h2>
  <p>
    Le présent contrat prend effet à la date indiquée en tête et court pendant toute la durée d'utilisation de la
    plateforme par l'Aéroclub. Il prend fin de plein droit à la cessation du service.
  </p>

  <h2>Article 4 — Obligations de l'Éditeur</h2>
  <p><strong>4.1 — Instructions documentées.</strong> L'Éditeur ne traite les données que sur instruction documentée
    de l'Aéroclub, y compris pour leur transfert hors de l'Union européenne. Il n'utilise jamais ces données pour son
    propre compte, ne les vend pas et ne les communique à aucun tiers autre que les sous-traitants listés à
    l'article 4.4.</p>
  <p><strong>4.2 — Confidentialité.</strong> Toute personne habilitée à accéder aux données s'y engage par écrit ou
    est soumise à une obligation légale de confidentialité.</p>
  <p><strong>4.3 — Sécurité.</strong> L'Éditeur met en œuvre les mesures suivantes : cloisonnement des données entre
    aéroclubs appliqué par la base de données elle-même ; droits d'accès déterminés par le rôle de chaque compte ;
    chiffrement des échanges ; mots de passe stockés sous forme chiffrée irréversible ; accès aux documents déposés
    par liens signés de courte durée ; sauvegardes régulières de la base.</p>
  <p><strong>4.4 — Sous-traitance ultérieure.</strong> L'Aéroclub autorise l'Éditeur à recourir aux sous-traitants
    suivants, soumis aux mêmes obligations :</p>
  <ul>${sousTraitants}</ul>
  <p>L'Éditeur informe l'Aéroclub de tout changement envisagé de sous-traitant, qui dispose d'un délai d'un mois
    pour s'y opposer.</p>
  <p><strong>4.5 — Droit d'information des personnes.</strong> L'information des élèves et de leurs responsables
    légaux incombe à l'Aéroclub. L'Éditeur met à sa disposition une politique de confidentialité accessible
    publiquement depuis la plateforme, sans compte.</p>
  <p><strong>4.6 — Exercice des droits.</strong> L'Éditeur transmet sans délai à l'Aéroclub toute demande d'accès,
    de rectification, d'effacement, d'opposition, de limitation ou de portabilité qu'il recevrait directement, et
    lui fournit les moyens techniques d'y répondre.</p>
  <p><strong>4.7 — Violation de données.</strong> L'Éditeur notifie à l'Aéroclub toute violation de données à
    caractère personnel dans les <strong>48 heures</strong> suivant sa découverte, avec la nature de la violation,
    les catégories et le nombre approximatif de personnes concernées, les conséquences probables et les mesures
    prises.</p>
  <p><strong>4.8 — Assistance.</strong> L'Éditeur aide l'Aéroclub à remplir ses obligations de sécurité, de
    notification et, le cas échéant, d'analyse d'impact.</p>
  <p><strong>4.9 — Sort des données en fin de contrat.</strong> À la cessation du service, l'Éditeur met à
    disposition de l'Aéroclub un export de ses données dans un format lisible, puis les détruit, ainsi que leurs
    copies de sauvegarde, dans un délai de <strong>90 jours</strong>. Il en justifie par écrit sur demande.</p>
  <p><strong>4.10 — Registre et documentation.</strong> L'Éditeur tient le registre des traitements effectués pour
    le compte de l'Aéroclub et met à sa disposition la documentation nécessaire pour démontrer le respect du présent
    contrat, y compris en permettant des audits.</p>
  <p><strong>4.11 — Localisation.</strong> Les données sont hébergées dans l'Union européenne. Tout transfert hors
    de l'Union serait soumis à l'accord préalable écrit de l'Aéroclub.</p>

  <h2>Article 5 — Obligations de l'Aéroclub</h2>
  <p>L'Aéroclub s'engage à :</p>
  <ul>
    <li>ne saisir que des données nécessaires à l'organisation du BIA ;</li>
    <li>informer les élèves et leurs responsables légaux du traitement, et recueillir les autorisations requises ;</li>
    <li>tenir à jour la liste des membres de son équipe disposant d'un accès, et retirer sans délai les accès
      devenus inutiles ;</li>
    <li>documenter par écrit toute instruction particulière donnée à l'Éditeur ;</li>
    <li>veiller au respect du présent contrat par son équipe.</li>
  </ul>

  <h2>Article 6 — Responsabilité</h2>
  <p>
    Chaque partie répond des dommages causés par le non-respect des obligations du RGPD qui lui incombent. L'Éditeur
    n'est responsable que des traitements qu'il effectue pour le compte de l'Aéroclub, à l'exclusion du contenu saisi
    par ce dernier.
  </p>

  ${clausesParticulieres(contrat, 7)}

  <h2>Article ${contrat.clauses_particulieres?.trim() ? 8 : 7} — Droit applicable</h2>
  <p>
    Le présent contrat est soumis au droit français. À défaut d'accord amiable, les tribunaux français sont seuls
    compétents.
  </p>

  <h2>Annexe — Durées de conservation</h2>
  <table><tbody>${lignesDurees}</tbody></table>`;
}

function corpsAbonnement(contrat: Contrat) {
  const montant =
    contrat.montant_annuel != null
      ? `${Number(contrat.montant_annuel).toFixed(2)} € par an`
      : `<span class="manque">[montant annuel]</span>`;
  return `
  <h2>Article 1 — Objet</h2>
  <p>
    L'Éditeur met à disposition de l'Aéroclub la plateforme BIA Manager, accessible en ligne, pour la gestion de son
    Brevet d'Initiation Aéronautique.
  </p>

  <h2>Article 2 — Périmètre du service</h2>
  <p>
    L'abonnement comprend l'accès à la plateforme pour un aéroclub, sans limite de nombre d'élèves, de pilotes ni
    d'établissements partenaires ; l'hébergement et les sauvegardes ; les mises à jour ; et l'assistance par email.
  </p>
  <p>
    Les fonctionnalités optionnelles sont activées club par club par l'Éditeur, à la demande de l'Aéroclub.
  </p>

  <h2>Article 3 — Tarif</h2>
  <p>${montant}, payable à la souscription puis à chaque échéance annuelle. Tout changement de tarif est notifié
    trois mois avant l'échéance ; à défaut d'accord, l'Aéroclub peut résilier sans frais.</p>

  <h2>Article 4 — Durée et résiliation</h2>
  <p>
    L'abonnement est conclu pour un an, renouvelable par tacite reconduction. Chaque partie peut y mettre fin par
    écrit au plus tard un mois avant l'échéance. En cas de résiliation, l'Aéroclub récupère l'export de ses données
    dans les conditions prévues au contrat de sous-traitance.
  </p>

  <h2>Article 5 — Disponibilité</h2>
  <p>
    L'Éditeur met en œuvre les moyens raisonnables pour assurer la disponibilité du service, sans garantie de
    fonctionnement ininterrompu. Les interruptions programmées sont annoncées à l'avance.
  </p>

  <h2>Article 6 — Données</h2>
  <p>
    Les données saisies par l'Aéroclub lui appartiennent. Leur traitement est régi par le contrat de sous-traitance
    conclu entre les parties, qui fait partie intégrante du présent accord.
  </p>

  ${clausesParticulieres(contrat, 7)}

  <h2>Article ${contrat.clauses_particulieres?.trim() ? 8 : 7} — Droit applicable</h2>
  <p>Le présent contrat est soumis au droit français.</p>`;
}

function clausesParticulieres(contrat: Contrat, numero: number) {
  const texte = contrat.clauses_particulieres?.trim();
  if (!texte) return "";
  return `
  <h2>Article ${numero} — Clauses particulières</h2>
  <p>${esc(texte).replace(/\r?\n/g, "<br />")}</p>`;
}

function signatures(contrat: Contrat, e: Editeur) {
  const signe = contrat.statut === "signe" && contrat.signe_le;
  return `
  <div class="signatures">
    <div class="bloc">
      <p class="role">Pour l'Éditeur</p>
      <p>${ou(e.directeur || e.nom, "nom")}</p>
      <div class="case"></div>
    </div>
    <div class="bloc">
      <p class="role">Pour l'Aéroclub</p>
      <p>${ou(contrat.club_representant, "nom du représentant")}</p>
      <div class="case">${signe ? `Signé le ${esc(dateFr(contrat.signe_le))}` : ""}</div>
    </div>
  </div>
  <p class="mention">Fait en deux exemplaires originaux. Chaque partie reconnaît en avoir reçu un.</p>`;
}

/** Document complet, prêt à imprimer ou à enregistrer en PDF. */
export function documentContrat(contrat: Contrat, nomClub: string, e: Editeur): string {
  const titre =
    contrat.type === "sous_traitance"
      ? "Contrat de sous-traitance — données à caractère personnel"
      : "Contrat d'abonnement — BIA Manager";
  const corps = contrat.type === "sous_traitance" ? corpsSousTraitance(contrat) : corpsAbonnement(contrat);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(titre)} — ${esc(contrat.club_raison_sociale || nomClub)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; font-size: 11.5px; line-height: 1.6; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 28px 22px; }
  h1 { font-size: 18px; margin: 0 0 4px; color: #1b3a5c; }
  h2 { font-size: 13px; margin: 22px 0 6px; color: #1b3a5c; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
  p { margin: 0 0 8px; text-align: justify; }
  ul { margin: 0 0 8px; padding-left: 20px; }
  li { margin-bottom: 4px; }
  .sous { color: #666; font-size: 11px; margin-bottom: 18px; }
  .parties { display: flex; gap: 18px; margin-bottom: 8px; }
  .partie { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; }
  .partie p { margin: 0 0 3px; text-align: left; }
  .role { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #1b3a5c; font-weight: bold; margin-bottom: 5px !important; }
  .qualite { font-style: italic; color: #777; margin-top: 6px !important; font-size: 10.5px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 12px; font-size: 10.5px; }
  td { border: 1px solid #e5e7eb; padding: 5px 8px; vertical-align: top; }
  td:first-child { width: 32%; }
  .manque { background: #fff3cd; color: #8a6100; padding: 0 4px; border-radius: 3px; font-style: italic; }
  .signatures { display: flex; gap: 18px; margin-top: 28px; page-break-inside: avoid; }
  .bloc { flex: 1; }
  .case { border: 1px solid #cbd5e1; border-radius: 6px; height: 85px; margin-top: 6px; padding: 6px 8px; font-size: 10.5px; color: #15803d; }
  .mention { font-size: 10px; color: #888; margin-top: 10px; text-align: center; }
  @media print { @page { size: A4; margin: 16mm; } body { padding: 0; } }
</style>
</head>
<body>
${enTete(contrat, nomClub, e, titre)}
${corps}
${signatures(contrat, e)}
</body>
</html>`;
}
