import { cache } from "react";
import { createClient } from "@supabase/supabase-js";

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

export const getClubInfo = cache(async (): Promise<ClubInfo> => {
  const p: Record<string, string> = {};
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("parametres")
      .select("cle, valeur")
      .in("cle", Object.values(KEYS));
    for (const row of data ?? []) p[row.cle] = (row.valeur ?? "").trim();
  } catch (e) {
    console.error("getClubInfo:", e);
  }
  return {
    nom: p[KEYS.nom] || DEFAULT_CLUB_NOM,
    sigle: p[KEYS.sigle] || "",
    email: p[KEYS.email] || "",
    telephone: p[KEYS.telephone] || "",
    lieuVol: p[KEYS.lieuVol] || "",
    whatsapp: (p[KEYS.whatsapp] || "").replace(/\D/g, ""),
    telephoneSupport: p[KEYS.telephoneSupport] || "",
  };
});
