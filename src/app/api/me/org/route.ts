import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole([], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;
  const org = auth.profile?.organisation;
  return NextResponse.json({
    organisation: auth.orgId && org ? { id: org.id, slug: org.slug, nom: org.nom } : null,
    isOwner: auth.isOwner,
  });
}
