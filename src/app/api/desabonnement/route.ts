import { NextResponse } from "next/server";
import { definirPreference, estDesabonne, normaliserEmail, verifierSignature } from "@/lib/emailPrefs";
import { getOrgById } from "@/lib/org";

// Route publique : l'accès est prouvé par la signature du lien reçu par email, pas par une session.
async function lire(req: Request) {
  const p = new URL(req.url).searchParams;
  const orgId = p.get("o") ?? "";
  const email = normaliserEmail(p.get("e") ?? "");
  const signature = p.get("s") ?? "";
  if (!orgId || !email || !verifierSignature(orgId, email, signature)) return null;
  return { orgId, email };
}

export async function GET(req: Request) {
  const params = await lire(req);
  if (!params) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
  const org = await getOrgById(params.orgId);
  return NextResponse.json({
    email: params.email,
    club: org?.nom ?? "votre aéroclub",
    desabonne: await estDesabonne(params.orgId, params.email),
  });
}

export async function POST(req: Request) {
  const params = await lire(req);
  if (!params) return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 400 });
  const { accepte } = await req.json().catch(() => ({ accepte: false }));
  try {
    await definirPreference(params.orgId, params.email, accepte === true, "lien_email");
  } catch (e: any) {
    return NextResponse.json({ error: `Enregistrement impossible : ${e.message}` }, { status: 500 });
  }
  return NextResponse.json({ desabonne: accepte !== true });
}
