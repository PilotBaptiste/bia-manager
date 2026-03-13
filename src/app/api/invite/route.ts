import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "email obligatoire" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Try invite first — works for new users and unconfirmed accounts
  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/set-password` },
  );

  if (!inviteErr) return NextResponse.json({ success: true });

  // If user is already confirmed, fall back to password reset link
  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/set-password`,
  });

  if (resetErr) {
    return NextResponse.json({ error: resetErr.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
