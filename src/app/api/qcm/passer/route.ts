import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { eleveAutorise } from "@/lib/coursServeur";

/**
 * Le QCM d'un élève, sans les bonnes réponses tant qu'il n'a pas rendu.
 *
 * La RLS interdit déjà aux familles de lire `qcm_choix` : tout passe par ici,
 * et le navigateur ne reçoit la colonne `correct` qu'une fois la copie rendue.
 */

type Copie = {
  id: string;
  qcm_id: string;
  eleve_id: string;
  termine_le: string | null;
  score: number | null;
  total: number | null;
  commentaire: string | null;
  resultat_visible: boolean;
};

/** La copie attribuée à cet élève pour ce QCM, et le QCM lui-même. */
async function chargerCopie(orgId: string, qcmId: string, eleveId: string) {
  const db = createServiceClient();
  const { data: qcm } = await db
    .from("qcm")
    .select("id, titre, description, matiere, publie, correction_immediate")
    .eq("id", qcmId)
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!qcm || !qcm.publie) return { erreur: "QCM introuvable" as const };

  const { data: copie } = await db
    .from("qcm_copies")
    .select("id, qcm_id, eleve_id, termine_le, score, total, commentaire, resultat_visible")
    .eq("qcm_id", qcmId)
    .eq("eleve_id", eleveId)
    .maybeSingle();
  if (!copie) return { erreur: "Ce QCM n'est pas attribué à cet élève" as const };

  return { qcm, copie: copie as Copie, db };
}

/** GET /api/qcm/passer?qcm_id=…&eleve_id=… */
export async function GET(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const qcmId = url.searchParams.get("qcm_id") ?? "";
  const eleveId = url.searchParams.get("eleve_id") ?? "";
  if (!qcmId || !eleveId) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const eleve = await eleveAutorise(auth, eleveId);
  if ("error" in eleve) return NextResponse.json({ error: eleve.error }, { status: 403 });
  if (!eleve.eleveId) return NextResponse.json({ error: "Élève manquant" }, { status: 400 });

  const charge = await chargerCopie(auth.orgId!, qcmId, eleve.eleveId);
  if ("erreur" in charge) return NextResponse.json({ error: charge.erreur }, { status: 404 });
  const { qcm, copie, db } = charge;

  const { data: questions } = await db
    .from("qcm_questions")
    .select("id, enonce, explication, points, ordre, choix:qcm_choix(id, texte, correct, ordre)")
    .eq("qcm_id", qcmId)
    .order("ordre");

  // La correction n'est jointe qu'une fois la copie rendue, et seulement si le
  // formateur l'a rendue visible.
  const corrigee = !!copie.termine_le && copie.resultat_visible;
  const { data: reponses } = corrigee || copie.termine_le
    ? await db.from("qcm_reponses").select("question_id, choix_id").eq("copie_id", copie.id)
    : { data: [] as any[] };

  const choisiPar: Record<string, string | null> = {};
  for (const r of reponses ?? []) choisiPar[r.question_id] = r.choix_id;

  return NextResponse.json({
    qcm: { id: qcm.id, titre: qcm.titre, description: qcm.description, matiere: qcm.matiere },
    copie: {
      id: copie.id,
      termine_le: copie.termine_le,
      score: corrigee ? copie.score : null,
      total: copie.total,
      commentaire: corrigee ? copie.commentaire : null,
      resultat_visible: copie.resultat_visible,
    },
    questions: (questions ?? []).map((q: any) => ({
      id: q.id,
      enonce: q.enonce,
      points: q.points,
      explication: corrigee ? q.explication : null,
      choisi: choisiPar[q.id] ?? null,
      choix: [...(q.choix ?? [])]
        .sort((a: any, b: any) => (a.ordre ?? 0) - (b.ordre ?? 0))
        .map((c: any) => ({ id: c.id, texte: c.texte, correct: corrigee ? c.correct : undefined })),
    })),
  });
}

/** POST /api/qcm/passer { qcm_id, eleve_id, reponses: { question_id: choix_id } } */
export async function POST(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const qcmId = typeof body?.qcm_id === "string" ? body.qcm_id : "";
  const eleveId = typeof body?.eleve_id === "string" ? body.eleve_id : "";
  const choix: Record<string, string> = body?.reponses ?? {};
  if (!qcmId || !eleveId) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const eleve = await eleveAutorise(auth, eleveId);
  if ("error" in eleve) return NextResponse.json({ error: eleve.error }, { status: 403 });
  if (!eleve.eleveId) return NextResponse.json({ error: "Élève manquant" }, { status: 400 });

  const charge = await chargerCopie(auth.orgId!, qcmId, eleve.eleveId);
  if ("erreur" in charge) return NextResponse.json({ error: charge.erreur }, { status: 404 });
  const { qcm, copie, db } = charge;
  // Une copie rendue ne se refait pas : sinon le score se retente à l'infini.
  if (copie.termine_le) return NextResponse.json({ error: "Ce QCM a déjà été rendu" }, { status: 409 });

  const { data: questions } = await db
    .from("qcm_questions")
    .select("id, points, choix:qcm_choix(id, correct)")
    .eq("qcm_id", qcmId);

  // La correction se fait ici, jamais dans le navigateur.
  let score = 0;
  let total = 0;
  const lignes: any[] = [];
  for (const q of questions ?? []) {
    const points = Number(q.points) || 0;
    total += points;
    const choisi = typeof choix[q.id] === "string" ? choix[q.id] : null;
    const valide = (q.choix ?? []).some((c: any) => c.id === choisi);
    const bonne = (q.choix ?? []).find((c: any) => c.correct);
    if (valide && bonne && choisi === bonne.id) score += points;
    lignes.push({
      organisation_id: auth.orgId,
      copie_id: copie.id,
      question_id: q.id,
      choix_id: valide ? choisi : null,
    });
  }

  await db.from("qcm_reponses").delete().eq("copie_id", copie.id);
  if (lignes.length > 0) {
    const { error } = await db.from("qcm_reponses").insert(lignes);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { error: majErr } = await db
    .from("qcm_copies")
    .update({
      termine_le: new Date().toISOString(),
      score,
      total,
      // Le formateur peut avoir choisi de relire avant de rendre les notes.
      resultat_visible: !!qcm.correction_immediate,
    })
    .eq("id", copie.id);
  if (majErr) return NextResponse.json({ error: majErr.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    score: qcm.correction_immediate ? score : null,
    total,
    correction_immediate: !!qcm.correction_immediate,
  });
}
