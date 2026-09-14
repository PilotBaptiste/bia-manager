import { cache } from "react";
import { headers } from "next/headers";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
import { ORG_SLUG_HEADER } from "@/lib/tenant";

export type Organisation = { id: string; slug: string; nom: string; actif: boolean };

export const getOrgBySlug = cache(async (slug: string): Promise<Organisation | null> => {
  const { data } = await createServiceClient()
    .from("organisations")
    .select("id, slug, nom, actif")
    .eq("slug", slug)
    .maybeSingle();
  return data ?? null;
});

export const getOrgById = cache(async (id: string): Promise<Organisation | null> => {
  const { data } = await createServiceClient()
    .from("organisations")
    .select("id, slug, nom, actif")
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
});

/**
 * Club of the current request: the subdomain when there is one (public pages such as login),
 * otherwise the club attached to the signed-in user's profile.
 */
export const getRequestOrg = cache(async (): Promise<Organisation | null> => {
  const slug = (await headers()).get(ORG_SLUG_HEADER);
  if (slug) return getOrgBySlug(slug);
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from("profiles").select("organisation_id").eq("id", user.id).single();
    return profile?.organisation_id ? getOrgById(profile.organisation_id) : null;
  } catch {
    return null;
  }
});
