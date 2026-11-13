import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/auth";
import { indexEnteteFfa, ligneFfa, type FfaKey, type ParsedRow } from "@/lib/importEleves";

// Lecture serveur de l'export « Liste des adhérents » de SMILE FFA (.xls BIFF8 ou .xlsx).
// Aucune écriture en base : la route renvoie les lignes normalisées, l'aperçu reste modifiable
// côté navigateur et l'import lui-même passe par la session de l'utilisateur (RLS).
export const runtime = "nodejs";

const TAILLE_MAX = 8 * 1024 * 1024;

/** Valeur de cellule en texte ; les dates Excel (numéros de série) sont rendues en jj/mm/aaaa. */
function texte(v: unknown, estDate: boolean): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    return `${String(v.getUTCDate()).padStart(2, "0")}/${String(v.getUTCMonth() + 1).padStart(2, "0")}/${v.getUTCFullYear()}`;
  }
  if (typeof v === "number") {
    if (estDate && v > 0) {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${String(d.d).padStart(2, "0")}/${String(d.m).padStart(2, "0")}/${d.y}`;
    }
    return String(v);
  }
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v).trim();
}

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;

  let fichier: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("fichier");
    if (f instanceof File) fichier = f;
  } catch {
    return NextResponse.json({ error: "Requête illisible" }, { status: 400 });
  }
  if (!fichier) return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
  if (fichier.size === 0) return NextResponse.json({ error: "Le fichier est vide" }, { status: 400 });
  if (fichier.size > TAILLE_MAX) {
    return NextResponse.json({ error: "Fichier trop volumineux (8 Mo maximum)" }, { status: 400 });
  }

  const lu = await (async () => {
    try {
      const classeur = XLSX.read(Buffer.from(await fichier!.arrayBuffer()), { type: "buffer", cellDates: false });
      return { classeur, erreur: null as string | null };
    } catch (e) {
      return {
        classeur: null,
        erreur: `Fichier illisible : ${e instanceof Error ? e.message : "format non reconnu"}. Attendu : l'export .xls ou .xlsx de SMILE FFA.`,
      };
    }
  })();
  if (!lu.classeur) return NextResponse.json({ error: lu.erreur }, { status: 400 });
  const classeur = lu.classeur;
  const feuilles = classeur.SheetNames;
  if (feuilles.length === 0) return NextResponse.json({ error: "Le classeur ne contient aucune feuille" }, { status: 400 });

  // L'export FFA n'a qu'une feuille (nommée « A »), mais on cherche la première dont l'en-tête est reconnu.
  let index: Partial<Record<FfaKey, number>> | null = null;
  let lignes: unknown[][] = [];
  let departEntete = 0;
  for (const nom of feuilles) {
    const brut = XLSX.utils.sheet_to_json<unknown[]>(classeur.Sheets[nom], { header: 1, raw: true, defval: null, blankrows: true });
    // L'en-tête n'est pas forcément en première ligne (titre, logo…) : on tolère un décalage.
    for (let i = 0; i < Math.min(brut.length, 10); i++) {
      const candidat = indexEnteteFfa((brut[i] || []).map((c) => String(c ?? "")));
      if (candidat) { index = candidat; lignes = brut; departEntete = i; break; }
    }
    if (index) break;
  }
  if (!index) {
    return NextResponse.json(
      { error: "En-tête FFA non reconnu : les colonnes « Nom » et « Prénom » sont introuvables. Exportez la liste des adhérents depuis SMILE sans modifier l'en-tête." },
      { status: 400 },
    );
  }

  const colDate = index.ddn;
  const rows: ParsedRow[] = [];
  let ignorees = 0;
  for (let i = departEntete + 1; i < lignes.length; i++) {
    const brut = lignes[i] || [];
    const cols = brut.map((v, c) => texte(v, c === colDate));
    if (!cols.some((c) => c)) continue;
    // Le numéro de ligne affiché correspond à celui du tableur.
    const row = ligneFfa(cols, index, i + 1);
    if (!row.nom || !row.prenom) { ignorees++; continue; }
    rows.push(row);
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Aucun adhérent trouvé dans le fichier (nom et prénom renseignés). Le modèle vide de la FFA ne contient que l'en-tête." },
      { status: 400 },
    );
  }

  return NextResponse.json({ rows, ignorees, feuille: feuilles[0] });
}
