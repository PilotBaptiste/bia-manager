import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { definirPreference, estDesabonne } from "@/lib/emailPrefs";

export async function GET() {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  if (!auth.email || !auth.orgId) return NextResponse.json({ accepte: true });
  return NextResponse.json({ accepte: !(await estDesabonne(auth.orgId, auth.email)) });
}

export async function PUT(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  if (!auth.email || !auth.orgId) return NextResponse.json({ error: "Compte incomplet" }, { status: 400 });
  const { accepte } = await req.json().catch(() => ({}));
  try {
    await definirPreference(auth.orgId, auth.email, accepte === true, "espace_personnel");
  } catch (e: any) {
    return NextResponse.json({ error: `Enregistrement impossible : ${e.message}` }, { status: 500 });
  }
  return NextResponse.json({ accepte: accepte === true });
}
