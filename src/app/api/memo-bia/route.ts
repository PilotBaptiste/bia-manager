import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const BUCKET = "attestations";
const PATH = "memos/bia-memo.pdf";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// GET — download/signed URL for the memo
export async function GET() {
  const supabase = serviceClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(PATH, 3600);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Mémo introuvable" }, { status: 404 });
  }
  return NextResponse.json({ url: data.signedUrl });
}

// POST — upload a new PDF (superadmin only — caller must verify role)
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Fichier PDF requis" }, { status: 400 });
  }
  const bytes = await file.arrayBuffer();
  const supabase = serviceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(PATH, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
