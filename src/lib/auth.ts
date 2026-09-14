import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function getCurrentProfile() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/connexion");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/auth/connexion");
  if (profile.actif === false) redirect("/auth/compte-desactive");
  return profile;
}

export async function requireRolePage(roles: string[]) {
  const profile = await getCurrentProfile();
  if (!roles.some((r) => (profile.roles || []).includes(r))) redirect("/dashboard");
  return profile;
}

type AuthOk = { userId: string; email: string | undefined; roles: string[]; profile: any };

// Returns the refusal response directly so callers can narrow with `instanceof NextResponse`.
// Empty `roles` = any signed-in user.
export async function requireRole(roles: string[] = []): Promise<AuthOk | NextResponse> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.actif === false) {
    return NextResponse.json({ error: "Compte désactivé" }, { status: 403 });
  }
  const userRoles: string[] = profile.roles || [];
  if (roles.length > 0 && !roles.some((r) => userRoles.includes(r))) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  return { userId: user.id, email: user.email, roles: userRoles, profile };
}
