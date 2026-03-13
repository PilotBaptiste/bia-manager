import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email, nom, prenom, telephone, roles, etablissement_id } =
    await req.json();

  if (!email || !nom || !prenom) {
    return NextResponse.json(
      { error: "email, nom et prenom obligatoires" },
      { status: 400 },
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Create via invite — generates a set-password link and sends an email
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { nom, prenom },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/set-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Give the DB trigger time to create the profile row
  await new Promise((r) => setTimeout(r, 800));

  await supabase
    .from("profiles")
    .update({
      nom,
      prenom,
      telephone: telephone || null,
      roles: roles ?? [],
      etablissement_id: etablissement_id || null,
    })
    .eq("id", data.user.id);

  return NextResponse.json({ userId: data.user.id });
}
