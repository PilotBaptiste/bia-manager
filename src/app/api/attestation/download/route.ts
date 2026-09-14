import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

const STAFF = ["superadmin", "coordinateur", "gerant", "pilote"];

export async function GET(req: Request) {
  const auth = await requireRole();
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  const name = (searchParams.get("name") || "attestation.pdf").replace(/["\\\r\n]/g, "");

  if (!path) {
    return new NextResponse("Missing path", { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse("Server not configured", { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!auth.roles.some((r) => STAFF.includes(r))) {
    const { data: owned } = await supabase
      .from("eleves")
      .select("id")
      .eq("parent_id", auth.userId)
      .eq("attestation_url", path)
      .limit(1);
    if (!owned?.length) {
      return new NextResponse("Accès refusé", { status: 403 });
    }
  }

  const { data, error } = await supabase.storage
    .from("attestations")
    .download(path);

  if (error || !data) {
    return new NextResponse("File not found", { status: 404 });
  }

  const buffer = await data.arrayBuffer();

  const ext = path.split(".").pop()?.toLowerCase();
  const contentType =
    ext === "pdf" ? "application/pdf" :
    ext === "png" ? "image/png" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="attestation.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
