import { createHmac, timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

// Une adresse peut refuser tous les emails d'un club. Le lien de désabonnement est signé :
// il ne permet d'agir que sur l'adresse à laquelle l'email a été envoyé.
const secret = () => process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const normaliserEmail = (email: string) => (email || "").trim().toLowerCase();

export function signerDesabonnement(orgId: string, email: string) {
  return createHmac("sha256", secret()).update(`${orgId}:${normaliserEmail(email)}`).digest("hex").slice(0, 32);
}

export function verifierSignature(orgId: string, email: string, signature: string) {
  const attendue = Buffer.from(signerDesabonnement(orgId, email));
  const fournie = Buffer.from(String(signature || ""));
  return attendue.length === fournie.length && timingSafeEqual(attendue, fournie);
}

export function lienDesabonnement(orgId: string, email: string, baseUrl: string) {
  const params = new URLSearchParams({ o: orgId, e: normaliserEmail(email), s: signerDesabonnement(orgId, email) });
  return `${baseUrl.replace(/\/$/, "")}/desabonnement?${params}`;
}

/** Adresses (en minuscules) qui ont refusé les emails de ce club. */
export async function adressesDesabonnees(orgId: string, emails: string[]): Promise<Set<string>> {
  const liste = Array.from(new Set(emails.map(normaliserEmail).filter(Boolean)));
  if (liste.length === 0) return new Set();
  const { data } = await createServiceClient()
    .from("preferences_email")
    .select("email")
    .eq("organisation_id", orgId)
    .eq("accepte", false)
    .in("email", liste);
  return new Set((data ?? []).map((r: any) => normaliserEmail(r.email)));
}

export async function estDesabonne(orgId: string, email: string) {
  return (await adressesDesabonnees(orgId, [email])).has(normaliserEmail(email));
}

export async function definirPreference(orgId: string, email: string, accepte: boolean, source: string) {
  const { error } = await createServiceClient().from("preferences_email").upsert({
    organisation_id: orgId, email: normaliserEmail(email), accepte, source, updated_at: new Date().toISOString(),
  }, { onConflict: "organisation_id,email" });
  if (error) throw new Error(error.message);
}

export function piedDesabonnement(lien: string) {
  return `
    <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:11px;line-height:1.6">
      Vous recevez cet email car votre adresse est rattachée au BIA de cet aéroclub.
      <a href="${lien}" style="color:#94a3b8;text-decoration:underline">Ne plus recevoir d'emails</a> —
      attention, vous ne recevrez alors plus aucune information : créneaux de vol disponibles, confirmations,
      rappels ou annulations. Il vous appartiendra de vous tenir informé auprès de l'aéroclub.
    </p>`;
}
