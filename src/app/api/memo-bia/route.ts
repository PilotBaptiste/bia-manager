import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "attestations";
const LEGACY_PATH = "memos/bia-memo.pdf";

const clubPath = (orgId: string) => `memos/${orgId}/bia-memo.pdf`;

export async function GET() {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;
  const storage = createServiceClient().storage.from(BUCKET);
  let { data, error } = await storage.createSignedUrl(clubPath(auth.orgId!), 3600);
  if (error || !data?.signedUrl) {
    ({ data, error } = await storage.createSignedUrl(LEGACY_PATH, 3600));
  }
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Mémo introuvable" }, { status: 404 });
  }
  return NextResponse.json({ url: data.signedUrl });
}

export async function POST(req: Request) {
  const auth = await requireRole(["superadmin"]);
  if (auth instanceof NextResponse) return auth;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Fichier PDF requis" }, { status: 400 });
  }
  const bytes = await file.arrayBuffer();
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(BUCKET).upload(clubPath(auth.orgId!), bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
