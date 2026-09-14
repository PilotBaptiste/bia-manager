import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { getOrgById, getRequestOrg } from "@/lib/org";

export type ClubInfo = {
  nom: string;
  sigle: string;
  email: string;
  telephone: string;
  lieuVol: string;
  whatsapp: string;
  telephoneSupport: string;
};

export const DEFAULT_CLUB_NOM = "BIA Manager";

const KEYS = {
  nom: "nom_aeroclub",
  sigle: "sigle_aeroclub",
  email: "email_aeroclub",
  telephone: "telephone_aeroclub",
  lieuVol: "lieu_vol",
  whatsapp: "whatsapp_support",
  telephoneSupport: "telephone_support",
} as const satisfies Record<keyof ClubInfo, string>;

// `orgId` omitted = club of the current request (subdomain, then signed-in user).
export const getClubInfo = cache(async (orgId?: string | null): Promise<ClubInfo> => {
  const p: Record<string, string> = {};
  let orgNom = "";
  try {
    const org = orgId ? await getOrgById(orgId) : await getRequestOrg();
    if (org) {
      orgNom = org.nom;
      const { data } = await createServiceClient()
        .from("parametres")
        .select("cle, valeur")
        .eq("organisation_id", org.id)
        .in("cle", Object.values(KEYS));
      for (const row of data ?? []) p[row.cle] = (row.valeur ?? "").trim();
    }
  } catch (e) {
    unstable_rethrow(e);
    console.error("getClubInfo:", e);
  }
  return {
    nom: p[KEYS.nom] || orgNom || DEFAULT_CLUB_NOM,
    sigle: p[KEYS.sigle] || "",
    email: p[KEYS.email] || "",
    telephone: p[KEYS.telephone] || "",
    lieuVol: p[KEYS.lieuVol] || "",
    whatsapp: (p[KEYS.whatsapp] || "").replace(/\D/g, ""),
    telephoneSupport: p[KEYS.telephoneSupport] || "",
  };
});
