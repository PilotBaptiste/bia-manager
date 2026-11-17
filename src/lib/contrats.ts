// Aperçu HTML d'un contrat, pour le lire à l'écran avant de le signer.
//
// Le contenu lui-même vit dans contratContenu.ts, sous forme de blocs : le PDF
// signé part des mêmes blocs. Les deux rendus ne peuvent donc pas diverger.
//
// Le contrat de sous-traitance suit la structure de l'article 28 du RGPD et du
// modèle publié par la CNIL. C'est un socle sérieux, pas un avis juridique.

import { type Editeur } from "@/lib/legal";
import { corpsContrat, parties, sousTitre, titreContrat, type Bloc } from "@/lib/contratContenu";

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
  { valeur: "partiel", label: "Signé d'un côté", couleur: "bg-brand-50 text-brand-600" },
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

/** Une valeur absente se voit : on ne signe pas un contrat à trous sans le savoir. */
const marquerTrous = (texte: string) =>
  esc(texte).replace(/\[([^\]]+)\]/g, (_m, quoi) => `<span class="manque">[${quoi}]</span>`);

function rendreBlocs(blocs: Bloc[]): string {
  return blocs
    .map((b) => {
      if (b.t === "titre") return `<h2>${esc(b.texte)}</h2>`;
      if (b.t === "para") return `<p>${marquerTrous(b.texte)}</p>`;
      if (b.t === "liste") return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
      return `<table><tbody>${b.lignes
        .map(([g, d]) => `<tr><td><strong>${esc(g)}</strong></td><td>${esc(d)}</td></tr>`)
        .join("")}</tbody></table>`;
    })
    .join("\n");
}

/** Aperçu complet, lisible à l'écran et imprimable. */
export function documentContrat(contrat: Contrat, nomClub: string, e: Editeur): string {
  const titre = titreContrat(contrat);
  const [pa, pb] = parties(contrat, nomClub, e);
  const cadre = (p: typeof pa) => `
    <div class="partie">
      <p class="role">${esc(p.role)}</p>
      ${p.lignes.map((l, i) => `<p>${i === 0 ? `<strong>${marquerTrous(l)}</strong>` : marquerTrous(l)}</p>`).join("")}
      <p class="qualite">${esc(p.qualite)}</p>
    </div>`;

  const signe = contrat.statut === "signe";
  const signatures = `
  <div class="signatures">
    <div class="bloc">
      <p class="role">Pour l'Éditeur</p>
      <p>${marquerTrous(e.directeur || e.nom || "[nom]")}</p>
      <div class="case"></div>
    </div>
    <div class="bloc">
      <p class="role">Pour l'Aéroclub</p>
      <p>${marquerTrous(contrat.club_representant || "[nom du représentant]")}</p>
      <div class="case">${signe && contrat.signe_le ? `Signé le ${esc(new Date(`${contrat.signe_le}T12:00:00`).toLocaleDateString("fr-FR"))}` : ""}</div>
    </div>
  </div>
  <p class="mention">Fait en deux exemplaires originaux. Chaque partie reconnaît en avoir reçu un.</p>`;

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
  <h1>${esc(titre)}</h1>
  <p class="sous">${marquerTrous(sousTitre(contrat))}</p>
  <h2>Entre les soussignés</h2>
  <div class="parties">${cadre(pa)}${cadre(pb)}</div>
  ${rendreBlocs(corpsContrat(contrat))}
  ${signatures}
</body>
</html>`;
}
