import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    const eleveId = searchParams.get("eleve_id");
    const creneauId = searchParams.get("creneau_id");

    if (!email && !eleveId && !creneauId) {
      return NextResponse.json({ error: "email, eleve_id or creneau_id required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    let query = supabase
      .from("email_logs")
      .select("id, created_at, type, to_email, subject, statut, resend_id")
      .order("created_at", { ascending: false })
      .limit(100);

    if (creneauId) {
      query = query.eq("creneau_id", creneauId);
    } else if (eleveId) {
      query = query.eq("eleve_id", eleveId);
    } else if (email) {
      query = query.eq("to_email", email);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ logs: data ?? [] });
  } catch (e: any) {
    console.error("[/api/email/logs]", e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
