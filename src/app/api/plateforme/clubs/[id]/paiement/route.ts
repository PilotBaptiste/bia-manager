import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { verifierConfig } from "@/lib/sumup";

// Clés SumUp d'un club : saisies par le propriétaire de la plateforme uniquement, jamais réaffichées.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => ({} as any));
  const merchantCode = String(body.sumupMerchantCode ?? "").trim();
  const apiKey = String(body.sumupApiKey ?? "").trim();

  const db = createServiceClient();
  if (!merchantCode && !apiKey) {
    const { error } = await db.from("organisation_secrets").delete().eq("organisation_id", id);
    if (error) return NextResponse.json({ error: `Suppression impossible : ${error.message}` }, { status: 500 });
    return NextResponse.json({ configure: false });
  }
  const { data: existing } = await db.from("organisation_secrets").select("sumup_api_key, sumup_merchant_code").eq("organisation_id", id).maybeSingle();
  const cle = apiKey || existing?.sumup_api_key;
  const code = merchantCode || existing?.sumup_merchant_code;
  if (!cle || !code) return NextResponse.json({ error: "Code marchand et clé API sont requis" }, { status: 400 });

  try {
    await verifierConfig({ apiKey: cle, merchantCode: code });
  } catch (e: any) {
    return NextResponse.json({ error: `SumUp refuse ces identifiants : ${e?.message ?? "vérification impossible"}` }, { status: 400 });
  }

  const { error } = await db.from("organisation_secrets").upsert({
    organisation_id: id, sumup_api_key: cle, sumup_merchant_code: code, updated_at: new Date().toISOString(),
  }, { onConflict: "organisation_id" });
  if (error) return NextResponse.json({ error: `Enregistrement impossible : ${error.message}` }, { status: 500 });
  return NextResponse.json({ configure: true, merchantCode: code });
}
